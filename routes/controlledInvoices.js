// routes/controlledInvoices.js - MySQL Version
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { getPool } = require('../db-mysql');

const router = express.Router();

// Setup directories
const signatureDir = path.join(__dirname, "..", "signatures");
const invoiceDir = path.join(__dirname, "..", "invoices");
if (!fs.existsSync(signatureDir)) fs.mkdirSync(signatureDir, { recursive: true });
if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

// Multer for signature upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, signatureDir),
  filename: (req, file, cb) =>
    cb(null, `manager_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// GET all controlled invoices
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [invoices] = await pool.query(`
      SELECT id, customer_id, customer_name, invoice_date, reason, status,
             approved_by, approved_by_signature_path, approved_at,
             rejected_by, rejected_at, rejection_reason,
             created_at, updated_at
      FROM controlled_invoices
      ORDER BY invoice_date DESC, id DESC
    `);

    // Get bookings and approval log for each invoice
    for (let invoice of invoices) {
      const [bookingLinks] = await pool.query(`
        SELECT booking_id FROM controlled_invoice_bookings WHERE controlled_invoice_id = ?
      `, [invoice.id]);

      const [approvalLog] = await pool.query(`
        SELECT action, by_user, action_at, reason
        FROM controlled_invoice_approval_log
        WHERE controlled_invoice_id = ?
        ORDER BY action_at ASC
      `, [invoice.id]);

      invoice.bookingIds = bookingLinks.map(b => b.booking_id);
      invoice.customer = invoice.customer_name;
      invoice.date = invoice.invoice_date;
      invoice.approvedBy = invoice.approved_by;
      invoice.approvedBySignaturePath = invoice.approved_by_signature_path;
      invoice.approvedAt = invoice.approved_at;
      invoice.rejectedBy = invoice.rejected_by;
      invoice.rejectedAt = invoice.rejected_at;
      invoice.rejectionReason = invoice.rejection_reason;
      invoice.approvalLog = approvalLog.map(log => ({
        action: log.action,
        by: log.by_user,
        at: log.action_at,
        reason: log.reason
      }));
    }

    res.json(invoices);
  } catch (err) {
    console.error("load controlled invoices", err);
    res.status(500).json({ error: "Failed to load controlled invoices" });
  }
});

// GET available bookings
router.get("/available-bookings", async (req, res) => {
  try {
    const pool = getPool();

    // Get all bookings that require approval and aren't already in controlled invoices
    const [usedBookings] = await pool.query(`
      SELECT DISTINCT booking_id FROM controlled_invoice_bookings
    `);
    const usedIds = usedBookings.map(b => b.booking_id);

    const [bookings] = await pool.query(`
      SELECT b.id, b.customer_id, b.customer_name, b.route, b.booking_date,
             b.total_amount, b.status, b.requires_approval
      FROM bookings b
      WHERE b.requires_approval = 1
      ORDER BY b.booking_date DESC
    `);

    // Filter out used bookings
    const available = bookings.filter(b => !usedIds.includes(b.id));

    // Format for compatibility
    const formatted = available.map(b => ({
      id: b.id,
      customerId: b.customer_id,
      customer: b.customer_name,
      route: b.route,
      date: b.booking_date,
      bookingDate: b.booking_date,
      total: parseFloat(b.total_amount),
      amount: parseFloat(b.total_amount),
      status: b.status,
      requiresApproval: b.requires_approval
    }));

    res.json(formatted);
  } catch (err) {
    console.error("available bookings error", err);
    res.status(500).json({ error: "Failed to load available bookings" });
  }
});

// POST create controlled invoice
router.post("/", async (req, res) => {
  try {
    const { bookingIds = [], reason } = req.body || {};

    if (!bookingIds || bookingIds.length === 0) {
      return res.status(400).json({ error: "No valid bookings selected" });
    }

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get selected bookings
      const placeholders = bookingIds.map(() => '?').join(',');
      const [bookings] = await connection.query(`
        SELECT id, customer_id, customer_name FROM bookings WHERE id IN (${placeholders})
      `, bookingIds);

      if (bookings.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: "No valid bookings found" });
      }

      const primaryBooking = bookings[0];

      // Insert controlled invoice
      const [result] = await connection.query(`
        INSERT INTO controlled_invoices (
          customer_id, customer_name, invoice_date, reason, status
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        primaryBooking.customer_id,
        primaryBooking.customer_name,
        new Date().toISOString().split("T")[0],
        reason || '',
        "Pending"
      ]);

      const invoiceId = result.insertId;

      // Link bookings
      for (const bookingId of bookingIds) {
        await connection.query(`
          INSERT INTO controlled_invoice_bookings (controlled_invoice_id, booking_id)
          VALUES (?, ?)
        `, [invoiceId, bookingId]);
      }

      await connection.commit();

      // Fetch created invoice
      const [newInvoice] = await connection.query(`
        SELECT id, customer_id, customer_name, invoice_date, reason, status,
               approved_by, approved_by_signature_path, approved_at,
               rejected_by, rejected_at, rejection_reason,
               created_at, updated_at
        FROM controlled_invoices
        WHERE id = ?
      `, [invoiceId]);

      const invoice = newInvoice[0];
      invoice.bookingIds = bookingIds;
      invoice.customer = invoice.customer_name;
      invoice.date = invoice.invoice_date;
      invoice.approvedBy = invoice.approved_by;
      invoice.approvedBySignaturePath = invoice.approved_by_signature_path;
      invoice.approvedAt = invoice.approved_at;
      invoice.approvalLog = [];

      connection.release();
      res.status(201).json(invoice);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error("create controlled invoice err", err);
    res.status(500).json({ error: "Failed to create controlled invoice" });
  }
});

