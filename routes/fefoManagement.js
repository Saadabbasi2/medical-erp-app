// routes/fefoManagement.js - MySQL Version
const express = require("express");
const { getPool } = require("../db-mysql");
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");
const path = require("path");
const router = express.Router();

// ---------- GET: all current batches ----------
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM fefo_batches ORDER BY expiry_date ASC');
    res.json(data);
  } catch (err) {
    console.error('Get FEFO error:', err);
    res.status(500).json([]);
  }
});

// ---------- FEFO Pick (sorted ascending by expiry) ----------
router.get("/fefo-pick", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM fefo_batches WHERE batch_status = ? ORDER BY expiry_date ASC', ['Active']);

    // Also save to fefo_management table for tracking
    for (const batch of data) {
      await pool.query(`
        INSERT INTO fefo_management (product_name, batch_no, expiry_date, quantity, warehouse, priority)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), priority = VALUES(priority)
      `, [batch.warehouse_name || '', batch.batch_no, batch.expiry_date, batch.batch_qty, batch.warehouse_name, 1]);
    }

    res.json(data);
  } catch (err) {
    console.error('FEFO pick error:', err);
    res.status(500).json({ error: 'Failed to pick FEFO batches' });
  }
});

// ---------- Check Near-Expiry (<=30 days) ----------
router.get("/check-expiry", async (req, res) => {
  try {
    const pool = getPool();
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);

    const [nearExpiry] = await pool.query(`
      SELECT * FROM warehouse_bins 
      WHERE expiry_date <= ? AND batch_status = ?
      ORDER BY expiry_date ASC
    `, [limit.toISOString().split('T')[0], 'Active']);

    res.json(nearExpiry);
  } catch (err) {
    console.error('Check expiry error:', err);
    res.status(500).json({ error: 'Failed to check expiry' });
  }
});

// ---------- Auto-Return Expired Batches ----------
router.get("/auto-return", async (req, res) => {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const today = new Date().toISOString().split('T')[0];

      // Find expired batches
      const [expired] = await connection.query(`
        SELECT * FROM warehouse_bins 
        WHERE expiry_date < ? AND batch_status = ?
      `, [today, 'Active']);

      // Update their status to Returned
      if (expired.length > 0) {
        await connection.query(`
          UPDATE warehouse_bins 
          SET batch_status = 'Returned' 
          WHERE expiry_date < ? AND batch_status = ?
        `, [today, 'Active']);
      }

      await connection.commit();
      res.json(expired);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Auto-return error:', err);
    res.status(500).json({ error: 'Failed to auto-return expired batches' });
  }
});

// ---------- Export PDF ----------
router.get("/export/pdf", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM warehouse_bins ORDER BY expiry_date ASC');

    const formatted = data.map(d => ({
      warehouseName: d.warehouse_name || '-',
      batchNo: d.batch_no || '-',
      mfgDate: d.mfg_date || '-',
      expiryDate: d.expiry_date || '-',
      batchQty: d.batch_qty || 0,
      batchStatus: d.batch_status || '-'
    }));

    const columns = [
      { label: "Warehouse", key: "warehouseName", widthRatio: 0.2 },
      { label: "Batch No", key: "batchNo", widthRatio: 0.15 },
      { label: "MFG Date", key: "mfgDate", widthRatio: 0.15 },
      { label: "Expiry Date", key: "expiryDate", widthRatio: 0.15 },
      { label: "Quantity", key: "batchQty", widthRatio: 0.15 },
      { label: "Status", key: "batchStatus", widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, "FEFO / Expiry Batch List", "FEFO_Batches.pdf");
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ---------- Export Excel ----------
router.get("/export/excel", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM warehouse_bins ORDER BY expiry_date ASC');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("FEFO_Batches");

    sheet.columns = [
      { header: "Warehouse", key: "warehouse_name", width: 25 },
      { header: "Batch No", key: "batch_no", width: 20 },
      { header: "MFG Date", key: "mfg_date", width: 20 },
      { header: "Expiry Date", key: "expiry_date", width: 20 },
      { header: "Quantity", key: "batch_qty", width: 15 },
      { header: "Status", key: "batch_status", width: 20 }
    ];

    data.forEach(d => sheet.addRow(d));

    const filePath = path.join(__dirname, "..", "data", "FEFO_Batches.xlsx");
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, "FEFO_Batches.xlsx");
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// ---------- Export Return Note PDF ----------
router.get("/export/return-note", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query(`SELECT * FROM warehouse_bins WHERE batch_status = 'Returned'`);

    if (!data.length) {
      return res.status(404).json({ success: false, message: "No returned batches found." });
    }

    const formatted = data.map(d => ({
      warehouseName: d.warehouse_name || '-',
      batchNo: d.batch_no || '-',
      mfgDate: d.mfg_date || '-',
      expiryDate: d.expiry_date || '-',
      batchQty: d.batch_qty || 0,
      batchStatus: d.batch_status || '-'
    }));

    const columns = [
      { label: "Warehouse", key: "warehouseName", widthRatio: 0.2 },
      { label: "Batch No", key: "batchNo", widthRatio: 0.15 },
      { label: "MFG Date", key: "mfgDate", widthRatio: 0.15 },
      { label: "Expiry Date", key: "expiryDate", widthRatio: 0.15 },
      { label: "Quantity", key: "batchQty", widthRatio: 0.15 },
      { label: "Status", key: "batchStatus", widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, "Auto Return Note — Expired Batches", "Return_Note.pdf");
  } catch (err) {
    console.error('Return note PDF error:', err);
    res.status(500).json({ error: 'Failed to generate return note' });
  }
});

// ---------- Return Summary (for Dashboard) ----------
router.get("/return-summary", async (req, res) => {
  try {
    const pool = getPool();
    const [returns] = await pool.query(`SELECT * FROM warehouse_bins WHERE batch_status = 'Returned'`);

    if (!returns.length) {
      return res.json({
        totalBatches: 0,
        totalQty: 0,
        totalWarehouses: 0,
        warehouseNames: [],
        warehouseQty: []
      });
    }

    const totalBatches = returns.length;
    const totalQty = returns.reduce((sum, r) => sum + (r.batch_qty || 0), 0);

    // Group by warehouse
    const warehouseMap = {};
    returns.forEach(r => {
      warehouseMap[r.warehouse_name] = (warehouseMap[r.warehouse_name] || 0) + (r.batch_qty || 0);
    });

    const warehouseNames = Object.keys(warehouseMap);
    const warehouseQty = Object.values(warehouseMap);

    res.json({
      totalBatches,
      totalQty,
      totalWarehouses: warehouseNames.length,
      warehouseNames,
      warehouseQty
    });
  } catch (err) {
    console.error('Return summary error:', err);
    res.status(500).json({ error: 'Failed to get return summary' });
  }
});

module.exports = router;
