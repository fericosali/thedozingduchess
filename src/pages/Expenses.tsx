import {
  Add as AddIcon,
  AccountBalance as BalanceIcon,
  Category as CategoryIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TrendingDown as ExpenseIcon,
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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import {
  logBalanceAdjustmentTransaction,
  logExpenseTransaction,
  updateExpenseTransaction,
} from "../lib/financialJournal";
import { supabase } from "../lib/supabase";
import { formatNumber, formatPrice } from "../lib/utils";

interface Expense {
  id: string;
  category_id: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
  category_name: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface BalanceAdjustment {
  id: string;
  amount: number;
  adjustment_type: string;
  reason: string;
  description?: string;
  adjustment_date: string;
  created_at: string;
}

interface NewExpense {
  category_id: string;
  amount: number;
  description: string;
  expense_date: string;
}

interface NewBalanceAdjustment {
  amount: number;
  adjustment_type: string;
  reason: string;
  description: string;
  adjustment_date: string;
}

const Expenses: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [balanceAdjustments, setBalanceAdjustments] = useState<
    BalanceAdjustment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<NewExpense>({
    category_id: "",
    amount: 0,
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBalanceAdjustment, setNewBalanceAdjustment] =
    useState<NewBalanceAdjustment>({
      amount: 0,
      adjustment_type: "capital_injection",
      reason: "",
      description: "",
      adjustment_date: new Date().toISOString().split("T")[0],
    });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Date filters removed: show all records

  useEffect(() => {
    // Load all-time data once on mount
    fetchExpenses();
    fetchCategories();
    fetchBalanceAdjustments();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          `
          *,
          expense_categories!inner(name)
        `,
        )
        .order("expense_date", { ascending: false });

      if (error) throw error;

      const formattedExpenses =
        data?.map((expense) => ({
          ...expense,
          category_name: expense.expense_categories.name,
        })) || [];

      setExpenses(formattedExpenses);
    } catch (err) {
      setError("Failed to fetch expenses");
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchBalanceAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from("balance_adjustments")
        .select("*")
        .order("adjustment_date", { ascending: false });

      if (error) throw error;
      setBalanceAdjustments(data || []);
    } catch (err) {
      console.error("Error fetching balance adjustments:", err);
    }
  };

  const handleCreateExpense = async () => {
    if (
      !newExpense.category_id ||
      newExpense.amount <= 0 ||
      !newExpense.description
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      if (editingId) {
        // Update existing expense
        const { error } = await supabase
          .from("expenses")
          .update({
            category_id: newExpense.category_id,
            amount: newExpense.amount,
            description: newExpense.description,
            expense_date: newExpense.expense_date,
          })
          .eq("id", editingId);

        if (error) throw error;

        // Update financial journal
        try {
          const category = categories.find(
            (cat) => cat.id === newExpense.category_id,
          );
          const categoryName = category?.name || "Unknown Category";

          await updateExpenseTransaction(
            editingId,
            `${categoryName}: ${newExpense.description}`,
            newExpense.amount,
            categoryName.toLowerCase().replace(/\s+/g, "_"),
            "IDR",
          );
        } catch (logError) {
          console.warn("Failed to update expense transaction log:", logError);
        }

        setSuccess("Expense updated successfully");
      } else {
        // Create new expense
        const { data: insertedExpense, error } = await supabase
          .from("expenses")
          .insert([newExpense])
          .select()
          .single();

        if (error) throw error;

        // Log the expense transaction to financial journal
        try {
          // Get category name for better description
          const category = categories.find(
            (cat) => cat.id === newExpense.category_id,
          );
          const categoryName = category?.name || "Unknown Category";

          await logExpenseTransaction(
            insertedExpense.id,
            `${categoryName}: ${newExpense.description}`,
            newExpense.amount,
            categoryName.toLowerCase().replace(/\s+/g, "_"),
            "IDR",
          );
        } catch (logError) {
          console.warn("Failed to log expense transaction:", logError);
          // Don't throw error for logging failure, just warn
        }

        setSuccess("Expense recorded successfully");
      }

      handleCloseExpenseDialog();
      fetchExpenses();
    } catch (err) {
      setError(
        editingId ? "Failed to update expense" : "Failed to record expense",
      );
      console.error("Error recording expense:", err);
    }
  };

  const handleEditClick = (expense: Expense) => {
    setNewExpense({
      category_id: expense.category_id,
      amount: expense.amount,
      description: expense.description,
      expense_date: expense.expense_date,
    });
    setEditingId(expense.id);
    setExpenseDialogOpen(true);
  };

  const handleCloseExpenseDialog = () => {
    setExpenseDialogOpen(false);
    setEditingId(null);
    setNewExpense({
      category_id: "",
      amount: 0,
      description: "",
      expense_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleCreateBalanceAdjustment = async () => {
    if (newBalanceAdjustment.amount === 0 || !newBalanceAdjustment.reason) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const { data: insertedAdj, error } = await supabase
        .from("balance_adjustments")
        .insert([newBalanceAdjustment])
        .select()
        .single();

      if (error) throw error;

      setSuccess("Balance adjustment recorded successfully");
      setBalanceDialogOpen(false);
      setNewBalanceAdjustment({
        amount: 0,
        adjustment_type: "capital_injection",
        reason: "",
        description: "",
        adjustment_date: new Date().toISOString().split("T")[0],
      });
      // Log into financial journal
      try {
        await logBalanceAdjustmentTransaction(
          insertedAdj.id,
          insertedAdj.amount,
          insertedAdj.adjustment_type,
          insertedAdj.reason,
          "IDR",
        );
      } catch (logError) {
        console.warn("Failed to log balance adjustment:", logError);
      }
      fetchBalanceAdjustments();
    } catch (err) {
      setError("Failed to record balance adjustment");
      console.error("Error recording balance adjustment:", err);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName) {
      setError("Category name is required");
      return;
    }

    try {
      const { error } = await supabase.from("expense_categories").insert([
        {
          name: newCategoryName,
          description: newCategoryDescription || null,
        },
      ]);

      if (error) throw error;

      setSuccess("Category created successfully");
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      fetchCategories();
    } catch (err) {
      setError("Failed to create category");
      console.error("Error creating category:", err);
    }
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors: { [key: string]: "success" | "error" | "warning" | "info" } =
      {
        capital_injection: "success",
        refund: "success",
        correction: "warning",
        other: "info",
      };
    return colors[type] || "default";
  };

  const getAdjustmentTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      capital_injection: "Capital Injection",
      refund: "Refund",
      correction: "Correction",
      other: "Other",
    };
    return labels[type] || type;
  };

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const totalAdjustments = balanceAdjustments.reduce(
    (sum, adj) => sum + adj.amount,
    0,
  );
  const expensesByCategory = categories.map((category) => ({
    ...category,
    total: expenses
      .filter((e) => e.category_id === category.id)
      .reduce((sum, e) => sum + e.amount, 0),
  }));

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
          Expense Management
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={() => setCategoryDialogOpen(true)}
          >
            Add Category
          </Button>
          <Button
            variant="outlined"
            startIcon={<BalanceIcon />}
            onClick={() => setBalanceDialogOpen(true)}
          >
            Balance Adjustment
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setExpenseDialogOpen(true)}
          >
            Add Expense
          </Button>
        </Box>
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
                    Total Expenses
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {formatPrice(totalExpenses)}
                  </Typography>
                </Box>
                <ExpenseIcon color="error" sx={{ fontSize: 40 }} />
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
                    Balance Adjustments
                  </Typography>
                  <Typography
                    variant="h5"
                    color={
                      totalAdjustments >= 0 ? "success.main" : "error.main"
                    }
                  >
                    {formatPrice(totalAdjustments)}
                  </Typography>
                </Box>
                <BalanceIcon
                  color={totalAdjustments >= 0 ? "success" : "error"}
                  sx={{ fontSize: 40 }}
                />
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
                    Categories
                  </Typography>
                  <Typography variant="h5">
                    {formatNumber(categories.length)}
                  </Typography>
                </Box>
                <CategoryIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
        >
          <Tab label="Expenses" />
          <Tab label="Balance Adjustments" />
          <Tab label="Categories" />
        </Tabs>
      </Box>

      {/* Expenses Tab */}
      {tabValue === 0 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip label={expense.category_name} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {expense.description}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color="error.main"
                      >
                        {formatPrice(expense.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(expense)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Balance Adjustments Tab */}
      {tabValue === 1 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {balanceAdjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>
                      {new Date(
                        adjustment.adjustment_date,
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getAdjustmentTypeLabel(
                          adjustment.adjustment_type,
                        )}
                        color={getAdjustmentTypeColor(
                          adjustment.adjustment_type,
                        )}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {adjustment.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {adjustment.description || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={
                          adjustment.amount >= 0 ? "success.main" : "error.main"
                        }
                      >
                        {formatPrice(adjustment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Categories Tab */}
      {tabValue === 2 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Total Expenses</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expensesByCategory.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {category.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {category.description || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatPrice(category.total)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={category.is_active ? "Active" : "Inactive"}
                        color={category.is_active ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialogs */}
      {/* Add Expense Dialog */}
      <Dialog
        open={expenseDialogOpen}
        onClose={handleCloseExpenseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingId ? "Edit Expense" : "Add New Expense"}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newExpense.category_id}
                onChange={(e) =>
                  setNewExpense((prev) => ({
                    ...prev,
                    category_id: e.target.value,
                  }))
                }
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Amount"
              type="number"
              value={newExpense.amount}
              onChange={(e) =>
                setNewExpense((prev) => ({
                  ...prev,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label="Description"
              value={newExpense.description}
              onChange={(e) =>
                setNewExpense((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Expense Date"
              type="date"
              value={newExpense.expense_date}
              onChange={(e) =>
                setNewExpense((prev) => ({
                  ...prev,
                  expense_date: e.target.value,
                }))
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExpenseDialog}>Cancel</Button>
          <Button onClick={handleCreateExpense} variant="contained">
            {editingId ? "Save Changes" : "Add Expense"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Balance Adjustment Dialog */}
      <Dialog
        open={balanceDialogOpen}
        onClose={() => setBalanceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Balance Adjustment</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Adjustment Type</InputLabel>
              <Select
                value={newBalanceAdjustment.adjustment_type}
                onChange={(e) =>
                  setNewBalanceAdjustment((prev) => ({
                    ...prev,
                    adjustment_type: e.target.value,
                  }))
                }
                label="Adjustment Type"
              >
                <MenuItem value="capital_injection">Capital Injection</MenuItem>
                <MenuItem value="refund">Refund</MenuItem>
                <MenuItem value="correction">Correction</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Amount"
              type="number"
              value={newBalanceAdjustment.amount}
              onChange={(e) =>
                setNewBalanceAdjustment((prev) => ({
                  ...prev,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
              fullWidth
              inputProps={{ step: 0.01 }}
              helperText="Use positive for income, negative for expenses"
            />
            <TextField
              label="Reason"
              value={newBalanceAdjustment.reason}
              onChange={(e) =>
                setNewBalanceAdjustment((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={newBalanceAdjustment.description}
              onChange={(e) =>
                setNewBalanceAdjustment((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Adjustment Date"
              type="date"
              value={newBalanceAdjustment.adjustment_date}
              onChange={(e) =>
                setNewBalanceAdjustment((prev) => ({
                  ...prev,
                  adjustment_date: e.target.value,
                }))
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBalanceDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateBalanceAdjustment} variant="contained">
            Add Adjustment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Category Name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCategory} variant="contained">
            Add Category
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Expenses;
