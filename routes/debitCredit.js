// routes/debitCredit.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM debit_credit ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get debit credit error:', err);
    res.status(500).json({ error: 'Failed to get records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { voucherNo, type, account, amount, date, narration } = req.body;

    const [result] = await pool.query(`
      INSERT INTO debit_credit (voucher_no, type, account, amount, date, narration)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [voucherNo || '', type || '', account || '', amount || 0, date || null, narration || '']);

    const [newRec] = await pool.query('SELECT * FROM debit_credit WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create debit/credit error:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM debit_credit WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM debit_credit');

    const formatted = records.map(r => ({
      voucherNo: r.voucher_no || '-',
      type: r.type || '-',
      account: r.account || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      narration: r.narration || '-'
    }));

    const columns = [
      { label: 'Voucher No', key: 'voucherNo', widthRatio: 0.15 },
      { label: 'Type', key: 'type', widthRatio: 0.10 },
      { label: 'Account', key: 'account', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Narration', key: 'narration', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Debit/Credit Report', 'debit_credit.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
