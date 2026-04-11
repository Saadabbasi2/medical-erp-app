// routes/chequeConversion.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_conversions ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get cheque conversions error:', err);
    res.status(500).json({ error: 'Failed to get conversions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { chequeNo, conversionType, amount, date, remarks } = req.body;

    const [result] = await pool.query(`
      INSERT INTO cheque_conversions (cheque_no, conversion_type, amount, date, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [chequeNo || '', conversionType || '', amount || 0, date || null, remarks || '']);

    const [newRec] = await pool.query('SELECT * FROM cheque_conversions WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create conversion error:', err);
    res.status(500).json({ error: 'Failed to create conversion' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM cheque_conversions WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_conversions');

    const formatted = records.map(r => ({
      chequeNo: r.cheque_no || '-',
      conversionType: r.conversion_type || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      remarks: r.remarks || '-'
    }));

    const columns = [
      { label: 'Cheque No', key: 'chequeNo', widthRatio: 0.20 },
      { label: 'Conversion Type', key: 'conversionType', widthRatio: 0.20 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.20 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Cheque Conversions Report', 'cheque_conversions.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
