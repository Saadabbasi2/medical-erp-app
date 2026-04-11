// routes/purchaseInvoice.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [invoices] = await pool.query('SELECT * FROM purchase_invoices ORDER BY created_at DESC');
    res.json(invoices);
  } catch (err) {
    console.error('Get purchase invoices error:', err);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { invoiceNumber, poNumber, vendorId, vendorName, invoiceDate, dueDate, totalAmount, paidAmount, status, remarks } = req.body;

    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const balance = total - paid;

    const [result] = await pool.query(`
      INSERT INTO purchase_invoices (invoice_number, po_number, vendor_id, vendor_name, invoice_date, due_date, total_amount, paid_amount, balance, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceNumber || `PI-${Date.now()}`,
      poNumber || '',
      vendorId || null,
      vendorName || '',
      invoiceDate || new Date().toISOString().split('T')[0],
      dueDate || null,
      total,
      paid,
      balance,
      status || 'Pending',
      remarks || ''
    ]);

    const [newInvoice] = await pool.query('SELECT * FROM purchase_invoices WHERE id = ?', [result.insertId]);
    res.status(201).json(newInvoice[0]);
  } catch (err) {
    console.error('Create purchase invoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/:id/payment', async (req, res) => {
  try {
    const pool = getPool();
    const { paymentAmount } = req.body;

    const [invoices] = await pool.query('SELECT * FROM purchase_invoices WHERE id = ?', [parseInt(req.params.id)]);
    if (!invoices.length) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invoices[0];
    const newPaidAmount = (parseFloat(invoice.paid_amount) || 0) + (parseFloat(paymentAmount) || 0);
    const newBalance = (parseFloat(invoice.total_amount) || 0) - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

    await pool.query(`
      UPDATE purchase_invoices 
      SET paid_amount = ?, balance = ?, status = ?
      WHERE id = ?
    `, [newPaidAmount, newBalance, newStatus, parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM purchase_invoices WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM purchase_invoices WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [invoices] = await pool.query('SELECT * FROM purchase_invoices');

    const formatted = invoices.map(i => ({
      invoiceNumber: i.invoice_number || '-',
      vendorName: i.vendor_name || '-',
      invoiceDate: i.invoice_date || '-',
      totalAmount: (parseFloat(i.total_amount) || 0).toFixed(2),
      paidAmount: (parseFloat(i.paid_amount) || 0).toFixed(2),
      balance: (parseFloat(i.balance) || 0).toFixed(2),
      status: i.status || '-'
    }));

    const columns = [
      { label: 'Invoice No', key: 'invoiceNumber', widthRatio: 0.15 },
      { label: 'Vendor', key: 'vendorName', widthRatio: 0.20 },
      { label: 'Date', key: 'invoiceDate', widthRatio: 0.12 },
      { label: 'Total', key: 'totalAmount', widthRatio: 0.13 },
      { label: 'Paid', key: 'paidAmount', widthRatio: 0.13 },
      { label: 'Balance', key: 'balance', widthRatio: 0.13 },
      { label: 'Status', key: 'status', widthRatio: 0.14 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Purchase Invoices Report', 'purchase_invoices.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
