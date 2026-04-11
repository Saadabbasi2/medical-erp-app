// routes/regions.js — Region data imported from SSMS Setup.Region (8 fields)
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS regions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  parent_id   VARCHAR(50),
  region_id   VARCHAR(50)  NOT NULL,
  own_id      VARCHAR(20),
  description VARCHAR(300),
  category    VARCHAR(100),
  region_type VARCHAR(100),
  level_id    INT DEFAULT NULL,
  inactive    TINYINT(1)   DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_region_id (region_id),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB;
`;

async function ensureTable() {
  const pool = getPool();
  await pool.query(CREATE_TABLE.trim());
}

// ── Export PDF — MUST be declared before /:id routes ─────────
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM regions ORDER BY region_id ASC');
    if (!rows.length) return res.status(404).json({ error: 'No records found' });

    const formatted = rows.map(r => ({
      parent_id:   r.parent_id   || '-',
      region_id:   r.region_id   || '-',
      own_id:      r.own_id      || '-',
      description: r.description || '-',
      category:    r.category    || '-',
      region_type: r.region_type || '-',
      level_id:    r.level_id != null ? String(r.level_id) : '-',
      inactive:    r.inactive == 1 ? 'Yes' : 'No'
    }));

    const columns = [
      { label: 'Parent ID',   key: 'parent_id',   widthRatio: 0.10 },
      { label: 'Region ID',   key: 'region_id',   widthRatio: 0.12 },
      { label: 'Own ID',      key: 'own_id',      widthRatio: 0.08 },
      { label: 'Description', key: 'description', widthRatio: 0.25 },
      { label: 'Category',    key: 'category',    widthRatio: 0.12 },
      { label: 'Region Type', key: 'region_type', widthRatio: 0.13 },
      { label: 'Level ID',    key: 'level_id',    widthRatio: 0.08 },
      { label: 'Inactive',    key: 'inactive',    widthRatio: 0.08 },
    ];

    generateERPTablePDF(res, formatted, columns, 'Regions Report', 'regions_report.pdf');
  } catch (err) {
    console.error('Export regions PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ── GET all ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM regions ORDER BY region_id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get regions error:', err);
    res.status(500).json({ error: 'Failed to get regions' });
  }
});

// ── POST create ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const { parent_id, region_id, own_id, description, category, region_type, level_id, inactive } = req.body || {};
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO regions (parent_id, region_id, own_id, description, category, region_type, level_id, inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parent_id||'', region_id||'', own_id||'', description||'', category||'', region_type||'', level_id??null, inactive??0]
    );
    const [row] = await pool.query('SELECT * FROM regions WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    console.error('Create region error:', err);
    res.status(500).json({ error: 'Failed to create region' });
  }
});

// ── PUT update ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { parent_id, region_id, own_id, description, category, region_type, level_id, inactive } = req.body || {};
    const pool = getPool();
    await pool.query(
      `UPDATE regions SET parent_id=?, region_id=?, own_id=?, description=?, category=?, region_type=?, level_id=?, inactive=? WHERE id=?`,
      [parent_id||'', region_id||'', own_id||'', description||'', category||'', region_type||'', level_id??null, inactive??0, req.params.id]
    );
    const [row] = await pool.query('SELECT * FROM regions WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    console.error('Update region error:', err);
    res.status(500).json({ error: 'Failed to update region' });
  }
});

// ── DELETE ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM regions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete region error:', err);
    res.status(500).json({ error: 'Failed to delete region' });
  }
});

module.exports = router;
