import {
  AppBar,
  Avatar,
  Box,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  InputBase,
  Paper,
} from "@mui/material";
import {
  User as AccountCircle,
  LayoutDashboard as Dashboard,
  CreditCard as Expenses,
  Package2 as Inventory,
  LogOut as Logout,
  Menu as MenuIcon,
  Package,
  ShirtIcon as Pajama,
  Receipt,
  Settings,
  ShoppingCart,
  TrendingUp,
  Search,
} from "lucide-react";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    await signOut();
    handleProfileMenuClose();
  };

  const menuItems = [
    { text: "Dashboard", icon: Dashboard, path: "/", color: "#4caf50" },
    { text: "Products", icon: Package, path: "/products", color: "#2196f3" },
    {
      text: "Inventory",
      icon: Inventory,
      path: "/inventory",
      color: "#ff9800",
    },
    {
      text: "Purchase Orders",
      icon: ShoppingCart,
      path: "/purchase-orders",
      color: "#9c27b0",
    },
    { text: "Sales", icon: Receipt, path: "/sales", color: "#e91e63" },
    { text: "Expenses", icon: Expenses, path: "/expenses", color: "#f44336" },
    { text: "Reports", icon: TrendingUp, path: "/reports", color: "#00bcd4" },
    { text: "Settings", icon: Settings, path: "/settings", color: "#607d8b" },
  ];

  const getCurrentPageTitle = () => {
    const currentItem = menuItems.find(
      (item) => item.path === location.pathname
    );
    return currentItem?.text || "Dashboard";
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          background:
            "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          color: "white",
          p: 3,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="20" cy="20" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          },
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            mb: 2,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Pajama size={20} color="white" />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          The Dozing Duchess
        </Typography>
        <Typography
          variant="caption"
          sx={{
            opacity: 0.9,
            fontWeight: 500,
          }}
        >
          Inventory Management
        </Typography>
      </Box>

      <Box sx={{ flex: 1, p: 2 }}>
        <List sx={{ pt: 1 }}>
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = location.pathname === item.path;
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 3,
                    mx: 1,
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden",
                    "&.Mui-selected": {
                      background: `linear-gradient(135deg, ${item.color}15, ${item.color}25)`,
                      color: item.color,
                      boxShadow: `0 4px 12px ${item.color}30`,
                      "&:hover": {
                        background: `linear-gradient(135deg, ${item.color}20, ${item.color}30)`,
                      },
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: "4px",
                        background: item.color,
                        borderRadius: "0 4px 4px 0",
                      },
                    },
                    "&:hover": {
                      background: `${item.color}08`,
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isSelected ? item.color : "text.secondary",
                      minWidth: 40,
                      transition: "all 0.3s ease",
                    }}
                  >
                    <IconComponent size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      "& .MuiListItemText-primary": {
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: "0.95rem",
                      },
                    }}
                  />
                  {isSelected && (
                    <Chip
                      size="small"
                      sx={{
                        height: 20,
                        background: item.color,
                        color: "white",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        "& .MuiChip-label": {
                          px: 1,
                        },
                      }}
                      label="•"
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          background: "rgba(0, 0, 0, 0.02)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2,
            borderRadius: 2,
            background:
              "linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(156, 39, 176, 0.1))",
            border: "1px solid rgba(233, 30, 99, 0.2)",
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #e91e63, #9c27b0)",
              fontSize: "0.9rem",
              fontWeight: 600,
              mr: 2,
            }}
          >
            {user?.email?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: "#e91e63" }}
            >
              Admin
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.85))",
          backdropFilter: "blur(28px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          color: "text.primary",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.06)",
        }}
      >
        <Toolbar
          sx={{
            justifyContent: "space-between",
            minHeight: { xs: 64, sm: 70 },
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{
                mr: 2,
                display: { md: "none" },
                color: "text.primary",
              }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ ml: { xs: 0, md: 1 } }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontSize: { xs: "1.25rem", sm: "1.5rem" },
                  lineHeight: 1.2,
                  letterSpacing: 0.2,
                }}
              >
                {getCurrentPageTitle()}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  opacity: 0.85,
                  display: { xs: "none", sm: "block" },
                }}
              >
                Welcome back, manage your inventory
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {!isMobile && (
              <Paper
                component="form"
                onSubmit={(e: React.FormEvent) => e.preventDefault()}
                sx={{
                  p: "2px 8px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  bgcolor: "rgba(255,255,255,0.6)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  backdropFilter: "blur(12px)",
                  minWidth: 220,
                }}
              >
                <IconButton sx={{ mr: 0.5 }} size="small">
                  <Search size={18} />
                </IconButton>
                <InputBase
                  sx={{ ml: 1, flex: 1, fontSize: "0.9rem" }}
                  placeholder="Search…"
                  inputProps={{ "aria-label": "search" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Paper>
            )}

            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="profile-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              sx={{
                "&:hover": {
                  background: "rgba(233, 30, 99, 0.1)",
                },
                transition: "all 0.2s ease",
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  boxShadow: "0 4px 16px rgba(233, 30, 99, 0.25)",
                  border: "2px solid rgba(255, 255, 255, 0.9)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: "0 6px 20px rgba(233, 30, 99, 0.35)",
                  },
                }}
              >
                {user?.email?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 2,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            minWidth: 200,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Signed in as
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <MenuItem
          onClick={handleProfileMenuClose}
          sx={{
            py: 1.5,
            "&:hover": {
              background: "rgba(233, 30, 99, 0.05)",
            },
          }}
        >
          <ListItemIcon>
            <AccountCircle size={20} />
          </ListItemIcon>
          <ListItemText primary="Profile Settings" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleSignOut}
          sx={{
            py: 1.5,
            color: "#f44336",
            "&:hover": {
              background: "rgba(244, 67, 54, 0.05)",
            },
          }}
        >
          <ListItemIcon sx={{ color: "#f44336" }}>
            <Logout size={20} />
          </ListItemIcon>
          <ListItemText primary="Sign Out" />
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              border: "none",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              border: "none",
              borderRight: "1px solid rgba(0, 0, 0, 0.08)",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: "#fafafa",
          background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
