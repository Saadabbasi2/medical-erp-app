// routes/salesReturns.js - MySQL Version
const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { getPool } = require('../db-mysql');

const router = express.Router();

// GET all sales returns
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [returns] = await pool.query(`
      SELECT sr.id, sr.invoice_id, sr.return_date, sr.total_amount,
             sr.reason, sr.status, sr.created_at,
             i.customer_name as customer_name,
             i.id as invoice_number
      FROM sales_returns sr
      LEFT JOIN invoices i ON sr.invoice_id = i.id
      ORDER BY sr.return_date DESC, sr.id DESC
    `);

    // Get products for each return
    for (let ret of returns) {
      const [products] = await pool.query(`
        SELECT id, product_name, batch, quantity, unit_price, line_total, reason
        FROM sales_return_products
        WHERE return_id = ?
      `, [ret.id]);

      ret.products = products.map(p => ({
        product: p.product_name,
        batch: p.batch,
        qty: p.quantity,
        price: parseFloat(p.unit_price),
        total: parseFloat(p.line_total),
        reason: p.reason
      }));

      ret.invoiceId = ret.invoice_id;
      ret.invoiceNumber = ret.invoice_number;
      ret.customerName = ret.customer_name || '-';
      ret.amount = parseFloat(ret.total_amount);
      ret.date = ret.return_date;
    }

    res.json(returns);
  } catch (err) {
    console.error('load sales returns', err);
    res.status(500).json({ error: 'Failed to load' });
  }
});

// POST create sales return
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingProducts = Array.isArray(body.products) && body.products.length
      ? body.products
      : (body.product ? [{
        product: body.product,
        batch: body.batch || '',
        qty: Number(body.qty || 1),
        price: Number(body.price || 0),
        total: Number(body.total ?? (Number(body.qty || 1) * Number(body.price || 0))),
        reason: body.reason || ''
      }] : []);

    if (!incomingProducts.length) return res.status(400).json({ error: 'At least one product required' });

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const invoiceId = body.invoiceId || null;
      let refInvoice = null;
      let customerId = null;

      if (invoiceId) {
        const [invoices] = await connection.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        refInvoice = invoices[0];
        customerId = refInvoice?.customer_id;
      }

      // Compute aggregate amounts
      const reversedAmount = incomingProducts.reduce((s, p) => s + (Number(p.total || 0)), 0);

      // Insert sales return
      const [result] = await connection.query(`
        INSERT INTO sales_returns (
          invoice_id, customer_id, return_date, total_amount, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        customerId,
        new Date().toISOString().split('T')[0],
        reversedAmount,
        body.reason || (incomingProducts[0] && incomingProducts[0].reason) || '',
        'pending'
      ]);

      const returnId = result.insertId;

      // Insert products
      for (const p of incomingProducts) {
        await connection.query(`
          INSERT INTO sales_return_products (
            return_id, product_name, batch, quantity, unit_price, line_total, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          returnId,
          p.product || '',
          p.batch || '',
          Number(p.qty || 0),
          Number(p.price || 0),
          Number(p.total || (Number(p.qty || 0) * Number(p.price || 0))),
          p.reason || ''
        ]);
      }

      // Update referenced invoice if present
      if (refInvoice) {
        await connection.query(`UPDATE invoices SET status = ? WHERE id = ?`, ['returned', invoiceId]);
      }

      await connection.commit();

      // Fetch created return
      const [newReturn] = await connection.query(`
        SELECT sr.id, sr.invoice_id, sr.return_date, sr.total_amount,
               sr.reason, sr.status, sr.created_at,
               i.customer_name as customer_name,
               i.id as invoice_number
        FROM sales_returns sr
        LEFT JOIN invoices i ON sr.invoice_id = i.id
        WHERE sr.id = ?
      `, [returnId]);

      const [newProducts] = await connection.query(`
        SELECT id, product_name, batch, quantity, unit_price, line_total, reason
        FROM sales_return_products
        WHERE return_id = ?
      `, [returnId]);

      const ret = newReturn[0];
      ret.products = newProducts.map(p => ({
        product: p.product_name,
        batch: p.batch,
        qty: p.quantity,
        price: parseFloat(p.unit_price),
        total: parseFloat(p.line_total),
        reason: p.reason
      }));

      ret.invoiceId = ret.invoice_id;
      ret.invoiceNumber = ret.invoice_number;
      ret.customerName = ret.customer_name || '-';
      ret.amount = parseFloat(ret.total_amount);
      ret.date = ret.return_date;

      connection.release();
      res.status(201).json(ret);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('create sales return', err);
    res.status(500).json({ error: 'Failed to create' });
  }
});

