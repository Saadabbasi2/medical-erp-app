// routes/openClaimRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM open_claims ORDER BY due_date ASC');
    res.json(claims);
  } catch (err) {
    console.error('Get open claims error:', err);
    res.status(500).json({ error: 'Failed to get claims' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { claimNo, claimType, customerId, customerName, amount, claimDate, dueDate, status, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO open_claims (claim_no, claim_type, customer_id, customer_name, amount, claim_date, due_date, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      claimNo || `OC-${Date.now()}`,
      claimType || '',
      customerId || null,
      customerName || '',
      amount || 0,
      claimDate || new Date().toISOString().split('T')[0],
      dueDate || null,
      status || 'Open',
      remarks || ''
    ]);

    const [newClaim] = await pool.query('SELECT * FROM open_claims WHERE id = ?', [result.insertId]);
    res.status(201).json(newClaim[0]);
  } catch (err) {
    console.error('Create open claim error:', err);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.put('/:id/close', async (req, res) => {
  try {
    const pool = getPool();

    await pool.query(`
      UPDATE open_claims 
      SET status = 'Closed'
      WHERE id = ?
    `, [parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM open_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Close claim error:', err);
    res.status(500).json({ error: 'Failed to close claim' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM open_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM open_claims');

    if (!claims || !claims.length) {
      return res.status(404).json({ error: 'No open claim data found' });
    }

    const columns = [
      { label: 'Claim No', key: 'claimNo', widthRatio: 0.15 },
      { label: 'Type', key: 'claimType', widthRatio: 0.15 },
      { label: 'Customer', key: 'customer', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Due Date', key: 'dueDate', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.20 }
    ];

    const transformedData = claims.map(c => ({
      claimNo: c.claim_no || '-',
      claimType: c.claim_type || '-',
      customer: c.customer_name || '-',
      amount: Number(c.amount || 0).toFixed(2),
      dueDate: c.due_date || '-',
      status: c.status || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Open Claims Report', 'open_claims_report.pdf');
  } catch (err) {
    console.error('Open Claims PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
