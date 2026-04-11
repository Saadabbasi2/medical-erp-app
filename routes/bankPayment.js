// routes/bankPayment.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_payments ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get bank payments error:', err);
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { paymentNo, bankAccount, amount, date, payee, reference } = req.body;

    const [result] = await pool.query(`
      INSERT INTO bank_payments (payment_no, bank_account, amount, date, payee, reference)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [paymentNo || '', bankAccount || '', amount || 0, date || null, payee || '', reference || '']);

    const [newRec] = await pool.query('SELECT * FROM bank_payments WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM bank_payments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_payments');

    const formatted = records.map(r => ({
      paymentNo: r.payment_no || '-',
      bankAccount: r.bank_account || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      payee: r.payee || '-',
      reference: r.reference || '-'
    }));

    const columns = [
      { label: 'Payment No', key: 'paymentNo', widthRatio: 0.15 },
      { label: 'Bank Account', key: 'bankAccount', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Payee', key: 'payee', widthRatio: 0.20 },
      { label: 'Reference', key: 'reference', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Bank Payments Report', 'bank_payments.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
