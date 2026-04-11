/**
 * Import Companies from CSV to Medical ERP MySQL
 *
 * Reads: d:\Medical ERP App\data\companies_export.csv
 * Inserts into: medical_erp.companies
 *
 * CSV columns (no header):
 *   0: id   (CompanyId, e.g. 001)
 *   1: name (Description)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'companies_export.csv');

async function importCompaniesFromCSV() {
  let conn;

  try {
    console.log('========================================');
    console.log('  Company Import: CSV → MySQL');
    console.log('========================================\n');

    // 1. Check CSV exists
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error('CSV file not found: ' + CSV_PATH);
    }
    console.log('1. Found CSV file: companies_export.csv\n');

    // 2. Read and parse CSV
    console.log('2. Reading CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    // Simple CSV parser with quote support
    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rows = [];
    for (const line of lines) {
      const parts = parseRow(line);
      if (parts.length >= 2) rows.push(parts);
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
    console.log('4. Importing companies...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of rows) {
      try {
        const rawId = (row[0] || '').trim();
        const id = rawId ? parseInt(rawId, 10) : null;
        const name = (row[1] || '').trim();
        if (!name) {
          skipped++;
          continue;
        }

        await conn.execute(
          `INSERT INTO companies (id, name, address, policies, manager, spos, areas)
           VALUES (?, ?, '', '', '', '', '')
           ON DUPLICATE KEY UPDATE
             name = VALUES(name)`,
          [id, name]
        );
        imported++;
        if (imported % 200 === 0) process.stdout.write(`   Imported ${imported}...\r`);
      } catch (err) {
        errors++;
        if (errors <= 5) console.error('   Error:', err.message);
      }
    }

    // 5. Fix AUTO_INCREMENT
    const [r] = await conn.execute('SELECT MAX(id) as mx FROM companies');
    const nextId = (r[0].mx || 0) + 1;
    await conn.query(`ALTER TABLE companies AUTO_INCREMENT = ${nextId}`);

    console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}\n`);
    console.log('========================================');
    console.log('  Company import completed successfully!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

importCompaniesFromCSV()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

