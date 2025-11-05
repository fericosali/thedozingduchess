-- Recreate missing views that were dropped in migration 010_fix_sku_generation.sql
-- These views are essential for the inventory page and stock management functionality

-- Recreate inventory_with_alerts view
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

-- Recreate stock_by_batches view
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
    pb.logistics_fee_per_unit,
    pb.created_at as purchase_date,
    (pb.remaining_quantity * pb.unit_cogs) as batch_value,
    -- Add allocated logistics fee for better visibility
    (pb.logistics_fee_per_unit * pb.quantity) as allocated_logistics_fee
FROM purchase_batches pb
JOIN product_variants pv ON pb.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
LEFT JOIN purchase_orders po ON pb.purchase_order_id = po.id
WHERE pb.remaining_quantity > 0
ORDER BY pb.created_at ASC;