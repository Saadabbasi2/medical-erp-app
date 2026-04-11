// routes/employeeReceipt.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [receipts] = await pool.query('SELECT * FROM employee_receipts ORDER BY created_at DESC');
    res.json(receipts);
  } catch (err) {
    console.error('Get employee receipts error:', err);
    res.status(500).json({ error: 'Failed to get receipts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { receiptNo, employeeId, employeeName, amount, date, paymentMethod, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO employee_receipts (receipt_no, employee_id, employee_name, amount, date, payment_method, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [receiptNo || '', employeeId || null, employeeName || '', amount || 0, date || null, paymentMethod || '', remarks || '']);

    const [newReceipt] = await pool.query('SELECT * FROM employee_receipts WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReceipt[0] });
  } catch (err) {
    console.error('Create employee receipt error:', err);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM employee_receipts WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [receipts] = await pool.query('SELECT * FROM employee_receipts');

    const formatted = receipts.map(r => ({
      receiptNo: r.receipt_no || '-',
      employeeName: r.employee_name || '-',
      amount: (parseFloat(r.amount) || 0).toFixed(2),
      date: r.date || '-',
      paymentMethod: r.payment_method || '-'
    }));

    const columns = [
      { label: 'Receipt No', key: 'receiptNo', widthRatio: 0.15 },
      { label: 'Employee', key: 'employeeName', widthRatio: 0.25 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.20 },
      { label: 'Payment Method', key: 'paymentMethod', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Employee Receipts Report', 'employee_receipts.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
