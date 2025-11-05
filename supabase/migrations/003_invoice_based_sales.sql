-- Migration: Update sales structure to support invoice-based sales with multiple items
-- This migration transforms the sales table from variant-based to invoice-based structure

-- First, create the new invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR NOT NULL UNIQUE,
    marketplace VARCHAR NOT NULL,
    total_selling_price NUMERIC NOT NULL CHECK (total_selling_price > 0),
    total_revenue NUMERIC GENERATED ALWAYS AS (total_selling_price) STORED,
    total_cogs NUMERIC NOT NULL DEFAULT 0,
    total_profit NUMERIC GENERATED ALWAYS AS (total_selling_price - total_cogs) STORED,
    sale_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create the invoice_items table to store individual items in each invoice
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    proportional_revenue NUMERIC NOT NULL DEFAULT 0,
    cogs_used NUMERIC NOT NULL DEFAULT 0,
    profit NUMERIC GENERATED ALWAYS AS (proportional_revenue - cogs_used) STORED,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_marketplace ON invoices(marketplace);
CREATE INDEX idx_invoices_sale_date ON invoices(sale_date);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_variant_id ON invoice_items(variant_id);

-- Add updated_at trigger for invoices
CREATE TRIGGER trigger_update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing sales data to the new structure
-- Each existing sale becomes its own invoice
INSERT INTO invoices (invoice_number, marketplace, total_selling_price, total_cogs, sale_date, created_at)
SELECT 
    invoice_number,
    marketplace,
    selling_price * quantity as total_selling_price,
    cogs_used,
    sale_date,
    created_at
FROM sales;

-- Create corresponding invoice items
INSERT INTO invoice_items (invoice_id, variant_id, quantity, proportional_revenue, cogs_used)
SELECT 
    i.id as invoice_id,
    s.variant_id,
    s.quantity,
    s.selling_price * s.quantity as proportional_revenue,
    s.cogs_used
FROM sales s
JOIN invoices i ON i.invoice_number = s.invoice_number 
    AND i.marketplace = s.marketplace 
    AND i.sale_date = s.sale_date;

-- Update stock_movements to reference invoice_items instead of sales
ALTER TABLE stock_movements ADD COLUMN invoice_item_id UUID REFERENCES invoice_items(id);

-- Update existing stock_movements to reference the new invoice_items
UPDATE stock_movements sm
SET invoice_item_id = ii.id
FROM invoice_items ii
JOIN invoices i ON ii.invoice_id = i.id
JOIN sales s ON s.invoice_number = i.invoice_number 
    AND s.marketplace = i.marketplace 
    AND s.sale_date = i.sale_date
    AND s.variant_id = ii.variant_id
WHERE sm.sale_id = s.id;

-- Remove the old sale_id foreign key constraint and column
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_sale_id_fkey;
ALTER TABLE stock_movements DROP COLUMN sale_id;

-- Add index for the new foreign key
CREATE INDEX idx_stock_movements_invoice_item_id ON stock_movements(invoice_item_id);

-- Drop dependent views first
DROP VIEW IF EXISTS financial_summary;
DROP VIEW IF EXISTS profit_analysis;

-- Drop the old sales table
DROP TABLE sales;

-- Create views for backward compatibility and easier querying
CREATE VIEW sales_summary AS
SELECT 
    i.id as invoice_id,
    i.invoice_number,
    i.marketplace,
    i.total_selling_price,
    i.total_revenue,
    i.total_cogs,
    i.total_profit,
    i.sale_date,
    i.created_at,
    COUNT(ii.id) as item_count,
    SUM(ii.quantity) as total_quantity
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id, i.invoice_number, i.marketplace, i.total_selling_price, 
         i.total_revenue, i.total_cogs, i.total_profit, i.sale_date, i.created_at;

CREATE VIEW invoice_details AS
SELECT 
    i.id as invoice_id,
    i.invoice_number,
    i.marketplace,
    i.total_selling_price,
    i.total_cogs,
    i.total_profit,
    i.sale_date,
    ii.id as item_id,
    ii.variant_id,
    pv.variant,
    pv.size,
    pv.color,
    pv.sku,
    p.name as product_name,
    ii.quantity,
    ii.proportional_revenue,
    ii.cogs_used,
    ii.profit as item_profit
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
LEFT JOIN product_variants pv ON ii.variant_id = pv.id
LEFT JOIN products p ON pv.product_id = p.id;

-- Grant necessary permissions
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_items TO authenticated;
GRANT SELECT ON sales_summary TO authenticated;
GRANT SELECT ON invoice_details TO authenticated;

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON invoices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" ON invoice_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);