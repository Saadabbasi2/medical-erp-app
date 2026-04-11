-- =====================================================
-- PRIORITY 7: CLAIMS MANAGEMENT (5 TABLES)
-- =====================================================

-- Discount Claims
CREATE TABLE IF NOT EXISTS discount_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    invoice_no VARCHAR(50),
    discount_amount DECIMAL(15, 2) DEFAULT 0.00,
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    claim_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_claim_no (claim_no),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Bonus Claims
CREATE TABLE IF NOT EXISTS bonus_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    bonus_quantity INT DEFAULT 0,
    bonus_amount DECIMAL(15, 2) DEFAULT 0.00,
    claim_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_claim_no (claim_no),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Claims Adjustments
CREATE TABLE IF NOT EXISTS claims_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adjustment_no VARCHAR(50),
    claim_type VARCHAR(100),
    original_claim_no VARCHAR(50),
    adjustment_amount DECIMAL(15, 2) DEFAULT 0.00,
    adjustment_date DATE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_adjustment_no (adjustment_no),
    INDEX idx_claim_no (original_claim_no),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Open Claims
CREATE TABLE IF NOT EXISTS open_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_no VARCHAR(50),
    claim_type VARCHAR(100),
    customer_id INT,
    customer_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    claim_date DATE,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Open',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_claim_no (claim_no),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB;

-- Claims Reports (Summary/Analytics)
CREATE TABLE IF NOT EXISTS claims_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_claims INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    approved_claims INT DEFAULT 0,
    approved_amount DECIMAL(15, 2) DEFAULT 0.00,
    pending_claims INT DEFAULT 0,
    pending_amount DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;