// PUT approve with signature
router.put("/:id/approve", upload.single("signature"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [invoices] = await connection.query('SELECT * FROM controlled_invoices WHERE id = ?', [id]);
      if (invoices.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: "Invoice not found" });
      }

      const invoice = invoices[0];
      const managerName = (req.body.managerName || req.body.approver || 'Manager').toString();
      let signaturePath = invoice.approved_by_signature_path;

      // Handle file upload
      if (req.file && req.file.filename) {
        signaturePath = req.file.filename;
      } else if (req.body.signature) {
        // Handle base64 signature
        try {
          const data = String(req.body.signature);
          const matches = data.match(/^data:(image\/(png|jpeg));base64,(.+)$/);
          const base64 = matches ? matches[3] : data.replace(/^data:.*;base64,/, "");
          const ext = matches ? (matches[2] === 'jpeg' ? '.jpg' : '.png') : '.png';
          const filename = `manager_${Date.now()}${ext}`;
          const filePath = path.join(signatureDir, filename);
          fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
          signaturePath = filename;
        } catch (e) {
          console.warn("Failed to save base64 signature:", e);
        }
      }

      const approvedAt = new Date().toISOString();

      // Update invoice
      await connection.query(`
        UPDATE controlled_invoices
        SET status = ?, approved_by = ?, approved_by_signature_path = ?, approved_at = ?
        WHERE id = ?
      `, ["Approved", managerName, signaturePath, approvedAt, id]);

      // Add to approval log
      await connection.query(`
        INSERT INTO controlled_invoice_approval_log (
          controlled_invoice_id, action, by_user, action_at
        ) VALUES (?, ?, ?, ?)
      `, [id, "Approved", managerName, approvedAt]);

      await connection.commit();

      // Fetch updated invoice
      const [updated] = await connection.query(`
        SELECT id, customer_id, customer_name, invoice_date, reason, status,
               approved_by, approved_by_signature_path, approved_at,
               rejected_by, rejected_at, rejection_reason
        FROM controlled_invoices
        WHERE id = ?
      `, [id]);

      const [approvalLog] = await connection.query(`
        SELECT action, by_user, action_at, reason
        FROM controlled_invoice_approval_log
        WHERE controlled_invoice_id = ?
        ORDER BY action_at ASC
      `, [id]);

      const result = updated[0];
      result.customer = result.customer_name;
      result.date = result.invoice_date;
      result.approvedBy = result.approved_by;
      result.approvedBySignaturePath = result.approved_by_signature_path;
      result.approvedAt = result.approved_at;
      result.approvalLog = approvalLog.map(log => ({
        action: log.action,
        by: log.by_user,
        at: log.action_at,
        reason: log.reason
      }));

      connection.release();
      res.json(result);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error("approve error", err);
    res.status(500).json({ error: "Failed to approve invoice" });
  }
});

