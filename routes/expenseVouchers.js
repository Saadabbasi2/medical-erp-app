// routes/expenseVouchers.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [vouchers] = await pool.query('SELECT * FROM expense_vouchers ORDER BY created_at DESC');
    res.json(vouchers);
  } catch (err) {
    console.error('Get expense vouchers error:', err);
    res.status(500).json({ error: 'Failed to get vouchers' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { voucherNo, employeeId, employeeName, expenseType, amount, date, description, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO expense_vouchers (voucher_no, employee_id, employee_name, expense_type, amount, date, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [voucherNo || '', employeeId || null, employeeName || '', expenseType || '', amount || 0, date || null, description || '', status || 'Draft']);

    const [newVoucher] = await pool.query('SELECT * FROM expense_vouchers WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newVoucher[0] });
  } catch (err) {
    console.error('Create expense voucher error:', err);
    res.status(500).json({ error: 'Failed to create voucher' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM expense_vouchers WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [vouchers] = await pool.query('SELECT * FROM expense_vouchers');

    const formatted = vouchers.map(v => ({
      voucherNo: v.voucher_no || '-',
      employeeName: v.employee_name || '-',
      expenseType: v.expense_type || '-',
      amount: (parseFloat(v.amount) || 0).toFixed(2),
      date: v.date || '-',
      status: v.status || '-'
    }));

    const columns = [
      { label: 'Voucher No', key: 'voucherNo', widthRatio: 0.15 },
      { label: 'Employee', key: 'employeeName', widthRatio: 0.20 },
      { label: 'Type', key: 'expenseType', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Expense Vouchers Report', 'expense_vouchers.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
