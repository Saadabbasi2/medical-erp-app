// routes/openInvoices.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

// GET all open invoices
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [invoices] = await pool.query(`
      SELECT id, customer_id, customer_name, payment_method, invoice_date,
             subtotal, tax_amount, withholding_amount, total_amount, status,
             customer_ntn, customer_cnic, created_at, updated_at
      FROM open_invoices
      ORDER BY invoice_date DESC, id DESC
    `);

    // Get products for each invoice
    for (let invoice of invoices) {
      const [products] = await pool.query(`
        SELECT id, product_name, batch, expiry_date, quantity,
               unit_price, discount_percent, line_total
        FROM open_invoice_products
        WHERE open_invoice_id = ?
      `, [invoice.id]);

      invoice.products = products.map(p => ({
        name: p.product_name,
        batch: p.batch,
        expiry: p.expiry_date,
        qty: p.quantity,
        price: parseFloat(p.unit_price),
        discount: parseFloat(p.discount_percent),
        total: parseFloat(p.line_total)
      }));

      invoice.customerId = invoice.customer_id;
      invoice.customer = invoice.customer_name;
      invoice.payment = invoice.payment_method;
      invoice.date = invoice.invoice_date;
      invoice.subtotal = parseFloat(invoice.subtotal);
      invoice.tax = parseFloat(invoice.tax_amount);
      invoice.withholding = parseFloat(invoice.withholding_amount);
      invoice.total = parseFloat(invoice.total_amount);
      invoice.customerNTN = invoice.customer_ntn;
      invoice.customerCNIC = invoice.customer_cnic;
    }

    res.json(invoices);
  } catch (err) {
    console.error('Load open invoices error:', err);
    res.status(500).json({ error: 'Failed to load open invoices' });
  }
});

// POST create open invoice
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let customerId = null, customerName = '';
      if (body.customer !== undefined && body.customer !== null && String(body.customer).trim() !== '') {
        if (/^\d+$/.test(String(body.customer))) {
          customerId = Number(body.customer);
          const [customers] = await connection.query('SELECT * FROM customers WHERE id = ?', [customerId]);
          const found = customers[0];
          customerName = found ? found.name : String(body.customer);
        } else {
          customerName = String(body.customer);
          const [customers] = await connection.query('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)', [customerName]);
          if (customers.length > 0) {
            customerId = customers[0].id;
          }
        }
      }

      let products = [];
      if (Array.isArray(body.products) && body.products.length) {
        products = body.products.map(p => {
          const qty = Number(p.qty ?? p.quantity ?? 0);
          const price = Number(p.price ?? p.unitPrice ?? 0);
          const discount = Number(p.discount ?? p.discountPercent ?? p.disc ?? 0);
          const total = Number(p.total ?? qty * price * (1 - discount / 100));

          return {
            name: p.name ?? p.product ?? 'Unnamed',
            batch: p.batch ?? p.batchNo ?? p.batchNumber ?? (p.batch_name ?? '-'),
            expiry: p.expiry ?? p.expiryDate ?? p.expiry_at ?? p.expiry_date ?? null,
            qty,
            price,
            discount,
            total
          };
        });
      } else {
        const qty = Number(body.qty || 0);
        const price = Number(body.price || 0);
        const discount = Number(body.discount ?? body.discountPercent ?? 0);
        const total = Number(body.total ?? qty * price * (1 - discount / 100));
        products.push({
          name: body.product || 'Unnamed',
          batch: body.batch ?? body.batchNo ?? body.batchNumber ?? '-',
          expiry: body.expiry ?? body.expiryDate ?? null,
          qty,
          price,
          discount,
          total
        });
      }

      if (!products.length) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'At least one product required' });
      }

      const subtotal = products.reduce((s, p) => s + (p.total || 0), 0);
      const tax = Number(body.tax || 0);
      const withholding = Number(body.withholding || 0);
      const total = subtotal + tax - withholding;

      // Lookup customer NTN/CNIC
      let customerNTN = '';
      let customerCNIC = '';
      if (customerId) {
        const [customers] = await connection.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        const rec = customers[0];
        if (rec) {
          customerNTN = rec.ntn || '';
          customerCNIC = rec.cnic || '';
        }
      } else if (customerName) {
        const [customers] = await connection.query('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)', [customerName]);
        const rec = customers[0];
        if (rec) {
          customerNTN = rec.ntn || '';
          customerCNIC = rec.cnic || '';
        }
      }

      // Insert open invoice
      const [result] = await connection.query(`
        INSERT INTO open_invoices (
          customer_id, customer_name, payment_method, invoice_date,
          subtotal, tax_amount, withholding_amount, total_amount,
          status, customer_ntn, customer_cnic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId,
        customerName,
        body.payment || '',
        body.date || new Date().toISOString().split('T')[0],
        subtotal,
        tax,
        withholding,
        total,
        'Open',
        customerNTN,
        customerCNIC
      ]);

      const invoiceId = result.insertId;

      // Insert products
      for (const product of products) {
        await connection.query(`
          INSERT INTO open_invoice_products (
            open_invoice_id, product_name, batch, expiry_date,
            quantity, unit_price, discount_percent, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId,
          product.name,
          product.batch,
          product.expiry,
          product.qty,
          product.price,
          product.discount,
          product.total
        ]);
      }

      await connection.commit();

      // Fetch created invoice
      const [newInvoice] = await connection.query(`
        SELECT id, customer_id, customer_name, payment_method, invoice_date,
               subtotal, tax_amount, withholding_amount, total_amount, status,
               customer_ntn, customer_cnic
        FROM open_invoices
        WHERE id = ?
      `, [invoiceId]);

      const [newProducts] = await connection.query(`
        SELECT id, product_name, batch, expiry_date, quantity,
               unit_price, discount_percent, line_total
        FROM open_invoice_products
        WHERE open_invoice_id = ?
      `, [invoiceId]);

      const invoice = newInvoice[0];
      invoice.products = newProducts.map(p => ({
        name: p.product_name,
        batch: p.batch,
        expiry: p.expiry_date,
        qty: p.quantity,
        price: parseFloat(p.unit_price),
        discount: parseFloat(p.discount_percent),
        total: parseFloat(p.line_total)
      }));

      invoice.customerId = invoice.customer_id;
      invoice.customer = invoice.customer_name;
      invoice.payment = invoice.payment_method;
      invoice.date = invoice.invoice_date;
      invoice.subtotal = parseFloat(invoice.subtotal);
      invoice.tax = parseFloat(invoice.tax_amount);
      invoice.withholding = parseFloat(invoice.withholding_amount);
      invoice.total = parseFloat(invoice.total_amount);
      invoice.customerNTN = invoice.customer_ntn;
      invoice.customerCNIC = invoice.customer_cnic;

      connection.release();
      res.status(201).json(invoice);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('create open invoice', err);
    res.status(500).json({ error: 'Failed to create open invoice' });
  }
});

