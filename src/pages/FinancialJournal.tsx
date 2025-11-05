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
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress
} from '@mui/material';
import { AccountBalance, TrendingUp, TrendingDown, Receipt } from '@mui/icons-material';
import { getJournalEntries, getFinancialSummary } from '../lib/financialJournal';
import { formatPrice, formatNumber } from '../lib/utils';

interface JournalEntry {
  id: string;
  transaction_date: string;
  transaction_type: string;
  description: string;
  reference_id?: string;
  reference_table?: string;
  debit_amount: number;
  credit_amount: number;
  account_type: string;
  account_subtype?: string;
  currency: string;
}

interface FinancialSummary {
  account_type: string;
  account_subtype?: string;
  total_debit: number;
  total_credit: number;
  net_amount: number;
}

const FinancialJournal: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [summary, setSummary] = useState<FinancialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    transaction_type: '',
    account_type: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [entriesData, summaryData] = await Promise.all([
        getJournalEntries({ limit: 100 }),
        getFinancialSummary()
      ]);
      setEntries(entriesData || []);
      setSummary(summaryData || []);
    } catch (err) {
      setError('Failed to fetch financial data');
      console.error('Error fetching financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async () => {
    try {
      setLoading(true);
      const filteredEntries = await getJournalEntries({
        transaction_type: filters.transaction_type || undefined,
        account_type: filters.account_type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        limit: 100
      });
      setEntries(filteredEntries || []);
    } catch (err) {
      setError('Failed to filter entries');
      console.error('Error filtering entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'primary';
      case 'sale': return 'success';
      case 'expense': return 'error';
      case 'logistics': return 'warning';
      default: return 'default';
    }
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'revenue': return <TrendingUp color="success" />;
      case 'expense': return <TrendingDown color="error" />;
      case 'inventory': return <Receipt color="primary" />;
      default: return <AccountBalance />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Financial Journal
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Complete audit trail of all financial transactions
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Financial Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {summary.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  {getAccountTypeIcon(item.account_type)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {item.account_type.charAt(0).toUpperCase() + item.account_type.slice(1)}
                  </Typography>
                </Box>
                {item.account_subtype && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {item.account_subtype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                )}
                <Typography variant="h5" color={item.net_amount >= 0 ? 'success.main' : 'error.main'}>
                  {formatPrice(Math.abs(item.net_amount))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Debit: {formatPrice(item.total_debit)} | 
                  Credit: {formatPrice(item.total_credit)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={filters.transaction_type}
                label="Transaction Type"
                onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="purchase">Purchase</MenuItem>
                <MenuItem value="sale">Sale</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="logistics">Logistics</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Account Type</InputLabel>
              <Select
                value={filters.account_type}
                label="Account Type"
                onChange={(e) => setFilters({ ...filters, account_type: e.target.value })}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="inventory">Inventory</MenuItem>
                <MenuItem value="revenue">Revenue</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="logistics">Logistics</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From Date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To Date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button variant="contained" onClick={handleFilterChange} fullWidth>
              Apply Filters
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button 
              variant="outlined" 
              onClick={() => {
                setFilters({ transaction_type: '', account_type: '', date_from: '', date_to: '' });
                fetchData();
              }}
              fullWidth
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Journal Entries Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
                <TableCell>Reference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.transaction_date).toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={entry.transaction_type} 
                      color={getTransactionTypeColor(entry.transaction_type) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {entry.account_type.charAt(0).toUpperCase() + entry.account_type.slice(1)}
                      </Typography>
                      {entry.account_subtype && (
                        <Typography variant="caption" color="text.secondary">
                          {entry.account_subtype.replace(/_/g, ' ')}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {entry.debit_amount > 0 && (
                      <Typography color="error.main">
                        {formatPrice(entry.debit_amount)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {entry.credit_amount > 0 && (
                      <Typography color="success.main">
                        {formatPrice(entry.credit_amount)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.reference_table && entry.reference_id && (
                      <Typography variant="caption" color="text.secondary">
                        {entry.reference_table}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">
                      No journal entries found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default FinancialJournal;