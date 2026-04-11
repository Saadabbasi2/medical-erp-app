// ======================= routes/closingReporting.js =======================
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const ExcelJS = require('exceljs');
const { generateERPTablePDF } = require('../utils/pdfTemplate'); // ✅ Use common ERP PDF layout

const dataFile = path.join(__dirname, '..', 'data', 'closingReporting.json');

// Helper functions
function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch {
    return [];
  }
}
function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// =================== CRUD API ===================
router.get('/', (req, res) => res.json(readJsonSafe(dataFile)));

router.post('/', (req, res) => {
  const reports = readJsonSafe(dataFile);
  const newReport = { id: Date.now(), ...req.body };
  reports.push(newReport);
  writeJsonSafe(dataFile, reports);
  res.json({ success: true, data: newReport });
});

router.delete('/:id', (req, res) => {
  const reports = readJsonSafe(dataFile);
  const filtered = reports.filter(r => r.id !== parseInt(req.params.id));
  writeJsonSafe(dataFile, filtered);
  res.json({ success: true });
});

// =================== Export to PDF ===================
router.get('/export/pdf', (req, res) => {
  const data = readJsonSafe(dataFile);
  const columns = [
    { label: "Report Type", key: "type", widthRatio: 0.25 },
    { label: "Period", key: "period", widthRatio: 0.2 },
    { label: "Debit (PKR)", key: "debit", widthRatio: 0.15 },
    { label: "Credit (PKR)", key: "credit", widthRatio: 0.15 },
    { label: "Status", key: "status", widthRatio: 0.15 }
  ];
  

  generateERPTablePDF(res, data, columns, 'Closing & Reporting Summary', 'Closing_Reports.pdf');
});

// =================== Export to Excel ===================
router.get('/export/excel', async (req, res) => {
  const data = readJsonSafe(dataFile);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Closing Reports');

  sheet.columns = [
    { header: 'Report Type', key: 'reportType', width: 25 },
    { header: 'Account', key: 'account', width: 25 },
    { header: 'Debit (PKR)', key: 'debit', width: 20 },
    { header: 'Credit (PKR)', key: 'credit', width: 20 },
    { header: 'Balance', key: 'balance', width: 20 },
    { header: 'Date', key: 'date', width: 20 }
  ];

  data.forEach(d => sheet.addRow(d));

  const filePath = path.join(__dirname, '..', 'data', 'Closing_Reports.xlsx');
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, 'Closing_Reports.xlsx');
});

module.exports = router;
