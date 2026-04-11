// ======================= SERVER.JS (Fixed Upload Order) =======================
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
// server.js
require('dotenv').config();



const app = express();
const PORT = 3000;


// ================== Ensure Upload Directory Before Anything ==================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ================== File Upload Setup ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ✅ File Upload Route — Full URL Response
app.post('/api/uploads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Return full public URL instead of relative path
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ success: true, path: fileUrl });
});

// ✅ Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// ================== Middleware ==================
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());

// ================== Data Directory (for uploads/temp files only) ==================
// Note: All application data is now stored in MySQL database
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// ================== ROUTE IMPORTS ==================
const dashboardRoutes = require('./routes/dashboard');
const bookingsRoutes = require('./routes/bookings');
const customersRoutes = require('./routes/customers');
const invoicesRoutes = require('./routes/invoices');
const controlledRoutes = require('./routes/controlledInvoices');
const openInvoiceRoutes = require('./routes/openInvoices');
const salesReturnsRoutes = require('./routes/salesReturns');
const deliverySummaryRoutes = require('./routes/deliverySummary');
const summaryCollectionRoutes = require('./routes/summaryCollection');
const discountClaimRoutes = require('./routes/discountClaimRoutes');
const bonusClaimRoutes = require('./routes/bonusClaimRoutes');
const claimsAdjustmentRoutes = require('./routes/claimsAdjustmentRoutes');
const openClaimRoutes = require('./routes/openClaimRoutes');
const storeExpiryRoutes = require('./routes/storeExpiryRoutes');
const marketExpiryRoutes = require('./routes/marketExpiryRoutes');
const regenerateExpiryRoutes = require('./routes/regenerateExpiryRoutes');
const expenseTypeRoutes = require('./routes/expenseTypeRoutes');
const expenseVoucherRoutes = require('./routes/expenseVouchers');
const chequeEntryRoutes = require('./routes/chequeEntry');
const bankDepositsRoutes = require('./routes/bankDeposits');
const debitCreditRoutes = require('./routes/debitCredit');
const vendorPaymentRoutes = require('./routes/vendorPayment');
const customerPaymentRoutes = require('./routes/customerPayment');
const openingBalanceRoutes = require('./routes/openingBalance');
const employeeReceiptRoutes = require('./routes/employeeReceipt');
const knockOffRoutes = require('./routes/knockOffDocument');
const salesReportsRoutes = require('./routes/salesReports');
const inventoryReportsRoutes = require('./routes/inventoryReports');
const financeReportsRoutes = require('./routes/financeReports');
const claimsReportsRoutes = require('./routes/claimsReports');
const payrollReportsRoute = require('./routes/payrollReports');
const distributionReportsRoute = require('./routes/distributionReports');
const adminAuditReportsRoute = require('./routes/adminAuditReports');
const sposReportsRoute = require('./routes/sposReports');
const dmsMastersRoute = require('./routes/dmsMasters');
const dmsOperationsRoutes = require('./routes/dmsOperations');
const payrollSetupRoutes = require('./routes/payrollSetup');
const employeeGroupRoutes = require('./routes/employeeGroup');
const visitingDayRoutes = require('./routes/visitingDays');
const attendanceRoutes = require('./routes/attendance');
const expenseClaimsRoutes = require('./routes/expenseClaims');
const financialYearRoutes = require('./routes/financialYear');
const chartOfAccountsRoutes = require('./routes/chartOfAccounts');
const bankCashCurrencyRoutes = require('./routes/bankCashCurrency');
const voucherRoutes = require('./routes/vouchers');
const closingReportingRoutes = require('./routes/closingReporting');
const itemMasterRoutes = require("./routes/itemMaster");
const warehouseBinsRoutes = require("./routes/warehouseBins");
const fefoManagementRoutes = require("./routes/fefoManagement");
const roleAccessRoutes = require("./routes/roleAccess");
const auditTrailRoutes = require("./routes/auditTrail");
const auditLogger = require("./middleware/auditLogger");
const backupRecoveryRoutes = require("./routes/backupRecovery");
const adminClearSessionsRoutes = require("./routes/adminClearSessions");
const controlPanelRoutes = require("./routes/controlPanel");
const repostGLRoutes = require("./routes/repostGL");
const dayEndRoutes = require("./routes/dayEnd");
const changeAccountDateRoutes = require("./routes/changeAccountDate");
const costingCenterRoutes = require("./routes/costingCenter");
const documentPostingRoutes = require("./routes/documentPosting");
const userGroupsRoutes = require("./routes/userGroups");
const exportDataRoutes = require("./routes/exportData");
const helpAndUtilitiesRoutes = require("./routes/helpAndUtilities");
const rolesPermissionsRoutes = require('./routes/rolesPermissions');
const adminAuthRoutes = require('./routes/adminAuth');
const loginAuthRoutes = require("./routes/loginAuth");
const salesmanDepartmentRoutes = require("./routes/salesmanDepartment");
const salesmanAppDataRoutes = require("./routes/salesmanAppData");
const salesmanOrdersRoutes = require("./routes/salesmanOrders");


// ================== DATABASE CONNECTION ==================
// MySQL Database Connection (New)
const { connectDB } = require('./db-mysql');

// Connect to MySQL database
connectDB();

// MongoDB connections (Legacy - will be removed after full migration)
// const connectDB = require('./db');
// const { connectFlutterAppDB } = require('./dbFlutterApp');
// connectDB();
// connectFlutterAppDB().catch(err => {
//   console.error('Failed to connect Flutter App database:', err);
// });

// const loginAuthRoutes = require("./routes/loginAuth");



