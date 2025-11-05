-- Business Logic Functions and Triggers
-- This migration creates all the business logic for FIFO, COGS calculation, and inventory management

-- Function to update purchase order totals when batches are added
CREATE OR REPLACE FUNCTION update_purchase_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    order_total_qty INTEGER;
BEGIN
    -- Calculate total quantity for the order
    SELECT COALESCE(SUM(quantity), 0) INTO order_total_qty
    FROM purchase_batches 
    WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    -- Update the purchase order total quantity
    UPDATE purchase_orders 
    SET total_quantity = order_total_qty,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate unit COGS when batch is inserted
CREATE OR REPLACE FUNCTION calculate_batch_cogs()
RETURNS TRIGGER AS $$
DECLARE
    order_exchange_rate DECIMAL(10,4);
    order_logistics_per_unit DECIMAL(10,4);
BEGIN
    -- Get exchange rate and logistics fee per unit from purchase order
    SELECT exchange_rate, logistics_fee_per_unit 
    INTO order_exchange_rate, order_logistics_per_unit
    FROM purchase_orders 
    WHERE id = NEW.purchase_order_id;
    
    -- Calculate unit COGS: (CNY price + logistics per unit) * exchange rate
    NEW.unit_cogs := (NEW.cny_price + order_logistics_per_unit) * order_exchange_rate;
    NEW.logistics_fee_per_unit := order_logistics_per_unit;
    NEW.remaining_quantity := NEW.quantity;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update inventory after purchase
CREATE OR REPLACE FUNCTION update_inventory_after_purchase()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update inventory record
    INSERT INTO inventory (variant_id, total_quantity, average_cogs, last_updated)
    VALUES (
        NEW.variant_id,
        NEW.quantity,
        NEW.unit_cogs,
        NOW()
    )
    ON CONFLICT (variant_id) DO UPDATE SET
        total_quantity = inventory.total_quantity + NEW.quantity,
        average_cogs = (
            (inventory.total_quantity * inventory.average_cogs) + 
            (NEW.quantity * NEW.unit_cogs)
        ) / (inventory.total_quantity + NEW.quantity),
        last_updated = NOW();
    
    -- Create stock movement record
    INSERT INTO stock_movements (
        variant_id, batch_id, movement_type, quantity, unit_price, reason
    ) VALUES (
        NEW.variant_id, NEW.id, 'purchase', NEW.quantity, NEW.unit_cogs, 'Purchase batch added'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle FIFO stock deduction
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
    p_variant_id UUID,
    p_quantity INTEGER,
    p_sale_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Stock deduction'
) RETURNS DECIMAL AS $$
DECLARE
    batch_record RECORD;
    remaining_to_deduct INTEGER := p_quantity;
    deducted_from_batch INTEGER;
    total_cogs DECIMAL := 0;
    batch_cogs DECIMAL;
BEGIN
    -- Check if enough stock available
    IF (SELECT COALESCE(total_quantity, 0) FROM inventory WHERE variant_id = p_variant_id) < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', 
            (SELECT COALESCE(total_quantity, 0) FROM inventory WHERE variant_id = p_variant_id), 
            p_quantity;
    END IF;
    
    -- Process batches in FIFO order (oldest first)
    FOR batch_record IN 
        SELECT id, remaining_quantity, unit_cogs
        FROM purchase_batches 
        WHERE variant_id = p_variant_id 
        AND remaining_quantity > 0
        ORDER BY created_at ASC
    LOOP
        -- Calculate how much to deduct from this batch
        deducted_from_batch := LEAST(remaining_to_deduct, batch_record.remaining_quantity);
        
        -- Calculate COGS for this portion
        batch_cogs := deducted_from_batch * batch_record.unit_cogs;
        total_cogs := total_cogs + batch_cogs;
        
        -- Update batch remaining quantity
        UPDATE purchase_batches 
        SET remaining_quantity = remaining_quantity - deducted_from_batch
        WHERE id = batch_record.id;
        
        -- Create stock movement record
        INSERT INTO stock_movements (
            variant_id, batch_id, sale_id, movement_type, quantity, unit_price, reason
        ) VALUES (
            p_variant_id, batch_record.id, p_sale_id, 
            CASE WHEN p_sale_id IS NOT NULL THEN 'sale' ELSE 'adjustment_out' END,
            -deducted_from_batch, batch_record.unit_cogs, p_reason
        );
        
        -- Update remaining to deduct
        remaining_to_deduct := remaining_to_deduct - deducted_from_batch;
        
        -- Exit if we've deducted everything
        EXIT WHEN remaining_to_deduct = 0;
    END LOOP;
    
    -- Update inventory totals
    UPDATE inventory 
    SET total_quantity = total_quantity - p_quantity,
        last_updated = NOW()
    WHERE variant_id = p_variant_id;
    
    -- Recalculate average COGS based on remaining stock
    UPDATE inventory 
    SET average_cogs = (
        SELECT COALESCE(
            SUM(remaining_quantity * unit_cogs) / NULLIF(SUM(remaining_quantity), 0), 
            0
        )
        FROM purchase_batches 
        WHERE variant_id = p_variant_id AND remaining_quantity > 0
    )
    WHERE variant_id = p_variant_id;
    
    RETURN total_cogs;
END;
$$ LANGUAGE plpgsql;

-- Function to handle sales with automatic COGS calculation
CREATE OR REPLACE FUNCTION process_sale()
RETURNS TRIGGER AS $$
DECLARE
    calculated_cogs DECIMAL;
    calculated_revenue DECIMAL;
