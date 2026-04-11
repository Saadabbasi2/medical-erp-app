/**
 * Update DMS Items "Strength" from Company Products Count
 *
 * For each company:
 *   - Count products in `products` table (company_id = companies.id)
 *   - Write that count into `dms_masters.status` for all DMS items
 *     where master_type = 'items' and region = Company ID (padded as 3 digits)
 *
 * Example:
 *   Company ID 1 (Popular Chemical Work) has 51 products
 *   -> all DMS items with region = '001' get status = '51'
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function updateStrengthFromCompanies() {
  let conn;
  try {
    console.log('========================================');
    console.log('  DMS Items Strength Update');
    console.log('========================================\n');

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'medical_erp',
      port: process.env.DB_PORT || 3306
    });
    console.log('✓ Connected to MySQL\n');

    console.log('1) Calculating product counts per company...');
    const [rows] = await conn.execute(`
      SELECT company_id AS companyId, COUNT(*) AS productCount
      FROM products
      GROUP BY company_id
      ORDER BY company_id
    `);
    console.log(`   Found ${rows.length} companies with products.\n`);

    console.log('2) Updating DMS items strength (status)...');
    let updated = 0;
    for (const row of rows) {
      const companyId = row.companyId;
      const count = row.productCount;
      const regionCode = String(companyId).padStart(3, '0'); // e.g. 1 -> "001"

      const [result] = await conn.execute(
        `UPDATE dms_masters
           SET status = ?
         WHERE master_type = 'items' AND region = ?`,
        [String(count), regionCode]
      );
      updated += result.affectedRows;
    }

    console.log(`   ✓ Updated strength for ${updated} DMS items\n`);
    console.log('========================================');
    console.log('  Update completed successfully!');
    console.log('========================================');
  } catch (err) {
    console.error('\n❌ Strength update failed:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

updateStrengthFromCompanies()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

