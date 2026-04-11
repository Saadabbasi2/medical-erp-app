-- =====================================================
-- MEDICAL ERP - MySQL Database Schema (COMPLETE)
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS medical_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medical_erp;

-- =====================================================
-- AUTHENTICATION & USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_module (role_name, module_name)
) ENGINE=InnoDB;

-- =====================================================
-- COMPANIES & PRODUCTS (Purchase Reports)
-- =====================================================

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    policies TEXT,
    manager VARCHAR(255),
    spos VARCHAR(255),
    areas VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100),
    company_id INT NOT NULL,
    group_name VARCHAR(100),
    trade_price DECIMAL(15, 2) DEFAULT 0.00,
    discount_customer DECIMAL(5, 2) DEFAULT 0.00,
    sales_tax DECIMAL(5, 2) DEFAULT 0.00,
    discount_for_us DECIMAL(5, 2) DEFAULT 0.00,
    batch VARCHAR(100),
    expiry_date DATE,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_product_name (product_name),
    INDEX idx_company (company_id)
) ENGINE=InnoDB;

-- =====================================================
-- CUSTOMERS
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    route VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    ntn VARCHAR(100),
    cnic VARCHAR(100),
    credit_limit DECIMAL(15, 2) DEFAULT 0.00,
    opening_balance DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_route (route)
) ENGINE=InnoDB;

