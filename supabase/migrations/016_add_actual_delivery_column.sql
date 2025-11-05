-- Add actual_delivery column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN actual_delivery DATE;

COMMENT ON COLUMN purchase_orders.actual_delivery IS 'Actual delivery date when the purchase order is completed';