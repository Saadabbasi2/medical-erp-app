// routes/userGroups.js - MySQL Version
const express = require("express");
const path = require("path");
const ExcelJS = require("exceljs");
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require("../utils/pdfTemplate");

const router = express.Router();

// Get all groups
router.get("/groups", async (req, res) => {
  try {
    // TODO: Fix user_groups table schema - currently missing group_name column
    // Returning empty array to prevent errors
    res.json([]);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json([]);
  }
});

// Create group
router.post("/groups", async (req, res) => {
  try {
    const pool = getPool();
    const { groupName, description } = req.body;

    const [result] = await pool.query(`
      INSERT INTO user_groups (group_name, description)
      VALUES (?, ?)
    `, [groupName || '', description || '']);

    const [newGroup] = await pool.query(`SELECT * FROM user_groups WHERE id = ?`, [result.insertId]);

    res.json({ success: true, group: newGroup[0] });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Delete group
router.delete("/groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    await pool.query(`DELETE FROM user_groups WHERE id = ?`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, username as name, email, role, is_active,
             created_at
      FROM users
      WHERE is_active = 1
      ORDER BY username
    `);

    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json([]);
  }
});

// Create user
router.post("/users", async (req, res) => {
  try {
    const pool = getPool();
    const {
      name,
      email,
      password,
      role,
      group,
      region,
      branch
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO users (username, email, password, role, user_group, region, branch)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      name || email,
      email || '',
      password || 'default123',
      role || 'Employee',
      group || '',
      region || '',
      branch || ''
    ]);

    const [newUser] = await pool.query(`SELECT * FROM users WHERE id = ?`, [result.insertId]);
    const user = newUser[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        group: user.user_group,
        region: user.region,
        branch: user.branch,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    // Don't delete admin
    await pool.query(`DELETE FROM users WHERE id = ? AND role != 'admin'`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Export PDF
router.get("/export/pdf", async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, username, role, user_group, region, branch
      FROM users
      ORDER BY username
    `);

    const formatted = users.map(u => ({
      id: u.id,
      name: u.username || '-',
      role: u.role || '-',
      group: u.user_group || '-',
      region: u.region || '-',
      branch: u.branch || '-'
    }));

    const columns = [
      { label: "User ID", key: "id", widthRatio: 0.15 },
      { label: "Name", key: "name", widthRatio: 0.2 },
      { label: "Role", key: "role", widthRatio: 0.15 },
      { label: "Group", key: "group", widthRatio: 0.15 },
      { label: "Region", key: "region", widthRatio: 0.15 },
      { label: "Branch", key: "branch", widthRatio: 0.15 },
    ];

    generateERPTablePDF(res, formatted, columns, "User Groups / Roles Report", "User_Groups_Roles.pdf");
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Export Excel
router.get("/export/excel", async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, username as name, role, user_group as 'group', region, branch
      FROM users
      ORDER BY username
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("User Groups / Roles");

    sheet.columns = [
      { header: "User ID", key: "id", width: 10 },
      { header: "Name", key: "name", width: 25 },
      { header: "Role", key: "role", width: 15 },
      { header: "Group", key: "group", width: 15 },
      { header: "Region", key: "region", width: 15 },
      { header: "Branch", key: "branch", width: 15 },
    ];

    users.forEach(u => sheet.addRow(u));

    const filePath = path.join(__dirname, "..", "data", "User_Groups_Roles.xlsx");
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, "User_Groups_Roles.xlsx");
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

module.exports = router;
