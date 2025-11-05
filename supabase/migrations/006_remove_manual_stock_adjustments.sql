-- Migration: Remove manual stock adjustment functionality
-- This migration removes the manual stock adjustment functions and related database objects

-- Drop the add_stock_adjustment function
DROP FUNCTION IF EXISTS add_stock_adjustment(UUID, INTEGER, TEXT);

-- Remove adjustment-related movement types from stock_movements check constraint
-- First, let's see what movement types are currently allowed and remove adjustment types
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

-- Recreate the constraint without adjustment types
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
    CHECK (movement_type IN ('purchase', 'sale'));

-- Update any existing adjustment records to have a reason explaining they're legacy
UPDATE stock_movements 
SET reason = COALESCE(reason, '') || ' [LEGACY ADJUSTMENT - NO LONGER SUPPORTED]'
WHERE movement_type IN ('adjustment_in', 'adjustment_out');

-- Update the movement_type for existing adjustment records to 'purchase' or 'sale' based on quantity
UPDATE stock_movements 
SET movement_type = CASE 
    WHEN quantity > 0 THEN 'purchase'
    ELSE 'sale'
END
WHERE movement_type IN ('adjustment_in', 'adjustment_out');

-- Create a comment to document the change
COMMENT ON TABLE stock_movements IS 'Stock movements tracking purchases and sales only. Manual adjustments have been removed for better inventory control.';

-- Update any views that might reference adjustment types
-- The inventory_with_alerts view should still work as it doesn't filter by movement_type

-- Add a note in the settings table about the change
INSERT INTO settings (key, value, description) 
VALUES (
    'manual_stock_adjustments_removed', 
    'true', 
    'Manual stock adjustments have been removed. Stock changes now only occur through purchase orders and sales.'
) ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();