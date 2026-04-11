/**
 * Import Company Groups from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS:
 *   SELECT [GroupId],[Description],[InActive],[CompanyId]
 *   FROM [ERP_D209_2020].[Setup].[Group]
 *
 * Step 2: Save as: data/groups_export.csv  (with headers)
 * Step 3: Run:     node scripts/import-groups-from-csv.js
 *
 * CSV columns (positional, 0-indexed):
 *   0=GroupId  1=Description  2=InActive  3=CompanyId
 */

const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'groups_export.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS company_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  group_id    VARCHAR(50)  NOT NULL,
  description VARCHAR(300),
  inactive    TINYINT(1)   DEFAULT 0,
  company_id  VARCHAR(50),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group_id (group_id),
  INDEX idx_company_id (company_id)
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
  return isNaN(n) ? 0 : n;
}

/* ── Main ────────────────────────────────────────────────────── */
async function importGroups() {
  let conn;
  try {
    console.log('==============================================');
    console.log('  Company Groups Import: CSV → MySQL');
    console.log('==============================================\n');

    // 1. Check CSV
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(
        `CSV not found: ${CSV_PATH}\n` +
        `Run SSMS query, save as groups_export.csv and place in the data/ folder.`
      );
    }
    console.log('1. Found CSV: groups_export.csv\n');

    // 2. Parse CSV
    console.log('2. Parsing CSV...');
    const lines = fs.readFileSync(CSV_PATH, 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim());

    const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
    const hasHeader = /groupid|description|inactive|companyid/i.test(firstCell);
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
    const [colRows] = await conn.execute('DESCRIBE company_groups');
    console.log(`   Columns: ${colRows.map(c => c.Field).join(', ')}`);
    console.log('   ✓ Schema OK\n');

    // 5. Import rows
    console.log('5. Importing rows...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
      try {
        const group_id    = clean(row[0]);
        const description = clean(row[1]);
        const inactive    = toInt(row[2]);
        const company_id  = clean(row[3]);

        if (!group_id) { skipped++; continue; }

        // Skip duplicates
        const [ex] = await conn.execute(
          'SELECT id FROM company_groups WHERE group_id = ?', [group_id]
        );
        if (ex.length) { skipped++; continue; }

        await conn.execute(
          `INSERT INTO company_groups (group_id, description, inactive, company_id)
           VALUES (?, ?, ?, ?)`,
          [group_id, description, inactive, company_id]
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

importGroups()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
