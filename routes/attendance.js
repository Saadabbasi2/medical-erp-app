// routes/attendance.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [attendance] = await pool.query('SELECT * FROM attendance ORDER BY attendance_date DESC, created_at DESC');
    res.json(attendance);
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json([]);
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { employeeId, employeeName, date, status, checkIn, checkOut, hoursWorked, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO attendance (employee_id, employee_name, date, status, check_in, check_out, hours_worked, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeId || null,
      employeeName || '',
      date || null,
      status || 'Present',
      checkIn || null,
      checkOut || null,
      hoursWorked || 0,
      remarks || ''
    ]);

    const [newRecord] = await pool.query('SELECT * FROM attendance WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRecord[0] });
  } catch (err) {
    console.error('Create attendance error:', err);
    res.status(500).json({ error: 'Failed to create attendance' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM attendance WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [attendance] = await pool.query('SELECT * FROM attendance ORDER BY date DESC');

    const formatted = attendance.map(a => ({
      employeeName: a.employee_name || '-',
      date: a.date || '-',
      status: a.status || '-',
      checkIn: a.check_in || '-',
      checkOut: a.check_out || '-',
      hoursWorked: a.hours_worked || 0
    }));

    const columns = [
      { label: 'Employee', key: 'employeeName', widthRatio: 0.25 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 },
      { label: 'Check In', key: 'checkIn', widthRatio: 0.15 },
      { label: 'Check Out', key: 'checkOut', widthRatio: 0.15 },
      { label: 'Hours', key: 'hoursWorked', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Attendance Report', 'attendance.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