// ================== MOUNT ROUTES ==================
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/controlled-invoices', controlledRoutes);
app.use('/api/open-invoices', openInvoiceRoutes);
app.use('/api/sales-returns', salesReturnsRoutes);
app.use('/api/customer-receipts', require('./routes/customerReceipts'));
app.use('/api/stock-adjustments', require('./routes/stockAdjustments'));
app.use('/api/delivery-summary', deliverySummaryRoutes);
app.use('/api/summary-collection', summaryCollectionRoutes);
app.use('/api/discount-claims', discountClaimRoutes);
app.use('/api/bonus-claims', bonusClaimRoutes);
app.use('/api/claims-adjustments', claimsAdjustmentRoutes);
app.use('/api/open-claims', openClaimRoutes);
app.use('/api/store-expiry', storeExpiryRoutes);
app.use('/api/market-expiry', marketExpiryRoutes);
app.use('/api/regenerate-expiry', regenerateExpiryRoutes);
app.use('/api/expense-types', expenseTypeRoutes);
app.use('/api/expense-vouchers', expenseVoucherRoutes);
app.use('/api/cheque-entry', chequeEntryRoutes);
app.use('/api/bank-deposits', bankDepositsRoutes);
app.use('/api/cheque-conversion', require('./routes/banks'));
app.use('/api/company-groups', require('./routes/companyGroups'));
app.use('/api/regions', require('./routes/regions'));

app.use('/api/vendor-credit-notes', require('./routes/vendorCreditNote'));
app.use('/api/bank-payments', require('./routes/bankPayment'));
app.use('/api/debit-credit', debitCreditRoutes);
app.use('/api/vendor-payments', vendorPaymentRoutes);
app.use('/api/customer-payments', customerPaymentRoutes);
app.use('/api/opening-balances', openingBalanceRoutes);
app.use('/api/employee-receipts', employeeReceiptRoutes);
app.use('/api/knockoff-documents', knockOffRoutes);
app.use('/api/contacts', require('./routes/contactMasters'));
app.use('/api/sms-orders', require('./routes/smsOrders'));
app.use('/api/email-schedules', require('./routes/emailSchedules'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/sales-targets', require('./routes/salesTarget'));
app.use('/api/employee-incentives', require('./routes/employeeIncentives'));
app.use('/api/fleet-route', require('./routes/fleetRoute'));
app.use('/api/sales-reports', salesReportsRoutes);
app.use('/api/inventory-reports', inventoryReportsRoutes);
app.use('/api/finance-reports', financeReportsRoutes);
app.use('/api/claims-reports', claimsReportsRoutes);
app.use('/api/payroll-reports', payrollReportsRoute);
app.use('/api/distribution-reports', distributionReportsRoute);
app.use('/api/admin-audit-reports', adminAuditReportsRoute);
app.use('/api/spos-reports', sposReportsRoute);
app.use('/api/companies', require('./routes/companies'));
app.use('/api/purchase-orders', require('./routes/purchaseOrder'));
app.use('/api/grn', require('./routes/grn'));
app.use('/api/purchase-invoices', require('./routes/purchaseInvoice'));
app.use('/api/vendor-ap', require('./routes/vendorAP'));
app.use('/api/dms', dmsMastersRoute);
app.use('/api/dms-operations', dmsOperationsRoutes);
app.use('/api/payroll-setup', payrollSetupRoutes);
app.use('/api/employee-groups', employeeGroupRoutes);
app.use('/api/visiting-days', visitingDayRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expense-claims', expenseClaimsRoutes);
app.use('/api/salary-generation', require('./routes/salaryGeneration'));
app.use('/api/employee-balance', require('./routes/employeeBalance'));
app.use('/api/payslips', require('./routes/payslip'));
app.use('/api/financial-years', require('./routes/financialYear'));
app.use('/api/financial-years', financialYearRoutes);
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/bank-cash-currency', bankCashCurrencyRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/voucher-types', require('./routes/voucherTypes'));
app.use('/api/bank-reconcile', require('./routes/bankReconcile'));
app.use('/api/cheque-books', require('./routes/chequeBook'));
app.use('/api/taxes', require('./routes/taxes'));
app.use('/api/costing-valuation', require('./routes/costingValuation'));
app.use('/api/closing-reporting', closingReportingRoutes);
app.use("/api/item-master", itemMasterRoutes);
app.use("/api/warehouse-bins", warehouseBinsRoutes);
app.use("/api/fefo-management", fefoManagementRoutes);
app.use("/api/role-access", roleAccessRoutes);
app.use("/api/audit-trail", auditTrailRoutes);
app.use(auditLogger);
app.use("/api/backup-recovery", backupRecoveryRoutes);
app.use("/api/admin-clear", adminClearSessionsRoutes);
app.use("/api/control-panel", controlPanelRoutes);
app.use("/api/repost-gl", repostGLRoutes);
app.use("/api/day-end", dayEndRoutes);
app.use("/api/change-account-date", changeAccountDateRoutes);
app.use("/api/costing-center", costingCenterRoutes);
app.use("/api/document-posting", documentPostingRoutes);
app.use("/api/user-groups", userGroupsRoutes);
app.use("/api/export-data", exportDataRoutes);
app.use("/api/help-utilities", helpAndUtilitiesRoutes);
app.use("/api/user-account", require("./routes/userAccount"));
app.use('/api/roles-permissions', rolesPermissionsRoutes);
app.use('/api/admin', adminAuthRoutes);



app.use("/api/login", loginAuthRoutes);
app.use("/api/salesman", salesmanDepartmentRoutes);
app.use("/api/salesman-app", salesmanAppDataRoutes);
app.use("/api/salesman-orders", salesmanOrdersRoutes);




// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
