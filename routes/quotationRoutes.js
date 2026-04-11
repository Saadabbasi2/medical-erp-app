// routes/quotationRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [quotations] = await pool.query('SELECT * FROM quotations ORDER BY created_at DESC');
        res.json(quotations);
    } catch (err) {
        console.error('Get quotations error:', err);
        res.status(500).json({ error: 'Failed to get quotations' });
    }
});

router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { quotationNumber, vendorId, vendorName, quotationDate, validUntil, totalAmount, status, remarks } = req.body;

        const [result] = await pool.query(`
      INSERT INTO quotations (quotation_number, vendor_id, vendor_name, quotation_date, valid_until, total_amount, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            quotationNumber || `QT-${Date.now()}`,
            vendorId || null,
            vendorName || '',
            quotationDate || new Date().toISOString().split('T')[0],
            validUntil || null,
            totalAmount || 0,
            status || 'Draft',
            remarks || ''
        ]);

        const [newQuotation] = await pool.query('SELECT * FROM quotations WHERE id = ?', [result.insertId]);
        res.status(201).json(newQuotation[0]);
    } catch (err) {
        console.error('Create quotation error:', err);
        res.status(500).json({ error: 'Failed to create quotation' });
    }
});

router.put('/:id/accept', async (req, res) => {
    try {
        const pool = getPool();

        await pool.query(`
      UPDATE quotations 
      SET status = 'Accepted'
      WHERE id = ?
    `, [parseInt(req.params.id)]);

        const [updated] = await pool.query('SELECT * FROM quotations WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true, data: updated[0] });
    } catch (err) {
        console.error('Accept quotation error:', err);
        res.status(500).json({ error: 'Failed to accept quotation' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.query('DELETE FROM quotations WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

router.get('/export/pdf', async (req, res) => {
    try {
        const pool = getPool();
        const [quotations] = await pool.query('SELECT * FROM quotations');

        const formatted = quotations.map(q => ({
            quotationNumber: q.quotation_number || '-',
            vendorName: q.vendor_name || '-',
            quotationDate: q.quotation_date || '-',
            validUntil: q.valid_until || '-',
            totalAmount: (parseFloat(q.total_amount) || 0).toFixed(2),
            status: q.status || '-'
        }));

        const columns = [
            { label: 'Quotation No', key: 'quotationNumber', widthRatio: 0.15 },
            { label: 'Vendor', key: 'vendorName', widthRatio: 0.25 },
            { label: 'Date', key: 'quotationDate', widthRatio: 0.15 },
            { label: 'Valid Until', key: 'validUntil', widthRatio: 0.15 },
            { label: 'Amount', key: 'totalAmount', widthRatio: 0.15 },
            { label: 'Status', key: 'status', widthRatio: 0.15 }
        ];

        generateERPTablePDF(res, formatted, columns, 'Quotations Report', 'quotations.pdf');
    } catch (err) {
        console.error('Export PDF error:', err);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

module.exports = router;
