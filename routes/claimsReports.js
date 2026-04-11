// routes/claimsReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// Get all claims reports
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM claims_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get claims reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

// Generate new claims report
router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get statistics from discount claims
    const [discountStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(discount_amount) as total_amount,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_claims,
        SUM(CASE WHEN status = 'Approved' THEN discount_amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_claims,
        SUM(CASE WHEN status = 'Pending' THEN discount_amount ELSE 0 END) as pending_amount
      FROM discount_claims
    `);

    // Get statistics from bonus claims
    const [bonusStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(bonus_amount) as total_amount,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_claims,
        SUM(CASE WHEN status = 'Approved' THEN bonus_amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_claims,
        SUM(CASE WHEN status = 'Pending' THEN bonus_amount ELSE 0 END) as pending_amount
      FROM bonus_claims
    `);

    const stats = discountStats[0];
    const bonusStatsData = bonusStats[0];

    // Combine statistics
    const totalClaims = (stats.total_claims || 0) + (bonusStatsData.total_claims || 0);
    const totalAmount = (parseFloat(stats.total_amount) || 0) + (parseFloat(bonusStatsData.total_amount) || 0);
    const approvedClaims = (stats.approved_claims || 0) + (bonusStatsData.approved_claims || 0);
    const approvedAmount = (parseFloat(stats.approved_amount) || 0) + (parseFloat(bonusStatsData.approved_amount) || 0);
    const pendingClaims = (stats.pending_claims || 0) + (bonusStatsData.pending_claims || 0);
    const pendingAmount = (parseFloat(stats.pending_amount) || 0) + (parseFloat(bonusStatsData.pending_amount) || 0);

    const [result] = await pool.query(`
      INSERT INTO claims_reports (report_type, report_period, total_claims, total_amount, approved_claims, approved_amount, pending_claims, pending_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      totalClaims,
      totalAmount,
      approvedClaims,
      approvedAmount,
      pendingClaims,
      pendingAmount
    ]);

    const [newReport] = await pool.query('SELECT * FROM claims_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate claims report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Export PDF report
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM claims_reports ORDER BY generated_at DESC');

    if (!reports || !reports.length) {
      return res.status(404).json({ error: 'No claims report data found' });
    }

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.15 },
      { label: 'Period', key: 'period', widthRatio: 0.15 },
      { label: 'Total Claims', key: 'totalClaims', widthRatio: 0.12 },
      { label: 'Total Amount', key: 'totalAmount', widthRatio: 0.15 },
      { label: 'Approved', key: 'approved', widthRatio: 0.12 },
      { label: 'Approved Amt', key: 'approvedAmt', widthRatio: 0.15 },
      { label: 'Pending', key: 'pending', widthRatio: 0.16 }
    ];

    const transformedData = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      totalClaims: r.total_claims || 0,
      totalAmount: Number(r.total_amount || 0).toFixed(2),
      approved: r.approved_claims || 0,
      approvedAmt: Number(r.approved_amount || 0).toFixed(2),
      pending: r.pending_claims || 0
    }));

    generateERPTablePDF(res, transformedData, columns, 'Claims Summary Report', 'claims_reports.pdf');
  } catch (err) {
    console.error('Claims Reports PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
