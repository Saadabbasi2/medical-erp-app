/**
 * Import Regions from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS:
 *   SELECT [ParentId],[RegionId],[OwnId],[Description],
 *          [Category],[RegionType],[LevelId],[InActive]
 *   FROM [ERP_D209_2020].[Setup].[Region]
 *
 * Step 2: Save as: data/regions_export.csv  (with headers)
 * Step 3: Run:     node scripts/import-regions-from-csv.js
 *
 * CSV columns (positional, 0-indexed):
 *   0=ParentId  1=RegionId  2=OwnId  3=Description
 *   4=Category  5=RegionType  6=LevelId  7=InActive
 */

const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'regions_export.csv');

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS regions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  parent_id   VARCHAR(50),
  region_id   VARCHAR(50)  NOT NULL,
  own_id      VARCHAR(20),
  description VARCHAR(300),
  category    VARCHAR(100),
  region_type VARCHAR(100),
  level_id    INT DEFAULT NULL,
  inactive    TINYINT(1)   DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_region_id (region_id),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB;
`;

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
function clean(v)  { return String(v || '').replace(/^"|"$/g, '').trim(); }
function toInt(v)  { const n = parseInt(String(v||'').trim()); return isNaN(n) ? null : n; }

async function importRegions() {
  let conn;
  try {
    console.log('==============================================');
    console.log('  Regions Import: CSV → MySQL');
    console.log('==============================================\n');

    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV not found: ${CSV_PATH}\nSave SSMS result as regions_export.csv in data/ folder.`);
    }
    console.log('1. Found CSV: regions_export.csv\n');

    console.log('2. Parsing CSV...');
    const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter(l => l.trim());
    const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
    const hasHeader = /parentid|regionid|description|category/i.test(firstCell);
    console.log(`   ${hasHeader ? 'Header detected — skipping row 1.' : 'No header — positional mapping.'}`);

    const dataRows = (hasHeader ? lines.slice(1) : lines)
      .map(l => parseRow(l)).filter(r => r.length >= 2 && r[1].trim());
    console.log(`   ${dataRows.length} rows to import\n`);

    console.log('3. Connecting to MySQL...');
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'medical_erp',
      port:     parseInt(process.env.DB_PORT || '3306')
    });
    console.log('   ✓ Connected\n');

    console.log('4. Verifying table schema...');
    await conn.execute(CREATE_TABLE.trim());
    const [colRows] = await conn.execute('DESCRIBE regions');
    console.log(`   Columns: ${colRows.map(c => c.Field).join(', ')}`);
    console.log('   ✓ Schema OK\n');

    console.log('5. Importing rows...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
      try {
        const parent_id   = clean(row[0]);
        const region_id   = clean(row[1]);
        const own_id      = clean(row[2]);
        const description = clean(row[3]);
        const category    = clean(row[4]);
        const region_type = clean(row[5]);
        const level_id    = toInt(row[6]);
        const inactive    = toInt(row[7]) ?? 0;

        if (!region_id) { skipped++; continue; }

        // Skip duplicates
        const [ex] = await conn.execute('SELECT id FROM regions WHERE region_id = ?', [region_id]);
        if (ex.length) { skipped++; continue; }

        await conn.execute(
          `INSERT INTO regions (parent_id, region_id, own_id, description, category, region_type, level_id, inactive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [parent_id, region_id, own_id, description, category, region_type, level_id, inactive]
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
importRegions().then(() => process.exit(0)).catch(() => process.exit(1));
