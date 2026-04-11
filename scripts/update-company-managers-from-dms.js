/**
 * Update companies.manager from DMS managers (dms_masters)
 *
 * For each DMS manager record (master_type = 'managers'):
 *   - code   = Manager ID      (not used here, kept for reference)
 *   - region = Company ID code (e.g. '001', '046')
 *   - name   = Manager Name
 *
 * We:
 *   - Convert region -> INT companyId (e.g. '001' -> 1, '046' -> 46)
 *   - Set companies.manager = name WHERE companies.id = companyId
 *
 * This makes the manager name appear in 10.0) Company module
 * under the "Company Manager" column.
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function updateCompanyManagersFromDms() {
  let conn;
  try {
    console.log('========================================');
    console.log('  Company Managers Update from DMS');
    console.log('========================================\n');

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medical_erp',
      port: process.env.DB_PORT || 3306
    });
    console.log('✓ Connected to MySQL\n');

    console.log('1) Reading DMS managers (master_type = managers)...');
    const [rows] = await conn.execute(
      "SELECT code AS managerId, region AS companyCode, name AS managerName FROM dms_masters WHERE master_type = 'managers'"
    );
    console.log(`   Found ${rows.length} manager records\n`);

    console.log('2) Updating companies.manager based on companyCode...');
    let updated = 0, skipped = 0;
    for (const row of rows) {
      const companyCode = (row.companyCode || '').trim();
      const managerName = (row.managerName || '').trim();
      if (!companyCode || !managerName) {
        skipped++;
        continue;
      }

      const companyId = parseInt(companyCode, 10);
      if (!companyId || Number.isNaN(companyId)) {
        skipped++;
        continue;
      }

      const [result] = await conn.execute(
        'UPDATE companies SET manager = ? WHERE id = ?',
        [managerName, companyId]
      );
      updated += result.affectedRows;
    }

    console.log(`   ✓ Updated managers for ${updated} companies (skipped ${skipped})\n`);
    console.log('========================================');
    console.log('  Company Managers update completed!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ Company Managers update failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

updateCompanyManagersFromDms()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

