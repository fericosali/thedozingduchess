-- Drop the old logger table and create a comprehensive financial journal system
DROP TABLE IF EXISTS logger;

-- Create financial_journal table for tracking all money movements
CREATE TABLE financial_journal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'expense', 'adjustment', 'logistics'
    description TEXT NOT NULL,
    reference_id UUID, -- ID of the related record (purchase_order_id, sale_id, etc.)
    reference_table VARCHAR(100), -- 'purchase_orders', 'sales', 'expenses', etc.
    
    -- Accounting fields (proper debit/credit system)
    debit_amount NUMERIC DEFAULT 0,
    credit_amount NUMERIC DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'IDR',
    
    -- Account classification for reporting
    account_type VARCHAR(50) NOT NULL, -- 'inventory', 'expense', 'revenue', 'cash', 'logistics'
    account_subtype VARCHAR(100), -- 'product_purchase', 'logistics_fee', 'product_sale', etc.
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure either debit or credit has a value, but not both
    CONSTRAINT check_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Add RLS policies for financial_journal
ALTER TABLE financial_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal entries" ON financial_journal
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own journal entries" ON financial_journal
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX idx_financial_journal_transaction_date ON financial_journal(transaction_date);
CREATE INDEX idx_financial_journal_transaction_type ON financial_journal(transaction_type);
CREATE INDEX idx_financial_journal_account_type ON financial_journal(account_type);
CREATE INDEX idx_financial_journal_reference ON financial_journal(reference_table, reference_id);
CREATE INDEX idx_financial_journal_created_by ON financial_journal(created_by);

-- Add helpful comments
COMMENT ON TABLE financial_journal IS 'Complete financial journal tracking all money movements with proper debit/credit accounting';
COMMENT ON COLUMN financial_journal.transaction_type IS 'Type of financial transaction: purchase, sale, expense, adjustment, logistics';
COMMENT ON COLUMN financial_journal.debit_amount IS 'Debit amount (increases assets/expenses, decreases liabilities/equity/revenue)';
COMMENT ON COLUMN financial_journal.credit_amount IS 'Credit amount (decreases assets/expenses, increases liabilities/equity/revenue)';
COMMENT ON COLUMN financial_journal.account_type IS 'Account classification: inventory, expense, revenue, cash, logistics';
COMMENT ON COLUMN financial_journal.account_subtype IS 'Detailed account classification for reporting';

-- Create a function to automatically create journal entries
CREATE OR REPLACE FUNCTION create_journal_entry(
    p_transaction_type VARCHAR(50),
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_reference_table VARCHAR(100) DEFAULT NULL,
    p_debit_amount NUMERIC DEFAULT 0,
    p_credit_amount NUMERIC DEFAULT 0,
    p_account_type VARCHAR(50) DEFAULT 'expense',
    p_account_subtype VARCHAR(100) DEFAULT NULL,
    p_currency VARCHAR(10) DEFAULT 'IDR'
) RETURNS UUID AS $$
DECLARE
    journal_id UUID;
BEGIN
    INSERT INTO financial_journal (
        transaction_type,
        description,
        reference_id,
        reference_table,
        debit_amount,
        credit_amount,
        account_type,
        account_subtype,
        currency,
        created_by
    ) VALUES (
        p_transaction_type,
        p_description,
        p_reference_id,
        p_reference_table,
        p_debit_amount,
        p_credit_amount,
        p_account_type,
        p_account_subtype,
        p_currency,
        auth.uid()
    ) RETURNING id INTO journal_id;
    
    RETURN journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_journal_entry TO authenticated;