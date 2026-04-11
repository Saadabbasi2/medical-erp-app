// routes/rfqRoutes.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [rfqs] = await pool.query('SELECT * FROM rfq ORDER BY created_at DESC');
        res.json(rfqs);
    } catch (err) {
        console.error('Get RFQs error:', err);
        res.status(500).json({ error: 'Failed to get RFQs' });
    }
});

router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { rfqNumber, vendorId, vendorName, rfqDate, responseDeadline, status, remarks } = req.body;

        const [result] = await pool.query(`
      INSERT INTO rfq (rfq_number, vendor_id, vendor_name, rfq_date, response_deadline, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
            rfqNumber || `RFQ-${Date.now()}`,
            vendorId || null,
            vendorName || '',
            rfqDate || new Date().toISOString().split('T')[0],
            responseDeadline || null,
            status || 'Sent',
            remarks || ''
        ]);

        const [newRFQ] = await pool.query('SELECT * FROM rfq WHERE id = ?', [result.insertId]);
        res.status(201).json(newRFQ[0]);
    } catch (err) {
        console.error('Create RFQ error:', err);
        res.status(500).json({ error: 'Failed to create RFQ' });
    }
});

router.put('/:id/respond', async (req, res) => {
    try {
        const pool = getPool();

        await pool.query(`
      UPDATE rfq 
      SET status = 'Responded'
      WHERE id = ?
    `, [parseInt(req.params.id)]);

        const [updated] = await pool.query('SELECT * FROM rfq WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true, data: updated[0] });
    } catch (err) {
        console.error('Respond RFQ error:', err);
        res.status(500).json({ error: 'Failed to respond RFQ' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.query('DELETE FROM rfq WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

router.get('/export/pdf', async (req, res) => {
    try {
        const pool = getPool();
        const [rfqs] = await pool.query('SELECT * FROM rfq');

        const formatted = rfqs.map(r => ({
            rfqNumber: r.rfq_number || '-',
            vendorName: r.vendor_name || '-',
            rfqDate: r.rfq_date || '-',
            responseDeadline: r.response_deadline || '-',
            status: r.status || '-'
        }));

        const columns = [
            { label: 'RFQ No', key: 'rfqNumber', widthRatio: 0.20 },
            { label: 'Vendor', key: 'vendorName', widthRatio: 0.25 },
            { label: 'RFQ Date', key: 'rfqDate', widthRatio: 0.18 },
            { label: 'Deadline', key: 'responseDeadline', widthRatio: 0.18 },
            { label: 'Status', key: 'status', widthRatio: 0.19 }
        ];

        generateERPTablePDF(res, formatted, columns, 'RFQ Report', 'rfq_report.pdf');
    } catch (err) {
        console.error('Export PDF error:', err);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

module.exports = router;
