/**
 * Import Bookings from CSV to Medical ERP MySQL
 *
 * Step 1: Run in SSMS:
 *   SELECT TOP (1000) [BookingId], [BookingDate], [CustomerId], [RegionId], [Amount]
 *   FROM [ERP_D209_2020].[Trans].[Booking]
 *
 * Step 2: Save as: data/bookings_export.csv (with headers)
 * Step 3: Run:     node scripts/import-bookings-from-csv.js
 *
 * CSV columns (positional, 0-indexed):
 *   0=BookingId  1=BookingDate  2=CustomerId  3=RegionId  4=Amount
 */

const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'bookings_export.csv');

function parseRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"')           { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else                     { cur += c; }
  }
  result.push(cur.trim());
  return result;
}
function clean(v)  { return String(v || '').replace(/^"|"$/g, '').trim(); }
function toInt(v)  { const n = parseInt(String(v||'').trim(), 10); return isNaN(n) ? null : n; }
function toFloat(v){ const n = parseFloat(String(v||'').trim()); return isNaN(n) ? 0 : n; }

async function importBookings() {
  let conn;
  try {
    console.log('==============================================');
    console.log('  Bookings Import: CSV → MySQL');
    console.log('==============================================\n');

    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV not found: ${CSV_PATH}\nSave SSMS result as bookings_export.csv in data/ folder.`);
    }
    console.log('1. Found CSV: bookings_export.csv\n');

    console.log('2. Parsing CSV...');
    const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter(l => l.trim());
    const firstCell = parseRow(lines[0])[0].replace(/^\uFEFF/, '').trim();
    const hasHeader = /bookingid|bookingdate|customerid|regionid/i.test(firstCell);
    console.log(`   ${hasHeader ? 'Header detected — skipping row 1.' : 'No header — positional mapping.'}`);

    const dataRows = (hasHeader ? lines.slice(1) : lines)
      .map(l => parseRow(l)).filter(r => r.length >= 5 && r[0].trim());
    console.log(`   ${dataRows.length} rows to import\n`);

    console.log('3. Connecting to MySQL...');
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'medical_erp',
      port:     parseInt(process.env.DB_PORT || '3306')
    });
    console.log('   ✓ Connected\n');

    console.log('4. Importing rows...');
    let imported = 0, skipped = 0, errors = 0;

    for (const row of dataRows) {
      try {
        const bookingIdRaw = clean(row[0]);
        const bookingDateRaw = clean(row[1]); // Example: 2025-02-03 15:43:13.000
        const customerIdRaw = toInt(row[2]);
        const regionIdRaw = clean(row[3]);
        const amountRaw = toFloat(row[4]);

        const bookingId = toInt(bookingIdRaw);
        if (!bookingId) { skipped++; continue; }

        // Skip duplicates
        const [ex] = await conn.execute('SELECT id FROM bookings WHERE id = ?', [bookingId]);
        if (ex.length) { skipped++; continue; }

        // Fetch Customer details to denormalize
        let customerName = 'Unknown';
        let ntn = '', cnic = '', filerStatus = 'Filer';
        if (customerIdRaw) {
          const [cust] = await conn.execute('SELECT name, ntn, cnic, status FROM customers WHERE id = ?', [customerIdRaw]);
          if (cust.length) {
            customerName = cust[0].name || 'Unknown';
            ntn = cust[0].ntn || '';
            cnic = cust[0].cnic || '';
            filerStatus = cust[0].status || 'Filer'; // Or you can map it according to your logic
          }
        }

        // Fetch Region description (Route)
        let routeDesc = '';
        if (regionIdRaw) {
          const [reg] = await conn.execute('SELECT description FROM regions WHERE region_id = ? LIMIT 1', [regionIdRaw]);
          if (reg.length) {
            routeDesc = reg[0].description || '';
          }
        }

        // Format Date (MySQL DATE expects YYYY-MM-DD or DATETIME)
        // Split space explicitly if necessary, but MySQL understands "YYYY-MM-DD HH:MM:SS"
        let bookingDate = new Date().toISOString().split('T')[0];
        if (bookingDateRaw) {
           const d = new Date(bookingDateRaw);
           if (!isNaN(d)) {
             bookingDate = d.toISOString().split('T')[0];
           }
        }

        await conn.execute(
          `INSERT INTO bookings (
             id, customer_id, customer_name, route, booking_date, 
             total_amount, status, requires_approval, ntn, cnic, filer_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            customerIdRaw || 0,
            customerName,
            routeDesc,
            bookingDate,
            amountRaw,
            'Pending',   // Default status
            0,           // requires_approval
            ntn,
            cnic,
            filerStatus
          ]
        );
        imported++;
        if (imported % 50 === 0) process.stdout.write(`   Imported ${imported}...\r`);
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`   ❌ Row error: ${err.message}`);
      }
    }

    console.log(`\n   ✓ Imported : ${imported}`);
    console.log(`   - Skipped  : ${skipped} (duplicates or empty)`);
    console.log(`   - Errors   : ${errors}\n`);
    console.log('==============================================');
    console.log('  Import complete!');
    console.log('==============================================');
  } catch (err) {
    console.error('\n❌ Fatal:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

importBookings().then(() => process.exit(0)).catch(() => process.exit(1));
