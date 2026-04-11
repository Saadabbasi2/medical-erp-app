// routes/salesmanOrders.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');

const router = express.Router();

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// GET orders for a salesman
// /api/salesman-orders?salesmanId=1
router.get('/', async (req, res) => {
  try {
    const salesmanId = parseInt(req.query.salesmanId);
    if (!salesmanId) return res.status(400).json({ error: 'salesmanId is required' });

    const pool = getPool();
    const [rows] = await pool.query(
      `
      SELECT id, salesman_id, customer_id, order_date, total_amount, status, notes, created_at, updated_at
      FROM salesman_orders
      WHERE salesman_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 500
      `,
      [salesmanId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get salesman orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// PATCH update order status
// /api/salesman-orders/:id/status  body: { status: 'delivered'|'not_delivered'|'pending', deliveryDate?: ISO }
router.patch('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    if (!status) return res.status(400).json({ error: 'status required' });

    const pool = getPool();
    await pool.query(
      `UPDATE salesman_orders SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    const [rows] = await pool.query('SELECT * FROM salesman_orders WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    console.error('Update salesman order status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const pool = getPool();
    await pool.query('DELETE FROM salesman_orders WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete salesman order error:', err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// POST create a salesman order (called from ERP on booking save)
router.post('/', async (req, res) => {
  try {
    const {
      salesmanId,
      customerId,
      orderDate,
      totalAmount,
      notes
    } = req.body || {};

    const sid = parseInt(salesmanId);
    if (!sid) return res.status(400).json({ error: 'salesmanId is required' });

    const pool = getPool();
    const [result] = await pool.query(
      `
      INSERT INTO salesman_orders (
        salesman_id, customer_id, order_date, total_amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        sid,
        customerId ? parseInt(customerId) : null,
        orderDate || new Date().toISOString().split('T')[0],
        Number(totalAmount || 0),
        'pending',
        notes || ''
      ]
    );

    const [rows] = await pool.query('SELECT * FROM salesman_orders WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Create salesman order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;

