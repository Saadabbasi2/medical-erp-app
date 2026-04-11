// routes/controlPanel.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const router = express.Router();

router.get('/settings', async (req, res) => {
  try {
    const pool = getPool();
    const [settings] = await pool.query('SELECT * FROM control_panel_settings ORDER BY setting_key');
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.get('/settings/:key', async (req, res) => {
  try {
    const pool = getPool();
    const [settings] = await pool.query('SELECT * FROM control_panel_settings WHERE setting_key = ?', [req.params.key]);
    res.json(settings[0] || null);
  } catch (err) {
    console.error('Get setting error:', err);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const pool = getPool();
    const { settingKey, settingValue, settingType, description } = req.body;

    // Check if setting exists
    const [existing] = await pool.query('SELECT * FROM control_panel_settings WHERE setting_key = ?', [settingKey]);

    if (existing.length > 0) {
      // Update existing
      await pool.query(`
        UPDATE control_panel_settings 
        SET setting_value = ?, setting_type = ?, description = ?
        WHERE setting_key = ?
      `, [settingValue || '', settingType || 'string', description || '', settingKey]);

      const [updated] = await pool.query('SELECT * FROM control_panel_settings WHERE setting_key = ?', [settingKey]);
      res.json({ success: true, data: updated[0] });
    } else {
      // Insert new
      const [result] = await pool.query(`
        INSERT INTO control_panel_settings (setting_key, setting_value, setting_type, description)
        VALUES (?, ?, ?, ?)
      `, [settingKey || '', settingValue || '', settingType || 'string', description || '']);

      const [newSetting] = await pool.query('SELECT * FROM control_panel_settings WHERE id = ?', [result.insertId]);
      res.json({ success: true, data: newSetting[0] });
    }
  } catch (err) {
    console.error('Save setting error:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

router.delete('/settings/:key', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM control_panel_settings WHERE setting_key = ?', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
