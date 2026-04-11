const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const filePath = path.join(dataDir, 'openInvoices.json');
const backupPath = path.join(dataDir, `openInvoices.json.bak.${Date.now()}`);

if (!fs.existsSync(filePath)) {
  console.error('openInvoices.json not found at', filePath);
  process.exit(1);
}

// backup
fs.copyFileSync(filePath, backupPath);
console.log('Backup created:', backupPath);

const raw = fs.readFileSync(filePath, 'utf8');
let invoices;
try {
  invoices = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  process.exit(1);
}

if (!Array.isArray(invoices)) {
  console.error('Unexpected format: openInvoices.json is not an array');
  process.exit(1);
}

let changes = 0;
invoices.forEach(inv => {
  // ensure products array exists, prefer existing products, else convert items/rows
  if (!Array.isArray(inv.products)) {
    if (Array.isArray(inv.items)) inv.products = inv.items;
    else if (Array.isArray(inv.rows)) inv.products = inv.rows;
    else inv.products = [];
  }

  inv.products.forEach(p => {
    if (!Object.prototype.hasOwnProperty.call(p, 'expiry')) {
      p.expiry = null;
      changes++;
    }
    // also ensure batch property exists
    if (!Object.prototype.hasOwnProperty.call(p, 'batch')) {
      p.batch = p.batchNo ?? p.batchNumber ?? '-';
      changes++;
    }
  });
});

fs.writeFileSync(filePath, JSON.stringify(invoices, null, 2), 'utf8');
console.log(`Done. ${changes} fields added/updated. openInvoices.json updated.`);
console.log('If anything looks wrong you can restore from backup:', backupPath);