-- =====================================================
-- SALES & INVOICES
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE,
    customer_id INT,
    customer_name VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) DEFAULT 0.00,
    tax_amount DECIMAL(15, 2) DEFAULT 0.00,
    withholding_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Generated',
    customer_ntn VARCHAR(100),
    customer_cnic VARCHAR(100),
    filer_status VARCHAR(50) DEFAULT 'Filer',
    tax_rate DECIMAL(5, 4) DEFAULT 0.18,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_customer (customer_id),
    INDEX idx_date (invoice_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_group VARCHAR(100),
    batch VARCHAR(100) DEFAULT '-',
    expiry_date DATE,
    quantity INT NOT NULL,
    bonus INT DEFAULT 0,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    line_total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice (invoice_id),
    INDEX idx_product (product_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    booking_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_invoice_booking (invoice_id, booking_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    sale_date DATE NOT NULL,
    customer VARCHAR(255) NOT NULL,
    booking_id INT,
    company VARCHAR(255),
    product_group VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (sale_date),
    INDEX idx_customer (customer),
    INDEX idx_item (item_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    route VARCHAR(255),
    booking_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    requires_approval BOOLEAN DEFAULT FALSE,
    ntn VARCHAR(100),
    cnic VARCHAR(100),
    filer_status VARCHAR(50) DEFAULT 'Filer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_customer (customer_id),
    INDEX idx_date (booking_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_group VARCHAR(100),
    batch VARCHAR(100) DEFAULT '-',
    expiry_date DATE,
    quantity INT NOT NULL,
    bonus INT DEFAULT 0,
    unit_price DECIMAL(15, 2) DEFAULT 0.00,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    line_total DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_booking (booking_id),
    INDEX idx_product (product_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_number VARCHAR(100) NOT NULL UNIQUE,
    invoice_id INT,
    customer_id INT NOT NULL,
    return_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_return_number (return_number),
    INDEX idx_date (return_date)
) ENGINE=InnoDB;

-- =====================================================
-- SALESMAN MODULE (Currently in MongoDB)
-- =====================================================

CREATE TABLE IF NOT EXISTS salesmen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    login_id VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_login_id (login_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salesman_customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT NOT NULL,
    customer_id INT NOT NULL,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_salesman_customer (salesman_id, customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salesman_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT NOT NULL,
    customer_id INT NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_salesman (salesman_id),
    INDEX idx_date (order_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salesman_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT NOT NULL,
    product_id INT NOT NULL,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_salesman_product (salesman_id, product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salesman_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salesman_id) REFERENCES salesmen(id) ON DELETE CASCADE,
    INDEX idx_salesman (salesman_id),
    INDEX idx_date (action_date)
) ENGINE=InnoDB;

-- =====================================================
-- PURCHASE MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(100) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    INDEX idx_po_number (po_number),
    INDEX idx_company (company_id),
    INDEX idx_date (order_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grn (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_number VARCHAR(100) NOT NULL UNIQUE,
    po_id INT,
    company_id INT NOT NULL,
    received_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'received',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    INDEX idx_grn_number (grn_number),
    INDEX idx_date (received_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    grn_id INT,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    FOREIGN KEY (grn_id) REFERENCES grn(id) ON DELETE SET NULL,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_date (invoice_date)
) ENGINE=InnoDB;

-- =====================================================
-- FINANCIAL MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(100) NOT NULL,
    parent_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    INDEX idx_code (account_code),
    INDEX idx_type (account_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100),
    bank_name VARCHAR(255),
    branch VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'PKR',
    opening_balance DECIMAL(15, 2) DEFAULT 0.00,
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_number (account_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    receipt_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    bank_account_id INT,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
    INDEX idx_receipt_number (receipt_number),
    INDEX idx_customer (customer_id),
    INDEX idx_date (receipt_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    bank_account_id INT,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
    INDEX idx_payment_number (payment_number),
    INDEX idx_customer (customer_id),
    INDEX idx_date (payment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deposit_number VARCHAR(100) NOT NULL UNIQUE,
    bank_account_id INT NOT NULL,
    deposit_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    INDEX idx_deposit_number (deposit_number),
    INDEX idx_date (deposit_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(100) NOT NULL UNIQUE,
    bank_account_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payee VARCHAR(255),
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    INDEX idx_payment_number (payment_number),
    INDEX idx_date (payment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cheque_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_number VARCHAR(100) NOT NULL UNIQUE,
    bank_account_id INT NOT NULL,
    start_number INT NOT NULL,
    end_number INT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    INDEX idx_book_number (book_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cheque_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_number VARCHAR(100) NOT NULL UNIQUE,
    bank_account_id INT NOT NULL,
    payee VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    cheque_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'issued',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    INDEX idx_cheque_number (cheque_number),
    INDEX idx_date (cheque_date)
) ENGINE=InnoDB;

-- =====================================================
-- INVENTORY MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_bins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bin_code VARCHAR(50) NOT NULL UNIQUE,
    bin_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bin_code (bin_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adjustment_number VARCHAR(100) NOT NULL UNIQUE,
    product_id INT NOT NULL,
    adjustment_date DATE NOT NULL,
    quantity_change INT NOT NULL,
    adjustment_type VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_adjustment_number (adjustment_number),
    INDEX idx_product (product_id),
    INDEX idx_date (adjustment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS item_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(50) NOT NULL UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    reorder_level INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_item_code (item_code),
    INDEX idx_category (category)
) ENGINE=InnoDB;

-- =====================================================
-- CLAIMS MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS discount_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_number VARCHAR(100) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    claim_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    INDEX idx_claim_number (claim_number),
    INDEX idx_date (claim_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bonus_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_number VARCHAR(100) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    claim_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    INDEX idx_claim_number (claim_number),
    INDEX idx_date (claim_date)
) ENGINE=InnoDB;

-- =====================================================
-- PAYROLL & HR
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status VARCHAR(50) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_date (attendance_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expense_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_number VARCHAR(100) NOT NULL UNIQUE,
    employee_id INT NOT NULL,
    claim_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_claim_number (claim_number),
    INDEX idx_employee (employee_id),
    INDEX idx_date (claim_date)
) ENGINE=InnoDB;

-- =====================================================
-- AUDIT & LOGGING
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_trail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_module (module),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- SYSTEM CONFIGURATION
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_name VARCHAR(100) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS control_panel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- ADDITIONAL SALES & DELIVERY TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_return_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    batch VARCHAR(100) DEFAULT '-',
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    line_total DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    INDEX idx_return (return_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS controlled_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    customer_name VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(255),
    approved_by_signature_path VARCHAR(255),
    approved_at TIMESTAMP NULL,
    rejected_by VARCHAR(255),
    rejected_at TIMESTAMP NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_date (invoice_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS controlled_invoice_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    controlled_invoice_id INT NOT NULL,
    booking_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (controlled_invoice_id) REFERENCES controlled_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_controlled_booking (controlled_invoice_id, booking_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS controlled_invoice_approval_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    controlled_invoice_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    by_user VARCHAR(255) NOT NULL,
    action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (controlled_invoice_id) REFERENCES controlled_invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice (controlled_invoice_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS open_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    customer_name VARCHAR(255) NOT NULL,
    payment_method VARCHAR(100),
    invoice_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) DEFAULT 0.00,
    tax_amount DECIMAL(15, 2) DEFAULT 0.00,
    withholding_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Open',
    customer_ntn VARCHAR(100),
    customer_cnic VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_date (invoice_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS open_invoice_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    open_invoice_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    batch VARCHAR(100) DEFAULT '-',
    expiry_date DATE,
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    line_total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (open_invoice_id) REFERENCES open_invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice (open_invoice_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS delivery_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id VARCHAR(100),
    route VARCHAR(255),
    vehicle VARCHAR(100),
    driver VARCHAR(255),
    loaded_qty INT DEFAULT 0,
    delivered_qty INT DEFAULT 0,
    returned_qty INT DEFAULT 0,
    pod_filename VARCHAR(255),
    pod_status VARCHAR(50) DEFAULT 'Not Captured',
    pod_uploaded_at TIMESTAMP NULL,
    notes TEXT,
    delivery_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trip (trip_id),
    INDEX idx_date (delivery_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS summary_collection (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salesman VARCHAR(255),
    route VARCHAR(255),
    expected_amount DECIMAL(15, 2) DEFAULT 0.00,
    collected_amount DECIMAL(15, 2) DEFAULT 0.00,
    difference DECIMAL(15, 2) DEFAULT 0.00,
    reason TEXT,
    notes TEXT,
    collection_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_salesman (salesman),
    INDEX idx_date (collection_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- =====================================================
-- Insert Default Admin User
-- =====================================================
-- Password: admin123 (you should change this immediately)
INSERT INTO users (username, password, email, role) 
VALUES ('admin', '$2a$10$rQZ9vJZXQXQXQXQXQXQXQeJ9vJZXQXQXQXQXQXQXQXQXQXQXQXQXQ', 'admin@medicalerp.com', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- =====================================================
-- Schema Creation Complete
-- =====================================================

-- =====================================================
-- PRIORITY 4: FINANCIAL MODULES (19 TABLES)
-- =====================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(50),
    account_name VARCHAR(255),
    type VARCHAR(100),
    module_mapping VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_code (account_code),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Voucher Types
CREATE TABLE IF NOT EXISTS voucher_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100),
    prefix VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bank Cash Currency
CREATE TABLE IF NOT EXISTS bank_cash_currency (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50),
    name VARCHAR(255),
    account_no VARCHAR(100),
    currency VARCHAR(10),
    rate DECIMAL(15, 4) DEFAULT 1.0000,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bank Deposits
CREATE TABLE IF NOT EXISTS bank_deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deposit_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_deposit_no (deposit_no),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Bank Payments
CREATE TABLE IF NOT EXISTS bank_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    payee VARCHAR(255),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no)
) ENGINE=InnoDB;

-- Bank Reconciliation
CREATE TABLE IF NOT EXISTS bank_reconcile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    statement_date DATE,
    bank_balance DECIMAL(15, 2) DEFAULT 0.00,
    book_balance DECIMAL(15, 2) DEFAULT 0.00,
    reconciled BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Cheque Books
CREATE TABLE IF NOT EXISTS cheque_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_no VARCHAR(50),
    bank_account VARCHAR(255),
    start_no VARCHAR(50),
    end_no VARCHAR(50),
    issued_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_book_no (book_no)
) ENGINE=InnoDB;

-- Cheque Entries
CREATE TABLE IF NOT EXISTS cheque_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    payee VARCHAR(255),
    date DATE,
    status VARCHAR(50) DEFAULT 'Issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cheque_no (cheque_no),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Cheque Conversions
CREATE TABLE IF NOT EXISTS cheque_conversions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_no VARCHAR(50),
    conversion_type VARCHAR(100),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cheque_no (cheque_no)
) ENGINE=InnoDB;

-- Customer Payments
CREATE TABLE IF NOT EXISTS customer_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB;

-- Customer Receipts
CREATE TABLE IF NOT EXISTS customer_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_receipt_no (receipt_no),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB;

-- Vendor Payments
CREATE TABLE IF NOT EXISTS vendor_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Vendor Accounts Payable
CREATE TABLE IF NOT EXISTS vendor_ap (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_no (invoice_no),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Vendor Credit Notes
CREATE TABLE IF NOT EXISTS vendor_credit_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_note_no (note_no),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Debit Credit
CREATE TABLE IF NOT EXISTS debit_credit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no VARCHAR(50),
    type VARCHAR(50),
    account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no VARCHAR(50),
    date DATE,
    type VARCHAR(50),
    account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Tax Masters
CREATE TABLE IF NOT EXISTS tax_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100),
    code VARCHAR(50),
    description TEXT,
    rate DECIMAL(5, 2) DEFAULT 0.00,
    applies_to VARCHAR(255),
    identifier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Tax Adjustments
CREATE TABLE IF NOT EXISTS tax_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adj_no VARCHAR(50),
    type VARCHAR(100),
    code VARCHAR(50),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    reference VARCHAR(255),
    remarks TEXT,
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_adj_no (adj_no),
    INDEX idx_type (type)
) ENGINE=InnoDB;
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
-- =====================================================
-- PRIORITY 8: PROCUREMENT & VENDORS (8 TABLES)
-- =====================================================

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    order_date DATE,
    delivery_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    remarks TEXT,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE,
    po_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    invoice_date DATE,
    due_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    paid_amount DECIMAL(15, 2) DEFAULT 0.00,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_number VARCHAR(50) UNIQUE,
    invoice_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    return_date DATE,
    return_amount DECIMAL(15, 2) DEFAULT 0.00,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_return_number (return_number),
    INDEX idx_invoice (invoice_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Vendor Management
CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_code VARCHAR(50) UNIQUE,
    vendor_name VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(15, 2) DEFAULT 0.00,
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_code (vendor_code),
    INDEX idx_vendor_name (vendor_name),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- GRN (Goods Received Notes)
CREATE TABLE IF NOT EXISTS grn (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_number VARCHAR(50) UNIQUE,
    po_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    received_date DATE,
    received_by VARCHAR(100),
    total_quantity INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Received',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_grn_number (grn_number),
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Purchase Reports (Summary/Analytics)
CREATE TABLE IF NOT EXISTS purchase_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_invoices INT DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0.00,
    total_pending DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    quotation_date DATE,
    valid_until DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_quotation_number (quotation_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- RFQ (Request for Quotation)
CREATE TABLE IF NOT EXISTS rfq (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    rfq_date DATE,
    response_deadline DATE,
    status VARCHAR(50) DEFAULT 'Sent',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rfq_number (rfq_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;
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
-- =====================================================
-- PRIORITY 4: FINANCIAL MODULES (19 TABLES)
-- =====================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_code VARCHAR(50),
    account_name VARCHAR(255),
    type VARCHAR(100),
    module_mapping VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_code (account_code),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Voucher Types
CREATE TABLE IF NOT EXISTS voucher_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100),
    prefix VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bank Cash Currency
CREATE TABLE IF NOT EXISTS bank_cash_currency (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50),
    name VARCHAR(255),
    account_no VARCHAR(100),
    currency VARCHAR(10),
    rate DECIMAL(15, 4) DEFAULT 1.0000,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bank Deposits
CREATE TABLE IF NOT EXISTS bank_deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deposit_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_deposit_no (deposit_no),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Bank Payments
CREATE TABLE IF NOT EXISTS bank_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    payee VARCHAR(255),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no)
) ENGINE=InnoDB;

-- Bank Reconciliation
CREATE TABLE IF NOT EXISTS bank_reconcile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    statement_date DATE,
    bank_balance DECIMAL(15, 2) DEFAULT 0.00,
    book_balance DECIMAL(15, 2) DEFAULT 0.00,
    reconciled BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Cheque Books
CREATE TABLE IF NOT EXISTS cheque_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_no VARCHAR(50),
    bank_account VARCHAR(255),
    start_no VARCHAR(50),
    end_no VARCHAR(50),
    issued_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_book_no (book_no)
) ENGINE=InnoDB;

-- Cheque Entries
CREATE TABLE IF NOT EXISTS cheque_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_no VARCHAR(50),
    bank_account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    payee VARCHAR(255),
    date DATE,
    status VARCHAR(50) DEFAULT 'Issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cheque_no (cheque_no),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Cheque Conversions
CREATE TABLE IF NOT EXISTS cheque_conversions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cheque_no VARCHAR(50),
    conversion_type VARCHAR(100),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cheque_no (cheque_no)
) ENGINE=InnoDB;

-- Customer Payments
CREATE TABLE IF NOT EXISTS customer_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB;

-- Customer Receipts
CREATE TABLE IF NOT EXISTS customer_receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_receipt_no (receipt_no),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB;

-- Vendor Payments
CREATE TABLE IF NOT EXISTS vendor_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    method VARCHAR(50),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_no (payment_no),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Vendor Accounts Payable
CREATE TABLE IF NOT EXISTS vendor_ap (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_no (invoice_no),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Vendor Credit Notes
CREATE TABLE IF NOT EXISTS vendor_credit_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_no VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_note_no (note_no),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Debit Credit
CREATE TABLE IF NOT EXISTS debit_credit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no VARCHAR(50),
    type VARCHAR(50),
    account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    date DATE,
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_no VARCHAR(50),
    date DATE,
    type VARCHAR(50),
    account VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_voucher_no (voucher_no),
    INDEX idx_type (type),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Tax Masters
CREATE TABLE IF NOT EXISTS tax_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100),
    code VARCHAR(50),
    description TEXT,
    rate DECIMAL(5, 2) DEFAULT 0.00,
    applies_to VARCHAR(255),
    identifier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- Tax Adjustments
CREATE TABLE IF NOT EXISTS tax_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adj_no VARCHAR(50),
    type VARCHAR(100),
    code VARCHAR(50),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    reference VARCHAR(255),
    remarks TEXT,
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_adj_no (adj_no),
    INDEX idx_type (type)
) ENGINE=InnoDB;
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
-- =====================================================
-- PRIORITY 8: PROCUREMENT & VENDORS (8 TABLES)
-- =====================================================

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    order_date DATE,
    delivery_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    remarks TEXT,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE,
    po_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    invoice_date DATE,
    due_date DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    paid_amount DECIMAL(15, 2) DEFAULT 0.00,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_number VARCHAR(50) UNIQUE,
    invoice_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    return_date DATE,
    return_amount DECIMAL(15, 2) DEFAULT 0.00,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_return_number (return_number),
    INDEX idx_invoice (invoice_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Vendor Management
CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_code VARCHAR(50) UNIQUE,
    vendor_name VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(15, 2) DEFAULT 0.00,
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vendor_code (vendor_code),
    INDEX idx_vendor_name (vendor_name),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- GRN (Goods Received Notes)
CREATE TABLE IF NOT EXISTS grn (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_number VARCHAR(50) UNIQUE,
    po_number VARCHAR(50),
    vendor_id INT,
    vendor_name VARCHAR(255),
    received_date DATE,
    received_by VARCHAR(100),
    total_quantity INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Received',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_grn_number (grn_number),
    INDEX idx_po_number (po_number),
    INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB;

-- Purchase Reports (Summary/Analytics)
CREATE TABLE IF NOT EXISTS purchase_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(100),
    report_period VARCHAR(50),
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_invoices INT DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0.00,
    total_pending DECIMAL(15, 2) DEFAULT 0.00,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_period (report_period)
) ENGINE=InnoDB;

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    quotation_date DATE,
    valid_until DATE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Draft',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_quotation_number (quotation_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- RFQ (Request for Quotation)
CREATE TABLE IF NOT EXISTS rfq (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_number VARCHAR(50) UNIQUE,
    vendor_id INT,
    vendor_name VARCHAR(255),
    rfq_date DATE,
    response_deadline DATE,
    status VARCHAR(50) DEFAULT 'Sent',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rfq_number (rfq_number),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;
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
