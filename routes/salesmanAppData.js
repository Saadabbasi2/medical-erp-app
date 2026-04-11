// routes/salesmanAppData.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [appData] = await pool.query('SELECT * FROM salesman_app_data ORDER BY last_sync DESC');
    res.json(appData);
  } catch (err) {
    console.error('Get salesman app data error:', err);
    res.status(500).json({ error: 'Failed to get app data' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { salesmanId, salesmanName, appVersion, deviceInfo, locationData, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO salesman_app_data (salesman_id, salesman_name, app_version, last_sync, device_info, location_data, status)
      VALUES (?, ?, ?, NOW(), ?, ?, ?)
    `, [
      salesmanId || null,
      salesmanName || '',
      appVersion || '',
      deviceInfo || '',
      locationData || '',
      status || 'Active'
    ]);

    const [newData] = await pool.query('SELECT * FROM salesman_app_data WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newData[0] });
  } catch (err) {
    console.error('Create app data error:', err);
    res.status(500).json({ error: 'Failed to create app data' });
  }
});

router.put('/:id/sync', async (req, res) => {
  try {
    const pool = getPool();
    const { locationData, deviceInfo } = req.body;

    await pool.query(`
      UPDATE salesman_app_data 
      SET last_sync = NOW(), location_data = ?, device_info = ?
      WHERE id = ?
    `, [locationData || '', deviceInfo || '', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM salesman_app_data WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to sync' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM salesman_app_data WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [appData] = await pool.query('SELECT * FROM salesman_app_data');

    const formatted = appData.map(d => ({
      salesmanName: d.salesman_name || '-',
      appVersion: d.app_version || '-',
      lastSync: d.last_sync || '-',
      status: d.status || '-'
    }));

    const columns = [
      { label: 'Salesman', key: 'salesmanName', widthRatio: 0.30 },
      { label: 'App Version', key: 'appVersion', widthRatio: 0.20 },
      { label: 'Last Sync', key: 'lastSync', widthRatio: 0.30 },
      { label: 'Status', key: 'status', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Salesman App Data', 'salesman_app_data.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
