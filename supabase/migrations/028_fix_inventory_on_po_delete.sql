-- Function to update inventory when a purchase batch is deleted
CREATE OR REPLACE FUNCTION update_inventory_after_batch_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease inventory quantity
    UPDATE inventory 
    SET total_quantity = total_quantity - OLD.quantity,
        last_updated = NOW()
    WHERE variant_id = OLD.variant_id;
    
    -- Recalculate average COGS based on remaining batches (excluding the one being deleted)
    -- We use a CTE or subquery to sum up all OTHER batches
    UPDATE inventory 
    SET average_cogs = COALESCE(
        (
            SELECT SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0)
            FROM purchase_batches 
            WHERE variant_id = OLD.variant_id 
            AND id != OLD.id -- Exclude the deleted batch
            AND remaining_quantity > 0
        ),
        0 -- Fallback to 0 if no stock remains
    )
    WHERE variant_id = OLD.variant_id;

    -- Create stock movement record for audit trail
    INSERT INTO stock_movements (
        variant_id, 
        batch_id, 
        movement_type, 
        quantity, 
        unit_price, 
        reason
    ) VALUES (
        OLD.variant_id, 
        OLD.id, 
        'adjustment_out', 
        -OLD.quantity, 
        OLD.unit_cogs, 
        'Purchase Order/Batch Deleted'
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run BEFORE deletion
-- We use BEFORE DELETE so we still have access to the record in OLD
DROP TRIGGER IF EXISTS trigger_update_inventory_after_batch_delete ON purchase_batches;

CREATE TRIGGER trigger_update_inventory_after_batch_delete
    BEFORE DELETE ON purchase_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_after_batch_deletion();
