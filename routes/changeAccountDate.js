// ======================= routes/changeAccountDate.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");

const router = express.Router();

const dataFile = path.join(__dirname, "..", "data", "accountDate.json");
const auditFile = path.join(__dirname, "..", "data", "accountDateAudit.json");

// Safe JSON helpers
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

// ======================= GET CURRENT DATE =======================
router.get("/", (req, res) => {
  const records = readSafe(dataFile);
  const current = records.length ? records[records.length - 1] : { date: "Not Set" };
  res.json(current);
});

// ======================= POST CHANGE DATE =======================
router.post("/", (req, res) => {
  const { newDate, userRole = "Admin", userName = "System" } = req.body;

  if (userRole !== "Admin")
    return res.status(403).json({ success: false, message: "Permission denied. Admins only." });

  const records = readSafe(dataFile);
  const oldDate = records.length ? records[records.length - 1].date : "Not Set";

  const newRecord = {
    id: Date.now(),
    oldDate,
    newDate,
    changedBy: userName,
    timestamp: new Date().toLocaleString(),
  };

  records.push({ id: Date.now(), date: newDate });
  writeSafe(dataFile, records);

  const audits = readSafe(auditFile);
  audits.push(newRecord);
  writeSafe(auditFile, audits);

  res.json({ success: true, message: "Accounting date updated successfully!", data: newRecord });
});

// ======================= GET AUDIT TRAIL =======================
router.get("/audit", (req, res) => res.json(readSafe(auditFile)));

// ======================= EXPORT PDF =======================
router.get("/export/pdf", (req, res) => {
  const data = readSafe(auditFile);
  const columns = [
    { label: "Old Date", key: "oldDate", widthRatio: 0.2 },
    { label: "New Date", key: "newDate", widthRatio: 0.2 },
    { label: "Changed By", key: "changedBy", widthRatio: 0.2 },
    { label: "Timestamp", key: "timestamp", widthRatio: 0.4 },
  ];

  generateERPTablePDF(res, data, columns, "Accounting Date Audit Trail", "Account_Date_Change.pdf");
});

// ======================= EXPORT EXCEL =======================
router.get("/export/excel", async (req, res) => {
  const data = readSafe(auditFile);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Account Date Changes");

  sheet.columns = [
    { header: "Old Date", key: "oldDate", width: 20 },
    { header: "New Date", key: "newDate", width: 20 },
    { header: "Changed By", key: "changedBy", width: 20 },
    { header: "Timestamp", key: "timestamp", width: 30 },
  ];

  data.forEach(d => sheet.addRow(d));

  const filePath = path.join(__dirname, "..", "data", "Account_Date_Change.xlsx");
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, "Account_Date_Change.xlsx");
});

module.exports = router;
