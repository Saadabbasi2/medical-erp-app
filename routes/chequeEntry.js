// routes/chequeEntry.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_entries ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get cheque entries error:', err);
    res.status(500).json({ error: 'Failed to get cheque entries' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { chequeNo, bankAccount, amount, payee, date, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO cheque_entries (cheque_no, bank_account, amount, payee, date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [chequeNo || '', bankAccount || '', amount || 0, payee || '', date || null, status || 'Issued']);

    const [newRec] = await pool.query('SELECT * FROM cheque_entries WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create cheque entry error:', err);
    res.status(500).json({ error: 'Failed to create cheque entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM cheque_entries WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_entries');

    const formatted = records.map(r => ({
      chequeNo: r.cheque_no || '-',
      bankAccount: r.bank_account || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      payee: r.payee || '-',
      date: r.date || '-',
      status: r.status || '-'
    }));

    const columns = [
      { label: 'Cheque No', key: 'chequeNo', widthRatio: 0.15 },
      { label: 'Bank Account', key: 'bankAccount', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Payee', key: 'payee', widthRatio: 0.20 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Cheque Entries Report', 'cheque_entries.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;