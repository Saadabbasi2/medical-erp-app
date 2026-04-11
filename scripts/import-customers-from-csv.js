/**
 * Import Customers from CSV to Medical ERP MySQL
 * 
 * Reads: d:\Medical ERP App\data\customers_export.csv
 * Inserts into: medical_erp.customers
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'customers_export.csv');

async function importFromCSV() {
    let conn;

    try {
        console.log('========================================');
        console.log('  Customer Import: CSV → MySQL');
        console.log('========================================\n');

        // 1. Check CSV exists
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error('CSV file not found: ' + CSV_PATH);
        }
        console.log('1. Found CSV file: customers_export.csv\n');

        // 2. Read and parse CSV
        console.log('2. Reading CSV...');
        const content = fs.readFileSync(CSV_PATH, 'utf8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        let imported = 0, skipped = 0, errors = 0;

        // Parse CSV (simple - handle quoted fields if any)
        const parseRow = (line) => {
            const result = [];
            let current = '', inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') inQuotes = !inQuotes;
                else if ((c === ',' && !inQuotes)) { result.push(current.trim()); current = ''; }
                else current += c;
            }
            result.push(current.trim());
            return result;
        };

        const rows = [];
        for (let i = 0; i < lines.length; i++) {
            const parts = parseRow(lines[i]);
            if (parts.length >= 4) rows.push(parts);
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

        // 4. Add ntn, cnic columns if missing
        console.log('4. Ensuring customers table has ntn, cnic columns...');
        try { await conn.query('ALTER TABLE customers ADD COLUMN ntn VARCHAR(100)'); } catch (_) {}
        try { await conn.query('ALTER TABLE customers ADD COLUMN cnic VARCHAR(100)'); } catch (_) {}
        console.log('   ✓ Done\n');

        // 5. Import
        console.log('5. Importing customers...');
        for (const row of rows) {
            try {
                const id = row[0];
                const name = (row[1] || '').trim();
                if (!name) { skipped++; continue; }

                const route = (row[2] || '').trim();
                const status = (row[3] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
                const ntn = (row[4] || '').trim() || null;
                const cnic = (row[5] || '').trim() || null;

                await conn.execute(
                    `INSERT INTO customers (id, name, route, status, ntn, cnic, address, phone, email, credit_limit, opening_balance)
                     VALUES (?, ?, ?, ?, ?, ?, '', '', '', 0, 0)
                     ON DUPLICATE KEY UPDATE 
                        name = VALUES(name), route = VALUES(route), status = VALUES(status), 
                        ntn = VALUES(ntn), cnic = VALUES(cnic)`,
                    [id, name, route, status, ntn, cnic]
                );
                imported++;
                if (imported % 500 === 0) process.stdout.write(`   Imported ${imported}...\r`);
            } catch (err) {
                errors++;
                if (errors <= 3) console.error(`   Error:`, err.message);
            }
        }

        // Update auto-increment
        const [r] = await conn.execute('SELECT MAX(id) as mx FROM customers');
        const nextId = (r[0].mx || 0) + 1;
        await conn.query(`ALTER TABLE customers AUTO_INCREMENT = ${nextId}`);

        console.log(`\n   ✓ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}\n`);
        console.log('========================================');
        console.log('  Import completed successfully!');
        console.log('========================================');

    } catch (err) {
        console.error('\n❌ Import failed:', err.message);
        throw err;
    } finally {
        if (conn) await conn.end();
    }
}

importFromCSV()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
