-- Migration: Add Manual Stock Adjustment
-- This migration adds the ability to perform manual stock adjustments (e.g., for defects)
-- where the quantity decreases but the total value remains the same (increasing the unit COGS).

-- 1. Update stock_movements check constraint to include 'manual_adjustment'
ALTER TABLE stock_movements 
DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements 
ADD CONSTRAINT stock_movements_movement_type_check 
CHECK (movement_type IN ('purchase', 'sale', 'adjustment_in', 'adjustment_out', 'manual_adjustment'));

-- 2. Create the function to handle manual adjustments (defects)
CREATE OR REPLACE FUNCTION handle_manual_adjustment(
    p_variant_id UUID,
    p_quantity INTEGER,
    p_reason TEXT DEFAULT 'Manual adjustment'
) RETURNS VOID AS $$
DECLARE
    batch_record RECORD;
    remaining_to_deduct INTEGER := p_quantity;
    deducted_from_batch INTEGER;
    old_batch_value DECIMAL(12,2);
    new_remaining_qty INTEGER;
    new_unit_cogs DECIMAL(10,2);
BEGIN
    -- Validation: Ensure quantity is positive (it represents the amount to REMOVE)
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity to remove must be positive';
    END IF;

    -- Check if enough stock available
    IF (SELECT COALESCE(total_quantity, 0) FROM inventory WHERE variant_id = p_variant_id) < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested removal: %', 
            (SELECT COALESCE(total_quantity, 0) FROM inventory WHERE variant_id = p_variant_id), 
            p_quantity;
    END IF;
    
    -- Process batches in FIFO order (oldest first)
    FOR batch_record IN 
        SELECT id, remaining_quantity, unit_cogs
        FROM purchase_batches 
        WHERE variant_id = p_variant_id 
        AND remaining_quantity > 0
        ORDER BY created_at ASC
    LOOP
        -- Calculate how much to deduct from this batch
        deducted_from_batch := LEAST(remaining_to_deduct, batch_record.remaining_quantity);
        
        -- Calculate current value of the batch (before deduction)
        old_batch_value := batch_record.remaining_quantity * batch_record.unit_cogs;
        
        -- Calculate new remaining quantity
        new_remaining_qty := batch_record.remaining_quantity - deducted_from_batch;
        
        -- CORE LOGIC: Preserve Value, Increase Unit Cost
        -- If we still have items left, they absorb the full cost of the original batch portion
        IF new_remaining_qty > 0 THEN
            -- New Unit Cost = Old Total Value / New Quantity
            new_unit_cogs := old_batch_value / new_remaining_qty;
            
            UPDATE purchase_batches 
            SET remaining_quantity = new_remaining_qty,
                unit_cogs = new_unit_cogs
            WHERE id = batch_record.id;
        ELSE
            -- Edge Case: If batch becomes empty, we can't preserve value on 0 items.
            -- The value is effectively "lost" (written off) because there are no items to hold it.
            -- This is unavoidable physically.
            UPDATE purchase_batches 
            SET remaining_quantity = 0
            WHERE id = batch_record.id;
        END IF;
        
        -- Log the movement
        INSERT INTO stock_movements (
            variant_id, batch_id, movement_type, quantity, unit_price, reason
        ) VALUES (
            p_variant_id, batch_record.id, 'manual_adjustment', 
            -deducted_from_batch, batch_record.unit_cogs, p_reason
        );
        
        -- Update remaining to deduct
        remaining_to_deduct := remaining_to_deduct - deducted_from_batch;
        
        -- Exit if we've deducted everything
        EXIT WHEN remaining_to_deduct = 0;
    END LOOP;
    
    -- Update inventory totals
    UPDATE inventory 
    SET total_quantity = total_quantity - p_quantity,
        last_updated = NOW()
    WHERE variant_id = p_variant_id;
    
    -- Recalculate average COGS based on remaining stock
    -- Note: Since we updated unit_cogs in the batches, this standard calculation
    -- will automatically reflect the higher average cost.
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
