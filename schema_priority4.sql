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
