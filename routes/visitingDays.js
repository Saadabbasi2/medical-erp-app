// routes/visitingDays.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [visits] = await pool.query('SELECT * FROM visiting_days ORDER BY visit_date DESC');
    res.json(visits);
  } catch (err) {
    console.error('Get visiting days error:', err);
    res.status(500).json({ error: 'Failed to get visiting days' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, visitDate, location, purpose, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO visiting_days (employee_id, employee_name, visit_date, location, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [employeeId || null, employeeName || '', visitDate || null, location || '', purpose || '', status || 'Scheduled']);

    const [newVisit] = await pool.query('SELECT * FROM visiting_days WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newVisit[0] });
  } catch (err) {
    console.error('Create visiting day error:', err);
    res.status(500).json({ error: 'Failed to create visiting day' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM visiting_days WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [visits] = await pool.query('SELECT * FROM visiting_days');

    const formatted = visits.map(v => ({
      employeeName: v.employee_name || '-',
      visitDate: v.visit_date || '-',
      location: v.location || '-',
      purpose: v.purpose || '-',
      status: v.status || '-'
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.20 },
      { label: 'Visit Date', key: 'visitDate', widthRatio: 0.15 },
      { label: 'Location', key: 'location', widthRatio: 0.20 },
      { label: 'Purpose', key: 'purpose', widthRatio: 0.30 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Visiting Days Report', 'visiting_days.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
