// routes/rolesPermissions.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');

const router = express.Router();

// Get all roles
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [roles] = await pool.query(`
      SELECT id, username as name, email, role, is_active,
             created_at, updated_at
      FROM users
      WHERE role != 'admin' AND is_active = 1
      ORDER BY created_at DESC
    `);

    // Format for compatibility - all users get empty modules array by default
    const formatted = roles.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      modulesAccess: [] // Empty array for now
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get roles error:', err);
    res.status(500).json([]);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// Add or update role
router.post('/', async (req, res) => {
  try {
    const { name, email, password, modulesAccess } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const pool = getPool();

    // Check if user already exists
    const [existing] = await pool.query(`SELECT id FROM users WHERE email = ?`, [email]);

    const moduleAccessJson = JSON.stringify(modulesAccess || []);

    if (existing.length > 0) {
      // Update existing user
      await pool.query(`
        UPDATE users
        SET username = ?, password = ?, module_access = ?, updated_at = NOW()
        WHERE email = ?
      `, [name || email, password, moduleAccessJson, email]);

      const [updated] = await pool.query(`SELECT * FROM users WHERE email = ?`, [email]);
      const user = updated[0];

      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.username,
          email: user.email,
          password: user.password,
          modulesAccess: user.module_access ? JSON.parse(user.module_access) : []
        }
      });
    } else {
      // Insert new user
      const [result] = await pool.query(`
        INSERT INTO users (username, email, password, role, module_access)
        VALUES (?, ?, ?, ?, ?)
      `, [name || email, email, password, 'Employee', moduleAccessJson]);

      res.json({
        success: true,
        data: {
          id: result.insertId,
          name: name || email,
          email,
          password,
          modulesAccess: modulesAccess || []
        }
      });
    }
  } catch (err) {
    console.error('Create/update role error:', err);
    res.status(500).json({ error: 'Failed to save role' });
  }
});

// Delete role
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    await pool.query(`DELETE FROM users WHERE id = ? AND role != 'admin'`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete role error:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

module.exports = router;
