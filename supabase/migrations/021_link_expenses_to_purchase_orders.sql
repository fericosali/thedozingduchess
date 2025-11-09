-- Link expenses to purchase orders and auto-create aggregated PO expense on completion

-- 1) Add purchase_order_id to expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;

-- 2) Ensure "Purchase Order" expense category exists
INSERT INTO expense_categories (name, description, is_active)
VALUES ('Purchase Order', 'Aggregated total cost of a purchase order (payment + shipping)', true)
ON CONFLICT (name) DO NOTHING;

-- 3) Trigger function: when a PO is completed, create/update a single aggregated expense
CREATE OR REPLACE FUNCTION create_po_total_expense()
RETURNS TRIGGER AS $$
DECLARE
  cat_id UUID;
  existing_expense_id UUID;
  total_price NUMERIC;
  expense_dt DATE;
BEGIN
  -- Only act when PO is completed
  IF NEW.order_status = 'completed' THEN
    -- Compute total = total_payment_idr + total_logistics_fee
    total_price := COALESCE(NEW.total_payment_idr, 0) + COALESCE(NEW.total_logistics_fee, 0);

    -- If nothing to record, skip
    IF total_price <= 0 THEN
      RETURN NEW;
    END IF;

    -- Resolve category id (create if missing)
    SELECT id INTO cat_id FROM expense_categories WHERE name = 'Purchase Order' LIMIT 1;
    IF cat_id IS NULL THEN
      INSERT INTO expense_categories (name, description, is_active)
      VALUES ('Purchase Order', 'Aggregated total cost of a purchase order (payment + shipping)', true)
      RETURNING id INTO cat_id;
    END IF;

    -- Choose expense date: actual delivery > order date > today
    expense_dt := COALESCE(NEW.actual_delivery, NEW.order_date, CURRENT_DATE);

    -- Check if we already created an expense for this PO
    SELECT id INTO existing_expense_id 
    FROM expenses 
    WHERE purchase_order_id = NEW.id AND category_id = cat_id
    LIMIT 1;

    IF existing_expense_id IS NULL THEN
      INSERT INTO expenses (category_id, amount, description, expense_date, purchase_order_id)
      VALUES (
        cat_id,
        total_price,
        'Purchase Order ' || NEW.order_number || ' total (payment + shipping)',
        expense_dt,
        NEW.id
      );
    ELSE
      -- Update if totals changed
      UPDATE expenses
      SET amount = total_price,
          description = 'Purchase Order ' || NEW.order_number || ' total (payment + shipping)',
          expense_date = expense_dt
      WHERE id = existing_expense_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger: fire when relevant PO fields change
DROP TRIGGER IF EXISTS trigger_po_completed_create_expense ON purchase_orders;
CREATE TRIGGER trigger_po_completed_create_expense
AFTER UPDATE OF order_status, total_payment_idr, total_logistics_fee, actual_delivery ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION create_po_total_expense();

-- Notes:
-- - This creates ONE aggregated expense per PO under the 'Purchase Order' category.
-- - Updates keep the amount in sync if payment or shipping totals change post-completion.
-- - Expenses remain visible in the Expenses page with the PO number in the description.