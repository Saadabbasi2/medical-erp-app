// routes/smsOrders.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [orders] = await pool.query('SELECT * FROM sms_orders ORDER BY created_at DESC');
    res.json(orders);
  } catch (err) {
    console.error('Get SMS orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { orderNo, customerId, customerName, phone, message, orderDate, totalAmount, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO sms_orders (order_no, customer_id, customer_name, phone, message, order_date, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNo || `SMS-${Date.now()}`,
      customerId || null,
      customerName || '',
      phone || '',
      message || '',
      orderDate || new Date().toISOString().split('T')[0],
      totalAmount || 0,
      status || 'Pending'
    ]);

    const [newOrder] = await pool.query('SELECT * FROM sms_orders WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newOrder[0] });
  } catch (err) {
    console.error('Create SMS order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM sms_orders WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [orders] = await pool.query('SELECT * FROM sms_orders');

    const formatted = orders.map(o => ({
      orderNo: o.order_no || '-',
      customerName: o.customer_name || '-',
      phone: o.phone || '-',
      orderDate: o.order_date || '-',
      totalAmount: (parseFloat(o.total_amount) || 0).toFixed(2),
      status: o.status || '-'
    }));

    const columns = [
      { label: 'Order No', key: 'orderNo', widthRatio: 0.15 },
      { label: 'Customer', key: 'customerName', widthRatio: 0.25 },
      { label: 'Phone', key: 'phone', widthRatio: 0.15 },
      { label: 'Date', key: 'orderDate', widthRatio: 0.15 },
      { label: 'Amount', key: 'totalAmount', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'SMS Orders', 'sms_orders.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
