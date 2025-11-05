-- Update gap_per_unit values for all existing purchase_batches
-- Calculate gap as: (total_payment_idr - sum of all batch costs) / total_quantity

-- First, create a temporary function to calculate gap per unit for each purchase order
CREATE OR REPLACE FUNCTION calculate_and_update_gap_per_unit()
RETURNS void AS $$
DECLARE
    order_record RECORD;
    total_batch_cost DECIMAL(10,2);
    total_quantity INTEGER;
    gap_amount DECIMAL(10,2);
    gap_per_unit_value DECIMAL(10,2);
BEGIN
    -- Loop through each purchase order
    FOR order_record IN 
        SELECT id, total_payment_idr, exchange_rate
        FROM purchase_orders 
        WHERE order_status = 'completed' AND total_payment_idr IS NOT NULL
    LOOP
        -- Calculate total batch cost for this order (CNY price * exchange rate * quantity)
        SELECT 
            COALESCE(SUM(cny_price * order_record.exchange_rate * quantity), 0),
            COALESCE(SUM(quantity), 0)
        INTO total_batch_cost, total_quantity
        FROM purchase_batches 
        WHERE purchase_order_id = order_record.id;
        
        -- Only proceed if we have quantities
        IF total_quantity > 0 THEN
            -- Calculate gap amount
            gap_amount := order_record.total_payment_idr - total_batch_cost;
            
            -- Calculate gap per unit
            gap_per_unit_value := gap_amount / total_quantity;
            
            -- Update all batches for this order with the calculated gap_per_unit
            UPDATE purchase_batches 
            SET gap_per_unit = gap_per_unit_value
            WHERE purchase_order_id = order_record.id;
            
            RAISE NOTICE 'Updated order %: total_payment=%, batch_cost=%, gap=%, gap_per_unit=%', 
                order_record.id, order_record.total_payment_idr, total_batch_cost, gap_amount, gap_per_unit_value;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to update all gap_per_unit values
SELECT calculate_and_update_gap_per_unit();

-- Drop the temporary function
DROP FUNCTION calculate_and_update_gap_per_unit();

-- Update unit_cogs to include gap_per_unit for all batches
UPDATE purchase_batches 
SET unit_cogs = (cny_price * (
    SELECT exchange_rate 
    FROM purchase_orders 
    WHERE id = purchase_batches.purchase_order_id
)) + COALESCE(logistics_fee_per_unit, 0) + COALESCE(gap_per_unit, 0)
WHERE purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE order_status = 'completed'
);

-- Add index for better performance on gap_per_unit queries
CREATE INDEX IF NOT EXISTS idx_purchase_batches_gap_per_unit ON purchase_batches(gap_per_unit);

-- Add comment explaining the update
COMMENT ON COLUMN purchase_batches.gap_per_unit IS 'Payment gap per unit: (total_payment_idr - sum_of_batch_costs) / total_quantity. Updated automatically when order is completed.';