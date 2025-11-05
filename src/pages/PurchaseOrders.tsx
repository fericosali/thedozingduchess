import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import { Plus, Edit, Trash2, ShoppingCart, Package, Eye, Zap, List as ListIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logPurchaseTransaction } from '../lib/financialJournal';
import { CostBreakdownTooltip } from '../components/CostBreakdownTooltip';
import { formatPrice, formatNumber, formatQuantity } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  variant: string;
  sku: string;
  size: string;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  actual_delivery?: string; // Optional, set when order is completed
  order_status: 'pending' | 'completed' | 'cancelled';
  total_logistics_fee?: number; // Optional, added later when order arrives
  exchange_rate: number;
  total_payment_idr: number;
  created_at: string;
  updated_at: string;
}

interface PurchaseBatch {
  id: string;
  purchase_order_id: string;
  variant_id: string;
  quantity: number;
  cny_price: number;
  logistics_fee_per_unit: number;
  unit_cogs: number;
  allocated_logistics_fee: number;
  gap_per_unit: number;
  remaining_quantity: number;
  created_at: string;
}

interface OrderItem {
  variant_id: string;
  variant_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
}

const PurchaseOrders: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseBatches, setPurchaseBatches] = useState<PurchaseBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openOrderDialog, setOpenOrderDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openCompleteDialog, setOpenCompleteDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [completionData, setCompletionData] = useState({
    orderId: '',
    actualDelivery: new Date().toISOString().split('T')[0],
    logisticsFee: '',
  });

  // Order form state
  const [orderForm, setOrderForm] = useState({
    supplier: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: '',
    total_logistics_fee: 0,
    exchange_rate: 15000, // Default CNY to IDR rate
    total_payment_idr: 0,
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Robust gap calculation function with edge case handling
  const calculateGapValues = (order: PurchaseOrder, batches: PurchaseBatch[]) => {
    try {
      // Validate inputs
      if (!order || !batches || batches.length === 0) {
        return { totalGap: 0, gapPerUnit: 0, isValid: false };
      }

      // Calculate total quantity with validation
      const totalQuantity = batches.reduce((sum, batch) => {
        const quantity = Number(batch.quantity) || 0;
        return sum + Math.max(0, quantity); // Ensure non-negative quantities
      }, 0);

      // Handle zero quantity edge case
      if (totalQuantity <= 0) {
        console.warn('Gap calculation: Total quantity is zero or negative');
        return { totalGap: 0, gapPerUnit: 0, isValid: false };
      }

      // Calculate total items cost with validation
      const totalItemsCost = batches.reduce((sum, batch) => {
        const quantity = Number(batch.quantity) || 0;
        const cnyPrice = Number(batch.cny_price) || 0;
        const exchangeRate = Number(order.exchange_rate) || 1;
        
        // Validate individual values
        if (quantity < 0 || cnyPrice < 0 || exchangeRate <= 0) {
          console.warn('Gap calculation: Invalid batch values detected', { quantity, cnyPrice, exchangeRate });
          return sum;
        }
        
        return sum + (quantity * cnyPrice * exchangeRate);
      }, 0);

      // Validate payment amount
      const totalPaymentIdr = Number(order.total_payment_idr) || 0;
      if (totalPaymentIdr < 0) {
        console.warn('Gap calculation: Negative payment amount detected');
        return { totalGap: 0, gapPerUnit: 0, isValid: false };
      }

      // Calculate gap values
      const totalGap = totalPaymentIdr - totalItemsCost;
      const gapPerUnit = totalGap / totalQuantity;

      // Validate results
      if (!isFinite(gapPerUnit) || isNaN(gapPerUnit)) {
        console.error('Gap calculation: Invalid gap per unit result');
        return { totalGap: 0, gapPerUnit: 0, isValid: false };
      }

      return {
        totalGap: Math.round(totalGap * 100) / 100, // Round to 2 decimal places
        gapPerUnit: Math.round(gapPerUnit * 100) / 100,
        isValid: true,
        totalQuantity,
        totalItemsCost: Math.round(totalItemsCost * 100) / 100,
        totalPaymentIdr
      };
    } catch (error) {
      console.error('Gap calculation error:', error);
      return { totalGap: 0, gapPerUnit: 0, isValid: false };
    }
  };
  const [itemRows, setItemRows] = useState<OrderItem[]>([{
    variant_id: '',
    variant_name: '',
    sku: '',
    quantity: 1,
    unit_cost: 0,
  }]);
  const [bulkQuantity, setBulkQuantity] = useState<number>(1);
  const [bulkUnitCost, setBulkUnitCost] = useState<number>(0);

  const statusColors = {
    pending: '#ff9800',
    completed: '#4caf50',
    cancelled: '#f44336',
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchPurchaseOrders(),
        fetchPurchaseBatches(),
        fetchProducts(),
        fetchVariants(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPurchaseOrders(data || []);
  };

  const fetchPurchaseBatches = async () => {
    const { data, error } = await supabase
      .from('purchase_batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPurchaseBatches(data || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (error) throw error;
    setProducts(data || []);
  };

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .order('variant');

    if (error) throw error;
    setVariants(data || []);
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Format: PO-YYYYMMDD-HHMMSS
    return `PO-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) {
      setError('Please add at least one item to the order');
      return;
    }

    if (orderForm.exchange_rate <= 0) {
      setError('Please enter a valid exchange rate');
      return;
    }

    try {
      // Calculate total amount (convert CNY to IDR) - no logistics fee initially
      const subtotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
      const subtotalIDR = subtotal * orderForm.exchange_rate;
      const calculatedTotal = subtotalIDR; // No logistics fee in initial order
      
      // Use total_payment_idr if provided, otherwise use calculated total
      const total_payment_idr = orderForm.total_payment_idr > 0 ? orderForm.total_payment_idr : calculatedTotal;
      
      // Calculate additional cost per unit if there's a gap
      const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const additionalCostGap = orderForm.total_payment_idr > 0 ? (orderForm.total_payment_idr - calculatedTotal) : 0;
      const additionalCostPerUnit = totalQuantity > 0 ? additionalCostGap / totalQuantity : 0;

      // Generate unique order number
      const order_number = generateOrderNumber();

      // Create purchase order
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .insert([{
          ...orderForm,
          order_number,
          total_payment_idr,
          order_status: 'pending',
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create purchase batches with distributed additional costs
      const batches = orderItems.map(item => {
        const baseUnitCostIDR = item.unit_cost * orderForm.exchange_rate;
        const additionalCostForItem = additionalCostPerUnit * item.quantity;
        const adjustedUnitCostIDR = baseUnitCostIDR + additionalCostPerUnit;
        
        return {
          purchase_order_id: orderData.id,
          variant_id: item.variant_id,
          cny_price: item.unit_cost, // CNY price per unit
          logistics_fee_per_unit: 0, // Initially 0, will be updated when logistics fee is added
          quantity: item.quantity,
          unit_cogs: adjustedUnitCostIDR, // This will be calculated by trigger, but we provide initial value
        };
      });

      const { error: batchError } = await supabase
        .from('purchase_batches')
        .insert(batches);

      if (batchError) throw batchError;

      // Log the purchase transaction to financial journal
      try {
        await logPurchaseTransaction(
          orderData.id,
          orderForm.supplier,
          total_payment_idr,
          'IDR'
        );
      } catch (logError) {
        console.warn('Failed to log purchase transaction:', logError);
        // Don't throw error for logging failure, just warn
      }

      // Refresh data
      await fetchData();
      
      // Reset form
      setOpenOrderDialog(false);
      setOrderForm({
        supplier: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: '',
        total_logistics_fee: 0,
        exchange_rate: 15000,
        total_payment_idr: 0,
      });
      setOrderItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    if (status === 'completed') {
      // Open completion dialog to get actual delivery date
      setCompletionData({
        orderId,
        actualDelivery: new Date().toISOString().split('T')[0],
        logisticsFee: '',
      });
      setOpenCompleteDialog(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ order_status: status })
        .eq('id', orderId);

      if (error) throw error;

      setPurchaseOrders(orders =>
        orders.map(order =>
          order.id === orderId ? { ...order, order_status: status as any } : order
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const handleCompleteOrder = async () => {
    try {
      // Prepare update data
      const updateData: any = {
        order_status: 'completed',
        actual_delivery: completionData.actualDelivery
      };

      // Add logistics fee if provided
      if (completionData.logisticsFee && completionData.logisticsFee.trim() !== '') {
        updateData.total_logistics_fee = parseFloat(completionData.logisticsFee);
      }

      // Update the purchase order
      const { error: orderError } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', completionData.orderId);

      if (orderError) throw orderError;

      // If logistics fee is provided, distribute it to purchase batches
      if (updateData.total_logistics_fee && updateData.total_logistics_fee > 0) {
        // Get all batches for this order with their CNY prices and exchange rate
        const { data: batches, error: batchesError } = await supabase
          .from('purchase_batches')
          .select('id, quantity, cny_price')
          .eq('purchase_order_id', completionData.orderId);

        if (batchesError) throw batchesError;

        // Get the exchange rate from the order
        const { data: orderData, error: orderDataError } = await supabase
          .from('purchase_orders')
          .select('exchange_rate')
          .eq('id', completionData.orderId)
          .single();

        if (orderDataError) throw orderDataError;

        if (batches && batches.length > 0 && orderData) {
          // Calculate total quantity across all batches
          const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
          
          // Calculate logistics fee per unit
          const logisticsFeePerUnit = totalQuantity > 0 ? updateData.total_logistics_fee / totalQuantity : 0;

          // Get the complete order data for gap calculation
          const { data: completeOrderData, error: completeOrderError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', completionData.orderId)
            .single();

          if (completeOrderError) throw completeOrderError;

          // Get full batch data for gap calculation
          const { data: fullBatches, error: fullBatchesError } = await supabase
            .from('purchase_batches')
            .select('*')
            .eq('purchase_order_id', completionData.orderId);

          if (fullBatchesError) throw fullBatchesError;

          // Calculate gap values using the robust calculation function
          const gapCalculation = calculateGapValues(completeOrderData, fullBatches || []);

          const gapPerUnit = gapCalculation.isValid ? gapCalculation.gapPerUnit : 0;

          // Update each batch with the new logistics fee per unit, gap per unit, and recalculated unit_cogs
          for (const batch of batches) {
            // Calculate new unit COGS: (CNY price * exchange rate) + gap per unit + logistics per unit
            const basePrice = batch.cny_price * orderData.exchange_rate;
            const newUnitCogs = basePrice + gapPerUnit + logisticsFeePerUnit;

            const { error: updateBatchError } = await supabase
              .from('purchase_batches')
              .update({ 
                logistics_fee_per_unit: logisticsFeePerUnit,
                gap_per_unit: gapPerUnit,
                unit_cogs: newUnitCogs
              })
              .eq('id', batch.id);

            if (updateBatchError) throw updateBatchError;
          }

          // Refresh purchase batches data to reflect the changes
          await fetchPurchaseBatches();
        }
      }

      setPurchaseOrders(orders =>
        orders.map(order =>
          order.id === completionData.orderId 
            ? { 
                ...order, 
                order_status: 'completed' as any, 
                actual_delivery: completionData.actualDelivery,
                ...(updateData.total_logistics_fee && { total_logistics_fee: updateData.total_logistics_fee })
              } 
            : order
        )
      );

      setOpenCompleteDialog(false);
      // Reset completion data
      setCompletionData({
        orderId: '',
        actualDelivery: new Date().toISOString().split('T')[0],
        logisticsFee: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete order');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      setPurchaseOrders(orders => orders.filter(order => order.id !== orderId));
      setPurchaseBatches(batches => batches.filter(batch => batch.purchase_order_id !== orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase order');
    }
  };

  const addRowToItems = () => {
    setItemRows([...itemRows, {
      variant_id: '',
      variant_name: '',
      sku: '',
      quantity: 1,
      unit_cost: 0,
    }]);
  };

  const removeRowFromItems = (index: number) => {
    if (itemRows.length > 1) {
      setItemRows(itemRows.filter((_, i) => i !== index));
    }
  };

  const updateItemRow = (index: number, field: keyof OrderItem, value: any) => {
    const updatedRows = [...itemRows];
    updatedRows[index] = { ...updatedRows[index], [field]: value };
    
    // If updating variant_id, also update variant_name and sku
    if (field === 'variant_id' && value) {
      const variant = variants.find(v => v.id === value);
      if (variant) {
        updatedRows[index].variant_name = variant.variant;
        updatedRows[index].sku = variant.sku;
      }
    }
    
    setItemRows(updatedRows);
  };

  const addAllItemsToOrder = () => {
    const validItems = itemRows.filter(row => 
      row.variant_id && row.quantity > 0 && row.unit_cost > 0
    );

    if (validItems.length === 0) {
      setError('Please add at least one valid item with product, quantity, and unit cost');
      return;
    }

    setOrderItems([...orderItems, ...validItems]);
    
    // Reset item rows to single empty row
    setItemRows([{
      variant_id: '',
      variant_name: '',
      sku: '',
      quantity: 1,
      unit_cost: 0,
    }]);
    
    setError(null);
  };

  const applyBulkQuantity = () => {
    const updatedRows = itemRows.map(row => 
      row.variant_id && row.quantity === 1 ? { ...row, quantity: bulkQuantity } : row
    );
    setItemRows(updatedRows);
  };

  const applyBulkUnitCost = () => {
    const updatedRows = itemRows.map(row => 
      row.variant_id && row.unit_cost === 0 ? { ...row, unit_cost: bulkUnitCost } : row
    );
    setItemRows(updatedRows);
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const getVariantDisplayName = (variant: ProductVariant) => {
    const product = products.find(p => p.id === variant.product_id);
    return `${product?.name || 'Unknown'} - ${variant.variant} (${variant.sku})`;
  };

  const getOrderBatches = (orderId: string) => {
    return purchaseBatches.filter(batch => batch.purchase_order_id === orderId);
  };

  const getVariantName = (variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    return variant ? `${variant.variant} (${variant.sku})` : 'Unknown Variant';
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const calculateSubtotalIDR = () => {
    return calculateSubtotal() * orderForm.exchange_rate;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading purchase orders...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
          Purchase Orders
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={() => setOpenOrderDialog(true)}
          sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' } }}
        >
          New Purchase Order
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Purchase Orders List */}
      <Grid container spacing={3}>
        {purchaseOrders.map((order) => (
          <Grid item xs={12} md={6} lg={4} key={order.id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {order.supplier}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {order.order_number}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedOrder(order);
                        setOpenViewDialog(true);
                      }}
                      sx={{ color: '#e91e63' }}
                    >
                      <Eye size={16} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteOrder(order.id)}
                      sx={{ color: '#f44336' }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>
                </Box>

                <Chip
                  label={order.order_status.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: statusColors[order.order_status] + '20',
                    color: statusColors[order.order_status],
                    mb: 2,
                  }}
                />

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Order Date: {new Date(order.order_date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Expected: {new Date(order.expected_delivery).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Items: {formatNumber(getOrderBatches(order.id).length)}
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#e91e63' }}>
                  {formatPrice(order.total_payment_idr)}
                </Typography>

                <Box sx={{ mt: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={order.order_status}
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Order Dialog */}
      <Dialog 
        open={openOrderDialog} 
        onClose={() => setOpenOrderDialog(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
          py: 3,
          fontSize: '1.5rem',
          fontWeight: 600,
          borderRadius: '12px 12px 0 0'
        }}>
          <ShoppingCart size={28} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
          Create New Purchase Order
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            
            {/* Order Information Card */}
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)'
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 3, 
                  color: '#2d3748',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Package size={20} />
                  Order Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Supplier Name"
                      value={orderForm.supplier}
                      onChange={(e) => setOrderForm({ ...orderForm, supplier: e.target.value })}
                      fullWidth
                      required
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Order Date"
                      type="date"
                      value={orderForm.order_date}
                      onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                      fullWidth
                      required
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Expected Delivery"
                      type="date"
                      value={orderForm.expected_delivery}
                      onChange={(e) => setOrderForm({ ...orderForm, expected_delivery: e.target.value })}
                      fullWidth
                      required
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Exchange Rate (CNY to IDR)"
                      type="number"
                      value={orderForm.exchange_rate}
                      onChange={(e) => setOrderForm({ ...orderForm, exchange_rate: parseFloat(e.target.value) || 15000 })}
                      fullWidth
                      required
                      inputProps={{ step: 0.01, min: 0 }}
                      helperText="Current rate: 1 CNY = ? IDR"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Total Payment (IDR)"
                      type="number"
                      value={orderForm.total_payment_idr === 0 ? '' : orderForm.total_payment_idr}
                      onChange={(e) => setOrderForm({ ...orderForm, total_payment_idr: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                      fullWidth
                      inputProps={{ step: 0.01, min: 0 }}
                      helperText="Actual amount paid (includes additional fees/shipping)"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Order Items
            </Typography>

            {/* Bulk Apply Controls Card */}
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)'
              },
              mb: 2
            }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 3, 
                  color: '#2d3748',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Plus size={20} />
                  Bulk Apply Controls
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Bulk Quantity"
                      type="number"
                      value={bulkQuantity}
                      onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 1)}
                      size="small"
                      fullWidth
                      inputProps={{ min: 1 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="contained"
                      onClick={applyBulkQuantity}
                      fullWidth
                      size="small"
                      sx={{
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                          boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      Apply Qty to All
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Bulk Unit Cost (CNY)"
                      type="number"
                      value={bulkUnitCost === 0 ? '' : bulkUnitCost}
                      onChange={(e) => setBulkUnitCost(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      size="small"
                      fullWidth
                      inputProps={{ step: 0.01, min: 0 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="contained"
                      onClick={applyBulkUnitCost}
                      fullWidth
                      size="small"
                      sx={{
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                          boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      Apply Cost to All
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="contained"
                      onClick={addRowToItems}
                      fullWidth
                      size="small"
                      sx={{
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                        boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #45a049 0%, #388e3c 100%)',
                          boxShadow: '0 6px 20px rgba(76, 175, 80, 0.6)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      Add Row
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Multi-row Item Table Card */}
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)'
              },
              mb: 2
            }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ p: 3, pb: 0 }}>
                  <Typography variant="h6" sx={{ 
                    mb: 2, 
                    color: '#2d3748',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <ListIcon size={20} />
                     Item Management Table
                  </Typography>
                </Box>
                <TableContainer sx={{ borderRadius: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        '& .MuiTableCell-head': {
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          borderBottom: 'none'
                        }
                      }}>
                        <TableCell>Product Variant</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Unit Cost (CNY)</TableCell>
                        <TableCell>Total (CNY)</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {itemRows.map((row, index) => (
                        <TableRow 
                          key={index}
                          sx={{
                            backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: '#e2e8f0',
                              transform: 'scale(1.01)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }
                          }}
                        >
                          <TableCell sx={{ minWidth: 200 }}>
                            <Autocomplete
                              options={variants}
                              getOptionLabel={(option) => getVariantDisplayName(option)}
                              value={variants.find(v => v.id === row.variant_id) || null}
                              onChange={(_, value) => {
                                updateItemRow(index, 'variant_id', value?.id || '');
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  placeholder="Select product..."
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      borderRadius: 2,
                                      transition: 'all 0.3s ease',
                                      '&:hover': {
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                      },
                                      '&.Mui-focused': {
                                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.25)'
                                      }
                                    }
                                  }}
                                />
                              )}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.sku || 'No SKU'}
                              size="small"
                              variant="outlined"
                              sx={{
                                borderRadius: 2,
                                backgroundColor: row.sku ? '#e3f2fd' : '#f5f5f5',
                                borderColor: row.sku ? '#2196f3' : '#e0e0e0',
                                color: row.sku ? '#1976d2' : '#757575'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.quantity}
                              onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 1)}
                              size="small"
                              inputProps={{ min: 1 }}
                              sx={{ 
                                width: 80,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                  },
                                  '&.Mui-focused': {
                                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.25)'
                                  }
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.unit_cost === 0 ? '' : row.unit_cost}
                              onChange={(e) => updateItemRow(index, 'unit_cost', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              size="small"
                              inputProps={{ step: 0.01, min: 0 }}
                              sx={{ 
                                width: 100,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                  },
                                  '&.Mui-focused': {
                                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.25)'
                                  }
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.variant_id && row.quantity > 0 && row.unit_cost > 0 
                                ? `¥${formatNumber(row.quantity * row.unit_cost)}`
                                : '-'
                              }
                              size="small"
                              sx={{
                                borderRadius: 2,
                                backgroundColor: '#e8f5e8',
                                color: '#2e7d32',
                                fontWeight: 600,
                                border: '1px solid #4caf50'
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              onClick={() => removeRowFromItems(index)}
                              disabled={itemRows.length === 1}
                              size="small"
                              sx={{
                                color: '#f44336',
                                borderRadius: 2,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: '#ffebee',
                                  transform: 'scale(1.1)',
                                  boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {itemRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center',
                              gap: 2,
                              color: '#64748b'
                            }}>
                              <Package size={48} style={{ opacity: 0.5 }} />
                              <Typography variant="h6" color="textSecondary">
                                No items added yet
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Click "Add Row" to start adding items to your purchase order
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Add All Items Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Button
                variant="contained"
                onClick={addAllItemsToOrder}
                disabled={itemRows.length === 0 || !itemRows.some(row => row.variant_id && row.quantity > 0 && row.unit_cost > 0)}
                size="large"
                sx={{ 
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                  px: 6,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                    boxShadow: '0 12px 35px rgba(102, 126, 234, 0.6)',
                    transform: 'translateY(-3px)'
                  },
                  '&:disabled': {
                    background: '#e2e8f0',
                    boxShadow: 'none',
                    transform: 'none'
                  }
                }}
              >
                <Plus size={20} style={{ marginRight: '8px' }} />
                Add All Items to Order ({itemRows.filter(row => row.variant_id && row.quantity > 0 && row.unit_cost > 0).length} items)
              </Button>
            </Box>

            {/* Items List */}
            {orderItems.length > 0 && (
              <List>
                {orderItems.map((item, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={item.variant_name}
                      secondary={`SKU: ${item.sku} | Qty: ${formatQuantity(item.quantity)} | Unit: ¥${formatNumber(item.unit_cost)} (≈ ${formatPrice(item.unit_cost * orderForm.exchange_rate)}) | Total: ¥${formatNumber(item.quantity * item.unit_cost)}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                         edge="end"
                         onClick={() => removeItemFromOrder(index)}
                         sx={{ color: '#f44336' }}
                       >
                         <Trash2 size={16} />
                       </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            {/* Order Summary */}
            {orderItems.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2">
                  Subtotal (CNY): ¥{formatNumber(calculateSubtotal())}
                </Typography>
                <Typography variant="body2">
                  Subtotal (IDR): {formatPrice(calculateSubtotalIDR())}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Exchange Rate: 1 CNY = {formatPrice(orderForm.exchange_rate)}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Calculated Total (IDR): {formatPrice(calculateSubtotalIDR())}
                </Typography>
                {orderForm.total_payment_idr > 0 && (
                  <>
                    <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                      Total Payment (IDR): {formatPrice(orderForm.total_payment_idr)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: orderForm.total_payment_idr > calculateSubtotalIDR() ? '#d32f2f' : '#2e7d32' }}>
                      Gap/Additional Cost: {formatPrice(orderForm.total_payment_idr - calculateSubtotalIDR())}
                    </Typography>
                    {orderItems.length > 0 && (
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        Additional Cost per Item: Rp{((orderForm.total_payment_idr - calculateSubtotalIDR()) / orderItems.reduce((sum, item) => sum + item.quantity, 0)).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 4, 
          pt: 2,
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          borderTop: '1px solid #e2e8f0',
          gap: 2
        }}>
          <Button 
            onClick={() => setOpenOrderDialog(false)}
            variant="outlined"
            size="large"
            sx={{
              borderRadius: 2,
              borderColor: '#e2e8f0',
              color: '#64748b',
              px: 4,
              py: 1.5,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: '#cbd5e1',
                backgroundColor: '#f8fafc',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateOrder}
            variant="contained"
            disabled={!orderForm.supplier || !orderForm.order_date || orderItems.length === 0}
            size="large"
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
              px: 6,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.6)',
                transform: 'translateY(-2px)'
              },
              '&:disabled': {
                background: '#e2e8f0',
                boxShadow: 'none',
                transform: 'none'
              }
            }}
          >
            <ShoppingCart size={18} style={{ marginRight: '8px' }} />
            Create Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Purchase Order Details - {selectedOrder?.order_number} ({selectedOrder?.supplier})
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Order Number</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedOrder.order_number}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Order Date</Typography>
                  <Typography variant="body1">{new Date(selectedOrder.order_date).toLocaleDateString()}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Expected Delivery</Typography>
                  <Typography variant="body1">{new Date(selectedOrder.expected_delivery).toLocaleDateString()}</Typography>
                </Grid>
                {selectedOrder.actual_delivery && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Actual Delivery</Typography>
                    <Typography variant="body1" sx={{ color: 'success.main' }}>
                      {new Date(selectedOrder.actual_delivery).toLocaleDateString()}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip
                    label={selectedOrder.order_status.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: statusColors[selectedOrder.order_status] + '20',
                      color: statusColors[selectedOrder.order_status],
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Exchange Rate</Typography>
                  <Typography variant="body1">1 CNY = {formatPrice(selectedOrder.exchange_rate)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Logistics Fee</Typography>
                  <Typography variant="body1">{formatPrice(Math.round(selectedOrder.total_logistics_fee || 0))}</Typography>
                </Grid>

              </Grid>

              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Order Items
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product Variant</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Cost (CNY)</TableCell>
                      <TableCell align="right">Final Unit Cost (IDR)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getOrderBatches(selectedOrder.id).map((batch) => {
                      // Use gap_per_unit from database instead of manual calculation
                      const paymentGapPerUnit = batch.gap_per_unit || 0;
                      
                      // Calculate total quantity for tooltip display
                      const allBatches = getOrderBatches(selectedOrder.id);
                      const totalQuantity = allBatches.reduce((sum, b) => sum + b.quantity, 0);
                      const totalGapAmount = totalQuantity * paymentGapPerUnit;
                      
                      // Calculate new final unit cost: (unit_cost * exchange_rate) + gap_per_unit + logistics_fee_per_unit
                      const finalUnitCost = (batch.cny_price * selectedOrder.exchange_rate) + paymentGapPerUnit + batch.logistics_fee_per_unit;
                      
                      return (
                        <TableRow key={batch.id}>
                          <TableCell>{getVariantName(batch.variant_id)}</TableCell>
                          <TableCell align="right">{formatQuantity(batch.quantity)}</TableCell>
                          <TableCell align="right">¥{formatNumber(batch.cny_price)}</TableCell>
                          <TableCell align="right">
                            <CostBreakdownTooltip
                              data={{
                                cnyPrice: batch.cny_price,
                                exchangeRate: selectedOrder.exchange_rate,
                                gapPerUnit: paymentGapPerUnit,
                                logisticsFeePerUnit: batch.logistics_fee_per_unit,
                                totalLogisticsFee: selectedOrder.total_logistics_fee,
                                totalQuantity: totalQuantity
                              }}
                              placement="left"
                            >
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 'bold', 
                                  cursor: 'help',
                                  textDecoration: 'underline',
                                  textDecorationStyle: 'dotted',
                                  '&:hover': {
                                    color: 'primary.main'
                                  }
                                }}
                              >
                                {formatPrice(Math.round(finalUnitCost))}
                              </Typography>
                            </CostBreakdownTooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Total Amount: {formatPrice(Math.round(selectedOrder.total_payment_idr))}
                </Typography>
                {selectedOrder.total_logistics_fee != null && selectedOrder.total_logistics_fee > 0 && (
                  <Typography variant="body1" sx={{ mt: 1, color: 'text.secondary' }}>
                    Total Logistics Fee: {formatPrice(Math.round(selectedOrder.total_logistics_fee))}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Complete Order Dialog */}
      <Dialog open={openCompleteDialog} onClose={() => setOpenCompleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Purchase Order</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Please enter the completion details for this order:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Actual Delivery Date"
                type="date"
                value={completionData.actualDelivery}
                onChange={(e) => setCompletionData(prev => ({ ...prev, actualDelivery: e.target.value }))}
                InputLabelProps={{
                  shrink: true,
                }}
                required
              />
              <TextField
                fullWidth
                label="Total Logistics Fee (IDR)"
                type="number"
                value={completionData.logisticsFee}
                onChange={(e) => setCompletionData(prev => ({ ...prev, logisticsFee: e.target.value }))}
                placeholder="Enter actual logistics fee in IDR"
                helperText="Enter the actual logistics fee paid for this shipment"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCompleteDialog(false)}>Cancel</Button>
          <Button onClick={handleCompleteOrder} variant="contained" color="primary">
            Complete Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrders;