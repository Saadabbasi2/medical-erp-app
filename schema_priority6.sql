-- =====================================================
-- PRIORITY 6: HR & PAYROLL (11 TABLES)
-- =====================================================

-- Payroll Setup (Designations & Departments)
CREATE TABLE IF NOT EXISTS payroll_setup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    designation VARCHAR(255),
    department VARCHAR(255),
    head VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Employee Groups
CREATE TABLE IF NOT EXISTS employee_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    date DATE,
    status VARCHAR(50) DEFAULT 'Present',
    check_in TIME,
    check_out TIME,
    hours_worked DECIMAL(5, 2) DEFAULT 0.00,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- Expense Claims
CREATE TABLE IF NOT EXISTS expense_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    expense_type VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Expense Types
CREATE TABLE IF NOT EXISTS expense_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Expense Vouchers
CREATE TABLE IF NOT EXISTS expense_vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no VARCHAR(50),
    employee_id INT,
    employee_name VARCHAR(255),
    expense_type VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_employee (employee_id)
) ENGINE=InnoDB;

-- Salary Generation
CREATE TABLE IF NOT EXISTS salary_generation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    month VARCHAR(20),
    year INT,
    basic_salary DECIMAL(15, 2) DEFAULT 0.00,
    allowances DECIMAL(15, 2) DEFAULT 0.00,
    deductions DECIMAL(15, 2) DEFAULT 0.00,
    net_salary DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Generated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_month_year (month, year)
) ENGINE=InnoDB;

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    month VARCHAR(20),
    year INT,
    basic_salary DECIMAL(15, 2) DEFAULT 0.00,
    allowances DECIMAL(15, 2) DEFAULT 0.00,
    deductions DECIMAL(15, 2) DEFAULT 0.00,
    net_salary DECIMAL(15, 2) DEFAULT 0.00,
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_month_year (month, year)
) ENGINE=InnoDB;

-- Employee Balance
CREATE TABLE IF NOT EXISTS employee_balance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    balance_type VARCHAR(100),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id)
) ENGINE=InnoDB;

-- Employee Receipts
CREATE TABLE IF NOT EXISTS employee_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(50),
    employee_id INT,
    employee_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    payment_method VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_receipt_no (receipt_no),
    INDEX idx_employee (employee_id)
) ENGINE=InnoDB;

-- Visiting Days
CREATE TABLE IF NOT EXISTS visiting_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    employee_name VARCHAR(255),
    visit_date DATE,
    location VARCHAR(255),
    purpose TEXT,
    status VARCHAR(50) DEFAULT 'Scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_date (visit_date)
) ENGINE=InnoDB;
