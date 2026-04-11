// Migration script to regenerate sales reports from existing bookings
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'data', 'db.json');
const purchaseOrdersFile = path.join(__dirname, 'data', 'purchaseOrders.json');
const salesReportsFile = path.join(__dirname, 'data', 'salesReports.json');

function readJsonSafe(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf-8') || '[]'); }
    catch { return []; }
}

function writeJsonSafe(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

console.log('🔄 Regenerating sales reports from existing bookings...');

const db = readJsonSafe(dbFile);
const bookings = db.bookings || [];
const purchaseOrders = readJsonSafe(purchaseOrdersFile);
const salesReports = [];

bookings.forEach(booking => {
    const products = booking.products || [];

    products.forEach(product => {
        const productName = (product.product || product.productName || '').trim();
        const productBatch = (product.batch || '').trim();

        // Try to find matching PO
        let matchedPO = null;

        for (const po of purchaseOrders) {
            let poItems = [];
            if (Array.isArray(po.items)) {
                poItems = po.items;
            } else if (po.item) {
                poItems = [{ productName: po.item, batch: po.batch }];
            }

            const matchingItem = poItems.find(item => {
                const itemName = (item.productName || item.item || item || '').trim();
                const itemBatch = (po.batch || item.batch || '').trim();

                return itemName.toLowerCase() === productName.toLowerCase() &&
                    (productBatch === '-' || itemBatch === productBatch || itemBatch === '-');
            });

            if (matchingItem) {
                matchedPO = po;
                break;
            }
        }

        const salesEntry = {
            id: Date.now() + Math.random(),
            poNumber: matchedPO ? (matchedPO.poNumber || matchedPO.poNo) : 'MANUAL',
            itemName: productName || 'Unknown',
            quantity: Number(product.qty || 0),
            date: booking.date,
            customer: booking.customer,
            bookingId: booking.id
        };

        salesReports.push(salesEntry);
    });
});

writeJsonSafe(salesReportsFile, salesReports);

console.log(`✅ Generated ${salesReports.length} sales report entries from ${bookings.length} bookings`);
console.log('📊 Sales reports regenerated successfully!');
