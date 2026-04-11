// routes/summaryCollection.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

// GET all summaries
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [summaries] = await pool.query(`
      SELECT id, salesman, route, expected_amount, collected_amount,
             difference, reason, notes, collection_date, status,
             created_at, updated_at
      FROM summary_collection
      ORDER BY collection_date DESC, id DESC
    `);

    // Format for compatibility
    const formatted = summaries.map(s => ({
      id: s.id,
      salesman: s.salesman,
      route: s.route,
      expectedAmount: parseFloat(s.expected_amount),
      collectedAmount: parseFloat(s.collected_amount),
      difference: parseFloat(s.difference),
      reason: s.reason,
      notes: s.notes,
      date: s.collection_date,
      status: s.status
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Load summary collection error:', err);
    res.status(500).json({ error: 'Failed to load summaries' });
  }
});

// POST add new summary
router.post('/', async (req, res) => {
  try {
    const {
      salesman,
      route,
      expectedAmount,
      collectedAmount,
      amount,
      reason,
      notes,
      date
    } = req.body || {};

    const expected = Number(expectedAmount || 0);
    const collected = Number(collectedAmount || amount || 0);
    const difference = collected - expected;
    const status = collected >= expected ? 'Balanced' : 'Pending';

    const pool = getPool();
    const [result] = await pool.query(`
      INSERT INTO summary_collection (
        salesman, route, expected_amount, collected_amount, difference,
        reason, notes, collection_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      salesman || '',
      route || '',
      expected,
      collected,
      difference,
      reason || '',
      notes || '',
      date || new Date().toISOString().split('T')[0],
      status
    ]);

    const summaryId = result.insertId;

    // Fetch created summary
    const [newSummary] = await pool.query(`
      SELECT id, salesman, route, expected_amount, collected_amount,
             difference, reason, notes, collection_date, status,
             created_at
      FROM summary_collection
      WHERE id = ?
    `, [summaryId]);

    const s = newSummary[0];
    const formatted = {
      id: s.id,
      salesman: s.salesman,
      route: s.route,
      expectedAmount: parseFloat(s.expected_amount),
      collectedAmount: parseFloat(s.collected_amount),
      difference: parseFloat(s.difference),
      reason: s.reason,
      notes: s.notes,
      date: s.collection_date,
      status: s.status
    };

    res.json({ message: 'Summary added successfully', summary: formatted });
  } catch (err) {
    console.error('Create summary collection error:', err);
    res.status(500).json({ error: 'Failed to create summary' });
  }
});

// DELETE summary
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM summary_collection WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json({ message: 'Summary deleted' });
  } catch (err) {
    console.error('Delete summary collection error:', err);
    res.status(500).json({ error: 'Failed to delete summary' });
  }
});

// EXPORT PDF
router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [summaries] = await pool.query(`
      SELECT salesman, route, expected_amount, collected_amount,
             difference, status, collection_date
      FROM summary_collection
      ORDER BY collection_date DESC
    `);

    if (summaries.length === 0) {
      return res.status(404).json({ error: 'No summary collection data found' });
    }

    const columns = [
      { label: 'Salesman', key: 'salesman', widthRatio: 0.18 },
      { label: 'Route', key: 'route', widthRatio: 0.18 },
      { label: 'Expected', key: 'expected', widthRatio: 0.14 },
      { label: 'Collected', key: 'collected', widthRatio: 0.14 },
      { label: 'Diff', key: 'diff', widthRatio: 0.12 },
      { label: 'Status', key: 'status', widthRatio: 0.10 },
      { label: 'Date', key: 'date', widthRatio: 0.14 }
    ];

    const transformedData = summaries.map(s => ({
      salesman: s.salesman || '-',
      route: s.route || '-',
      expected: parseFloat(s.expected_amount || 0).toFixed(2),
      collected: parseFloat(s.collected_amount || 0).toFixed(2),
      diff: parseFloat(s.difference || 0).toFixed(2),
      status: s.status || '-',
      date: s.collection_date || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Summary Collection / Addition Report', 'summary_collection_report.pdf');
  } catch (err) {
    console.error('Summary collection PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
