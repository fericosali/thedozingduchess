-- Create logger table for expense tracking
CREATE TABLE IF NOT EXISTS logger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    description TEXT,
    amount NUMERIC,
    currency VARCHAR(10) DEFAULT 'IDR',
    expense_type VARCHAR(100), -- 'purchase_order_created', 'logistics_fee_added', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add RLS policy for logger table
ALTER TABLE logger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs" ON logger
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own logs" ON logger
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Remove notes column from purchase_orders if it exists
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS notes;

-- Make logistics_fee nullable in purchase_orders (will be added later)
ALTER TABLE purchase_orders ALTER COLUMN total_logistics_fee DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN total_logistics_fee SET DEFAULT NULL;

-- Add comment to explain the workflow
COMMENT ON TABLE logger IS 'Tracks all expense-related actions for audit purposes, especially for purchase orders where expenses are added twice (initial order + logistics fee)';
COMMENT ON COLUMN logger.expense_type IS 'Type of expense action: purchase_order_created, logistics_fee_added, etc.';
COMMENT ON COLUMN purchase_orders.total_logistics_fee IS 'Logistics fee added after order arrives at destination (nullable initially)';