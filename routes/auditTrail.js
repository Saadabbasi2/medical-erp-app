// routes/auditTrail.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [trails] = await pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 1000');
    res.json(trails);
  } catch (err) {
    console.error('Get audit trail error:', err);
    res.status(500).json({ error: 'Failed to get audit trail' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { userId, username, action, module, recordId, oldValue, newValue, ipAddress } = req.body;

    const [result] = await pool.query(`
      INSERT INTO audit_trail (user_id, username, action, module, record_id, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId || null,
      username || '',
      action || '',
      module || '',
      recordId || null,
      oldValue || '',
      newValue || '',
      ipAddress || ''
    ]);

    const [newTrail] = await pool.query('SELECT * FROM audit_trail WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newTrail[0] });
  } catch (err) {
    console.error('Create audit trail error:', err);
    res.status(500).json({ error: 'Failed to create audit trail' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [trails] = await pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 500');

    const formatted = trails.map(t => ({
      username: t.username || '-',
      action: t.action || '-',
      module: t.module || '-',
      createdAt: t.created_at || '-',
      ipAddress: t.ip_address || '-'
    }));

    const columns = [
      { label: 'User', key: 'username', widthRatio: 0.15 },
      { label: 'Action', key: 'action', widthRatio: 0.25 },
      { label: 'Module', key: 'module', widthRatio: 0.15 },
      { label: 'Timestamp', key: 'createdAt', widthRatio: 0.25 },
      { label: 'IP Address', key: 'ipAddress', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Audit Trail', 'audit_trail.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
