-- Diagnostic: Show current data types for money-related columns
-- Run this first to verify which columns are integers vs already numeric
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('products', 'invoices', 'invoice_payments', 'customers', 'suppliers')
  AND c.column_name IN (
    'purchase_price', 'sale_price',           -- products
    'unit_price', 'total', 'paid_amount', 'balance',  -- invoices
    'amount',                                  -- invoice_payments
    'credit_balance'                          -- customers, suppliers
  )
ORDER BY c.table_name, c.column_name;
