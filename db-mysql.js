// db-mysql.js - MySQL Database Connection Module
const mysql = require('mysql2/promise');

let pool;

/**
 * Initialize MySQL connection pool
 * @returns {Promise<Pool>} MySQL connection pool
 */
async function connectDB() {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'medical_erp',
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        // Test connection
        const connection = await pool.getConnection();
        console.log('✅ MySQL connected successfully');
        console.log(`   Database: ${process.env.DB_NAME || 'medical_erp'}`);
        console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
        connection.release();

        return pool;
    } catch (err) {
        console.error('❌ MySQL connection error:', err.message);
        console.error('   Please ensure MySQL is running and credentials are correct');
        process.exit(1);
    }
}

/**
 * Get the MySQL connection pool
 * @returns {Pool} MySQL connection pool
 */
function getPool() {
    if (!pool) {
        throw new Error('Database pool not initialized. Call connectDB() first.');
    }
    return pool;
}

/**
 * Execute a query with automatic error handling
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
    try {
        const pool = getPool();
        const [results] = await pool.query(sql, params);
        return results;
    } catch (err) {
        console.error('Query error:', err.message);
        console.error('SQL:', sql);
        throw err;
    }
}

/**
 * Close the database connection pool
 */
async function closeDB() {
    if (pool) {
        await pool.end();
        console.log('✅ MySQL connection closed');
    }
}

module.exports = {
    connectDB,
    getPool,
    query,
    closeDB
};
