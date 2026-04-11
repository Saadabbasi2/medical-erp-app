// routes/chequeBook.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_books ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get cheque books error:', err);
    res.status(500).json({ error: 'Failed to get cheque books' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { bookNo, bankAccount, startNo, endNo, issuedDate } = req.body;

    const [result] = await pool.query(`
      INSERT INTO cheque_books (book_no, bank_account, start_no, end_no, issued_date)
      VALUES (?, ?, ?, ?, ?)
    `, [bookNo || '', bankAccount || '', startNo || '', endNo || '', issuedDate || null]);

    const [newRec] = await pool.query('SELECT * FROM cheque_books WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create cheque book error:', err);
    res.status(500).json({ error: 'Failed to create cheque book' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM cheque_books WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM cheque_books');

    const formatted = records.map(r => ({
      bookNo: r.book_no || '-',
      bankAccount: r.bank_account || '-',
      startNo: r.start_no || '-',
      endNo: r.end_no || '-',
      issuedDate: r.issued_date || '-'
    }));

    const columns = [
      { label: 'Book No', key: 'bookNo', widthRatio: 0.20 },
      { label: 'Bank Account', key: 'bankAccount', widthRatio: 0.25 },
      { label: 'Start No', key: 'startNo', widthRatio: 0.15 },
      { label: 'End No', key: 'endNo', widthRatio: 0.15 },
      { label: 'Issued Date', key: 'issuedDate', widthRatio: 0.25 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Cheque Books Report', 'cheque_books.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
