-- Add gap_per_unit column to purchase_batches table
-- This column stores the payment gap distributed per unit for accurate cost calculations

ALTER TABLE purchase_batches 
ADD COLUMN gap_per_unit DECIMAL(10,2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN purchase_batches.gap_per_unit IS 'Payment gap distributed per unit: (total_payment_idr - sum_of_items) / total_quantity';

-- Update existing records to have gap_per_unit = 0 (no gap for existing orders)
UPDATE purchase_batches SET gap_per_unit = 0 WHERE gap_per_unit IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE purchase_batches ALTER COLUMN gap_per_unit SET NOT NULL;