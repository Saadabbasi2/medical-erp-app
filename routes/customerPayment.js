// routes/customerPayment.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM customer_payments ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get customer payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { paymentNo, customerId, customerName, amount, date, method, reference } = req.body;

    const [result] = await pool.query(`
      INSERT INTO customer_payments (payment_no, customer_id, customer_name, amount, date, method, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [paymentNo || '', customerId || null, customerName || '', amount || 0, date || null, method || '', reference || '']);

    const [newRec] = await pool.query('SELECT * FROM customer_payments WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM customer_payments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM customer_payments');

    const formatted = records.map(r => ({
      paymentNo: r.payment_no || '-',
      customerName: r.customer_name || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      method: r.method || '-',
      reference: r.reference || '-'
    }));

    const columns = [
      { label: 'Payment No', key: 'paymentNo', widthRatio: 0.15 },
      { label: 'Customer', key: 'customerName', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Method', key: 'method', widthRatio: 0.15 },
      { label: 'Reference', key: 'reference', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Customer Payments Report', 'customer_payments.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
