import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
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
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  TextField
} from '@mui/material';
import {
  TrendingUp as RevenueIcon,
  TrendingDown as ExpenseIcon,
  AccountBalance as ProfitIcon,
  Inventory as InventoryIcon,
  Assessment as ReportIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { supabase } from '../lib/supabase';

interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  total_profit: number;
  total_cogs: number;
  gross_profit: number;
  net_profit: number;
}

interface ProfitAnalysis {
  product_name: string;
  variant_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  profit_margin: number;
}

interface InventoryAlert {
  product_name: string;
  variant: string;
  size: string;
  sku: string;
  total_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  available_stock: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ExpenseByCategory {
  category_name: string;
  total_amount: number;
  percentage: number;
}

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [profitAnalysis, setProfitAnalysis] = useState<ProfitAnalysis[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);

  useEffect(() => {
    // Set default date range
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchFinancialSummary(),
        fetchProfitAnalysis(),
        fetchInventoryAlerts(),
        fetchMonthlyTrends(),
        fetchExpensesByCategory()
      ]);
    } catch (err) {
      setError('Failed to fetch report data');
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_summary')
        .select('*')
        .single();

      if (error) throw error;
      setFinancialSummary(data || {
        total_revenue: 0,
        total_expenses: 0,
        total_profit: 0,
        total_cogs: 0,
        gross_profit: 0,
        net_profit: 0
      });
    } catch (err) {
      console.error('Error fetching financial summary:', err);
      setFinancialSummary({
        total_revenue: 0,
        total_expenses: 0,
        total_profit: 0,
        total_cogs: 0,
        gross_profit: 0,
        net_profit: 0
      });
    }
  };

  const fetchProfitAnalysis = async () => {
    try {
      // Query invoice items with product and variant details
      const { data, error } = await supabase
        .from('invoice_items')
        .select(`
          quantity,
          proportional_revenue,
          cogs_used,
          profit,
          invoices!inner(sale_date),
          product_variants!inner(
            variant,
            size,
            products!inner(name)
          )
        `)
        .gte('invoices.sale_date', startDate)
        .lte('invoices.sale_date', endDate);

      if (error) throw error;

      // Aggregate data by product variant
      const aggregatedData: { [key: string]: ProfitAnalysis } = {};

      data?.forEach((item: any) => {
         const productName = item.product_variants.products.name;
         const variantName = `${item.product_variants.variant} - ${item.product_variants.size}`;
         const key = `${productName}_${variantName}`;

        if (!aggregatedData[key]) {
          aggregatedData[key] = {
            product_name: productName,
            variant_name: variantName,
            total_quantity_sold: 0,
            total_revenue: 0,
            total_cogs: 0,
            gross_profit: 0,
            profit_margin: 0
          };
        }

        aggregatedData[key].total_quantity_sold += item.quantity;
        aggregatedData[key].total_revenue += item.proportional_revenue;
        aggregatedData[key].total_cogs += item.cogs_used;
        aggregatedData[key].gross_profit += item.profit;
      });

      // Calculate profit margins and convert to array
      const profitAnalysisArray = Object.values(aggregatedData).map(item => ({
        ...item,
        profit_margin: item.total_revenue > 0 ? (item.gross_profit / item.total_revenue) * 100 : 0
      })).sort((a, b) => b.gross_profit - a.gross_profit);

      setProfitAnalysis(profitAnalysisArray);
    } catch (err) {
      console.error('Error fetching profit analysis:', err);
      setProfitAnalysis([]);
    }
  };

  const fetchInventoryAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_with_alerts')
        .select('*')
        .eq('is_low_stock', true)
        .order('total_quantity', { ascending: true });

      if (error) throw error;
      setInventoryAlerts(data || []);
    } catch (err) {
      console.error('Error fetching inventory alerts:', err);
      setInventoryAlerts([]);
    }
  };

  const fetchMonthlyTrends = async () => {
    try {
      // Fetch invoice data grouped by month
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('sale_date, total_revenue, total_profit')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

      if (invoiceError) throw invoiceError;

      // Fetch expenses data grouped by month
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('expense_date, amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (expensesError) throw expensesError;

      // Group data by month
      const monthlyData: { [key: string]: MonthlyTrend } = {};

      invoiceData?.forEach(invoice => {
        const month = new Date(invoice.sale_date).toISOString().slice(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { month, revenue: 0, expenses: 0, profit: 0 };
        }
        monthlyData[month].revenue += invoice.total_revenue;
        monthlyData[month].profit += invoice.total_profit;
      });

      expensesData?.forEach(expense => {
        const month = new Date(expense.expense_date).toISOString().slice(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { month, revenue: 0, expenses: 0, profit: 0 };
        }
        monthlyData[month].expenses += expense.amount;
      });

      const trends = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
      setMonthlyTrends(trends);
    } catch (err) {
      console.error('Error fetching monthly trends:', err);
      setMonthlyTrends([]);
    }
  };

  const fetchExpensesByCategory = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          amount,
          expense_categories!inner(name)
        `)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (error) throw error;

      // Group by category
      const categoryTotals: { [key: string]: number } = {};
      let totalExpenses = 0;

      data?.forEach((expense: any) => {
        const categoryName = expense.expense_categories?.name || 'Uncategorized';
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
        totalExpenses += expense.amount;
      });

      const categoryData = Object.entries(categoryTotals).map(([category_name, total_amount]) => ({
        category_name,
        total_amount,
        percentage: totalExpenses > 0 ? (total_amount / totalExpenses) * 100 : 0
      })).sort((a, b) => b.total_amount - a.total_amount);

      setExpensesByCategory(categoryData);
    } catch (err) {
      console.error('Error fetching expenses by category:', err);
      setExpensesByCategory([]);
    }
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    let startDate: Date;

    switch (range) {
      case '7':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90':
        startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '365':
        startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    setStartDate(startDate.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: 'error' | 'warning' | 'success' } = {
      'out_of_stock': 'error',
      'low_stock': 'warning',
      'ok': 'success'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'out_of_stock': 'Out of Stock',
      'low_stock': 'Low Stock',
      'ok': 'OK'
    };
    return labels[status] || status;
  };

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

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Financial Reports
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              label="Date Range"
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {/* TODO: Implement export */}}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Financial Summary Cards */}
      {financialSummary && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Revenue
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      ${financialSummary?.total_revenue?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <RevenueIcon color="success" sx={{ fontSize: 40 }} />
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
                      Total Expenses
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      ${financialSummary?.total_expenses?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <ExpenseIcon color="error" sx={{ fontSize: 40 }} />
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
                      Gross Profit
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      ${financialSummary?.gross_profit?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <ProfitIcon color="primary" sx={{ fontSize: 40 }} />
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
                      Net Profit
                    </Typography>
                    <Typography 
                      variant="h5" 
                      color={(financialSummary?.net_profit || 0) >= 0 ? "success.main" : "error.main"}
                    >
                      ${financialSummary?.net_profit?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  <ReportIcon color={(financialSummary?.net_profit || 0) >= 0 ? "success" : "error"} sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Profit Analysis" />
          <Tab label="Monthly Trends" />
          <Tab label="Expense Breakdown" />
          <Tab label="Inventory Alerts" />
        </Tabs>
      </Box>

      {/* Profit Analysis Tab */}
      {tabValue === 0 && (
        <Paper>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Product Profitability Analysis
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Variant</TableCell>
                  <TableCell align="right">Qty Sold</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">COGS</TableCell>
                  <TableCell align="right">Gross Profit</TableCell>
                  <TableCell align="right">Margin %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profitAnalysis.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.product_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.variant_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {item.total_quantity_sold}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main">
                        ${item.total_revenue.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        ${item.total_cogs.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        fontWeight="medium"
                        color={item.gross_profit >= 0 ? "success.main" : "error.main"}
                      >
                        ${item.gross_profit.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${item.profit_margin.toFixed(1)}%`}
                        color={item.profit_margin >= 20 ? 'success' : item.profit_margin >= 10 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Monthly Trends Tab */}
      {tabValue === 1 && (
        <Paper>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Monthly Financial Trends
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                  <TableCell align="right">Net Profit</TableCell>
                  <TableCell align="right">Profit Margin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyTrends.map((trend) => {
                  const netProfit = trend.revenue - trend.expenses;
                  const profitMargin = trend.revenue > 0 ? (netProfit / trend.revenue) * 100 : 0;
                  
                  return (
                    <TableRow key={trend.month}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {new Date(trend.month + '-01').toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long' 
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          ${trend.revenue.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          ${trend.expenses.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          fontWeight="medium"
                          color={netProfit >= 0 ? "success.main" : "error.main"}
                        >
                          ${netProfit.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${profitMargin.toFixed(1)}%`}
                          color={profitMargin >= 20 ? 'success' : profitMargin >= 10 ? 'warning' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Expense Breakdown Tab */}
      {tabValue === 2 && (
        <Paper>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Expenses by Category
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Percentage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expensesByCategory.map((category) => (
                  <TableRow key={category.category_name}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {category.category_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        ${category.total_amount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${category.percentage.toFixed(1)}%`}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Inventory Alerts Tab */}
      {tabValue === 3 && (
        <Paper>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Inventory Alerts
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Variant</TableCell>
                  <TableCell align="right">Current Stock</TableCell>
                  <TableCell align="right">Threshold</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryAlerts.map((alert, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {alert.product_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.variant} - {alert.size}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {alert.total_quantity}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {alert.low_stock_threshold}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label="Low Stock"
                        color="warning"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default Reports;