// routes/adminAuditReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM admin_audit_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get admin audit reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get total users
    const [users] = await pool.query(`
      SELECT COUNT(*) as total_users
      FROM users
    `);

    // Get role access history count as total actions
    const [actions] = await pool.query(`
      SELECT COUNT(*) as total_actions
      FROM role_access_history
    `);

    // For now, set failed_logins and data_changes to 0 (can be enhanced later)
    const failedLogins = 0;
    const dataChanges = 0;

    const [result] = await pool.query(`
      INSERT INTO admin_audit_reports (report_type, report_period, total_users, total_actions, failed_logins, data_changes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      users[0].total_users || 0,
      actions[0].total_actions || 0,
      failedLogins,
      dataChanges
    ]);

    const [newReport] = await pool.query('SELECT * FROM admin_audit_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate admin audit report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM admin_audit_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM admin_audit_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      users: r.total_users || 0,
      actions: r.total_actions || 0,
      failedLogins: r.failed_logins || 0,
      dataChanges: r.data_changes || 0
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.20 },
      { label: 'Period', key: 'period', widthRatio: 0.15 },
      { label: 'Users', key: 'users', widthRatio: 0.15 },
      { label: 'Actions', key: 'actions', widthRatio: 0.15 },
      { label: 'Failed Logins', key: 'failedLogins', widthRatio: 0.18 },
      { label: 'Data Changes', key: 'dataChanges', widthRatio: 0.17 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Admin Audit Report', 'admin_audit_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
