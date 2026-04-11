// routes/chartOfAccounts.js - Updated for SSMS COA import (7 fields)
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// ── GET all ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM chart_of_accounts ORDER BY coa_id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get COA error:', err);
    res.status(500).json({ error: 'Failed to get chart of accounts' });
  }
});

// ── POST create ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { coa_id, own_id, parent, description, family, coa_level, coa_type } = req.body || {};
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO chart_of_accounts (coa_id, own_id, parent, description, family, coa_level, coa_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [coa_id || '', own_id || '', parent || '', description || '',
       family || '', coa_level ?? null, coa_type || '']
    );
    const [row] = await pool.query('SELECT * FROM chart_of_accounts WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    console.error('Create COA error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── PUT update ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { coa_id, own_id, parent, description, family, coa_level, coa_type } = req.body || {};
    const pool = getPool();
    await pool.query(
      `UPDATE chart_of_accounts
         SET coa_id=?, own_id=?, parent=?, description=?, family=?, coa_level=?, coa_type=?
       WHERE id=?`,
      [coa_id || '', own_id || '', parent || '', description || '',
       family || '', coa_level ?? null, coa_type || '', req.params.id]
    );
    const [row] = await pool.query('SELECT * FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    console.error('Update COA error:', err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ── DELETE ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete COA error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ── Export PDF (all) ──────────────────────────────────────────
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM chart_of_accounts ORDER BY coa_id ASC');
    const tableRows = rows.map(r => [
      r.coa_id, r.own_id, r.parent, r.description,
      r.family, r.coa_level ?? '', r.coa_type
    ]);
    generateERPTablePDF(
      res,
      'Chart of Accounts Report',
      'coa-report',
      ['COA ID', 'Own ID', 'Parent', 'Description', 'Family', 'COA Level', 'COA Type'],
      tableRows,
      'landscape'
    );
  } catch (err) {
    console.error('Export COA PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
