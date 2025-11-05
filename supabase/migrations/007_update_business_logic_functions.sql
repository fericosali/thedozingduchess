-- Migration: Update business logic functions for invoice-based sales
-- This migration updates the database functions and triggers to work with the new invoice structure

-- Drop the old process_sale function since we now have invoice-based sales
DROP FUNCTION IF EXISTS process_sale(UUID, INTEGER, NUMERIC);

-- Create new function to process invoice items and calculate COGS
CREATE OR REPLACE FUNCTION process_invoice_item(
    p_invoice_item_id UUID,
    p_variant_id UUID,
    p_quantity INTEGER,
    p_proportional_revenue NUMERIC
) RETURNS VOID AS $$
DECLARE
    remaining_qty INTEGER := p_quantity;
    batch_record RECORD;
    deduction_qty INTEGER;
    total_cogs NUMERIC := 0;
BEGIN
    -- Deduct stock using FIFO and calculate COGS
    FOR batch_record IN
        SELECT id, unit_cogs, remaining_quantity
        FROM purchase_batches
        WHERE variant_id = p_variant_id 
        AND remaining_quantity > 0
        ORDER BY created_at ASC
    LOOP
        EXIT WHEN remaining_qty <= 0;
        
        deduction_qty := LEAST(remaining_qty, batch_record.remaining_quantity);
        
        -- Update batch remaining quantity
        UPDATE purchase_batches
        SET remaining_quantity = remaining_quantity - deduction_qty
        WHERE id = batch_record.id;
        
        -- Record stock movement
        INSERT INTO stock_movements (
            variant_id, batch_id, invoice_item_id, movement_type, 
            quantity, unit_price, reason
        ) VALUES (
            p_variant_id, batch_record.id, p_invoice_item_id, 'sale',
            -deduction_qty, batch_record.unit_cogs, 
            'Sale processed via invoice'
        );
        
        -- Accumulate COGS
        total_cogs := total_cogs + (deduction_qty * batch_record.unit_cogs);
        remaining_qty := remaining_qty - deduction_qty;
    END LOOP;
    
    -- Update the invoice item with calculated COGS
    UPDATE invoice_items
    SET cogs_used = total_cogs
    WHERE id = p_invoice_item_id;
    
    -- Update inventory
    UPDATE inventory
    SET total_quantity = total_quantity - p_quantity,
        last_updated = now()
    WHERE variant_id = p_variant_id;
    
    -- Recalculate average COGS for the variant
    UPDATE inventory
    SET average_cogs = (
        SELECT COALESCE(
            SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0),
            0
        )
        FROM purchase_batches
        WHERE variant_id = p_variant_id AND remaining_quantity > 0
    )
    WHERE variant_id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to process entire invoice
CREATE OR REPLACE FUNCTION process_invoice(p_invoice_id UUID) RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    total_cogs NUMERIC := 0;
BEGIN
    -- Process each item in the invoice
    FOR item_record IN
        SELECT id, variant_id, quantity, proportional_revenue
        FROM invoice_items
        WHERE invoice_id = p_invoice_id
    LOOP
        -- Process the individual item
        PERFORM process_invoice_item(
            item_record.id,
            item_record.variant_id,
            item_record.quantity,
            item_record.proportional_revenue
        );
        
        -- Get the calculated COGS for this item
        SELECT cogs_used INTO total_cogs
        FROM invoice_items
        WHERE id = item_record.id;
        
        -- Add to total COGS
        total_cogs := total_cogs + COALESCE(total_cogs, 0);
    END LOOP;
    
    -- Update the invoice with total COGS
    UPDATE invoices
    SET total_cogs = (
        SELECT COALESCE(SUM(cogs_used), 0)
        FROM invoice_items
        WHERE invoice_id = p_invoice_id
    )
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically process invoice items when they're inserted
CREATE OR REPLACE FUNCTION trigger_process_invoice_item() RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is a new insert
    IF TG_OP = 'INSERT' THEN
        PERFORM process_invoice_item(
            NEW.id,
            NEW.variant_id,
            NEW.quantity,
            NEW.proportional_revenue
        );
        
        -- Update the invoice total COGS
        UPDATE invoices
        SET total_cogs = (
            SELECT COALESCE(SUM(cogs_used), 0)
            FROM invoice_items
            WHERE invoice_id = NEW.invoice_id
        )
        WHERE id = NEW.invoice_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on invoice_items
CREATE TRIGGER trigger_process_invoice_item
    AFTER INSERT ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_invoice_item();

-- Update the financial_summary view to work with invoices
DROP VIEW IF EXISTS financial_summary;
CREATE VIEW financial_summary AS
SELECT 
    COALESCE(SUM(i.total_revenue), 0) as total_revenue,
    COALESCE(SUM(i.total_cogs), 0) as total_cogs,
    COALESCE(SUM(i.total_profit), 0) as total_profit,
    COALESCE(SUM(e.amount), 0) as total_expenses,
    COALESCE(SUM(ba.amount), 0) as total_adjustments,
    (COALESCE(SUM(i.total_profit), 0) - COALESCE(SUM(e.amount), 0) + COALESCE(SUM(ba.amount), 0)) as net_profit
FROM invoices i
FULL OUTER JOIN expenses e ON true
FULL OUTER JOIN balance_adjustments ba ON true;

-- Update the profit_analysis view to work with invoices
DROP VIEW IF EXISTS profit_analysis;
CREATE VIEW profit_analysis AS
SELECT 
    DATE_TRUNC('month', i.sale_date) as month,
    COUNT(i.id) as invoice_count,
    SUM(ii.quantity) as total_items_sold,
    SUM(i.total_revenue) as total_revenue,
    SUM(i.total_cogs) as total_cogs,
    SUM(i.total_profit) as total_profit,
    CASE 
        WHEN SUM(i.total_revenue) > 0 
        THEN (SUM(i.total_profit) / SUM(i.total_revenue)) * 100 
        ELSE 0 
    END as profit_margin_percentage
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
GROUP BY DATE_TRUNC('month', i.sale_date)
ORDER BY month DESC;

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION process_invoice_item(UUID, UUID, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION process_invoice(UUID) TO authenticated;