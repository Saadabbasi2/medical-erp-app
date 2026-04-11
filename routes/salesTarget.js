// routes/salesTarget.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [targets] = await pool.query('SELECT * FROM sales_target ORDER BY created_at DESC');
    res.json(targets);
  } catch (err) {
    console.error('Get sales targets error:', err);
    res.status(500).json({ error: 'Failed to get targets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { salesmanId, salesmanName, targetPeriod, targetAmount, achievedAmount, status } = req.body;

    const target = parseFloat(targetAmount) || 0;
    const achieved = parseFloat(achievedAmount) || 0;
    const achievementPercentage = target > 0 ? ((achieved / target) * 100).toFixed(2) : 0;

    const [result] = await pool.query(`
      INSERT INTO sales_target (salesman_id, salesman_name, target_period, target_amount, achieved_amount, achievement_percentage, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      salesmanId || null,
      salesmanName || '',
      targetPeriod || '',
      target,
      achieved,
      achievementPercentage,
      status || 'Active'
    ]);

    const [newTarget] = await pool.query('SELECT * FROM sales_target WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newTarget[0] });
  } catch (err) {
    console.error('Create sales target error:', err);
    res.status(500).json({ error: 'Failed to create target' });
  }
});

router.put('/:id/update-achievement', async (req, res) => {
  try {
    const pool = getPool();
    const { achievedAmount } = req.body;

    const [targets] = await pool.query('SELECT * FROM sales_target WHERE id = ?', [parseInt(req.params.id)]);
    if (!targets.length) return res.status(404).json({ error: 'Target not found' });

    const target = targets[0];
    const targetAmt = parseFloat(target.target_amount) || 0;
    const achieved = parseFloat(achievedAmount) || 0;
    const achievementPercentage = targetAmt > 0 ? ((achieved / targetAmt) * 100).toFixed(2) : 0;

    await pool.query(`
      UPDATE sales_target 
      SET achieved_amount = ?, achievement_percentage = ?
      WHERE id = ?
    `, [achieved, achievementPercentage, parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM sales_target WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Update achievement error:', err);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM sales_target WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [targets] = await pool.query('SELECT * FROM sales_target');

    const formatted = targets.map(t => ({
      salesmanName: t.salesman_name || '-',
      period: t.target_period || '-',
      targetAmount: (parseFloat(t.target_amount) || 0).toFixed(2),
      achievedAmount: (parseFloat(t.achieved_amount) || 0).toFixed(2),
      achievement: `${parseFloat(t.achievement_percentage) || 0}%`,
      status: t.status || '-'
    }));

    const columns = [
      { label: 'Salesman', key: 'salesmanName', widthRatio: 0.20 },
      { label: 'Period', key: 'period', widthRatio: 0.15 },
      { label: 'Target', key: 'targetAmount', widthRatio: 0.15 },
      { label: 'Achieved', key: 'achievedAmount', widthRatio: 0.15 },
      { label: 'Achievement', key: 'achievement', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Sales Targets', 'sales_targets.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
