// ======================= routes/exportData.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");

const dataDir = path.join(__dirname, "..", "data");

// Safely read JSON
function readSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "[]"); }
  catch { return []; }
}

// Map dataset names to their JSON files
const datasets = {
  employees: "employeeGroups.json",
  clients: "clients.json",
  tasks: "salesReports.json",
  attendance: "attendance.json",
  inventory: "inventoryReports.json",
  itemMaster: "itemMaster.json",
  sales: "salesReports.json",
  purchases: "purchaseInvoices.json",
  roles: "roleAccesss.json"
};

// ============ EXPORT API ============

// Generic export endpoint
router.get("/:dataset/:format", async (req, res) => {
  const { dataset, format } = req.params;
  const fileName = datasets[dataset];
  if (!fileName) return res.status(404).json({ success: false, message: "Invalid dataset" });

  const dataFile = path.join(dataDir, fileName);
  const data = readSafe(dataFile);

  if (!data.length)
    return res.status(400).json({ success: false, message: "No data available to export" });

  const safeName = dataset.charAt(0).toUpperCase() + dataset.slice(1);

  // === Export to JSON ===
  if (format === "json") {
    const jsonPath = path.join(dataDir, `${safeName}_Export.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    return res.download(jsonPath, `${safeName}_Export.json`);
  }

  // === Export to CSV ===
  if (format === "csv") {
    const parser = new Parser();
    const csv = parser.parse(data);
    const csvPath = path.join(dataDir, `${safeName}_Export.csv`);
    fs.writeFileSync(csvPath, csv);
    return res.download(csvPath, `${safeName}_Export.csv`);
  }

  // === Export to Excel ===
  if (format === "excel" || format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${safeName}`);
    const keys = Object.keys(data[0]);
    sheet.columns = keys.map(k => ({ header: k, key: k, width: 25 }));
    data.forEach(row => sheet.addRow(row));
    const filePath = path.join(dataDir, `${safeName}_Export.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return res.download(filePath, `${safeName}_Export.xlsx`);
  }

  res.status(400).json({ success: false, message: "Unsupported format" });
});

module.exports = router;
