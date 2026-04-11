// routes/deliverySummary.js - MySQL Version
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();
const storageDir = path.join(__dirname, "..", "assets", "pod");
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

// multer config for POD uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `pod-${unique}${ext}`);
  },
});
const upload = multer({ storage });

// GET all delivery records
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [deliveries] = await pool.query(`
      SELECT id, trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_filename, pod_status, pod_uploaded_at, notes,
             delivery_date, created_at, updated_at
      FROM delivery_summary
      ORDER BY delivery_date DESC, id DESC
    `);

    // Format for compatibility
    const formatted = deliveries.map(d => ({
      id: d.id,
      tripId: d.trip_id,
      route: d.route,
      vehicle: d.vehicle,
      driver: d.driver,
      loadedQty: d.loaded_qty,
      deliveredQty: d.delivered_qty,
      returnedQty: d.returned_qty,
      podFilename: d.pod_filename,
      podStatus: d.pod_status,
      podUploadedAt: d.pod_uploaded_at,
      notes: d.notes,
      date: d.delivery_date,
      createdAt: d.created_at
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Load delivery summary error:', err);
    res.status(500).json({ error: 'Failed to load delivery summary' });
  }
});

// GET single record
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const [deliveries] = await pool.query(`
      SELECT id, trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_filename, pod_status, pod_uploaded_at, notes,
             delivery_date, created_at, updated_at
      FROM delivery_summary
      WHERE id = ?
    `, [id]);

    if (deliveries.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const d = deliveries[0];
    const formatted = {
      id: d.id,
      tripId: d.trip_id,
      route: d.route,
      vehicle: d.vehicle,
      driver: d.driver,
      loadedQty: d.loaded_qty,
      deliveredQty: d.delivered_qty,
      returnedQty: d.returned_qty,
      podFilename: d.pod_filename,
      podStatus: d.pod_status,
      podUploadedAt: d.pod_uploaded_at,
      notes: d.notes,
      date: d.delivery_date,
      createdAt: d.created_at
    };

    res.json(formatted);
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ error: 'Failed to get delivery' });
  }
});

