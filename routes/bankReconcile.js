// routes/bankReconcile.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_reconcile ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get bank reconcile error:', err);
    res.status(500).json({ error: 'Failed to get reconciliations' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { statementDate, bankBalance, bookBalance, reconciled, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO bank_reconcile (statement_date, bank_balance, book_balance, reconciled, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [statementDate || null, bankBalance || 0, bookBalance || 0, reconciled || false, remarks || '']);

    const [newRec] = await pool.query('SELECT * FROM bank_reconcile WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create reconciliation error:', err);
    res.status(500).json({ error: 'Failed to create reconciliation' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM bank_reconcile WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM bank_reconcile');

    const formatted = records.map(r => ({
      statementDate: r.statement_date || '-',
      bankBalance: r.bank_balance ? parseFloat(r.bank_balance).toFixed(2) : '0.00',
      bookBalance: r.book_balance ? parseFloat(r.book_balance).toFixed(2) : '0.00',
      reconciled: r.reconciled ? 'Yes' : 'No',
      remarks: r.remarks || '-'
    }));

    const columns = [
      { label: 'Statement Date', key: 'statementDate', widthRatio: 0.20 },
      { label: 'Bank Balance', key: 'bankBalance', widthRatio: 0.20 },
      { label: 'Book Balance', key: 'bookBalance', widthRatio: 0.20 },
      { label: 'Reconciled', key: 'reconciled', widthRatio: 0.15 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Bank Reconciliation Report', 'bank_reconcile.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
