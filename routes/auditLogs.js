// routes/auditLogs.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [logs] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000');
    res.json(logs);
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { logType, logLevel, message, userId, username, module, details } = req.body;

    const [result] = await pool.query(`
      INSERT INTO audit_logs (log_type, log_level, message, user_id, username, module, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      logType || 'INFO',
      logLevel || 'INFO',
      message || '',
      userId || null,
      username || '',
      module || '',
      JSON.stringify(details || {})
    ]);

    const [newLog] = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newLog[0] });
  } catch (err) {
    console.error('Create audit log error:', err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [logs] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');

    const formatted = logs.map(l => ({
      logType: l.log_type || '-',
      logLevel: l.log_level || '-',
      message: (l.message || '-').substring(0, 50),
      username: l.username || '-',
      module: l.module || '-',
      createdAt: l.created_at || '-'
    }));

    const columns = [
      { label: 'Type', key: 'logType', widthRatio: 0.12 },
      { label: 'Level', key: 'logLevel', widthRatio: 0.10 },
      { label: 'Message', key: 'message', widthRatio: 0.30 },
      { label: 'User', key: 'username', widthRatio: 0.12 },
      { label: 'Module', key: 'module', widthRatio: 0.12 },
      { label: 'Timestamp', key: 'createdAt', widthRatio: 0.24 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Audit Logs', 'audit_logs.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
