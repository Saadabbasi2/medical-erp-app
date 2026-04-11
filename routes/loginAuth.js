// routes/loginAuth.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');

const router = express.Router();

function normalizeEmail(value) {
  return (value || '').trim().toLowerCase();
}

router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const pool = getPool();
    const normalizedEmail = normalizeEmail(email);

    // Find user by email or username
    const [users] = await pool.query(`
      SELECT id, username, email, password, role, is_active
      FROM users
      WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1
      LIMIT 1
    `, [normalizedEmail, normalizedEmail]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];

    // Simple password comparison (in production, use bcrypt)
    if (String(user.password) !== String(password)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Return user data with all modules access for admin
    const modules = user.role === 'admin' ? ['all'] : [];
    const assignedModule = user.role === 'admin' ? 'all' : null;

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role || 'user'
      },
      modules,
      assignedModule
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
  }
});

module.exports = router;
