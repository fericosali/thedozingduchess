import {
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as SalesIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
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
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { logSaleTransaction } from "../lib/financialJournal";
import { supabase } from "../lib/supabase";
import { formatNumber, formatPrice, formatQuantity } from "../lib/utils";

interface Sale {
  id: string;
  variant_id: string;
  marketplace: string;
  invoice_number: string;
  quantity: number;
  selling_price: number;
  total_revenue: number;
  cogs_used: number;
  profit: number;
  sale_date: string;
  created_at: string;
  product_name: string;
  variant: string;
  size: string;
  sku: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  marketplace: string;
  sale_date: string;
  total_amount: number;
  total_profit: number;
  total_cogs: number;
  created_at: string;
  items: Sale[];
}

interface InvoiceItem {
  variant_id: string;
  variant_name: string;
  sku: string;
  quantity: number;
  available_quantity: number;
}

interface NewInvoice {
  marketplace: string;
  invoice_number: string;
  total_amount: number | "";
  sale_date: string;
}

interface ProductVariant {
  id: string;
  product_name: string;
  variant: string;
  size: string;
  sku: string;
  available_quantity: number;
}

const Sales: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  // View invoice dialog state
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Invoice form state
  const [newInvoice, setNewInvoice] = useState<NewInvoice>({
    marketplace: "",
    invoice_number: "",
    total_amount: "",
    sale_date: new Date().toISOString().split("T")[0],
  });

  // Invoice items state
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [currentItem, setCurrentItem] = useState<InvoiceItem>({
    variant_id: "",
    variant_name: "",
    sku: "",
    quantity: 1,
    available_quantity: 0,
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const steps = ["Invoice Details", "Add Items", "Review & Submit"];

  useEffect(() => {
    fetchSales();
    fetchVariants();
  }, []);

  const fetchSales = async () => {
    try {
      // Use invoice_details view (introduced in migration 003/010)
      const { data, error } = await supabase
        .from("invoice_details")
        .select("*")
        .order("sale_date", { ascending: false });

      if (error) throw error;

      // Map view rows to existing Sale interface shape
      const formattedSales: Sale[] = (data || []).map((row: any) => ({
        id: row.item_id,
        variant_id: row.variant_id,
        marketplace: row.marketplace,
        invoice_number: row.invoice_number,
        quantity: row.quantity,
        selling_price: row.proportional_revenue, // per-item revenue
        total_revenue: row.proportional_revenue,
        // Treat COGS as zero for profit reporting
        cogs_used: 0,
        // Profit equals revenue (purchases tracked as expenses separately)
        profit: row.proportional_revenue,
        sale_date: row.sale_date,
        created_at: row.created_at ?? row.sale_date, // view doesn’t expose created_at
        product_name: row.product_name,
        variant: row.variant,
        size: row.size,
        sku: row.sku,
      }));

      setSales(formattedSales);

      // Group by invoice_number + marketplace
      const invoiceMap = new Map<string, Invoice>();
      formattedSales.forEach((sale) => {
        const key = `${sale.invoice_number}-${sale.marketplace}`;
        if (!invoiceMap.has(key)) {
          invoiceMap.set(key, {
            id: sale.invoice_number,
            invoice_number: sale.invoice_number,
            marketplace: sale.marketplace,
            sale_date: sale.sale_date,
            total_amount: 0,
            total_profit: 0,
            total_cogs: 0,
            created_at: sale.created_at,
            items: [],
          });
        }
        const invoice = invoiceMap.get(key)!;
        invoice.items.push(sale);
        invoice.total_amount += sale.total_revenue;
        // Profit equals revenue; COGS ignored
        invoice.total_profit += sale.total_revenue;
        invoice.total_cogs += 0;
      });

      setInvoices(Array.from(invoiceMap.values()));
    } catch (err) {
      setError("Failed to fetch sales data");
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          `
          id,
          variant,
          size,
          sku,
          products!inner(name),
          inventory(total_quantity)
        `
        )
        .eq("is_active", true);

      if (error) throw error;

      const formattedVariants =
        data?.map((v) => {
          const inv = (v as any).inventory;
          const qty = Array.isArray(inv)
            ? inv?.[0]?.total_quantity ?? 0
            : inv?.total_quantity ?? 0;
          return {
            id: v.id,
            product_name: (v.products as any).name,
            variant: v.variant,
            size: v.size,
            sku: v.sku,
            available_quantity: qty,
          };
        }) || [];

      setVariants(formattedVariants);
    } catch (err) {
      console.error("Error fetching variants:", err);
    }
  };

  const addItemToInvoice = () => {
    if (!currentItem.variant_id || currentItem.quantity <= 0) {
      setError("Please select a product and enter a valid quantity");
      return;
    }

    const variant = variants.find((v) => v.id === currentItem.variant_id);
    if (!variant) return;

    if (currentItem.quantity > variant.available_quantity) {
      setError(`Insufficient stock. Available: ${variant.available_quantity}`);
      return;
    }

    // Check if item already exists in invoice
    const existingItemIndex = invoiceItems.findIndex(
      (item) => item.variant_id === currentItem.variant_id
    );
    if (existingItemIndex >= 0) {
      const updatedItems = [...invoiceItems];
      updatedItems[existingItemIndex].quantity += currentItem.quantity;
      setInvoiceItems(updatedItems);
    } else {
      const newItem: InvoiceItem = {
        ...currentItem,
        variant_name: `${variant.product_name} - ${variant.variant} - ${variant.size}`,
        sku: variant.sku,
        available_quantity: variant.available_quantity,
      };
      setInvoiceItems([...invoiceItems, newItem]);
    }

    setCurrentItem({
      variant_id: "",
      variant_name: "",
      sku: "",
      quantity: 1,
      available_quantity: 0,
    });
    setError(null);
  };

  const removeItemFromInvoice = (index: number) => {
    const updatedItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(updatedItems);
  };

  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) {
      setError("Please add at least one item to the invoice");
      return;
    }

    const totalAmount =
      newInvoice.total_amount === "" ? 0 : newInvoice.total_amount;

    if (
      !newInvoice.marketplace ||
      !newInvoice.invoice_number ||
      totalAmount <= 0
    ) {
      setError("Please fill in all invoice details");
      return;
    }

    try {
      // Calculate total quantity for profit distribution
      const totalQuantity = invoiceItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      // Create invoice header
      const { data: invoiceRows, error: invError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: newInvoice.invoice_number,
          marketplace: newInvoice.marketplace,
          total_selling_price: totalAmount,
          sale_date: newInvoice.sale_date,
        })
        .select();

      if (invError) throw invError;

      const invoiceId = Array.isArray(invoiceRows)
        ? invoiceRows[0]?.id
        : (invoiceRows as any)?.id;
      if (!invoiceId) throw new Error("Failed to create invoice");

      // Create invoice items with proportional revenue
      const itemsData = invoiceItems.map((item) => {
        const itemRevenue = (item.quantity / totalQuantity) * totalAmount;
        return {
          invoice_id: invoiceId,
          variant_id: item.variant_id,
          quantity: item.quantity,
          proportional_revenue: itemRevenue,
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsData)
        .select();
      if (itemsError) throw itemsError;

      // Log the sale transaction to financial journal
      try {
        // Log revenue (credit) against invoices table
        await logSaleTransaction(
          invoiceId,
          newInvoice.marketplace,
          totalAmount,
          "IDR",
          "invoices"
        );

        // Skip COGS logging; purchases are recorded as expenses
      } catch (logError) {
        console.warn("Failed to log sale transaction:", logError);
        // Don't throw error for logging failure, just warn
      }

      setSuccess("Invoice created successfully");
      setSaleDialogOpen(false);
      resetForm();
      fetchSales();
      fetchVariants(); // Refresh to update available quantities
    } catch (err) {
      setError("Failed to create invoice");
      console.error("Error creating invoice:", err);
    }
  };

  const resetForm = () => {
    setNewInvoice({
      marketplace: "",
      invoice_number: "",
      total_amount: "",
      sale_date: new Date().toISOString().split("T")[0],
    });
    setInvoiceItems([]);
    setCurrentItem({
      variant_id: "",
      variant_name: "",
      sku: "",
      quantity: 1,
      available_quantity: 0,
    });
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!newInvoice.marketplace || !newInvoice.invoice_number) {
        setError("Please fill in marketplace and invoice number");
        return;
      }
    }
    if (activeStep === 1) {
      if (invoiceItems.length === 0) {
        setError("Please add at least one item");
        return;
      }
    }
    setError(null);
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const getMarketplaceColor = (marketplace: string) => {
    const colors: {
      [key: string]:
        | "primary"
        | "secondary"
        | "success"
        | "warning"
        | "error"
        | "info";
    } = {
      Amazon: "warning",
      eBay: "primary",
      Shopify: "success",
      Etsy: "secondary",
      Facebook: "info",
      Instagram: "error",
    };
    return colors[marketplace] || "default";
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_revenue, 0);
  // Profit equals revenue; ignore COGS
  const totalProfit = totalRevenue;
  const totalCOGS = 0;
  const totalInvoices = invoices.length;
  const averageOrderValue =
    totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
  const marketplaceCounts = invoices.reduce(
    (acc: Record<string, number>, inv) => {
      acc[inv.marketplace] = (acc[inv.marketplace] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topMarketplaceName =
    Object.entries(marketplaceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    null;

  const openInvoiceDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setOpenViewDialog(true);
  };

  const closeInvoiceDialog = () => {
    setOpenViewDialog(false);
    setSelectedInvoice(null);
  };

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
    <Box sx={{ p: 3 }}>
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
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: "bold", color: "#1a1a1a" }}
        >
          Sales Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<ReceiptIcon />}
          onClick={() => setSaleDialogOpen(true)}
          sx={{ bgcolor: "#e91e63", "&:hover": { bgcolor: "#c2185b" } }}
        >
          Create Invoice
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Invoices
                  </Typography>
                  <Typography variant="h5">
                    {formatNumber(totalInvoices)}
                  </Typography>
                </Box>
                <ReceiptIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Revenue
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {formatPrice(totalRevenue)}
                  </Typography>
                </Box>
                <MoneyIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Avg Order Value
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatPrice(averageOrderValue)}
                  </Typography>
                </Box>
                <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Top Marketplace
                  </Typography>
                  <Typography variant="h6">
                    {topMarketplaceName || "—"}
                  </Typography>
                </Box>
                <SalesIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invoices Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice Date</TableCell>
                <TableCell>Invoice Number</TableCell>
                <TableCell>Marketplace</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                {/* Removed profit column to avoid redundancy */}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={`${invoice.invoice_number}-${invoice.marketplace}`}
                >
                  <TableCell>
                    {new Date(invoice.sale_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {invoice.invoice_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={invoice.marketplace}
                      color={getMarketplaceColor(invoice.marketplace)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatNumber(invoice.items.length)} items
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      color="success.main"
                    >
                      {formatPrice(invoice.total_amount)}
                    </Typography>
                  </TableCell>
                  {/* Removed profit value cell */}
                  <TableCell align="center">
                    <Tooltip title="View details">
                      <IconButton
                        size="small"
                        onClick={() => openInvoiceDialog(invoice)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Invoice Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={closeInvoiceDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Invoice Details
          {selectedInvoice ? ` - ${selectedInvoice.invoice_number}` : ""}
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Marketplace
                  </Typography>
                  <Chip
                    label={selectedInvoice.marketplace}
                    color={getMarketplaceColor(selectedInvoice.marketplace)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Invoice Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedInvoice.sale_date).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: "bold", color: "success.main" }}
                  >
                    {formatPrice(selectedInvoice.total_amount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Items
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedInvoice.items.length)} items
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Invoice Items
              </Typography>
              <List>
                {selectedInvoice.items.map((item, idx) => (
                  <ListItem key={`${item.sku}-${idx}`} divider>
                    <ListItemText
                      primary={`${item.product_name} — ${item.variant} (${item.size})`}
                      secondary={`SKU: ${item.sku} | Qty: ${formatQuantity(
                        item.quantity
                      )} | Revenue: ${formatPrice(item.total_revenue)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeInvoiceDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog
        open={saleDialogOpen}
        onClose={() => setSaleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Invoice</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {activeStep === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="marketplace-label">Marketplace</InputLabel>
                    <Select
                      labelId="marketplace-label"
                      label="Marketplace"
                      value={newInvoice.marketplace}
                      onChange={(e) =>
                        setNewInvoice((prev) => ({
                          ...prev,
                          marketplace: String(e.target.value),
                        }))
                      }
                    >
                      <MenuItem value="Shopee">Shopee</MenuItem>
                      <MenuItem value="TikTok">TikTok</MenuItem>
                      <MenuItem value="Tokopedia">Tokopedia</MenuItem>
                      <MenuItem value="Lazada">Lazada</MenuItem>
                      <MenuItem value="Manual">Manual</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Number"
                    value={newInvoice.invoice_number}
                    onChange={(e) =>
                      setNewInvoice((prev) => ({
                        ...prev,
                        invoice_number: e.target.value,
                      }))
                    }
                    fullWidth
                    required
                    placeholder="e.g., INV-2024-001"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Sale Date"
                    type="date"
                    value={newInvoice.sale_date}
                    onChange={(e) =>
                      setNewInvoice((prev) => ({
                        ...prev,
                        sale_date: e.target.value,
                      }))
                    }
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Total Invoice Amount (IDR)"
                    type="number"
                    value={newInvoice.total_amount}
                    onChange={(e) =>
                      setNewInvoice((prev) => ({
                        ...prev,
                        total_amount:
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value),
                      }))
                    }
                    fullWidth
                    required
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
              </Grid>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Add Items to Invoice
                </Typography>

                {/* Add Item Form */}
                <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      options={variants}
                      getOptionLabel={(option) =>
                        `${option.product_name} - ${option.variant} - ${option.size} (${option.sku}) - Stock: ${option.available_quantity}`
                      }
                      value={
                        variants.find((v) => v.id === currentItem.variant_id) ||
                        null
                      }
                      onChange={(_, value) => {
                        setCurrentItem({
                          ...currentItem,
                          variant_id: value?.id || "",
                          available_quantity: value?.available_quantity || 0,
                        });
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Product Variant" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Quantity"
                      type="number"
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      fullWidth
                      inputProps={{
                        min: 1,
                        max: currentItem.available_quantity,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Button
                      variant="outlined"
                      onClick={addItemToInvoice}
                      fullWidth
                      startIcon={<Plus size={16} />}
                      sx={{ borderColor: "#e91e63", color: "#e91e63" }}
                    >
                      Add Item
                    </Button>
                  </Grid>
                </Grid>

                {/* Items List */}
                {invoiceItems.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Invoice Items:
                    </Typography>
                    <List>
                      {invoiceItems.map((item, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={item.variant_name}
                            secondary={`SKU: ${
                              item.sku
                            } | Quantity: ${formatQuantity(item.quantity)}`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => removeItemFromInvoice(index)}
                              sx={{ color: "#f44336" }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}

            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Review Invoice
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Marketplace
                    </Typography>
                    <Typography variant="body1">
                      {newInvoice.marketplace}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Invoice Number
                    </Typography>
                    <Typography variant="body1">
                      {newInvoice.invoice_number}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Sale Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(newInvoice.sale_date).toLocaleDateString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: "bold", color: "#e91e63" }}
                    >
                      {formatPrice(Number(newInvoice.total_amount))}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Items ({invoiceItems.length}):
                </Typography>
                <List>
                  {invoiceItems.map((item, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={item.variant_name}
                        secondary={`SKU: ${item.sku} | Quantity: ${item.quantity}`}
                      />
                    </ListItem>
                  ))}
                </List>

                <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Note: The total amount will be distributed proportionally
                    among items based on quantity. COGS and profit will be
                    calculated automatically using FIFO method.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaleDialogOpen(false)}>Cancel</Button>
          {activeStep > 0 && (
            <Button onClick={handleBack} startIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="contained"
              endIcon={<ArrowRight size={16} />}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleCreateInvoice}
              variant="contained"
              sx={{ bgcolor: "#e91e63", "&:hover": { bgcolor: "#c2185b" } }}
            >
              Create Invoice
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Sales;
