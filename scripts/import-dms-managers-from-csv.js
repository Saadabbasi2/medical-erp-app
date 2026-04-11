/**
 * Import DMS Company Managers from CSV into dms_masters (master_type = 'managers')
 *
 * CSV columns (no header):
 * 0: ManagerId    -> code      (Manager ID)
 * 1: CompanyId    -> region    (Company ID)
 * 2: Description  -> name      (Manager Name)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'dms_managers_export.csv');

async function importDmsManagers() {
  let conn;
  try {
    console.log('========================================');
    console.log('  DMS Managers Import: CSV → dms_masters');
    console.log('========================================\n');

    if (!fs.existsSync(CSV_PATH)) {
      throw new Error('CSV file not found: ' + CSV_PATH);
    }

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
      if (parts.length >= 3) rows.push(parts);
    }
    console.log(`   ✓ ${rows.length} rows parsed\n`);

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medical_erp',
      port: process.env.DB_PORT || 3306
    });
    console.log('   ✓ Connected\n');

    console.log('Clearing existing DMS managers...');
    await conn.execute("DELETE FROM dms_masters WHERE master_type = 'managers'");

    let imported = 0, skipped = 0;
    for (const row of rows) {
      const managerId = (row[0] || '').trim();
      const companyId = (row[1] || '').trim();
      const name      = (row[2] || '').trim();
      if (!managerId || !companyId || !name) { skipped++; continue; }

      await conn.execute(
        `INSERT INTO dms_masters (master_type, code, region, name, status)
         VALUES ('managers', ?, ?, ?, 'Active')`,
        [managerId, companyId, name]
      );
      imported++;
      if (imported % 200 === 0) process.stdout.write(`   Imported ${imported}...\r`);
    }

    console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped}\n`);
    console.log('========================================');
    console.log('  DMS Managers import completed!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ DMS Managers import failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

importDmsManagers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

