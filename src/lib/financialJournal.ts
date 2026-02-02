import { supabase } from './supabase';

export interface JournalEntry {
  transaction_type: 'purchase' | 'sale' | 'expense' | 'adjustment' | 'logistics';
  description: string;
  reference_id?: string;
  reference_table?: string;
  debit_amount?: number;
  credit_amount?: number;
  account_type: 'inventory' | 'expense' | 'revenue' | 'cash' | 'logistics';
  account_subtype?: string;
  currency?: string;
}

/**
 * Creates a journal entry using the database function
 */
export async function createJournalEntry(entry: JournalEntry) {
  const { data, error } = await supabase.rpc('create_journal_entry', {
    p_transaction_type: entry.transaction_type,
    p_description: entry.description,
    p_reference_id: entry.reference_id || null,
    p_reference_table: entry.reference_table || null,
    p_debit_amount: entry.debit_amount || 0,
    p_credit_amount: entry.credit_amount || 0,
    p_account_type: entry.account_type,
    p_account_subtype: entry.account_subtype || null,
    p_currency: entry.currency || 'IDR'
  });

  if (error) {
    console.error('Failed to create journal entry:', error);
    throw error;
  }

  return data;
}

/**
 * Log a purchase transaction (Debit: Inventory, Credit: Cash)
 */
export async function logPurchaseTransaction(
  orderId: string,
  supplierName: string,
  amount: number,
  currency: string = 'IDR'
) {
  return await createJournalEntry({
    transaction_type: 'purchase',
    description: `Purchase from ${supplierName}`,
    reference_id: orderId,
    reference_table: 'purchase_orders',
    debit_amount: amount, // Increase inventory
    account_type: 'inventory',
    account_subtype: 'product_purchase',
    currency
  });
}

/**
 * Log a logistics fee expense (Debit: Expense, Credit: Cash)
 */
export async function logLogisticsFee(
  orderId: string,
  supplierName: string,
  amount: number,
  currency: string = 'IDR'
) {
  return await createJournalEntry({
    transaction_type: 'logistics',
    description: `Logistics fee for order from ${supplierName}`,
    reference_id: orderId,
    reference_table: 'purchase_orders',
    debit_amount: amount, // Increase expense
    account_type: 'logistics',
    account_subtype: 'logistics_fee',
    currency
  });
}

/**
 * Log a sale transaction (Debit: Cash, Credit: Revenue)
 */
export async function logSaleTransaction(
  referenceId: string,
  customerName: string,
  amount: number,
  currency: string = 'IDR',
  referenceTable: 'sales' | 'invoices' = 'sales'
) {
  return await createJournalEntry({
    transaction_type: 'sale',
    description: `Sale to ${customerName}`,
    reference_id: referenceId,
    reference_table: referenceTable,
    credit_amount: amount, // Increase revenue
    account_type: 'revenue',
    account_subtype: 'product_sale',
    currency
  });
}

/**
 * Log cost of goods sold (Debit: Expense, Credit: Inventory)
 */
export async function logCostOfGoodsSold(
  referenceId: string,
  amount: number,
  currency: string = 'IDR',
  referenceTable: 'sales' | 'invoice_items' = 'sales'
) {
  return await createJournalEntry({
    transaction_type: 'sale',
    description: `Cost of goods sold`,
    reference_id: referenceId,
    reference_table: referenceTable,
    debit_amount: amount, // Increase expense (COGS)
    account_type: 'expense',
    account_subtype: 'cost_of_goods_sold',
    currency
  });
}

/**
 * Log a general expense (Debit: Expense, Credit: Cash)
 */
export async function logExpenseTransaction(
  expenseId: string,
  description: string,
  amount: number,
  expenseType: string,
  currency: string = 'IDR'
) {
  return await createJournalEntry({
    transaction_type: 'expense',
    description: description,
    reference_id: expenseId,
    reference_table: 'expenses',
    debit_amount: amount, // Increase expense
    account_type: 'expense',
    account_subtype: expenseType,
    currency
  });
}

/**
 * Update a general expense transaction
 */
