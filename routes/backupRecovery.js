// routes/backupRecovery.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [backups] = await pool.query('SELECT * FROM backup_recovery ORDER BY backup_date DESC');
    res.json(backups);
  } catch (err) {
    console.error('Get backups error:', err);
    res.status(500).json({ error: 'Failed to get backups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { backupName, backupType, backupPath, backupSize, status, createdBy } = req.body;

    const [result] = await pool.query(`
      INSERT INTO backup_recovery (backup_name, backup_type, backup_path, backup_size, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      backupName || `Backup-${Date.now()}`,
      backupType || 'Full',
      backupPath || '',
      backupSize || 0,
      status || 'Completed',
      createdBy || 'System'
    ]);

    const [newBackup] = await pool.query('SELECT * FROM backup_recovery WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newBackup[0] });
  } catch (err) {
    console.error('Create backup error:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM backup_recovery WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [backups] = await pool.query('SELECT * FROM backup_recovery');

    const formatted = backups.map(b => ({
      backupName: b.backup_name || '-',
      backupType: b.backup_type || '-',
      backupDate: b.backup_date || '-',
      backupSize: `${((b.backup_size || 0) / 1024 / 1024).toFixed(2)} MB`,
      status: b.status || '-',
      createdBy: b.created_by || '-'
    }));

    const columns = [
      { label: 'Backup Name', key: 'backupName', widthRatio: 0.25 },
      { label: 'Type', key: 'backupType', widthRatio: 0.12 },
      { label: 'Date', key: 'backupDate', widthRatio: 0.20 },
      { label: 'Size', key: 'backupSize', widthRatio: 0.13 },
      { label: 'Status', key: 'status', widthRatio: 0.15 },
      { label: 'Created By', key: 'createdBy', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Backup & Recovery', 'backups.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
