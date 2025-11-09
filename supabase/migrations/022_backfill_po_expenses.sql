-- Backfill expenses for existing completed purchase orders
-- This script creates ONE aggregated expense per completed PO under the
-- 'Purchase Order' category, mirroring the trigger logic introduced in 021.

DO $$
DECLARE
  cat_id UUID;
BEGIN
  -- Ensure category exists and get its id
  SELECT id INTO cat_id FROM expense_categories WHERE name = 'Purchase Order' LIMIT 1;
  IF cat_id IS NULL THEN
    INSERT INTO expense_categories (name, description, is_active)
    VALUES ('Purchase Order', 'Aggregated total cost of a purchase order (payment + shipping)', true)
    RETURNING id INTO cat_id;
  END IF;

  -- Insert missing aggregated expenses for completed purchase orders
  INSERT INTO expenses (category_id, amount, description, expense_date, purchase_order_id)
  SELECT
    cat_id AS category_id,
    COALESCE(po.total_payment_idr, 0) + COALESCE(po.total_logistics_fee, 0) AS amount,
    'Purchase Order ' || po.order_number || ' total (payment + shipping)' AS description,
    COALESCE(po.actual_delivery, po.order_date, CURRENT_DATE) AS expense_date,
    po.id AS purchase_order_id
  FROM purchase_orders po
  WHERE po.order_status = 'completed'
    AND (COALESCE(po.total_payment_idr, 0) + COALESCE(po.total_logistics_fee, 0)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.purchase_order_id = po.id AND e.category_id = cat_id
    );

  -- Optional: update existing aggregated expenses if totals changed
  -- This keeps amounts in sync for any previously created rows.
  UPDATE expenses e
  SET amount = COALESCE(po.total_payment_idr, 0) + COALESCE(po.total_logistics_fee, 0),
      description = 'Purchase Order ' || po.order_number || ' total (payment + shipping)',
      expense_date = COALESCE(po.actual_delivery, po.order_date, CURRENT_DATE)
  FROM purchase_orders po
  WHERE e.purchase_order_id = po.id
    AND e.category_id = cat_id
    AND po.order_status = 'completed'
    AND (COALESCE(po.total_payment_idr, 0) + COALESCE(po.total_logistics_fee, 0)) > 0
    AND (
      e.amount IS DISTINCT FROM (COALESCE(po.total_payment_idr, 0) + COALESCE(po.total_logistics_fee, 0)) OR
      e.expense_date IS DISTINCT FROM COALESCE(po.actual_delivery, po.order_date, CURRENT_DATE) OR
      e.description IS DISTINCT FROM 'Purchase Order ' || po.order_number || ' total (payment + shipping)'
    );
END $$;