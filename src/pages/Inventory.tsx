import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
  Button
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { CostBreakdownTooltip } from '../components/CostBreakdownTooltip';
import { formatPrice, formatNumber, formatQuantity } from '../lib/utils';

interface InventoryItem {
  id: string;
  variant_id: string;
  total_quantity: number;
  average_cogs: number;
  total_value: number;
  low_stock_threshold: number;
  last_updated: string;
  product_name: string;
  variant: string;
  size: string;
  sku: string;
  product_url: string;
  is_low_stock: boolean;
  available_stock: number;
  // Cost breakdown data for tooltip
  weighted_cny_price: number;
  weighted_exchange_rate: number;
  weighted_gap_per_unit: number;
  weighted_logistics_fee_per_unit: number;
  total_remaining_quantity: number;
}

const Inventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newThreshold, setNewThreshold] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      
      // Fetch inventory with product variants (direct relationship)
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
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
        `)
        .eq('product_variants.is_active', true);

      if (inventoryError) throw inventoryError;

      // Fetch purchase batches with purchase orders (separate query)
      const { data: batchesData, error: batchesError } = await supabase
        .from('purchase_batches')
        .select(`
          variant_id,
          cny_price,
          logistics_fee_per_unit,
          gap_per_unit,
          remaining_quantity,
          purchase_orders(exchange_rate)
        `);

      if (batchesError) throw batchesError;

      // Join inventory data with purchase batches by variant_id
      const processedData = inventoryData?.map(item => {
        // Find all batches for this variant
        const batches = batchesData?.filter(batch => batch.variant_id === item.variant_id) || [];
        const activeBatches = batches.filter((batch: any) => batch.remaining_quantity > 0);
        
        // Add product information from the joined data
        const productVariant = item.product_variants;
        const product = productVariant?.products;
        
        // Calculate low stock alert
        const isLowStock = item.total_quantity <= item.low_stock_threshold;
        const availableStock = activeBatches.reduce((sum: number, batch: any) => sum + batch.remaining_quantity, 0);
        
        if (activeBatches.length === 0) {
          return {
            ...item,
            product_name: product?.name || 'Unknown Product',
            variant: productVariant?.variant || 'Unknown Variant',
            size: productVariant?.size || 'Unknown Size',
            sku: productVariant?.sku || 'Unknown SKU',
            product_url: product?.product_url || '',
            is_low_stock: isLowStock,
            available_stock: availableStock,
            weighted_cny_price: 0,
            weighted_exchange_rate: 0,
            weighted_gap_per_unit: 0,
            weighted_logistics_fee_per_unit: 0,
            total_remaining_quantity: 0
          };
        }

        const totalRemainingQty = activeBatches.reduce((sum: number, batch: any) => sum + batch.remaining_quantity, 0);
        
        // Calculate weighted averages
        const weightedCnyPrice = activeBatches.reduce((sum: number, batch: any) => 
          sum + (batch.cny_price * batch.remaining_quantity), 0) / totalRemainingQty;
        
        const weightedExchangeRate = activeBatches.reduce((sum: number, batch: any) => 
          sum + (batch.purchase_orders?.exchange_rate * batch.remaining_quantity || 0), 0) / totalRemainingQty;
        
        const weightedGapPerUnit = activeBatches.reduce((sum: number, batch: any) => 
          sum + (batch.gap_per_unit * batch.remaining_quantity), 0) / totalRemainingQty;
        
        const weightedLogisticsFeePerUnit = activeBatches.reduce((sum: number, batch: any) => 
          sum + (batch.logistics_fee_per_unit * batch.remaining_quantity), 0) / totalRemainingQty;

        return {
          ...item,
          product_name: product?.name || 'Unknown Product',
          variant: productVariant?.variant || 'Unknown Variant',
          size: productVariant?.size || 'Unknown Size',
          sku: productVariant?.sku || 'Unknown SKU',
          product_url: product?.product_url || '',
          is_low_stock: isLowStock,
          available_stock: availableStock,
          weighted_cny_price: weightedCnyPrice,
          weighted_exchange_rate: weightedExchangeRate,
          weighted_gap_per_unit: weightedGapPerUnit,
          weighted_logistics_fee_per_unit: weightedLogisticsFeePerUnit,
          total_remaining_quantity: totalRemainingQty
        };
      }) || [];

      // Sort by SKU with logical size ordering
      const sortedData = processedData.sort((a, b) => {
        // Define size order priority
        const sizeOrder = { 's': 1, 'm': 2, 'l': 3, 'xl': 4, 'xxl': 5 };
        
        // Extract base name and size from SKU (assuming format: name_size)
        const getSkuParts = (sku: string) => {
          const parts = sku.toLowerCase().split('_');
          const size = parts[parts.length - 1]; // Last part is size
          const baseName = parts.slice(0, -1).join('_'); // Everything except last part
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
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThreshold = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ low_stock_threshold: newThreshold })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSuccess('Low stock threshold updated successfully');
      setThresholdDialogOpen(false);
      setSelectedItem(null);
      fetchInventory();
    } catch (err) {
      setError('Failed to update threshold');
      console.error('Error updating threshold:', err);
    }
  };

  const openThresholdDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewThreshold(item.low_stock_threshold);
    setThresholdDialogOpen(true);
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.total_quantity === 0) {
      return { label: 'Out of Stock', color: 'error' as const, icon: <WarningIcon /> };
    } else if (item.total_quantity <= item.low_stock_threshold) {
      return { label: 'Low Stock', color: 'warning' as const, icon: <WarningIcon /> };
    } else {
      return { label: 'In Stock', color: 'success' as const, icon: <InventoryIcon /> };
    }
  };

  const lowStockItems = inventory.filter(item => 
    item.total_quantity > 0 && item.total_quantity <= item.low_stock_threshold
  );
  const outOfStockItems = inventory.filter(item => item.total_quantity === 0);
  const totalValue = inventory.reduce((sum, item) => sum + item.total_value, 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
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
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
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
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Low Stock
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {formatNumber(lowStockItems.length)}
                  </Typography>
                </Box>
                <WarningIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Out of Stock
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {formatNumber(outOfStockItems.length)}
                  </Typography>
                </Box>
                <TrendingDownIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
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
                <TableCell align="center">Threshold</TableCell>
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
                            logisticsFeePerUnit: item.weighted_logistics_fee_per_unit,
                            totalQuantity: item.total_remaining_quantity
                          }}
                          placement="left"
                          title="Average COGS Breakdown"
                        >
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 'medium',
                              cursor: 'help',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted',
                              '&:hover': {
                                color: 'primary.main'
                              }
                            }}
                          >
                            {formatPrice(item.average_cogs)}
                          </Typography>
                        </CostBreakdownTooltip>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {formatPrice(item.average_cogs)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatPrice(item.total_value)}
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
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                        <Typography variant="body2">
                          {item.low_stock_threshold}
                        </Typography>
                        <Tooltip title="Edit threshold">
                          <IconButton
                            size="small"
                            onClick={() => openThresholdDialog(item)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Threshold Update Dialog */}
      <Dialog open={thresholdDialogOpen} onClose={() => setThresholdDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Low Stock Threshold</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <TextField
              label="Low Stock Threshold"
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(parseInt(e.target.value) || 0)}
              fullWidth
              inputProps={{ min: 0 }}
              helperText="Alert when stock falls to or below this level"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThresholdDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateThreshold} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;