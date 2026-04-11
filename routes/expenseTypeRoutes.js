// routes/expenseTypeRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [types] = await pool.query('SELECT * FROM expense_types ORDER BY created_at DESC');
    res.json(types);
  } catch (err) {
    console.error('Get expense types error:', err);
    res.status(500).json({ error: 'Failed to get types' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { typeName, description } = req.body;

    const [result] = await pool.query(`
      INSERT INTO expense_types (type_name, description)
      VALUES (?, ?)
    `, [typeName || '', description || '']);

    const [newType] = await pool.query('SELECT * FROM expense_types WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newType[0] });
  } catch (err) {
    console.error('Create expense type error:', err);
    res.status(500).json({ error: 'Failed to create type' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM expense_types WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [types] = await pool.query('SELECT * FROM expense_types');

    const formatted = types.map(t => ({
      typeName: t.type_name || '-',
      description: t.description || '-'
    }));

    const columns = [
      { label: 'Type Name', key: 'typeName', widthRatio: 0.40 },
      { label: 'Description', key: 'description', widthRatio: 0.60 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Expense Types Report', 'expense_types.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
