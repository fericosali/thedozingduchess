import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  LinearProgress,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatNumber, formatQuantity } from '../lib/utils';

interface DashboardStats {
  totalRevenue: number;
  totalProducts: number;
  activePurchaseOrders: number;
  lowStockCount: number;
}

interface RecentSale {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  total_revenue: number;
  sale_date: string;
}

interface LowStockItem {
  id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  threshold: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard statistics
      const [
        revenueResult,
        productsResult,
        purchaseOrdersResult,
        lowStockResult,
        salesResult,
        inventoryResult
      ] = await Promise.all([
        // Total revenue from sales
        supabase
          .from('sales')
          .select('total_revenue'),
        
        // Total products count
        supabase
          .from('products')
          .select('id', { count: 'exact' }),
        
        // Active purchase orders
        supabase
          .from('purchase_orders')
          .select('id', { count: 'exact' })
          .eq('order_status', 'pending'),
        
        // Low stock items count
        supabase
          .from('inventory')
          .select('id', { count: 'exact' })
          .lt('total_quantity', 'low_stock_threshold'),
        
        // Recent sales with product details
        supabase
          .from('sales')
          .select(`
            id,
            quantity,
            total_revenue,
            sale_date,
            product_variants!inner(
              sku,
              products!inner(
                name
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5),
        
        // Low stock items with product details
        supabase
          .from('inventory')
          .select(`
            id,
            total_quantity,
            low_stock_threshold,
            product_variants!inner(
              sku,
              products!inner(
                name
              )
            )
          `)
          .lt('total_quantity', 'low_stock_threshold')
          .order('total_quantity', { ascending: true })
          .limit(5)
      ]);

      // Check for errors
      if (revenueResult.error) throw revenueResult.error;
      if (productsResult.error) throw productsResult.error;
      if (purchaseOrdersResult.error) throw purchaseOrdersResult.error;
      if (lowStockResult.error) throw lowStockResult.error;
      if (salesResult.error) throw salesResult.error;
      if (inventoryResult.error) throw inventoryResult.error;

      // Calculate total revenue
      const totalRevenue = revenueResult.data?.reduce((sum, sale) => sum + (sale.total_revenue || 0), 0) || 0;

      // Set dashboard stats
      setStats({
        totalRevenue,
        totalProducts: productsResult.count || 0,
        activePurchaseOrders: purchaseOrdersResult.count || 0,
        lowStockCount: lowStockResult.count || 0,
      });

      // Format recent sales data
      const formattedSales: RecentSale[] = salesResult.data?.map((sale: any) => ({
        id: sale.id,
        product_name: sale.product_variants?.products?.name || 'Unknown Product',
        sku: sale.product_variants?.sku || 'N/A',
        quantity: sale.quantity,
        total_revenue: sale.total_revenue,
        sale_date: sale.sale_date,
      })) || [];

      setRecentSales(formattedSales);

      // Format low stock items data
      const formattedLowStock: LowStockItem[] = inventoryResult.data?.map((item: any) => ({
        id: item.id,
        product_name: item.product_variants?.products?.name || 'Unknown Product',
        sku: item.product_variants?.sku || 'N/A',
        current_stock: item.total_quantity,
        threshold: item.low_stock_threshold,
      })) || [];

      setLowStockItems(formattedLowStock);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
          Dashboard Overview
        </Typography>
      </Box>
    );
  }

  const statsCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue, 'CNY'),
      change: '+0%', // You can calculate this based on previous period data
      icon: DollarSign,
      color: '#4caf50',
      bgColor: 'rgba(76, 175, 80, 0.1)',
    },
    {
      title: 'Total Products',
      value: formatNumber(stats?.totalProducts),
      change: '+0',
      icon: Package,
      color: '#2196f3',
      bgColor: 'rgba(33, 150, 243, 0.1)',
    },
    {
      title: 'Active Orders',
      value: formatNumber(stats?.activePurchaseOrders),
      change: '+0',
      icon: ShoppingCart,
      color: '#ff9800',
      bgColor: 'rgba(255, 152, 0, 0.1)',
    },
    {
      title: 'Low Stock Items',
      value: formatNumber(stats?.lowStockCount),
      change: '0',
      icon: AlertTriangle,
      color: '#f44336',
      bgColor: 'rgba(244, 67, 54, 0.1)',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Dashboard Overview
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: stat.bgColor,
                        color: stat.color,
                        mr: 2,
                      }}
                    >
                      <IconComponent size={24} />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.title}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={stat.change}
                    size="small"
                    sx={{
                      bgcolor: stat.change.startsWith('+') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                      color: stat.change.startsWith('+') ? '#4caf50' : '#f44336',
                      fontWeight: 'bold',
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Sales */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TrendingUp size={24} style={{ marginRight: 8, color: '#e91e63' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Recent Sales
                </Typography>
              </Box>
              <Box>
                {recentSales.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No recent sales found. Start by adding some sales data.
                  </Typography>
                ) : (
                  recentSales.map((sale) => (
                    <Box
                      key={sale.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 2,
                        borderBottom: '1px solid #f0f0f0',
                        '&:last-child': {
                          borderBottom: 'none',
                        },
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                          {sale.product_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          SKU: {sale.sku} • Qty: {formatQuantity(sale.quantity)}
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {formatCurrency(sale.total_revenue, 'CNY')}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Low Stock Alerts */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AlertTriangle size={24} style={{ marginRight: 8, color: '#f44336' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Low Stock Alerts
                </Typography>
              </Box>
              <Box>
                {lowStockItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No low stock items. All inventory levels are healthy!
                  </Typography>
                ) : (
                  lowStockItems.map((item) => (
                    <Box key={item.id} sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                          {item.sku}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatQuantity(item.current_stock)}/{formatQuantity(item.threshold)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((item.current_stock / item.threshold) * 100, 100)}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(244, 67, 54, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: item.current_stock <= 2 ? '#f44336' : '#ff9800',
                            borderRadius: 3,
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {item.product_name}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;