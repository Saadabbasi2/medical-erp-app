// routes/claimsAdjustmentRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM claims_adjustments ORDER BY created_at DESC');
    res.json(adjustments);
  } catch (err) {
    console.error('Get claims adjustments error:', err);
    res.status(500).json({ error: 'Failed to get adjustments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { adjustmentNo, claimType, originalClaimNo, adjustmentAmount, adjustmentDate, reason, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO claims_adjustments (adjustment_no, claim_type, original_claim_no, adjustment_amount, adjustment_date, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      adjustmentNo || `ADJ-${Date.now()}`,
      claimType || '',
      originalClaimNo || '',
      adjustmentAmount || 0,
      adjustmentDate || new Date().toISOString().split('T')[0],
      reason || '',
      status || 'Pending'
    ]);

    const [newAdjustment] = await pool.query('SELECT * FROM claims_adjustments WHERE id = ?', [result.insertId]);
    res.status(201).json(newAdjustment[0]);
  } catch (err) {
    console.error('Create claims adjustment error:', err);
    res.status(500).json({ error: 'Failed to create adjustment' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE claims_adjustments 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM claims_adjustments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve adjustment error:', err);
    res.status(500).json({ error: 'Failed to approve adjustment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM claims_adjustments WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM claims_adjustments');

    if (!adjustments || !adjustments.length) {
      return res.status(404).json({ error: 'No claims adjustment data found' });
    }

    const columns = [
      { label: 'Adjustment No', key: 'adjustmentNo', widthRatio: 0.18 },
      { label: 'Claim Type', key: 'claimType', widthRatio: 0.15 },
      { label: 'Original Claim', key: 'originalClaim', widthRatio: 0.18 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Reason', key: 'reason', widthRatio: 0.20 },
      { label: 'Status', key: 'status', widthRatio: 0.14 }
    ];

    const transformedData = adjustments.map(a => ({
      adjustmentNo: a.adjustment_no || '-',
      claimType: a.claim_type || '-',
      originalClaim: a.original_claim_no || '-',
      amount: Number(a.adjustment_amount || 0).toFixed(2),
      reason: a.reason || '-',
      status: a.status || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Claims Adjustment Report', 'claims_adjustments_report.pdf');
  } catch (err) {
    console.error('Claims Adjustment PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
