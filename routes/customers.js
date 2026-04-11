// routes/customers.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');

const router = express.Router();

// GET all customers (with pagination and search for performance)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const search = (req.query.q || '').trim();

    const pool = getPool();

    if (search) {
      const like = `%${search.replace(/%/g, '\\%')}%`;
      const [customers] = await pool.query(`
        SELECT id, name, route, address, phone, email, ntn, cnic,
               credit_limit, opening_balance, status,
               created_at, updated_at
        FROM customers
        WHERE name LIKE ? OR ntn LIKE ? OR cnic LIKE ?
        ORDER BY id
        LIMIT ? OFFSET ?
      `, [like, like, like, limit, offset]);
      const [countRow] = await pool.query(
        'SELECT COUNT(*) as total FROM customers WHERE name LIKE ? OR ntn LIKE ? OR cnic LIKE ?',
        [like, like, like]
      );
      return res.json({ customers, total: countRow[0].total });
    }

    const [customers] = await pool.query(`
      SELECT id, name, route, address, phone, email, ntn, cnic,
             credit_limit, opening_balance, status,
             created_at, updated_at
      FROM customers
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [countRow] = await pool.query('SELECT COUNT(*) as total FROM customers');
    res.json({ customers, total: countRow[0].total });
  } catch (err) {
    console.error('Load customers error:', err);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

// GET customers by route (for Sale Booking route selection)
router.get('/by-route', async (req, res) => {
  try {
    const routesParam = (req.query.routes || '').trim();
    if (!routesParam) return res.json([]);

    // Split by comma (for multiple checkbox selections)
    // Also split by slash (for routes like "BATTAL/CHATTAR" -> matches "BATTAL" or "CHATTAR")
    const routes = routesParam.split(',')
      .flatMap(r => r.split('/'))
      .map(r => r.trim())
      .filter(Boolean);

    if (routes.length === 0) return res.json([]);

    const pool = getPool();
    const conditions = routes.map(() => '(route LIKE ?)').join(' OR ');
    const params = routes.flatMap(r => [`%${r}%`]);
    const [rows] = await pool.query(
      `SELECT id, name, route, ntn, cnic, status FROM customers WHERE ${conditions} ORDER BY name LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Customers by route error:', err);
    res.status(500).json([]);
  }
});

// GET customers search (lightweight, for booking/dropdown - returns minimal fields)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const pool = getPool();

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const like = `%${q.replace(/%/g, '\\%')}%`;
    const [rows] = await pool.query(`
      SELECT id, name, route, ntn, cnic, status
      FROM customers
      WHERE name LIKE ? OR ntn LIKE ? OR cnic LIKE ?
      ORDER BY name
      LIMIT ?
    `, [like, like, like, limit]);
    res.json(rows);
  } catch (err) {
    console.error('Customer search error:', err);
    res.status(500).json([]);
  }
});

// GET single customer by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [customers] = await pool.query(`
      SELECT id, name, route, address, phone, email, ntn, cnic,
             credit_limit, opening_balance, status,
             created_at, updated_at
      FROM customers
      WHERE id = ?
    `, [id]);

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customers[0]);
  } catch (err) {
    console.error('Load customer error:', err);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// POST - Create new customer
router.post('/', async (req, res) => {
  try {
    const { name, route, address, phone, email, ntn, cnic, filerStatus, creditLimit, openingBalance } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const pool = getPool();
    const [result] = await pool.query(`
      INSERT INTO customers (name, route, address, phone, email, ntn, cnic, credit_limit, opening_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      route || '',
      address || '',
      phone || '',
      email || '',
      ntn || '',
      cnic || '',
      parseFloat(creditLimit || 0),
      parseFloat(openingBalance || 0),
      'active'
    ]);

    const customerId = result.insertId;

    // Fetch the created customer
    const [newCustomer] = await pool.query(`
      SELECT id, name, route, address, phone, email, ntn, cnic,
             credit_limit, opening_balance, status,
             created_at, updated_at
      FROM customers
      WHERE id = ?
    `, [customerId]);

    res.status(201).json(newCustomer[0]);
  } catch (err) {
    console.error('Add customer error:', err);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// PUT - Update customer
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, route, address, phone, email, ntn, cnic, filerStatus, creditLimit, openingBalance, status } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const pool = getPool();

    const [result] = await pool.query(`
      UPDATE customers
      SET name = ?, route = ?, address = ?, phone = ?, email = ?,
          ntn = ?, cnic = ?,
          credit_limit = ?, opening_balance = ?, status = ?
      WHERE id = ?
    `, [
      name.trim(),
      route || '',
      address || '',
      phone || '',
      email || '',
      ntn || '',
      cnic || '',
      parseFloat(creditLimit || 0),
      parseFloat(openingBalance || 0),
      status || 'active',
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Fetch updated customer
    const [updatedCustomer] = await pool.query(`
      SELECT id, name, route, address, phone, email, ntn, cnic,
             credit_limit, opening_balance, status,
             created_at, updated_at
      FROM customers
      WHERE id = ?
    `, [id]);

    res.json(updatedCustomer[0]);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE - Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM customers WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
