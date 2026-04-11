// routes/storeExpiryRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

function calcRemainingDays(expDate) {
  const today = new Date();
  const expiry = new Date(expDate);
  const diff = expiry - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* GET all batches */
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM store_expiry ORDER BY expiry_date ASC');
    res.json(data);
  } catch (err) {
    console.error('Get store expiry error:', err);
    res.status(500).json({ error: 'Failed to get store expiry' });
  }
});

/* ADD new batch */
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { productName, batchNo, expiryDate, quantity, location, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO store_expiry (product_name, batch_no, expiry_date, quantity, location, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [productName || '', batchNo || '', expiryDate || null, quantity || 0, location || '', status || 'Active']);

    res.json({ message: 'Batch added successfully', id: result.insertId });
  } catch (err) {
    console.error('Add store expiry error:', err);
    res.status(500).json({ error: 'Failed to add batch' });
  }
});

/* DELETE batch */
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM store_expiry WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    console.error('Delete store expiry error:', err);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

/* EXPORT PDF */
router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [batches] = await pool.query('SELECT * FROM store_expiry');

    if (!batches || !batches.length) {
      return res.status(404).json({ error: 'No store expiry data found' });
    }

    const columns = [
      { label: 'Batch No', key: 'batchNo', widthRatio: 0.13 },
      { label: 'Product', key: 'product', widthRatio: 0.20 },
      { label: 'Location', key: 'location', widthRatio: 0.17 },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.17 },
      { label: 'Remaining Days', key: 'remaining', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.15 }
    ];

    const transformedData = batches.map(b => {
      const remaining = calcRemainingDays(b.expiry_date);
      const status = remaining <= 0 ? 'Expired' : remaining <= 30 ? 'Near Expiry' : 'Good';
      return {
        batchNo: b.batch_no || '-',
        product: b.product_name || '-',
        location: b.location || '-',
        expiry: b.expiry_date || '-',
        remaining: String(remaining),
        status: status
      };
    });

    generateERPTablePDF(res, transformedData, columns, 'Store Expiry Report', 'store_expiry_report.pdf');
  } catch (err) {
    console.error('Store expiry PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
