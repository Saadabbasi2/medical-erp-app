// ======================= routes/documentPosting.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");

// Data sources from ERP modules
const salesFile = path.join(__dirname, "..", "data", "salesReports.json");
const purchasesFile = path.join(__dirname, "..", "data", "purchaseInvoices.json");
const creditNotesFile = path.join(__dirname, "..", "data", "debitCredit.json");
const collectionsFile = path.join(__dirname, "..", "data", "summaryCollection.json");

// Posted document record
const postingsFile = path.join(__dirname, "..", "data", "postedDocs.json");

// Helpers
function readSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
  } catch {
    return [];
  }
}
function writeSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ========== GET PENDING DOCUMENTS (REAL ERP DATA) ==========
router.get("/pending", (req, res) => {
  const sales = readSafe(salesFile).filter(s => s.status === "Pending" || s.posted === false);
  const purchases = readSafe(purchasesFile).filter(p => p.status === "Pending" || p.posted === false);
  const credits = readSafe(creditNotesFile).filter(c => c.status === "Pending" || c.posted === false);
  const collections = readSafe(collectionsFile).filter(c => c.status === "Pending" || c.posted === false);

  const docs = [
    ...sales.map(d => ({
      id: d.id,
      type: "Sales Invoice",
      docNo: d.invoiceNo || `INV-${d.id}`,
      date: d.date || new Date().toISOString().split("T")[0],
      amount: d.amount || 0,
    })),
    ...purchases.map(d => ({
      id: d.id,
      type: "Purchase Order",
      docNo: d.poNo || `PO-${d.id}`,
      date: d.date || new Date().toISOString().split("T")[0],
      amount: d.amount || 0,
    })),
    ...credits.map(d => ({
      id: d.id,
      type: "Credit Note",
      docNo: d.noteNo || `CR-${d.id}`,
      date: d.date || new Date().toISOString().split("T")[0],
      amount: d.amount || 0,
    })),
    ...collections.map(d => ({
      id: d.id,
      type: "Collection",
      docNo: d.receiptNo || `RC-${d.id}`,
      date: d.date || new Date().toISOString().split("T")[0],
      amount: d.amount || 0,
    })),
  ];

  res.json(docs);
});

// ========== BULK POST SELECTED DOCS ==========
router.post("/post", (req, res) => {
  const { docs } = req.body;
  if (!Array.isArray(docs) || !docs.length)
    return res.status(400).json({ success: false, message: "No documents provided" });

  const postedDocs = readSafe(postingsFile);
  const timestamp = new Date().toISOString();

  docs.forEach(d => {
    postedDocs.push({
      ...d,
      postedAt: timestamp,
      postedBy: "System Auto-Posting",
      status: "Posted",
    });
  });

  writeSafe(postingsFile, postedDocs);
  res.json({ success: true, count: docs.length });
});

// ========== EXPORT TO PDF ==========
router.get("/export/pdf", (req, res) => {
  const data = readSafe(postingsFile);
  const columns = [
    { label: "Document Type", key: "type", widthRatio: 0.2 },
    { label: "Document No", key: "docNo", widthRatio: 0.2 },
    { label: "Date", key: "date", widthRatio: 0.2 },
    { label: "Amount", key: "amount", widthRatio: 0.2 },
    { label: "Status", key: "status", widthRatio: 0.2 },
  ];
  generateERPTablePDF(res, data, columns, "Bulk Document Posting Report", "Posted_Documents.pdf");
});

// ========== EXPORT TO EXCEL ==========
router.get("/export/excel", async (req, res) => {
  const data = readSafe(postingsFile);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Posted Documents");
  sheet.columns = [
    { header: "Document Type", key: "type", width: 25 },
    { header: "Document No", key: "docNo", width: 25 },
    { header: "Date", key: "date", width: 20 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Status", key: "status", width: 15 },
  ];
  data.forEach(d => sheet.addRow(d));

  const filePath = path.join(__dirname, "..", "data", "Posted_Documents.xlsx");
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, "Posted_Documents.xlsx");
});

module.exports = router;
