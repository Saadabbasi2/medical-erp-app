// routes/stockAdjustments.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM stock_adjustments ORDER BY created_at DESC');
    res.json(adjustments);
  } catch (err) {
    console.error('Get stock adjustments error:', err);
    res.status(500).json({ error: 'Failed to get adjustments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { product, batch, adjustmentType, adjustmentQuantity, reason, notes,
      salesTax, store, date, rate, costPrice, expiryDate } = req.body || {};
    const pool = getPool();

    const quantity = Math.abs(Number(adjustmentQuantity)) || 0;
    const status = 'Approved'; // Auto-approved, no approval workflow needed

    const [result] = await pool.query(`
      INSERT INTO stock_adjustments
        (product, batch, adjustment_type, quantity, reason, notes,
         sales_tax, store, date, status, created_by,
         rate, cost_price, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product || '',
      batch || '',
      adjustmentType || 'Manual Adjustment',
      quantity,
      reason || '',
      notes || '',
      salesTax ?? null,
      store || '',
      date || null,
      status,
      'User',
      rate ?? null,
      costPrice ?? null,
      expiryDate || null
    ]);

    const [adjustment] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [result.insertId]);
    res.status(201).json(adjustment[0]);
  } catch (err) {
    console.error('Create stock adjustment error:', err);
    res.status(500).json({ error: 'Failed to create stock adjustment' });
  }
});


router.put('/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { approvedBy } = req.body || {};
    const pool = getPool();

    const [adjustments] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    if (!adjustments.length) return res.status(404).json({ error: 'Adjustment not found' });

    const adjustment = adjustments[0];
    if (adjustment.status !== 'Pending') {
      return res.status(400).json({ error: 'Not pending approval' });
    }

    await pool.query(`
      UPDATE stock_adjustments 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', id]);

    const [updated] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Approve stock adjustment error:', err);
    res.status(500).json({ error: 'Failed to approve stock adjustment' });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { approvedBy, reason } = req.body || {};
    const pool = getPool();

    const [adjustments] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    if (!adjustments.length) return res.status(404).json({ error: 'Adjustment not found' });

    const adjustment = adjustments[0];
    if (adjustment.status !== 'Pending') {
      return res.status(400).json({ error: 'Not pending approval' });
    }

    await pool.query(`
      UPDATE stock_adjustments 
      SET status = 'Rejected', approved_by = ?, rejected_reason = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', reason || '', id]);

    const [updated] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Reject stock adjustment error:', err);
    res.status(500).json({ error: 'Failed to reject stock adjustment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = getPool();
    await pool.query('DELETE FROM stock_adjustments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete stock adjustment error:', err);
    res.status(500).json({ error: 'Failed to delete stock adjustment' });
  }
});

// Update (Edit) a stock record
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { product, batch, adjustmentQuantity, reason, notes,
      salesTax, store, date, rate, costPrice, expiryDate } = req.body || {};
    const pool = getPool();

    const quantity = Math.abs(Number(adjustmentQuantity)) || 0;

    await pool.query(`
      UPDATE stock_adjustments SET
        product      = ?,
        batch        = ?,
        quantity     = ?,
        rate         = ?,
        cost_price   = ?,
        expiry_date  = ?,
        sales_tax    = ?,
        store        = ?,
        date         = ?,
        reason       = ?,
        notes        = ?
      WHERE id = ?
    `, [
      product || '',
      batch || '',
      quantity,
      rate ?? null,
      costPrice ?? null,
      expiryDate || null,
      salesTax ?? null,
      store || '',
      date || null,
      reason || '',
      notes || '',
      id
    ]);

    const [updated] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});



// Individual Stock PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM stock_adjustments WHERE id = ?', [id]);

    if (!adjustments.length) {
      return res.status(404).json({ error: 'Stock Adjustment not found' });
    }

    const adj = adjustments[0];

    const fmtDate = (v) => {
      if (!v) return '-';
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).split('T')[0] || '-';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
      } catch { return String(v); }
    };

    const rowData = [{
      product: adj.product || '-',
      batch: adj.batch || '-',
      quantity: adj.quantity != null ? String(adj.quantity) : '-',
      rate: adj.rate != null ? Number(adj.rate).toFixed(4) : '-',
      expiry: fmtDate(adj.expiry_date),
      costPrice: adj.cost_price != null ? Number(adj.cost_price).toFixed(4) : '-',
      salesTax: adj.sales_tax != null ? Number(adj.sales_tax).toFixed(4) : '-',
      store: adj.store || '-',
      date: fmtDate(adj.date),
      status: adj.status || '-',
      approvedBy: adj.approved_by || '-'
    }];

    const columns = [
      { label: 'Item ID', key: 'product', widthRatio: 0.11 },
      { label: 'Batch', key: 'batch', widthRatio: 0.09 },
      { label: 'Qty', key: 'quantity', widthRatio: 0.07 },
      { label: 'Rate', key: 'rate', widthRatio: 0.10 },
      { label: 'Expiry Date', key: 'expiry', widthRatio: 0.11 },
      { label: 'Cost Price', key: 'costPrice', widthRatio: 0.10 },
      { label: 'Sales Tax', key: 'salesTax', widthRatio: 0.09 },
      { label: 'Store', key: 'store', widthRatio: 0.08 },
      { label: 'Date', key: 'date', widthRatio: 0.10 },
      { label: 'Status', key: 'status', widthRatio: 0.09 },
      { label: 'Approved By', key: 'approvedBy', widthRatio: 0.06 }
    ];

    generateERPTablePDF(
      res,
      rowData,
      columns,
      `Stock #${adj.id}`,
      `stock-${adj.id}.pdf`,
      {
        allowEmpty: true,
        layout: 'landscape'
      }
    );
  } catch (err) {
    console.error('Stock adjustment PDF error:', err);
    try { if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' }); else res.end(); } catch (e) { }
  }
});


// PDF report — all stocks
router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [adjustments] = await pool.query('SELECT * FROM stock_adjustments ORDER BY created_at DESC');

    const fmtDate = (v) => {
      if (!v) return '-';
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).split('T')[0] || '-';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
      } catch { return String(v); }
    };

    const columns = [
      { label: 'Item ID', key: 'product', widthRatio: 0.11 },
      { label: 'Batch', key: 'batch', widthRatio: 0.09 },
      { label: 'Qty', key: 'quantity', widthRatio: 0.06 },
      { label: 'Rate', key: 'rate', widthRatio: 0.10 },
      { label: 'Expiry Date', key: 'expiry', widthRatio: 0.10 },
      { label: 'Cost Price', key: 'costPrice', widthRatio: 0.10 },
      { label: 'Sales Tax', key: 'salesTax', widthRatio: 0.08 },
      { label: 'Store', key: 'store', widthRatio: 0.07 },
      { label: 'Date', key: 'date', widthRatio: 0.10 },
      { label: 'Status', key: 'status', widthRatio: 0.10 },
      { label: 'Approved By', key: 'approvedBy', widthRatio: 0.09 }
    ];

    const transformedData = adjustments.map(a => ({
      product: a.product || '-',
      batch: a.batch || '-',
      quantity: a.quantity != null ? String(a.quantity) : '-',
      rate: a.rate != null ? Number(a.rate).toFixed(4) : '-',
      expiry: fmtDate(a.expiry_date),
      costPrice: a.cost_price != null ? Number(a.cost_price).toFixed(4) : '-',
      salesTax: a.sales_tax != null ? Number(a.sales_tax).toFixed(4) : '-',
      store: a.store || '-',
      date: fmtDate(a.date),
      status: a.status || '-',
      approvedBy: a.approved_by || '-'
    }));

    generateERPTablePDF(
      res,
      transformedData,
      columns,
      'Stocks Report',
      'stocks_report.pdf',
      { allowEmpty: true, layout: 'landscape' }
    );
  } catch (err) {
    console.error('Stock adjustments PDF error:', err);
    try { if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' }); else res.end(); } catch (e) { }
  }
});

module.exports = router;
