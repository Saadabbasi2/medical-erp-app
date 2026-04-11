-- insert_sample_dashboard_data.sql
-- Simple SQL script to insert sample data for dashboard testing

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Insert sample invoices (using today's date for testing)
INSERT INTO invoices (invoice_number, customer_id, customer_name, invoice_date, subtotal, total_amount, status) VALUES
('INV-001', 1, 'Faisal Pharma', CURDATE(), 54200, 54200, 'Generated'),
('INV-002', 2, 'City Distributors', CURDATE(), 41230, 41230, 'Generated'),
('INV-003', 3, 'GreenMeds', CURDATE(), 34800, 34800, 'Generated'),
('INV-004', 4, 'HealthPlus', CURDATE(), 27900, 27900, 'Generated'),
('INV-005', 5, 'Medline Traders', CURDATE(), 24500, 24500, 'Generated'),
('INV-006', 1, 'Faisal Pharma', CURDATE() - INTERVAL 1 DAY, 12000, 12000, 'Generated'),
('INV-007', 2, 'City Distributors', CURDATE() - INTERVAL 2 DAY, 15000, 15000, 'Generated'),
('INV-008', 3, 'GreenMeds', CURDATE() - INTERVAL 3 DAY, 18000, 18000, 'Generated'),
('INV-009', 4, 'HealthPlus', CURDATE() - INTERVAL 7 DAY, 22000, 22000, 'Generated'),
('INV-010', 5, 'Medline Traders', CURDATE() - INTERVAL 14 DAY, 30000, 30000, 'Generated')
ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount);

-- Insert sample open invoices
INSERT INTO open_invoices (customer_id, customer_name, payment_method, invoice_date, subtotal, total_amount, status) VALUES
(1, 'SAAD', 'Cash', CURDATE(), 1000, 1000, 'Open'),
(2, 'Indus Medical', 'Cash', CURDATE(), 1100, 1100, 'Open'),
(3, 'Hamza', 'Cash', CURDATE() - INTERVAL 1 DAY, 1000, 1000, 'Open'),
(4, 'Mudassir', 'Cash', CURDATE() - INTERVAL 1 DAY, 5000, 5000, 'Open'),
(5, 'Saad Amjad Abbasi', 'Cash', CURDATE() - INTERVAL 2 DAY, 9000, 9000, 'Open'),
(1, 'Uzair Khan Swati', 'Credit', CURDATE() - INTERVAL 3 DAY, 100000, 100000, 'Open'),
(2, 'City Distributors', 'Cash', CURDATE() - INTERVAL 4 DAY, 110, 110, 'Open'),
(3, 'Khabib', 'Cash', CURDATE() - INTERVAL 5 DAY, 1000, 1000, 'Open'),
(4, 'Abeer', 'Cash', CURDATE() - INTERVAL 6 DAY, 1000, 1000, 'Open'),
(5, 'Sanaan', 'Cash', CURDATE() - INTERVAL 7 DAY, 100, 100, 'Open')
ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount);

-- Insert sample bookings
INSERT INTO bookings (customer_id, customer_name, route, booking_date, total_amount, status) VALUES
(1, 'Faisal Pharma', 'Abbottabad', CURDATE(), 900000, 'Pending'),
(2, 'City Distributors', 'Abbottabad', CURDATE(), 1820000, 'Pending'),
(3, 'Ubaid Khan Swati', 'AuxWork', CURDATE(), 182000, 'Pending'),
(4, 'SAAD', 'Abbottabad', CURDATE(), 1000, 'Pending'),
(5, 'Hamza', 'Mandian', CURDATE(), 1000, 'Pending'),
(1, 'Mudassir', 'Abbottabad', CURDATE() - INTERVAL 1 DAY, 1000, 'Pending'),
(2, 'Khabib', 'Abbottabad', CURDATE() - INTERVAL 1 DAY, 1000, 'Pending'),
(3, 'Abeer', 'Abbottabad', CURDATE() - INTERVAL 2 DAY, 1000, 'Pending'),
(4, 'Indus Medical', 'Abbottabad', CURDATE() - INTERVAL 3 DAY, 1100, 'Pending'),
(5, 'Adan', 'Abbottabad', CURDATE() - INTERVAL 4 DAY, 1000, 'Pending')
ON DUPLICATE KEY UPDATE total_amount = VALUES(total_amount);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

-- Show summary
SELECT 'Invoices' as TableName, COUNT(*) as RecordCount FROM invoices
UNION ALL
SELECT 'Open Invoices', COUNT(*) FROM open_invoices
UNION ALL
SELECT 'Bookings', COUNT(*) FROM bookings;
