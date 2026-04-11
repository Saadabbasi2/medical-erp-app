// routes/banks.js - Banks Module (replaced Cheque Conversion)
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// ── GET all banks ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM banks ORDER BY bank_id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get banks error:', err);
    res.status(500).json({ error: 'Failed to get banks' });
  }
});

// ── POST create bank ───────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { bank_id, bank_name, account_no, branch, coa_id,
            account_title, account_type, opening_date } = req.body || {};
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO banks (bank_id, bank_name, account_no, branch, coa_id,
         account_title, account_type, opening_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bank_id || '', bank_name || '', account_no || '', branch || '',
       coa_id || '', account_title || '', account_type || '', opening_date || null]
    );
    const [row] = await pool.query('SELECT * FROM banks WHERE id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    console.error('Create bank error:', err);
    res.status(500).json({ error: 'Failed to create bank' });
  }
});

// ── PUT update bank ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { bank_id, bank_name, account_no, branch, coa_id,
            account_title, account_type, opening_date } = req.body || {};
    const pool = getPool();
    await pool.query(
      `UPDATE banks SET bank_id=?, bank_name=?, account_no=?, branch=?, coa_id=?,
         account_title=?, account_type=?, opening_date=?
       WHERE id=?`,
      [bank_id || '', bank_name || '', account_no || '', branch || '',
       coa_id || '', account_title || '', account_type || '', opening_date || null,
       req.params.id]
    );
    const [row] = await pool.query('SELECT * FROM banks WHERE id = ?', [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    console.error('Update bank error:', err);
    res.status(500).json({ error: 'Failed to update bank' });
  }
});

// ── DELETE bank ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM banks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bank error:', err);
    res.status(500).json({ error: 'Failed to delete bank' });
  }
});

// ── GET PDF (single bank) ──────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM banks WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Bank not found' });
    const b = rows[0];
    const od = b.opening_date ? new Date(b.opening_date).toLocaleDateString('en-GB') : '-';
    generateERPTablePDF(
      res,
      `Bank - ${b.bank_name}`,
      `bank-${b.id}`,
      ['Bank ID', 'Bank Name', 'Account No', 'Branch', 'COA ID', 'Account Title', 'Account Type', 'Opening Date'],
      [[b.bank_id, b.bank_name, b.account_no, b.branch, b.coa_id, b.account_title, b.account_type, od]],
      'landscape'
    );
  } catch (err) {
    console.error('Bank PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── GET Export PDF (all banks) ─────────────────────────────────
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM banks ORDER BY bank_id ASC');
    const tableRows = rows.map(b => [
      b.bank_id, b.bank_name, b.account_no, b.branch, b.coa_id,
      b.account_title, b.account_type,
      b.opening_date ? new Date(b.opening_date).toLocaleDateString('en-GB') : '-'
    ]);
    generateERPTablePDF(
      res,
      'Banks Report',
      'banks-report',
      ['Bank ID', 'Bank Name', 'Account No', 'Branch', 'COA ID', 'Account Title', 'Account Type', 'Opening Date'],
      tableRows,
      'landscape'
    );
  } catch (err) {
    console.error('Banks export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
