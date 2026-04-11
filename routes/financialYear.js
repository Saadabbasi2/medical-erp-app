// routes/financialYear.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [years] = await pool.query('SELECT * FROM financial_year ORDER BY start_date DESC');
    res.json(years);
  } catch (err) {
    console.error('Get financial years error:', err);
    res.status(500).json({ error: 'Failed to get years' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { yearCode, yearName, startDate, endDate, status, isCurrent } = req.body;

    // If setting as current, unset all others
    if (isCurrent) {
      await pool.query('UPDATE financial_year SET is_current = FALSE');
    }

    const [result] = await pool.query(`
      INSERT INTO financial_year (year_code, year_name, start_date, end_date, status, is_current)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      yearCode || `FY-${Date.now()}`,
      yearName || '',
      startDate || null,
      endDate || null,
      status || 'Active',
      isCurrent || false
    ]);

    const [newYear] = await pool.query('SELECT * FROM financial_year WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newYear[0] });
  } catch (err) {
    console.error('Create financial year error:', err);
    res.status(500).json({ error: 'Failed to create year' });
  }
});

router.put('/:id/set-current', async (req, res) => {
  try {
    const pool = getPool();

    // Unset all current years
    await pool.query('UPDATE financial_year SET is_current = FALSE');

    // Set this year as current
    await pool.query('UPDATE financial_year SET is_current = TRUE WHERE id = ?', [parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM financial_year WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Set current year error:', err);
    res.status(500).json({ error: 'Failed to set current year' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM financial_year WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [years] = await pool.query('SELECT * FROM financial_year');

    const formatted = years.map(y => ({
      code: y.year_code || '-',
      name: y.year_name || '-',
      startDate: y.start_date || '-',
      endDate: y.end_date || '-',
      isCurrent: y.is_current ? 'Yes' : 'No',
      status: y.status || '-'
    }));

    const columns = [
      { label: 'Code', key: 'code', widthRatio: 0.15 },
      { label: 'Year Name', key: 'name', widthRatio: 0.25 },
      { label: 'Start Date', key: 'startDate', widthRatio: 0.15 },
      { label: 'End Date', key: 'endDate', widthRatio: 0.15 },
      { label: 'Current', key: 'isCurrent', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Financial Years', 'financial_years.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
