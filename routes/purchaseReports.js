// routes/purchaseReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [reports] = await pool.query('SELECT * FROM purchase_reports ORDER BY generated_at DESC');
        res.json(reports);
    } catch (err) {
        console.error('Get purchase reports error:', err);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

router.post('/generate', async (req, res) => {
    try {
        const pool = getPool();
        const { reportType, reportPeriod } = req.body;

        // Get purchase orders statistics
        const [orderStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_amount
      FROM purchase_orders
    `);

        // Get purchase invoices statistics
        const [invoiceStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(paid_amount) as total_paid,
        SUM(balance) as total_pending
      FROM purchase_invoices
    `);

        const orders = orderStats[0];
        const invoices = invoiceStats[0];

        const [result] = await pool.query(`
      INSERT INTO purchase_reports (report_type, report_period, total_orders, total_amount, total_invoices, total_paid, total_pending)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
            reportType || 'Summary',
            reportPeriod || new Date().toISOString().split('T')[0],
            orders.total_orders || 0,
            orders.total_amount || 0,
            invoices.total_invoices || 0,
            invoices.total_paid || 0,
            invoices.total_pending || 0
        ]);

        const [newReport] = await pool.query('SELECT * FROM purchase_reports WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: newReport[0] });
    } catch (err) {
        console.error('Generate purchase report error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

router.get('/export/pdf', async (req, res) => {
    try {
        const pool = getPool();
        const [reports] = await pool.query('SELECT * FROM purchase_reports');

        if (!reports || !reports.length) {
            return res.status(404).json({ error: 'No purchase report data found' });
        }

        const formatted = reports.map(r => ({
            reportType: r.report_type || '-',
            period: r.report_period || '-',
            totalOrders: r.total_orders || 0,
            totalAmount: (parseFloat(r.total_amount) || 0).toFixed(2),
            totalInvoices: r.total_invoices || 0,
            totalPaid: (parseFloat(r.total_paid) || 0).toFixed(2),
            totalPending: (parseFloat(r.total_pending) || 0).toFixed(2)
        }));

        const columns = [
            { label: 'Report Type', key: 'reportType', widthRatio: 0.15 },
            { label: 'Period', key: 'period', widthRatio: 0.12 },
            { label: 'Orders', key: 'totalOrders', widthRatio: 0.10 },
            { label: 'Order Amt', key: 'totalAmount', widthRatio: 0.15 },
            { label: 'Invoices', key: 'totalInvoices', widthRatio: 0.10 },
            { label: 'Paid', key: 'totalPaid', widthRatio: 0.15 },
            { label: 'Pending', key: 'totalPending', widthRatio: 0.15 }
        ];

        generateERPTablePDF(res, formatted, columns, 'Purchase Summary Report', 'purchase_reports.pdf');
    } catch (err) {
        console.error('Export PDF error:', err);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

module.exports = router;
