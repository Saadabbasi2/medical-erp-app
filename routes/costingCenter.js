// routes/costingCenter.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM costing_center ORDER BY created_at DESC');
    res.json(data);
  } catch (err) {
    console.error('Get costing center error:', err);
    res.status(500).json({ error: 'Failed to get costing centers' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { centerName, centerCode, description, budget, actualCost } = req.body;

    const budgetVal = parseFloat(budget) || 0;
    const actualVal = parseFloat(actualCost) || 0;
    const variance = budgetVal - actualVal;

    const [result] = await pool.query(`
      INSERT INTO costing_center (center_name, center_code, description, budget, actual_cost, variance)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [centerName || '', centerCode || '', description || '', budgetVal, actualVal, variance]);

    const [newCenter] = await pool.query('SELECT * FROM costing_center WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newCenter[0] });
  } catch (err) {
    console.error('Add costing center error:', err);
    res.status(500).json({ error: 'Failed to add costing center' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM costing_center WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM costing_center');

    const formatted = data.map(d => ({
      centerName: d.center_name || '-',
      centerCode: d.center_code || '-',
      budget: (parseFloat(d.budget) || 0).toFixed(2),
      actualCost: (parseFloat(d.actual_cost) || 0).toFixed(2),
      variance: (parseFloat(d.variance) || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Center Name', key: 'centerName', widthRatio: 0.25 },
      { label: 'Code', key: 'centerCode', widthRatio: 0.15 },
      { label: 'Budget', key: 'budget', widthRatio: 0.20 },
      { label: 'Actual Cost', key: 'actualCost', widthRatio: 0.20 },
      { label: 'Variance', key: 'variance', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Costing Center Report', 'costing_center.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
