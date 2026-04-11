// routes/voucherTypes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [types] = await pool.query('SELECT * FROM voucher_types ORDER BY created_at DESC');
    res.json(types);
  } catch (err) {
    console.error('Get voucher types error:', err);
    res.status(500).json({ error: 'Failed to get voucher types' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { typeName, prefix, description } = req.body;

    const [result] = await pool.query(`
      INSERT INTO voucher_types (type_name, prefix, description)
      VALUES (?, ?, ?)
    `, [typeName || '', prefix || '', description || '']);

    const [newType] = await pool.query('SELECT * FROM voucher_types WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newType[0] });
  } catch (err) {
    console.error('Create voucher type error:', err);
    res.status(500).json({ error: 'Failed to create voucher type' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM voucher_types WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete voucher type error:', err);
    res.status(500).json({ error: 'Failed to delete voucher type' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [types] = await pool.query('SELECT * FROM voucher_types');

    const formatted = types.map(t => ({
      typeName: t.type_name || '-',
      prefix: t.prefix || '-',
      description: t.description || '-'
    }));

    const columns = [
      { label: 'Type Name', key: 'typeName', widthRatio: 0.30 },
      { label: 'Prefix', key: 'prefix', widthRatio: 0.20 },
      { label: 'Description', key: 'description', widthRatio: 0.50 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Voucher Types Report', 'voucher_types.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
