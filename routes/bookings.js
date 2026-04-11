// routes/bookings.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

function normName(v) {
  return String(v || '').trim().toLowerCase();
}

function buildQtyMap(list = []) {
  const m = new Map();
  (list || []).forEach(p => {
    const name = normName(p.product || p.product_name || p.productName || p.product_name || p.item_name || p.productName || p.product || '');
    if (!name) return;
    const qty = Number(p.qty ?? p.quantity ?? p.quantity_sold ?? p.quantitySold ?? p.quantity) || 0;
    if (!qty) return;
    m.set(name, (m.get(name) || 0) + qty);
  });
  return m;
}

async function applyDmsStockDelta(connection, qtyMap, direction /* -1 deduct, +1 add */) {
  if (!qtyMap || qtyMap.size === 0) return;
  for (const [name, qty] of qtyMap.entries()) {
    const delta = Math.round(Number(qty) || 0) * direction;
    if (!delta) continue;
    // status column is used as numeric strength for master_type='items'
    await connection.query(
      `
      UPDATE dms_masters
      SET status = GREATEST(CAST(status AS SIGNED) + ?, 0)
      WHERE master_type = 'items' AND LOWER(name) = LOWER(?)
      `,
      [delta, name]
    );
  }
}

// Helper: format a date value to YYYY-MM-DD only (strips timezone)
function formatDate(val) {
  if (!val) return '-';
  // If it's already a Date object or a JS datetime string, extract only date part
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // Fallback: just take the first 10 chars if it's already a string like '2025-02-03 15:43:13'
  return String(val).substring(0, 10);
}

// GET bookings PDF for a single invoice/booking
router.get('/export/pdf/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    const b = bookings[0];

    const [products] = await pool.query('SELECT * FROM booking_products WHERE booking_id = ? ORDER BY id', [b.id]);

    // Try to resolve salesman name from salesman_orders snapshot notes (created on booking save)
    let salesmanName = '';
    try {
      const like = `%\"bookingId\":${Number(b.id)}%`;
      const [soRows] = await pool.query(
        `SELECT salesman_id FROM salesman_orders WHERE notes LIKE ? ORDER BY created_at DESC, id DESC LIMIT 1`,
        [like]
      );
      const sid = soRows?.[0]?.salesman_id ? parseInt(soRows[0].salesman_id) : null;
      if (sid) {
        const [sRows] = await pool.query(`SELECT name FROM salesmen WHERE id = ? LIMIT 1`, [sid]);
        salesmanName = sRows?.[0]?.name || '';
      }
    } catch (e) {
      // ignore lookup failures; PDF still generates
      salesmanName = '';
    }

    const headerLines = [
      { label: 'Booking ID', value: String(b.id).padStart(6, '0') },
      { label: 'Customer', value: b.customer_name || 'N/A' },
      { label: 'Route', value: b.route || 'N/A' },
      { label: 'Date', value: formatDate(b.booking_date) },
      { label: 'NTN', value: b.ntn || 'N/A' },
      { label: 'Filer Status', value: b.filer_status || 'N/A' },
      { label: 'Amount', value: Number(b.total_amount || 0).toFixed(2) }
    ];
    if (salesmanName) {
      headerLines.splice(3, 0, { label: 'Salesman', value: salesmanName });
    }

    const formattedProducts = products.map(p => ({
      product: p.product_name || '-',
      group: p.product_group || '-',
      batch: p.batch || '-',
      expiry: p.expiry_date ? formatDate(p.expiry_date) : '-',
      qty: p.quantity || 0,
      bonus: p.bonus || 0,
      price: Number(p.unit_price || 0).toFixed(2),
      discount: Number(p.discount_percent || 0).toFixed(2),
      total: Number(p.line_total || 0).toFixed(2)
    }));

    const columns = [
      { label: 'Product', key: 'product', widthRatio: 0.23, align: 'left' },
      { label: 'Group', key: 'group', widthRatio: 0.11, align: 'left', noWrap: true, minWidth: 48 },
      { label: 'Batch', key: 'batch', widthRatio: 0.09, align: 'center', noWrap: true, minWidth: 44 },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.11, align: 'center', noWrap: true, minWidth: 62 },
      { label: 'Qty', key: 'qty', widthRatio: 0.08, align: 'right', noWrap: true, minWidth: 38 },
      { label: 'Bonus', key: 'bonus', widthRatio: 0.09, align: 'right', noWrap: true, minWidth: 46 },
      { label: 'Price', key: 'price', widthRatio: 0.08, align: 'right', noWrap: true, minWidth: 50 },
      { label: 'Disc %', key: 'discount', widthRatio: 0.07, align: 'right', noWrap: true, minWidth: 46 },
      { label: 'Total', key: 'total', widthRatio: 0.11, align: 'right', noWrap: true, minWidth: 56 }
    ];

    const summaryLines = [
      { label: 'Grand Total', value: Number(b.total_amount || 0).toFixed(2), align: 'right' }
    ];

    generateERPTablePDF(
      res, 
      formattedProducts, 
      columns, 
      'Booking Invoice', 
      `booking_${b.id}.pdf`, 
      { 
        headerLines, 
        summaryLines, 
        layout: 'portrait',
        allowEmpty: true,
        emptyMessage: 'No products listed for this booking'
      }
    );
  } catch (err) {
    console.error('Export single booking PDF error:', err);
    res.status(500).json({ error: 'Failed to export booking invoice' });
  }
});

