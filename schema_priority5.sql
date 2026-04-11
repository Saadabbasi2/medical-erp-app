-- =====================================================
-- PRIORITY 5: INVENTORY & STOCK MANAGEMENT (9 TABLES)
-- =====================================================

-- Item Master
CREATE TABLE IF NOT EXISTS item_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    strength VARCHAR(100),
    form VARCHAR(100),
    pack VARCHAR(100),
    hsn VARCHAR(50),
    quantity INT DEFAULT 0,
    barcode VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode),
    INDEX idx_name (name)
) ENGINE=InnoDB;

-- Inventory (for item acceptance)
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT,
    name VARCHAR(255),
    quantity INT DEFAULT 0,
    accepted_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_item (item_id)
) ENGINE=InnoDB;

-- Warehouse Bins
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_name VARCHAR(255),
    bin_code VARCHAR(50),
    batch_no VARCHAR(100),
    mfg_date DATE,
    expiry_date DATE,
    batch_qty INT DEFAULT 0,
    batch_status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_batch (batch_no),
    INDEX idx_warehouse (warehouse_name)
) ENGINE=InnoDB;

-- FEFO Management
CREATE TABLE IF NOT EXISTS fefo_management (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    batch_no VARCHAR(100),
    expiry_date DATE,
    quantity INT DEFAULT 0,
    warehouse VARCHAR(255),
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_expiry (expiry_date),
    INDEX idx_batch (batch_no)
) ENGINE=InnoDB;

-- Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product VARCHAR(255),
    batch VARCHAR(100),
    adjustment_type VARCHAR(50),
    quantity INT DEFAULT 0,
    reason TEXT,
    notes TEXT,
    sales_tax DECIMAL(10,2) DEFAULT 0,
    store VARCHAR(255),
    date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    rejected_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_product (product)
) ENGINE=InnoDB;

-- Store Expiry
CREATE TABLE IF NOT EXISTS store_expiry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    batch_no VARCHAR(100),
    expiry_date DATE,
    quantity INT DEFAULT 0,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_expiry (expiry_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Market Expiry
CREATE TABLE IF NOT EXISTS market_expiry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    batch_no VARCHAR(100),
    expiry_date DATE,
    quantity INT DEFAULT 0,
    customer VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_expiry (expiry_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Regenerate Expiry
CREATE TABLE IF NOT EXISTS regenerate_expiry (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    old_batch VARCHAR(100),
    new_batch VARCHAR(100),
    old_expiry DATE,
    new_expiry DATE,
    quantity INT DEFAULT 0,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Costing Valuation
CREATE TABLE IF NOT EXISTS costing_valuation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    batch_no VARCHAR(100),
    cost_price DECIMAL(15, 2) DEFAULT 0.00,
    selling_price DECIMAL(15, 2) DEFAULT 0.00,
    valuation_method VARCHAR(50),
    quantity INT DEFAULT 0,
    total_value DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product (product_name)
) ENGINE=InnoDB;

-- Costing Center
CREATE TABLE IF NOT EXISTS costing_center (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_name VARCHAR(255),
    center_code VARCHAR(50),
    description TEXT,
    budget DECIMAL(15, 2) DEFAULT 0.00,
    actual_cost DECIMAL(15, 2) DEFAULT 0.00,
    variance DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (center_code)
) ENGINE=InnoDB;
