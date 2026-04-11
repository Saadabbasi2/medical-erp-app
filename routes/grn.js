// routes/grn.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [grns] = await pool.query('SELECT * FROM grn ORDER BY created_at DESC');
    res.json(grns);
  } catch (err) {
    console.error('Get GRN error:', err);
    res.status(500).json({ error: 'Failed to get GRNs' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { grnNumber, poNumber, vendorId, vendorName, receivedDate, receivedBy, totalQuantity, totalAmount, status, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO grn (grn_number, po_number, vendor_id, vendor_name, received_date, received_by, total_quantity, total_amount, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      grnNumber || `GRN-${Date.now()}`,
      poNumber || '',
      vendorId || null,
      vendorName || '',
      receivedDate || new Date().toISOString().split('T')[0],
      receivedBy || 'User',
      totalQuantity || 0,
      totalAmount || 0,
      status || 'Received',
      remarks || ''
    ]);

    const [newGRN] = await pool.query('SELECT * FROM grn WHERE id = ?', [result.insertId]);
    res.status(201).json(newGRN[0]);
  } catch (err) {
    console.error('Create GRN error:', err);
    res.status(500).json({ error: 'Failed to create GRN' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM grn WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [grns] = await pool.query('SELECT * FROM grn');

    const formatted = grns.map(g => ({
      grnNumber: g.grn_number || '-',
      poNumber: g.po_number || '-',
      vendorName: g.vendor_name || '-',
      receivedDate: g.received_date || '-',
      totalQuantity: g.total_quantity || 0,
      totalAmount: (parseFloat(g.total_amount) || 0).toFixed(2),
      status: g.status || '-'
    }));

    const columns = [
      { label: 'GRN No', key: 'grnNumber', widthRatio: 0.15 },
      { label: 'PO No', key: 'poNumber', widthRatio: 0.15 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.20 },
      { label: 'Date', key: 'receivedDate', widthRatio: 0.15 },
      { label: 'Qty', key: 'totalQuantity', widthRatio: 0.10 },
      { label: 'Amount', key: 'totalAmount', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.10 }
    ];

    generateERPTablePDF(res, formatted, columns, 'GRN Report', 'grn_report.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
