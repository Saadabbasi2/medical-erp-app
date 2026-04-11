# MySQL Database Access Guide

## Quick Access Commands

### Connect to MySQL:
```bash
mysql -u root -p
# Enter your password when prompted (or press Enter if no password)
```

### View All Databases:
```sql
SHOW DATABASES;
```

### Use Your Database:
```sql
USE medical_erp;
```

### View All Tables:
```sql
SHOW TABLES;
```

### View Table Structure:
```sql
DESCRIBE companies;
DESCRIBE customers;
DESCRIBE users;
-- etc.
```

### Count Records in Tables:
```sql
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM warehouse_bins;
```

### View Sample Data:
```sql
-- View first 10 companies
SELECT * FROM companies LIMIT 10;

-- View all users
SELECT * FROM users;

-- View warehouse bins with expiry dates
SELECT * FROM warehouse_bins ORDER BY expiry_date ASC LIMIT 20;

-- View stock adjustments
SELECT * FROM stock_adjustments ORDER BY created_at DESC LIMIT 10;
```

### Check Database Size:
```sql
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'medical_erp'
ORDER BY (data_length + index_length) DESC;
```

### View All Tables with Row Counts:
```sql
SELECT 
    table_name,
    table_rows
FROM information_schema.tables
WHERE table_schema = 'medical_erp'
ORDER BY table_name;
```

## Priority-wise Table List

### Priority 1 (Core Business):
- companies
- products
- customers
- salesmen
- sales_reports
- bookings
- controlled_invoices
- open_invoices
- sales_returns

### Priority 2 (Sales & Distribution):
- distributor_bookings
- distributor_invoices
- distributor_returns
- distributor_payments
- distributor_reports

### Priority 3 (Auth & Users):
- users
- role_access
- role_access_history
- user_groups

### Priority 4 (Financial - 19 tables):
- chart_of_accounts
- voucher_types
- bank_cash_currency
- bank_deposits
- bank_payments
- bank_reconcile
- cheque_books
- cheque_entries
- cheque_conversions
- customer_payments
- customer_receipts
- vendor_payments
- vendor_ap
- vendor_credit_notes
- debit_credit
- vouchers
- tax_masters
- tax_adjustments

### Priority 5 (Inventory - 10 tables):
- item_master
- inventory
- warehouse_bins
- fefo_management
- stock_adjustments
- store_expiry
- market_expiry
- regenerate_expiry
- costing_valuation
- costing_center

## Useful Queries

### Check which tables have data:
```sql
SELECT 
    table_name,
    table_rows,
    CASE 
        WHEN table_rows > 0 THEN '✅ Has Data'
        ELSE '⚠️ Empty'
    END as status
FROM information_schema.tables
WHERE table_schema = 'medical_erp'
ORDER BY table_rows DESC;
```

### View recent activity:
```sql
-- Recent stock adjustments
SELECT * FROM stock_adjustments 
ORDER BY created_at DESC LIMIT 10;

-- Recent warehouse entries
SELECT * FROM warehouse_bins 
ORDER BY created_at DESC LIMIT 10;

-- Recent invoices
SELECT * FROM open_invoices 
ORDER BY created_at DESC LIMIT 10;
```

### Check indexes:
```sql
SHOW INDEX FROM companies;
SHOW INDEX FROM warehouse_bins;
SHOW INDEX FROM stock_adjustments;
```
