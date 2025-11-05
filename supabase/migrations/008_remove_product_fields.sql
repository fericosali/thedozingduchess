-- Remove unnecessary fields from products table
-- This migration removes brand and description columns to simplify product management

ALTER TABLE products 
DROP COLUMN IF EXISTS brand,
DROP COLUMN IF EXISTS description;