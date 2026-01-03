-- Fix: Recreate Revert Invoice Function and Force Schema Reload
-- This migration ensures the function is correctly defined and the PostgREST schema cache is reloaded.

-- 1. Drop the function if it exists to ensure a clean slate
DROP FUNCTION IF EXISTS revert_invoice(TEXT);

-- 2. Recreate the function
CREATE OR REPLACE FUNCTION revert_invoice(p_invoice_number TEXT)
RETURNS VOID AS $$
DECLARE
    v_invoice_id UUID;
    v_item_record RECORD;
    v_movement_record RECORD;
BEGIN
    -- Find the invoice ID
    SELECT id INTO v_invoice_id FROM invoices WHERE invoice_number = p_invoice_number;
    
    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_number;
    END IF;

    -- Loop through each item in the invoice
    FOR v_item_record IN 
        SELECT id, variant_id, quantity 
        FROM invoice_items 
        WHERE invoice_id = v_invoice_id
    LOOP
        -- Restore stock to purchase batches (Reverse FIFO deduction)
        FOR v_movement_record IN
            SELECT batch_id, quantity
            FROM stock_movements
            WHERE invoice_item_id = v_item_record.id
            AND quantity < 0 -- Only look at deductions
        LOOP
            -- Restore quantity to the batch (subtract negative quantity = add positive)
            UPDATE purchase_batches
            SET remaining_quantity = remaining_quantity + ABS(v_movement_record.quantity)
            WHERE id = v_movement_record.batch_id;
            
            -- Delete the movement record
            DELETE FROM stock_movements 
            WHERE invoice_item_id = v_item_record.id 
            AND batch_id = v_movement_record.batch_id;
        END LOOP;

        -- Restore Inventory Total
        UPDATE inventory
        SET total_quantity = total_quantity + v_item_record.quantity,
            last_updated = NOW()
        WHERE variant_id = v_item_record.variant_id;

        -- Recalculate Average COGS
        UPDATE inventory
        SET average_cogs = (
            SELECT COALESCE(
                SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0),
                0
            )
            FROM purchase_batches
            WHERE variant_id = v_item_record.variant_id 
            AND remaining_quantity > 0
        )
        WHERE variant_id = v_item_record.variant_id;
        
    END LOOP;

    -- Delete the Invoice (cascades to items)
    DELETE FROM invoices WHERE id = v_invoice_id;
    
END;
$$ LANGUAGE plpgsql;

-- 3. Grant permission explicitly
GRANT EXECUTE ON FUNCTION revert_invoice(TEXT) TO authenticated;

-- 4. Force schema cache reload
NOTIFY pgrst, 'reload schema';
