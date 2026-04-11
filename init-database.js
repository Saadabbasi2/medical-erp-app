// init-database.js - Initialize MySQL Database
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    let connection;

    try {
        console.log('🔄 Initializing MySQL database...\n');

        // Connect to MySQL server (without specifying database)
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        console.log('✅ Connected to MySQL server');

        // Read and execute schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Creating database and tables...');
        await connection.query(schema);

        console.log('✅ Database schema created successfully\n');
        console.log('📊 Database Details:');
        console.log(`   Database: ${process.env.DB_NAME || 'medical_erp'}`);
        console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`   Port: ${process.env.DB_PORT || 3306}`);
        console.log('\n✅ Database initialization complete!');
        console.log('\n⚠️  IMPORTANT: Please change the default admin password immediately');
        console.log('   Default credentials: username=admin, password=admin123\n');

    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        console.error('\nPlease ensure:');
        console.error('  1. MySQL server is running');
        console.error('  2. Credentials in .env file are correct');
        console.error('  3. MySQL user has CREATE DATABASE privileges\n');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run initialization
initializeDatabase();
