// routes/payrollReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM payroll_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get payroll reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get payroll statistics
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT employee_id) as total_employees,
        SUM(basic_salary) as total_salary,
        SUM(deductions) as total_deductions,
        SUM(allowances) as total_allowances,
        SUM(net_salary) as net_payroll
      FROM salary_generation
    `);

    const [result] = await pool.query(`
      INSERT INTO payroll_reports (report_type, report_period, total_employees, total_salary, total_deductions, total_allowances, net_payroll)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      stats[0].total_employees || 0,
      stats[0].total_salary || 0,
      stats[0].total_deductions || 0,
      stats[0].total_allowances || 0,
      stats[0].net_payroll || 0
    ]);

    const [newReport] = await pool.query('SELECT * FROM payroll_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate payroll report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM payroll_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM payroll_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      employees: r.total_employees || 0,
      salary: (parseFloat(r.total_salary) || 0).toFixed(2),
      deductions: (parseFloat(r.total_deductions) || 0).toFixed(2),
      allowances: (parseFloat(r.total_allowances) || 0).toFixed(2),
      netPayroll: (parseFloat(r.net_payroll) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.15 },
      { label: 'Period', key: 'period', widthRatio: 0.12 },
      { label: 'Employees', key: 'employees', widthRatio: 0.10 },
      { label: 'Salary', key: 'salary', widthRatio: 0.15 },
      { label: 'Deductions', key: 'deductions', widthRatio: 0.15 },
      { label: 'Allowances', key: 'allowances', widthRatio: 0.15 },
      { label: 'Net Payroll', key: 'netPayroll', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Payroll Report', 'payroll_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
