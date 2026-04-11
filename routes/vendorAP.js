// routes/vendorAP.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_ap ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get vendor AP error:', err);
    res.status(500).json({ error: 'Failed to get AP records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { invoiceNo, vendorId, vendorName, amount, dueDate, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO vendor_ap (invoice_no, vendor_id, vendor_name, amount, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [invoiceNo || '', vendorId || null, vendorName || '', amount || 0, dueDate || null, status || 'Pending']);

    const [newRec] = await pool.query('SELECT * FROM vendor_ap WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create AP error:', err);
    res.status(500).json({ error: 'Failed to create AP record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM vendor_ap WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_ap');

    const formatted = records.map(r => ({
      invoiceNo: r.invoice_no || '-',
      vendorName: r.vendor_name || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      dueDate: r.due_date || '-',
      status: r.status || '-'
    }));

    const columns = [
      { label: 'Invoice No', key: 'invoiceNo', widthRatio: 0.20 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.25 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Due Date', key: 'dueDate', widthRatio: 0.20 },
      { label: 'Status', key: 'status', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Vendor Accounts Payable Report', 'vendor_ap.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