// DELETE sales return
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM sales_returns WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Sales return not found' });
    }

    res.json({ message: 'Sales return deleted' });
  } catch (err) {
    console.error('delete sales return', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Sales return PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [returns] = await pool.query(`
      SELECT sr.id, sr.invoice_id, sr.return_date, sr.total_amount,
             sr.reason, sr.status,
             i.customer_name, i.customer_ntn, i.customer_cnic, i.filer_status
      FROM sales_returns sr
      LEFT JOIN invoices i ON sr.invoice_id = i.id
      WHERE sr.id = ?
    `, [id]);

    if (returns.length === 0) return res.status(404).send('Sales return not found');

    const salesReturn = returns[0];

    const [products] = await pool.query(`
      SELECT product_name, batch, quantity, unit_price, line_total, reason
      FROM sales_return_products
      WHERE return_id = ?
    `, [id]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales_return_${id}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Logo
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fsExists(logoPath)) doc.image(logoPath, { width: 100, align: 'center' });

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#04792d').text(`Sales Return #${salesReturn.id}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.fillColor('black').font('Helvetica').fontSize(10);

    const customerName = salesReturn.customer_name || '-';
    doc.text(`Invoice Number: ${salesReturn.invoice_id || '-'}`);
    doc.text(`Customer: ${customerName}`);
    doc.text(`Date: ${new Date(salesReturn.return_date).toLocaleDateString()}`);
    doc.text(`Reason: ${salesReturn.reason || '-'}`);
    if (salesReturn.customer_ntn) doc.text(`NTN: ${salesReturn.customer_ntn}`);
    if (salesReturn.customer_cnic) doc.text(`CNIC: ${salesReturn.customer_cnic}`);
    if (salesReturn.filer_status) doc.text(`Filer Status: ${salesReturn.filer_status}`);
    doc.moveDown(0.6);

    // Product table
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;

    if (products.length > 0) {
      const colWidths = {
        product: Math.floor(contentWidth * 0.40),
        batch: Math.floor(contentWidth * 0.18),
        qty: Math.floor(contentWidth * 0.10),
        price: Math.floor(contentWidth * 0.16),
        total: Math.floor(contentWidth * 0.16)
      };
      const colX = {
        product: left,
        batch: left + colWidths.product,
        qty: left + colWidths.product + colWidths.batch,
        price: left + colWidths.product + colWidths.batch + colWidths.qty,
        total: left + colWidths.product + colWidths.batch + colWidths.qty + colWidths.price
      };

      // Header
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Product', colX.product, doc.y, { width: colWidths.product });
      doc.text('Batch', colX.batch, doc.y, { width: colWidths.batch });
      doc.text('Qty', colX.qty, doc.y, { width: colWidths.qty, align: 'right' });
      doc.text('Price', colX.price, doc.y, { width: colWidths.price, align: 'right' });
      doc.text('Total', colX.total, doc.y, { width: colWidths.total, align: 'right' });
      doc.moveDown(0.3);
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#e9e9e9').stroke();
      doc.moveDown(0.4);

      // Rows
      doc.font('Helvetica').fontSize(10);
      let running = 0;
      for (const p of products) {
        const rowY = doc.y;
        doc.text(p.product_name || '-', colX.product, rowY, { width: colWidths.product });
        doc.text(p.batch || '-', colX.batch, rowY, { width: colWidths.batch });
        doc.text(String(p.quantity || 0), colX.qty, rowY, { width: colWidths.qty, align: 'right' });
        doc.text(Number(p.unit_price || 0).toFixed(2), colX.price, rowY, { width: colWidths.price, align: 'right' });
        doc.text(Number(p.line_total || 0).toFixed(2), colX.total, rowY, { width: colWidths.total, align: 'right' });
        running += Number(p.line_total || 0);
        doc.moveDown(0.8);

        if (doc.y > doc.page.height - doc.page.margins.bottom - 140) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666').text('...more items omitted...', left, doc.y);
          doc.fillColor('#000000').font('Helvetica').fontSize(10);
          break;
        }
      }

      // Totals
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Return Amount', colX.price, doc.y, { width: colWidths.price, align: 'right' });
      doc.text(Number(salesReturn.total_amount || running).toFixed(2), colX.total, doc.y, { width: colWidths.total, align: 'right' });
    }

    // Footer
    const footerLines = [
      'Faizan Medicine Company',
      'House No CB-81/1, Iqbal Road Supply Mansehra Road (Abbottabad)',
      'Phone: +92 3028225831 , +92 3127000265',
      'Email: fezanmc@gmail.com , fezanmc@yahoo.com',
      'Thank you for your business!'
    ];
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let fy = doc.page.height - doc.page.margins.bottom - 70;
    doc.font('Helvetica').fontSize(9).fillColor('gray');
    footerLines.forEach(line => {
      doc.text(line, doc.page.margins.left, fy, { width: contentW, align: 'center' });
      fy += 12;
    });

    doc.end();
  } catch (err) {
    console.error('sales return pdf error', err);
    res.status(500).send('Failed to generate PDF');
  }
});

function fsExists(p) {
  try {
    const fs = require('fs');
    return fs.existsSync(p);
  } catch (e) { return false; }
}

module.exports = router;
