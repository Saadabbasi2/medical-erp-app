// routes/userAccount.js - MySQL Version
const express = require("express");
const crypto = require("crypto");
const { getPool } = require('../db-mysql');

const router = express.Router();

// Change Password
router.post("/change-password", async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, password FROM users WHERE username = ? LIMIT 1
    `, [username]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = users[0];
    const oldHash = crypto.createHash("sha256").update(oldPassword).digest("hex");

    if (user.password !== oldHash) {
      return res.status(401).json({ success: false, message: "Incorrect old password" });
    }

    const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [newHash, user.id]);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: "Failed to change password" });
  }
});

// List Users
router.get("/users", async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query(`SELECT username FROM users ORDER BY username`);

    const usernames = users.map(u => u.username);
    res.json(usernames);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Switch User
router.post("/switch-user", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: "Username required" });
    }

    const pool = getPool();
    const [users] = await pool.query(`
      SELECT id, username FROM users WHERE username = ? LIMIT 1
    `, [username]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: `Switched to ${username}` });
  } catch (err) {
    console.error('Switch user error:', err);
    res.status(500).json({ success: false, message: "Failed to switch user" });
  }
});

module.exports = router;
