// routes/purchaseReturns.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [returns] = await pool.query('SELECT * FROM purchase_returns ORDER BY created_at DESC');
    res.json(returns);
  } catch (err) {
    console.error('Get purchase returns error:', err);
    res.status(500).json({ error: 'Failed to get returns' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { returnNumber, invoiceNumber, vendorId, vendorName, returnDate, returnAmount, reason, status } = req.body;
    
    const [result] = await pool.query(`
      INSERT INTO purchase_returns (return_number, invoice_number, vendor_id, vendor_name, return_date, return_amount, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      returnNumber || `PR-${Date.now()}`,
      invoiceNumber || '',
      vendorId || null,
      vendorName || '',
      returnDate || new Date().toISOString().split('T')[0],
      returnAmount || 0,
      reason || '',
      status || 'Pending'
    ]);
    
    const [newReturn] = await pool.query('SELECT * FROM purchase_returns WHERE id = ?', [result.insertId]);
    res.status(201).json(newReturn[0]);
  } catch (err) {
    console.error('Create purchase return error:', err);
    res.status(500).json({ error: 'Failed to create return' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;
    
    await pool.query(`
      UPDATE purchase_returns 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);
    
    const [updated] = await pool.query('SELECT * FROM purchase_returns WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve return error:', err);
    res.status(500).json({ error: 'Failed to approve return' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM purchase_returns WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [returns] = await pool.query('SELECT * FROM purchase_returns');
    
    const formatted = returns.map(r => ({
      returnNumber: r.return_number || '-',
      vendorName: r.vendor_name || '-',
      returnDate: r.return_date || '-',
      returnAmount: (parseFloat(r.return_amount) || 0).toFixed(2),
      reason: r.reason || '-',
      status: r.status || '-'
    }));
    
    const columns = [
      { label: 'Return No', key: 'returnNumber', widthRatio: 0.15 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.25 },
      { label: 'Date', key: 'returnDate', widthRatio: 0.15 },
      { label: 'Amount', key: 'returnAmount', widthRatio: 0.15 },
      { label: 'Reason', key: 'reason', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];
    
    generateERPTablePDF(res, formatted, columns, 'Purchase Returns Report', 'purchase_returns.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
