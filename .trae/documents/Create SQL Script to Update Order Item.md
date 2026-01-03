I will implement the "Revert Invoice" feature in both the database and the UI, allowing you to undo a sale directly from the Sales menu.

### Plan
1.  **Backend (Database Migration)**
    -   Create `supabase/migrations/026_add_revert_invoice_function.sql`.
    -   Define the `revert_invoice(p_invoice_number)` function to safely restore stock, recalculate inventory, and delete the invoice records.
    -   Grant necessary permissions for the UI to call this function.

2.  **Frontend (Sales Page)**
    -   Modify `src/pages/Sales.tsx`.
    -   Add a **Revert/Undo button** (using an appropriate icon like `Undo` or `Delete`) to the "Actions" column in the Invoices table.
    -   Implement the `handleRevertInvoice` function to:
        -   Show a confirmation dialog ("Are you sure you want to revert this invoice?").
        -   Call the `revert_invoice` RPC function via Supabase.
        -   Show a success message and refresh the sales list automatically.

This ensures you can fix the mistake on Order `218812947255645` and any future errors directly from the app interface.
