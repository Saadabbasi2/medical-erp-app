/**
 * Import Stock Adjustments from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS, export as CSV (no headers):
 *   SELECT ItemId, BatchNo, Quantity, Rate, ExpiryDate, CostRate AS CostPrice, SalesTax, StoreId
 *   FROM [ERP_D209_2020].[Inventory].[Stock]
 *   WHERE Quantity > 0
 *   ORDER BY ItemId;
 *
 * Step 2: Save as: /var/www/medical-erp/data/stock_adjustments_export.csv
 * Step 3: Run:     node scripts/import-stock-adjustments-from-csv.js
 *
 * Correct schema (from complete_schema.sql):
 *   product, batch, adjustment_type, quantity, reason, notes, date,
 *   status, created_by, rate, cost_price, expiry_date, sales_tax, store
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'stock_adjustments_export.csv');

// Correct CREATE TABLE per complete_schema.sql + extra import columns
const CORRECT_CREATE = `
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    product          VARCHAR(255),
    batch            VARCHAR(100),
    adjustment_type  VARCHAR(50),
    quantity         INT DEFAULT 0,
    reason           TEXT,
    notes            TEXT,
    date             DATE,
    status           VARCHAR(50) DEFAULT 'Pending',
    created_by       VARCHAR(100),
    approved_by      VARCHAR(100),
    approved_at      TIMESTAMP NULL,
    rejected_reason  TEXT,
    sales_tax        DECIMAL(12,4) DEFAULT NULL,
    store            VARCHAR(100) DEFAULT NULL,
    rate             DECIMAL(12,4) DEFAULT NULL,
    cost_price       DECIMAL(12,4) DEFAULT NULL,
    expiry_date      DATE DEFAULT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status  (status),
    INDEX idx_product (product)
) ENGINE=InnoDB;
`;

// CSV parser
function parseRow(line) {
    const result = [];
    let cur = '', inQ = false;
    for (const c of line) {
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += c; }
    }
    result.push(cur.trim());
    return result;
}

function toFloat(v) { const n = parseFloat(String(v || '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function toInt(v) { const n = Math.round(toFloat(v)); return isNaN(n) ? 0 : n; }
function toDate(v) {
    if (!v || String(v).trim() === '' || /^null$/i.test(String(v).trim())) return null;
    const d = String(v).trim().split(' ')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function importFromCSV() {
    let conn;
    try {
        console.log('============================================');
        console.log('  Stock Adjustments Import: CSV → MySQL');
        console.log('============================================\n');

        // 1. Check CSV
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error(`CSV not found: ${CSV_PATH}\nExport from SSMS and place in data/ folder.`);
        }
        console.log('1. Found CSV: stock_adjustments_export.csv\n');

        // 2. Parse CSV
        console.log('2. Parsing CSV...');
        const lines = fs.readFileSync(CSV_PATH, 'utf8')
            .split(/\r?\n/)
            .filter(l => l.trim());

        const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
        const hasHeader = isNaN(firstCell) && !/^\d{3,}/.test(firstCell);
        console.log(`   ${hasHeader ? 'Header detected — skipping row 1.' : 'No header — positional mapping.'}`);

        // Column order: 0=ItemId, 1=BatchNo, 2=Quantity, 3=Rate,
        //               4=ExpiryDate, 5=CostPrice, 6=SalesTax, 7=StoreId
        const dataRows = (hasHeader ? lines.slice(1) : lines)
            .map(l => parseRow(l))
            .filter(r => r.length >= 2 && r[0].trim());

        console.log(`   ${dataRows.length} rows to import\n`);

        // 3. Connect
        console.log('3. Connecting to MySQL...');
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'medical_erp',
            port: parseInt(process.env.DB_PORT || '3306')
        });
        console.log('   ✓ Connected\n');

        // 4. Fix table schema if wrong
        console.log('4. Verifying table schema...');
        const [colRows] = await conn.execute('DESCRIBE stock_adjustments');
        const existingCols = colRows.map(c => c.Field);
        console.log(`   Current columns: ${existingCols.join(', ')}`);

        // If table uses wrong schema (missing 'product' column), recreate it
        if (!existingCols.includes('product')) {
            console.log('\n   ⚠️  Wrong schema detected! Recreating table with correct schema...');
            await conn.execute('DROP TABLE IF EXISTS stock_adjustments');
            await conn.execute(CORRECT_CREATE.trim());
            console.log('   ✓ Table recreated with correct schema.');
        } else {
            // Table is correct — just ensure extra import columns exist
            const addCols = [
                ['sales_tax', 'DECIMAL(12,4) DEFAULT NULL'],
                ['store', 'VARCHAR(100) DEFAULT NULL'],
                ['rate', 'DECIMAL(12,4) DEFAULT NULL'],
                ['cost_price', 'DECIMAL(12,4) DEFAULT NULL'],
                ['expiry_date', 'DATE DEFAULT NULL']
            ];
            for (const [col, def] of addCols) {
                if (!existingCols.includes(col)) {
                    await conn.execute(`ALTER TABLE stock_adjustments ADD COLUMN ${col} ${def}`);
                    console.log(`   ✓ Added: ${col}`);
                }
            }
            console.log('   ✓ Schema OK.');
        }
        console.log('');

        // 5. Import
        console.log('5. Importing rows...');
        const today = new Date().toISOString().split('T')[0];
        let imported = 0, skipped = 0, errors = 0;

        for (const row of dataRows) {
            try {
                const product = String(row[0] || '').trim();
                const batch = String(row[1] || '').trim();
                const quantity = toInt(row[2]);
                const rate = toFloat(row[3]);
                const expiryDate = toDate(row[4]);
                const costPrice = toFloat(row[5]);
                const salesTax = toFloat(row[6]);
                const store = String(row[7] || '').trim();

                if (!product) { skipped++; continue; }

                await conn.execute(
                    `INSERT INTO stock_adjustments
             (product, batch, adjustment_type, quantity, reason, notes, date,
              status, created_by, rate, cost_price, expiry_date, sales_tax, store)
           VALUES (?, ?, 'Opening Stock', ?, 'Initial Import', '', ?,
                   'Approved', 'Import', ?, ?, ?, ?, ?)`,
                    [product, batch, quantity, today, rate, costPrice, expiryDate, salesTax, store]
                );

                imported++;
                if (imported % 200 === 0) process.stdout.write(`   Imported ${imported}...\r`);

            } catch (err) {
                errors++;
                if (errors <= 3) console.error(`   ❌ Row error: ${err.message}`);
            }
        }

        console.log(`\n   ✓ Imported : ${imported}`);
        console.log(`   - Skipped  : ${skipped}`);
        console.log(`   - Errors   : ${errors}\n`);
        console.log('============================================');
        console.log('  Import complete!');
        console.log('============================================');

    } catch (err) {
        console.error('\n❌ Fatal:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

importFromCSV()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
