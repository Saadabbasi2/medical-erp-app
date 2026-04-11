// routes/inventoryReports.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM inventory_reports ORDER BY generated_at DESC');
    res.json(reports);
  } catch (err) {
    console.error('Get inventory reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const pool = getPool();
    const { reportType, reportPeriod } = req.body;

    // Get inventory statistics
    const [itemStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(current_stock * unit_price) as total_stock_value
      FROM item_master
    `);

    // Get low stock items
    const [lowStock] = await pool.query(`
      SELECT COUNT(*) as low_stock_items
      FROM item_master
      WHERE current_stock < reorder_level
    `);

    // Get expired items
    const [expired] = await pool.query(`
      SELECT COUNT(*) as expired_items
      FROM warehouse_bins
      WHERE expiry_date < CURDATE() AND batch_status = 'Active'
    `);

    // Get expiring soon (within 30 days)
    const [expiringSoon] = await pool.query(`
      SELECT COUNT(*) as expiring_soon
      FROM warehouse_bins
      WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND batch_status = 'Active'
    `);

    const [result] = await pool.query(`
      INSERT INTO inventory_reports (report_type, report_period, total_items, total_stock_value, low_stock_items, expired_items, expiring_soon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      reportType || 'Summary',
      reportPeriod || new Date().toISOString().split('T')[0],
      itemStats[0].total_items || 0,
      itemStats[0].total_stock_value || 0,
      lowStock[0].low_stock_items || 0,
      expired[0].expired_items || 0,
      expiringSoon[0].expiring_soon || 0
    ]);

    const [newReport] = await pool.query('SELECT * FROM inventory_reports WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newReport[0] });
  } catch (err) {
    console.error('Generate inventory report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM inventory_reports WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [reports] = await pool.query('SELECT * FROM inventory_reports');

    const formatted = reports.map(r => ({
      reportType: r.report_type || '-',
      period: r.report_period || '-',
      totalItems: r.total_items || 0,
      stockValue: (parseFloat(r.total_stock_value) || 0).toFixed(2),
      lowStock: r.low_stock_items || 0,
      expired: r.expired_items || 0,
      expiringSoon: r.expiring_soon || 0
    }));

    const columns = [
      { label: 'Report Type', key: 'reportType', widthRatio: 0.15 },
      { label: 'Period', key: 'period', widthRatio: 0.12 },
      { label: 'Items', key: 'totalItems', widthRatio: 0.10 },
      { label: 'Stock Value', key: 'stockValue', widthRatio: 0.15 },
      { label: 'Low Stock', key: 'lowStock', widthRatio: 0.12 },
      { label: 'Expired', key: 'expired', widthRatio: 0.12 },
      { label: 'Expiring Soon', key: 'expiringSoon', widthRatio: 0.14 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Inventory Report', 'inventory_reports.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
