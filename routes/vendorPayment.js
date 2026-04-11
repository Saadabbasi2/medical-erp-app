// routes/vendorPayment.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_payments ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get vendor payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { paymentNo, vendorId, vendorName, amount, date, method, reference } = req.body;

    const [result] = await pool.query(`
      INSERT INTO vendor_payments (payment_no, vendor_id, vendor_name, amount, date, method, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [paymentNo || '', vendorId || null, vendorName || '', amount || 0, date || null, method || '', reference || '']);

    const [newRec] = await pool.query('SELECT * FROM vendor_payments WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM vendor_payments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_payments');

    const formatted = records.map(r => ({
      paymentNo: r.payment_no || '-',
      vendorName: r.vendor_name || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      method: r.method || '-',
      reference: r.reference || '-'
    }));

    const columns = [
      { label: 'Payment No', key: 'paymentNo', widthRatio: 0.15 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Method', key: 'method', widthRatio: 0.15 },
      { label: 'Reference', key: 'reference', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Vendor Payments Report', 'vendor_payments.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
