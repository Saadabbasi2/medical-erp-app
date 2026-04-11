// import_dashboard_data.js - Import JSON data to MySQL (CORRECTED)
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Visahosting@2025',
    database: 'medical_erp'
};

async function importData() {
    let connection;

    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL\n');

        // Read JSON files
        const dataDir = path.join(__dirname, 'data');

        console.log('Reading JSON files...');
        const bookingsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
        const openInvoicesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'openInvoices.json.bak.1759506364627'), 'utf8'));
        const customersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'customers.json'), 'utf8'));

        console.log(`✅ Loaded ${bookingsData.bookings.length} bookings`);
        console.log(`✅ Loaded ${openInvoicesData.length} open invoices`);
        console.log(`✅ Loaded ${customersData.length} customers\n`);

        // 1. Import Customers
        console.log('Importing customers...');
        let customersImported = 0;
        for (const customer of customersData) {
            try {
                await connection.execute(
                    `INSERT INTO customers (id, name, route, ntn, cnic, is_active) 
           VALUES (?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE name = VALUES(name), route = VALUES(route)`,
                    [customer.id, customer.name, customer.route || '', customer.ntn || '', customer.cnic || '']
                );
                customersImported++;
            } catch (err) {
                // Skip duplicates
            }
        }
        console.log(`✅ Imported ${customersImported} customers\n`);

        // 2. Import Bookings (using correct column names)
        console.log('Importing bookings...');
        let bookingsImported = 0;
        for (const booking of bookingsData.bookings) {
            try {
                await connection.execute(
                    `INSERT INTO bookings (id, customer_id, customer_name, route, booking_date, total_amount, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount), status = VALUES(status)`,
                    [
                        booking.id,
                        booking.customerId,
                        booking.customer,
                        booking.route || '',
                        booking.date,
                        booking.total,
                        booking.status || 'Pending'
                    ]
                );
                bookingsImported++;
            } catch (err) {
                console.error(`Error importing booking ${booking.id}:`, err.message);
            }
        }
        console.log(`✅ Imported ${bookingsImported} bookings\n`);

        // 3. Import Open Invoices (using correct column names)
        console.log('Importing open invoices...');
        let openInvoicesImported = 0;
        for (const invoice of openInvoicesData) {
            try {
                await connection.execute(
                    `INSERT INTO open_invoices (id, customer_id, customer_name, payment_method, invoice_date, subtotal, total_amount, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount), subtotal = VALUES(subtotal)`,
                    [
                        invoice.id,
                        invoice.customerId,
                        invoice.customer,
                        invoice.payment || 'Cash',
                        invoice.date,
                        invoice.subtotal || invoice.total,
                        invoice.total,
                        invoice.status || 'Open'
                    ]
                );
                openInvoicesImported++;
            } catch (err) {
                console.error(`Error importing open invoice ${invoice.id}:`, err.message);
            }
        }
        console.log(`✅ Imported ${openInvoicesImported} open invoices\n`);

        // 4. Create Invoices from Bookings (using correct column names)
        console.log('Creating invoices from bookings...');
        let invoicesCreated = 0;
        for (const booking of bookingsData.bookings) {
            try {
                await connection.execute(
                    `INSERT INTO invoices (invoice_number, customer_id, customer_name, invoice_date, subtotal, total_amount, status) 
           VALUES (?, ?, ?, ?, ?, ?, 'Generated')
           ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount)`,
                    [
                        `INV-${booking.id}`,
                        booking.customerId,
                        booking.customer,
                        booking.date,
                        booking.total,
                        booking.total
                    ]
                );

                // Get the invoice ID
                const [result] = await connection.execute(
                    'SELECT id FROM invoices WHERE invoice_number = ?',
                    [`INV-${booking.id}`]
                );

                if (result.length > 0 && booking.products) {
                    const invoiceId = result[0].id;

                    // Import invoice items (need to check if invoice_items table exists)
                    for (const product of booking.products) {
                        try {
                            await connection.execute(
                                `INSERT INTO invoice_items (invoice_id, product_name, quantity, price, total_amount) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                                [
                                    invoiceId,
                                    product.product || product.name,
                                    product.qty,
                                    product.price,
                                    product.total
                                ]
                            );
                        } catch (err) {
                            // invoice_items table might not exist, skip
                        }
                    }
                }

                invoicesCreated++;
            } catch (err) {
                console.error(`Error creating invoice from booking ${booking.id}:`, err.message);
            }
        }
        console.log(`✅ Created ${invoicesCreated} invoices from bookings\n`);

        // 5. Create sample customer receipts (using correct column names)
        console.log('Creating sample customer receipts...');
        const [totalSalesResult] = await connection.execute(
            'SELECT SUM(total_amount) as total FROM invoices'
        );
        const totalSales = totalSalesResult[0].total || 0;
        const sampleReceipt = totalSales * 0.1; // 10% received

        try {
            await connection.execute(
                `INSERT INTO customer_receipts (receipt_number, customer_id, customer_name, payment_date, amount_received, payment_method) 
         VALUES ('RCP-001', 1, 'Sample Customer', CURDATE(), ?, 'Cash')
         ON DUPLICATE KEY UPDATE amount_received = VALUES(amount_received)`,
                [sampleReceipt]
            );
            console.log(`✅ Created sample receipt for ${sampleReceipt.toFixed(2)}\n`);
        } catch (err) {
            console.log(`⚠️  Could not create sample receipt: ${err.message}\n`);
        }

        // 6. Verify data
        console.log('Verifying imported data...');
        const [customersCount] = await connection.execute('SELECT COUNT(*) as count FROM customers');
        const [bookingsCount] = await connection.execute('SELECT COUNT(*) as count FROM bookings');
        const [openInvoicesCount] = await connection.execute('SELECT COUNT(*) as count FROM open_invoices');
        const [invoicesCount] = await connection.execute('SELECT COUNT(*) as count FROM invoices');

        console.log('\n📊 Import Summary:');
        console.log(`   Customers: ${customersCount[0].count}`);
        console.log(`   Bookings: ${bookingsCount[0].count}`);
        console.log(`   Open Invoices: ${openInvoicesCount[0].count}`);
        console.log(`   Invoices: ${invoicesCount[0].count}`);

        console.log('\n✅ Data import completed successfully!');

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Database connection closed');
        }
    }
}

// Run the import
importData()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
