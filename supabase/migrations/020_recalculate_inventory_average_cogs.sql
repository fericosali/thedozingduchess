-- Recalculate inventory average_cogs to ensure it matches the updated unit_cogs values
-- This ensures inventory average COGS matches Purchase Order Final Unit Cost

-- Update inventory average_cogs for all variants based on current purchase_batches unit_cogs
-- The unit_cogs now includes: (cny_price * exchange_rate) + logistics_fee_per_unit + gap_per_unit
UPDATE inventory 
SET average_cogs = (
    SELECT COALESCE(
        SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0),
        0
    )
    FROM purchase_batches
    WHERE variant_id = inventory.variant_id AND remaining_quantity > 0
),
last_updated = NOW()
WHERE variant_id IN (
    SELECT DISTINCT variant_id 
    FROM purchase_batches 
    WHERE remaining_quantity > 0
);

-- Add comment explaining the recalculation
COMMENT ON TABLE inventory IS 'Inventory table with average_cogs calculated from purchase_batches.unit_cogs which includes base price, logistics fee, and gap per unit';