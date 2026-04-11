// routes/payrollSetup.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [setup] = await pool.query('SELECT * FROM payroll_setup ORDER BY created_at DESC');
    res.json(setup);
  } catch (err) {
    console.error('Get payroll setup error:', err);
    res.status(500).json({ error: 'Failed to get payroll setup' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { designation, department, head, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO payroll_setup (designation, department, head, remarks)
      VALUES (?, ?, ?, ?)
    `, [designation || '', department || '', head || '', remarks || '']);

    const [newEntry] = await pool.query('SELECT * FROM payroll_setup WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newEntry[0] });
  } catch (err) {
    console.error('Create payroll setup error:', err);
    res.status(500).json({ error: 'Failed to create setup' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM payroll_setup WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [setup] = await pool.query('SELECT * FROM payroll_setup');

    const formatted = setup.map(s => ({
      designation: s.designation || '-',
      department: s.department || '-',
      head: s.head || '-',
      remarks: s.remarks || '-'
    }));

    const columns = [
      { label: 'Designation', key: 'designation', widthRatio: 0.25 },
      { label: 'Department', key: 'department', widthRatio: 0.25 },
      { label: 'Department Head', key: 'head', widthRatio: 0.25 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Designation / Department Report', 'payroll_setup.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
