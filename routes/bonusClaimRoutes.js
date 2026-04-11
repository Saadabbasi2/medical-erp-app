// routes/bonusClaimRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM bonus_claims ORDER BY created_at DESC');
    res.json(claims);
  } catch (err) {
    console.error('Get bonus claims error:', err);
    res.status(500).json({ error: 'Failed to get claims' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { claimNo, customerId, customerName, productName, bonusQuantity, bonusAmount, claimDate, status, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO bonus_claims (claim_no, customer_id, customer_name, product_name, bonus_quantity, bonus_amount, claim_date, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      claimNo || `BC-${Date.now()}`,
      customerId || null,
      customerName || '',
      productName || '',
      bonusQuantity || 0,
      bonusAmount || 0,
      claimDate || new Date().toISOString().split('T')[0],
      status || 'Pending',
      remarks || ''
    ]);

    const [newClaim] = await pool.query('SELECT * FROM bonus_claims WHERE id = ?', [result.insertId]);
    res.status(201).json(newClaim[0]);
  } catch (err) {
    console.error('Create bonus claim error:', err);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE bonus_claims 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM bonus_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM bonus_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM bonus_claims');

    if (!claims || !claims.length) {
      return res.status(404).json({ error: 'No bonus claim data found' });
    }

    const columns = [
      { label: 'Claim No', key: 'claimNo', widthRatio: 0.15 },
      { label: 'Customer', key: 'customer', widthRatio: 0.20 },
      { label: 'Product', key: 'product', widthRatio: 0.20 },
      { label: 'Quantity', key: 'quantity', widthRatio: 0.12 },
      { label: 'Amount', key: 'amount', widthRatio: 0.14 },
      { label: 'Status', key: 'status', widthRatio: 0.19 }
    ];

    const transformedData = claims.map(c => ({
      claimNo: c.claim_no || '-',
      customer: c.customer_name || '-',
      product: c.product_name || '-',
      quantity: c.bonus_quantity || 0,
      amount: Number(c.bonus_amount || 0).toFixed(2),
      status: c.status || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Bonus Claim Report', 'bonus_claims_report.pdf');
  } catch (err) {
    console.error('Bonus Claim PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
