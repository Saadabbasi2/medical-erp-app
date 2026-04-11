// routes/salaryGeneration.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [salaries] = await pool.query('SELECT * FROM salary_generation ORDER BY year DESC, month DESC');
    res.json(salaries);
  } catch (err) {
    console.error('Get salary generation error:', err);
    res.status(500).json({ error: 'Failed to get salaries' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, month, year, basicSalary, allowances, deductions, status } = req.body;

    const basic = parseFloat(basicSalary) || 0;
    const allow = parseFloat(allowances) || 0;
    const deduc = parseFloat(deductions) || 0;
    const netSalary = basic + allow - deduc;

    const [result] = await pool.query(`
      INSERT INTO salary_generation (employee_id, employee_name, month, year, basic_salary, allowances, deductions, net_salary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [employeeId || null, employeeName || '', month || '', year || new Date().getFullYear(), basic, allow, deduc, netSalary, status || 'Generated']);

    const [newSalary] = await pool.query('SELECT * FROM salary_generation WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newSalary[0] });
  } catch (err) {
    console.error('Create salary generation error:', err);
    res.status(500).json({ error: 'Failed to generate salary' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM salary_generation WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [salaries] = await pool.query('SELECT * FROM salary_generation');

    const formatted = salaries.map(s => ({
      employeeName: s.employee_name || '-',
      month: s.month || '-',
      year: s.year || '-',
      basicSalary: (parseFloat(s.basic_salary) || 0).toFixed(2),
      allowances: (parseFloat(s.allowances) || 0).toFixed(2),
      deductions: (parseFloat(s.deductions) || 0).toFixed(2),
      netSalary: (parseFloat(s.net_salary) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.20 },
      { label: 'Month', key: 'month', widthRatio: 0.10 },
      { label: 'Year', key: 'year', widthRatio: 0.10 },
      { label: 'Basic', key: 'basicSalary', widthRatio: 0.15 },
      { label: 'Allowances', key: 'allowances', widthRatio: 0.15 },
      { label: 'Deductions', key: 'deductions', widthRatio: 0.15 },
      { label: 'Net Salary', key: 'netSalary', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Salary Generation Report', 'salary_generation.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
