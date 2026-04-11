// routes/regenerateExpiryRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM regenerate_expiry ORDER BY created_at DESC');
    res.json(data);
  } catch (err) {
    console.error('Get regenerate expiry error:', err);
    res.status(500).json({ error: 'Failed to get records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { productName, oldBatch, newBatch, oldExpiry, newExpiry, quantity, reason, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO regenerate_expiry (product_name, old_batch, new_batch, old_expiry, new_expiry, quantity, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [productName || '', oldBatch || '', newBatch || '', oldExpiry || null, newExpiry || null, quantity || 0, reason || '', status || 'Pending']);

    res.json({ message: 'Regenerate expiry record added', id: result.insertId });
  } catch (err) {
    console.error('Add regenerate expiry error:', err);
    res.status(500).json({ error: 'Failed to add record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM regenerate_expiry WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM regenerate_expiry');

    const formatted = data.map(d => ({
      product: d.product_name || '-',
      oldBatch: d.old_batch || '-',
      newBatch: d.new_batch || '-',
      oldExpiry: d.old_expiry || '-',
      newExpiry: d.new_expiry || '-',
      quantity: d.quantity || 0,
      status: d.status || '-'
    }));

    const columns = [
      { label: 'Product', key: 'product', widthRatio: 0.20 },
      { label: 'Old Batch', key: 'oldBatch', widthRatio: 0.15 },
      { label: 'New Batch', key: 'newBatch', widthRatio: 0.15 },
      { label: 'Old Expiry', key: 'oldExpiry', widthRatio: 0.15 },
      { label: 'New Expiry', key: 'newExpiry', widthRatio: 0.15 },
      { label: 'Qty', key: 'quantity', widthRatio: 0.10 },
      { label: 'Status', key: 'status', widthRatio: 0.10 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Regenerate Expiry Report', 'regenerate_expiry.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
