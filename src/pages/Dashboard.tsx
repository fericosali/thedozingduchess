import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatNumber, formatQuantity } from "../lib/utils";

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
      const [revenueResult, productsResult, purchaseOrdersResult, salesResult] =
        await Promise.all([
          // Total revenue from sales
          supabase.from("sales").select("total_revenue"),

          // Total products count
          supabase.from("products").select("id", { count: "exact" }),

          // Active purchase orders
          supabase
            .from("purchase_orders")
            .select("id", { count: "exact" })
            .eq("order_status", "pending"),

          // Recent sales with product details
          supabase
            .from("sales")
            .select(
              `
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
          `
            )
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      // Check for errors
      if (revenueResult.error) throw revenueResult.error;
      if (productsResult.error) throw productsResult.error;
      if (purchaseOrdersResult.error) throw purchaseOrdersResult.error;
      if (salesResult.error) throw salesResult.error;

      // Calculate total revenue
      const totalRevenue =
        revenueResult.data?.reduce(
          (sum, sale) => sum + (sale.total_revenue || 0),
          0
        ) || 0;

      // Set dashboard stats
      setStats({
        totalRevenue,
        totalProducts: productsResult.count || 0,
        activePurchaseOrders: purchaseOrdersResult.count || 0,
        lowStockCount: 0,
      });

      // Format recent sales data
      const formattedSales: RecentSale[] =
        salesResult.data?.map((sale: any) => ({
          id: sale.id,
          product_name:
            sale.product_variants?.products?.name || "Unknown Product",
          sku: sale.product_variants?.sku || "N/A",
          quantity: sale.quantity,
          total_revenue: sale.total_revenue,
          sale_date: sale.sale_date,
        })) || [];

      setRecentSales(formattedSales);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
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
        <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
          Dashboard Overview
        </Typography>
      </Box>
    );
  }

  const statsCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue, "CNY"),
      change: "+0%", // You can calculate this based on previous period data
      icon: DollarSign,
      color: "#4caf50",
      bgColor: "rgba(76, 175, 80, 0.1)",
    },
    {
      title: "Total Products",
      value: formatNumber(stats?.totalProducts),
      change: "+0",
      icon: Package,
      color: "#2196f3",
      bgColor: "rgba(33, 150, 243, 0.1)",
    },
    {
      title: "Active Orders",
      value: formatNumber(stats?.activePurchaseOrders),
      change: "+0",
      icon: ShoppingCart,
      color: "#ff9800",
      bgColor: "rgba(255, 152, 0, 0.1)",
    },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
        Dashboard Overview
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  height: "100%",
                  transition: "transform 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
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
                      <Typography variant="h4" sx={{ fontWeight: "bold" }}>
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
                      bgcolor: stat.change.startsWith("+")
                        ? "rgba(76, 175, 80, 0.1)"
                        : "rgba(244, 67, 54, 0.1)",
                      color: stat.change.startsWith("+")
                        ? "#4caf50"
                        : "#f44336",
                      fontWeight: "bold",
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
        <Grid item xs={12} md={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <TrendingUp
                  size={24}
                  style={{ marginRight: 8, color: "#e91e63" }}
                />
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  Recent Sales
                </Typography>
              </Box>
              <Box>
                {recentSales.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    No recent sales found. Start by adding some sales data.
                  </Typography>
                ) : (
                  recentSales.map((sale) => (
                    <Box
                      key={sale.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        py: 2,
                        borderBottom: "1px solid #f0f0f0",
                        "&:last-child": {
                          borderBottom: "none",
                        },
                      }}
                    >
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: "medium" }}
                        >
                          {sale.product_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          SKU: {sale.sku} • Qty: {formatQuantity(sale.quantity)}
                        </Typography>
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: "bold", color: "#4caf50" }}
                      >
                        {formatCurrency(sale.total_revenue, "CNY")}
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
