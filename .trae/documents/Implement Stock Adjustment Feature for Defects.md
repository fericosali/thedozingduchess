I will implement the **Stock Adjustment** feature using the generalized naming convention as requested.

**1. Database Changes (Supabase):**

* Create a new migration `025_add_stock_adjustment.sql`.

* Update `stock_movements` table constraint to allow the movement type: `'manual_adjustment'`.

* Create a new SQL function `handle_manual_adjustment(p_variant_id, p_quantity, p_reason)` that:

  * Iterates through active batches (FIFO) to deduct the quantity.

  * For each batch, it reduces the `remaining_quantity` but **recalculates and increases** the `unit_cogs` to preserve the total batch value.

  * Formula: `New Unit Cost = (Old Quantity * Old Unit Cost) / New Quantity`.

  * Updates the `inventory` table's `total_quantity` and `average_cogs`.

  * Logs the action in `stock_movements` with the type `'manual_adjustment'`.

**2. Frontend Changes (Inventory Page):**

* Add an **"Adjust Stock"** button to the Inventory table (row action).

* Create a `StockAdjustmentDialog` component:

  * **Inputs**:

    * Quantity (number of items to remove).

    * Reason/Notes (e.g., "Defect", "Lost", "Damage").

  * **Logic**: Calls the new Supabase function `handle_manual_adjustment`.

**3. Verification:**

* I will verify that after a manual adjustment:

  * Total Quantity decreases.

  * Total Inventory Value remains unchanged.

  * Average Price/COGS increases.

  * Purchase Order records remain untouched.