// GET all bookings PDF (paginated/filtered list export)
router.get('/export/pdf', async (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    const pool = getPool();
    
    let queryParams = [];
    let whereClause = '';

    if (search) {
      whereClause = 'WHERE b.customer_name LIKE ? OR b.route LIKE ? OR b.id LIKE ?';
      const likeSearch = `%${search.replace(/%/g, '\\%')}%`;
      queryParams = [likeSearch, likeSearch, likeSearch];
    }

    const [bookings] = await pool.query(`
      SELECT b.id, b.customer_name, b.route, b.booking_date,
             b.filer_status, b.total_amount
      FROM bookings b
      ${whereClause}
      ORDER BY b.booking_date DESC, b.id DESC
      LIMIT 2000
    `, queryParams);

    if (!bookings.length) return res.status(404).json({ error: 'No booking records found' });

    const formatted = bookings.map(b => ({
      id: b.id,
      customer: b.customer_name || '-',
      route: b.route || '-',
      date: formatDate(b.booking_date),
      filerStatus: b.filer_status || '-',
      total: Number(b.total_amount || 0).toFixed(2)
    }));

    const columns = [
      { label: 'ID', key: 'id', widthRatio: 0.05, align: 'left' },
      { label: 'Customer', key: 'customer', widthRatio: 0.35, align: 'left' },
      { label: 'Route', key: 'route', widthRatio: 0.25, align: 'left' },
      { label: 'Date', key: 'date', widthRatio: 0.15, align: 'center' },
      { label: 'Filer Status', key: 'filerStatus', widthRatio: 0.1, align: 'center' },
      { label: 'Total', key: 'total', widthRatio: 0.1, align: 'right' }
    ];

    generateERPTablePDF(res, formatted, columns, 'Bookings List Report', 'bookings_report.pdf', { layout: 'portrait' });
  } catch (err) {
    console.error('Export bookings PDF error:', err);
    res.status(500).json({ error: 'Failed to export bookings list PDF' });
  }
});

