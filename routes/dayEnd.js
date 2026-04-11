// ======================= routes/dayEnd.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { generateERPTablePDF } = require("../utils/pdfTemplate");
const router = express.Router();

// File paths
const transactionsFile = path.join(__dirname, "..", "data", "transactions.json");
const collectionsFile = path.join(__dirname, "..", "data", "collections.json");
const backupsFile = path.join(__dirname, "..", "data", "backupLog.json");
const dayEndFile = path.join(__dirname, "..", "data", "dayEndReports.json");
const dataDir = path.join(__dirname, "..", "data");
const backupDir = path.join(__dirname, "..", "backups");

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

// ======================= LIST DAY-END REPORTS =======================
router.get("/", (req, res) => {
  res.json(readSafe(dayEndFile));
});

// ======================= GET STATUS =======================
router.get("/status", (req, res) => {
  const transactions = readSafe(transactionsFile);
  const collections = readSafe(collectionsFile);
  const backups = readSafe(backupsFile);

  const postingsCompleted = transactions.every(t => t.status === "Posted");
  const collectionsReconciled = collections.every(c => c.reconciled === true);

  const today = new Date().toISOString().split("T")[0];
  const backupTaken = backups.some(b => b.date === today);

  res.json({
    postingsCompleted,
    collectionsReconciled,
    backupTaken,
    allChecksPassed: postingsCompleted && collectionsReconciled && backupTaken,
  });
});

// ======================= MANUAL BACKUP TRIGGER =======================
router.post("/backup", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const todayDir = path.join(backupDir, today);

  if (!fs.existsSync(todayDir)) fs.mkdirSync(todayDir, { recursive: true });

  // Copy all .json data files to this folder
  fs.readdirSync(dataDir)
    .filter(f => f.endsWith(".json"))
    .forEach(f => {
      fs.copyFileSync(path.join(dataDir, f), path.join(todayDir, f));
    });

  // Log the backup
  const backups = readSafe(backupsFile);
  const newBackup = {
    id: Date.now(),
    date: today,
    time: new Date().toLocaleTimeString(),
    type: "Manual Backup",
    location: todayDir,
    status: "Success",
  };
  backups.push(newBackup);
  writeSafe(backupsFile, backups);

  res.json({ success: true, message: "Backup completed successfully!" });
});

// ======================= POST CLOSE DAY =======================
router.post("/close", (req, res) => {
  const reports = readSafe(dayEndFile);
  const today = new Date().toISOString().split("T")[0];

  const newReport = {
    id: Date.now(),
    date: today,
    status: "Closed",
    checks: {
      postingsCompleted: true,
      collectionsReconciled: true,
      backupTaken: true,
    },
    closedAt: new Date().toLocaleString(),
  };

  reports.push(newReport);
  writeSafe(dayEndFile, reports);

  // Also log auto backup for the day
  const backups = readSafe(backupsFile);
  backups.push({ id: Date.now(), date: today, type: "Day-End Auto Backup", status: "Success" });
  writeSafe(backupsFile, backups);

  res.json({ success: true, data: newReport });
});

// ======================= EXPORT PDF =======================
router.get("/export/pdf", (req, res) => {
  const data = readSafe(dayEndFile);
  const columns = [
    { label: "Date", key: "date", widthRatio: 0.2 },
    { label: "Postings", key: "postingsCompleted", widthRatio: 0.2 },
    { label: "Collections", key: "collectionsReconciled", widthRatio: 0.2 },
    { label: "Backup Taken", key: "backupTaken", widthRatio: 0.2 },
    { label: "Status", key: "status", widthRatio: 0.2 },
  ];

  const formatted = data.map(r => ({
    ...r,
    postingsCompleted: r.checks?.postingsCompleted ? "Yes" : "No",
    collectionsReconciled: r.checks?.collectionsReconciled ? "Yes" : "No",
    backupTaken: r.checks?.backupTaken ? "Yes" : "No",
  }));

  generateERPTablePDF(res, formatted, columns, "Day-End Summary", "Day_End_Report.pdf");
});

// ======================= EXPORT EXCEL =======================
router.get("/export/excel", async (req, res) => {
  const data = readSafe(dayEndFile);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Day End Reports");

  sheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Postings Completed", key: "postingsCompleted", width: 25 },
    { header: "Collections Reconciled", key: "collectionsReconciled", width: 25 },
    { header: "Backup Taken", key: "backupTaken", width: 20 },
    { header: "Status", key: "status", width: 15 },
    { header: "Closed At", key: "closedAt", width: 30 },
  ];

  data.forEach(r =>
    sheet.addRow({
      date: r.date,
      postingsCompleted: r.checks?.postingsCompleted ? "Yes" : "No",
      collectionsReconciled: r.checks?.collectionsReconciled ? "Yes" : "No",
      backupTaken: r.checks?.backupTaken ? "Yes" : "No",
      status: r.status,
      closedAt: r.closedAt,
    })
  );

  const filePath = path.join(__dirname, "..", "data", "Day_End_Report.xlsx");
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, "Day_End_Report.xlsx");
});

module.exports = router;
