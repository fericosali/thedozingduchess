-- Add expected_delivery column to purchase_orders table
-- This fixes the missing column error when creating purchase orders

ALTER TABLE purchase_orders 
ADD COLUMN expected_delivery DATE;

-- Add comment for the new column
COMMENT ON COLUMN purchase_orders.expected_delivery IS 'Expected delivery date for the purchase order';

-- Update existing records to have a default expected delivery (7 days from order date)
UPDATE purchase_orders 
SET expected_delivery = order_date + INTERVAL '7 days' 
WHERE expected_delivery IS NULL AND order_date IS NOT NULL;