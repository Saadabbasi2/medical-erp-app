// routes/itemMaster.js - MySQL Version
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
    const [items] = await pool.query('SELECT * FROM item_master ORDER BY created_at DESC');
    res.json(items);
  } catch (err) {
    console.error('Get item master error:', err);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

router.post("/", async (req, res) => {
  try {
    const pool = getPool();
    const { name, strength, form, pack, hsn, quantity, barcode } = req.body;

    const [result] = await pool.query(`
      INSERT INTO item_master (name, strength, form, pack, hsn, quantity, barcode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name || '', strength || '', form || '', pack || '', hsn || '', quantity || 0, barcode || '']);

    const [newItem] = await pool.query('SELECT * FROM item_master WHERE id = ?', [result.insertId]);
    res.json({ success: true, item: newItem[0] });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM item_master WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ---------- Barcode Scan ----------
router.get("/scan/:barcode", async (req, res) => {
  try {
    const pool = getPool();
    const [items] = await pool.query('SELECT * FROM item_master WHERE barcode = ?', [req.params.barcode]);
    if (items.length > 0) {
      return res.json({ success: true, item: items[0] });
    }
    res.json({ success: false });
  } catch (err) {
    console.error('Barcode scan error:', err);
    res.status(500).json({ error: 'Failed to scan barcode' });
  }
});

// ---------- Accept into Inventory + Auto Add to Warehouse ----------
router.post("/accept", async (req, res) => {
  try {
    const item = req.body;
    if (!item) return res.status(400).json({ success: false, message: "Invalid item data" });

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1️⃣ Add to Inventory
      const [invResult] = await connection.query(`
        INSERT INTO inventory (item_id, name, quantity, accepted_date)
        VALUES (?, ?, ?, ?)
      `, [item.id || null, item.name || '', item.quantity || 0, new Date().toISOString().split("T")[0]]);

      const [invEntry] = await connection.query('SELECT * FROM inventory WHERE id = ?', [invResult.insertId]);

      // 2️⃣ Auto Add to Warehouse / Bins
      const batchNo = item.batchNo || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`;
      const [whResult] = await connection.query(`
        INSERT INTO warehouse_bins (warehouse_name, bin_code, batch_no, mfg_date, expiry_date, batch_qty, batch_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'Main Warehouse',
        'AUTO',
        batchNo,
        item.mfgDate || new Date().toISOString().split("T")[0],
        item.expiryDate || null,
        item.quantity || 0,
        'Active'
      ]);

      const [warehouseEntry] = await connection.query('SELECT * FROM warehouse_bins WHERE id = ?', [whResult.insertId]);

      await connection.commit();
      res.json({ success: true, inventory: invEntry[0], warehouse: warehouseEntry[0] });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Accept item error:', err);
    res.status(500).json({ error: 'Failed to accept item' });
  }
});

// ---------- Export PDF ----------
router.get("/export/pdf", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM item_master');

    const formatted = data.map(d => ({
      name: d.name || '-',
      strength: d.strength || '-',
      form: d.form || '-',
      pack: d.pack || '-',
      hsn: d.hsn || '-',
      quantity: d.quantity || 0
    }));

    const columns = [
      { label: "Item Name", key: "name", widthRatio: 0.25 },
      { label: "Strength", key: "strength", widthRatio: 0.15 },
      { label: "Form", key: "form", widthRatio: 0.15 },
      { label: "Pack", key: "pack", widthRatio: 0.15 },
      { label: "HSN Code", key: "hsn", widthRatio: 0.1 },
      { label: "Quantity", key: "quantity", widthRatio: 0.1 }
    ];

    generateERPTablePDF(res, formatted, columns, "Item Master Summary", "Item_Master.pdf");
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ---------- Export Excel ----------
router.get("/export/excel", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query('SELECT * FROM item_master');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Item Master");
    sheet.columns = [
      { header: "Item Name", key: "name", width: 25 },
      { header: "Strength", key: "strength", width: 15 },
      { header: "Form", key: "form", width: 15 },
      { header: "Pack", key: "pack", width: 15 },
      { header: "HSN Code", key: "hsn", width: 15 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Barcode", key: "barcode", width: 25 }
    ];

    data.forEach(d => sheet.addRow(d));

    const filePath = path.join(__dirname, "..", "data", "Item_Master.xlsx");
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, "Item_Master.xlsx");
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

module.exports = router;
