// routes/vendorManagement.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [vendors] = await pool.query('SELECT * FROM vendors ORDER BY created_at DESC');
        res.json(vendors);
    } catch (err) {
        console.error('Get vendors error:', err);
        res.status(500).json({ error: 'Failed to get vendors' });
    }
});

router.post('/', async (req, res) => {
    try {
        const pool = getPool();
        const { vendorCode, vendorName, contactPerson, phone, email, address, city, country, paymentTerms, creditLimit, status } = req.body;

        const [result] = await pool.query(`
      INSERT INTO vendors (vendor_code, vendor_name, contact_person, phone, email, address, city, country, payment_terms, credit_limit, current_balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            vendorCode || `V-${Date.now()}`,
            vendorName || '',
            contactPerson || '',
            phone || '',
            email || '',
            address || '',
            city || '',
            country || '',
            paymentTerms || '',
            creditLimit || 0,
            0,
            status || 'Active'
        ]);

        const [newVendor] = await pool.query('SELECT * FROM vendors WHERE id = ?', [result.insertId]);
        res.status(201).json(newVendor[0]);
    } catch (err) {
        console.error('Create vendor error:', err);
        res.status(500).json({ error: 'Failed to create vendor' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { vendorName, contactPerson, phone, email, address, city, country, paymentTerms, creditLimit, status } = req.body;

        await pool.query(`
      UPDATE vendors 
      SET vendor_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, city = ?, country = ?, payment_terms = ?, credit_limit = ?, status = ?
      WHERE id = ?
    `, [vendorName, contactPerson, phone, email, address, city, country, paymentTerms, creditLimit, status, parseInt(req.params.id)]);

        const [updated] = await pool.query('SELECT * FROM vendors WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true, data: updated[0] });
    } catch (err) {
        console.error('Update vendor error:', err);
        res.status(500).json({ error: 'Failed to update vendor' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const pool = getPool();
        await pool.query('DELETE FROM vendors WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

router.get('/export/pdf', async (req, res) => {
    try {
        const pool = getPool();
        const [vendors] = await pool.query('SELECT * FROM vendors');

        const formatted = vendors.map(v => ({
            vendorCode: v.vendor_code || '-',
            vendorName: v.vendor_name || '-',
            contactPerson: v.contact_person || '-',
            phone: v.phone || '-',
            email: v.email || '-',
            city: v.city || '-',
            status: v.status || '-'
        }));

        const columns = [
            { label: 'Code', key: 'vendorCode', widthRatio: 0.12 },
            { label: 'Vendor Name', key: 'vendorName', widthRatio: 0.20 },
            { label: 'Contact', key: 'contactPerson', widthRatio: 0.18 },
            { label: 'Phone', key: 'phone', widthRatio: 0.15 },
            { label: 'Email', key: 'email', widthRatio: 0.20 },
            { label: 'City', key: 'city', widthRatio: 0.10 },
            { label: 'Status', key: 'status', widthRatio: 0.05 }
        ];

        generateERPTablePDF(res, formatted, columns, 'Vendors Report', 'vendors.pdf');
    } catch (err) {
        console.error('Export PDF error:', err);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

module.exports = router;
