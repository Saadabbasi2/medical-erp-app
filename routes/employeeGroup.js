// routes/employeeGroup.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [groups] = await pool.query('SELECT * FROM employee_groups ORDER BY created_at DESC');
    res.json(groups);
  } catch (err) {
    console.error('Get employee groups error:', err);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { groupName, description } = req.body;

    const [result] = await pool.query(`
      INSERT INTO employee_groups (group_name, description)
      VALUES (?, ?)
    `, [groupName || '', description || '']);

    const [newGroup] = await pool.query('SELECT * FROM employee_groups WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newGroup[0] });
  } catch (err) {
    console.error('Create employee group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM employee_groups WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [groups] = await pool.query('SELECT * FROM employee_groups');

    const formatted = groups.map(g => ({
      groupName: g.group_name || '-',
      description: g.description || '-'
    }));

    const columns = [
      { label: 'Group Name', key: 'groupName', widthRatio: 0.40 },
      { label: 'Description', key: 'description', widthRatio: 0.60 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Employee Groups Report', 'employee_groups.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
