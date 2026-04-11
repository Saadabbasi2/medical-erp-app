// routes/financeReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM finance_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get finance reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get revenue from sales
    const [revenue] = await pool.query(`
      SELECT SUM(total_amount) as total_revenue
      FROM open_invoices
    `);

    // Get expenses from purchases
    const [expenses] = await pool.query(`
      SELECT SUM(total_amount) as total_expenses
      FROM purchase_invoices
    `);

    // Get accounts receivable
    const [receivable] = await pool.query(`
      SELECT SUM(balance) as accounts_receivable
      FROM open_invoices
      WHERE status != 'Paid'
    `);

    // Get accounts payable
    const [payable] = await pool.query(`
      SELECT SUM(balance) as accounts_payable
      FROM purchase_invoices
      WHERE status != 'Paid'
    `);

    const totalRevenue = parseFloat(revenue[0].total_revenue) || 0;
    const totalExpenses = parseFloat(expenses[0].total_expenses) || 0;
    const netProfit = totalRevenue - totalExpenses;

    const [result] = await pool.query(`
      INSERT INTO finance_reports (report_type, report_period, total_revenue, total_expenses, net_profit, accounts_receivable, accounts_payable)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      totalRevenue,
      totalExpenses,
      netProfit,
      receivable[0].accounts_receivable || 0,
      payable[0].accounts_payable || 0
    ]);

    const [newReport] = await pool.query('SELECT * FROM finance_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate finance report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM finance_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM finance_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      revenue: (parseFloat(r.total_revenue) || 0).toFixed(2),
      expenses: (parseFloat(r.total_expenses) || 0).toFixed(2),
      netProfit: (parseFloat(r.net_profit) || 0).toFixed(2),
      receivable: (parseFloat(r.accounts_receivable) || 0).toFixed(2),
      payable: (parseFloat(r.accounts_payable) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.12 },
      { label: 'Period', key: 'period', widthRatio: 0.10 },
      { label: 'Revenue', key: 'revenue', widthRatio: 0.15 },
      { label: 'Expenses', key: 'expenses', widthRatio: 0.15 },
      { label: 'Net Profit', key: 'netProfit', widthRatio: 0.15 },
      { label: 'Receivable', key: 'receivable', widthRatio: 0.15 },
      { label: 'Payable', key: 'payable', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Finance Report', 'finance_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
