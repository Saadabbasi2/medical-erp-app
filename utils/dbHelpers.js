// utils/dbHelpers.js - MySQL Database Helper Functions
const { getPool } = require('../db-mysql');

/**
 * Generic function to get all records from a table
 * @param {string} tableName - Name of the table
 * @param {string} orderBy - Column to order by (default: 'id')
 * @returns {Promise<Array>} Array of records
 */
async function getAll(tableName, orderBy = 'id') {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM ?? ORDER BY ??`, [tableName, orderBy]);
    return rows;
}

/**
 * Generic function to get a single record by ID
 * @param {string} tableName - Name of the table
 * @param {number} id - Record ID
 * @returns {Promise<Object|null>} Record or null if not found
 */
async function getById(tableName, id) {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM ?? WHERE id = ?`, [tableName, id]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Generic function to create a new record
 * @param {string} tableName - Name of the table
 * @param {Object} data - Data to insert
 * @returns {Promise<Object>} Created record
 */
async function create(tableName, data) {
    const pool = getPool();
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const [result] = await pool.query(
        `INSERT INTO ?? (${columns.join(', ')}) VALUES (${placeholders})`,
        [tableName, ...values]
    );

    return await getById(tableName, result.insertId);
}

/**
 * Generic function to update a record
 * @param {string} tableName - Name of the table
 * @param {number} id - Record ID
 * @param {Object} data - Data to update
 * @returns {Promise<Object|null>} Updated record or null if not found
 */
async function update(tableName, id, data) {
    const pool = getPool();
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');

    const [result] = await pool.query(
        `UPDATE ?? SET ${setClause} WHERE id = ?`,
        [tableName, ...values, id]
    );

    if (result.affectedRows === 0) {
        return null;
    }

    return await getById(tableName, id);
}

/**
 * Generic function to delete a record
 * @param {string} tableName - Name of the table
 * @param {number} id - Record ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteById(tableName, id) {
    const pool = getPool();
    const [result] = await pool.query(`DELETE FROM ?? WHERE id = ?`, [tableName, id]);
    return result.affectedRows > 0;
}

/**
 * Execute a custom query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
    const pool = getPool();
    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    deleteById,
    query
};
