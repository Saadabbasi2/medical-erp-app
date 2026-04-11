-- =====================================================
-- FINAL PRIORITY: REMAINING 15 MODULES
-- =====================================================

-- Salesman Department
CREATE TABLE IF NOT EXISTS salesman_department (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_code VARCHAR(50),
    department_name VARCHAR(255),
    manager_name VARCHAR(255),
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (department_code),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Salesman App Data
CREATE TABLE IF NOT EXISTS salesman_app_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT,
    salesman_name VARCHAR(255),
    app_version VARCHAR(50),
    last_sync TIMESTAMP NULL,
    device_info TEXT,
    location_data TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_salesman (salesman_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Contact Masters
CREATE TABLE IF NOT EXISTS contact_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_type VARCHAR(100),
    name VARCHAR(255),
    company VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (contact_type),
    INDEX idx_name (name),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- SMS Orders
CREATE TABLE IF NOT EXISTS sms_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    phone VARCHAR(50),
    message TEXT,
    order_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Email Schedules
CREATE TABLE IF NOT EXISTS email_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_name VARCHAR(255),
    recipient_email VARCHAR(255),
    subject VARCHAR(255),
    body TEXT,
    schedule_type VARCHAR(50),
    schedule_time TIME,
    schedule_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    last_sent TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_schedule_date (schedule_date)
) ENGINE=InnoDB;

-- Sales Target
CREATE TABLE IF NOT EXISTS sales_target (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT,
    salesman_name VARCHAR(255),
    target_period VARCHAR(50),
    target_amount DECIMAL(15, 2) DEFAULT 0.00,
    achieved_amount DECIMAL(15, 2) DEFAULT 0.00,
    achievement_percentage DECIMAL(5, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_salesman (salesman_id),
    INDEX idx_period (target_period)
) ENGINE=InnoDB;

-- Fleet Route
CREATE TABLE IF NOT EXISTS fleet_route (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_code VARCHAR(50),
    route_name VARCHAR(255),
    vehicle_id INT,
    driver_name VARCHAR(255),
    region VARCHAR(100),
    territory VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_route_code (route_code),
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Financial Year
CREATE TABLE IF NOT EXISTS financial_year (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_code VARCHAR(50),
    year_name VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_year_code (year_code),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Opening Balance
CREATE TABLE IF NOT EXISTS opening_balance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(50),
    account_name VARCHAR(255),
    account_type VARCHAR(100),
    opening_balance DECIMAL(15, 2) DEFAULT 0.00,
    balance_type VARCHAR(20),
    financial_year VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_code (account_code),
    INDEX idx_financial_year (financial_year)
) ENGINE=InnoDB;

-- Dashboard
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_type VARCHAR(100),
    widget_name VARCHAR(255),
    widget_data JSON,
    user_id INT,
    position INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_type (widget_type)
) ENGINE=InnoDB;

-- Control Panel
CREATE TABLE IF NOT EXISTS control_panel_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
) ENGINE=InnoDB;

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    username VARCHAR(255),
    action VARCHAR(255),
    module VARCHAR(100),
    record_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_module (module),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_type VARCHAR(100),
    log_level VARCHAR(50),
    message TEXT,
    user_id INT,
    username VARCHAR(255),
    module VARCHAR(100),
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (log_type),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- Backup Recovery
CREATE TABLE IF NOT EXISTS backup_recovery (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_name VARCHAR(255),
    backup_type VARCHAR(50),
    backup_path TEXT,
    backup_size BIGINT DEFAULT 0,
    backup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Completed',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backup_date (backup_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Admin Clear Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE,
    user_id INT,
    username VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_user (user_id),
    INDEX idx_activity (last_activity)
) ENGINE=InnoDB;
