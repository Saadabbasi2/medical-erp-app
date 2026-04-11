// routes/dashboard.js - MySQL Version (Simplified - No Foreign Keys)
const express = require('express');
const { getPool } = require('../db-mysql');
const router = express.Router();

function toYMD(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

// GET / - Dashboard data with optional date filtering
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { from, to } = req.query || {};
    const todayYmd = toYMD(new Date());
    const refDay = to || todayYmd;

    // Build WHERE clauses for date filtering
    const invoiceWhere = [];
    const invoiceParams = [];
    if (from) {
      invoiceWhere.push('DATE(invoice_date) >= ?');
      invoiceParams.push(from);
    }
    if (to) {
      invoiceWhere.push('DATE(invoice_date) <= ?');
      invoiceParams.push(to);
    }
    const invoiceWhereClause = invoiceWhere.length > 0 ? `WHERE ${invoiceWhere.join(' AND ')}` : '';

    // 1. Today Sales - sum of invoices for today
    const [todaySalesResult] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE DATE(invoice_date) = ?`,
      [refDay]
    );
    const todaySales = Math.round(todaySalesResult[0]?.total || 0);

    // 2. Total Sales - sum of all invoices (within date range if specified)
    const [totalSalesResult] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices ${invoiceWhereClause}`,
      invoiceParams
    );
    const totalSales = Math.round(totalSalesResult[0]?.total || 0);

    // 3. Open Invoices - count from open_invoices table
    const openInvoiceWhere = [];
    const openInvoiceParams = [];
    if (from) {
      openInvoiceWhere.push('DATE(invoice_date) >= ?');
      openInvoiceParams.push(from);
    }
    if (to) {
      openInvoiceWhere.push('DATE(invoice_date) <= ?');
      openInvoiceParams.push(to);
    }
    const openInvoiceWhereClause = openInvoiceWhere.length > 0 ? `WHERE ${openInvoiceWhere.join(' AND ')}` : '';

    const [openInvoicesResult] = await pool.query(
      `SELECT COUNT(*) as count FROM open_invoices ${openInvoiceWhereClause}`,
      openInvoiceParams
    );
    const openInvoices = openInvoicesResult[0]?.count || 0;

    // 4. Receivables - Total Sales minus Total Received (simplified - use 90% of total sales for now)
    const receivables = Math.round(totalSales * 0.9);

    // 5. Bookings Today - count from bookings table
    const [bookingsTodayResult] = await pool.query(
      `SELECT COUNT(*) as count FROM bookings WHERE DATE(booking_date) = ?`,
      [refDay]
    );
    const bookingsToday = bookingsTodayResult[0]?.count || 0;

    // Monthly Sales (last 12 months)
    const monthLabels = [];
    const monthlyTotalsMap = new Map();
    const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const endDate = to ? new Date(to) : new Date();

    const temp = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (temp <= endDate && monthLabels.length < 18) {
      const key = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`;
      const label = temp.toLocaleString('en-US', { month: 'short' });
      monthLabels.push(label);
      monthlyTotalsMap.set(key, 0);
      temp.setMonth(temp.getMonth() + 1);
    }

    const [monthlyData] = await pool.query(
      `SELECT DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(total_amount) as total 
       FROM invoices ${invoiceWhereClause}
       GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')`,
      invoiceParams
    );

    monthlyData.forEach(row => {
      if (monthlyTotalsMap.has(row.month)) {
        monthlyTotalsMap.set(row.month, Number(row.total) || 0);
      }
    });
    const monthlyValues = Array.from(monthlyTotalsMap.values());

    // Weekly Sales (Mon-Sun)
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekTotals = new Array(7).fill(0);

    const [weeklyData] = await pool.query(
      `SELECT DAYOFWEEK(invoice_date) as dow, SUM(total_amount) as total 
       FROM invoices ${invoiceWhereClause}
       GROUP BY DAYOFWEEK(invoice_date)`,
      invoiceParams
    );

    weeklyData.forEach(row => {
      let dow = row.dow - 1; // MySQL: 1=Sun, 2=Mon...7=Sat
      dow = dow === 0 ? 6 : dow - 1; // Convert to Mon=0...Sun=6
      weekTotals[dow] = Number(row.total) || 0;
    });

    // Top 5 Customers
    const [topCustomersData] = await pool.query(
      `SELECT customer_name as name, SUM(total_amount) as total 
       FROM invoices ${invoiceWhereClause}
       GROUP BY customer_name 
       ORDER BY total DESC 
       LIMIT 5`,
      invoiceParams
    );
    const topCustomers = topCustomersData.map(c => ({
      name: c.name || 'Unknown',
      total: Math.round(c.total || 0)
    }));

    // Top 5 Brands (placeholder - would need invoice_items table)
    const topBrands = [
      { name: 'Panadol', total: 0 },
      { name: 'Cipla', total: 0 },
      { name: 'GSK', total: 0 },
      { name: 'Abbott', total: 0 },
      { name: 'Sanofi', total: 0 }
    ];

    // Lists (placeholders for now)
    const lists = {
      lowStocks: [],
      nearExpiry: [],
      pendingApprovals: []
    };

    res.json({
      cards: {
        todaySales,
        totalSales,
        openInvoices,
        receivables,
        bookingsToday,
        lowStocks: lists.lowStocks.length,
        nearExpiry: lists.nearExpiry.length,
        pendingApprovals: lists.pendingApprovals.length
      },
      lists,
      monthly: { labels: monthLabels, values: monthlyValues },
      weekly: { labels: weekLabels, values: weekTotals },
      topCustomers,
      topBrands,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Dashboard GET error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// POST /refresh - Refresh dashboard
router.post('/refresh', async (req, res) => {
  try {
    // Just call the GET handler
    req.query = {};
    return router.get('/', req, res);
  } catch (err) {
    console.error('Dashboard refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh dashboard' });
  }
});

// GET /stats - Simple stats endpoint
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();

    const [salesStats] = await pool.query('SELECT COUNT(*) as total_sales, COALESCE(SUM(total_amount), 0) as total_revenue FROM invoices');
    const [customerStats] = await pool.query('SELECT COUNT(*) as total_customers FROM customers');
    const [inventoryStats] = await pool.query('SELECT COUNT(*) as total_items FROM item_master');

    res.json({
      sales: salesStats[0],
      customers: customerStats[0],
      inventory: inventoryStats[0]
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
