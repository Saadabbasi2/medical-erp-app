-- =====================================================
-- PRIORITY 10: DMS (DISTRIBUTION MANAGEMENT) (2 TABLES)
-- =====================================================

-- DMS Masters (Distribution Master Data)
CREATE TABLE IF NOT EXISTS dms_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    master_type VARCHAR(100),
    code VARCHAR(50),
    name VARCHAR(255),
    description TEXT,
    region VARCHAR(100),
    territory VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_master_type (master_type),
    INDEX idx_code (code),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- DMS Operations (Distribution Operations/Transactions)
CREATE TABLE IF NOT EXISTS dms_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type VARCHAR(100),
    operation_no VARCHAR(50),
    distributor_id INT,
    distributor_name VARCHAR(255),
    region VARCHAR(100),
    territory VARCHAR(100),
    operation_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    quantity INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending',
    remarks TEXT,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_operation_type (operation_type),
    INDEX idx_operation_no (operation_no),
    INDEX idx_distributor (distributor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;