BEGIN
    -- Calculate COGS using FIFO
    calculated_cogs := deduct_stock_fifo(
        NEW.variant_id, 
        NEW.quantity, 
        NEW.id, 
        'Sale: ' || NEW.invoice_number
    );
    
    -- Calculate revenue and profit
    calculated_revenue := NEW.quantity * NEW.selling_price;
    
    -- Update the sale record with calculated values
    NEW.cogs_used := calculated_cogs;
    NEW.profit := calculated_revenue - calculated_cogs;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to add stock (for manual adjustments)
CREATE OR REPLACE FUNCTION add_stock_adjustment(
    p_variant_id UUID,
    p_quantity INTEGER,
    p_unit_cost DECIMAL,
    p_reason TEXT DEFAULT 'Manual stock addition'
) RETURNS VOID AS $$
BEGIN
    -- Create a virtual purchase batch for the adjustment
    INSERT INTO purchase_batches (
        purchase_order_id, variant_id, cny_price, logistics_fee_per_unit, 
        quantity, unit_cogs, remaining_quantity
    ) VALUES (
        NULL, p_variant_id, p_unit_cost, 0, 
        p_quantity, p_unit_cost, p_quantity
    );
    
    -- Update inventory
    INSERT INTO inventory (variant_id, total_quantity, average_cogs, last_updated)
    VALUES (
        p_variant_id,
        p_quantity,
        p_unit_cost,
        NOW()
    )
    ON CONFLICT (variant_id) DO UPDATE SET
        total_quantity = inventory.total_quantity + p_quantity,
        average_cogs = (
            (inventory.total_quantity * inventory.average_cogs) + 
            (p_quantity * p_unit_cost)
        ) / (inventory.total_quantity + p_quantity),
        last_updated = NOW();
    
    -- Create stock movement record
    INSERT INTO stock_movements (
        variant_id, movement_type, quantity, unit_price, reason
    ) VALUES (
        p_variant_id, 'adjustment_in', p_quantity, p_unit_cost, p_reason
    );
END;
$$ LANGUAGE plpgsql;

-- Create triggers for purchase batches
CREATE TRIGGER trigger_calculate_batch_cogs
    BEFORE INSERT ON purchase_batches
    FOR EACH ROW
    EXECUTE FUNCTION calculate_batch_cogs();

CREATE TRIGGER trigger_update_inventory_after_purchase
    AFTER INSERT ON purchase_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_after_purchase();

CREATE TRIGGER trigger_update_purchase_order_totals
    AFTER INSERT OR UPDATE OR DELETE ON purchase_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_order_totals();

-- Create trigger for sales COGS calculation
CREATE TRIGGER trigger_process_sale
    BEFORE INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION process_sale();

-- Create views for easier data access
CREATE VIEW inventory_with_alerts AS
SELECT 
    i.*,
    pv.sku,
    pv.variant,
    pv.size,
    p.name as product_name,
    p.product_url,
    (i.total_quantity <= i.low_stock_threshold) as is_low_stock,
    COALESCE(
        (SELECT SUM(remaining_quantity) 
         FROM purchase_batches pb 
         WHERE pb.variant_id = i.variant_id AND pb.remaining_quantity > 0), 
        0
    ) as available_stock
FROM inventory i
JOIN product_variants pv ON i.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE pv.is_active = true;

-- Create view for stock by batches
CREATE VIEW stock_by_batches AS
SELECT 
    pb.id as batch_id,
    pb.purchase_order_id,
    po.order_number,
    po.supplier,
    pv.sku,
    pv.variant,
    pv.size,
    p.name as product_name,
    pb.quantity as original_quantity,
    pb.remaining_quantity,
    pb.unit_cogs,
    pb.created_at as purchase_date,
    (pb.remaining_quantity * pb.unit_cogs) as batch_value
FROM purchase_batches pb
JOIN product_variants pv ON pb.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
LEFT JOIN purchase_orders po ON pb.purchase_order_id = po.id
WHERE pb.remaining_quantity > 0
ORDER BY pb.created_at ASC;

-- Create view for financial summary
CREATE VIEW financial_summary AS
SELECT 
    'revenue' as type,
    SUM(total_revenue) as amount,
    DATE_TRUNC('month', sale_date) as period
FROM sales
GROUP BY DATE_TRUNC('month', sale_date)
UNION ALL
SELECT 
    'cogs' as type,
    SUM(cogs_used) as amount,
    DATE_TRUNC('month', sale_date) as period
FROM sales
GROUP BY DATE_TRUNC('month', sale_date)
UNION ALL
SELECT 
    'expenses' as type,
    SUM(amount) as amount,
    DATE_TRUNC('month', expense_date) as period
FROM expenses
GROUP BY DATE_TRUNC('month', expense_date)
UNION ALL
SELECT 
    'adjustments' as type,
    SUM(amount) as amount,
    DATE_TRUNC('month', adjustment_date) as period
FROM balance_adjustments
GROUP BY DATE_TRUNC('month', adjustment_date);

-- Create view for profit analysis
CREATE VIEW profit_analysis AS
SELECT 
    s.id,
    s.invoice_number,
    s.marketplace,
    s.sale_date,
    pv.sku,
    pv.variant,
    pv.size,
    p.name as product_name,
    s.quantity,
    s.selling_price,
    s.total_revenue,
    s.cogs_used,
    s.profit,
    CASE 
        WHEN s.total_revenue > 0 THEN (s.profit / s.total_revenue) * 100 
        ELSE 0 
    END as profit_margin_percent
FROM sales s
JOIN product_variants pv ON s.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
ORDER BY s.sale_date DESC;