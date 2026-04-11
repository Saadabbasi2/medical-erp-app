// routes/vendorCreditNote.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_credit_notes ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get vendor credit notes error:', err);
    res.status(500).json({ error: 'Failed to get credit notes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { noteNo, vendorId, vendorName, amount, date, reason } = req.body;

    const [result] = await pool.query(`
      INSERT INTO vendor_credit_notes (note_no, vendor_id, vendor_name, amount, date, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [noteNo || '', vendorId || null, vendorName || '', amount || 0, date || null, reason || '']);

    const [newRec] = await pool.query('SELECT * FROM vendor_credit_notes WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create credit note error:', err);
    res.status(500).json({ error: 'Failed to create credit note' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM vendor_credit_notes WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM vendor_credit_notes');

    const formatted = records.map(r => ({
      noteNo: r.note_no || '-',
      vendorName: r.vendor_name || '-',
      amount: r.amount ? parseFloat(r.amount).toFixed(2) : '0.00',
      date: r.date || '-',
      reason: r.reason || '-'
    }));

    const columns = [
      { label: 'Note No', key: 'noteNo', widthRatio: 0.15 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.25 },
      { label: 'Amount', key: 'amount', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Reason', key: 'reason', widthRatio: 0.30 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Vendor Credit Notes Report', 'vendor_credit_notes.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