// PUT reject
router.put("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [invoices] = await connection.query('SELECT * FROM controlled_invoices WHERE id = ?', [id]);
      if (invoices.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: "Invoice not found" });
      }

      const managerName = req.body.managerName || "Manager";
      const rejectionReason = req.body.reason || "No reason";
      const rejectedAt = new Date().toISOString();

      // Update invoice
      await connection.query(`
        UPDATE controlled_invoices
        SET status = ?, rejected_by = ?, rejected_at = ?, rejection_reason = ?
        WHERE id = ?
      `, ["Rejected", managerName, rejectedAt, rejectionReason, id]);

      // Add to approval log
      await connection.query(`
        INSERT INTO controlled_invoice_approval_log (
          controlled_invoice_id, action, by_user, action_at, reason
        ) VALUES (?, ?, ?, ?, ?)
      `, [id, "Rejected", managerName, rejectedAt, rejectionReason]);

      await connection.commit();

      // Fetch updated invoice
      const [updated] = await connection.query(`
        SELECT id, customer_id, customer_name, invoice_date, reason, status,
               approved_by, approved_by_signature_path, approved_at,
               rejected_by, rejected_at, rejection_reason
        FROM controlled_invoices
        WHERE id = ?
      `, [id]);

      const [approvalLog] = await connection.query(`
        SELECT action, by_user, action_at, reason
        FROM controlled_invoice_approval_log
        WHERE controlled_invoice_id = ?
        ORDER BY action_at ASC
      `, [id]);

      const result = updated[0];
      result.customer = result.customer_name;
      result.date = result.invoice_date;
      result.rejectedBy = result.rejected_by;
      result.rejectedAt = result.rejected_at;
      result.rejectionReason = result.rejection_reason;
      result.approvalLog = approvalLog.map(log => ({
        action: log.action,
        by: log.by_user,
        at: log.action_at,
        reason: log.reason
      }));

      connection.release();
      res.json(result);

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error("reject error", err);
    res.status(500).json({ error: "Failed to reject invoice" });
  }
});

// DELETE controlled invoice
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM controlled_invoices WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("delete controlled error", err);
    res.status(500).json({ error: "Failed to delete controlled invoice" });
  }
});

