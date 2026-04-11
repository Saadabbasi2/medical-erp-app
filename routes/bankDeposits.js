// routes/bankDeposits.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_deposits ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get bank deposits error:', err);
    res.status(500).json({ error: 'Failed to get deposits' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { depositNo, bankAccount, amount, date, reference, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO bank_deposits (deposit_no, bank_account, amount, date, reference, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [depositNo || '', bankAccount || '', amount || 0, date || null, reference || '', status || 'Pending']);

    const [newRec] = await pool.query('SELECT * FROM bank_deposits WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create deposit error:', err);
    res.status(500).json({ error: 'Failed to create deposit' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM bank_deposits WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_deposits');

    const formatted = records.map(r => ({
      depositNo: r.deposit_no || '-',
      bankAccount: r.bank_account || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      reference: r.reference || '-',
      status: r.status || '-'
    }));

    const columns = [
      { label: 'Deposit No', key: 'depositNo', widthRatio: 0.15 },
      { label: 'Bank Account', key: 'bankAccount', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Reference', key: 'reference', widthRatio: 0.20 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Bank Deposits Report', 'bank_deposits.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
