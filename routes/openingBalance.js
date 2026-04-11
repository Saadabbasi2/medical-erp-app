// routes/openingBalance.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [balances] = await pool.query('SELECT * FROM opening_balance ORDER BY created_at DESC');
    res.json(balances);
  } catch (err) {
    console.error('Get opening balances error:', err);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { accountCode, accountName, accountType, openingBalance, balanceType, financialYear } = req.body;

    const [result] = await pool.query(`
      INSERT INTO opening_balance (account_code, account_name, account_type, opening_balance, balance_type, financial_year)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      accountCode || '',
      accountName || '',
      accountType || '',
      openingBalance || 0,
      balanceType || 'Debit',
      financialYear || ''
    ]);

    const [newBalance] = await pool.query('SELECT * FROM opening_balance WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newBalance[0] });
  } catch (err) {
    console.error('Create opening balance error:', err);
    res.status(500).json({ error: 'Failed to create balance' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM opening_balance WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [balances] = await pool.query('SELECT * FROM opening_balance');

    const formatted = balances.map(b => ({
      accountCode: b.account_code || '-',
      accountName: b.account_name || '-',
      accountType: b.account_type || '-',
      openingBalance: (parseFloat(b.opening_balance) || 0).toFixed(2),
      balanceType: b.balance_type || '-',
      financialYear: b.financial_year || '-'
    }));

    const columns = [
      { label: 'Account Code', key: 'accountCode', widthRatio: 0.15 },
      { label: 'Account Name', key: 'accountName', widthRatio: 0.25 },
      { label: 'Type', key: 'accountType', widthRatio: 0.15 },
      { label: 'Opening Balance', key: 'openingBalance', widthRatio: 0.15 },
      { label: 'Dr/Cr', key: 'balanceType', widthRatio: 0.10 },
      { label: 'FY', key: 'financialYear', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Opening Balances', 'opening_balances.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