export async function updateExpenseTransaction(
  expenseId: string,
  description: string,
  amount: number,
  expenseType: string,
  currency: string = 'IDR'
) {
  // Find the journal entry linked to this expense
  const { data: entries, error: fetchError } = await supabase
    .from('financial_journal')
    .select('id')
    .eq('reference_id', expenseId)
    .eq('reference_table', 'expenses')
    .single();

  if (fetchError) {
    console.error('Failed to find journal entry for update:', fetchError);
    // If not found, we might want to create it, but for now let's just log error
    return null;
  }

  // Update the entry directly
  const { data, error } = await supabase
    .from('financial_journal')
    .update({
      description: description,
      debit_amount: amount,
      account_subtype: expenseType,
      currency: currency,
      transaction_date: new Date().toISOString() // Optional: update date to now? Or keep original? usually keep original or update if date changed.
      // Let's assume we update the fields that changed.
    })
    .eq('id', entries.id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update journal entry:', error);
    throw error;
  }

  return data;
}

/**
 * Log a balance adjustment. Positive amounts are treated as revenue (credit),
 * negative amounts are treated as expense (debit).
 */
export async function logBalanceAdjustmentTransaction(
  adjustmentId: string,
  amount: number,
  adjustmentType: string,
  reason: string,
  currency: string = 'IDR'
) {
  // Refunds should reduce expenses, not inflate revenue
  const isRefund = adjustmentType === 'refund';
  const isIncome = amount >= 0;
  let payload: JournalEntry = {
    transaction_type: 'adjustment',
    description: `Balance adjustment (${adjustmentType}): ${reason}`,
    reference_id: adjustmentId,
    reference_table: 'balance_adjustments',
    debit_amount: 0,
    credit_amount: 0,
    account_type: 'expense',
    account_subtype: adjustmentType,
    currency
  };

  if (isRefund) {
    // Positive refund => credit to expense (reduces expenses)
    // Negative refund => debit to expense (increases expenses)
    payload.credit_amount = isIncome ? amount : 0;
    payload.debit_amount = !isIncome ? Math.abs(amount) : 0;
    payload.account_type = 'expense';
  } else {
    // Other adjustments: positive as revenue credit, negative as expense debit
    if (isIncome) {
      payload = {
        ...payload,
        account_type: 'revenue',
        debit_amount: 0,
        credit_amount: amount
      };
    } else {
      payload = {
        ...payload,
        account_type: 'expense',
        debit_amount: Math.abs(amount),
        credit_amount: 0
      };
    }
  }

  return await createJournalEntry(payload);
}

/**
 * Get financial journal entries with filters
 */
export async function getJournalEntries(filters?: {
  transaction_type?: string;
  account_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  let query = supabase
    .from('financial_journal')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (filters?.transaction_type) {
    query = query.eq('transaction_type', filters.transaction_type);
  }

  if (filters?.account_type) {
    query = query.eq('account_type', filters.account_type);
  }

  if (filters?.date_from) {
    query = query.gte('transaction_date', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('transaction_date', filters.date_to);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch journal entries:', error);
    throw error;
  }

  return data;
}

/**
 * Get financial summary by account type
 */
export async function getFinancialSummary(dateFrom?: string, dateTo?: string) {
  let query = supabase
    .from('financial_journal')
    .select('account_type, account_subtype, debit_amount, credit_amount');

  if (dateFrom) {
    query = query.gte('transaction_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('transaction_date', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch financial summary:', error);
    throw error;
  }

  // Group by account type and calculate totals
  const summary = data?.reduce((acc, entry) => {
    const key = `${entry.account_type}_${entry.account_subtype || 'general'}`;
    
    if (!acc[key]) {
      acc[key] = {
        account_type: entry.account_type,
        account_subtype: entry.account_subtype,
        total_debit: 0,
        total_credit: 0,
        net_amount: 0
      };
    }

    acc[key].total_debit += entry.debit_amount || 0;
    acc[key].total_credit += entry.credit_amount || 0;
    acc[key].net_amount = acc[key].total_debit - acc[key].total_credit;

    return acc;
  }, {} as Record<string, any>);

  return Object.values(summary || {});
}