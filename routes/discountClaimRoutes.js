// routes/discountClaimRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM discount_claims ORDER BY created_at DESC');
    res.json(claims);
  } catch (err) {
    console.error('Get discount claims error:', err);
    res.status(500).json({ error: 'Failed to get claims' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { claimNo, customerId, customerName, productName, invoiceNo, discountAmount, discountPercentage, claimDate, status, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO discount_claims (claim_no, customer_id, customer_name, product_name, invoice_no, discount_amount, discount_percentage, claim_date, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      claimNo || `DC-${Date.now()}`,
      customerId || null,
      customerName || '',
      productName || '',
      invoiceNo || '',
      discountAmount || 0,
      discountPercentage || 0,
      claimDate || new Date().toISOString().split('T')[0],
      status || 'Pending',
      remarks || ''
    ]);

    const [newClaim] = await pool.query('SELECT * FROM discount_claims WHERE id = ?', [result.insertId]);
    res.status(201).json(newClaim[0]);
  } catch (err) {
    console.error('Create discount claim error:', err);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE discount_claims 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM discount_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM discount_claims WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [claims] = await pool.query('SELECT * FROM discount_claims');

    if (!claims || !claims.length) {
      return res.status(404).json({ error: 'No discount claim data found' });
    }

    const columns = [
      { label: 'Claim No', key: 'claimNo', widthRatio: 0.15 },
      { label: 'Customer', key: 'customer', widthRatio: 0.20 },
      { label: 'Product', key: 'product', widthRatio: 0.18 },
      { label: 'Amount', key: 'amount', widthRatio: 0.14 },
      { label: 'Status', key: 'status', widthRatio: 0.14 },
      { label: 'Date', key: 'date', widthRatio: 0.19 }
    ];

    const transformedData = claims.map(c => ({
      claimNo: c.claim_no || '-',
      customer: c.customer_name || '-',
      product: c.product_name || '-',
      amount: Number(c.discount_amount || 0).toFixed(2),
      status: c.status || '-',
      date: c.claim_date || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Discount Claim Report', 'discount_claims_report.pdf');
  } catch (err) {
    console.error('Discount Claim PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