// POST create new delivery record
router.post("/", async (req, res) => {
  try {
    const {
      tripId,
      route,
      vehicle,
      driver,
      loadedQty,
      deliveredQty,
      returnedQty,
      notes,
      date,
    } = req.body || {};

    const pool = getPool();
    const [result] = await pool.query(`
      INSERT INTO delivery_summary (
        trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
        returned_qty, pod_status, notes, delivery_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tripId || "",
      route || "",
      vehicle || "",
      driver || "",
      Number(loadedQty) || 0,
      Number(deliveredQty) || 0,
      Number(returnedQty) || 0,
      "Not Captured",
      notes || "",
      date || new Date().toISOString().split("T")[0]
    ]);

    const deliveryId = result.insertId;

    // Fetch created delivery
    const [newDelivery] = await pool.query(`
      SELECT id, trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_filename, pod_status, pod_uploaded_at, notes,
             delivery_date, created_at
      FROM delivery_summary
      WHERE id = ?
    `, [deliveryId]);

    const d = newDelivery[0];
    const formatted = {
      id: d.id,
      tripId: d.trip_id,
      route: d.route,
      vehicle: d.vehicle,
      driver: d.driver,
      loadedQty: d.loaded_qty,
      deliveredQty: d.delivered_qty,
      returnedQty: d.returned_qty,
      podFilename: d.pod_filename,
      podStatus: d.pod_status,
      podUploadedAt: d.pod_uploaded_at,
      notes: d.notes,
      date: d.delivery_date,
      createdAt: d.created_at
    };

    res.status(201).json(formatted);
  } catch (err) {
    console.error("create delivery error", err);
    res.status(500).json({ error: "Failed to create" });
  }
});

// PUT update record (non-file fields)
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      tripId,
      route,
      vehicle,
      driver,
      loadedQty,
      deliveredQty,
      returnedQty,
      notes,
      date,
    } = req.body || {};

    const pool = getPool();

    // Check if exists
    const [existing] = await pool.query('SELECT * FROM delivery_summary WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const current = existing[0];

    // Update
    await pool.query(`
      UPDATE delivery_summary
      SET trip_id = ?, route = ?, vehicle = ?, driver = ?,
          loaded_qty = ?, delivered_qty = ?, returned_qty = ?,
          notes = ?, delivery_date = ?
      WHERE id = ?
    `, [
      tripId ?? current.trip_id,
      route ?? current.route,
      vehicle ?? current.vehicle,
      driver ?? current.driver,
      Number(loadedQty ?? current.loaded_qty) || 0,
      Number(deliveredQty ?? current.delivered_qty) || 0,
      Number(returnedQty ?? current.returned_qty) || 0,
      notes ?? current.notes,
      date ?? current.delivery_date,
      id
    ]);

    // Fetch updated
    const [updated] = await pool.query(`
      SELECT id, trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_filename, pod_status, pod_uploaded_at, notes,
             delivery_date, created_at
      FROM delivery_summary
      WHERE id = ?
    `, [id]);

    const d = updated[0];
    const formatted = {
      id: d.id,
      tripId: d.trip_id,
      route: d.route,
      vehicle: d.vehicle,
      driver: d.driver,
      loadedQty: d.loaded_qty,
      deliveredQty: d.delivered_qty,
      returnedQty: d.returned_qty,
      podFilename: d.pod_filename,
      podStatus: d.pod_status,
      podUploadedAt: d.pod_uploaded_at,
      notes: d.notes,
      date: d.delivery_date,
      createdAt: d.created_at
    };

    res.json(formatted);
  } catch (err) {
    console.error("update delivery error", err);
    res.status(500).json({ error: "Failed to update" });
  }
});

// POST upload POD for a record
router.post("/:id/pod", upload.single("pod"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [existing] = await pool.query('SELECT * FROM delivery_summary WHERE id = ?', [id]);
    if (existing.length === 0) {
      // remove uploaded file if not used
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Not found" });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const item = existing[0];

    // remove old file if exists
    if (item.pod_filename) {
      const oldPath = path.join(storageDir, item.pod_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Update with new POD
    await pool.query(`
      UPDATE delivery_summary
      SET pod_filename = ?, pod_status = ?, pod_uploaded_at = ?
      WHERE id = ?
    `, [req.file.filename, "Captured", new Date().toISOString(), id]);

    // Fetch updated
    const [updated] = await pool.query(`
      SELECT id, trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_filename, pod_status, pod_uploaded_at, notes,
             delivery_date, created_at
      FROM delivery_summary
      WHERE id = ?
    `, [id]);

    const d = updated[0];
    const formatted = {
      id: d.id,
      tripId: d.trip_id,
      route: d.route,
      vehicle: d.vehicle,
      driver: d.driver,
      loadedQty: d.loaded_qty,
      deliveredQty: d.delivered_qty,
      returnedQty: d.returned_qty,
      podFilename: d.pod_filename,
      podStatus: d.pod_status,
      podUploadedAt: d.pod_uploaded_at,
      notes: d.notes,
      date: d.delivery_date,
      createdAt: d.created_at
    };

    res.json(formatted);
  } catch (err) {
    console.error("upload pod error", err);
    res.status(500).json({ error: "Failed to upload" });
  }
});

// DELETE record
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [existing] = await pool.query('SELECT * FROM delivery_summary WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const item = existing[0];

    // delete POD file if exists
    if (item.pod_filename) {
      const f = path.join(storageDir, item.pod_filename);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    await pool.query('DELETE FROM delivery_summary WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("delete delivery error", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// Serve POD files statically
router.get("/pod/file/:filename", (req, res) => {
  const filename = req.params.filename;
  const file = path.join(storageDir, filename);
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  res.sendFile(file);
});

// PDF Export
router.get('/report/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [deliveries] = await pool.query(`
      SELECT trip_id, route, vehicle, driver, loaded_qty, delivered_qty,
             returned_qty, pod_status, pod_filename
      FROM delivery_summary
      ORDER BY delivery_date DESC
    `);

    if (deliveries.length === 0) {
      return res.status(404).json({ error: 'No delivery summary data found' });
    }

    const columns = [
      { label: 'Trip ID', key: 'tripId', widthRatio: 0.13 },
      { label: 'Route', key: 'route', widthRatio: 0.18 },
      { label: 'Vehicle', key: 'vehicle', widthRatio: 0.14 },
      { label: 'Driver', key: 'driver', widthRatio: 0.14 },
      { label: 'Loaded', key: 'loaded', widthRatio: 0.12 },
      { label: 'Delivered', key: 'delivered', widthRatio: 0.12 },
      { label: 'Returned', key: 'returned', widthRatio: 0.12 },
      { label: 'POD', key: 'pod', widthRatio: 0.05 }
    ];

    const transformedData = deliveries.map(d => ({
      tripId: d.trip_id || '',
      route: d.route || '',
      vehicle: d.vehicle || '',
      driver: d.driver || '',
      loaded: String(d.loaded_qty || 0),
      delivered: String(d.delivered_qty || 0),
      returned: String(d.returned_qty || 0),
      pod: (d.pod_status === 'Captured' || d.pod_filename) ? 'Captured' : 'No'
    }));

    generateERPTablePDF(res, transformedData, columns, 'Delivery Summary Report', 'delivery_summary_report.pdf');
  } catch (err) {
    console.error('Delivery summary PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;