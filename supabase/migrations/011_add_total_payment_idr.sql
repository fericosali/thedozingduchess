-- Add total_payment_idr column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN total_payment_idr NUMERIC DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN purchase_orders.total_payment_idr IS 'Actual total payment in IDR including additional fees, shipping costs, etc.';