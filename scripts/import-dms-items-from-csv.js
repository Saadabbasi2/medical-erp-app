/**
 * Import DMS Items from CSV into dms_masters (master_type = 'items')
 *
 * CSV columns (no header):
 * 0: ItemId          -> code      (ID)
 * 1: Description     -> name      (Name)
 * 2: CompanyId       -> region    (Company ID)
 * 3: PackSize        -> description (Pack Size)
 * 4: Strength        -> status    (Strength)
 * 5: NearExpiryDays  -> territory (Near Expiry Days)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'dms_items_export.csv');

async function importDmsItems() {
  let conn;
  try {
    console.log('========================================');
    console.log('  DMS Items Import: CSV → dms_masters');
    console.log('========================================\n');

    if (!fs.existsSync(CSV_PATH)) {
      throw new Error('CSV file not found: ' + CSV_PATH);
    }

    console.log('1. Reading CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    const parseRow = (line) => {
      const result = [];
      let current = '', inQuotes = false;
      for (let ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += ch;
      }
      result.push(current.trim());
      return result;
    };

    const rows = [];
    for (const line of lines) {
      const parts = parseRow(line);
      if (parts.length >= 6) rows.push(parts);
    }
    console.log(`   ✓ ${rows.length} rows parsed\n`);

    console.log('2. Connecting to MySQL...');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medical_erp',
      port: process.env.DB_PORT || 3306
    });
    console.log('   ✓ Connected\n');

    console.log('3. Clearing existing DMS items...');
    await conn.execute("DELETE FROM dms_masters WHERE master_type = 'items'");

    console.log('4. Importing rows...');
    let imported = 0, skipped = 0;
    for (const row of rows) {
      const itemId         = (row[0] || '').trim();
      const name           = (row[1] || '').trim();
      const companyId      = (row[2] || '').trim();
      const packSize       = (row[3] || '').trim();
      const strength       = (row[4] || '').trim();
      const nearExpiryDays = (row[5] || '').trim();

      if (!itemId || !name) { skipped++; continue; }

      await conn.execute(
        `INSERT INTO dms_masters
           (master_type, code, name, description, region, territory, status)
         VALUES ('items', ?, ?, ?, ?, ?, ?)`,
        [itemId, name, packSize, companyId, nearExpiryDays, strength]
      );
      imported++;
      if (imported % 500 === 0) process.stdout.write(`   Imported ${imported}...\r`);
    }

    console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped}\n`);
    console.log('========================================');
    console.log('  DMS Items import completed!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ DMS Items import failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

importDmsItems()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

