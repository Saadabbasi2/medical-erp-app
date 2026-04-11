// routes/purchaseOrder.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [orders] = await pool.query('SELECT * FROM purchase_orders ORDER BY created_at DESC');

    // Parse items JSON if stored as string
    const parsed = orders.map(o => {
      let items = o.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      return { ...o, items: items || [] };
    });

    res.json(parsed);
  } catch (err) {
    console.error('Get purchase orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Search PO items by name (lightweight suggestions for DMS Items)
// GET /api/purchase-orders/items/search?q=JETE&limit=20
router.get('/items/search', async (req, res) => {
  try {
    const qRaw = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    if (!qRaw || qRaw.length < 2) return res.json({ items: [] });

    const pool = getPool();
    const like = `%${qRaw}%`;

    // Pull recent POs whose items JSON contains the search text
    const [orders] = await pool.query(
      `
      SELECT id, po_number, company_id, vendor_name, items, quantity, created_at
      FROM purchase_orders
      WHERE items LIKE ?
      ORDER BY created_at DESC, id DESC
      LIMIT 100
      `,
      [like]
    );

    const seen = new Set();
    const out = [];
    const totals = new Map(); // nameKey -> total quantity

    for (const o of orders) {
      let items = o.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (!Array.isArray(items)) items = [];

      for (const it of items) {
        const name = (typeof it === 'string') ? it : (it?.productName || it?.item || it?.name || '');
        if (!name) continue;
        if (!String(name).toLowerCase().includes(qRaw.toLowerCase())) continue;

        const key = String(name).trim().toLowerCase();
        // accumulate total quantity from PO header (best available in current schema/UI)
        const qNum = Number(o.quantity || 0);
        totals.set(key, (totals.get(key) || 0) + (Number.isFinite(qNum) ? qNum : 0));

        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          name,
          vendorId: o.company_id,
          vendorName: o.vendor_name,
          poNumber: o.po_number,
          // pass through any extra fields if present on the PO item
          packSize: (typeof it === 'object' && it) ? (it.packSize || it.pack || it.pack_size || '') : '',
          strength: (typeof it === 'object' && it) ? (it.strength || it.Strength || '') : '',
          totalQty: 0
        });

        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }

    // attach totals
    out.forEach(r => {
      const key = String(r.name || '').trim().toLowerCase();
      r.totalQty = totals.get(key) || 0;
    });

    res.json({ items: out });
  } catch (err) {
    console.error('Search PO items error:', err);
    res.status(500).json({ error: 'Failed to search PO items' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const {
      poNumber,
      vendorId,
      vendorName,
      items,
      quantity,
      batch,
      expiryDate,
      orderDate,
      remarks,
      status,
      totalAmount,
      deliveryDate
    } = req.body || {};

    // Serialize items array to JSON
    const itemsJson = items ? JSON.stringify(items) : JSON.stringify([]);

    const [result] = await pool.query(`
      INSERT INTO purchase_orders (
        po_number,
        company_id,
        vendor_name,
        items,
        quantity,
        batch,
        expiry_date,
        order_date,
        expected_delivery,
        total_amount,
        status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      poNumber || `PO-${Date.now()}`,
      vendorId || null,
      vendorName || '',
      itemsJson,
      quantity || null,
      batch || '',
      expiryDate || null,
      orderDate || new Date().toISOString().split('T')[0],
      deliveryDate || null,
      totalAmount || 0,
      status || 'Draft',
      remarks || ''
    ]);

    const [newOrder] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [result.insertId]);
    const order = newOrder[0];

    // Parse items back
    if (typeof order.items === 'string') {
      try { order.items = JSON.parse(order.items); } catch { order.items = []; }
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Create purchase order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE purchase_orders 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve order error:', err);
    res.status(500).json({ error: 'Failed to approve order' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM purchase_orders WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [orders] = await pool.query('SELECT * FROM purchase_orders');

    // Format a date value as DD/MM/YYYY
    function fmtDate(val) {
      if (!val) return '-';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      } catch { return String(val); }
    }

    const formatted = orders.map(o => {
      let items = o.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      const itemsArr = Array.isArray(items) ? items : [];

      const itemsDisplay = itemsArr.length
        ? itemsArr.map(i => i.productName || i).join(', ')
        : '-';

      const groupDisplay = itemsArr.length
        ? [...new Set(itemsArr.map(i => i.group || '').filter(Boolean))].join(', ') || '-'
        : '-';

      const packDisplay = itemsArr.length
        ? [...new Set(itemsArr.map(i => i.packSize || i.pack || i.pack_size || '').filter(Boolean))].join(', ') || '-'
        : '-';

      return {
        poNumber: o.po_number || '-',
        vendor: o.vendor_name || '-',
        items: itemsDisplay,
        group: groupDisplay,
        packSize: packDisplay,
        quantity: o.quantity != null ? String(o.quantity) : '-',
        batch: o.batch || '-',
        expiryDate: fmtDate(o.expiry_date),
        date: fmtDate(o.order_date),
        remarks: o.notes || '-'
      };
    });

    const columns = [
      { label: 'PO #', key: 'poNumber', widthRatio: 0.10 },
      { label: 'Vendor', key: 'vendor', widthRatio: 0.13 },
      { label: 'Items', key: 'items', widthRatio: 0.17 },
      { label: 'Group', key: 'group', widthRatio: 0.10 },
      { label: 'Pack', key: 'packSize', widthRatio: 0.08 },
      { label: 'Qty', key: 'quantity', widthRatio: 0.06 },
      { label: 'Batch', key: 'batch', widthRatio: 0.09 },
      { label: 'Expiry', key: 'expiryDate', widthRatio: 0.09 },
      { label: 'Date', key: 'date', widthRatio: 0.09 },
      { label: 'Remarks', key: 'remarks', widthRatio: 0.17 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Purchase Orders Report', 'purchase_orders.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});


module.exports = router;
