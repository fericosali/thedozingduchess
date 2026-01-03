-- Migration: Add Revert Invoice Function
-- This function allows fully reversing a sale, restoring stock, and deleting the invoice record.

CREATE OR REPLACE FUNCTION revert_invoice(p_invoice_number TEXT)
RETURNS VOID AS $$
DECLARE
    v_invoice_id UUID;
    v_item_record RECORD;
    v_movement_record RECORD;
BEGIN
    -- 1. Find the invoice ID
    SELECT id INTO v_invoice_id FROM invoices WHERE invoice_number = p_invoice_number;
    
    IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_number;
    END IF;

    -- 2. Loop through each item in the invoice
    FOR v_item_record IN 
        SELECT id, variant_id, quantity 
        FROM invoice_items 
        WHERE invoice_id = v_invoice_id
    LOOP
        -- 3. Restore stock to purchase batches (Reverse FIFO deduction)
        -- Find movements associated with this item
        FOR v_movement_record IN
            SELECT batch_id, quantity
            FROM stock_movements
            WHERE invoice_item_id = v_item_record.id
            AND quantity < 0 -- Ensure we are looking at deductions (negative quantity)
        LOOP
            -- Restore quantity to the batch
            -- Note: movement quantity is negative, so we subtract it to add (or use ABS)
            UPDATE purchase_batches
            SET remaining_quantity = remaining_quantity + ABS(v_movement_record.quantity)
            WHERE id = v_movement_record.batch_id;
            
            -- Delete the movement record
            DELETE FROM stock_movements 
            WHERE invoice_item_id = v_item_record.id 
            AND batch_id = v_movement_record.batch_id;
        END LOOP;

        -- 4. Restore Inventory Total
        -- We update the inventory based on the item quantity
        UPDATE inventory
        SET total_quantity = total_quantity + v_item_record.quantity,
            last_updated = NOW()
        WHERE variant_id = v_item_record.variant_id;

        -- 5. Recalculate Average COGS
        -- Since we restored stock to batches, we can recalculate the weighted average
        -- based on all currently available batches.
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

    -- 6. Delete the Invoice
    -- This will cascade delete invoice_items due to ON DELETE CASCADE
    DELETE FROM invoices WHERE id = v_invoice_id;
    
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION revert_invoice(TEXT) TO authenticated;
