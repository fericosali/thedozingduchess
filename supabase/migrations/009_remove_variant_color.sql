-- Remove color column from product_variants table
-- This simplifies variant creation to only require size and SKU

-- First, drop the dependent view
DROP VIEW IF EXISTS invoice_details;

-- Remove the color column
ALTER TABLE product_variants DROP COLUMN IF EXISTS color;

-- Recreate the invoice_details view without the color column
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
    pv.variant,
    pv.size,
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
GRANT SELECT ON invoice_details TO authenticated;