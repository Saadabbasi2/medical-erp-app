const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { generateERPTablePDF } = require('../utils/pdfTemplate');

// File path
const filePath = path.join(__dirname, '..', 'data', 'employeeIncentives.json');

// Helpers
function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8') || '[]'); } catch { return []; }
}
function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Get all
router.get('/', (req, res) => {
  res.json(readJsonSafe(filePath));
});

// Add
router.post('/', (req, res) => {
  const incentives = readJsonSafe(filePath);
  const newIncentive = { id: Date.now(), ...req.body };
  incentives.push(newIncentive);
  writeJsonSafe(filePath, incentives);
  res.json({ success: true });
});

// Delete
router.delete('/:id', (req, res) => {
  const incentives = readJsonSafe(filePath);
  const filtered = incentives.filter(i => i.id !== parseInt(req.params.id));
  writeJsonSafe(filePath, filtered);
  res.json({ success: true });
});

// PDF Export
router.get('/export/pdf', (req, res) => {
  const data = readJsonSafe(filePath);
  const columns = [
    { label: 'Employee', key: 'employee', widthRatio: 0.20 },
    { label: 'Target Type', key: 'targetType', widthRatio: 0.15 },
    { label: 'Achieved (%)', key: 'achieved', widthRatio: 0.15 },
    { label: 'Amount', key: 'amount', widthRatio: 0.15 },
    { label: 'Month', key: 'month', widthRatio: 0.15 },
    { label: 'Status', key: 'status', widthRatio: 0.10 },
    { label: 'Remarks', key: 'remarks', widthRatio: 0.20 }
  ];
  generateERPTablePDF(res, data, columns, 'Employee Incentives Report', 'employee_incentives.pdf');
});

module.exports = router;
