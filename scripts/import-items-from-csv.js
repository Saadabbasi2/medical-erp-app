/**
 * Import Items (Products) from CSV to Medical ERP MySQL
 *
 * Reads: d:\Medical ERP App\data\items_export.csv
 * Inserts into: medical_erp.products
 *
 * CSV columns (no header):
 *   0: product_id   (ItemId, e.g. 001001)
 *   1: product_name (Description)
 *   2: company_code (CompanyId, e.g. 001 → company_id 1)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'items_export.csv');

async function importItemsFromCSV() {
  let conn;

  try {
    console.log('========================================');
    console.log('  Items Import: CSV → MySQL');
    console.log('========================================\n');

    // 1. Check CSV exists
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error('CSV file not found: ' + CSV_PATH);
    }
    console.log('1. Found CSV file: items_export.csv\n');

    // 2. Read and parse CSV
    console.log('2. Reading CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += c;
      }
      result.push(current.trim());
      return result;
    };

    const rows = [];
    for (const line of lines) {
      const parts = parseRow(line);
      if (parts.length >= 8) rows.push(parts);
    }

    console.log(`   ✓ Found ${rows.length} rows to import\n`);

    // 3. Connect to MySQL
    console.log('3. Connecting to MySQL...');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medical_erp',
      port: process.env.DB_PORT || 3306
    });
    console.log('   ✓ Connected\n');

    // 4. Import
    console.log('4. Importing items...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of rows) {
      try {
        const productId         = (row[0] || '').trim();
        const productName       = (row[1] || '').trim();
        const companyCode       = (row[2] || '').trim();
        const tradePrice        = parseFloat(row[3] || 0);
        const purchaseDiscount  = parseFloat(row[4] || 0);
        const salesTax          = parseFloat(row[5] || 0);
        const groupId           = (row[6] || '').trim();
        const itemType          = (row[7] || '').trim();  // new: item type
        if (!productId || !productName || !companyCode) {
          skipped++;
          continue;
        }

        const companyId = parseInt(companyCode, 10);
        if (!companyId || Number.isNaN(companyId)) {
          skipped++;
          continue;
        }

        await conn.execute(
          `INSERT INTO products (
               product_id, product_name, product_type, company_id, group_name,
               trade_price, discount_customer, sales_tax, discount_for_us,
               batch, expiry_date
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, '-', NULL)
             ON DUPLICATE KEY UPDATE
               product_name    = VALUES(product_name),
               company_id      = VALUES(company_id),
               group_name      = VALUES(group_name),
               product_type    = VALUES(product_type),
               trade_price     = VALUES(trade_price),
               sales_tax       = VALUES(sales_tax),
               discount_for_us = VALUES(discount_for_us)`,
          [productId, productName, itemType, companyId, groupId, tradePrice, salesTax, purchaseDiscount]
        );
        imported++;
        if (imported % 200 === 0) process.stdout.write(`   Imported ${imported}...\r`);
      } catch (err) {
        errors++;
        if (errors <= 5) console.error('   Error:', err.message);
      }
    }

    console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}\n`);
    console.log('========================================');
    console.log('  Items import completed successfully!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

importItemsFromCSV()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

