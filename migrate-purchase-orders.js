// migrate-purchase-orders.js
// Adds missing columns to purchase_orders table for Pending Orders module

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'medical_erp',
            port: parseInt(process.env.DB_PORT || '3306')
        });
        console.log('Connected to MySQL.');

        // Get existing columns
        const [cols] = await conn.execute('DESCRIBE purchase_orders');
        const existing = cols.map(c => c.Field);
        console.log('Existing columns:', existing.join(', '));

        const toAdd = [
            { name: 'vendor_name', def: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'items', def: 'LONGTEXT DEFAULT NULL' },
            { name: 'quantity', def: 'INT DEFAULT NULL' },
            { name: 'batch', def: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'expiry_date', def: 'DATE DEFAULT NULL' }
        ];

        for (const col of toAdd) {
            if (!existing.includes(col.name)) {
                await conn.execute(`ALTER TABLE purchase_orders ADD COLUMN ${col.name} ${col.def}`);
                console.log(`✓ Added column: ${col.name}`);
            } else {
                console.log(`- Already exists: ${col.name}`);
            }
        }

        // Verify
        const [final] = await conn.execute('DESCRIBE purchase_orders');
        console.log('\nFinal columns:', final.map(c => c.Field).join(', '));
        console.log('\n✅ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
