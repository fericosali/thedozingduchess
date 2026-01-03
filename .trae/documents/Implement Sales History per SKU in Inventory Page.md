I will implement the **Sales History per SKU** feature.

**1. Component Structure:**

* I will add a `SalesHistoryDialog` component inside `Inventory.tsx`.

* This dialog will show a table with columns: Date, Invoice #, Marketplace, Quantity, Revenue, Profit.

**2. Data Fetching:**

* When the user clicks the "Sales History" button (History icon) for a specific SKU:

* I will query the `sales` table (or `profit_analysis` view if better suited) filtered by the `variant_id` of the selected item.

* The query will look like: `supabase.from('sales').select('*').eq('variant_id', selectedVariantId).order('sale_date', { ascending: false })`.

**3. UI Updates:**

* Add a `History` icon button to the "Actions" column in the Inventory table.

* Clicking it sets the `selectedHistoryItem` state and opens the dialog.

* The dialog will display a loading state while fetching, then the sales list.

**4. Verification:**

* I will verify that clicking the history button shows the correct list of past sales for that specific product variant.

