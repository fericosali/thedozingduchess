-- Migration: Cleanup Low Stock Feature
-- This migration removes database objects related to the low stock alert threshold feature

-- 1. Drop the view inventory_with_alerts
DROP VIEW IF EXISTS inventory_with_alerts;

-- 2. Drop the index on low_stock_threshold
DROP INDEX IF EXISTS idx_inventory_low_stock;

-- 3. Drop the column low_stock_threshold from inventory table
ALTER TABLE inventory DROP COLUMN IF EXISTS low_stock_threshold;

-- 4. Remove the default threshold setting
DELETE FROM settings WHERE key = 'low_stock_threshold';
