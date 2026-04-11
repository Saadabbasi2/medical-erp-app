// routes/expenseClaims.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM expense_claims ORDER BY created_at DESC');
    res.json(claims);
  } catch (err) {
    console.error('Get expense claims error:', err);
    res.status(500).json({ error: 'Failed to get claims' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, expenseType, amount, date, description, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO expense_claims (employee_id, employee_name, expense_type, amount, date, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [employeeId || null, employeeName || '', expenseType || '', amount || 0, date || null, description || '', status || 'Pending']);

    const [newClaim] = await pool.query('SELECT * FROM expense_claims WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newClaim[0] });
  } catch (err) {
    console.error('Create expense claim error:', err);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE expense_claims 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM expense_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM expense_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM expense_claims');

    const formatted = claims.map(c => ({
      employeeName: c.employee_name || '-',
      expenseType: c.expense_type || '-',
      amount: (parseFloat(c.amount) || 0).toFixed(2),
      date: c.date || '-',
      status: c.status || '-'
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.25 },
      { label: 'Type', key: 'expenseType', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.20 },
      { label: 'Status', key: 'status', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Expense Claims Report', 'expense_claims.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
