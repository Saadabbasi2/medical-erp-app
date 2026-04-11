// routes/invoices.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

// GET all invoices
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [invoices] = await pool.query(`
      SELECT id, invoice_number, customer_id, customer_name, invoice_date,
             subtotal, tax_amount, withholding_amount, total_amount, status,
             customer_ntn, customer_cnic, filer_status, tax_rate,
             created_at, updated_at
      FROM invoices
      ORDER BY invoice_date DESC, id DESC
    `);

    // Get products and bookings for each invoice
    for (let invoice of invoices) {
      const [products] = await pool.query(`
        SELECT id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM invoice_items
        WHERE invoice_id = ?
      `, [invoice.id]);

      const [bookingLinks] = await pool.query(`
        SELECT booking_id FROM invoice_bookings WHERE invoice_id = ?
      `, [invoice.id]);

      invoice.products = products.map(p => ({
        product: p.product_name,
        group: p.product_group,
        batch: p.batch,
        expiry: p.expiry_date,
        qty: p.quantity,
        bonus: p.bonus,
        price: parseFloat(p.unit_price),
        discount: parseFloat(p.discount_percent),
        total: parseFloat(p.line_total)
      }));

      invoice.bookings = bookingLinks.map(b => b.booking_id);
      invoice.customer = invoice.customer_name;
      invoice.date = invoice.invoice_date;
      invoice.subtotal = parseFloat(invoice.subtotal);
      invoice.tax = parseFloat(invoice.tax_amount);
      invoice.withholding = parseFloat(invoice.withholding_amount);
      invoice.total = parseFloat(invoice.total_amount);
      invoice.customerNTN = invoice.customer_ntn;
      invoice.customerCNIC = invoice.customer_cnic;
      invoice.filerStatus = invoice.filer_status;
      invoice.taxRate = parseFloat(invoice.tax_rate);
    }

    res.json(invoices);
  } catch (err) {
    console.error('Load invoices error:', err);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

// POST - Create new invoice from bookings
router.post('/', async (req, res) => {
  try {
    const { bookingIds = [], date, taxGroup, options = {} } = req.body || {};

    if (!bookingIds || bookingIds.length === 0) {
      return res.status(400).json({ error: 'No bookings selected' });
    }

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get selected bookings
      const placeholders = bookingIds.map(() => '?').join(',');
      const [bookings] = await connection.query(`
        SELECT b.id, b.customer_id, b.customer_name, b.total_amount,
               b.ntn, b.cnic, b.filer_status
        FROM bookings b
        WHERE b.id IN (${placeholders})
      `, bookingIds);

      if (bookings.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'No bookings found' });
      }

      // Calculate totals
      const subtotal = bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

      // Get tax information from first booking
      const primaryBooking = bookings[0];
      const filerStatus = primaryBooking.filer_status || 'Filer';
      const taxRate = filerStatus === 'Filer' ? 0.18 : 0.24;
      const tax = subtotal * taxRate;
      const withholding = options.withholdingTax ? subtotal * 0.05 : 0;
      const total = subtotal + tax - withholding;

      // Get customer info
      let customerId = primaryBooking.customer_id;
      let customerName = primaryBooking.customer_name;

      // Insert invoice
      const [result] = await connection.query(`
        INSERT INTO invoices (
          customer_id, customer_name, invoice_date, subtotal, tax_amount,
          withholding_amount, total_amount, status, customer_ntn, customer_cnic,
          filer_status, tax_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId,
        customerName,
        date || new Date().toISOString().split('T')[0],
        subtotal,
        tax,
        withholding,
        total,
        'Generated',
        primaryBooking.ntn || '',
        primaryBooking.cnic || '',
        filerStatus,
        taxRate
      ]);

      const invoiceId = result.insertId;

      // Link bookings to invoice
      for (const bookingId of bookingIds) {
        await connection.query(`
          INSERT INTO invoice_bookings (invoice_id, booking_id)
          VALUES (?, ?)
        `, [invoiceId, bookingId]);
      }

      // Get all products from all bookings
      const [allProducts] = await connection.query(`
        SELECT bp.product_name, bp.product_group, bp.batch, bp.expiry_date,
               bp.quantity, bp.bonus, bp.unit_price, bp.discount_percent, bp.line_total
        FROM booking_products bp
        WHERE bp.booking_id IN (${placeholders})
      `, bookingIds);

      // Insert invoice items
      for (const product of allProducts) {
        await connection.query(`
          INSERT INTO invoice_items (
            invoice_id, product_name, product_group, batch, expiry_date,
            quantity, bonus, unit_price, discount_percent, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId,
          product.product_name,
          product.product_group,
          product.batch,
          product.expiry_date,
          product.quantity,
          product.bonus,
          product.unit_price,
          product.discount_percent,
          product.line_total
        ]);
      }

      await connection.commit();

      // Fetch created invoice
      const [newInvoice] = await connection.query(`
        SELECT id, invoice_number, customer_id, customer_name, invoice_date,
               subtotal, tax_amount, withholding_amount, total_amount, status,
               customer_ntn, customer_cnic, filer_status, tax_rate,
               created_at, updated_at
        FROM invoices
        WHERE id = ?
      `, [invoiceId]);

      const [newProducts] = await connection.query(`
        SELECT id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM invoice_items
        WHERE invoice_id = ?
      `, [invoiceId]);

      const invoice = newInvoice[0];
      invoice.products = newProducts.map(p => ({
        product: p.product_name,
        group: p.product_group,
        batch: p.batch,
        expiry: p.expiry_date,
        qty: p.quantity,
        bonus: p.bonus,
        price: parseFloat(p.unit_price),
        discount: parseFloat(p.discount_percent),
        total: parseFloat(p.line_total)
      }));

      invoice.bookings = bookingIds;
      invoice.customer = invoice.customer_name;
      invoice.date = invoice.invoice_date;
      invoice.subtotal = parseFloat(invoice.subtotal);
      invoice.tax = parseFloat(invoice.tax_amount);
      invoice.withholding = parseFloat(invoice.withholding_amount);
      invoice.total = parseFloat(invoice.total_amount);
      invoice.customerNTN = invoice.customer_ntn;
      invoice.customerCNIC = invoice.customer_cnic;
      invoice.filerStatus = invoice.filer_status;
      invoice.taxRate = parseFloat(invoice.tax_rate);

      connection.release();
      res.status(201).json(invoice);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// DELETE - Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM invoices WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// GET Invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [invoices] = await pool.query(`
      SELECT id, invoice_number, customer_id, customer_name, invoice_date,
             subtotal, tax_amount, withholding_amount, total_amount, status,
             customer_ntn, customer_cnic, filer_status, tax_rate
      FROM invoices
      WHERE id = ?
    `, [id]);

    if (invoices.length === 0) {
      return res.status(404).send('Invoice not found');
    }

    const invoice = invoices[0];

    // Get products
    const [products] = await pool.query(`
      SELECT product_name, product_group, batch, expiry_date,
             quantity, bonus, unit_price, discount_percent, line_total
      FROM invoice_items
      WHERE invoice_id = ?
    `, [id]);

    // Get related bookings
    const [bookingLinks] = await pool.query(`
      SELECT booking_id FROM invoice_bookings WHERE invoice_id = ?
    `, [id]);

    const bookingInfo = bookingLinks.map(b => b.booking_id).join(', ');

    const productRows = products.map(p => ({
      product: p.product_name || '-',
      group: p.product_group || '-',
      bonus: p.bonus || 0,
      batch: p.batch || '-',
      expiry: formatDateValue(p.expiry_date),
      qty: p.quantity.toString(),
      price: parseFloat(p.unit_price).toFixed(2),
      discount: parseFloat(p.discount_percent).toFixed(2),
      total: parseFloat(p.line_total).toFixed(2)
    }));

    const columns = [
      { label: 'Product', key: 'product', widthRatio: 1.2, align: 'left' },
      { label: 'Group', key: 'group', widthRatio: 0.7, align: 'left' },
      { label: 'Batch', key: 'batch', widthRatio: 0.8, align: 'left' },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.8 },
      { label: 'Qty', key: 'qty', widthRatio: 0.5, align: 'right' },
      { label: 'Bonus', key: 'bonus', widthRatio: 0.5, align: 'right' },
      { label: 'Price', key: 'price', widthRatio: 0.8, align: 'right' },
      { label: 'Discount %', key: 'discount', widthRatio: 0.8, align: 'right' },
      { label: 'Total', key: 'total', widthRatio: 0.8, align: 'right' }
    ];

    const headerLines = [
      { label: 'Invoice ID', value: invoice.id },
      { label: 'Customer', value: invoice.customer_name || 'Unknown' },
      { label: 'Invoice Date', value: invoice.invoice_date || '-' },
      bookingInfo ? { label: 'Related Bookings', value: bookingInfo } : null,
      invoice.filer_status ? { label: 'Filer Status', value: invoice.filer_status } : null,
      invoice.customer_ntn ? { label: 'NTN', value: invoice.customer_ntn } : null,
      invoice.customer_cnic ? { label: 'CNIC', value: invoice.customer_cnic } : null,
      invoice.tax_rate ? { label: 'Tax Rate', value: `${(parseFloat(invoice.tax_rate) * 100).toFixed(0)}%` } : null
    ].filter(Boolean);

    generateERPTablePDF(
      res,
      productRows.length ? productRows : [{ product: 'No products', batch: '-', expiry: '-', qty: '-', price: '-', discount: '-', total: '-' }],
      columns,
      `Invoice #${invoice.id}`,
      `invoice_${invoice.id}.pdf`,
      {
        headerLines,
        allowEmpty: true,
        emptyMessage: 'No products attached to this invoice.',
        summaryLines: [
          { label: 'Subtotal', value: parseFloat(invoice.subtotal || 0).toFixed(2) },
          { label: 'Tax', value: parseFloat(invoice.tax_amount || 0).toFixed(2) },
          { label: 'Withholding', value: parseFloat(invoice.withholding_amount || 0).toFixed(2) },
          { label: 'Total', value: parseFloat(invoice.total_amount || 0).toFixed(2) }
        ]
      }
    );
  } catch (err) {
    console.error('Invoice PDF error:', err);
    res.status(500).send('Failed to generate PDF');
  }
});

function formatDateValue(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return raw.slice(0, 10) || '-';
}

module.exports = router;