// PDF Generation
router.get("/:id/pdf", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [invoices] = await pool.query(`
      SELECT ci.id, ci.customer_id, ci.customer_name, ci.invoice_date,
             ci.reason, ci.status, ci.approved_by, ci.approved_by_signature_path,
             ci.approved_at
      FROM controlled_invoices ci
      WHERE ci.id = ?
    `, [id]);

    if (invoices.length === 0) return res.status(404).json({ error: "Invoice not found" });

    const invoice = invoices[0];

    // Get linked bookings
    const [bookingLinks] = await pool.query(`
      SELECT b.id, b.customer_id, b.booking_date, b.total_amount, b.ntn, b.cnic, b.filer_status
      FROM controlled_invoice_bookings cib
      JOIN bookings b ON cib.booking_id = b.id
      WHERE cib.controlled_invoice_id = ?
    `, [id]);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="controlled-invoice-${invoice.id}.pdf"`);
    doc.pipe(res);

    // Layout constants
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const headerHeight = 100;
    const footerHeight = 90;
    const contentTop = margin + headerHeight;
    const contentBottom = pageHeight - margin - footerHeight;
    const contentWidth = pageWidth - margin * 2;

    // Helpers
    const logoPath = path.join(__dirname, "..", "public", "logo.png");
    const sigPath = invoice.approved_by_signature_path ? path.join(signatureDir, invoice.approved_by_signature_path) : null;
    const drawText = (text, x, y, opts = {}) => doc.text(text, x, y, Object.assign({ width: opts.width || 200 }, opts));

    // Header
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, margin - 6, { width: 90, height: 60 });
      }
    } catch (e) { /* ignore */ }

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#007a3d")
      .text("Controlled Invoice", margin + 110, margin + 6, { align: "left" });

    doc.moveTo(margin, margin + headerHeight - 10).lineTo(pageWidth - margin, margin + headerHeight - 10).strokeColor("#e6e6e6").stroke();

    // Content
    let y = contentTop - 30;
    const leftCol = margin;
    const rightCol = pageWidth - margin - 220;

    doc.fillColor("#000").font("Helvetica").fontSize(10);

    drawText(`Invoice #: ${invoice.id}`, leftCol, y);
    drawText(`Date: ${invoice.invoice_date || ""}`, rightCol, y);
    y += 18;
    drawText(`Customer: ${invoice.customer_name || "—"}`, leftCol, y);
    drawText(`Status: ${invoice.status || ""}`, rightCol, y);
    y += 18;
    if (invoice.reason) { drawText(`Reason: ${invoice.reason}`, leftCol, y); y += 18; }

    // Get customer details from first booking
    const primaryBooking = bookingLinks[0] || {};
    const ntn = primaryBooking.ntn || '';
    const cnic = primaryBooking.cnic || '';
    const filerStatus = primaryBooking.filer_status || '';

    if (ntn) { drawText(`NTN: ${ntn}`, leftCol, y); y += 16; }
    if (cnic) { drawText(`CNIC: ${cnic}`, leftCol, y); y += 16; }
    if (filerStatus) { drawText(`Filer Status: ${filerStatus}`, leftCol, y); y += 16; }

    y += 6;

    // Table header
    const col1X = leftCol;
    const col2X = leftCol + 80;
    const col3X = leftCol + 320;
    const col4X = leftCol + 420;

    doc.font("Helvetica-Bold").fontSize(10);
    drawText("Booking ID", col1X, y);
    drawText("Description", col2X, y);
    drawText("Date", col3X, y);
    drawText("Amount", col4X, y, { align: "right", width: 80 });
    y += 14;
    doc.moveTo(leftCol, y).lineTo(pageWidth - margin, y).strokeColor("#f0f0f0").stroke();
    y += 8;

    // Items
    doc.font("Helvetica").fontSize(10);
    let total = 0;
    for (const b of bookingLinks) {
      const dateStr = b.booking_date || "";
      const amount = parseFloat(b.total_amount || 0);
      total += amount;

      drawText(String(b.id), col1X, y);
      drawText("Booking", col2X, y);
      drawText(dateStr, col3X, y);
      drawText(amount ? amount.toFixed(2) : "-", col4X, y, { align: "right", width: 80 });
      y += 16;

      if (y > contentBottom - 60) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#666666").text("...more items omitted...", leftCol, y);
        y += 14;
        break;
      }
    }

    // Totals
    y += 8;
    doc.font("Helvetica-Bold").fontSize(11);
    drawText("Total", col3X, y, { align: "right", width: 80 });
    drawText(total ? total.toFixed(2) : "0.00", col4X, y, { align: "right", width: 80 });
    y += 18;

    // Approval block
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
    drawText("Approval", leftCol, y);
    y += 14;
    doc.font("Helvetica").fontSize(10);
    drawText(`Approved By: ${invoice.approved_by || "-"}`, leftCol, y);
    y += 14;
    drawText(`Approved At: ${invoice.approved_at || "-"}`, leftCol, y);
    y += 18;

    if (sigPath && fs.existsSync(sigPath)) {
      try {
        const sigW = 160;
        const sigH = 60;
        const sigX = pageWidth - margin - sigW;
        const sigY = Math.max(contentTop, y - 10);
        doc.image(sigPath, sigX, sigY, { fit: [sigW, sigH] });
        doc.fontSize(9).font("Helvetica-Oblique").fillColor("#333").text(`(${invoice.approved_by || ""})`, sigX, sigY + sigH + 4);
        doc.fillColor("#000");
      } catch (e) { /* ignore */ }
    }

    // Footer
    const footerY = pageHeight - margin - footerHeight + 12;
    doc.moveTo(margin, footerY - 8).lineTo(pageWidth - margin, footerY - 8).strokeColor("#e6e6e6").stroke();

    doc.font("Helvetica").fontSize(9).fillColor("#333");
    const footerLeft = margin;
    const footerWidth = pageWidth - margin * 2;
    const footerTextLines = [
      "Faizan Medicine Company",
      "House No CB-28, Sikandarabad Supply Mansehra Road (Abbottabad)",
      "Phone: +92 3028225831 , +92 3127000265",
      "Email: fezanmc@gmail.com , fezanmc@yahoo.com",
      "Thank you for your business"
    ];
    let fy = footerY;
    for (const line of footerTextLines) {
      drawText(line, footerLeft, fy, { width: footerWidth, align: "center" });
      fy += 12;
    }

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
    doc.text(`Controlled Invoice #${invoice.id}`, 0, pageHeight - margin - 18, { align: "center" });

    doc.end();
  } catch (err) {
    console.error("pdf error", err);
    try { if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" }); else res.end(); } catch (e) { }
  }
});

module.exports = router;
