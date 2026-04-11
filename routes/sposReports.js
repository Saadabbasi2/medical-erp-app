// routes/sposReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM spos_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get SPOS reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get sales statistics from open_invoices
    const [sales] = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_sales
      FROM open_invoices
    `);

    // Get returns statistics
    const [returns] = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        SUM(return_amount) as return_amount
      FROM sales_returns
    `);

    // For now, split sales 50/50 between cash and card (can be enhanced later with payment method tracking)
    const totalSales = parseFloat(sales[0].total_sales) || 0;
    const cashSales = totalSales * 0.5;
    const cardSales = totalSales * 0.5;

    const [result] = await pool.query(`
      INSERT INTO spos_reports (report_type, report_period, total_transactions, total_sales, total_returns, return_amount, cash_sales, card_sales)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      sales[0].total_transactions || 0,
      totalSales,
      returns[0].total_returns || 0,
      returns[0].return_amount || 0,
      cashSales,
      cardSales
    ]);

    const [newReport] = await pool.query('SELECT * FROM spos_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate SPOS report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM spos_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM spos_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      transactions: r.total_transactions || 0,
      sales: (parseFloat(r.total_sales) || 0).toFixed(2),
      returns: r.total_returns || 0,
      returnAmt: (parseFloat(r.return_amount) || 0).toFixed(2),
      cashSales: (parseFloat(r.cash_sales) || 0).toFixed(2),
      cardSales: (parseFloat(r.card_sales) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.12 },
      { label: 'Period', key: 'period', widthRatio: 0.10 },
      { label: 'Transactions', key: 'transactions', widthRatio: 0.12 },
      { label: 'Sales', key: 'sales', widthRatio: 0.14 },
      { label: 'Returns', key: 'returns', widthRatio: 0.10 },
      { label: 'Return Amt', key: 'returnAmt', widthRatio: 0.14 },
      { label: 'Cash', key: 'cashSales', widthRatio: 0.14 },
      { label: 'Card', key: 'cardSales', widthRatio: 0.14 }
    ];

    generateERPTablePDF(res, formatted, columns, 'SPOS Report', 'spos_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
