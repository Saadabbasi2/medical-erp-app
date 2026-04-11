// routes/costingValuation.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// GET all costing records
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM costing_valuation ORDER BY created_at DESC');
    res.json(data);
  } catch (err) {
    console.error('Get costing valuation error:', err);
    res.status(500).json({ error: 'Failed to get records' });
  }
});

// POST add new costing record
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { productName, batchNo, costPrice, sellingPrice, valuationMethod, quantity } = req.body;

    const cost = parseFloat(costPrice) || 0;
    const qty = parseInt(quantity) || 0;
    const totalValue = cost * qty;

    const [result] = await pool.query(`
      INSERT INTO costing_valuation (product_name, batch_no, cost_price, selling_price, valuation_method, quantity, total_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [productName || '', batchNo || '', cost, parseFloat(sellingPrice) || 0, valuationMethod || 'FIFO', qty, totalValue]);

    const [newEntry] = await pool.query('SELECT * FROM costing_valuation WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newEntry[0] });
  } catch (err) {
    console.error('Add costing valuation error:', err);
    res.status(500).json({ error: 'Failed to add record' });
  }
});

// DELETE record
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM costing_valuation WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// EXPORT COGS SUMMARY PDF
router.get('/export/summary', async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM costing_valuation');

    const grouped = {};
    let totalValue = 0;

    records.forEach(r => {
      if (!grouped[r.product_name]) grouped[r.product_name] = { count: 0, totalCost: 0 };
      grouped[r.product_name].count += r.quantity || 0;
      grouped[r.product_name].totalCost += parseFloat(r.total_value) || 0;
    });

    const summaryRows = Object.keys(grouped).map(item => {
      const avgCost = grouped[item].count > 0 ? grouped[item].totalCost / grouped[item].count : 0;
      totalValue += grouped[item].totalCost;
      return {
        item,
        qty: grouped[item].count,
        avgCost: avgCost.toFixed(2),
        total: grouped[item].totalCost.toFixed(2)
      };
    });

    const sections = [
      {
        title: 'COGS Transactions',
        columns: [
          { label: 'Item', key: 'item', widthRatio: 1.2 },
          { label: 'Batch', key: 'batch', widthRatio: 1 },
          { label: 'Method', key: 'method', widthRatio: 0.8 },
          { label: 'Cost', key: 'cost', widthRatio: 0.8, align: 'right' },
          { label: 'Qty', key: 'qty', widthRatio: 0.6 },
          { label: 'Total', key: 'total', widthRatio: 0.8 }
        ],
        data: records.map(r => ({
          item: r.product_name || '-',
          batch: r.batch_no || '-',
          method: r.valuation_method || '-',
          cost: (parseFloat(r.cost_price) || 0).toFixed(2),
          qty: r.quantity || 0,
          total: (parseFloat(r.total_value) || 0).toFixed(2)
        })),
        allowEmpty: true,
        emptyMessage: 'No COGS transactions recorded.'
      },
      {
        title: 'Inventory Valuation (Stock Summary)',
        columns: [
          { label: 'Item', key: 'item', widthRatio: 1.4 },
          { label: 'Qty', key: 'qty', widthRatio: 0.6, align: 'right' },
          { label: 'Avg Cost', key: 'avgCost', widthRatio: 0.8, align: 'right' },
          { label: 'Total Value', key: 'total', widthRatio: 0.9, align: 'right' }
        ],
        data: summaryRows,
        allowEmpty: true,
        emptyMessage: 'No inventory valuation data.',
        summaryLines: [
          { label: 'Total Inventory Value', value: `PKR ${totalValue.toFixed(2)}` }
        ]
      }
    ];

    generateERPTablePDF(
      res,
      [],
      [],
      'Cost of Goods Sold (COGS) Summary Report',
      'COGS_Summary.pdf',
      {
        allowEmpty: true,
        sections
      }
    );
  } catch (err) {
    console.error('Export summary error:', err);
    res.status(500).json({ error: 'Failed to export summary' });
  }
});

module.exports = router;
