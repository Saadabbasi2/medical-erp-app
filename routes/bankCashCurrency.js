// routes/bankCashCurrency.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_cash_currency ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get bank cash currency error:', err);
    res.status(500).json({ error: 'Failed to get records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { type, name, accountNo, currency, rate, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO bank_cash_currency (type, name, account_no, currency, rate, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [type || '', name || '', accountNo || '', currency || '', rate || 1.0, remarks || '']);

    const [newRec] = await pool.query('SELECT * FROM bank_cash_currency WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create bank cash currency error:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM bank_cash_currency WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_cash_currency');

    const formatted = records.map(r => ({
      type: r.type || '-',
      name: r.name || '-',
      accountNo: r.account_no || '-',
      currency: r.currency || '-',
      rate: r.rate || '1.0',
      remarks: r.remarks || '-'
    }));

    const columns = [
      { label: 'Type', key: 'type', widthRatio: 0.15 },
      { label: 'Name', key: 'name', widthRatio: 0.20 },
      { label: 'Account No.', key: 'accountNo', widthRatio: 0.15 },
      { label: 'Currency', key: 'currency', widthRatio: 0.15 },
      { label: 'Exchange Rate', key: 'rate', widthRatio: 0.15 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Bank / Cash & Currency Report', 'bank_cash_currency.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
