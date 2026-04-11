// routes/warehouseBins.js - MySQL Version
const express = require("express");
const { getPool } = require("../db-mysql");
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");
const path = require("path");
const router = express.Router();

// ---------- CRUD ----------
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [records] = await pool.query('SELECT * FROM warehouse_bins ORDER BY created_at DESC');
    res.json(records);
  } catch (err) {
    console.error('Get warehouse bins error:', err);
    res.status(500).json({ error: 'Failed to get warehouse bins' });
  }
});

router.post("/", async (req, res) => {
  try {
    const pool = getPool();
    const { warehouseName, binCode, batchNo, mfgDate, expiryDate, batchQty, batchStatus } = req.body;

    const [result] = await pool.query(`
      INSERT INTO warehouse_bins (warehouse_name, bin_code, batch_no, mfg_date, expiry_date, batch_qty, batch_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      warehouseName || '',
      binCode || '',
      batchNo || '',
      mfgDate || null,
      expiryDate || null,
      batchQty || 0,
      batchStatus || 'Active'
    ]);

    const [newRec] = await pool.query('SELECT * FROM warehouse_bins WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRec[0] });
  } catch (err) {
    console.error('Create warehouse bin error:', err);
    res.status(500).json({ error: 'Failed to create warehouse bin' });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM warehouse_bins WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ---------- Export PDF ----------
router.get("/export/pdf", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM warehouse_bins');

    const formatted = data.map(d => ({
      warehouseName: d.warehouse_name || '-',
      binCode: d.bin_code || '-',
      batchNo: d.batch_no || '-',
      mfgDate: d.mfg_date || '-',
      expiryDate: d.expiry_date || '-',
      batchQty: d.batch_qty || 0,
      batchStatus: d.batch_status || '-'
    }));

    const columns = [
      { label: "Warehouse", key: "warehouseName", widthRatio: 0.2 },
      { label: "Bin Code", key: "binCode", widthRatio: 0.15 },
      { label: "Batch No", key: "batchNo", widthRatio: 0.15 },
      { label: "MFG Date", key: "mfgDate", widthRatio: 0.15 },
      { label: "Expiry Date", key: "expiryDate", widthRatio: 0.15 },
      { label: "Quantity", key: "batchQty", widthRatio: 0.1 },
      { label: "Status", key: "batchStatus", widthRatio: 0.1 }
    ];

    generateERPTablePDF(res, formatted, columns, "Warehouse / Bins Summary", "Warehouse_Bins.pdf");
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ---------- Export Excel ----------
router.get("/export/excel", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM warehouse_bins');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Warehouse Bins");
    sheet.columns = [
      { header: "Warehouse", key: "warehouse_name", width: 20 },
      { header: "Bin Code", key: "bin_code", width: 15 },
      { header: "Batch No", key: "batch_no", width: 20 },
      { header: "MFG Date", key: "mfg_date", width: 15 },
      { header: "Expiry Date", key: "expiry_date", width: 15 },
      { header: "Quantity", key: "batch_qty", width: 10 },
      { header: "Status", key: "batch_status", width: 20 }
    ];

    data.forEach(d => sheet.addRow(d));

    const filePath = path.join(__dirname, "..", "data", "Warehouse_Bins.xlsx");
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, "Warehouse_Bins.xlsx");
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

module.exports = router;
