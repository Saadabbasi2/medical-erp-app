-- =====================================================
-- PRIORITY 9: REPORTS & ANALYTICS (6 TABLES)
-- =====================================================
-- Note: claimsReports and purchaseReports already created in Priorities 7 & 8

-- Inventory Reports
CREATE TABLE IF NOT EXISTS inventory_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_items INT DEFAULT 0,
    total_stock_value DECIMAL(15, 2) DEFAULT 0.00,
    low_stock_items INT DEFAULT 0,
    expired_items INT DEFAULT 0,
    expiring_soon INT DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Finance Reports
CREATE TABLE IF NOT EXISTS finance_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_revenue DECIMAL(15, 2) DEFAULT 0.00,
    total_expenses DECIMAL(15, 2) DEFAULT 0.00,
    net_profit DECIMAL(15, 2) DEFAULT 0.00,
    accounts_receivable DECIMAL(15, 2) DEFAULT 0.00,
    accounts_payable DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Payroll Reports
CREATE TABLE IF NOT EXISTS payroll_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_employees INT DEFAULT 0,
    total_salary DECIMAL(15, 2) DEFAULT 0.00,
    total_deductions DECIMAL(15, 2) DEFAULT 0.00,
    total_allowances DECIMAL(15, 2) DEFAULT 0.00,
    net_payroll DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Distribution Reports
CREATE TABLE IF NOT EXISTS distribution_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_distributors INT DEFAULT 0,
    total_bookings INT DEFAULT 0,
    total_invoices INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_returns INT DEFAULT 0,
    return_amount DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Admin Audit Reports
CREATE TABLE IF NOT EXISTS admin_audit_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_users INT DEFAULT 0,
    total_actions INT DEFAULT 0,
    failed_logins INT DEFAULT 0,
    data_changes INT DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- SPOS Reports (Sales Point of Sale)
CREATE TABLE IF NOT EXISTS spos_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_transactions INT DEFAULT 0,
    total_sales DECIMAL(15, 2) DEFAULT 0.00,
    total_returns INT DEFAULT 0,
    return_amount DECIMAL(15, 2) DEFAULT 0.00,
    cash_sales DECIMAL(15, 2) DEFAULT 0.00,
    card_sales DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;
