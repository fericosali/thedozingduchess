-- Pajama Inventory Management System - Initial Schema
-- This migration creates all the core tables for the inventory management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create products table (Base Product Information)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_url TEXT UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for products
CREATE INDEX idx_products_url ON products(product_url);
CREATE INDEX idx_products_brand ON products(brand);

-- Create product variants table (Variant + Size Combinations)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant VARCHAR(100) NOT NULL,
    size VARCHAR(20) NOT NULL,
    sku VARCHAR(150) GENERATED ALWAYS AS (variant || '-' || size) STORED,
    color VARCHAR(50),
    weight DECIMAL(8,3),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, variant, size)
);

-- Create indexes for product variants
CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_variant ON product_variants(variant);
CREATE INDEX idx_variants_active ON product_variants(is_active);

-- Create purchase orders table
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier VARCHAR(200) NOT NULL,
    total_logistics_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    exchange_rate DECIMAL(10,4) NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    logistics_fee_per_unit DECIMAL(10,4) GENERATED ALWAYS AS (
        CASE 
            WHEN total_quantity > 0 THEN total_logistics_fee / total_quantity 
            ELSE 0 
        END
    ) STORED,
    order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'completed', 'cancelled')),
    order_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for purchase orders
CREATE INDEX idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(order_status);

-- Create purchase batches table (Each Purchase with Specific Costs)
CREATE TABLE purchase_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    cny_price DECIMAL(10,2) NOT NULL,
    logistics_fee_per_unit DECIMAL(10,4) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cogs DECIMAL(10,2) NOT NULL,
    remaining_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for purchase batches
CREATE INDEX idx_purchase_batches_order_id ON purchase_batches(purchase_order_id);
CREATE INDEX idx_purchase_batches_variant_id ON purchase_batches(variant_id);
CREATE INDEX idx_purchase_batches_remaining ON purchase_batches(remaining_quantity);

-- Create inventory table (Current Stock Summary per Variant)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    average_cogs DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_value DECIMAL(12,2) GENERATED ALWAYS AS (total_quantity * average_cogs) STORED,
    low_stock_threshold INTEGER DEFAULT 5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(variant_id)
);

-- Create indexes for inventory
CREATE INDEX idx_inventory_variant_id ON inventory(variant_id);
CREATE INDEX idx_inventory_quantity ON inventory(total_quantity);
CREATE INDEX idx_inventory_low_stock ON inventory(total_quantity, low_stock_threshold);

-- Create expense categories table
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Insert default expense categories
INSERT INTO expense_categories (name, description) VALUES
('Shipping & Logistics', 'Shipping costs, customs fees, logistics expenses'),
('Marketing & Advertising', 'Social media ads, influencer partnerships, promotional costs'),
('Platform Fees', 'Marketplace fees, payment processing fees'),
('Office & Operations', 'Office supplies, software subscriptions, utilities'),
('Professional Services', 'Legal, accounting, consulting fees'),
('Other', 'Miscellaneous business expenses');

-- Create sales table (Updated for Variant-based Sales)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    marketplace VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price DECIMAL(10,2) NOT NULL,
    total_revenue DECIMAL(12,2) GENERATED ALWAYS AS (quantity * selling_price) STORED,
    cogs_used DECIMAL(12,2) NOT NULL,
    profit DECIMAL(12,2) NOT NULL DEFAULT 0,
    sale_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sales
CREATE INDEX idx_sales_variant_id ON sales(variant_id);
CREATE INDEX idx_sales_marketplace ON sales(marketplace);
CREATE INDEX idx_sales_sale_date ON sales(sale_date DESC);
CREATE INDEX idx_sales_invoice ON sales(invoice_number);

-- Create stock movements table (FIFO Tracking)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES purchase_batches(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment_in', 'adjustment_out')),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for stock movements
CREATE INDEX idx_movements_variant_id ON stock_movements(variant_id);
CREATE INDEX idx_movements_batch_id ON stock_movements(batch_id);
CREATE INDEX idx_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);

-- Create expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for expenses
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date DESC);

-- Create balance adjustments table
CREATE TABLE balance_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('refund', 'capital_injection', 'correction', 'other')),
    reason VARCHAR(200) NOT NULL,
    description TEXT,
    adjustment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for balance adjustments
CREATE INDEX idx_balance_adjustments_date ON balance_adjustments(adjustment_date DESC);
CREATE INDEX idx_balance_adjustments_type ON balance_adjustments(adjustment_type);

-- Create settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
('default_exchange_rate', '7.2', 'Default CNY to USD exchange rate'),
('low_stock_threshold', '5', 'Default low stock threshold for alerts'),
('default_marketplace', 'Amazon', 'Default marketplace for sales'),
('business_name', 'The Dozing Duchess', 'Business name for reports');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();