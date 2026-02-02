-- REPAIR SCRIPT: Synchronize Inventory with Active Purchase Batches
-- Run this to fix discrepancies where inventory count is higher than actual available batches

BEGIN;

-- 1. Recalculate and update inventory totals for ALL variants
-- This sets the inventory quantity to exactly match the sum of remaining items in active batches
UPDATE inventory i
SET 
    total_quantity = COALESCE((
        SELECT SUM(remaining_quantity)
        FROM purchase_batches pb
        WHERE pb.variant_id = i.variant_id
    ), 0),
    average_cogs = COALESCE((
        SELECT SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0)
        FROM purchase_batches pb
        WHERE pb.variant_id = i.variant_id AND pb.remaining_quantity > 0
    ), 0),
    last_updated = NOW();

-- 2. Cleanup "Ghost" Stock Movements (Optional but recommended)
-- Removes 'purchase' movements where the corresponding batch has been deleted
-- This cleans up the history to reflect that these purchases effectively "never happened"
DELETE FROM stock_movements
WHERE movement_type IN ('purchase', 'adjustment_in')
AND batch_id IS NULL;

COMMIT;

-- Verification Query (Check if any discrepancies remain)
SELECT 
    i.variant_id,
    i.total_quantity as inventory_table_qty,
    COALESCE(SUM(pb.remaining_quantity), 0) as batch_sum_qty,
    (i.total_quantity - COALESCE(SUM(pb.remaining_quantity), 0)) as diff
FROM inventory i
LEFT JOIN purchase_batches pb ON i.variant_id = pb.variant_id
GROUP BY i.variant_id, i.total_quantity
HAVING (i.total_quantity - COALESCE(SUM(pb.remaining_quantity), 0)) != 0;