// GET all bookings with pagination and optional search
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const search = (req.query.q || '').trim();

    const pool = getPool();
    
    let queryParams = [];
    let whereClause = '';

    if (search) {
      whereClause = 'WHERE b.customer_name LIKE ? OR b.route LIKE ? OR b.id LIKE ?';
      const likeSearch = `%${search.replace(/%/g, '\\%')}%`;
      queryParams = [likeSearch, likeSearch, likeSearch];
    }

    // Get Total Count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM bookings b ${whereClause}`, 
      queryParams
    );
    const total = countRows[0].total;

    // Add pagination to query params
    queryParams.push(limit, offset);

    const [bookings] = await pool.query(`
      SELECT b.id, b.customer_id, b.customer_name, b.route, b.booking_date,
             b.total_amount, b.status, b.requires_approval, b.ntn, b.cnic,
             b.filer_status, b.created_at, b.updated_at
      FROM bookings b
      ${whereClause}
      ORDER BY b.booking_date DESC, b.id DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Get products for each booking
    if (bookings.length > 0) {
      const bookingIds = bookings.map(b => b.id);
      const [allProducts] = await pool.query(`
        SELECT id, booking_id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM booking_products
        WHERE booking_id IN (?)
        ORDER BY id
      `, [bookingIds]);

      // Group products by booking_id for fast assignment
      const productsMap = {};
      allProducts.forEach(p => {
        if (!productsMap[p.booking_id]) {
          productsMap[p.booking_id] = [];
        }
        productsMap[p.booking_id].push({
          product: p.product_name,
          group: p.product_group,
          batch: p.batch,
          expiry: p.expiry_date,
          qty: p.quantity,
          bonus: p.bonus,
          price: parseFloat(p.unit_price),
          discount: parseFloat(p.discount_percent),
          total: parseFloat(p.line_total)
        });
      });

      for (let booking of bookings) {
        booking.products = productsMap[booking.id] || [];
        // Format for compatibility
        booking.customerId = booking.customer_id;
        booking.customer = booking.customer_name;
        booking.date = formatDate(booking.booking_date);
        booking.total = parseFloat(booking.total_amount);
        booking.requiresApproval = booking.requires_approval;
        booking.filerStatus = booking.filer_status;
      }
    }

    res.json({ bookings, total });
  } catch (err) {
    console.error('Load bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// GET bookings by customer id or name
router.get('/by-customer/:id', async (req, res) => {
  try {
    const idRaw = req.params.id;
    const numericId = parseInt(idRaw);
    const pool = getPool();

    let query = `
      SELECT b.id, b.customer_id, b.customer_name, b.route, b.booking_date,
             b.total_amount, b.status, b.requires_approval, b.ntn, b.cnic,
             b.filer_status, b.created_at, b.updated_at
      FROM bookings b
      WHERE b.customer_id = ? OR LOWER(b.customer_name) = LOWER(?)
      ORDER BY b.booking_date DESC
    `;

    const [bookings] = await pool.query(query, [numericId, idRaw]);

    // Get products for each booking
    for (let booking of bookings) {
      const [products] = await pool.query(`
        SELECT id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM booking_products
        WHERE booking_id = ?
      `, [booking.id]);

      booking.products = products.map(p => ({
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

      booking.customerId = booking.customer_id;
      booking.customer = booking.customer_name;
      booking.date = booking.booking_date;
      booking.total = parseFloat(booking.total_amount);
    }

    console.log(`bookings.by-customer: ${idRaw} -> ${bookings.length} result(s)`);
    res.json(bookings);
  } catch (err) {
    console.error('Bookings by-customer error:', err);
    res.status(500).json({ error: 'Failed to load bookings for customer' });
  }
});

// POST - Create new booking
router.post('/', async (req, res) => {
  try {
    const { customerId, customer, route, date, products, total, status, requiresApproval, ntn, cnic, filerStatus, salesmanId } = req.body || {};

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Find customer
      let selectedCustomer = null;
      if (customerId) {
        const [customers] = await connection.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        selectedCustomer = customers[0];
      }

      if (!selectedCustomer && customer) {
        const [customers] = await connection.query('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)', [customer]);
        selectedCustomer = customers[0];
      }

      if (!selectedCustomer) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Customer not found' });
      }

      // Validate products
      const validatedProducts = (products || []).map(p => ({
        product: p.product || p.productName || '',
        group: p.group || '-',
        batch: p.batch || '-',
        expiry: p.expiry || null,
        qty: parseInt(p.qty || p.quantity || 0),
        bonus: parseInt(p.bonus || 0),
        price: parseFloat(p.price || p.unitPrice || 0),
        discount: parseFloat(p.discount || p.discountPercent || 0),
        total: parseFloat(p.total || 0)
      }));

      // Insert booking
      const [result] = await connection.query(`
        INSERT INTO bookings (
          customer_id, customer_name, route, booking_date, total_amount,
          status, requires_approval, ntn, cnic, filer_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        selectedCustomer.id,
        selectedCustomer.name,
        route || selectedCustomer.route || '',
        date || new Date().toISOString().split('T')[0],
        parseFloat(total || 0),
        status || 'Pending',
        !!requiresApproval,
        ntn || selectedCustomer.ntn || '',
        cnic || selectedCustomer.cnic || '',
        filerStatus || selectedCustomer.filer_status || 'Filer'
      ]);

      const bookingId = result.insertId;

      // If a salesman was selected, create a salesman order snapshot for mobile app
      if (salesmanId) {
        try {
          await connection.query(
            `
            INSERT INTO salesman_orders (salesman_id, customer_id, order_date, total_amount, status, notes)
            VALUES (?, ?, ?, ?, 'pending', ?)
            `,
            [
              parseInt(salesmanId),
              selectedCustomer.id,
              date || new Date().toISOString().split('T')[0],
              parseFloat(total || 0),
              JSON.stringify({
                bookingId,
                customer: selectedCustomer.name,
                route: route || selectedCustomer.route || '',
                products: validatedProducts.map(p => ({ product: p.product, qty: p.qty, price: p.price, total: p.total }))
              })
            ]
          );
        } catch (e) {
          // do not block booking creation if salesman order insert fails
          console.error('Failed to create salesman order snapshot', e);
        }
      }

      // Insert products
      for (const product of validatedProducts) {
        await connection.query(`
          INSERT INTO booking_products (
            booking_id, product_name, product_group, batch, expiry_date,
            quantity, bonus, unit_price, discount_percent, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          bookingId,
          product.product,
          product.group,
          product.batch,
          product.expiry,
          product.qty,
          product.bonus,
          product.price,
          product.discount,
          product.total
        ]);

        // Create sales report entry
        await connection.query(`
          INSERT INTO sales_reports (
            po_number, item_name, quantity, sale_date, customer, booking_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          'MANUAL',
          product.product,
          product.qty,
          date || new Date().toISOString().split('T')[0],
          selectedCustomer.name,
          bookingId
        ]);
      }

      // Deduct stock from DMS Items strength (status) based on booking quantities
      const qtyMap = buildQtyMap(validatedProducts);
      await applyDmsStockDelta(connection, qtyMap, -1);

      await connection.commit();

      // Fetch created booking
      const [newBooking] = await connection.query(`
        SELECT b.id, b.customer_id, b.customer_name, b.route, b.booking_date,
               b.total_amount, b.status, b.requires_approval, b.ntn, b.cnic,
               b.filer_status, b.created_at, b.updated_at
        FROM bookings b
        WHERE b.id = ?
      `, [bookingId]);

      const [newProducts] = await connection.query(`
        SELECT id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM booking_products
        WHERE booking_id = ?
      `, [bookingId]);

      const booking = newBooking[0];
      booking.products = newProducts.map(p => ({
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

      booking.customerId = booking.customer_id;
      booking.customer = booking.customer_name;
      booking.date = booking.booking_date;
      booking.total = parseFloat(booking.total_amount);
      booking.requiresApproval = booking.requires_approval;
      booking.filerStatus = booking.filer_status;

      connection.release();
      res.status(201).json(booking);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// POST /:id/add-product - Add a product manually to an existing booking
router.post('/:id/add-product', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { product, group, batch, expiry, qty, price, discount, bonus } = req.body;
    const connection = await getPool().getConnection();
    await connection.beginTransaction();
    // Insert product into booking_products
    const lineTotal = (price * qty) - (discount || 0);
    await connection.query(
      `INSERT INTO booking_products (booking_id, product_name, product_group, batch, expiry_date, quantity, bonus, unit_price, discount_percent, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, product, group, batch, expiry, qty, bonus || 0, price, discount || 0, lineTotal]
    );
    // Recalculate total amount for the booking
    const [totals] = await connection.query(
      `SELECT SUM(line_total) as total FROM booking_products WHERE booking_id = ?`,
      [bookingId]
    );
    const newTotal = totals[0].total || 0;
    await connection.query(`UPDATE bookings SET total_amount = ? WHERE id = ?`, [newTotal, bookingId]);
    await connection.commit();
    connection.release();
    res.json({ success: true, totalAmount: newTotal });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT - Update booking
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { customer, route, date, products, total, status, requiresApproval, ntn, cnic, filerStatus } = req.body || {};

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if booking exists
      const [existing] = await connection.query('SELECT * FROM bookings WHERE id = ?', [id]);
      if (existing.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Booking not found' });
      }

      const currentBooking = existing[0];

      // Load existing products so we can re-balance stock deltas
      const [oldProductsRows] = await connection.query(
        `SELECT product_name, quantity FROM booking_products WHERE booking_id = ?`,
        [id]
      );

      // Find customer if name changed
      let selectedCustomer = null;
      if (customer) {
        const [customers] = await connection.query('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)', [customer]);
        selectedCustomer = customers[0];
      }

      // Validate products
      const validatedProducts = (products || []).map(p => ({
        product: p.product || p.productName || '',
        group: p.group || '-',
        batch: p.batch || '-',
        expiry: p.expiry || null,
        qty: parseInt(p.qty || p.quantity || 0),
        bonus: parseInt(p.bonus || 0),
        price: parseFloat(p.price || p.unitPrice || 0),
        discount: parseFloat(p.discount || p.discountPercent || 0),
        total: parseFloat(p.total || 0)
      }));

      // Re-balance DMS stock: add back old quantities, deduct new quantities
      const oldMap = buildQtyMap(oldProductsRows.map(r => ({ product: r.product_name, qty: r.quantity })));
      const newMap = buildQtyMap(validatedProducts);
      await applyDmsStockDelta(connection, oldMap, +1);
      await applyDmsStockDelta(connection, newMap, -1);

      // Update booking
      await connection.query(`
        UPDATE bookings
        SET customer_id = ?, customer_name = ?, route = ?, booking_date = ?,
            total_amount = ?, status = ?, requires_approval = ?,
            ntn = ?, cnic = ?, filer_status = ?
        WHERE id = ?
      `, [
        selectedCustomer ? selectedCustomer.id : currentBooking.customer_id,
        selectedCustomer ? selectedCustomer.name : currentBooking.customer_name,
        route || currentBooking.route,
        date || currentBooking.booking_date,
        parseFloat(total || currentBooking.total_amount),
        status || currentBooking.status,
        requiresApproval !== undefined ? !!requiresApproval : currentBooking.requires_approval,
        ntn || currentBooking.ntn,
        cnic || currentBooking.cnic,
        filerStatus || currentBooking.filer_status,
        id
      ]);

      // Delete old products and sales reports
      await connection.query('DELETE FROM booking_products WHERE booking_id = ?', [id]);
      await connection.query('DELETE FROM sales_reports WHERE booking_id = ?', [id]);

      // Insert new products
      for (const product of validatedProducts) {
        await connection.query(`
          INSERT INTO booking_products (
            booking_id, product_name, product_group, batch, expiry_date,
            quantity, bonus, unit_price, discount_percent, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          product.product,
          product.group,
          product.batch,
          product.expiry,
          product.qty,
          product.bonus,
          product.price,
          product.discount,
          product.total
        ]);

        // Create sales report entry
        await connection.query(`
          INSERT INTO sales_reports (
            po_number, item_name, quantity, sale_date, customer, booking_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          'MANUAL',
          product.product,
          product.qty,
          date || currentBooking.booking_date,
          selectedCustomer ? selectedCustomer.name : currentBooking.customer_name,
          id
        ]);
      }

      await connection.commit();

      // Fetch updated booking
      const [updatedBooking] = await connection.query(`
        SELECT b.id, b.customer_id, b.customer_name, b.route, b.booking_date,
               b.total_amount, b.status, b.requires_approval, b.ntn, b.cnic,
               b.filer_status, b.created_at, b.updated_at
        FROM bookings b
        WHERE b.id = ?
      `, [id]);

      const [updatedProducts] = await connection.query(`
        SELECT id, product_name, product_group, batch, expiry_date,
               quantity, bonus, unit_price, discount_percent, line_total
        FROM booking_products
        WHERE booking_id = ?
      `, [id]);

      const booking = updatedBooking[0];
      booking.products = updatedProducts.map(p => ({
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

      booking.customerId = booking.customer_id;
      booking.customer = booking.customer_name;
      booking.date = booking.booking_date;
      booking.total = parseFloat(booking.total_amount);
      booking.requiresApproval = booking.requires_approval;
      booking.filerStatus = booking.filer_status;

      connection.release();
      res.json(booking);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE - Delete booking
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Add back stock before deleting booking products
      const [oldProductsRows] = await connection.query(
        `SELECT product_name, quantity FROM booking_products WHERE booking_id = ?`,
        [id]
      );
      const oldMap = buildQtyMap(oldProductsRows.map(r => ({ product: r.product_name, qty: r.quantity })));
      await applyDmsStockDelta(connection, oldMap, +1);

      // Delete products (cascade will handle this, but explicit for sales reports)
      await connection.query('DELETE FROM booking_products WHERE booking_id = ?', [id]);
      await connection.query('DELETE FROM sales_reports WHERE booking_id = ?', [id]);

      // Delete booking
      const [result] = await connection.query('DELETE FROM bookings WHERE id = ?', [id]);

      await connection.commit();
      connection.release();

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;
