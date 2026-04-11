/**
 * Import Chart of Accounts (COA) from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS:
 *   SELECT [COAId],[OwnId],[Parent],[Description],
 *          [Family],[COALevel],[COAType]
 *   FROM [ERP_D209_2020].[COA].[COA]
 *
 * Step 2: Save as: data/coa_export.csv  (with headers)
 * Step 3: Run:     node scripts/import-coa-from-csv.js
 *
 * CSV columns (positional, 0-indexed):
 *   0=COAId  1=OwnId  2=Parent  3=Description
 *   4=Family 5=COALevel 6=COAType
 */

const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'coa_export.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  coa_id      VARCHAR(50),
  own_id      VARCHAR(20),
  parent      VARCHAR(50),
  description VARCHAR(300),
  family      VARCHAR(200),
  coa_level   INT DEFAULT NULL,
  coa_type    VARCHAR(10),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_coa_id (coa_id),
  INDEX idx_parent (parent)
) ENGINE=InnoDB;
`;

/* ── CSV parser ──────────────────────────────────────────────── */
function parseRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"')           { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else                     { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function clean(v) {
  return String(v || '').replace(/^"|"$/g, '').trim();
}

function toInt(v) {
  const n = parseInt(String(v || '').trim());
  return isNaN(n) ? null : n;
}

/* ── Main ────────────────────────────────────────────────────── */
async function importCOA() {
  let conn;
  try {
    console.log('==============================================');
    console.log('  Chart of Accounts Import: CSV → MySQL');
    console.log('==============================================\n');

    // 1. Check CSV
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(
        `CSV not found: ${CSV_PATH}\n` +
        `Please run SSMS query, save result as coa_export.csv\n` +
        `and place it in the data/ folder.`
      );
    }
    console.log('1. Found CSV: coa_export.csv\n');

    // 2. Parse CSV
    console.log('2. Parsing CSV...');
    const lines = fs.readFileSync(CSV_PATH, 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim());

    // Detect header
    const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
    const hasHeader = /coaid|own|parent|description/i.test(firstCell);
    console.log(`   ${hasHeader ? 'Header detected — skipping row 1.' : 'No header — positional mapping.'}`);

    const dataRows = (hasHeader ? lines.slice(1) : lines)
      .map(l => parseRow(l))
      .filter(r => r.length >= 1 && r[0].trim());

    console.log(`   ${dataRows.length} rows to import\n`);

    // 3. Connect
    console.log('3. Connecting to MySQL...');
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'medical_erp',
      port:     parseInt(process.env.DB_PORT || '3306')
    });
    console.log('   ✓ Connected\n');

    // 4. Create / verify table
    console.log('4. Verifying table schema...');
    await conn.execute(CREATE_TABLE.trim());

    // Drop old columns if they exist (old schema had account_code, account_name etc.)
    const [colRows] = await conn.execute('DESCRIBE chart_of_accounts');
    const cols = colRows.map(c => c.Field);
    console.log(`   Columns: ${cols.join(', ')}`);

    // If old schema detected, migrate it
    if (cols.includes('account_code')) {
      console.log('\n   ⚠️  Old schema detected! Recreating table with correct schema...');
      await conn.execute('DROP TABLE IF EXISTS chart_of_accounts');
      await conn.execute(CREATE_TABLE.trim());
      console.log('   ✓ Table recreated.\n');
    } else {
      console.log('   ✓ Schema OK\n');
    }

    // 5. Import rows
    console.log('5. Importing rows...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
      try {
        const coa_id      = clean(row[0]);
        const own_id      = clean(row[1]);
        const parent      = clean(row[2]);
        const description = clean(row[3]);
        const family      = clean(row[4]);
        const coa_level   = toInt(row[5]);
        const coa_type    = clean(row[6]);

        if (!coa_id) { skipped++; continue; }

        // Skip duplicates
        const [ex] = await conn.execute(
          'SELECT id FROM chart_of_accounts WHERE coa_id = ?', [coa_id]
        );
        if (ex.length) { skipped++; continue; }

        await conn.execute(
          `INSERT INTO chart_of_accounts
             (coa_id, own_id, parent, description, family, coa_level, coa_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [coa_id, own_id, parent, description, family, coa_level, coa_type]
        );

        imported++;
        if (imported % 50 === 0) process.stdout.write(`   Imported ${imported}...\r`);

      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`   ❌ Row error: ${err.message}`);
      }
    }

    console.log(`\n   ✓ Imported : ${imported}`);
    console.log(`   - Skipped  : ${skipped} (duplicates or empty)`);
    console.log(`   - Errors   : ${errors}\n`);
    console.log('==============================================');
    console.log('  Import complete!');
    console.log('==============================================');

  } catch (err) {
    console.error('\n❌ Fatal:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

importCOA()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
