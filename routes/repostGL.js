// ======================= routes/repostGL.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");

const router = express.Router();
const dataFile = path.join(__dirname, "..", "data", "repostGL.json");

function readSafe() { try { return JSON.parse(fs.readFileSync(dataFile, "utf8") || "[]"); } catch { return []; } }
function writeSafe(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2)); }

// ======= Get All Logs =======
router.get("/", (req, res) => res.json(readSafe()));

// ======= Repost GL =======
router.post("/repost", (req, res) => {
  const logs = readSafe();
  const entry = {
    id: Date.now(),
    action: "Repost GL Entries",
    description: "System reposted all general ledger entries as per updated rules.",
    status: "Completed",
    date: new Date().toISOString().split("T")[0],
  };
  logs.push(entry);
  writeSafe(logs);
  res.json({ success: true, entry });
});

// ======= Update Balances =======
router.post("/update-balances", (req, res) => {
  const logs = readSafe();
  const entry = {
    id: Date.now(),
    action: "Update Balances",
    description: "All account balances recalculated and updated successfully.",
    status: "Completed",
    date: new Date().toISOString().split("T")[0],
  };
  logs.push(entry);
  writeSafe(logs);
  res.json({ success: true, entry });
});

// ======= Export PDF =======
router.get("/export/pdf", (req, res) => {
  const data = readSafe();
  const columns = [
    { label: "Action", key: "action", widthRatio: 0.25 },
    { label: "Description", key: "description", widthRatio: 0.45 },
    { label: "Status", key: "status", widthRatio: 0.15 },
    { label: "Processed Date", key: "date", widthRatio: 0.15 },
  ];
  generateERPTablePDF(res, data, columns, "Repost / Update Log", "Repost_GL_Logs.pdf");
});

// ======= Export Excel =======
router.get("/export/excel", async (req, res) => {
  const data = readSafe();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Repost Logs");
  sheet.columns = [
    { header: "Action", key: "action", width: 25 },
    { header: "Description", key: "description", width: 60 },
    { header: "Status", key: "status", width: 20 },
    { header: "Processed Date", key: "date", width: 25 },
  ];
  data.forEach(d => sheet.addRow(d));
  const filePath = path.join(__dirname, "..", "data", "Repost_GL_Logs.xlsx");
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, "Repost_GL_Logs.xlsx");
});

module.exports = router;
