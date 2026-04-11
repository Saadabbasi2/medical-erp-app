# Customer Import Guide: SQL Server → Medical ERP (1.1 Customers List)

This guide explains how to import customer data from your SQL Server backup (`ERP_D209_2020`) into the Medical ERP **1.1 Customers List** module.

---

## What You Need Before Starting

1. **SQL Server** running with the `ERP_D209_2020` database restored
2. **MySQL** running with the `medical_erp` database
3. **Node.js** installed (already in your project)

---

## Step-by-Step Process

### Step 1: Find the Source Table & Column Names in SSMS

1. Open **SQL Server Management Studio**
2. Connect to your server: `(local)\SQLEXPRESS`
3. Expand **Databases** → **ERP_D209_2020** → **Tables**
4. Locate the **Customer** table (often under `Setup` schema: `Setup.Customer`)
5. Run this query to see all columns:

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'Setup' AND TABLE_NAME = 'Customer'
ORDER BY ORDINAL_POSITION;
```

6. **Note down** the exact column names for:
   - Customer ID
   - Customer name (e.g. `Description`)
   - Route / Region (e.g. `RegionId` or region name)
   - NTN (e.g. `NTN`, `TaxNo`, `STRN`)
   - CNIC (e.g. `CNIC`, `NIC`, `NationalId`)
   - Status (if any, e.g. `IsActive`)

---

### Step 2: Edit the Import Script Mapping

Open `scripts/import-customers-from-sqlserver.js` and update:

**A) SQL Server connection** (if not using default):

```javascript
const sqlServerConfig = {
    server: 'localhost\\SQLEXPRESS',   // Your server: e.g. 'DESKTOP-XXX\\SQLEXPRESS'
    database: 'ERP_D209_2020',
    options: { trustedConnection: true, encrypt: false }
};
```

**B) Source table name** (if different):

```javascript
const SOURCE_TABLE = 'Setup.Customer';   // Change if your table is different
```

**C) Column mapping** – use the names from Step 1:

```javascript
const COLUMN_MAP = {
    id: 'CustomerId',      // Your source column for ID
    name: 'Description',   // Your source column for name
    route: 'RegionId',     // Your source column for route
    status: 'IsActive',    // Optional - set to null if column doesn't exist
    ntn: 'NTN',           // Your source column for NTN
    cnic: 'CNIC'          // Your source column for CNIC
};
```

If NTN or CNIC columns don't exist in your source table, set them to `null`:

```javascript
ntn: null,
cnic: null
```

---

### Step 3: Add ntn and cnic to MySQL (if not already there)

Run this in **MySQL** (or the script will try to add them automatically):

```sql
ALTER TABLE customers ADD COLUMN ntn VARCHAR(100);
ALTER TABLE customers ADD COLUMN cnic VARCHAR(100);
```

---

### Step 4: Run the Import

From the project root folder:

```bash
cd "d:\Medical ERP App"
node scripts/import-customers-from-sqlserver.js
```

Or add to `package.json`:

```json
"import-customers": "node scripts/import-customers-from-sqlserver.js"
```

Then run:

```bash
npm run import-customers
```

---

### Step 5: Verify in Medical ERP

1. Start your Medical ERP app
2. Go to **1.1) Customers List**
3. Confirm that imported customers show with correct ID, Name, Route, Status, NTN, CNIC

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **SQL Server login failed** | Check server name, use Windows Auth or set `user`/`password` in config |
| **Column not found** | Run the INFORMATION_SCHEMA query and fix `COLUMN_MAP` |
| **MySQL ntn/cnic error** | Run the ALTER TABLE commands above manually |
| **Duplicate key** | Script uses `ON DUPLICATE KEY UPDATE` – existing rows will be updated |

---

## Alternative: Export to CSV, Then Import

If direct SQL Server connection fails:

1. **In SSMS**: Run your SELECT query, right-click Results → **Save Results As...** → save as `customers_export.csv`
2. Use a separate CSV import script (can be created on request)

---

## Files Modified for This Import

- `scripts/import-customers-from-sqlserver.js` – main import script
- `routes/customers.js` – now reads/writes `ntn` and `cnic`
- `complete_schema.sql` – `customers` table includes `ntn`, `cnic`
