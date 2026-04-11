const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const dataFile = path.join(__dirname, '..', 'data', 'knockOffDocuments.json');

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8') || '[]'); }
  catch { return []; }
}
function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 🟢 Get all
router.get('/', (req, res) => {
  res.json(readJsonSafe(dataFile));
});

// 🟢 Add new
router.post('/', (req, res) => {
  const docs = readJsonSafe(dataFile);
  const newDoc = { id: Date.now(), ...req.body };
  docs.push(newDoc);
  writeJsonSafe(dataFile, docs);
  res.json({ success: true, data: newDoc });
});

// 🗑️ Delete
router.delete('/:id', (req, res) => {
  const docs = readJsonSafe(dataFile);
  const filtered = docs.filter(d => d.id !== parseInt(req.params.id));
  writeJsonSafe(dataFile, filtered);
  res.json({ success: true });
});

// 🧾 Export PDF
router.get('/export/pdf', (req, res) => {
  const docs = readJsonSafe(dataFile);
  const columns = [
    { label: 'Knock-Off #', key: 'knockOffNo', widthRatio: 0.15 },
    { label: 'Counterparty', key: 'party', widthRatio: 0.20 },
    { label: 'Receivable (PKR)', key: 'receivable', widthRatio: 0.15 },
    { label: 'Payable (PKR)', key: 'payable', widthRatio: 0.15 },
    { label: 'Net Amount (PKR)', key: 'netAmount', widthRatio: 0.15 },
    { label: 'Date', key: 'date', widthRatio: 0.10 },
    { label: 'Remarks', key: 'remarks', widthRatio: 0.20 }
  ];
  generateERPTablePDF(res, docs, columns, 'Knock-Off Document Report', 'knockoff_documents.pdf');
});

module.exports = router;
