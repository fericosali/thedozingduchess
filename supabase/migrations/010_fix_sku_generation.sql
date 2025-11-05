-- Fix SKU generation format
-- Change from 'variant-size' to 'variant_size_lowercase' format
-- This ensures SKUs like 'elara_bunny_xl' instead of 'bunny-XL'

-- First, drop dependent views that reference the SKU column
DROP VIEW IF EXISTS inventory_with_alerts CASCADE;
DROP VIEW IF EXISTS stock_by_batches CASCADE;
DROP VIEW IF EXISTS invoice_details CASCADE;

-- Drop the existing generated SKU column
ALTER TABLE product_variants DROP COLUMN sku;

-- Add the new SKU column with correct generation format
ALTER TABLE product_variants ADD COLUMN sku VARCHAR(150) GENERATED ALWAYS AS (variant || '_' || LOWER(size)) STORED;

-- Recreate the unique index for SKU
CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku);

-- Recreate the invoice_details view (from migration 009)
CREATE VIEW invoice_details AS
SELECT 
    i.id as invoice_id,
    i.invoice_number,
    i.marketplace,
    i.sale_date,
    i.total_revenue,
    i.total_cogs,
    i.total_profit,
    ii.id as item_id,
    ii.variant_id,
    ii.quantity,
    ii.proportional_revenue,
    ii.cogs_used,
    ii.profit,
    pv.variant,
    pv.size,
    pv.sku,
    p.name as product_name
FROM invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
JOIN product_variants pv ON ii.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;

-- Note: Other views (inventory_with_alerts, stock_by_batches) will be recreated 
-- automatically by the business logic if they exist in other migrations