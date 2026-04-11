// routes/companyGroups.js — Group data imported from SSMS Setup.Group
const express = require('express');
const { getPool } = require('../db-mysql');
const router = express.Router();

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS company_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  group_id    VARCHAR(50)  NOT NULL,
  description VARCHAR(300),
  inactive    TINYINT(1)   DEFAULT 0,
  company_id  VARCHAR(50),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group_id (group_id),
  INDEX idx_company_id (company_id)
) ENGINE=InnoDB;
`;

// Auto-create table on first use
async function ensureTable() {
  const pool = getPool();
  await pool.query(CREATE_TABLE.trim());
}

// GET all
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM company_groups ORDER BY group_id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get company groups error:', err);
    res.status(500).json({ error: 'Failed to get company groups' });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const { group_id, description, inactive, company_id } = req.body || {};
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO company_groups (group_id, description, inactive, company_id)
       VALUES (?, ?, ?, ?)`,
      [group_id || '', description || '', inactive ?? 0, company_id || '']
    );
    const [row] = await pool.query('SELECT * FROM company_groups WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    console.error('Create company group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const { group_id, description, inactive, company_id } = req.body || {};
    const pool = getPool();
    await pool.query(
      `UPDATE company_groups
         SET group_id=?, description=?, inactive=?, company_id=?
       WHERE id=?`,
      [group_id || '', description || '', inactive ?? 0, company_id || '', req.params.id]
    );
    const [row] = await pool.query('SELECT * FROM company_groups WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    console.error('Update company group error:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM company_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete company group error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;
