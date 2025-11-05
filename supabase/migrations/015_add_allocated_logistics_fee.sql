-- Add allocated_logistics_fee column to purchase_batches table
-- This column will be calculated as logistics_fee_per_unit * quantity

ALTER TABLE purchase_batches 
ADD COLUMN allocated_logistics_fee DECIMAL(10,2) 
GENERATED ALWAYS AS (logistics_fee_per_unit * quantity) STORED;

-- Add comment to explain the column
COMMENT ON COLUMN purchase_batches.allocated_logistics_fee IS 'Total logistics fee allocated to this batch (logistics_fee_per_unit * quantity)';