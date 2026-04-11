// routes/customerReceipts.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM customer_receipts ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get customer receipts error:', err);
    res.status(500).json({ error: 'Failed to get receipts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { receiptNo, customerId, customerName, amount, date, method, reference } = req.body;

    const [result] = await pool.query(`
      INSERT INTO customer_receipts (receipt_no, customer_id, customer_name, amount, date, method, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [receiptNo || '', customerId || null, customerName || '', amount || 0, date || null, method || '', reference || '']);

    const [newRec] = await pool.query('SELECT * FROM customer_receipts WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create receipt error:', err);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM customer_receipts WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM customer_receipts');

    const formatted = records.map(r => ({
      receiptNo: r.receipt_no || '-',
      customerName: r.customer_name || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      method: r.method || '-',
      reference: r.reference || '-'
    }));

    const columns = [
      { label: 'Receipt No', key: 'receiptNo', widthRatio: 0.15 },
      { label: 'Customer', key: 'customerName', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Method', key: 'method', widthRatio: 0.15 },
      { label: 'Reference', key: 'reference', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Customer Receipts Report', 'customer_receipts.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
