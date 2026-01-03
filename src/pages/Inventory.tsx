import {
  Edit as EditIcon,
  History as HistoryIcon,
  Inventory as InventoryIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { CostBreakdownTooltip } from "../components/CostBreakdownTooltip";
import { supabase } from "../lib/supabase";
import { formatNumber, formatPrice, formatQuantity } from "../lib/utils";

interface InventoryItem {
  id: string;
  variant_id: string;
  total_quantity: number;
  average_cogs: number;
  total_value: number;
  last_updated: string;
  product_name: string;
  variant: string;
  size: string;
  sku: string;
  product_url: string;
  available_stock: number;
  // Cost breakdown data for tooltip
  weighted_cny_price: number;
  weighted_exchange_rate: number;
  weighted_gap_per_unit: number;
  weighted_logistics_fee_per_unit: number;
  total_remaining_quantity: number;
  // Display fields derived from weighted costs
  display_average_cogs: number;
  display_total_value: number;
}

interface SaleHistoryItem {
  id: string;
  invoice_number: string;
  marketplace: string;
  quantity: number;
  selling_price: number;
  total_revenue: number;
  sale_date: string;
}

const Inventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [totalPurchasedQty, setTotalPurchasedQty] = useState(0);
  const [totalAvailableQty, setTotalAvailableQty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stock Adjustment State
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(1);
  const [adjustmentReason, setAdjustmentReason] = useState("Defect");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Sales History State
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [salesHistory, setSalesHistory] = useState<SaleHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);

      // Fetch inventory with product variants (direct relationship)
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(
          `
          *,
          product_variants!inner(
            id,
            sku,
            variant,
            size,
            products!inner(
              name,
              product_url
            )
          )
        `
        )
        .eq("product_variants.is_active", true);

      if (inventoryError) throw inventoryError;

      // Fetch purchase batches with purchase orders (separate query)
      const { data: batchesData, error: batchesError } = await supabase.from(
        "purchase_batches"
      ).select(`
          variant_id,
          cny_price,
          logistics_fee_per_unit,
          gap_per_unit,
          remaining_quantity,
          quantity,
          purchase_orders(exchange_rate)
        `);

      if (batchesError) throw batchesError;

      // Calculate global totals from batches
      const totalPurchased =
        batchesData?.reduce((sum, batch) => sum + (batch.quantity || 0), 0) ||
        0;
      const totalAvailable =
        batchesData?.reduce(
          (sum, batch) => sum + (batch.remaining_quantity || 0),
          0
        ) || 0;

      setTotalPurchasedQty(totalPurchased);
      setTotalAvailableQty(totalAvailable);

      // Join inventory data with purchase batches by variant_id
      const processedData =
        inventoryData?.map((item) => {
          // Find all batches for this variant
          const batches =
            batchesData?.filter(
              (batch) => batch.variant_id === item.variant_id
            ) || [];
          const activeBatches = batches.filter(
            (batch: any) => batch.remaining_quantity > 0
          );

          // Add product information from the joined data
          const productVariant = item.product_variants;
          const product = productVariant?.products;

          // Calculate stock status
          const availableStock = activeBatches.reduce(
            (sum: number, batch: any) => sum + batch.remaining_quantity,
            0
          );

          if (activeBatches.length === 0) {
            return {
              ...item,
              product_name: product?.name || "Unknown Product",
              variant: productVariant?.variant || "Unknown Variant",
              size: productVariant?.size || "Unknown Size",
              sku: productVariant?.sku || "Unknown SKU",
              product_url: product?.product_url || "",
              available_stock: availableStock,
              weighted_cny_price: 0,
              weighted_exchange_rate: 0,
              weighted_gap_per_unit: 0,
              weighted_logistics_fee_per_unit: 0,
              total_remaining_quantity: 0,
              display_average_cogs: item.average_cogs,
              display_total_value: item.average_cogs * item.total_quantity,
            };
          }

          const totalRemainingQty = activeBatches.reduce(
            (sum: number, batch: any) => sum + batch.remaining_quantity,
            0
          );

          // Calculate weighted averages
          const weightedCnyPrice =
            activeBatches.reduce(
              (sum: number, batch: any) =>
                sum + batch.cny_price * batch.remaining_quantity,
              0
            ) / totalRemainingQty;

          const weightedExchangeRate =
            activeBatches.reduce(
              (sum: number, batch: any) =>
                sum +
                (batch.purchase_orders?.exchange_rate *
                  batch.remaining_quantity || 0),
              0
            ) / totalRemainingQty;

          const weightedGapPerUnit =
            activeBatches.reduce(
              (sum: number, batch: any) =>
                sum + batch.gap_per_unit * batch.remaining_quantity,
              0
            ) / totalRemainingQty;

          const weightedLogisticsFeePerUnit =
            activeBatches.reduce(
              (sum: number, batch: any) =>
                sum + batch.logistics_fee_per_unit * batch.remaining_quantity,
              0
            ) / totalRemainingQty;

          // Final unit cost should include base price, gap split, and logistics fee
          const weightedFinalUnitCost =
            weightedCnyPrice * weightedExchangeRate +
            weightedGapPerUnit +
            weightedLogisticsFeePerUnit;
          const displayAverageCogs =
            totalRemainingQty > 0 ? weightedFinalUnitCost : item.average_cogs;
          const displayTotalValue = displayAverageCogs * item.total_quantity;

          return {
            ...item,
            product_name: product?.name || "Unknown Product",
            variant: productVariant?.variant || "Unknown Variant",
            size: productVariant?.size || "Unknown Size",
            sku: productVariant?.sku || "Unknown SKU",
            product_url: product?.product_url || "",
            available_stock: availableStock,
            weighted_cny_price: weightedCnyPrice,
            weighted_exchange_rate: weightedExchangeRate,
            weighted_gap_per_unit: weightedGapPerUnit,
            weighted_logistics_fee_per_unit: weightedLogisticsFeePerUnit,
            total_remaining_quantity: totalRemainingQty,
            display_average_cogs: displayAverageCogs,
            display_total_value: displayTotalValue,
          };
        }) || [];

      // Sort by SKU with logical size ordering
      const sortedData = processedData.sort((a, b) => {
        // Define size order priority
        const sizeOrder = { s: 1, m: 2, l: 3, xl: 4, xxl: 5 };

        // Extract base name and size from SKU (assuming format: name_size)
        const getSkuParts = (sku: string) => {
          const parts = sku.toLowerCase().split("_");
          const size = parts[parts.length - 1]; // Last part is size
          const baseName = parts.slice(0, -1).join("_"); // Everything except last part
          return { baseName, size };
        };

        const skuA = getSkuParts(a.sku);
        const skuB = getSkuParts(b.sku);

        // First sort by base name
        const baseNameComparison = skuA.baseName.localeCompare(skuB.baseName);
        if (baseNameComparison !== 0) {
          return baseNameComparison;
        }

        // If same base name, sort by size order
        const sizeA = sizeOrder[skuA.size as keyof typeof sizeOrder] || 999;
        const sizeB = sizeOrder[skuB.size as keyof typeof sizeOrder] || 999;

        return sizeA - sizeB;
      });

      setInventory(sortedData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch inventory"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!selectedItem || adjustmentQuantity <= 0) return;

    try {
      setAdjusting(true);

      const { error } = await supabase.rpc("handle_manual_adjustment", {
        p_variant_id: selectedItem.variant_id,
        p_quantity: adjustmentQuantity,
        p_reason: `${adjustmentReason}: ${adjustmentNotes}`,
      });

      if (error) throw error;

      setSuccess(`Successfully adjusted stock for ${selectedItem.sku}`);
      setAdjustmentDialogOpen(false);
      fetchInventory(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setAdjusting(false);
    }
  };

  const openAdjustmentDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentQuantity(1);
    setAdjustmentReason("Defect");
    setAdjustmentNotes("");
    setAdjustmentDialogOpen(true);
  };

  const openHistoryDialog = async (item: InventoryItem) => {
    setSelectedItem(item);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setSalesHistory([]);

    try {
      // Query the invoice_details view which joins invoices and invoice_items
      const { data, error } = await supabase
        .from("invoice_details")
        .select("*")
        .eq("variant_id", item.variant_id)
        .order("sale_date", { ascending: false });

      if (error) throw error;

      // Map the view data to our SaleHistoryItem interface
      const historyItems: SaleHistoryItem[] = (data || []).map(
        (record: any) => ({
          id: record.item_id, // Use item_id from view
          invoice_number: record.invoice_number,
          marketplace: record.marketplace,
          quantity: record.quantity,
          // Calculate unit selling price from proportional revenue
          selling_price:
            record.quantity > 0
              ? record.proportional_revenue / record.quantity
              : 0,
          total_revenue: record.proportional_revenue,
          sale_date: record.sale_date,
        })
      );

      setSalesHistory(historyItems);
    } catch (err) {
      console.error("Error fetching sales history:", err);
      setError("Failed to fetch sales history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.total_quantity === 0) {
      return {
        label: "Out of Stock",
        color: "error" as const,
        icon: <WarningIcon />,
      };
    } else {
      return {
        label: "In Stock",
        color: "success" as const,
        icon: <InventoryIcon />,
      };
    }
  };

  const outOfStockItems = inventory.filter((item) => item.total_quantity === 0);
  const totalValue = inventory.reduce((sum, item) => sum + item.total_value, 0);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Items
                  </Typography>
                  <Typography variant="h5">
                    {formatNumber(inventory.length)}
                  </Typography>
                </Box>
                <InventoryIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Stock Status
                  </Typography>
                  <Box display="flex" alignItems="baseline" gap={1}>
                    <Typography variant="h5" color="primary.main">
                      {formatNumber(totalAvailableQty)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      / {formatNumber(totalPurchasedQty)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Available / Total Purchased
                  </Typography>
                </Box>
                <TrendingDownIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Value
                  </Typography>
                  <Typography variant="h5">
                    {formatPrice(totalValue)}
                  </Typography>
                </Box>
                <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Inventory Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Avg COGS (IDR)</TableCell>
                <TableCell align="right">Total Value (IDR)</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.map((item) => {
                const status = getStockStatus(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {item.product_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.variant} - {item.size}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {item.sku}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatQuantity(item.total_quantity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {item.total_remaining_quantity > 0 ? (
                        <CostBreakdownTooltip
                          data={{
                            cnyPrice: item.weighted_cny_price,
                            exchangeRate: item.weighted_exchange_rate,
                            gapPerUnit: item.weighted_gap_per_unit,
                            logisticsFeePerUnit:
                              item.weighted_logistics_fee_per_unit,
                            totalQuantity: item.total_remaining_quantity,
                          }}
                          placement="left"
                          title="Average COGS Breakdown"
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: "medium",
                              cursor: "help",
                              textDecoration: "underline",
                              textDecorationStyle: "dotted",
                              "&:hover": {
                                color: "primary.main",
                              },
                            }}
                          >
                            {formatPrice(item.display_average_cogs)}
                          </Typography>
                        </CostBreakdownTooltip>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {formatPrice(item.display_average_cogs)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatPrice(item.display_total_value)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={status.icon}
                        label={status.label}
                        color={status.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Sales History">
                        <IconButton
                          size="small"
                          onClick={() => openHistoryDialog(item)}
                          color="primary"
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Adjust Stock (Defect/Loss)">
                        <IconButton
                          size="small"
                          onClick={() => openAdjustmentDialog(item)}
                          disabled={item.total_quantity === 0}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Stock Adjustment Dialog */}
      <Dialog
        open={adjustmentDialogOpen}
        onClose={() => !adjusting && setAdjustmentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Adjust Stock Level</DialogTitle>
        <DialogContent>
          <Box mt={2} display="flex" flexDirection="column" gap={3}>
            <Alert severity="info">
              Removing items via this form will{" "}
              <strong>preserve total inventory value</strong>, which will{" "}
              <strong>increase the average COGS</strong> of the remaining items.
              Use this for defects, lost items, or damages.
            </Alert>

            <Typography variant="subtitle2">
              Product: {selectedItem?.product_name} ({selectedItem?.sku})
            </Typography>

            <TextField
              label="Quantity to Remove"
              type="number"
              value={adjustmentQuantity}
              onChange={(e) =>
                setAdjustmentQuantity(parseInt(e.target.value) || 0)
              }
              fullWidth
              inputProps={{ min: 1, max: selectedItem?.total_quantity }}
              helperText={`Available: ${selectedItem?.total_quantity}`}
            />

            <TextField
              select
              label="Reason"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              fullWidth
            >
              <MenuItem value="Defect">Defect</MenuItem>
              <MenuItem value="Lost">Lost / Missing</MenuItem>
              <MenuItem value="Damage">Damage</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>

            <TextField
              label="Notes"
              value={adjustmentNotes}
              onChange={(e) => setAdjustmentNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional details..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAdjustmentDialogOpen(false)}
            disabled={adjusting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdjustment}
            variant="contained"
            color="warning"
            disabled={
              adjusting || !adjustmentQuantity || adjustmentQuantity <= 0
            }
          >
            {adjusting ? "Adjusting..." : "Confirm Adjustment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sales History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Sales History: {selectedItem?.product_name} ({selectedItem?.sku})
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : salesHistory.length === 0 ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <Typography color="textSecondary">
                No sales history found
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Marketplace</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Selling Price</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesHistory.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{sale.invoice_number}</TableCell>
                      <TableCell>
                        <Chip
                          label={sale.marketplace}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{sale.quantity}</TableCell>
                      <TableCell align="right">
                        {formatPrice(sale.selling_price)}
                      </TableCell>
                      <TableCell align="right">
                        {formatPrice(sale.total_revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