// DELETE open invoice
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM open_invoices WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('delete open invoice', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Open invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [invoices] = await pool.query(`
      SELECT id, customer_id, customer_name, payment_method, invoice_date,
             subtotal, tax_amount, withholding_amount, total_amount,
             customer_ntn, customer_cnic
      FROM open_invoices
      WHERE id = ?
    `, [id]);

    if (invoices.length === 0) return res.status(404).send('Not found');

    const invoice = invoices[0];

    // Get customer for filer status
    let filerStatus = '';
    if (invoice.customer_id) {
      const [customers] = await pool.query('SELECT filer_status FROM customers WHERE id = ?', [invoice.customer_id]);
      if (customers.length > 0) {
        filerStatus = customers[0].filer_status || '';
      }
    }

    // Get products
    const [products] = await pool.query(`
      SELECT product_name, batch, expiry_date, quantity,
             unit_price, discount_percent, line_total
      FROM open_invoice_products
      WHERE open_invoice_id = ?
    `, [id]);

    const productRows = products.map(p => {
      const expiryValue = p.expiry_date;
      return {
        product: p.product_name || '-',
        batch: p.batch || '-',
        expiry: formatDateValue(expiryValue),
        qty: p.quantity.toString(),
        price: parseFloat(p.unit_price).toFixed(2),
        discount: parseFloat(p.discount_percent).toFixed(2),
        total: parseFloat(p.line_total).toFixed(2)
      };
    });

    // Tax logic
    const resolvedFilerStatus = filerStatus === 'Non-Filer' ? 'Non-Filer' : 'Filer';
    const taxRate = resolvedFilerStatus === 'Non-Filer' ? 0.24 : 0.18;
    const subtotal = productRows.reduce((s, row) => s + (Number(row.total) || 0), 0);
    const taxAmount = subtotal * taxRate;
    const withholding = Number(invoice.withholding_amount || 0);
    const grandTotal = subtotal + taxAmount - withholding;

    const columns = [
      { label: 'Product', key: 'product', widthRatio: 1.3, align: 'left' },
      { label: 'Batch', key: 'batch', widthRatio: 0.9, align: 'left' },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.9 },
      { label: 'Qty', key: 'qty', widthRatio: 0.7, align: 'right' },
      { label: 'Price', key: 'price', widthRatio: 1.0, align: 'right' },
      { label: 'Discount %', key: 'discount', widthRatio: 1.0, align: 'right' },
      { label: 'Total', key: 'total', widthRatio: 1.0, align: 'right' }
    ];

    const headerLines = [
      { label: 'Open Invoice ID', value: invoice.id },
      { label: 'Customer', value: invoice.customer_name || 'Unknown' },
      { label: 'Invoice Date', value: invoice.invoice_date || '-' },
      resolvedFilerStatus ? { label: 'Filer Status', value: resolvedFilerStatus } : null,
      invoice.customer_ntn ? { label: 'NTN', value: invoice.customer_ntn } : null,
      invoice.customer_cnic ? { label: 'CNIC', value: invoice.customer_cnic } : null,
      { label: 'Tax Rate', value: `${(taxRate * 100).toFixed(0)}%` }
    ].filter(Boolean);

    generateERPTablePDF(
      res,
      productRows.length
        ? productRows
        : [{ product: 'No products', batch: '-', expiry: '-', qty: '-', price: '-', discount: '-', total: '-' }],
      columns,
      `Open Invoice #${invoice.id}`,
      `open_invoice_${invoice.id}.pdf`,
      {
        headerLines,
        allowEmpty: true,
        emptyMessage: 'No products attached to this open invoice.',
        summaryLines: [
          { label: 'Subtotal', value: subtotal.toFixed(2) },
          { label: 'Tax', value: taxAmount.toFixed(2) },
          { label: 'Withholding', value: withholding.toFixed(2) },
          { label: 'Total', value: grandTotal.toFixed(2) }
        ]
      }
    );
  } catch (err) {
    console.error('open invoice pdf error', err);
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
