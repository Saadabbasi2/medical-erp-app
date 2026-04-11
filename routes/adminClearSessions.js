// routes/adminClearSessions.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const router = express.Router();

router.get('/sessions', async (req, res) => {
  try {
    const pool = getPool();
    const [sessions] = await pool.query('SELECT * FROM admin_sessions ORDER BY last_activity DESC');
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const pool = getPool();
    const { sessionId, userId, username, ipAddress, userAgent } = req.body;

    const [result] = await pool.query(`
      INSERT INTO admin_sessions (session_id, user_id, username, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE last_activity = NOW()
    `, [
      sessionId || `sess-${Date.now()}`,
      userId || null,
      username || '',
      ipAddress || '',
      userAgent || ''
    ]);

    const [newSession] = await pool.query('SELECT * FROM admin_sessions WHERE session_id = ?', [sessionId]);
    res.json({ success: true, data: newSession[0] });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM admin_sessions WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

router.post('/sessions/clear-all', async (req, res) => {
  try {
    const pool = getPool();
    const { exceptUserId } = req.body;

    if (exceptUserId) {
      await pool.query('DELETE FROM admin_sessions WHERE user_id != ?', [exceptUserId]);
    } else {
      await pool.query('DELETE FROM admin_sessions');
    }

    res.json({ success: true, message: 'All sessions cleared' });
  } catch (err) {
    console.error('Clear sessions error:', err);
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

router.post('/sessions/clear-inactive', async (req, res) => {
  try {
    const pool = getPool();
    const { minutes } = req.body;
    const inactiveMinutes = minutes || 30;

    await pool.query(`
      DELETE FROM admin_sessions 
      WHERE last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `, [inactiveMinutes]);

    res.json({ success: true, message: `Inactive sessions (${inactiveMinutes}+ min) cleared` });
  } catch (err) {
    console.error('Clear inactive sessions error:', err);
    res.status(500).json({ error: 'Failed to clear inactive sessions' });
  }
});

module.exports = router;
