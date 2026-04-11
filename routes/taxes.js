// routes/taxes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// ----- Tax Masters -----
router.get('/masters', async (req, res) => {
  try {
    const pool = getPool();
    const [masters] = await pool.query('SELECT * FROM tax_masters ORDER BY created_at DESC');
    res.json(masters);
  } catch (err) {
    console.error('Get tax masters error:', err);
    res.status(500).json({ error: 'Failed to get tax masters' });
  }
});

router.post('/masters', async (req, res) => {
  try {
    const pool = getPool();
    const { type, code, description, rate, appliesTo, identifier } = req.body;

    const [result] = await pool.query(`
      INSERT INTO tax_masters (type, code, description, rate, applies_to, identifier)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [type || '', code || '', description || '', rate || 0, appliesTo || '', identifier || '']);

    const [newItem] = await pool.query('SELECT * FROM tax_masters WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newItem[0] });
  } catch (err) {
    console.error('Create tax master error:', err);
    res.status(500).json({ error: 'Failed to create tax master' });
  }
});

router.delete('/masters/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM tax_masters WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ----- Tax Adjustments -----
router.get('/adjustments', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM tax_adjustments ORDER BY created_at DESC');
    res.json(adjustments);
  } catch (err) {
    console.error('Get tax adjustments error:', err);
    res.status(500).json({ error: 'Failed to get adjustments' });
  }
});

router.post('/adjustments', async (req, res) => {
  try {
    const pool = getPool();
    const { adjNo, type, code, amount, reference, remarks, date } = req.body;

    const [result] = await pool.query(`
      INSERT INTO tax_adjustments (adj_no, type, code, amount, reference, remarks, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [adjNo || '', type || '', code || '', amount || 0, reference || '', remarks || '', date || null]);

    const [newItem] = await pool.query('SELECT * FROM tax_adjustments WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newItem[0] });
  } catch (err) {
    console.error('Create tax adjustment error:', err);
    res.status(500).json({ error: 'Failed to create adjustment' });
  }
});

router.delete('/adjustments/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM tax_adjustments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ----- Export Tax Register PDF -----
router.get('/export/register/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM tax_adjustments');

    const formatted = adjustments.map(a => ({
      adjNo: a.adj_no || '-',
      type: a.type || '-',
      code: a.code || '-',
      amount: a.amount ? parseFloat(a.amount).toFixed(2) : '0.00',
      reference: a.reference || '-',
      remarks: a.remarks || '-',
      date: a.date ? new Date(a.date).toLocaleDateString() : '-'
    }));

    const columns = [
      { label: 'Adj #', key: 'adjNo', widthRatio: 0.12 },
      { label: 'Type', key: 'type', widthRatio: 0.10 },
      { label: 'Tax Code', key: 'code', widthRatio: 0.14 },
      { label: 'Amount (PKR)', key: 'amount', widthRatio: 0.14 },
      { label: 'Reference', key: 'reference', widthRatio: 0.18 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.16 },
      { label: 'Date', key: 'date', widthRatio: 0.16 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Tax Register (Adjustments)', 'tax_register.pdf');
  } catch (err) {
    console.error('Tax register PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ----- Export Tax Masters PDF -----
router.get('/export/masters/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [masters] = await pool.query('SELECT * FROM tax_masters');

    const formatted = masters.map(m => ({
      id: m.id,
      type: m.type || '-',
      code: m.code || '-',
      description: m.description || '-',
      rate: m.rate ? `${m.rate}%` : '0%',
      appliesTo: m.applies_to || '-',
      identifier: m.identifier || '-',
      createdAt: m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'
    }));

    const columns = [
      { label: 'Tax ID', key: 'id', widthRatio: 0.15 },
      { label: 'Tax Type', key: 'type', widthRatio: 0.12 },
      { label: 'Code', key: 'code', widthRatio: 0.12 },
      { label: 'Description', key: 'description', widthRatio: 0.18 },
      { label: 'Rate (%)', key: 'rate', widthRatio: 0.10 },
      { label: 'Applies To', key: 'appliesTo', widthRatio: 0.12 },
      { label: 'STRN / CNIC', key: 'identifier', widthRatio: 0.13 },
      { label: 'Date Added', key: 'createdAt', widthRatio: 0.12 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Tax Masters (GST / WHT / Provincial)', 'tax_masters.pdf');
  } catch (err) {
    console.error('Tax masters PDF error:', err);
    res.status(500).json({ error: 'Failed to generate Tax Masters PDF' });
  }
});

module.exports = router;
