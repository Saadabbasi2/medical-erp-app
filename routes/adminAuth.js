// routes/adminAuth.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, username, email, password, role
      FROM users
      WHERE email = ? AND role = 'admin'
      LIMIT 1
    `, [email]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];

    if (String(user.password) !== String(password)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: { email: user.email, role: 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Change Admin Password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, password FROM users WHERE role = 'admin' LIMIT 1
    `);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const admin = users[0];

    if (String(admin.password) !== String(currentPassword)) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, admin.id]);

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

module.exports = router;
