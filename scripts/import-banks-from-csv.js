/**
 * Import Banks from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS:
 *   SELECT [BankId],[Description],[AccountNo],[Branch],
 *          [COAID],[AccountTitle],[AccountType],[OpeningDate]
 *   FROM [ERP_D209_2020].[COA].[Bank]
 *
 * Step 2: Save as: data/banks_export.csv  (with headers)
 * Step 3: Run:     node scripts/import-banks-from-csv.js
 *
 * CSV columns (positional, 0-indexed):
 *   0=BankId  1=Description  2=AccountNo  3=Branch
 *   4=COAID   5=AccountTitle 6=AccountType 7=OpeningDate
 */

const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'banks_export.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS banks (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  bank_id        VARCHAR(20),
  bank_name      VARCHAR(200),
  account_no     VARCHAR(100),
  branch         VARCHAR(100),
  coa_id         VARCHAR(50),
  account_title  VARCHAR(200),
  account_type   VARCHAR(50),
  opening_date   DATE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bank_id (bank_id)
) ENGINE=InnoDB;
`;

/* ── CSV parser ─────────────────────────────────────── */
function parseRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"')          { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else                    { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function toDate(v) {
  if (!v || String(v).trim() === '' || /^null$/i.test(String(v).trim())) return null;
  const d = String(v).trim().split(' ')[0];  // strip time part
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function clean(v) {
  return String(v || '').replace(/^"|"$/g, '').trim();
}

/* ── Main ───────────────────────────────────────────── */
async function importBanks() {
  let conn;
  try {
    console.log('==============================================');
    console.log('  Banks Import: CSV → MySQL');
    console.log('==============================================\n');

    // 1. Check CSV exists
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(
        `CSV not found: ${CSV_PATH}\n` +
        `Please run SSMS query, save result as banks_export.csv\n` +
        `and place it in the data/ folder.`
      );
    }
    console.log('1. Found CSV: banks_export.csv\n');

    // 2. Parse CSV
    console.log('2. Parsing CSV...');
    const lines = fs.readFileSync(CSV_PATH, 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim());

    // Detect header row
    const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
    const hasHeader = /bankid|description|account/i.test(firstCell);
    console.log(`   ${hasHeader ? 'Header detected — skipping row 1.' : 'No header — positional mapping.'}`);

    const dataRows = (hasHeader ? lines.slice(1) : lines)
      .map(l => parseRow(l))
      .filter(r => r.length >= 1 && r[0].trim());

    console.log(`   ${dataRows.length} rows to import\n`);

    // 3. Connect to MySQL
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
    const [colRows] = await conn.execute('DESCRIBE banks');
    const cols = colRows.map(c => c.Field);
    console.log(`   Columns: ${cols.join(', ')}`);
    console.log('   ✓ Schema OK\n');

    // 5. Import rows
    console.log('5. Importing rows...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
      try {
        const bank_id       = clean(row[0]);
        const bank_name     = clean(row[1]);
        const account_no    = clean(row[2]);
        const branch        = clean(row[3]);
        const coa_id        = clean(row[4]);
        const account_title = clean(row[5]);
        const account_type  = clean(row[6]);
        const opening_date  = toDate(row[7]);

        if (!bank_id) { skipped++; continue; }

        // Skip duplicate bank_id if already exists
        const [ex] = await conn.execute(
          'SELECT id FROM banks WHERE bank_id = ?', [bank_id]
        );
        if (ex.length) { skipped++; continue; }

        await conn.execute(
          `INSERT INTO banks
             (bank_id, bank_name, account_no, branch, coa_id,
              account_title, account_type, opening_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [bank_id, bank_name, account_no, branch, coa_id,
           account_title, account_type, opening_date]
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

importBanks()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
