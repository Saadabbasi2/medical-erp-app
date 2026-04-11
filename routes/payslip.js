// routes/payslip.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [payslips] = await pool.query('SELECT * FROM payslips ORDER BY year DESC, month DESC');
    res.json(payslips);
  } catch (err) {
    console.error('Get payslips error:', err);
    res.status(500).json({ error: 'Failed to get payslips' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, month, year, basicSalary, allowances, deductions, paymentDate } = req.body;

    const basic = parseFloat(basicSalary) || 0;
    const allow = parseFloat(allowances) || 0;
    const deduc = parseFloat(deductions) || 0;
    const netSalary = basic + allow - deduc;

    const [result] = await pool.query(`
      INSERT INTO payslips (employee_id, employee_name, month, year, basic_salary, allowances, deductions, net_salary, payment_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [employeeId || null, employeeName || '', month || '', year || new Date().getFullYear(), basic, allow, deduc, netSalary, paymentDate || null]);

    const [newPayslip] = await pool.query('SELECT * FROM payslips WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newPayslip[0] });
  } catch (err) {
    console.error('Create payslip error:', err);
    res.status(500).json({ error: 'Failed to create payslip' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM payslips WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [payslips] = await pool.query('SELECT * FROM payslips');

    const formatted = payslips.map(p => ({
      employeeName: p.employee_name || '-',
      month: p.month || '-',
      year: p.year || '-',
      basicSalary: (parseFloat(p.basic_salary) || 0).toFixed(2),
      netSalary: (parseFloat(p.net_salary) || 0).toFixed(2),
      paymentDate: p.payment_date || '-'
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.25 },
      { label: 'Month', key: 'month', widthRatio: 0.12 },
      { label: 'Year', key: 'year', widthRatio: 0.10 },
      { label: 'Basic', key: 'basicSalary', widthRatio: 0.18 },
      { label: 'Net Salary', key: 'netSalary', widthRatio: 0.18 },
      { label: 'Payment Date', key: 'paymentDate', widthRatio: 0.17 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Payslips Report', 'payslips.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
