/**
 * Import Customers from SQL Server (SSMS) to Medical ERP MySQL
 * 
 * SOURCE: SQL Server - ERP_D209_2020 database
 * TARGET: MySQL - medical_erp.customers table
 * 
 * Fields imported: ID, Name, Route, Status, NTN, CNIC
 */

// Use msnodesqlv8 for Windows Authentication (trustedConnection)
const sql = require('mssql/msnodesqlv8');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ============================================================
// STEP 1: CONFIGURE SOURCE (SQL Server)
// ============================================================
const sqlServerConfig = {
    server: 'localhost\\SQLEXPRESS',   // Use (local)\SQLEXPRESS or your server name
    database: 'ERP_D209_2020',
    options: {
        trustedConnection: true,       // Windows Authentication
        enableArithAbort: true,
        encrypt: false
    }
};

// If using SQL Server login instead of Windows Auth, use this:
// const sqlServerConfig = {
//     server: 'localhost\\SQLEXPRESS',
//     database: 'ERP_D209_2020',
//     user: 'your_sql_user',
//     password: 'your_sql_password',
//     options: { encrypt: false }
// };

// ============================================================
// STEP 2: CONFIGURE SOURCE TABLE & COLUMN MAPPING
// ============================================================
const SOURCE_TABLE = 'Setup.Customer';   // Schema.Table - adjust if different

// Map SQL Server column names to our fields
// EDIT THESE if your source table uses different column names!
// Run this in SSMS to see all columns: 
//   SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
//   WHERE TABLE_SCHEMA='Setup' AND TABLE_NAME='Customer'
const COLUMN_MAP = {
    id: 'CustomerId',        // Source: CustomerId
    name: 'Description',     // Source: customer name
    route: 'Address',        // Source: address (used as route in this ERP)
    status: 'InActive',      // Source: InActive (0 = active, 1 = inactive)
    ntn: 'NTNNo',           // Source: NTN
    cnic: 'NICNo'           // Source: CNIC
};

// ============================================================
// STEP 3: MySQL TARGET
// ============================================================
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medical_erp',
    port: process.env.DB_PORT || 3306
};

// ============================================================
// IMPORT LOGIC
// ============================================================
async function importCustomers() {
    let sqlPool, mysqlConn;

    try {
        console.log('========================================');
        console.log('  Customer Import: SQL Server → MySQL');
        console.log('========================================\n');

        // 1. Connect to SQL Server
        console.log('1. Connecting to SQL Server...');
        sqlPool = await sql.connect(sqlServerConfig);
        console.log('   ✓ Connected to', sqlServerConfig.database, '\n');

        // 2. Fetch customers from SQL Server (use SELECT * to handle missing columns)
        const query = `SELECT * FROM ${SOURCE_TABLE}`;
        console.log('2. Fetching data from', SOURCE_TABLE);
        console.log('   Query:', query, '\n');

        const result = await sqlPool.request().query(query);
        const rows = result.recordset;
        console.log(`   ✓ Fetched ${rows.length} customers\n`);

        if (rows.length === 0) {
            console.log('   No data to import. Exiting.');
            return;
        }

        // 3. Connect to MySQL
        console.log('3. Connecting to MySQL...');
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('   ✓ Connected to', mysqlConfig.database, '\n');

        // 4. Ensure ntn and cnic columns exist in customers table
        console.log('4. Ensuring customers table has ntn, cnic columns...');
        try {
            await mysqlConn.query('ALTER TABLE customers ADD COLUMN ntn VARCHAR(100)');
        } catch (_) {}
        try {
            await mysqlConn.query('ALTER TABLE customers ADD COLUMN cnic VARCHAR(100)');
        } catch (_) {}
        console.log('   ✓ Table ready\n');

        // 5. Import data
        console.log('5. Importing customers...');
        let imported = 0, skipped = 0, errors = 0;
        const get = (row, col) => (col && row[col] != null ? String(row[col]).trim() : '');

        for (const row of rows) {
            try {
                const id = row[COLUMN_MAP.id];
                const name = get(row, COLUMN_MAP.name);
                if (!name) {
                    skipped++;
                    continue;
                }

                const route = get(row, COLUMN_MAP.route);
                let status = 'active';
                if (COLUMN_MAP.status && row[COLUMN_MAP.status] != null) {
                    const v = row[COLUMN_MAP.status];
                    // InActive: 1/true = inactive, 0/false = active
                    status = (v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1') ? 'inactive' : 'active';
                }
                const ntn = get(row, COLUMN_MAP.ntn);
                const cnic = get(row, COLUMN_MAP.cnic);

                await mysqlConn.execute(
                    `INSERT INTO customers (id, name, route, status, ntn, cnic, address, phone, email, credit_limit, opening_balance)
                     VALUES (?, ?, ?, ?, ?, ?, '', '', '', 0, 0)
                     ON DUPLICATE KEY UPDATE 
                        name = VALUES(name), 
                        route = VALUES(route), 
                        status = VALUES(status), 
                        ntn = VALUES(ntn), 
                        cnic = VALUES(cnic)`,
                    [id, name, route, status, ntn || null, cnic || null]
                );
                imported++;
                if (imported % 500 === 0) process.stdout.write(`   Imported ${imported}...\r`);
            } catch (err) {
                errors++;
                if (errors <= 5) console.error(`   Error on row:`, err.message);
            }
        }

        console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}\n`);

        // 6. Reset AUTO_INCREMENT if we used source IDs
        const [maxResult] = await mysqlConn.execute('SELECT MAX(id) as mx FROM customers');
        const maxId = maxResult[0].mx || 0;
        await mysqlConn.execute(`ALTER TABLE customers AUTO_INCREMENT = ?`, [maxId + 1]);
        console.log('6. Auto-increment updated for new records.\n');

        console.log('========================================');
        console.log('  Import completed successfully!');
        console.log('========================================');

    } catch (err) {
        console.error('\n❌ Import failed:', err.message);
        if (err.code === 'ELOGIN') {
            console.error('\n   SQL Server login failed. Check:');
            console.error('   - Server name (localhost\\SQLEXPRESS)');
            console.error('   - Windows Auth or SQL user/password');
            console.error('   - SQL Server is running');
        }
        throw err;
    } finally {
        if (sqlPool) await sqlPool.close();
        if (mysqlConn) await mysqlConn.end();
    }
}

// Run
importCustomers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
