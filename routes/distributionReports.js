// routes/distributionReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM distribution_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get distribution reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get distributor count (assuming from customers table with type='Distributor')
    const [distributors] = await pool.query(`
      SELECT COUNT(*) as total_distributors
      FROM customers
      WHERE customer_type = 'Distributor'
    `);

    // Get bookings statistics
    const [bookings] = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(total_amount) as total_amount
      FROM distributor_bookings
    `);

    // Get invoices count
    const [invoices] = await pool.query(`
      SELECT COUNT(*) as total_invoices
      FROM distributor_invoices
    `);

    // Get returns statistics
    const [returns] = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        SUM(return_amount) as return_amount
      FROM distributor_returns
    `);

    const [result] = await pool.query(`
      INSERT INTO distribution_reports (report_type, report_period, total_distributors, total_bookings, total_invoices, total_amount, total_returns, return_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      distributors[0].total_distributors || 0,
      bookings[0].total_bookings || 0,
      invoices[0].total_invoices || 0,
      bookings[0].total_amount || 0,
      returns[0].total_returns || 0,
      returns[0].return_amount || 0
    ]);

    const [newReport] = await pool.query('SELECT * FROM distribution_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate distribution report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM distribution_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM distribution_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      distributors: r.total_distributors || 0,
      bookings: r.total_bookings || 0,
      invoices: r.total_invoices || 0,
      amount: (parseFloat(r.total_amount) || 0).toFixed(2),
      returns: r.total_returns || 0,
      returnAmt: (parseFloat(r.return_amount) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.14 },
      { label: 'Period', key: 'period', widthRatio: 0.12 },
      { label: 'Distributors', key: 'distributors', widthRatio: 0.12 },
      { label: 'Bookings', key: 'bookings', widthRatio: 0.12 },
      { label: 'Invoices', key: 'invoices', widthRatio: 0.12 },
      { label: 'Amount', key: 'amount', widthRatio: 0.14 },
      { label: 'Returns', key: 'returns', widthRatio: 0.10 },
      { label: 'Return Amt', key: 'returnAmt', widthRatio: 0.14 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Distribution Report', 'distribution_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
