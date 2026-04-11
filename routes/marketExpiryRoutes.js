// routes/marketExpiryRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// GET all records
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM market_expiry ORDER BY expiry_date ASC');
    res.json(data);
  } catch (err) {
    console.error('Get market expiry error:', err);
    res.status(500).json({ error: 'Failed to get market expiry' });
  }
});

// ADD
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { productName, batchNo, expiryDate, quantity, customer, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO market_expiry (product_name, batch_no, expiry_date, quantity, customer, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [productName || '', batchNo || '', expiryDate || null, quantity || 0, customer || '', status || 'Pending']);

    res.json({ message: 'Market expiry record added', id: result.insertId });
  } catch (err) {
    console.error('Add market expiry error:', err);
    res.status(500).json({ error: 'Failed to add record' });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM market_expiry WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Market expiry record deleted' });
  } catch (err) {
    console.error('Delete market expiry error:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// PDF Export
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM market_expiry');

    if (!data || !data.length) {
      return res.status(404).json({ error: 'No market expiry data found' });
    }

    const columns = [
      { label: 'Customer', key: 'customer', widthRatio: 0.16 },
      { label: 'Product', key: 'product', widthRatio: 0.16 },
      { label: 'Batch', key: 'batch', widthRatio: 0.13 },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.15 },
      { label: 'Qty', key: 'qty', widthRatio: 0.11 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    const transformedData = data.map(r => ({
      customer: r.customer || '-',
      product: r.product_name || '-',
      batch: r.batch_no || '-',
      expiry: r.expiry_date || '-',
      qty: String(r.quantity || 0),
      status: r.status || '-'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Market Expiry Report', 'market_expiry_report.pdf');
  } catch (err) {
    console.error('Market expiry PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
