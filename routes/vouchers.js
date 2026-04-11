// routes/vouchers.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [vouchers] = await pool.query('SELECT * FROM vouchers ORDER BY created_at DESC');
    res.json(vouchers);
  } catch (err) {
    console.error('Get vouchers error:', err);
    res.status(500).json({ error: 'Failed to get vouchers' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { voucherNo, date, type, account, amount, status, narration } = req.body;

    const [result] = await pool.query(`
      INSERT INTO vouchers (voucher_no, date, type, account, amount, status, narration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [voucherNo || '', date || null, type || '', account || '', amount || 0, status || 'Draft', narration || '']);

    const [newVoucher] = await pool.query('SELECT * FROM vouchers WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newVoucher[0] });
  } catch (err) {
    console.error('Create voucher error:', err);
    res.status(500).json({ error: 'Failed to create voucher' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM vouchers WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [vouchers] = await pool.query('SELECT * FROM vouchers');

    const formatted = vouchers.map(v => ({
      voucherNo: v.voucher_no || '-',
      date: v.date || '-',
      type: v.type || '-',
      account: v.account || '-',
      amount: v.amount ? parseFloat(v.amount).toFixed(2) : '0.00',
      status: v.status || '-',
      narration: v.narration || '-'
    }));

    const columns = [
      { label: 'Voucher No', key: 'voucherNo', widthRatio: 0.15 },
      { label: 'Date', key: 'date', widthRatio: 0.15 },
      { label: 'Type', key: 'type', widthRatio: 0.15 },
      { label: 'Account', key: 'account', widthRatio: 0.15 },
      { label: 'Amount', key: 'amount', widthRatio: 0.10 },
      { label: 'Status', key: 'status', widthRatio: 0.10 },
      { label: 'Narration', key: 'narration', widthRatio: 0.20 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Voucher Report', 'voucher_report.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
