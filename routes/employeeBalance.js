// routes/employeeBalance.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [balances] = await pool.query('SELECT * FROM employee_balance ORDER BY created_at DESC');
    res.json(balances);
  } catch (err) {
    console.error('Get employee balance error:', err);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, balanceType, amount, date, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO employee_balance (employee_id, employee_name, balance_type, amount, date, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [employeeId || null, employeeName || '', balanceType || '', amount || 0, date || null, remarks || '']);

    const [newBalance] = await pool.query('SELECT * FROM employee_balance WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newBalance[0] });
  } catch (err) {
    console.error('Create employee balance error:', err);
    res.status(500).json({ error: 'Failed to create balance' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM employee_balance WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [balances] = await pool.query('SELECT * FROM employee_balance');

    const formatted = balances.map(b => ({
      employeeName: b.employee_name || '-',
      balanceType: b.balance_type || '-',
      amount: (parseFloat(b.amount) || 0).toFixed(2),
      date: b.date || '-',
      remarks: b.remarks || '-'
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.25 },
      { label: 'Type', key: 'balanceType', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.20 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Employee Balance Report', 'employee_balance.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
