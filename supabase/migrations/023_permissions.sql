-- Row Level Security and Permissions
-- This migration sets up RLS policies and grants appropriate permissions

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon role (for public access)
GRANT SELECT ON products TO anon;
GRANT SELECT ON product_variants TO anon;
GRANT SELECT ON purchase_orders TO anon;
GRANT SELECT ON purchase_batches TO anon;
GRANT SELECT ON inventory TO anon;
GRANT SELECT ON stock_movements TO anon;
GRANT SELECT ON sales TO anon;
GRANT SELECT ON expenses TO anon;
GRANT SELECT ON expense_categories TO anon;
GRANT SELECT ON balance_adjustments TO anon;
GRANT SELECT ON settings TO anon;

-- Grant permissions to views for anon role
GRANT SELECT ON inventory_with_alerts TO anon;
GRANT SELECT ON stock_by_batches TO anon;
GRANT SELECT ON financial_summary TO anon;
GRANT SELECT ON profit_analysis TO anon;

-- Grant full permissions to authenticated role (for admin users)
GRANT ALL PRIVILEGES ON products TO authenticated;
GRANT ALL PRIVILEGES ON product_variants TO authenticated;
GRANT ALL PRIVILEGES ON purchase_orders TO authenticated;
GRANT ALL PRIVILEGES ON purchase_batches TO authenticated;
GRANT ALL PRIVILEGES ON inventory TO authenticated;
GRANT ALL PRIVILEGES ON stock_movements TO authenticated;
GRANT ALL PRIVILEGES ON sales TO authenticated;
GRANT ALL PRIVILEGES ON expenses TO authenticated;
GRANT ALL PRIVILEGES ON expense_categories TO authenticated;
GRANT ALL PRIVILEGES ON balance_adjustments TO authenticated;
GRANT ALL PRIVILEGES ON settings TO authenticated;

-- Grant permissions to views for authenticated role
GRANT ALL PRIVILEGES ON inventory_with_alerts TO authenticated;
GRANT ALL PRIVILEGES ON stock_by_batches TO authenticated;
GRANT ALL PRIVILEGES ON financial_summary TO authenticated;
GRANT ALL PRIVILEGES ON profit_analysis TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION deduct_stock_fifo(UUID, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_stock_adjustment(UUID, INTEGER, DECIMAL, TEXT) TO authenticated;

-- Create RLS policies for authenticated users (admin access)
-- Since this is a single-admin system, authenticated users get full access

-- Products policies
CREATE POLICY "Authenticated users can do everything with products" ON products
    FOR ALL USING (auth.role() = 'authenticated');

-- Product variants policies  
CREATE POLICY "Authenticated users can do everything with product_variants" ON product_variants
    FOR ALL USING (auth.role() = 'authenticated');

-- Purchase orders policies
CREATE POLICY "Authenticated users can do everything with purchase_orders" ON purchase_orders
    FOR ALL USING (auth.role() = 'authenticated');

-- Purchase batches policies
CREATE POLICY "Authenticated users can do everything with purchase_batches" ON purchase_batches
    FOR ALL USING (auth.role() = 'authenticated');

-- Inventory policies
CREATE POLICY "Authenticated users can do everything with inventory" ON inventory
    FOR ALL USING (auth.role() = 'authenticated');

-- Stock movements policies
CREATE POLICY "Authenticated users can do everything with stock_movements" ON stock_movements
    FOR ALL USING (auth.role() = 'authenticated');

-- Sales policies
CREATE POLICY "Authenticated users can do everything with sales" ON sales
    FOR ALL USING (auth.role() = 'authenticated');

-- Expenses policies
CREATE POLICY "Authenticated users can do everything with expenses" ON expenses
    FOR ALL USING (auth.role() = 'authenticated');

-- Expense categories policies
CREATE POLICY "Authenticated users can do everything with expense_categories" ON expense_categories
    FOR ALL USING (auth.role() = 'authenticated');

-- Balance adjustments policies
CREATE POLICY "Authenticated users can do everything with balance_adjustments" ON balance_adjustments
    FOR ALL USING (auth.role() = 'authenticated');

-- Settings policies
CREATE POLICY "Authenticated users can do everything with settings" ON settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Create policies for anon users (read-only access for public views if needed)
-- Note: In a real production environment, you might want to restrict anon access

CREATE POLICY "Anon users can read products" ON products
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read product_variants" ON product_variants
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read purchase_orders" ON purchase_orders
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read purchase_batches" ON purchase_batches
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read inventory" ON inventory
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read stock_movements" ON stock_movements
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read sales" ON sales
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read expenses" ON expenses
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read expense_categories" ON expense_categories
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read balance_adjustments" ON balance_adjustments
    FOR SELECT USING (true);

CREATE POLICY "Anon users can read settings" ON settings
    FOR SELECT USING (true);