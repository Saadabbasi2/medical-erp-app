// routes/salesReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

// GET all sales reports
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query(`
      SELECT id, po_number, item_name, quantity, sale_date,
             customer, booking_id, company, product_group,
             created_at
      FROM sales_reports
      ORDER BY sale_date DESC, id DESC
    `);
    res.json(reports);
  } catch (err) {
    console.error('Load sales reports error:', err);
    res.status(500).json({ error: 'Failed to load sales reports' });
  }
});

// POST - Create new sales report entry
router.post('/', async (req, res) => {
  try {
    const { poNumber, itemName, quantity, saleDate, customer, bookingId, company, productGroup } = req.body || {};

    if (!itemName || !quantity || !customer) {
      return res.status(400).json({ error: 'Item name, quantity, and customer are required' });
    }

    const pool = getPool();
    const [result] = await pool.query(`
      INSERT INTO sales_reports (po_number, item_name, quantity, sale_date, customer, booking_id, company, product_group)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      poNumber || 'MANUAL',
      itemName,
      parseInt(quantity),
      saleDate || new Date().toISOString().split('T')[0],
      customer,
      bookingId || null,
      company || '',
      productGroup || ''
    ]);

    const reportId = result.insertId;

    // Fetch the created report
    const [newReport] = await pool.query(`
      SELECT id, po_number, item_name, quantity, sale_date,
             customer, booking_id, company, product_group,
             created_at
      FROM sales_reports
      WHERE id = ?
    `, [reportId]);

    res.status(201).json(newReport[0]);
  } catch (err) {
    console.error('Create sales report error:', err);
    res.status(500).json({ error: 'Failed to create sales report' });
  }
});

// PDF Export - Sales Reports with Stock Calculation
router.get('/export/pdf', async (req, res) => {
  try {
    const searchQuery = (req.query.search || '').toLowerCase().trim();
    const pool = getPool();

    // Load purchase orders
    const [purchaseOrders] = await pool.query(`
      SELECT po_number, order_date, total_amount, status, notes
      FROM purchase_orders
      ORDER BY order_date DESC
    `);

    if (purchaseOrders.length === 0) {
      return generateERPTablePDF(res, [], [], 'Sales Report (Inventory)', 'sales_reports.pdf', {
        allowEmpty: true,
        emptyMessage: 'No stock available (No Purchase Orders).',
        layout: 'landscape'
      });
    }

    // Load companies and products for price/group mapping
    const [products] = await pool.query(`
      SELECT p.product_name, p.trade_price, p.group_name, c.name as company_name
      FROM products p
      JOIN companies c ON p.company_id = c.id
    `);

    // Build maps
    const productPriceMap = {};
    const productCompanyMap = {};
    const productGroupMap = {};

    products.forEach(p => {
      const key = p.product_name.toLowerCase().trim();
      productPriceMap[key] = parseFloat(p.trade_price || 0);
      productCompanyMap[key] = p.company_name || '-';
      productGroupMap[key] = p.group_name || '-';
    });

    // Load sales data
    const [salesData] = await pool.query(`
      SELECT item_name, SUM(quantity) as total_sold
      FROM sales_reports
      GROUP BY item_name
    `);

    const salesMap = {};
    salesData.forEach(s => {
      salesMap[s.item_name.toLowerCase().trim()] = parseInt(s.total_sold || 0);
    });

    // Process report data
    const reportData = [];

    // For now, we'll use a simplified version
    // In a full implementation, you'd need to track inventory properly
    purchaseOrders.forEach(po => {
      const itemName = 'Sample Item'; // This would come from PO items
      const originalQty = 100; // This would come from PO items
      const totalSold = salesMap[itemName.toLowerCase()] || 0;
      const remainingQty = originalQty - totalSold;
      const unitPrice = productPriceMap[itemName.toLowerCase()] || 0;
      const companyName = productCompanyMap[itemName.toLowerCase()] || '-';
      const groupName = productGroupMap[itemName.toLowerCase()] || '-';

      // Filter logic
      if (searchQuery) {
        const matches =
          itemName.toLowerCase().includes(searchQuery) ||
          companyName.toLowerCase().includes(searchQuery) ||
          groupName.toLowerCase().includes(searchQuery);

        if (!matches) return;
      }

      const totalValue = originalQty * unitPrice;
      const soldValue = totalSold * unitPrice;
      const remainingValue = remainingQty * unitPrice;

      reportData.push({
        poNum: po.po_number || '-',
        itemName,
        companyName,
        groupName,
        batch: '-',
        expiry: '-',
        unitPrice: unitPrice.toFixed(2),
        originalQty,
        totalValue: totalValue.toFixed(2),
        totalSold,
        soldValue: soldValue.toFixed(2),
        remainingQty,
        remainingValue: remainingValue.toFixed(2)
      });
    });

    const columns = [
      { label: 'PO #', key: 'poNum', widthRatio: 1.1 },
      { label: 'Item', key: 'itemName', widthRatio: 1.5, align: 'left' },
      { label: 'Company', key: 'companyName', widthRatio: 1.0, align: 'left' },
      { label: 'Group', key: 'groupName', widthRatio: 0.8, align: 'left' },
      { label: 'Batch', key: 'batch', widthRatio: 0.9 },
      { label: 'Expiry', key: 'expiry', widthRatio: 0.9 },
      { label: 'Unit Price', key: 'unitPrice', widthRatio: 0.8, align: 'right' },
      { label: 'Org Qty', key: 'originalQty', widthRatio: 0.7, align: 'right' },
      { label: 'Total Val', key: 'totalValue', widthRatio: 1.0, align: 'right' },
      { label: 'Sold Qty', key: 'totalSold', widthRatio: 0.7, align: 'right' },
      { label: 'Sold Val', key: 'soldValue', widthRatio: 1.0, align: 'right' },
      { label: 'Rem Qty', key: 'remainingQty', widthRatio: 0.7, align: 'right' },
      { label: 'Rem Val', key: 'remainingValue', widthRatio: 1.0, align: 'right' }
    ];

    generateERPTablePDF(res, reportData, columns, 'Sales Reports (Available Stock)', 'sales_reports.pdf', {
      allowEmpty: true,
      emptyMessage: 'No stock records found matching your search.',
      layout: 'landscape',
      margin: 30
    });

  } catch (err) {
    console.error('Sales Reports PDF Export Error:', err);
    res.status(500).send('Error generating PDF');
  }
});

module.exports = router;
