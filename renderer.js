// renderer.js (full updated with Controlled Bookings fix)
// 🟨 Added "remember last page" SPA navigation + safe DOM checks throughout
const API_BASE = window.API_BASE ?? 'http://84.247.169.194:3000';
let currentRejectId = null;
let monthlyChart = null;
let weeklyChart = null;
let sessionUser = null;
let isAdminUser = false;
let allowedPageIds = null;
let orderedModulePageIds = [];
let moduleSearchInputEl = null;
let moduleSearchResultsEl = null;
let searchableModules = [];
let searchResults = [];
let highlightedSearchIndex = -1;
const SESSION_STORAGE_KEY = 'erpSession';
const DEFAULT_ALLOWED_PAGES = [
  'page-dashboard',
  'page-change-password',
  'page-switch-user',
  'page-quick-lock',
  'page-logout'
];

// In Electron, native alert()/confirm() can sometimes leave the page
// in a "not focusable / can't type" state until the window is reactivated.
// Wrap them to proactively restore interactivity afterwards.
const __nativeAlert = window.alert ? window.alert.bind(window) : null;
const __nativeConfirm = window.confirm ? window.confirm.bind(window) : null;

function restoreInteractivity() {
  try {
    cleanupStaleBackdrops?.();
  } catch {}
  try {
    // Remove any accidental click-blocking styles
    document.body.style.removeProperty('pointer-events');
    document.documentElement.style.removeProperty('pointer-events');
  } catch {}
  try {
    // Nudge focus back to the web contents
    window.focus?.();
  } catch {}
}

if (__nativeAlert) {
  window.alert = (message) => {
    __nativeAlert(message);
    setTimeout(restoreInteractivity, 0);
  };
}

if (__nativeConfirm) {
  window.confirm = (message) => {
    const result = __nativeConfirm(message);
    setTimeout(restoreInteractivity, 0);
    return result;
  };
}

function normalizeModuleLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Export Open Invoices CSV
document.getElementById('exportOpenInvoicesCsv')?.addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/api/open-invoices`);
    if (!res.ok) throw new Error('Failed to load open invoices');
    const data = await res.json();
    if (!data.length) return alert('No open invoices to export');
    const csv = [['ID', 'Customer', 'NTN', 'CNIC', 'Date', 'Payment', 'Mode', 'Total', 'Status'],
    ...data.map(inv => [inv.id, `"${inv.customer || ''}"`, `"${inv.customerNTN || ''}"`, `"${inv.customerCNIC || ''}"`, inv.date || '', inv.payment || '', inv.mode || '', inv.total || 0, inv.status || ''])
    ].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'open_invoices.csv');
  } catch (err) {
    console.error('Export open invoices CSV failed', err);
    alert('Failed to export open invoices CSV.');
  }
});

function updateSessionSummary() {
  const nameEl = document.getElementById('sessionUserName');
  const roleEl = document.getElementById('sessionUserRole');
  if (nameEl) {
    const displayName = sessionUser?.name || sessionUser?.fullName || sessionUser?.email || 'User';
    nameEl.textContent = displayName;
  }
  if (roleEl) {
    roleEl.textContent = sessionUser?.role || '';
  }
}

function buildModuleSearchIndex() {
  const seenTargets = new Set();
  const modules = [];
  document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(link => {
    const target = link.getAttribute('data-target');
    const label = link.textContent.trim();
    if (!target || !label) return;
    if (!isPageAllowed(target)) return;
    if (seenTargets.has(target)) return;
    seenTargets.add(target);
    modules.push({
      target,
      label,
      normalized: normalizeModuleLabel(label)
    });
  });
  searchableModules = modules;
}

function setupModuleSearch() {
  moduleSearchInputEl = document.getElementById('moduleSearchInput');
  moduleSearchResultsEl = document.getElementById('moduleSearchResults');
  if (!moduleSearchInputEl || !moduleSearchResultsEl) return;

  moduleSearchInputEl.addEventListener('input', (event) => {
    performModuleSearch(event.target.value);
  });

  moduleSearchInputEl.addEventListener('focus', () => {
    if (moduleSearchInputEl.value) {
      performModuleSearch(moduleSearchInputEl.value);
    }
  });

  moduleSearchInputEl.addEventListener('keydown', (event) => {
    if (!searchResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlightedSearchIndex = (highlightedSearchIndex + 1) % searchResults.length;
      updateHighlightedResult();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlightedSearchIndex = (highlightedSearchIndex - 1 + searchResults.length) % searchResults.length;
      updateHighlightedResult();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selection = searchResults[highlightedSearchIndex] || searchResults[0];
      if (selection) navigateToModule(selection.target);
    } else if (event.key === 'Escape') {
      closeModuleSearchResults(true);
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.module-search')) {
      closeModuleSearchResults();
    }
  });
}

// Safety: remove stale Bootstrap backdrops that can block all inputs
function cleanupStaleBackdrops() {
  try {
    const anyOpenModal = !!document.querySelector('.modal.show');
    const anyOpenOffcanvas = !!document.querySelector('.offcanvas.show');
    const anyBackdrop = !!document.querySelector('.modal-backdrop, .offcanvas-backdrop');

    // If nothing is open but backdrops exist, remove them.
    if (!anyOpenModal && !anyOpenOffcanvas && anyBackdrop) {
      document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open', 'offcanvas-backdrop');
      // Bootstrap sometimes sets these inline styles on body
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }
  } catch (e) {
    // never break typing due to cleanup errors
  }
}

// Run cleanup on common "stuck UI" transitions
window.addEventListener('focus', cleanupStaleBackdrops);
window.addEventListener('resize', cleanupStaleBackdrops);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) cleanupStaleBackdrops();
});
document.addEventListener('click', cleanupStaleBackdrops, true);
setInterval(cleanupStaleBackdrops, 2000);

function performModuleSearch(query) {
  if (!moduleSearchResultsEl) return;
  const normalizedQuery = normalizeModuleLabel(query || '');
  if (!normalizedQuery) {
    closeModuleSearchResults();
    return;
  }

  const matches = searchableModules
    .filter(mod => mod.normalized.includes(normalizedQuery))
    .slice(0, 8);

  searchResults = matches;
  highlightedSearchIndex = matches.length ? 0 : -1;
  renderModuleSearchResults();
}

function renderModuleSearchResults() {
  if (!moduleSearchResultsEl) return;
  moduleSearchResultsEl.innerHTML = '';

  if (!searchResults.length) {
    const empty = document.createElement('div');
    empty.className = 'module-search-empty text-muted';
    empty.textContent = 'No modules found';
    moduleSearchResultsEl.appendChild(empty);
    moduleSearchResultsEl.classList.remove('d-none');
    return;
  }

  searchResults.forEach((result, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-search-result';
    if (index === highlightedSearchIndex) {
      button.classList.add('active');
    }
    const labelSpan = document.createElement('span');
    labelSpan.textContent = result.label;
    button.appendChild(labelSpan);
    button.addEventListener('click', () => navigateToModule(result.target));
    moduleSearchResultsEl.appendChild(button);
  });
  moduleSearchResultsEl.classList.remove('d-none');
}

function updateHighlightedResult() {
  if (!moduleSearchResultsEl) return;
  moduleSearchResultsEl.querySelectorAll('.module-search-result').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === highlightedSearchIndex);
  });
}

function closeModuleSearchResults(clearInput = false) {
  if (moduleSearchResultsEl) {
    moduleSearchResultsEl.classList.add('d-none');
    moduleSearchResultsEl.innerHTML = '';
  }
  if (clearInput && moduleSearchInputEl) {
    moduleSearchInputEl.value = '';
  }
  searchResults = [];
  highlightedSearchIndex = -1;
}

function navigateToModule(pageId) {
  if (!pageId) return;
  showPage(pageId);
  const sidebarLink = document.querySelector(`.sidebar .nav-link[data-target="${pageId}"]`);
  if (sidebarLink) {
    const parentCollapse = sidebarLink.closest('.collapse');
    if (parentCollapse) {
      const collapseInstance = bootstrap.Collapse.getOrCreateInstance(parentCollapse, { toggle: false });
      collapseInstance.show();
    }
    sidebarLink.classList.add('highlight-pulse');
    setTimeout(() => sidebarLink.classList.remove('highlight-pulse'), 1200);
    sidebarLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  closeModuleSearchResults(true);
}

function isPageAllowed(pageId) {
  if (!pageId) return false;
  if (isAdminUser || !allowedPageIds) return true;
  return allowedPageIds.has(pageId);
}

function initializeAccessControl() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    window.location.href = 'login.html';
    return null;
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.href = 'login.html';
    return null;
  }

  if (!session || typeof session !== 'object' || !session.user) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.href = 'login.html';
    return null;
  }

  sessionUser = session.user;
  const modules = Array.isArray(session.modules) ? session.modules : [];
  isAdminUser = (sessionUser.role || '').toLowerCase() === 'admin';
  orderedModulePageIds = [];

  if (isAdminUser || modules.length === 0) {
    allowedPageIds = null;
    return { session, modules };
  }

  const labelToPageMap = {};
  document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(link => {
    const normalized = normalizeModuleLabel(link.textContent);
    if (normalized) labelToPageMap[normalized] = link.getAttribute('data-target');
  });

  const computedAllowed = new Set(DEFAULT_ALLOWED_PAGES);
  modules.forEach(label => {
    const targetId = labelToPageMap[normalizeModuleLabel(label)];
    if (targetId) {
      computedAllowed.add(targetId);
      if (!orderedModulePageIds.includes(targetId)) {
        orderedModulePageIds.push(targetId);
      }
    }
  });

  allowedPageIds = computedAllowed;
  return { session, modules };
}

function applyAccessRestrictions() {
  if (isAdminUser || !allowedPageIds) return;
  const allowed = allowedPageIds;

  document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(link => {
    const target = link.getAttribute('data-target');
    const li = link.closest('li');
    if (!allowed.has(target)) {
      if (li) li.style.display = 'none';
    } else if (li) {
      li.style.display = '';
    }
  });

  document.querySelectorAll('.sidebar li.nav-item').forEach(item => {
    const hasAllowedChild = Array.from(item.querySelectorAll('.nav-link[data-target]')).some(link => {
      const target = link.getAttribute('data-target');
      return allowed.has(target);
    });
    if (!hasAllowedChild) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }
  });

  document.querySelectorAll('.page-section').forEach(section => {
    const id = section.getAttribute('id');
    if (id && !allowed.has(id)) {
      section.classList.add('d-none');
    }
  });
}
/* ---------------- Utility: page switching + remember last page ---------------- */
function showPage(pageId) {
  if (!isPageAllowed(pageId)) {
    alert('You do not have access to this module.');
    return;
  }
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('d-none'));
  document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById(pageId);
  if (target) target.classList.remove('d-none');

  const matchingLink = document.querySelector(`.sidebar .nav-link[data-target="${pageId}"]`);
  if (matchingLink) matchingLink.classList.add('active');

  localStorage.setItem('lastPage', pageId);

  const topbarEl = document.getElementById('globalTopbar');
  if (topbarEl) {
    if (pageId === 'page-dashboard') {
      topbarEl.classList.remove('d-none');
    } else {
      topbarEl.classList.add('d-none');
    }
  }

  // Scroll content back to top and FORCE scrollbar on every page switch
  const contentEl = document.querySelector('.content');
  if (contentEl) {
    contentEl.scrollTop = 0;
    // Force overflow scroll via JS (belt-and-suspenders with CSS)
    contentEl.style.overflowY = 'scroll';
    contentEl.style.height = '100vh';
    // Force Chromium to recalculate scrollbar
    void contentEl.offsetHeight;
  }
}


/* ---------------- DOM ready + event wiring ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  // FORCE scrollbar on the content area immediately
  const contentArea = document.querySelector('.content');
  if (contentArea) {
    contentArea.style.overflowY = 'scroll';
    contentArea.style.height = '100vh';
  }

  const sessionInfo = initializeAccessControl();
  if (!sessionInfo) return;
  applyAccessRestrictions();
  updateSessionSummary();
  buildModuleSearchIndex();
  setupModuleSearch();

  // Dashboard date filters
  const fromInput = document.getElementById('fromDate');
  const toInput = document.getElementById('toDate');
  const applyBtn = document.getElementById('applyFilterBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const from = fromInput?.value || '';
      const to = toInput?.value || '';
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      fetchAndRender(params);
    });
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', fetchAndRender);

  // Reject modal confirm button handler
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');
  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReasonInput')?.value?.trim();
      if (!reason) {
        alert('Please enter a rejection reason.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/controlled-invoices/${currentRejectId}/reject`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approver: 'Manager', reason })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Reject request failed');
        }

        // hide modal then refresh list
        const modalEl = document.getElementById('rejectReasonModal');
        const modalInst = bootstrap.Modal.getInstance(modalEl);
        if (modalInst) modalInst.hide();

        await loadControlledInvoices();
      } catch (err) {
        console.error('Reject failed', err);
        alert('Reject failed: ' + (err.message || err));
      }
    });


  }
  const pingBtn = document.getElementById('pingBtn');
  if (pingBtn) pingBtn.addEventListener('click', () => alert('App is alive!'));

  const exportCustomersCsvBtn = document.getElementById('exportCustomersCsv');
  if (exportCustomersCsvBtn) exportCustomersCsvBtn.addEventListener('click', exportCustomersCsv);

  const exportBrandsCsvBtn = document.getElementById('exportBrandsCsv');
  if (exportBrandsCsvBtn) exportBrandsCsvBtn.addEventListener('click', exportBrandsCsv);

  const exportLowStocksCsvBtn = document.getElementById('exportLowStocksCsv');
  if (exportLowStocksCsvBtn) exportLowStocksCsvBtn.addEventListener('click', exportLowStocksCsv);

  const exportNearExpiryCsvBtn = document.getElementById('exportNearExpiryCsv');
  if (exportNearExpiryCsvBtn) exportNearExpiryCsvBtn.addEventListener('click', exportNearExpiryCsv);

  const exportApprovalsCsvBtn = document.getElementById('exportApprovalsCsv');
  if (exportApprovalsCsvBtn) exportApprovalsCsvBtn.addEventListener('click', exportApprovalsCsv);

  const exportBookingsCsvBtn = document.getElementById('exportBookingsCsv');
  if (exportBookingsCsvBtn) exportBookingsCsvBtn.addEventListener('click', exportBookingsCsv);

  const exportBookingsPdfBtn = document.getElementById('exportBookingsPdf');
  if (exportBookingsPdfBtn) exportBookingsPdfBtn.addEventListener('click', exportBookingsPdf);

  const exportInvoicesCsvBtn = document.getElementById('exportInvoicesCsv');
  if (exportInvoicesCsvBtn) exportInvoicesCsvBtn.addEventListener('click', exportInvoicesCsv);
  const exportControlledInvoicesCsvBtn = document.getElementById('exportControlledInvoicesCsv');
  if (exportControlledInvoicesCsvBtn) exportControlledInvoicesCsvBtn.addEventListener('click', exportControlledInvoicesCsv);

  const exportSalesReturnsCsvBtn = document.getElementById('exportSalesReturnsCsv');
  if (exportSalesReturnsCsvBtn) exportSalesReturnsCsvBtn.addEventListener('click', exportSalesReturnsCsv);
  const exportCompanyPdfBtn = document.getElementById('btnExportCompanyPDF');
  if (exportCompanyPdfBtn) exportCompanyPdfBtn.addEventListener('click', exportCompanyDetailsPdf);

  const exportPurchaseReportsPdfBtn = document.getElementById('btnExportPurchaseReportsPDF');
  if (exportPurchaseReportsPdfBtn) exportPurchaseReportsPdfBtn.addEventListener('click', exportPurchaseReportsPdf);

  const exportPurchaseReportsCsvBtn = document.getElementById('btnExportPurchaseReportsCSV');
  if (exportPurchaseReportsCsvBtn) exportPurchaseReportsCsvBtn.addEventListener('click', exportPurchaseReportsCsv);
  // 🟨 Navigation links
  document.querySelectorAll('.sidebar .nav-link[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');
      if (!targetId) return;

      showPage(targetId);

      if (targetId === 'page-dashboard') {
        fetchAndRender();
      } else if (targetId === 'page-sale-booking') {
        loadBookings();
        loadCompanies(); // Load companies to get products
        resetProductsTable();
        initializeBookingCustomerSearch();
        initializeRouteSelection();
      } else if (targetId === 'page-import-data') {
        loadCustomers();
      } else if (targetId === 'page-generate-invoice') {
        loadInvoices();
        loadBookingsIntoSelect();
      } else if (targetId === 'page-controlled-invoice') {
        loadControlledInvoices();
        loadControlledBookingsIntoSelect(); // ✅ only requiresApproval bookings
      } else if (targetId === 'page-open-invoice') {
        // ✅ NEW: show Open Invoices page
        loadOpenInvoices();
        // optional: populate booking select if you reuse that UI
        loadBookingsIntoSelect();
      } else if (targetId === 'page-sales-returns') {
        loadSalesReturns();
        // Add event listener to Sales Returns modal to reload data on modal show
        const salesReturnModal = document.getElementById('addSalesReturnModal');
        if (salesReturnModal) {
          salesReturnModal.addEventListener('show.bs.modal', () => {
            loadSalesReturns();
          });
        }
      } else if (targetId === 'page-customer-receipt') {
        loadCustomerReceiptInvoices();
        initializeCustomerReceiptForm();
        loadCustomerReceipts();
      } else if (targetId === 'page-stock-adjustment') {
        loadStockAdjustments();
      } else if (targetId === 'page-cheque-conversion') {
        loadBanks();
      } else if (targetId === 'page-chart-of-accounts') {
        loadCOA();
      } else if (targetId === 'page-company') {
        loadCompanies();
        initializeCompanyHandlers();
      } else if (targetId === 'page-pending-orders') {
        loadPurchaseOrders();
      } else if (targetId === 'page-purchase-reports') {
        loadPurchaseReports();
      } else if (targetId === 'page-sales-reports') {
        loadSalesReports();
      }
    });
  });


  // ---------------- Add Customer wiring ----------------
  const addCustomerForm = document.getElementById('addCustomerForm');
  if (addCustomerForm) {
    addCustomerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById('newCustomerName')?.value.trim();
        const route = document.getElementById('newCustomerRoute')?.value.trim();
        const ntn = document.getElementById('newCustomerNTN')?.value.trim();
        const cnic = document.getElementById('newCustomerCNIC')?.value.trim();
        const filerStatus = document.getElementById('newCustomerFilerStatus')?.value || 'Filer';

        if (!name) {
          alert("Customer name is required");
          return;
        }

        const res = await fetch(`${API_BASE}/api/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, route, ntn, cnic, filerStatus })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Failed to save customer');
        }

        await loadCustomers(); // refresh the dropdown immediately

        // hide modal
        const modalEl = document.getElementById('addCustomerModal');
        const modalInst = bootstrap.Modal.getInstance(modalEl);
        if (modalInst) modalInst.hide();

        addCustomerForm.reset();
        alert("Customer added successfully!");
      } catch (err) {
        console.error("Add customer failed", err);
        alert("Failed to add customer: " + err.message);
      }
    });
  }

  // ---------------- Edit Customer wiring ----------------
  const editCustomerForm = document.getElementById('editCustomerForm');
  if (editCustomerForm) {
    editCustomerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('editCustomerId')?.value;
        const name = document.getElementById('editCustomerName')?.value.trim();
        const route = document.getElementById('editCustomerRoute')?.value.trim();
        const ntn = document.getElementById('editCustomerNTN')?.value.trim();
        const cnic = document.getElementById('editCustomerCNIC')?.value.trim();
        const filerStatus = document.getElementById('editCustomerFilerStatus')?.value || 'Filer';

        if (!id || !name) {
          alert("Customer ID and name are required");
          return;
        }

        const res = await fetch(`${API_BASE}/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, route, ntn, cnic, filerStatus })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Failed to update customer');
        }

        await loadCustomers(); // refresh table

        // hide modal
        const modalEl = document.getElementById('editCustomerModal');
        const modalInst = bootstrap.Modal.getInstance(modalEl);
        if (modalInst) modalInst.hide();

        editCustomerForm.reset();
        alert("Customer updated successfully!");
      } catch (err) {
        console.error("Edit customer failed", err);
        alert("Failed to update customer: " + err.message);
      }
    });
  }


  /* ---------------- Sale Booking wiring ---------------- */
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    // Load salesman dropdown (names only)
    (async () => {
      try {
        const sel = document.getElementById('bookingSalesman');
        if (!sel) return;
        const res = await fetch(`${API_BASE}/api/salesman`);
        if (!res.ok) return;
        const list = await res.json();
        const items = Array.isArray(list) ? list : [];
        sel.innerHTML = `<option value="">Select Salesman (optional)</option>` + items
          .map(s => `<option value="${s.id}">${escapeHtml(s.name || '')}</option>`)
          .join('');
      } catch (e) {
        console.error('Failed to load salesman list', e);
      }
    })();

    // Customer selection is now handled by initializeBookingCustomerSearch()
    // which auto-fills tax info when a customer is selected from search results

    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get selected customers - either from search or route checkboxes
      const customerIdInput = document.getElementById('customer');
      const customerNameInput = document.getElementById('customerName');
      const searchCustomerId = customerIdInput?.value || null;
      const searchCustomerName = customerNameInput?.value || '';

      // Get customers selected from route checkboxes
      const selectedRouteCustomers = [];
      document.querySelectorAll('.customer-route-checkbox:checked').forEach(checkbox => {
        selectedRouteCustomers.push({
          id: checkbox.getAttribute('data-customer-id'),
          name: checkbox.getAttribute('data-customer-name'),
          route: checkbox.getAttribute('data-customer-route'),
          ntn: checkbox.getAttribute('data-customer-ntn') || '',
          cnic: checkbox.getAttribute('data-customer-cnic') || '',
          filerStatus: checkbox.getAttribute('data-customer-filer') || ''
        });
      });

      // Determine which customer(s) to use
      let customersToBook = [];
      if (selectedRouteCustomers.length > 0) {
        // Use route-selected customers
        customersToBook = selectedRouteCustomers;
      } else if (searchCustomerId && searchCustomerName) {
        // Use search-selected customer
        customersToBook = [{ id: searchCustomerId, name: searchCustomerName, route: '' }];
      } else {
        alert('Please select a customer either by searching or by selecting a route and customer');
        return;
      }

      // Get products (include expiry so it appears correctly in invoice PDFs)
      const products = [];
      document.querySelectorAll('#productsTable tr').forEach(row => {
        const p = {
          product: row.querySelector('.product')?.value || '',
          group: row.querySelector('.group')?.value || '',
          batch: row.querySelector('.batch')?.value || '',
          expiry: row.querySelector('.expiry')?.value || '',
          qty: Number(row.querySelector('.qty')?.value || 0),
          bonus: Number(row.querySelector('.bonus')?.value || 0),
          price: Number(row.querySelector('.price')?.value || 0),
          discount: Number(row.querySelector('.discount')?.value || 0),
          total: Number(row.querySelector('.total')?.textContent || 0)
        };
        if (p.product) products.push(p);
      });

      if (products.length === 0) {
        alert('Please add at least one product');
        return;
      }

      // Create bookings for each selected customer
      const routeValue = document.getElementById('route')?.value || '';
      const bookingDate = document.getElementById('bookingDate')?.value || new Date().toISOString().split('T')[0];
      const requiresApproval = document.getElementById('requiresApproval')?.checked || false;
      const ntn = document.getElementById('customerNTN')?.value?.trim() || '';
      const cnic = document.getElementById('customerCNIC')?.value?.trim() || '';
      const filerStatus = document.getElementById('customerFilerStatus')?.value || '';
      const salesmanId = document.getElementById('bookingSalesman')?.value || '';

      try {
        // Create booking for each customer
        for (const customer of customersToBook) {
          // Use customer's own tax info if available, otherwise use form values
          const booking = {
            customerId: customer.id,
            customer: customer.name,
            route: customer.route || routeValue,
            date: bookingDate,
            products,
            total: products.reduce((s, p) => s + (p.total || 0), 0),
            status: "Pending",
            requiresApproval: requiresApproval,
            ntn: customer.ntn || ntn,
            cnic: customer.cnic || cnic,
            filerStatus: customer.filerStatus || filerStatus || 'Filer',
            salesmanId: salesmanId ? Number(salesmanId) : null
          };

          await fetch(`${API_BASE}/api/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(booking)
          });
        }

        loadBookings();
        bookingForm.reset();
        resetProductsTable();

        // Clear customer search
        const searchInput = document.getElementById('customerSearchBooking');
        if (searchInput) searchInput.value = '';
        if (customerIdInput) customerIdInput.value = '';
        if (customerNameInput) customerNameInput.value = '';

        // Clear route selections
        document.querySelectorAll('.route-checkbox, .subarea-checkbox, .customer-route-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('routeDropdownBtn').textContent = 'Select Route(s)';
        document.getElementById('routeCustomerSelection').style.display = 'none';

        alert(`Successfully created ${customersToBook.length} booking(s)`);
      } catch (err) {
        console.error('Booking save failed', err);
        alert('Booking save failed: ' + err.message);
      }
    });
  }

  const addProductRowBtn = document.getElementById('addProductRow');
  if (addProductRowBtn) addProductRowBtn.addEventListener('click', addProductRow);

  /* ---------------- Invoice form wiring ---------------- */
  const invoiceForm = document.getElementById('invoiceForm');
  if (invoiceForm) {
    invoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const bookingSelect = document.getElementById('bookingSelect');
        const bookingIds = bookingSelect ? Array.from(bookingSelect.selectedOptions).map(o => Number(o.value)) : [];
        const invoicePayload = {
          bookingIds,
          date: document.getElementById('invoiceDate')?.value || new Date().toISOString().split('T')[0],
          taxGroup: document.getElementById('taxGroup')?.value || '',
          options: {
            withholdingTax: !!document.getElementById('withholdingTax')?.checked,
            generateChallan: !!document.getElementById('generateChallan')?.checked,
            generatePacking: !!document.getElementById('generatePacking')?.checked
          }
        };

        const res = await fetch(`${API_BASE}/api/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoicePayload)
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Failed to save invoice');
        }

        await loadInvoices();
        invoiceForm.reset();
      } catch (err) {
        console.error('Invoice save failed:', err);
        alert('Invoice save failed: ' + (err.message || err));
      }
    });
  }

  /* ---------------- Controlled Invoice form wiring ---------------- */
  const controlledInvoiceForm = document.getElementById('controlledInvoiceForm');
  if (controlledInvoiceForm) {
    controlledInvoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const bookingSelect = document.getElementById('controlledBookingSelect');
        const bookingIds = bookingSelect ? Array.from(bookingSelect.selectedOptions).map(o => Number(o.value)) : [];
        const reason = document.getElementById('reasonCode')?.value || '';
        if (!bookingIds.length) return alert('Select at least one booking');
        if (!reason) return alert('Select a reason code');

        const payload = { bookingIds, reason, createdAt: new Date().toISOString(), status: 'Pending', logs: [{ action: 'Created', when: new Date().toISOString() }] };

        const res = await fetch(`${API_BASE}/api/controlled-invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to create controlled invoice');
        await loadControlledInvoices();
        controlledInvoiceForm.reset();
        alert('Controlled invoice submitted for approval');
      } catch (err) {
        console.error('Controlled invoice submit failed', err);
        alert('Submit failed: ' + err.message);
      }
    });
  }

  /* ---------------- Restore last page after refresh ---------------- */
  const storedLastPage = localStorage.getItem('lastPage');
  if (storedLastPage && (!document.getElementById(storedLastPage) || !isPageAllowed(storedLastPage))) {
    localStorage.removeItem('lastPage');
  }
  let initialPage = null;

  if (storedLastPage && document.getElementById(storedLastPage) && isPageAllowed(storedLastPage)) {
    initialPage = storedLastPage;
  }

  if (!initialPage && orderedModulePageIds.length) {
    const firstAllowed = orderedModulePageIds.find(pageId => document.getElementById(pageId));
    if (firstAllowed && isPageAllowed(firstAllowed)) {
      initialPage = firstAllowed;
    }
  }

  if (!initialPage || !document.getElementById(initialPage)) {
    initialPage = 'page-dashboard';
  }

  if (!isPageAllowed(initialPage)) {
    initialPage = 'page-dashboard';
  }

  showPage(initialPage);

  if (initialPage === 'page-dashboard') {
    fetchAndRender();
  } else if (initialPage === 'page-company') {
    loadCompanies();
    initializeCompanyHandlers();
  } else if (initialPage === 'page-sale-booking') {
    loadBookings();
    loadCompanies();
    resetProductsTable();
    initializeBookingCustomerSearch();
    initializeRouteSelection();
  } else if (initialPage === 'page-import-data') {
    loadCustomers();
  } else if (initialPage === 'page-generate-invoice') {
    loadInvoices();
    loadBookingsIntoSelect();
  } else if (initialPage === 'page-controlled-invoice') {
    loadControlledInvoices();
    loadControlledBookingsIntoSelect();
  } else if (initialPage === 'page-open-invoice') {
    loadOpenInvoices();
    loadBookingsIntoSelect();
  } else if (initialPage === 'page-sales-return') {
    loadSalesReturns();
  } else if (initialPage === 'page-customer-receipt') {
    loadCustomerReceiptInvoices();
    initializeCustomerReceiptForm();
    loadCustomerReceipts();
  } else if (initialPage === 'page-pending-orders') {
    loadPurchaseOrders();
  } else if (initialPage === 'page-purchase-reports') {
    loadPurchaseReports();
  } else if (initialPage === 'page-spos-reports') {
    loadSposReports();
  } else if (initialPage === 'page-stock-adjustment') {
    loadStockAdjustments(); // ✅ fixed: ensures stock data loads on refresh
  } else if (initialPage === 'page-cheque-conversion') {
    loadBanks();            // ✅ Banks module (replaced Cheque Conversion)
  } else if (initialPage === 'page-chart-of-accounts') {
    loadCOA();              // ✅ Chart of Accounts
  } else if (initialPage === 'page-salesman-department') {
    loadSalesmen();
  }
  if (initialPage === 'page-delivery-summary') {
    loadDeliverySummary();
  }
  if (initialPage === 'page-summary-collection') {
    loadSummaryCollection();
  }
  if (initialPage === 'page-sales-reports') {
    loadSalesReports();
  }

});


/* ---------------- Sale Booking helpers ---------------- */
function debounce(fn, waitMs) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatISODate(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function ensureProductAutocompleteUI(row) {
  if (!row) return null;
  const productInput = row.querySelector('input.product');
  if (!productInput) return null;

  // Wrap the product input so we can absolutely-position the results list.
  if (!productInput.parentElement?.classList.contains('product-autocomplete')) {
    const td = productInput.closest('td');
    if (td) {
      td.style.position = 'relative';
      const wrap = document.createElement('div');
      wrap.className = 'product-autocomplete';
      wrap.style.position = 'relative';
      td.insertBefore(wrap, productInput);
      wrap.appendChild(productInput);
    }
  }

  const td = productInput.closest('td');
  if (!td) return null;

  let list = td.querySelector('.product-autocomplete-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'product-autocomplete-list list-group';
    list.style.position = 'absolute';
    list.style.left = '0';
    list.style.right = '0';
    list.style.top = '100%';
    list.style.zIndex = '2000';
    list.style.maxHeight = '280px';
    list.style.overflowY = 'auto';
    list.style.display = 'none';
    td.appendChild(list);
  }

  return { productInput, list };
}

async function searchBookingProducts(q) {
  const url = `${API_BASE}/api/companies/products/search-booking?q=${encodeURIComponent(q)}&limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Product search failed');
  const data = await res.json();
  const products = Array.isArray(data?.products) ? data.products : [];
  return products;
}

function bindProductAutocomplete(row) {
  const ui = ensureProductAutocompleteUI(row);
  if (!ui) return;
  const { productInput, list } = ui;

  if (productInput._autocompleteBound) return;
  productInput._autocompleteBound = true;

  const applySelection = (p) => {
    const groupEl = row.querySelector('input.group');
    const batchEl = row.querySelector('input.batch');
    const expiryEl = row.querySelector('input.expiry');
    const priceEl = row.querySelector('input.price');
    const discountEl = row.querySelector('input.discount');

    productInput.value = p.productName || '';
    if (groupEl) groupEl.value = p.group || '';

    const poBatch = p.bestPO?.batch || '';
    const poExpiry = p.bestPO?.expiryDate || '';
    if (batchEl) batchEl.value = poBatch || p.batch || batchEl.value || '';
    if (expiryEl) expiryEl.value = formatISODate(poExpiry || p.expiryDate) || expiryEl.value || '';

    if (priceEl) priceEl.value = Number(p.tradePrice || 0);
    if (discountEl) discountEl.value = Number(p.discountCustomer || 0);

    list.style.display = 'none';
    list.innerHTML = '';
    saveProductsTable();

    // Trigger recalculation by dispatching an input event on price/discount.
    try { priceEl?.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    try { discountEl?.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  };

  const hideList = () => {
    list.style.display = 'none';
    list.innerHTML = '';
  };

  const doSearch = debounce(async () => {
    const q = String(productInput.value || '').trim();
    if (q.length < 2) {
      hideList();
      return;
    }

    // Show a lightweight loading state
    list.style.display = 'block';
    list.innerHTML = `<div class="list-group-item text-muted small">Searching…</div>`;

    try {
      const results = await searchBookingProducts(q);
      if (!results.length) {
        list.innerHTML = `<div class="list-group-item text-muted small">No matches</div>`;
        return;
      }

      list.innerHTML = results.map(p => {
        const name = escapeHtml(p.productName || '');
        const vendor = escapeHtml(p.vendorName || '');
        const price = Number(p.tradePrice || 0).toFixed(2);
        const batch = escapeHtml(p.bestPO?.batch || p.batch || '-');
        const exp = formatISODate(p.bestPO?.expiryDate || p.expiryDate) || '';

        const metaParts = [
          vendor ? `Vendor: ${vendor}` : null,
          `Price: ${price}`,
          batch ? `Batch: ${batch}` : null,
          exp ? `Exp: ${escapeHtml(exp)}` : null
        ].filter(Boolean);

        return `
          <button type="button" class="list-group-item list-group-item-action py-2 product-suggestion"
            data-product-id="${escapeHtml(p.productId || '')}">
            <div class="fw-semibold">${name}</div>
            <div class="text-muted small">${metaParts.join(' | ')}</div>
          </button>
        `;
      }).join('');

      // Bind click handlers (event delegation)
      list.querySelectorAll('.product-suggestion').forEach((btn, idx) => {
        btn.addEventListener('mousedown', (e) => {
          // Prevent blur hiding before selection
          e.preventDefault();
          applySelection(results[idx]);
        });
      });
    } catch (err) {
      console.error('Product search error', err);
      list.innerHTML = `<div class="list-group-item text-danger small">Search failed</div>`;
    }
  }, 250);

  productInput.addEventListener('input', () => {
    doSearch();
    saveProductsTable();
  });

  productInput.addEventListener('focus', () => {
    // If user focuses and already typed enough, show suggestions again
    const q = String(productInput.value || '').trim();
    if (q.length >= 2) doSearch();
  });

  productInput.addEventListener('blur', () => {
    // Slight delay so click selection works
    setTimeout(() => hideList(), 150);
  });
}

function saveProductsTable() {
  const table = document.getElementById('productsTable');
  if (!table) return;
  const rows = [];
  table.querySelectorAll('tr').forEach(row => {
    const product = row.querySelector('.product')?.value || '';
    const group = row.querySelector('.group')?.value || '';
    const batch = row.querySelector('.batch')?.value || '';
    const expiry = row.querySelector('.expiry')?.value || '';
    const qty = row.querySelector('.qty')?.value || '';
    const bonus = row.querySelector('.bonus')?.value || '';
    const price = row.querySelector('.price')?.value || '';
    const discount = row.querySelector('.discount')?.value || '';
    if (product || batch || qty || price) { // only save non-empty rows
      rows.push({ product, group, batch, expiry, qty, bonus, price, discount });
    }
  });
  localStorage.setItem('productsTable', JSON.stringify(rows));
}

function loadProductsTable() {
  const data = localStorage.getItem('productsTable');
  if (!data) return;
  const rows = JSON.parse(data);
  const table = document.getElementById('productsTable');
  if (!table) return;
  table.innerHTML = '';
  rows.forEach(rowData => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="form-control product" value="${rowData.product}"></td>
      <td><input class="form-control group" value="${rowData.group || ''}" placeholder="Group" readonly></td>
      <td><input class="form-control batch" value="${rowData.batch}"></td>
      <td><input type="date" class="form-control expiry" value="${rowData.expiry}"></td>
      <td><input type="number" class="form-control qty" value="${rowData.qty}" min="1"></td>
      <td><input type="number" class="form-control bonus" value="${rowData.bonus || 0}" min="0"></td>
      <td><input type="number" class="form-control price" value="${rowData.price}" min="0" step="0.01"></td>
      <td><input type="number" class="form-control discount" value="${rowData.discount}" min="0" max="100" step="0.01"></td>
      <td class="total">0</td>
      <td><button type="button" class="btn btn-sm btn-danger removeRow">x</button></td>
    `;
    table.appendChild(row);

    const recalc = () => {
      const qty = Number(row.querySelector('.qty')?.value || 0);
      const price = Number(row.querySelector('.price')?.value || 0);
      const discount = Number(row.querySelector('.discount')?.value || 0);
      const total = qty * price * (1 - discount / 100);
      row.querySelector('.total').textContent = total.toFixed(2);
    };

    row.querySelectorAll('.qty, .price, .discount').forEach(inp => inp.addEventListener('input', recalc));
    const removeBtn = row.querySelector('.removeRow');
    if (removeBtn) removeBtn.addEventListener('click', () => { row.remove(); saveProductsTable(); });

    recalc();
    bindProductAutocomplete(row);
  });
  // If no rows loaded, add one empty
  if (rows.length === 0) addProductRow();
}

function addProductRow() {
  const table = document.getElementById('productsTable');
  if (!table) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input class="form-control product" placeholder="Product"></td>
    <td><input class="form-control group" placeholder="Group" readonly></td>
    <td><input class="form-control batch" placeholder="Batch"></td>
    <td><input type="date" class="form-control expiry" placeholder="Expiry Date"></td>
    <td><input type="number" class="form-control qty" value="1" min="1"></td>
    <td><input type="number" class="form-control bonus" value="0" min="0"></td>
    <td><input type="number" class="form-control price" value="0" min="0" step="0.01"></td>
    <td><input type="number" class="form-control discount" value="0" min="0" max="100" step="0.01"></td>
    <td class="total">0</td>
    <td><button type="button" class="btn btn-sm btn-danger removeRow">x</button></td>
  `;
  table.appendChild(row);

  const recalc = () => {
    const qty = Number(row.querySelector('.qty')?.value || 0);
    const price = Number(row.querySelector('.price')?.value || 0);
    const discount = Number(row.querySelector('.discount')?.value || 0);
    const total = qty * price * (1 - discount / 100);
    row.querySelector('.total').textContent = total.toFixed(2);
  };

  row.querySelectorAll('.qty, .price, .discount').forEach(inp => inp.addEventListener('input', recalc));
  const removeBtn = row.querySelector('.removeRow');
  if (removeBtn) removeBtn.addEventListener('click', () => { row.remove(); saveProductsTable(); });

  recalc();
  saveProductsTable();
  bindProductAutocomplete(row);
}

function resetProductsTable() {
  const table = document.getElementById('productsTable');
  if (!table) return;
  table.innerHTML = '';
  addProductRow();
}

/* ---------------- Dashboard logic ---------------- */
async function fetchAndRender(params) {
  try {
    let url = `${API_BASE}/api/dashboard`;
    if (params && (params.from || params.to)) {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      url += `?${q.toString()}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();

    renderCards(data.cards);
    renderGeneratedAt(data.generatedAt);
    renderTopLists(data.topCustomers, data.topBrands);
    renderDetailLists(data.lists);

    if (document.getElementById('monthlyChart')) renderMonthlyChart(data.monthly.labels, data.monthly.values);
    if (document.getElementById('weeklyChart')) renderWeeklyChart(data.weekly.labels, data.weekly.values);
  } catch (err) {
    console.error(err);
    // do not spam alert on SPA load; log only
    // alert('Could not load dashboard: ' + err.message);
  }
}

function formatNumber(n) {
  try { return Number(n).toLocaleString('en-US'); } catch (e) { return n; }
}

function renderCards(cards = {}) {
  const safeSet = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = formatNumber(value ?? 0); };
  safeSet('todaySales', cards.todaySales);
  safeSet('totalSales', cards.totalSales);
  safeSet('openInvoices', cards.openInvoices);
  safeSet('receivables', cards.receivables);
  safeSet('bookingsToday', cards.bookingsToday);
  safeSet('lowStocks', cards.lowStocks);
  safeSet('nearExpiry', cards.nearExpiry);
  safeSet('pendingApprovals', cards.pendingApprovals);
}

function renderGeneratedAt(ts) {
  const el = document.getElementById('generatedAt');
  if (el) el.innerText = ts ? new Date(ts).toLocaleString() : '-';
}

function renderTopLists(customers = [], brands = []) {
  const custEl = document.getElementById('topCustomersList');
  const brandsEl = document.getElementById('topBrandsList');
  if (custEl) {
    custEl.innerHTML = '';
    customers.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="d-flex justify-content-between"><span>${c.name}</span><strong>${formatNumber(c.total)}</strong></div>`;
      custEl.appendChild(li);
    });
  }
  if (brandsEl) {
    brandsEl.innerHTML = '';
    brands.forEach(b => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="d-flex justify-content-between"><span>${b.name}</span><strong>${formatNumber(b.total)}</strong></div>`;
      brandsEl.appendChild(li);
    });
  }
}

function renderDetailLists(lists = {}) {
  const lowStocksList = document.getElementById('lowStocksList');
  if (lowStocksList) lowStocksList.innerHTML = (lists.lowStocks || []).map(item => `<li>${item.product} — Stock: ${item.stock}</li>`).join('');

  const nearExpiryList = document.getElementById('nearExpiryList');
  if (nearExpiryList) nearExpiryList.innerHTML = (lists.nearExpiry || []).map(item => `<li>${item.product} — Exp: ${item.expiry}</li>`).join('');

  const pendingApprovalsList = document.getElementById('pendingApprovalsList');
  if (pendingApprovalsList) pendingApprovalsList.innerHTML = (lists.pendingApprovals || []).map(item => `<li>${item.request} (${item.user})</li>`).join('');
}

function renderMonthlyChart(labels = [], values = []) {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Sales', data: values, backgroundColor: labels.map(() => 'rgba(4,121,45,0.7)'), borderRadius: 6, barPercentage: 0.6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
  });
}

function renderWeeklyChart(labels = [], values = []) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Weekly', data: values, fill: false, tension: 0.3, borderColor: '#04792d', pointBackgroundColor: '#04792d', pointRadius: 4, borderWidth: 3 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
  });
}

/* ---------------- CSV / Export helpers ---------------- */
function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCustomersCsv() {
  fetch(`${API_BASE}/api/dashboard`).then(r => r.json()).then(data => {
    const rows = data.topCustomers || [];
    if (!rows.length) return alert('No customer data to export');
    const csv = [['Name', 'Total'], ...rows.map(r => [`"${r.name}"`, r.total])].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'top_customers.csv');
  });
}

function exportBrandsCsv() {
  fetch(`${API_BASE}/api/dashboard`).then(r => r.json()).then(data => {
    const rows = data.topBrands || [];
    if (!rows.length) return alert('No brand data to export');
    const csv = [['Brand', 'Total'], ...rows.map(r => [`"${r.name}"`, r.total])].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'top_brands.csv');
  });
}

function exportLowStocksCsv() {
  fetch(`${API_BASE}/api/dashboard`).then(r => r.json()).then(data => {
    const rows = data.lists?.lowStocks || [];
    if (!rows.length) return alert('No low stock data to export');
    const csv = [['Product', 'Stock'], ...rows.map(r => [`"${r.product}"`, r.stock])].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'low_stocks.csv');
  });
}

function exportNearExpiryCsv() {
  fetch(`${API_BASE}/api/dashboard`).then(r => r.json()).then(data => {
    const rows = data.lists?.nearExpiry || [];
    if (!rows.length) return alert('No near expiry data to export');
    const csv = [['Product', 'Expiry'], ...rows.map(r => [`"${r.product}"`, r.expiry])].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'near_expiry.csv');
  });
}

function exportApprovalsCsv() {
  fetch(`${API_BASE}/api/dashboard`).then(r => r.json()).then(data => {
    const rows = data.lists?.pendingApprovals || [];
    if (!rows.length) return alert('No approvals data to export');
    const csv = [['Request', 'User'], ...rows.map(r => [`"${r.request}"`, `"${r.user}"`])].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'pending_approvals.csv');
  });
}

async function exportBookingsCsv() {
  const searchEl = document.getElementById('bookingSearchInput');
  const q = searchEl ? String(searchEl.value || '').trim() : '';
  // Fetch up to 10,000 records for the export, preserving search query
  const res = await fetch(`${API_BASE}/api/bookings?limit=10000` + (q ? `&q=${encodeURIComponent(q)}` : ''));
  const data = await res.json();
  const bookings = Array.isArray(data.bookings) ? data.bookings : (Array.isArray(data) ? data : []);
  
  if (!bookings.length) return alert('No booking data to export');
  
  const csv = [['ID', 'Customer', 'Route', 'Date', 'Filer Status', 'Total'],
  ...bookings.map(b => [b.id, `"${b.customer}"`, `"${b.route}"`, b.date, (b.filerStatus || ''), b.total])
  ].map(r => r.join(',')).join('\n');
  
  downloadCsv(csv, 'bookings.csv');
}

async function exportBookingsPdf() {
  const searchEl = document.getElementById('bookingSearchInput');
  const q = searchEl ? String(searchEl.value || '').trim() : '';
  const url = `${API_BASE}/api/bookings/export/pdf` + (q ? `?q=${encodeURIComponent(q)}` : '');
  window.open(url, '_blank');
}

async function downloadBookingPdf(id) {
  const url = `${API_BASE}/api/bookings/export/pdf/${id}`;
  window.open(url, '_blank');
}
async function exportInvoicesCsv() {
  const res = await fetch(`${API_BASE}/api/invoices`);
  const data = await res.json();
  if (!data.length) return alert('No invoices to export');
  const csv = [['ID', 'Customer', 'Date', 'Subtotal', 'Tax', 'Withholding', 'Total', 'Status'],
  ...data.map(i => [i.id, `"${i.customer}"`, i.date, i.subtotal ?? i.total, i.tax ?? 0, i.withholding ?? 0, i.total ?? 0, i.status ?? ''])
  ].map(r => r.join(',')).join('\n');
  downloadCsv(csv, 'invoices.csv');
}
/* ---------------- Bookings / customers / invoices loaders ---------------- */
let cachedCustomers = [];
let cachedBookings = [];

// Pagination state for Bookings
let bookingsPageOffset = 0;
let bookingsTotal = 0;
const BOOKINGS_PAGE_SIZE = 100;

async function loadBookings(resetPage = true) {
  try {
    if (resetPage) bookingsPageOffset = 0;
    
    const searchEl = document.getElementById('bookingSearchInput');
    const q = searchEl ? String(searchEl.value || '').trim() : '';
    const url = `${API_BASE}/api/bookings?limit=${BOOKINGS_PAGE_SIZE}&offset=${bookingsPageOffset}` + (q ? `&q=${encodeURIComponent(q)}` : '');
    
    const res = await fetch(url);
    const data = await res.json();
    
    const bookings = Array.isArray(data.bookings) ? data.bookings : (Array.isArray(data) ? data : []);
    bookingsTotal = data.total != null ? data.total : bookings.length;

    if (resetPage) {
      cachedBookings = bookings;
    } else {
      cachedBookings = [...cachedBookings, ...bookings];
    }

    const tbody = document.getElementById('bookingsList');
    if (tbody) {
      if (!cachedBookings || cachedBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No bookings found</td></tr>';
      } else {
        // Optimization: Build HTML string once to avoid excessive DOM reflows
        tbody.innerHTML = cachedBookings.map(b => `
            <tr>
              <td>${b.id}</td>
              <td>${b.customer}</td>
              <td>${b.route}</td>
              <td>${b.date}</td>
              <td>${b.filerStatus || '-'}</td>
              <td>${Number(b.total || 0).toFixed(2)}</td>
              <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editBooking(${b.id})">Edit</button>
                <button class="btn btn-sm btn-outline-danger me-1" onclick="downloadBookingPdf(${b.id})" title="Download PDF">PDF</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBooking(${b.id})">Delete</button>
              </td>
            </tr>
          `).join('');
      }
    }
    
    renderBookingsLoadMore();

    // Wire search input for bookings list page
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        clearTimeout(searchEl._searchTimeout);
        searchEl._searchTimeout = setTimeout(() => loadBookings(true), 300);
      });
    }

  } catch (err) {
    console.error('Failed to load bookings', err);
    const tbody = document.getElementById('bookingsList');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading bookings</td></tr>';
  }
}

function renderBookingsLoadMore() {
  const container = document.getElementById('bookingsListContainer');
  if (!container) return;
  let btn = document.getElementById('bookingsLoadMoreBtn');
  const hasMore = cachedBookings.length < bookingsTotal;
  
  if (hasMore && cachedBookings.length > 0) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'bookingsLoadMoreBtn';
      btn.className = 'btn btn-outline-success mt-3';
      btn.textContent = 'Load more';
      btn.onclick = () => { bookingsPageOffset = cachedBookings.length; loadBookings(false); };
      container.appendChild(btn);
    }
    btn.style.display = 'block';
    btn.textContent = `Load more (${cachedBookings.length} of ${bookingsTotal})`;
  } else if (btn) {
    btn.style.display = 'none';
  }
}

async function editBooking(id) {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    const bookings = await res.json();
    const booking = bookings.find(b => b.id === id);

    if (!booking) {
      alert('Booking not found');
      return;
    }

    // Populate edit form
    document.getElementById('editBookingId').value = booking.id;
    document.getElementById('editBookingCustomer').value = booking.customer || '';
    document.getElementById('editBookingRoute').value = booking.route || '';
    document.getElementById('editBookingDate').value = booking.date || '';
    document.getElementById('editBookingNTN').value = booking.ntn || '';
    document.getElementById('editBookingCNIC').value = booking.cnic || '';
    document.getElementById('editBookingFilerStatus').value = booking.filerStatus || '';
    document.getElementById('editBookingRequiresApproval').checked = booking.requiresApproval || false;

    // Populate products table
    const productsTable = document.getElementById('editBookingProductsTable');
    productsTable.innerHTML = '';
    if (booking.products && booking.products.length > 0) {
      booking.products.forEach((product) => {
        const row = productsTable.insertRow();
        row.innerHTML = `
          <td><input type="text" class="form-control form-control-sm edit-product" value="${product.product || ''}"></td>
          <td><input type="text" class="form-control form-control-sm edit-batch" value="${product.batch || ''}"></td>
          <td><input type="date" class="form-control form-control-sm edit-expiry" value="${product.expiry || ''}"></td>
          <td><input type="number" class="form-control form-control-sm edit-qty" value="${product.qty || 0}" onchange="calculateEditProductTotal(this)"></td>
          <td><input type="number" class="form-control form-control-sm edit-bonus" value="${product.bonus || 0}"></td>
          <td><input type="number" class="form-control form-control-sm edit-price" value="${product.price || 0}" onchange="calculateEditProductTotal(this)"></td>
          <td><input type="number" class="form-control form-control-sm edit-discount" value="${product.discount || 0}" onchange="calculateEditProductTotal(this)"></td>
          <td><span class="edit-total">${Number(product.total || 0).toFixed(2)}</span></td>
          <td><button type="button" class="btn btn-sm btn-danger" onclick="removeEditProductRow(this)">Remove</button></td>
        `;
      });
    }

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editBookingModal'));
    modal.show();
  } catch (err) {
    console.error('Failed to load booking for edit', err);
    alert('Failed to load booking: ' + err.message);
  }
}

function addEditProductRow() {
  const table = document.getElementById('editBookingProductsTable');
  const row = table.insertRow();
  row.innerHTML = `
    <td><input type="text" class="form-control form-control-sm edit-product"></td>
    <td><input type="text" class="form-control form-control-sm edit-batch"></td>
    <td><input type="date" class="form-control form-control-sm edit-expiry"></td>
    <td><input type="number" class="form-control form-control-sm edit-qty" value="0" onchange="calculateEditProductTotal(this)"></td>
    <td><input type="number" class="form-control form-control-sm edit-bonus" value="0"></td>
    <td><input type="number" class="form-control form-control-sm edit-price" value="0" onchange="calculateEditProductTotal(this)"></td>
    <td><input type="number" class="form-control form-control-sm edit-discount" value="0" onchange="calculateEditProductTotal(this)"></td>
    <td><span class="edit-total">0.00</span></td>
    <td><button type="button" class="btn btn-sm btn-danger" onclick="removeEditProductRow(this)">Remove</button></td>
  `;
}

function removeEditProductRow(btn) {
  btn.closest('tr').remove();
}

function calculateEditProductTotal(input) {
  const row = input.closest('tr');
  const qty = Number(row.querySelector('.edit-qty').value || 0);
  const price = Number(row.querySelector('.edit-price').value || 0);
  const discount = Number(row.querySelector('.edit-discount').value || 0);
  const subtotal = qty * price;
  const total = subtotal - (subtotal * discount / 100);
  row.querySelector('.edit-total').textContent = total.toFixed(2);
}

async function saveEditBooking() {
  try {
    const bookingId = document.getElementById('editBookingId').value;
    if (!bookingId) {
      alert('Booking ID is missing');
      return;
    }

    // Collect products
    const products = [];
    document.querySelectorAll('#editBookingProductsTable tr').forEach(row => {
      const product = row.querySelector('.edit-product')?.value || '';
      if (product) {
        const qty = Number(row.querySelector('.edit-qty')?.value || 0);
        const price = Number(row.querySelector('.edit-price')?.value || 0);
        const discount = Number(row.querySelector('.edit-discount')?.value || 0);
        const total = (qty * price) - ((qty * price) * discount / 100);
        products.push({
          product,
          batch: row.querySelector('.edit-batch')?.value || '',
          expiry: row.querySelector('.edit-expiry')?.value || '',
          qty,
          bonus: Number(row.querySelector('.edit-bonus')?.value || 0),
          price,
          discount,
          total
        });
      }
    });

    if (products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    const booking = {
      customer: document.getElementById('editBookingCustomer').value,
      route: document.getElementById('editBookingRoute').value,
      date: document.getElementById('editBookingDate').value,
      products,
      total: products.reduce((s, p) => s + (p.total || 0), 0),
      status: "Pending",
      requiresApproval: document.getElementById('editBookingRequiresApproval').checked,
      ntn: document.getElementById('editBookingNTN').value.trim(),
      cnic: document.getElementById('editBookingCNIC').value.trim(),
      filerStatus: document.getElementById('editBookingFilerStatus').value
    };

    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Failed to update booking');
    }

    await loadBookings();
    const modal = bootstrap.Modal.getInstance(document.getElementById('editBookingModal'));
    modal.hide();
    alert('Booking updated successfully!');
  } catch (err) {
    console.error('Update booking failed', err);
    alert('Failed to update booking: ' + err.message);
  }
}

// Expose functions globally for inline onclick
window.editBooking = editBooking;
window.downloadBookingPdf = downloadBookingPdf;
window.addEditProductRow = addEditProductRow;
window.removeEditProductRow = removeEditProductRow;
window.calculateEditProductTotal = calculateEditProductTotal;
window.saveEditBooking = saveEditBooking;

// ======================= 10.0) Company Module =======================// Cached data
let cachedCompanies = [];
let cachedCompanyProducts = [];
let cachedPurchaseOrders = []; // Cache for POs to link Batch/Expiry

// Load all companies
async function loadCompanies() {
  try {
    const res = await fetch(`${API_BASE}/api/companies`);
    const companies = await res.json();
    cachedCompanies = Array.isArray(companies) ? companies : [];

    // Load POs for Batch/Expiry linking
    try {
      await loadCachedPurchaseOrders();
    } catch (e) { console.error('Error loading POs for companies link', e); }

    // Build products cache for Sale Booking
    cachedCompanyProducts = [];
    cachedCompanies.forEach(company => {
      if (company.products && Array.isArray(company.products)) {
        company.products.forEach(product => {
          cachedCompanyProducts.push({
            ...product,
            vendorName: company.name,
            companyId: company.id
          });
        });
      }
    });

    renderCompaniesTable(cachedCompanies);

    // Wire search box for companies
    const searchEl = document.getElementById('companySearch');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        const q = String(searchEl.value || '').trim().toLowerCase();
        if (!q) {
          renderCompaniesTable(cachedCompanies);
          return;
        }
        const filtered = cachedCompanies.filter(c => {
          const name = String(c.name || '').toLowerCase();
          const addr = String(c.address || '').toLowerCase();
          const mgr = String(c.manager || '').toLowerCase();
          return name.includes(q) || addr.includes(q) || mgr.includes(q);
        });
        renderCompaniesTable(filtered);
      });
    }
  } catch (err) {
    console.error('Failed to load companies', err);
  }
}

// Render companies table
function renderCompaniesTable(companies) {
  const tbody = document.getElementById('companyBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  companies.forEach(company => {
    tbody.innerHTML += `
      <tr>
        <td>${company.id}</td>
        <td>${company.name}</td>
        <td>${company.address || '-'}</td>
        <td>${company.manager || '-'}</td>
        <td>${company.products ? company.products.length : 0}</td>
        <td>
          <button class="btn btn-sm btn-primary me-1" onclick="editCompany(${company.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCompany(${company.id})">Delete</button>
        </td>
      </tr>
    `;
  });
}

// Add product row in company form
function addCompanyProductRow() {
  const tbody = document.getElementById('companyProductsBody');
  if (!tbody) return;

  const row = tbody.insertRow();
  row.innerHTML = `
    <td><input type="text" class="form-control form-control-sm" name="productName" required></td>
    <td><input type="text" class="form-control form-control-sm" name="productType"></td>
    <td><input type="text" class="form-control form-control-sm" name="productId" placeholder="Auto-generated" readonly></td>
    <td><input type="text" class="form-control form-control-sm" name="group" placeholder="e.g. Group A"></td>
    <td><input type="number" class="form-control form-control-sm" name="tradePrice" value="0" step="0.01"></td>
    <td><input type="number" class="form-control form-control-sm" name="salesTax" value="0" step="0.01"></td>
    <td><input type="number" class="form-control form-control-sm" name="purchaseDiscount" value="0" step="0.01"></td>
    <td><button type="button" class="btn btn-sm btn-danger" onclick="removeCompanyProductRow(this)">Remove</button></td>
  `;
}

// Remove product row
function removeCompanyProductRow(btn) {
  btn.closest('tr').remove();
}

// Edit company
async function editCompany(id) {
  try {
    const res = await fetch(`${API_BASE}/api/companies/${id}`);
    const company = await res.json();

    document.getElementById('companyId').value = company.id;
    document.getElementById('companyName').value = company.name || '';
    document.getElementById('companyAddress').value = company.address || '';
    document.getElementById('companyPolicies').value = company.policies || '';
    document.getElementById('companyManager').value = company.manager || '';
    document.getElementById('companySPOs').value = company.spos || '';
    document.getElementById('companyAreas').value = company.areas || '';

    // Populate products
    const tbody = document.getElementById('companyProductsBody');
    tbody.innerHTML = '';
    if (company.products && company.products.length > 0) {
      company.products.forEach(product => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td><input type="text" class="form-control form-control-sm" name="productName" value="${product.productName || ''}" required></td>
          <td><input type="text" class="form-control form-control-sm" name="productType" value="${product.productType || ''}"></td>
          <td><input type="text" class="form-control form-control-sm" name="productId" value="${product.productId || ''}" readonly></td>
          <td><input type="text" class="form-control form-control-sm" name="group" value="${product.group || ''}" placeholder="e.g. Group A"></td>
          <td><input type="number" class="form-control form-control-sm" name="tradePrice" value="${product.tradePrice || 0}" step="0.01"></td>
          <td><input type="number" class="form-control form-control-sm" name="salesTax" value="${product.salesTax || 0}" step="0.01"></td>
          <td><input type="number" class="form-control form-control-sm" name="purchaseDiscount" value="${product.purchaseDiscount || product.discountForUs || 0}" step="0.01"></td>
          <td><button type="button" class="btn btn-sm btn-danger" onclick="removeCompanyProductRow(this)">Remove</button></td>
        `;
      });
    }

    document.getElementById('companyAddCard').style.display = 'block';
    document.getElementById('companyAddCard').querySelector('.card-header').textContent = 'Edit Company';
    document.getElementById('companyAddCard').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Failed to load company', err);
    alert('Failed to load company: ' + err.message);
  }
}

// Delete company
async function deleteCompany(id) {
  if (!confirm('Are you sure you want to delete this company?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/companies/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete company');
    await loadCompanies();
    alert('Company deleted successfully!');
  } catch (err) {
    console.error('Delete company failed', err);
  }
}

// Load POs for caching
async function loadCachedPurchaseOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders`);
    cachedPurchaseOrders = await res.json();
    if (!Array.isArray(cachedPurchaseOrders)) cachedPurchaseOrders = [];
    console.log('📦 Loaded Purchase Orders:', cachedPurchaseOrders.length);
  } catch (err) {
    console.error('Failed to load POs', err);
    cachedPurchaseOrders = [];
  }
}

// For 10.5 Purchase Reports: show 300 records per page
const PURCHASE_REPORTS_PAGE_SIZE = 300;
let purchaseReportsOffset = 0;
let cachedPurchaseReports = [];
let purchaseReportsTotal = 0;

function renderPurchaseReportsTable(list) {
  const tbody = document.getElementById('purchaseReportsBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(product => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${product.productId || '-'}</td>
        <td>${product.productName || '-'}</td>
        <td>${product.productType || '-'}</td>
        <td>${product.vendorName || '-'}</td>
        <td>${Number(product.tradePrice || 0).toFixed(2)}</td>
        <td>${Number(product.discountCustomer || 0).toFixed(2)}%</td>
        <td>${Number(product.salesTax || 0).toFixed(2)}%</td>
        <td>${Number(product.discountForUs || 0).toFixed(2)}%</td>
      <td>${product.dateAdded ? new Date(product.dateAdded).toLocaleDateString() : '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editPurchaseProduct('${product.productId || ''}')">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deletePurchaseProduct('${product.productId || ''}')">Delete</button>
      </td>
      </tr>
    `);
  });
}

function renderPurchaseReportsLoadMore() {
  const container = document.getElementById('purchaseReportsListContainer');
  if (!container) return;
  let btn = document.getElementById('purchaseReportsLoadMoreBtn');
  const hasMore = cachedPurchaseReports.length < purchaseReportsTotal;

  // Always create the button once we have any data,
  // so the user can always SEE the control on the page.
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'purchaseReportsLoadMoreBtn';
    btn.className = 'btn btn-outline-primary mt-3';
    btn.onclick = () => {
      // Load the next page
      purchaseReportsOffset = cachedPurchaseReports.length;
      loadPurchaseReports(false);
    };
    container.appendChild(btn);
  }

  // If there is no data, hide the button completely
  if (!cachedPurchaseReports.length) {
    btn.style.display = 'none';
    return;
  }

  // Show the button; enable/disable text depending on whether more data exists
  btn.style.display = 'inline-block';
  if (hasMore) {
    btn.disabled = false;
    btn.textContent = `Load more (${cachedPurchaseReports.length} of ${purchaseReportsTotal})`;
  } else {
    btn.disabled = true;
    btn.textContent = `All ${purchaseReportsTotal} records loaded`;
  }
}

// Load Purchase Reports
async function loadPurchaseReports(resetPage = true) {
  try {
    if (resetPage) purchaseReportsOffset = 0;

    const searchEl = document.getElementById('purchaseReportsSearch');
    const q = searchEl ? String(searchEl.value || '').trim() : '';

    const url = `${API_BASE}/api/companies/products/all?limit=${PURCHASE_REPORTS_PAGE_SIZE}&offset=${purchaseReportsOffset}${q ? '&q=' + encodeURIComponent(q) : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    const products = Array.isArray(data.products) ? data.products : (Array.isArray(data) ? data : []);
    purchaseReportsTotal = data.total != null ? data.total : products.length;

    if (resetPage) {
      cachedPurchaseReports = products;
    } else {
      cachedPurchaseReports = [...cachedPurchaseReports, ...products];
    }

    renderPurchaseReportsTable(cachedPurchaseReports);
    renderPurchaseReportsLoadMore();

    // Wire search input
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        clearTimeout(searchEl._searchTimeout);
        searchEl._searchTimeout = setTimeout(() => loadPurchaseReports(true), 300);
      });
    }

  } catch (err) {
    console.error('Failed to load purchase reports', err);
  }
}



async function deletePurchaseProduct(productId) {
  if (!productId) return;
  if (!confirm('Are you sure you want to delete this product from its company?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/companies/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Failed to delete product');
    }
    await loadPurchaseReports();
    alert('Product deleted successfully from purchase reports.');
  } catch (err) {
    console.error('Delete purchase product failed', err);
    alert('Failed to delete product: ' + err.message);
  }
}

async function editPurchaseProduct(productId) {
  if (!productId) return;
  try {
    const res = await fetch(`${API_BASE}/api/companies/products/${encodeURIComponent(productId)}`);
    if (!res.ok) throw new Error('Failed to load product details');
    const product = await res.json();

    document.getElementById('editPurchaseProductId').value = product.productId || '';
    document.getElementById('editPurchaseVendorName').value = product.vendorName || '';
    document.getElementById('editPurchaseProductName').value = product.productName || '';
    document.getElementById('editPurchaseProductType').value = product.productType || '';
    document.getElementById('editPurchaseTradePrice').value = product.tradePrice ?? '';
    document.getElementById('editPurchaseDiscountCustomer').value = product.discountCustomer ?? '';
    document.getElementById('editPurchaseSalesTax').value = product.salesTax ?? '';
    document.getElementById('editPurchaseDiscountForUs').value = product.discountForUs ?? '';
    document.getElementById('editPurchaseExpiryDate').value = product.expiryDate || '';

    const modalEl = document.getElementById('editPurchaseProductModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const form = document.getElementById('editPurchaseProductForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = {
          productName: document.getElementById('editPurchaseProductName').value,
          productType: document.getElementById('editPurchaseProductType').value,
          tradePrice: Number(document.getElementById('editPurchaseTradePrice').value || 0),
          discountCustomer: Number(document.getElementById('editPurchaseDiscountCustomer').value || 0),
          salesTax: Number(document.getElementById('editPurchaseSalesTax').value || 0),
          discountForUs: Number(document.getElementById('editPurchaseDiscountForUs').value || 0),
          expiryDate: document.getElementById('editPurchaseExpiryDate').value || ''
        };

        const updateRes = await fetch(`${API_BASE}/api/companies/products/${encodeURIComponent(productId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!updateRes.ok) {
          const txt = await updateRes.text();
          throw new Error(txt || 'Failed to update product');
        }
        modal.hide();
        await loadPurchaseReports();
        alert('Product updated successfully.');
      } catch (err) {
        console.error('Update purchase product failed', err);
        alert('Failed to update product: ' + err.message);
      }
    };
  } catch (err) {
    console.error('Load purchase product for edit failed', err);
    alert('Failed to load product: ' + err.message);
  }
}

// Export helpers for Company and Purchase Reports

async function exportPurchaseReportsCsv() {
  try {
    const res = await fetch(`${API_BASE}/api/companies/products/all`);
    const products = await res.json();
    if (!products || !products.length) {
      alert('No purchase report data to export');
      return;
    }

    const header = [
      'Product ID',
      'Product Name',
      'Product Type',
      'Vendor Name',
      'Trade Price',
      'Discount % (Customer)',
      'Sales Tax',
      'Discount for Us',
      'Date Added'
    ];

    const rows = products.map(p => [
      `"${p.productId || ''}"`,
      `"${p.productName || ''}"`,
      `"${p.productType || ''}"`,
      `"${p.vendorName || ''}"`,
      p.tradePrice || 0,
      p.discountCustomer || 0,
      p.salesTax || 0,
      p.discountForUs || 0,
      p.dateAdded || ''
    ]);

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'purchase_reports.csv');
  } catch (err) {
    console.error('Failed to export purchase reports CSV', err);
    alert('Failed to export purchase reports CSV: ' + err.message);
  }
}

async function exportPurchaseReportsPdf() {
  try {
    const res = await fetch(`${API_BASE}/api/companies/products/all`);
    const products = await res.json();
    if (!products || !products.length) {
      alert('No purchase report data to export');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('Popup blocked. Please allow popups for this app to export PDF.');
      return;
    }

    const rowsHtml = products.map(p => `
      <tr>
        <td>${p.productId || ''}</td>
        <td>${p.productName || ''}</td>
        <td>${p.productType || ''}</td>
        <td>${p.vendorName || ''}</td>
        <td>${Number(p.tradePrice || 0).toFixed(2)}</td>
        <td>${Number(p.discountCustomer || 0).toFixed(2)}%</td>
        <td>${Number(p.salesTax || 0).toFixed(2)}%</td>
        <td>${Number(p.discountForUs || 0).toFixed(2)}%</td>
        <td>${p.dateAdded ? new Date(p.dateAdded).toLocaleDateString() : ''}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html>
        <head>
          <title>Purchase Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h2 { color: #04792d; text-align: center; margin-bottom: 8px; }
            .header-logo { text-align: center; margin-bottom: 8px; }
            .header-logo img { max-height: 70px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; }
            th { background: #e6f4ea; }
            .footer { margin-top: 24px; font-size: 9px; color: #555; text-align: center; }
            .warranty { margin-top: 16px; font-size: 8px; color: #444; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header-logo">
            <img src="assets/logo.png" alt="Logo">
          </div>
          <h2>Purchase Reports</h2>
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>Product Type</th>
                <th>Vendor Name</th>
                <th>Trade Price</th>
                <th>Discount % (Customer)</th>
                <th>Sales Tax</th>
                <th>Discount for Us</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <div>Faizan Medicine Company</div>
            <div>House No CB-28, Sikandarabad Supply Mansehra Road (Abbottabad)</div>
            <div>Phone: +92 3028225831 , +92 3127000265</div>
            <div>Email: fezanmc@gmail.com , fezanmc@yahoo.com</div>
            <div>Thank you for your business!</div>
          </div>

          <div class="warranty">
            <strong>Warranty:</strong>
            <p>Form 2A (See Rules (19 & 30)) Warranty Under Section 23(1)(i) Of The Drugs Act, 1976</p>
            <p>I Zeeshan khan Abbasi being a person resident in Pakistan, carrying on business at Janjua Street Supply Abbottabad under the name of FEZAN MEDICINE COMPANY-ABBOTTABAD, do hereby give this warranty that the drugs here above described as sold by me/specified and contained in the bill of sale, invoice, bill of lading or other document describing the goods referred to herein do not contravene in any way the provisions of section 23 of the Drugs Act, 1976.</p>
            <p>Form 11 [See Rule 10(3)] Warranty Under Alternative Medicines & Health Products (Enlistment) Rules, 2014</p>
            <p>It is hereby certified and I Zeshan Khan Abbasi undertake that above mentioned finished products of specified batch number (or lot number) supplied by me do not contravene any provision of DRAP Act, 2012 and rules framed there under.</p>
            <p><strong>NOTE:</strong><br>
            1- For near expiry products we must be informed six months prior to expiry.<br>
            2- Ensure that you have received the stock according to mentioned quantities and values in this invoice.<br>
            3- In case of any discrepancy, breakage & leakage please inform us immediately otherwise we don't accept any responsibility afterward.</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    console.error('Failed to export purchase reports PDF', err);
    alert('Failed to export purchase reports PDF: ' + err.message);
  }
}

// Expose functions globally
window.addCompanyProductRow = addCompanyProductRow;
window.removeCompanyProductRow = removeCompanyProductRow;
window.editCompany = editCompany;
window.deleteCompany = deleteCompany;
window.exportCompanyPdf = exportCompanyDetailsPdf;
window.exportPurchaseReportsCsv = exportPurchaseReportsCsv;
window.exportPurchaseReportsPdf = exportPurchaseReportsPdf;
window.editPurchaseProduct = editPurchaseProduct;
window.deletePurchaseProduct = deletePurchaseProduct;

async function deleteBooking(id) {
  if (!confirm("Are you sure you want to delete this booking?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to delete booking");
    }
    await loadBookings(); // refresh table after deletion
    alert("Booking deleted successfully!");
  } catch (err) {
    console.error("Delete booking failed", err);
    alert("Delete failed: " + err.message);
  }
}



function renderCustomersTable(list) {
  const tbody = document.getElementById('customersList');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.route || '-'}</td>
        <td>${c.status || '-'}</td>
        <td>${c.ntn || '-'}</td>
        <td>${c.cnic || '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary me-1" onclick="openEditCustomer(${c.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">Delete</button>
        </td>
      </tr>
    `;
  });
}

// Pagination state for customers list
let customersPageOffset = 0;
let customersTotal = 0;
const CUSTOMERS_PAGE_SIZE = 100;

async function loadCustomers(resetPage = true) {
  try {
    if (resetPage) customersPageOffset = 0;
    const searchEl = document.getElementById('customerSearch');
    const q = searchEl ? String(searchEl.value || '').trim() : '';
    const url = `${API_BASE}/api/customers?limit=${CUSTOMERS_PAGE_SIZE}&offset=${customersPageOffset}` + (q ? `&q=${encodeURIComponent(q)}` : '');
    const res = await fetch(url);
    const data = await res.json();
    const customers = Array.isArray(data.customers) ? data.customers : (Array.isArray(data) ? data : []);
    customersTotal = data.total != null ? data.total : customers.length;

    if (resetPage) {
      cachedCustomers = customers;
    } else {
      cachedCustomers = [...cachedCustomers, ...customers];
    }

    renderCustomersTable(cachedCustomers);
    renderCustomersLoadMore();

    // Wire search input for customers list page
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        clearTimeout(searchEl._searchTimeout);
        searchEl._searchTimeout = setTimeout(() => loadCustomers(true), 300);
      });
    }

    initializeBookingCustomerSearch();
    setTimeout(() => initializeRouteSelection(), 100);
  } catch (err) {
    console.error('Failed to load customers', err);
  }
}

function renderCustomersLoadMore() {
  const container = document.getElementById('customersListContainer');
  if (!container) return;
  let btn = document.getElementById('customersLoadMoreBtn');
  const hasMore = cachedCustomers.length < customersTotal;
  if (hasMore && cachedCustomers.length > 0) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'customersLoadMoreBtn';
      btn.className = 'btn btn-outline-primary mt-3';
      btn.textContent = 'Load more';
      btn.onclick = () => { customersPageOffset = cachedCustomers.length; loadCustomers(false); };
      container.appendChild(btn);
    }
    btn.style.display = 'block';
    btn.textContent = `Load more (${cachedCustomers.length} of ${customersTotal})`;
  } else if (btn) btn.style.display = 'none';
}

function openEditCustomer(id) {
  const customer = cachedCustomers.find(c => Number(c.id) === Number(id));
  if (!customer) {
    alert('Customer not found');
    return;
  }
  const idEl = document.getElementById('editCustomerId');
  const nameEl = document.getElementById('editCustomerName');
  const routeEl = document.getElementById('editCustomerRoute');
  const ntnEl = document.getElementById('editCustomerNTN');
  const cnicEl = document.getElementById('editCustomerCNIC');
  const filerEl = document.getElementById('editCustomerFilerStatus');

  if (idEl) idEl.value = customer.id;
  if (nameEl) nameEl.value = customer.name || '';
  if (routeEl) routeEl.value = customer.route || '';
  if (ntnEl) ntnEl.value = customer.ntn || '';
  if (cnicEl) cnicEl.value = customer.cnic || '';
  if (filerEl) {
    const val = (customer.filerStatus === 'Filer' || customer.filerStatus === 'Non-Filer') ? customer.filerStatus : 'Filer';
    filerEl.value = val;
  }

  const modalEl = document.getElementById('editCustomerModal');
  if (modalEl) {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

// Initialize customer search for booking form (server-side search - no full list load)
function initializeBookingCustomerSearch() {
  const searchInput = document.getElementById('customerSearchBooking');
  const resultsContainer = document.getElementById('customerSearchResults');
  const customerIdInput = document.getElementById('customer');
  const customerNameInput = document.getElementById('customerName');

  if (!searchInput || !resultsContainer || !customerIdInput || !customerNameInput) {
    return;
  }

  if (searchInput._bound) return;
  searchInput._bound = true;
  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const query = String(e.target.value || '').trim();

    if (!query) {
      resultsContainer.style.display = 'none';
      customerIdInput.value = '';
      customerNameInput.value = '';
      const ntnEl = document.getElementById('customerNTN');
      const cnicEl = document.getElementById('customerCNIC');
      const filerEl = document.getElementById('customerFilerStatus');
      if (ntnEl) ntnEl.value = '';
      if (cnicEl) cnicEl.value = '';
      if (filerEl) filerEl.value = '';
      return;
    }

    if (query.length < 2) {
      resultsContainer.innerHTML = '<div class="p-3 text-muted">Type at least 2 characters</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    clearTimeout(searchTimeout);
    resultsContainer.innerHTML = '<div class="p-3 text-muted">Searching...</div>';
    resultsContainer.style.display = 'block';

    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/customers/search?q=${encodeURIComponent(query)}&limit=50`);
        const filtered = await res.json();
        if (!Array.isArray(filtered)) throw new Error('Invalid response');

        if (filtered.length === 0) {
          resultsContainer.innerHTML = '<div class="p-3 text-muted">No customers found</div>';
        } else {
          resultsContainer.innerHTML = filtered.map(c => `
        <div class="customer-result-item p-2 border-bottom cursor-pointer" 
             data-id="${c.id}" 
             data-name="${c.name || ''}"
             data-ntn="${c.ntn || ''}"
             data-cnic="${c.cnic || ''}"
             data-filer="${c.filerStatus || ''}"
             style="cursor: pointer; transition: background-color 0.2s;"
             onmouseover="this.style.backgroundColor='#f0f0f0'"
             onmouseout="this.style.backgroundColor='white'">
          <div class="fw-bold">${c.name || ''}</div>
          ${c.ntn ? `<small class="text-muted">NTN: ${c.ntn}</small>` : ''}
          ${c.cnic ? `<small class="text-muted ms-2">CNIC: ${c.cnic}</small>` : ''}
        </div>
      `).join('');
        }
        resultsContainer.style.display = 'block';
      } catch (err) {
        console.error('Customer search failed', err);
        resultsContainer.innerHTML = '<div class="p-3 text-danger">Search failed</div>';
      }
    }, 300);
  });

  // Handle customer selection from results
  resultsContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.customer-result-item');
    if (!item) return;

    const customerId = item.getAttribute('data-id');
    const customerName = item.getAttribute('data-name');
    const ntn = item.getAttribute('data-ntn') || '';
    const cnic = item.getAttribute('data-cnic') || '';
    const filer = item.getAttribute('data-filer') || '';

    // Set selected customer
    customerIdInput.value = customerId;
    customerNameInput.value = customerName;
    searchInput.value = customerName; // Show selected customer name in search box
    resultsContainer.style.display = 'none';

    // Auto-fill customer tax info
    const ntnEl = document.getElementById('customerNTN');
    const cnicEl = document.getElementById('customerCNIC');
    const filerEl = document.getElementById('customerFilerStatus');
    if (ntnEl) ntnEl.value = ntn;
    if (cnicEl) cnicEl.value = cnic;
    if (filerEl) {
      const val = filer === 'Filer' || filer === 'Non-Filer' ? filer : '';
      filerEl.value = val;
    }
  });

  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });

  // Handle focus to show results if there's text
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
}

// Initialize route selection and customer filtering dynamically from Regions table
function initializeRouteSelection() {
  const routeDropdownBtn = document.getElementById('routeDropdownBtn');
  if (!routeDropdownBtn) return; // Not on booking page

  // Prevent duplicate initialization
  if (routeDropdownBtn._routeSelectionInitialized) return;
  routeDropdownBtn._routeSelectionInitialized = true;

  const routeDropdownMenu = document.getElementById('routeDropdownMenu');
  const routeInput = document.getElementById('route');
  const routeCustomerSelection = document.getElementById('routeCustomerSelection');
  const customerCheckboxes = document.getElementById('customerCheckboxes');
  const selectedRoutesDisplay = document.getElementById('selectedRoutesDisplay');
  const routeCustomerSearch = document.getElementById('routeCustomerSearch');

  // Fetch regions dynamically and populate the dropdown menu
  fetch(`${API_BASE}/api/regions`)
    .then(r => r.json())
    .then(regions => {
      if (!routeDropdownMenu) return;

      if (!regions || regions.length === 0) {
        routeDropdownMenu.innerHTML = '<li><div class="text-muted text-center small">No regions found</div></li>';
        return;
      }

      // Filter out inactive regions or those without a description
      const activeRegions = regions.filter(r => r.description && r.inactive != 1);
      
      routeDropdownMenu.innerHTML = activeRegions.map(r => `
        <li>
          <div class="form-check">
            <input class="form-check-input route-checkbox" type="checkbox" value="${r.description}"
              id="route-dyn-${r.id}">
            <label class="form-check-label" for="route-dyn-${r.id}">${r.description}</label>
          </div>
        </li>
      `).join('');

      // Re-attach event listeners to the newly created checkboxes
      const newRouteCheckboxes = document.querySelectorAll('.route-checkbox');
      newRouteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          updateSelectedRoutes(newRouteCheckboxes);
          filterCustomersByRoutes(newRouteCheckboxes);
        });
      });
    })
    .catch(err => {
      console.error('Failed to load regions for dropdown:', err);
      if (routeDropdownMenu) {
        routeDropdownMenu.innerHTML = '<li><div class="text-danger text-center small">Failed to load routes</div></li>';
      }
    });

  // Handle Search in Route Customers
  if (routeCustomerSearch) {
    routeCustomerSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const customerDivs = customerCheckboxes.querySelectorAll('.form-check');

      let hasVisible = false;
      customerDivs.forEach(div => {
        const input = div.querySelector('.customer-route-checkbox');
        if (input) {
          const name = (input.getAttribute('data-customer-name') || '').toLowerCase();
          const matches = name.includes(query);
          div.style.display = matches ? 'block' : 'none';
          if (matches) hasVisible = true;
        }
      });

      let noResMsg = document.getElementById('routeCustomerNoResults');
      if (!hasVisible && query) {
        if (!noResMsg) {
          noResMsg = document.createElement('div');
          noResMsg.id = 'routeCustomerNoResults';
          noResMsg.className = 'text-muted text-center mt-2';
          noResMsg.textContent = 'No matching customers found.';
          customerCheckboxes.appendChild(noResMsg);
        }
      } else {
        if (noResMsg) noResMsg.remove();
      }
    });
  }

  function updateSelectedRoutes(checkboxes) {
    const selectedRoutes = [];
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedRoutes.push(cb.value);
      }
    });

    if (selectedRoutes.length > 0) {
      selectedRoutesDisplay.textContent = selectedRoutes.join(', ');
      routeInput.value = selectedRoutes.join(', ');
      if (routeDropdownBtn) {
        routeDropdownBtn.textContent = `${selectedRoutes.length} route(s) selected`;
      }
    } else {
      selectedRoutesDisplay.textContent = 'None';
      routeInput.value = '';
      if (routeDropdownBtn) {
        routeDropdownBtn.textContent = 'Select Route(s)';
      }
    }
  }

  function filterCustomersByRoutes(checkboxes) {
    const selectedRoutes = [];
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedRoutes.push(cb.value);
      }
    });

    if (selectedRoutes.length === 0) {
      routeCustomerSelection.style.display = 'none';
      customerCheckboxes.innerHTML = '';
      return;
    }

    routeCustomerSelection.style.display = 'block';
    customerCheckboxes.innerHTML = '<div class="text-muted">Loading customers...</div>';

    fetch(`${API_BASE}/api/customers/by-route?routes=${encodeURIComponent(selectedRoutes.join(','))}`)
      .then(res => res.json())
      .then(filteredCustomers => {
        if (!Array.isArray(filteredCustomers)) throw new Error('Invalid response');

        if (filteredCustomers.length > 0) {
          routeCustomerSelection.style.display = 'block';
          customerCheckboxes.innerHTML = filteredCustomers.map(customer => `
        <div class="form-check mb-2">
          <input class="form-check-input customer-route-checkbox" type="checkbox" 
                 value="${customer.id}" 
                 data-customer-id="${customer.id}"
                 data-customer-name="${customer.name || ''}"
                 data-customer-route="${customer.route || ''}"
                 data-customer-ntn="${customer.ntn || ''}"
                 data-customer-cnic="${customer.cnic || ''}"
                 data-customer-filer="${customer.filerStatus || ''}"
                 id="customer-${customer.id}">
          <label class="form-check-label" for="customer-${customer.id}">
            ${customer.name || ''} ${customer.route ? `(${customer.route})` : ''}
          </label>
        </div>
      `).join('');

          document.querySelectorAll('.customer-route-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
              const checkedCustomers = document.querySelectorAll('.customer-route-checkbox:checked');
              if (checkedCustomers.length === 1) {
                const ntnEl = document.getElementById('customerNTN');
                const cnicEl = document.getElementById('customerCNIC');
                const filerEl = document.getElementById('customerFilerStatus');
                if (ntnEl) ntnEl.value = e.target.getAttribute('data-customer-ntn') || '';
                if (cnicEl) cnicEl.value = e.target.getAttribute('data-customer-cnic') || '';
                if (filerEl) {
                  const filer = e.target.getAttribute('data-customer-filer') || '';
                  filerEl.value = (filer === 'Filer' || filer === 'Non-Filer') ? filer : '';
                }
              } else if (checkedCustomers.length === 0) {
                const ntnEl = document.getElementById('customerNTN');
                const cnicEl = document.getElementById('customerCNIC');
                const filerEl = document.getElementById('customerFilerStatus');
                if (ntnEl) ntnEl.value = '';
                if (cnicEl) cnicEl.value = '';
                if (filerEl) filerEl.value = '';
              }
            });
          });
        } else {
          customerCheckboxes.innerHTML = '<div class="text-muted">No customers found for selected routes.</div>';
        }
      })
      .catch(err => {
        console.error('Load customers by route failed', err);
        customerCheckboxes.innerHTML = '<div class="text-danger">Failed to load customers</div>';
      });
  }
}



// Delete customer helper
async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await loadCustomers(); // refresh after delete
  } catch (err) {
    console.error('Delete customer failed', err);
    alert('Failed to delete customer: ' + err.message);
  }
}

async function deleteInvoice(id) {
  if (!confirm("Are you sure you want to delete this invoice?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to delete invoice");
    }
    await loadInvoices(); // refresh table after deletion
    alert("Invoice deleted successfully!");
  } catch (err) {
    console.error("Delete invoice failed", err);
    alert("Delete failed: " + err.message);
  }
}


async function loadInvoices() {
  try {
    const res = await fetch(`${API_BASE}/api/invoices`);
    if (!res.ok) throw new Error('Failed to load invoices');
    const invoices = await res.json();
    const tbody = document.getElementById('invoicesList');
    if (!tbody) return;
    tbody.innerHTML = '';
    invoices.forEach(inv => {
      tbody.innerHTML += `
        <tr>
          <td>${inv.id}</td>
          <td>${inv.customer}</td>
          <td>${inv.date}</td>
          <td>${Number(inv.total || 0).toFixed(2)}</td>
          <td>${inv.status}</td>
          <td>
            <button class="btn btn-sm btn-outline-success" onclick="viewInvoicePdf(${inv.id})">PDF</button>
            <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${inv.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Failed to load invoices', err);
  }
}


async function loadBookingsIntoSelect() {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    const bookings = await res.json();
    const select = document.getElementById('bookingSelect') || document.getElementById('controlledBookingSelect');
    if (!select) return;
    select.innerHTML = '';
    bookings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `#${b.id} - ${b.customer} (${Number(b.total || 0).toFixed(2)})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load bookings into select', err);
  }
}

// 🟩 Open Invoice helpers
function showAddOpenInvoiceModal() {
  const el = document.getElementById('addOpenInvoiceModal');
  if (!el) return;
  const modal = new bootstrap.Modal(el);
  modal.show();
}

// Make globally accessible for inline onclick in index.html
window.showAddOpenInvoiceModal = showAddOpenInvoiceModal;


/* ---------------- Open invoices ---------------- */
/* ---------------- Open invoices ---------------- */
async function loadOpenInvoices() {
  try {
    const res = await fetch(`${API_BASE}/api/open-invoices`);
    if (!res.ok) throw new Error('Failed to load open invoices');
    const invoices = await res.json();

    const tbody = document.getElementById('openInvoicesList');
    if (!tbody) return;
    tbody.innerHTML = '';

    invoices.forEach(inv => {
      tbody.innerHTML += `
        <tr>
          <td>${inv.id}</td>
          <td>${inv.customer}</td>
          <td>${inv.customerNTN || '-'}</td>
          <td>${inv.customerCNIC || '-'}</td>
          <td>${inv.date || '-'}</td>
          <td>${inv.payment || '-'}</td>
          <td>
            ${inv.mode === 'Counter'
          ? '<span class="badge bg-info">Counter Sale</span>'
          : '<span class="badge bg-secondary">Standard</span>'
        }
          </td>
          <td><strong class="text-success">${Number(inv.total || 0).toFixed(2)}</strong></td>
          <td>
            ${inv.recurring
          ? '<span class="badge bg-warning">Recurring</span>'
          : inv.status || '-'
        }
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-success me-1" onclick="viewOpenInvoicePdf(${inv.id})">PDF</button>
            <button class="btn btn-sm btn-danger" onclick="deleteOpenInvoice(${inv.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Failed to load open invoices', err);
  }
}

// 🟩 Load Customers for Open Invoice Dropdown
// Only show customers that actually have bookings (Sales & Booking module)
async function loadOpenInvoiceCustomers() {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    if (!res.ok) throw new Error('Failed to load bookings');
    const bookings = await res.json();

    const select = document.getElementById('oiCustomer');
    if (!select) return;

    // Build unique list of customers from bookings
    const uniqueMap = new Map();
    (bookings || []).forEach(b => {
      const id = b.customerId || (b.customer && b.customer.id);
      const name = b.customer || b.customerName;
      if (!id || !name) return;
      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, name);
      }
    });

    select.innerHTML = '<option value="">Select Customer</option>';
    for (const [id, name] of uniqueMap.entries()) {
      select.innerHTML += `<option value="${id}">${name}</option>`;
    }
  } catch (err) {
    console.error('Failed to load Open Invoice customers from bookings', err);
  }
}

// Call this when modal opens
document.getElementById('addOpenInvoiceModal')
  .addEventListener('show.bs.modal', loadOpenInvoiceCustomers);


document.getElementById('addOpenInvoiceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const customer = document.getElementById('oiCustomer').value.trim();
    const paymentType = document.getElementById('oiPayment').value;
    const mode = document.getElementById('oiMode').value;
    const recurring = document.getElementById('oiRecurring')?.checked || false;
    const product = document.getElementById('oiProduct').value.trim();   // ✅ trim
    const qty = Number(document.getElementById('oiQty').value) || 0;     // ✅ number
    const price = Number(document.getElementById('oiPrice').value) || 0; // ✅ number
    const total = qty * price;

    // 🟩 Calculate total properly
    // const products = [{ product, qty, price, total: qty * price }];
    // const total = products.reduce((sum, p) => sum + p.total, 0);

    const invoice = {
      customer,
      payment: paymentType,
      mode,
      recurring,
      products: [{ product, qty, price, total }], // ✅ full product object
      total,
      status: 'Open',
      date: new Date().toISOString().split('T')[0]
    };

    const res = await fetch(`${API_BASE}/api/open-invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice)
    });

    if (!res.ok) throw new Error('Failed to save');
    bootstrap.Modal.getInstance(document.getElementById('addOpenInvoiceModal')).hide();
    loadOpenInvoices();
  } catch (err) {
    console.error('Save open invoice failed', err);
    alert('Save failed: ' + err.message);
  }
});

function viewOpenInvoicePdf(id) {
  window.open(`${API_BASE}/api/open-invoices/${id}/pdf`, '_blank');
}

async function deleteOpenInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/open-invoices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadOpenInvoices();
  } catch (err) {
    console.error('Delete open invoice failed', err);
  }
}


/* ---------------- Controlled invoices ---------------- */
async function loadControlledInvoices() {
  try {
    const [ciRes, bookingsRes] = await Promise.all([
      fetch(`${API_BASE}/api/controlled-invoices`),
      fetch(`${API_BASE}/api/bookings`)
    ]);
    const [controlled, bookings] = await Promise.all([ciRes.json(), bookingsRes.json()]);

    const tbody = document.getElementById('controlledInvoicesList');
    if (!tbody) return;
    tbody.innerHTML = '';

    controlled.forEach(ci => {
      const tr = document.createElement('tr');

      // ID
      const tdId = document.createElement('td');
      tdId.textContent = ci.id;
      tr.appendChild(tdId);

      // Customer / booking names
      const tdCustomer = document.createElement('td');
      const bookingNames = (ci.bookingIds || [])
        .map(id => bookings.find(b => b.id === id)?.customer)
        .filter(Boolean)
        .join(', ');
      tdCustomer.textContent = bookingNames || '—';
      tr.appendChild(tdCustomer);

      // Date
      const tdDate = document.createElement('td');
      tdDate.textContent = ci.date || ci.createdAt || '-';
      tr.appendChild(tdDate);

      // Reason
      const tdReason = document.createElement('td');
      tdReason.textContent = ci.reason || '-';
      tr.appendChild(tdReason);

      // Status
      const tdStatus = document.createElement('td');
      tdStatus.textContent = ci.status || '-';
      tr.appendChild(tdStatus);

      // Approved by
      const tdApprovedBy = document.createElement('td');
      tdApprovedBy.textContent = ci.approvedBy || '-';
      tr.appendChild(tdApprovedBy);

      // Actions
      const tdActions = document.createElement('td');

      // PDF button (always present)
      const pdfBtn = document.createElement('button');
      pdfBtn.className = 'btn btn-sm btn-outline-secondary me-1';
      pdfBtn.type = 'button';
      pdfBtn.textContent = 'PDF';
      pdfBtn.title = (ci && String(ci.status || '').toLowerCase() === 'rejected') ? 'View rejected invoice PDF' : 'View invoice PDF';
      if (ci && String(ci.status || '').toLowerCase() === 'rejected') {
        pdfBtn.classList.remove('btn-outline-secondary');
        pdfBtn.classList.add('btn-outline-warning');
      }
      pdfBtn.addEventListener('click', () => viewControlledPdf(ci.id));
      tdActions.appendChild(pdfBtn);

      // Status-specific buttons
      if (ci.status === 'Approved') {
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deleteControlledInvoice(ci.id));
        tdActions.appendChild(del);
      } else if (ci.status === 'Pending') {
        const signBtn = document.createElement('button');
        signBtn.className = 'btn btn-sm btn-primary me-1';
        signBtn.textContent = 'Sign';
        signBtn.addEventListener('click', () => openSignature(ci.id));
        tdActions.appendChild(signBtn);

        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn btn-sm btn-success me-1';
        approveBtn.textContent = 'Approve';
        approveBtn.addEventListener('click', () => approveControlled(ci.id));
        tdActions.appendChild(approveBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn btn-sm btn-danger me-1';
        rejectBtn.textContent = 'Reject';
        rejectBtn.addEventListener('click', () => rejectControlled(ci.id));
        tdActions.appendChild(rejectBtn);

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deleteControlledInvoice(ci.id));
        tdActions.appendChild(del);
      } else if (ci.status === 'Rejected') {
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deleteControlledInvoice(ci.id));
        tdActions.appendChild(del);
      }

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Failed to load controlled invoices', err);
  }
}

async function deleteControlledInvoice(id) {
  if (!confirm("Are you sure you want to delete this controlled invoice?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/controlled-invoices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Failed to delete controlled invoice");
    }
    await loadControlledInvoices();
    alert("Controlled invoice deleted successfully!");
  } catch (err) {
    console.error("Delete controlled invoice failed", err);
    alert("Delete failed: " + err.message);
  }
}



// ✅ NEW: Only load bookings requiring approval
async function loadControlledBookingsIntoSelect() {
  try {
    const res = await fetch(`${API_BASE}/api/controlled-invoices/available-bookings`);
    if (!res.ok) throw new Error('Failed to load available bookings');
    const bookings = await res.json();
    const select = document.getElementById('controlledBookingSelect');
    if (!select) return;
    select.innerHTML = '';
    bookings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `#${b.id} - ${b.customer} (${Number(b.total || 0).toFixed(2)})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load controlled bookings', err);
  }
}

// Approve / reject helpers (server must support these endpoints)
async function approveControlled(id) {
  // OLD: immediate approve call -> replaced to open signature modal for upload
  // if (!confirm('Approve this controlled invoice?')) return;
  // try {
  //   const res = await fetch(`${API_BASE}/api/controlled-invoices/${id}/approve`, { method: PUT' });
  //   if (!res.ok) throw new Error('Approve failed');
  //   await loadControlledInvoices();
  // } catch (err) {
  //   console.error(err);
  //   alert('Approve failed: ' + err.message);
  // }

  // NEW: Open signature modal so manager can upload PNG/JPG signature before approving
  if (typeof openSignatureModal === 'function') {
    openSignatureModal(id);
    return;
  }
  // fallback: set signature modal fields and show it
  const modalEl = document.getElementById('signatureModal');
  if (!modalEl) {
    if (!confirm('Approve this controlled invoice?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/controlled-invoices/${id}/approve`, { method: 'PUT' });
      if (!res.ok) throw new Error('Approve failed');
      await loadControlledInvoices();
    } catch (err) {
      console.error(err);
      alert('Approve failed: ' + err.message);
    }
    return;
  }
  document.getElementById('signatureInvoiceId').value = String(id);
  document.getElementById('managerNameInput').value = '';
  document.getElementById('signatureFileInput').value = '';
  document.getElementById('signaturePreview').src = '';
  document.getElementById('signaturePreview').style.display = 'none';
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function rejectControlled(id) {
  // store id and show modal
  currentRejectId = id;

  const reasonInput = document.getElementById('rejectReasonInput');
  if (reasonInput) reasonInput.value = ''; // clear previous value

  const modalEl = document.getElementById('rejectReasonModal');
  if (!modalEl) {
    // fallback — if modal isn't present, confirm via simple confirm()
    if (!confirm('Reject without providing a reason?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/controlled-invoices/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: 'Manager', reason: 'Rejected (no modal available)' })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Reject failed');
      }
      await loadControlledInvoices();
    } catch (err) {
      console.error('Reject failed', err);
      alert('Reject failed: ' + (err.message || err));
    }
    return;
  }

  // show bootstrap modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}


/* ---------------- Controlled Invoice signature modal helpers ---------------- */
(function () {
  const signatureModalEl = document.getElementById('signatureModal');
  const signatureFileInput = document.getElementById('signatureFileInput');
  const signaturePreview = document.getElementById('signaturePreview');
  const managerNameInput = document.getElementById('managerNameInput');
  const signatureInvoiceId = document.getElementById('signatureInvoiceId');
  const signApproveBtn = document.getElementById('signApproveBtn');
  const signRejectBtn = document.getElementById('signRejectBtn');
  const signatureRejectReason = document.getElementById('signatureRejectReason');

  let bsModal = null;
  function getModal() {
    if (!bsModal && signatureModalEl) bsModal = new bootstrap.Modal(signatureModalEl, { backdrop: 'static' });
    return bsModal;
  }

  // global helper used by inline onclicks / other code
  window.openSignatureModal = function (invoiceId, managerName = '') {
    if (!signatureModalEl) return alert('Signature modal not found');
    signatureInvoiceId.value = String(invoiceId);
    managerNameInput.value = managerName || '';
    signatureFileInput.value = '';
    signaturePreview.src = '';
    signaturePreview.style.display = 'none';
    signatureRejectReason.value = '';
    getModal().show();
  };

  // preview chosen file
  if (signatureFileInput) {
    signatureFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) { signaturePreview.src = ''; signaturePreview.style.display = 'none'; return; }
      const allowed = ['image/png', 'image/jpeg'];
      if (!allowed.includes(file.type)) {
        alert('Only PNG/JPG signature images are allowed.');
        signatureFileInput.value = '';
        signaturePreview.src = '';
        signaturePreview.style.display = 'none';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        signaturePreview.src = ev.target.result;
        signaturePreview.style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    });
  }

  // Approve: send multipart/form-data (field name "signature") to backend
  if (signApproveBtn) signApproveBtn.addEventListener('click', async () => {
    const id = signatureInvoiceId.value;
    if (!id) return alert('Invoice id missing');
    const form = new FormData();
    form.append('managerName', managerNameInput.value || 'Manager');
    const file = signatureFileInput.files && signatureFileInput.files[0];
    if (file) form.append('signature', file);

    try {
      signApproveBtn.disabled = true;
      const resp = await fetch(`${API_BASE}/api/controlled-invoices/${id}/approve`, {
        method: 'PUT',
        body: form
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Approve failed');

      getModal().hide();
      // refresh controlled invoices list (call existing loader if available)
      if (typeof loadControlledInvoices === 'function') await loadControlledInvoices();
      else if (typeof fetchAndRender === 'function') await fetchAndRender();
      else location.reload();
    } catch (err) {
      console.error('approve error', err);
      alert('Failed to approve. See console for details.');
    } finally {
      signApproveBtn.disabled = false;
    }
  });

  // Reject: send JSON to reject route
  if (signRejectBtn) signRejectBtn.addEventListener('click', async () => {
    const id = signatureInvoiceId.value;
    if (!id) return alert('Invoice id missing');
    const managerName = managerNameInput.value || 'Manager';
    const reason = signatureRejectReason.value || 'No reason';
    if (!confirm('Are you sure you want to reject this invoice?')) return;

    try {
      signRejectBtn.disabled = true;
      const resp = await fetch(`${API_BASE}/api/controlled-invoices/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerName, reason })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Reject failed');

      getModal().hide();
      if (typeof loadControlledInvoices === 'function') await loadControlledInvoices();
      else if (typeof fetchAndRender === 'function') await fetchAndRender();
      else location.reload();
    } catch (err) {
      console.error('reject error', err);
      alert('Failed to reject. See console for details.');
    } finally {
      signRejectBtn.disabled = false;
    }
  });
})();

/* ---------------- View / download PDFs ---------------- */
// open invoice PDF in a new tab/window (server provides the /api/invoices/:id/pdf endpoint)
window.viewInvoicePdf = function (id) {
  try {
    window.open(`${API_BASE}/api/invoices/${id}/pdf`, '_blank');
  } catch (err) {
    console.error('Open PDF failed', err);
    alert('Could not open PDF');
  }
};

// controlled invoice PDF (server must provide /api/controlled-invoices/:id/pdf)
window.viewControlledPdf = function (id) {
  try {
    window.open(`${API_BASE}/api/controlled-invoices/${id}/pdf`, '_blank');
  } catch (err) {
    console.error('Open controlled PDF failed', err);
    alert('Could not open PDF');
  }
};


// Controlled Invoices CSV Export
async function exportControlledInvoicesCsv() {
  try {
    const res = await fetch(`${API_BASE}/api/controlled-invoices`);
    const data = await res.json();

    if (!data.length) {
      alert("No controlled invoices to export.");
      return;
    }

    // Build CSV
    const headers = ["ID", "Customer", "Date", "Reason", "Status", "Approved By"];
    const rows = data.map(ci => [
      ci.id,
      (ci.bookingIds || []).join(', '), // simple fallback, customer mapping already handled in UI
      ci.date || ci.createdAt || "-",
      ci.reason || "-",
      ci.status,
      ci.approvedBy || "-"
    ]);

    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `controlled_invoices_${Date.now()}.csv`;
    link.click();
  } catch (err) {
    console.error("CSV export failed", err);
    alert("Failed to export Controlled Invoices CSV.");
  }
}

// Controlled Invoices PDF Export
async function exportControlledInvoicesPdf() {
  try {
    // simply open server endpoint in a new tab
    window.open(`${API_BASE}/api/controlled-invoices/export/pdf`, "_blank");
  } catch (err) {
    console.error("PDF export failed", err);
    alert("Failed to export Controlled Invoices PDF.");
  }
}

// 🟩 Show Add Open Invoice Modal
function showAddOpenInvoiceModal() {
  const modalEl = document.getElementById('addOpenInvoiceModal');
  if (!modalEl) return;

  // load customers into dropdown
  loadOpenInvoiceCustomers();

  // open Bootstrap modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// 🟩 Show Add Sales Return Modal
function showAddSalesReturnModal() {
  const modalEl = document.getElementById('addSalesReturnModal');
  if (!modalEl) return;

  // Load invoices for returns dropdown
  loadInvoicesForReturns();

  // open Bootstrap modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Expose globally for inline onclick usage
window.showAddSalesReturnModal = showAddSalesReturnModal;

// 🟩 When user selects a customer in Open Invoice modal
document.getElementById('oiCustomer')?.addEventListener('change', async (e) => {
  const customerId = e.target.value; // ✅ now ID, not name
  if (!customerId) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings/by-customer/${customerId}`);
    if (!res.ok) throw new Error('No bookings found for this customer');
    const bookings = await res.json();

    const booking = bookings[bookings.length - 1];
    if (booking.products && booking.products.length) {
      const p = booking.products[0];
      document.getElementById('oiProduct').value = p.product;
      document.getElementById('oiQty').value = p.qty;
      document.getElementById('oiPrice').value = p.price;
    }
  } catch (err) {
    console.error(err);
    alert('No bookings found for this customer');
  }
});


/* ---------------- Sales Returns: Load & Display ---------------- */
async function loadSalesReturns() {
  try {
    const res = await fetch(`${API_BASE}/api/sales-returns`);
    const returns = await res.json();

    const tbody = document.getElementById('salesReturnsList');
    if (!tbody) return;
    tbody.innerHTML = '';

    returns.forEach(r => {
      // show product names and batches from products array (fallback to legacy fields)
      const productNames = Array.isArray(r.products) && r.products.length
        ? r.products.map(p => p.product || p.name || '-').join(', ')
        : (r.product || '-');

      const batchNames = Array.isArray(r.products) && r.products.length
        ? r.products.map(p => p.batch || '-').join(', ')
        : (r.batch || '-');

      const dateText = r.date ? new Date(r.date).toLocaleDateString() : '-';
      const amt = (r.amount !== undefined && r.amount !== null)
        ? Number(r.amount).toFixed(2)
        : ((r.products || []).reduce((s, p) => s + (Number(p.total || 0)), 0)).toFixed(2);

      tbody.innerHTML += `
        <tr>
          <td>${r.id}</td>
          <td>${r.invoiceNumber || r.invoiceNo || '-'}</td>
          <td>${r.customerName || r.customer || '-'}</td>
          <td>${productNames}</td>
          <td>${batchNames}</td>
          <td>${dateText}</td>
          <td>${r.reason || '-'}</td>
          <td>${amt}</td>
          <td><span class="badge bg-success">${r.status || 'Processed'}</span></td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-success me-1" onclick="viewSalesReturnPdf(${r.id})">PDF</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSalesReturn(${r.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Error loading sales returns:", err);
  }
}

async function loadInvoicesForReturns() {
  try {
    const res = await fetch(`${API_BASE}/api/invoices`);
    const invoices = await res.json();

    const select = document.getElementById('srInvoice');
    select.innerHTML = '<option value="">Select Invoice</option>';

    invoices.forEach(inv => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = `#${inv.id} - ${inv.customer}`;
      opt.dataset.customer = inv.customer;
      opt.dataset.products = JSON.stringify(inv.products || []);
      select.appendChild(opt);
    });

    // Auto-fill customer name and load products when invoice selected
    select.addEventListener('change', e => {
      const selected = select.options[select.selectedIndex];
      document.getElementById('srCustomer').value = selected.dataset.customer || "";

      // Load products for selected invoice as checkboxes
      const products = JSON.parse(selected.dataset.products || '[]');
      const productContainer = document.getElementById('srProductContainer');
      productContainer.innerHTML = ''; // Clear previous

      products.forEach((p, index) => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('form-check');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('form-check-input');
        checkbox.id = `productCheckbox${index}`;
        checkbox.value = p.product || '';

        const label = document.createElement('label');
        label.classList.add('form-check-label');
        label.htmlFor = checkbox.id;
        label.textContent = p.product || '';

        productDiv.appendChild(checkbox);
        productDiv.appendChild(label);

        // Batch checkboxes container for this product
        const batchContainer = document.createElement('div');
        batchContainer.classList.add('batch-container', 'ms-4', 'mb-2');
        batchContainer.style.display = 'none'; // hidden initially

        (p.batches || []).forEach((batch, bIndex) => {
          const batchDiv = document.createElement('div');
          batchDiv.classList.add('form-check');

          const batchCheckbox = document.createElement('input');
          batchCheckbox.type = 'checkbox';
          batchCheckbox.classList.add('form-check-input');
          batchCheckbox.id = `batchCheckbox${index}_${bIndex}`;
          batchCheckbox.value = batch;

          const batchLabel = document.createElement('label');
          batchLabel.classList.add('form-check-label');
          batchLabel.htmlFor = batchCheckbox.id;
          batchLabel.textContent = batch;

          batchDiv.appendChild(batchCheckbox);
          batchContainer.appendChild(batchDiv);
        });

        productDiv.appendChild(batchContainer);
        productContainer.appendChild(productDiv);

        // Show/hide batch container on product checkbox toggle
        checkbox.addEventListener('change', () => {
          batchContainer.style.display = checkbox.checked ? 'block' : 'none';
          // If unchecked, uncheck all batches
          if (!checkbox.checked) {
            batchContainer.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
          }
        });
      });
    });
  } catch (err) {
    console.error("Error loading invoices for returns:", err);
  }
}

document.getElementById('addSalesReturnForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const invoiceSelect = document.getElementById('srInvoice');
  const invoiceId = invoiceSelect ? Number(invoiceSelect.value) : null;
  const reason = document.getElementById('srReason').value;
  const amount = parseFloat(document.getElementById('srAmount').value);

  if (!invoiceId || !reason || isNaN(amount)) {
    alert('Please fill all required fields');
    return;
  }

  // Collect selected products and batches from checkboxes
  const selectedItems = [];
  const productCheckboxes = document.querySelectorAll('#srProductContainer input[type="checkbox"]:checked:not([id^="batchCheckbox"])');

  productCheckboxes.forEach(productCb => {
    const productName = productCb.value;
    const batchContainer = productCb.parentElement.querySelector('.batch-container');
    const batchCheckboxes = batchContainer ? batchContainer.querySelectorAll('input[type="checkbox"]:checked') : [];

    if (batchCheckboxes.length) {
      batchCheckboxes.forEach(batchCb => {
        selectedItems.push({
          product: productName,
          batch: batchCb.value
        });
      });
    } else {
      selectedItems.push({
        product: productName,
        batch: '-'
      });
    }
  });

  if (selectedItems.length === 0) {
    alert('Please select at least one product and batch');
    return;
  }

  try {
    // Distribute the return amount across selected items (qty defaults to 1)
    const perItem = Number((amount / selectedItems.length).toFixed(2)) || 0;
    const productsPayload = selectedItems.map(it => ({
      product: it.product,
      batch: it.batch,
      qty: 1,
      price: perItem,
      total: perItem,
      reason
    }));

    // Single POST with products array -> creates one sales-return record
    const res = await fetch(`${API_BASE}/api/sales-returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        reason,
        amount,
        products: productsPayload
      })
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to save sales return');

    alert('Sales return saved successfully!');
    bootstrap.Modal.getInstance(document.getElementById('addSalesReturnModal')).hide();
    document.getElementById('addSalesReturnForm').reset();
    await loadSalesReturns();
  } catch (err) {
    console.error('Error saving sales returns:', err);
    alert('Failed to save sales returns: ' + (err.message || err));
  }
});

/* ---------------- Legacy inline helper: openSignature ----------------
   Ensure onclick="openSignature(id)" works — calls the modal-based flow
*/
function openSignature(id) {
  // prefer the newer modal helper if present
  if (typeof openSignatureModal === 'function') {
    openSignatureModal(id);
    return;
  }

  const modalEl = document.getElementById('signatureModal');
  if (!modalEl) {
    alert('Signature modal not found');
    return;
  }

  const invoiceIdEl = document.getElementById('signatureInvoiceId');
  const managerNameInput = document.getElementById('managerNameInput');
  const fileInput = document.getElementById('signatureFileInput');
  const preview = document.getElementById('signaturePreview');

  if (invoiceIdEl) invoiceIdEl.value = String(id);
  if (managerNameInput) managerNameInput.value = '';
  if (fileInput) fileInput.value = '';
  if (preview) { preview.src = ''; preview.style.display = 'none'; }

  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
  modal.show();
}

// Sales Returns PDF and Delete functions
window.viewSalesReturnPdf = function (id) {
  window.open(`${API_BASE}/api/sales-returns/${id}/pdf`, '_blank');
};

async function deleteSalesReturn(id) {
  if (!confirm("Are you sure you want to delete this sales return?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/sales-returns/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error('Delete failed');
    loadSalesReturns();
    alert("Sales return deleted successfully!");
  } catch (err) {
    console.error('Delete sales return failed', err);
    alert("Delete failed: " + err.message);
  }
}

async function exportSalesReturnsCsv() {
  const res = await fetch(`${API_BASE}/api/sales-returns`);
  const data = await res.json();
  if (!data.length) return alert('No sales returns to export');
  const csv = [['ID', 'Invoice Number', 'Customer', 'NTN', 'CNIC', 'Date', 'Reason', 'Amount'],
  ...data.map(r => [r.id, r.invoiceNumber || r.invoiceNo || '-', r.customerName || r.customer || '-', r.customerNTN || '', r.customerCNIC || '', r.date, r.reason, r.amount])
  ].map(r => r.join(',')).join('\n');
  downloadCsv(csv, 'sales_returns.csv');
}

/* Sales Returns — collect multiple products then POST once */
let salesReturnBuffer = [];

/**
 * Call when modal opens (reset buffer & UI)
 * Ensure your modal open code calls openSalesReturnModal(invoiceId)
 */
function openSalesReturnModal(invoiceId = null) {
  salesReturnBuffer = [];
  const list = document.getElementById('srProductsList');
  if (list) list.innerHTML = '';
  const invoiceInput = document.getElementById('srInvoiceId');
  if (invoiceInput) invoiceInput.value = invoiceId || '';
  const reasonInput = document.getElementById('srReason');
  if (reasonInput) reasonInput.value = '';
  // show modal (Bootstrap)
  const modalEl = document.getElementById('salesReturnModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

/**
 * Add a product to the in-memory buffer and render it in the modal list.
 * Fields expected in modal: srProductName, srBatch, srQty, srPrice, srReason (IDs)
 */
function srAddProduct() {
  const name = (document.getElementById('srProductName') || {}).value || '';
  const batch = (document.getElementById('srBatch') || {}).value || '';
  const qty = Number((document.getElementById('srQty') || {}).value || 0);
  const price = Number((document.getElementById('srPrice') || {}).value || 0);
  const reason = (document.getElementById('srReasonLine') || {}).value || '';

  if (!name) return alert('Product name required');
  const item = { product: name, batch, qty, price, total: Number((qty * price).toFixed(2)), reason };

  salesReturnBuffer.push(item);
  renderSrBuffer();
  // optional: clear inputs for next entry
  (document.getElementById('srProductName') || {}).value = '';
  (document.getElementById('srBatch') || {}).value = '';
  (document.getElementById('srQty') || {}).value = '';
  (document.getElementById('srPrice') || {}).value = '';
  (document.getElementById('srReasonLine') || {}).value = '';
}

/** Render buffer into modal table (tbody id="srProductsList") */
function renderSrBuffer() {
  const tbody = document.getElementById('srProductsList');
  if (!tbody) return;
  tbody.innerHTML = '';
  salesReturnBuffer.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.product}</td>
      <td>${p.batch || '-'}</td>
      <td class="text-end">${p.qty}</td>
      <td class="text-end">${p.price.toFixed(2)}</td>
      <td class="text-end">${Number(p.total || 0).toFixed(2)}</td>
      <td><button type="button" class="btn btn-sm btn-danger sr-remove-btn" data-idx="${idx}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
  // attach remove handlers
  tbody.querySelectorAll('.sr-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = Number(e.currentTarget.getAttribute('data-idx'));
      if (!Number.isNaN(i)) {
        salesReturnBuffer.splice(i, 1);
        renderSrBuffer();
      }
    });
  });
}

/** Submit single POST with products array */
async function srSubmit() {
  if (!salesReturnBuffer.length) return alert('Add at least one product to return.');
  const invoiceId = (document.getElementById('srInvoiceId') || {}).value || null;
  const reason = (document.getElementById('srReason') || {}).value || '';
  try {
    const resp = await fetch(`${API_BASE}/api/sales-returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoiceId || null,
        reason,
        products: salesReturnBuffer
      })
    });

    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Failed to create sales return');

    // success: close modal, clear buffer, refresh returns list
    const modalEl = document.getElementById('salesReturnModal');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    salesReturnBuffer = [];
    renderSrBuffer();
    if (typeof loadSalesReturns === 'function') loadSalesReturns();
    else location.reload();
  } catch (err) {
    console.error('sales return submit error', err);
    alert('Failed to save sales return. See console.');
  }
}

/* Hook up modal buttons (IDs must match your modal markup) */
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'srAddProductBtn') { e.preventDefault(); srAddProduct(); }
  if (e.target && e.target.id === 'srSaveBtn') { e.preventDefault(); srSubmit(); }
});

/* ---------------- Customer Receipt Page Functions ---------------- */
async function loadCustomerReceiptInvoices() {
  try {
    const res = await fetch(`${API_BASE}/api/invoices`);
    if (!res.ok) throw new Error('Failed to load invoices');
    const invoices = await res.json();

    const tbody = document.getElementById('invoiceList');
    if (!tbody) return;
    tbody.innerHTML = '';

    invoices.forEach(inv => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="form-check-input invoice-checkbox" data-id="${inv.id}" data-customer="${inv.customer}" data-total="${Number(inv.total || 0).toFixed(2)}"></td>
        <td>${inv.id}</td>
        <td>${inv.date}</td>
        <td>${Number(inv.total || 0).toFixed(2)}</td>
        <td><input type="number" class="form-control allocate-amount" min="0" step="0.01" value="0" disabled></td>
      `;
      tbody.appendChild(tr);
    });

    // Enable/disable allocate amount based on checkbox
    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('invoice-checkbox')) {
        const checkbox = e.target;
        const row = checkbox.closest('tr');
        const amountInput = row.querySelector('.allocate-amount');
        const invoiceTotal = parseFloat(checkbox.dataset.total || row.cells[3]?.textContent || 0) || 0;

        amountInput.disabled = !checkbox.checked;

        if (checkbox.checked) {
          // auto-fill allocation with invoice total (or keep existing manual value if > 0)
          if (!amountInput.value || Number(amountInput.value) === 0) {
            amountInput.value = invoiceTotal.toFixed(2);
          }
        } else {
          amountInput.value = '0';
        }

        // Recalculate summary
        updateReceiptSummaryFromInputs();

        // If payment amount is empty/zero, auto-set paymentAmount to current allocated total
        const paymentAmountEl = document.getElementById('paymentAmount');
        if (paymentAmountEl) {
          const currentPayment = Number(paymentAmountEl.value) || 0;
          // compute totalAllocated now (read from inputs)
          let totalAllocated = 0;
          document.querySelectorAll('.allocate-amount:not([disabled])').forEach(input => totalAllocated += Number(input.value) || 0);
          if (!currentPayment && totalAllocated > 0) {
            paymentAmountEl.value = totalAllocated.toFixed(2);
            // update summary again to reflect new paymentAmount
            updateReceiptSummaryFromInputs();
          }
        }
      }
    });

    // Add Select All checkbox handler
    const selectAllCheckbox = document.getElementById('selectAllInvoices');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.addEventListener('change', () => {
        const checked = selectAllCheckbox.checked;
        tbody.querySelectorAll('.invoice-checkbox').forEach(cb => {
          cb.checked = checked;
          const row = cb.closest('tr');
          const amountInput = row.querySelector('.allocate-amount');
          amountInput.disabled = !checked;
          if (!checked) amountInput.value = '0';
        });
        updateReceiptSummaryFromInputs();
      });
    }

    // Update summary when allocation amounts change
    tbody.querySelectorAll('.allocate-amount').forEach(input => {
      input.addEventListener('input', () => {
        updateReceiptSummaryFromInputs();
      });
    });

  } catch (err) {
    console.error('Failed to load invoices for receipts', err);
  }
}

/**
 * Update receipt summary fields based on current allocation inputs and payment amount
 */
function updateReceiptSummaryFromInputs() {
  const paymentAmount = Number(document.getElementById('paymentAmount')?.value) || 0;
  let totalAllocated = 0;
  document.querySelectorAll('.allocate-amount:not([disabled])').forEach(input => {
    totalAllocated += Number(input.value) || 0;
  });
  const onAccountAdvance = Number(document.getElementById('onAccountAdvance')?.value) || 0;
  const writeOffAmount = Number(document.getElementById('writeOffAmount')?.value) || 0;
  const balance = paymentAmount - totalAllocated - onAccountAdvance - writeOffAmount;

  updateReceiptSummary(paymentAmount, totalAllocated, balance);
}

function initializeCustomerReceiptForm() {
  const paymentTypeSelect = document.getElementById('paymentType');
  const paymentDetailsSection = document.getElementById('paymentDetailsSection');
  const allocationMethodSelect = document.getElementById('allocationMethod');
  const customerReceiptForm = document.getElementById('customerReceiptForm');

  // Show/hide payment details based on payment type
  if (paymentTypeSelect) {
    paymentTypeSelect.addEventListener('change', () => {
      const type = paymentTypeSelect.value;
      if (paymentDetailsSection) {
        paymentDetailsSection.classList.toggle('d-none', !['bank', 'cheque', 'online'].includes(type));
      }
    });
  }

  // Handle allocation method change (FIFO or Manual)
  if (allocationMethodSelect) {
    allocationMethodSelect.addEventListener('change', () => {
      const method = allocationMethodSelect.value;
      // For now, just log; manual allocation is already handled via checkboxes
      console.log('Allocation method:', method);
    });
  }

  // Form submission
  if (customerReceiptForm) {
    customerReceiptForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const paymentType = document.getElementById('paymentType')?.value;
      const paymentAmount = Number(document.getElementById('paymentAmount')?.value) || 0;
      const paymentDate = document.getElementById('paymentDate')?.value;
      const bankName = document.getElementById('bankName')?.value || '';
      const chequeNumber = document.getElementById('chequeNumber')?.value || '';
      const chequeDate = document.getElementById('chequeDate')?.value || '';
      const allocationMethod = document.getElementById('allocationMethod')?.value;
      const onAccountAdvance = Number(document.getElementById('onAccountAdvance')?.value) || 0;
      const writeOffAmount = Number(document.getElementById('writeOffAmount')?.value) || 0;

      // Collect allocations + invoiceIds + customerName fallback
      const allocations = [];
      const invoiceIds = [];
      let customerName = null;

      document.querySelectorAll('#invoiceList tr').forEach(row => {
        const checkbox = row.querySelector('.invoice-checkbox');
        const amountInput = row.querySelector('.allocate-amount');
        if (checkbox && checkbox.checked && amountInput) {
          const allocateAmount = Number(amountInput.value) || 0;
          const invoiceId = Number(checkbox.getAttribute('data-id')) || null;
          if (invoiceId !== null && allocateAmount > 0) {
            allocations.push({ invoiceId, allocateAmount });
            invoiceIds.push(invoiceId);
            // prefer data-customer attr on checkbox if present
            const dsCust = checkbox.dataset && checkbox.dataset.customer ? checkbox.dataset.customer : null;
            if (!customerName && dsCust) customerName = dsCust;
          }
        }
      });

      // include fallback customerName/invoiceIds so saved receipts can be displayed
      const payload = {
        paymentType,
        paymentAmount,
        paymentDate,
        bankName,
        chequeNumber,
        chequeDate,
        allocationMethod,
        allocations,
        onAccountAdvance,
        writeOffAmount,
        // Unique, module-specific fields
        receiptCustomerName: customerName || null,
        receiptInvoiceIds: invoiceIds,
        // Back-compat for older readers
        customerName: customerName || null,
        invoiceIds
      };

      try {
        const res = await fetch(`${API_BASE}/api/customer-receipts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log('Customer receipt save response:', res.status, text);

        if (!res.ok) throw new Error(text || 'Failed to save receipt');

        alert('Receipt saved successfully!');
        customerReceiptForm.reset();
        loadCustomerReceiptInvoices();
        loadCustomerReceipts();
        updateReceiptSummary(0, 0, 0);
      } catch (err) {
        console.error('Receipt save failed', err);
        alert('Receipt save failed: ' + (err.message || err));
      }
    });
  }

  // Update summary on input changes
  document.getElementById('paymentAmount')?.addEventListener('input', updateReceiptSummaryFromInputs);
  document.getElementById('onAccountAdvance')?.addEventListener('input', updateReceiptSummaryFromInputs);
  document.getElementById('writeOffAmount')?.addEventListener('input', updateReceiptSummaryFromInputs);
}

function updateReceiptSummary(totalReceived, totalAllocated, balance) {
  const totalReceivedEl = document.getElementById('totalReceived');
  const totalAllocatedEl = document.getElementById('totalAllocated');
  const balanceEl = document.getElementById('balanceAmount');

  if (totalReceivedEl) totalReceivedEl.value = totalReceived.toFixed(2);
  if (totalAllocatedEl) totalAllocatedEl.value = totalAllocated.toFixed(2);
  if (balanceEl) balanceEl.value = balance.toFixed(2);
}

// Export Customer Receipts CSV
async function exportCustomerReceiptsCsv() {
  try {
    const res = await fetch(`${API_BASE}/api/customer-receipts`);
    if (!res.ok) throw new Error('Failed to fetch customer receipts');
    const data = await res.json();

    if (!data.length) {
      alert('No customer receipts to export.');
      return;
    }

    const headers = ['Receipt ID', 'Payment Type', 'Payment Amount', 'Payment Date', 'Bank Name', 'Cheque Number', 'Cheque Date', 'Allocation Method', 'On Account Advance', 'Write Off Amount', 'Allocations'];
    const rows = data.map(r => [
      r.id,
      r.paymentType,
      r.paymentAmount,
      r.paymentDate,
      r.bankName || '',
      r.chequeNumber || '',
      r.chequeDate || '',
      r.allocationMethod,
      r.onAccountAdvance || 0,
      r.writeOffAmount || 0,
      (r.allocations || []).map(a => `Invoice#${a.invoiceId}: ${a.allocateAmount}`).join('; ')
    ]);

    const csvContent = [headers, ...rows].map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customer_receipts_${Date.now()}.csv`;
    link.click();
  } catch (err) {
    console.error('Export customer receipts CSV failed', err);
    alert('Failed to export customer receipts CSV.');
  }
}

// Export Customer Receipts PDF
async function exportCustomerReceiptsPdf() {
  try {
    window.open(`${API_BASE}/api/customer-receipts/export/pdf`, '_blank');
  } catch (err) {
    console.error('Export customer receipts PDF failed', err);
    alert('Failed to export customer receipts PDF.');
  }
}

// Load and render saved customer receipts in the table
async function loadCustomerReceipts() {
  try {
    // fetch receipts and invoices concurrently
    const [resReceipts, resInvoices] = await Promise.all([
      fetch(`${API_BASE}/api/customer-receipts`),
      fetch(`${API_BASE}/api/invoices`)
    ]);
    if (!resReceipts.ok) throw new Error('Failed to load customer receipts');
    if (!resInvoices.ok) throw new Error('Failed to load invoices');

    const receipts = await resReceipts.json();
    const invoices = await resInvoices.json();

    // build lookup maps keyed by both string and number forms
    const invoiceMapByNum = new Map();
    const invoiceMapByStr = new Map();
    invoices.forEach(inv => {
      invoiceMapByNum.set(Number(inv.id), inv);
      invoiceMapByStr.set(String(inv.id), inv);
      if (inv.invoiceNumber) invoiceMapByStr.set(String(inv.invoiceNumber), inv);
    });

    const tbody = document.getElementById('customerReceiptsList');
    if (!tbody) return;
    tbody.innerHTML = '';

    // helper to find invoice safely
    const findInvoice = (id) => {
      if (id === undefined || id === null) return null;
      if (typeof id === 'number' && invoiceMapByNum.has(id)) return invoiceMapByNum.get(id);
      if (invoiceMapByNum.has(Number(id))) return invoiceMapByNum.get(Number(id));
      if (invoiceMapByStr.has(String(id))) return invoiceMapByStr.get(String(id));
      // fallback linear search (tolerant)
      return invoices.find(inv => String(inv.id) === String(id) || String(inv.invoiceNumber) === String(id)) || null;
    };

    // render receipts: if allocations exist, render row per allocation, otherwise try fallback fields
    receipts.forEach(receipt => {
      const allocations = Array.isArray(receipt.allocations) ? receipt.allocations : [];

      if (allocations.length > 0) {
        allocations.forEach(allocation => {
          const invoice = findInvoice(allocation.invoiceId) || findInvoice(receipt.invoiceId) || null;
          const customerName = receipt.receiptCustomerName
            || (invoice ? (invoice.customer || invoice.customerName) : null)
            || receipt.customerName
            || receipt.customer
            || 'N/A';
          const invoiceNumber = invoice ? (invoice.id ?? invoice.invoiceNumber ?? 'N/A') : (allocation.invoiceId ?? receipt.invoiceId ?? 'N/A');
          const amount = Number(allocation.allocateAmount || allocation.amount || 0).toFixed(2);
          const date = (invoice && (invoice.date || invoice.createdAt)) ? new Date(invoice.date || invoice.createdAt).toLocaleDateString()
            : (receipt.paymentDate || receipt.date ? new Date(receipt.paymentDate || receipt.date).toLocaleDateString() : 'N/A');

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${receipt.id}</td>
            <td>${customerName}</td>
            <td>${invoiceNumber}</td>
            <td>${Number(amount).toFixed(2)}</td>
            <td>${date}</td>
            <td>
              <button class="btn btn-sm btn-outline-success me-1" onclick="viewCustomerReceiptPdf(${receipt.id})">PDF</button>
              <button class="btn btn-sm btn-danger" onclick="deleteCustomerReceipt(${receipt.id})">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        // no allocations: use fallback fields stored on receipt
        const customerName = receipt.receiptCustomerName || receipt.customerName || receipt.customer || 'N/A';
        const invoiceNumber = receipt.invoiceId
          ?? receipt.invoiceNumber
          ?? receipt.invoiceNo
          ?? (Array.isArray(receipt.receiptInvoiceIds) && receipt.receiptInvoiceIds[0])
          ?? (Array.isArray(receipt.invoiceIds) && receipt.invoiceIds[0])
          ?? 'N/A';
        const amount = (receipt.paymentAmount ?? receipt.amount ?? 0);
        const date = (receipt.paymentDate || receipt.date) ? new Date(receipt.paymentDate || receipt.date).toLocaleDateString() : 'N/A';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${receipt.id}</td>
          <td>${customerName}</td>
          <td>${invoiceNumber}</td>
          <td>${Number(amount).toFixed(2)}</td>
          <td>${date}</td>
          <td>
            <button class="btn btn-sm btn-outline-success me-1" onclick="viewCustomerReceiptPdf(${receipt.id})">PDF</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCustomerReceipt(${receipt.id})">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    });

  } catch (err) {
    console.error('Failed to load customer receipts', err);
  }
}

// View PDF for a specific customer receipt
window.viewCustomerReceiptPdf = function (id) {
  window.open(`${API_BASE}/api/customer-receipts/${id}/pdf`, '_blank');
};

// Delete a customer receipt
async function deleteCustomerReceipt(id) {
  if (!confirm('Are you sure you want to delete this customer receipt?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/customer-receipts/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error('Delete failed');
    loadCustomerReceipts(); // refresh the list
    alert('Customer receipt deleted successfully!');
  } catch (err) {
    console.error('Delete customer receipt failed', err);
    alert('Delete failed: ' + err.message);
  }
}

// Add event listeners for export buttons on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const exportCsvBtn = document.getElementById('exportCustomerReceiptsCsv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCustomerReceiptsCsv);

  const exportPdfBtn = document.getElementById('exportCustomerReceiptsPdf');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportCustomerReceiptsPdf);

  // Stock form wiring — handles both Add and Edit
  const stockAdjustmentForm = document.getElementById('stockAdjustmentForm');
  if (stockAdjustmentForm) {
    // Cancel Edit button
    const cancelEditBtn = document.getElementById('saCancelEdit');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        stockAdjustmentForm.reset();
        document.getElementById('saEditId').value = '';
        document.getElementById('saSubmitBtn').textContent = 'Add Stock';
        cancelEditBtn.classList.add('d-none');
      });
    }

    stockAdjustmentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const editId = document.getElementById('saEditId')?.value.trim();
        const itemId = document.getElementById('saProduct')?.value.trim();
        const batch = document.getElementById('saBatch')?.value.trim();
        const rate = Number(document.getElementById('saRate')?.value) || 0;
        const quantity = Number(document.getElementById('saQuantity')?.value) || 0;
        const expiryDate = document.getElementById('saExpiryDate')?.value || null;
        const costPrice = Number(document.getElementById('saCostPrice')?.value) || 0;
        const salesTax = Number(document.getElementById('saSalesTax')?.value) || 0;
        const store = document.getElementById('saStore')?.value.trim() || '';
        const date = document.getElementById('saDate')?.value || null;

        if (!itemId || !quantity) {
          alert('Please fill all required fields (Item ID, Quantity).');
          return;
        }

        const payload = {
          product: itemId,
          batch,
          adjustmentType: 'Manual Adjustment',
          adjustmentQuantity: quantity,
          rate,
          costPrice,
          expiryDate,
          salesTax,
          store,
          date
        };

        const isEdit = !!editId;
        const url = isEdit
          ? `${API_BASE}/api/stock-adjustments/${editId}`
          : `${API_BASE}/api/stock-adjustments`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(isEdit ? 'Failed to update stock' : 'Failed to add stock');

        alert(isEdit ? 'Stock updated successfully!' : 'Stock added successfully!');

        // Reset form back to Add mode
        stockAdjustmentForm.reset();
        document.getElementById('saEditId').value = '';
        document.getElementById('saSubmitBtn').textContent = 'Add Stock';
        const cancelBtn = document.getElementById('saCancelEdit');
        if (cancelBtn) cancelBtn.classList.add('d-none');

        await loadStockAdjustments();
      } catch (err) {
        console.error('Stock form submit failed', err);
        alert('Submit failed: ' + err.message);
      }
    });
  }


  // Stock Adjustment export buttons
  const exportStockAdjustmentsCsvBtn = document.getElementById('exportStockAdjustmentsCsv');
  if (exportStockAdjustmentsCsvBtn) exportStockAdjustmentsCsvBtn.addEventListener('click', exportStockAdjustmentsCsv);

  const exportStockAdjustmentsPdfBtn = document.getElementById('exportStockAdjustmentsPdf');
  if (exportStockAdjustmentsPdfBtn) exportStockAdjustmentsPdfBtn.addEventListener('click', exportStockAdjustmentsPdf);
});

/* ================================================================
   BANKS MODULE (4.3) — replaced Cheque Conversion
   API: /api/cheque-conversion  →  routes/banks.js
================================================================ */
let cachedBanks = [];

function renderBanksTable(list) {
  const tbody = document.getElementById('bankBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">No banks found.</td></tr>';
    return;
  }
  const fmtDate = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d) ? String(v).split('T')[0] || '-' : d.toLocaleDateString('en-GB');
  };
  list.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.bank_id || '-'}</td>
      <td>${b.bank_name || '-'}</td>
      <td>${b.account_no || '-'}</td>
      <td>${b.branch || '-'}</td>
      <td>${b.coa_id || '-'}</td>
      <td>${b.account_title || '-'}</td>
      <td>${b.account_type || '-'}</td>
      <td>${fmtDate(b.opening_date)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editBank(${b.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteBank(${b.id})">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadBanks() {
  try {
    const res = await fetch(`${API_BASE}/api/cheque-conversion`);
    if (!res.ok) throw new Error('Failed to load banks');
    cachedBanks = await res.json();
    renderBanksTable(cachedBanks);

    // Wire search
    const searchEl = document.getElementById('bankSearch');
    if (searchEl) {
      searchEl.oninput = () => {
        const q = searchEl.value.toLowerCase();
        renderBanksTable(q
          ? cachedBanks.filter(b =>
              (b.bank_id||'').toLowerCase().includes(q) ||
              (b.bank_name||'').toLowerCase().includes(q) ||
              (b.account_no||'').toLowerCase().includes(q) ||
              (b.branch||'').toLowerCase().includes(q)
            )
          : cachedBanks
        );
      };
    }

    // Add Bank button
    const addBtn = document.getElementById('btnAddBank');
    if (addBtn) addBtn.onclick = () => showBankForm();

    // Cancel button
    const cancelBtn = document.getElementById('cancelBankForm');
    if (cancelBtn) cancelBtn.onclick = () => hideBankForm();

    // Export CSV
    const csvBtn = document.getElementById('btnExportBankCSV');
    if (csvBtn) csvBtn.onclick = () => exportBanksCsv();

    // Export PDF
    const pdfBtn = document.getElementById('btnExportBankPDF');
    if (pdfBtn) pdfBtn.onclick = () => exportBanksPdf();

    // Form submit
    const form = document.getElementById('bankForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const editId = document.getElementById('bankEditId')?.value.trim();
          const payload = {
            bank_id:       document.getElementById('bankId')?.value.trim(),
            bank_name:     document.getElementById('bankName')?.value.trim(),
            account_no:    document.getElementById('bankAccountNo')?.value.trim(),
            branch:        document.getElementById('bankBranch')?.value.trim(),
            coa_id:        document.getElementById('bankCoaId')?.value.trim(),
            account_title: document.getElementById('bankAccountTitle')?.value.trim(),
            account_type:  document.getElementById('bankAccountType')?.value,
            opening_date:  document.getElementById('bankOpeningDate')?.value || null
          };
          if (!payload.bank_id || !payload.bank_name) {
            alert('Bank ID and Bank Name are required.');
            return;
          }
          const isEdit = !!editId;
          const url = isEdit
            ? `${API_BASE}/api/cheque-conversion/${editId}`
            : `${API_BASE}/api/cheque-conversion`;
          const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(isEdit ? 'Failed to update bank' : 'Failed to add bank');
          alert(isEdit ? 'Bank updated successfully!' : 'Bank added successfully!');
          hideBankForm();
          await loadBanks();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      };
    }
  } catch (err) {
    console.error('loadBanks error:', err);
  }
}

function showBankForm(bank) {
  const card  = document.getElementById('bankFormCard');
  const title = document.getElementById('bankFormTitle');
  if (!card) return;
  // Clear
  document.getElementById('bankEditId').value        = bank?.id        || '';
  document.getElementById('bankId').value             = bank?.bank_id    || '';
  document.getElementById('bankName').value           = bank?.bank_name  || '';
  document.getElementById('bankAccountNo').value      = bank?.account_no || '';
  document.getElementById('bankBranch').value         = bank?.branch     || '';
  document.getElementById('bankCoaId').value          = bank?.coa_id     || '';
  document.getElementById('bankAccountTitle').value   = bank?.account_title || '';
  document.getElementById('bankAccountType').value    = bank?.account_type  || '';
  const od = bank?.opening_date ? String(bank.opening_date).split('T')[0] : '';
  document.getElementById('bankOpeningDate').value    = od;
  title.textContent = bank ? 'Edit Bank' : 'Add Bank';
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideBankForm() {
  const card = document.getElementById('bankFormCard');
  if (card) card.style.display = 'none';
  const form = document.getElementById('bankForm');
  if (form) form.reset();
  const editId = document.getElementById('bankEditId');
  if (editId) editId.value = '';
}

window.editBank = async function(id) {
  const bank = cachedBanks.find(b => b.id === id);
  if (bank) showBankForm(bank);
};

window.deleteBank = async function(id) {
  if (!confirm('Are you sure you want to delete this bank?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/cheque-conversion/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    await loadBanks();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

function exportBanksCsv() {
  if (!cachedBanks.length) return alert('No bank data to export.');
  const headers = ['Bank ID','Bank Name','Account No','Branch','COA ID','Account Title','Account Type','Opening Date'];
  const rows = cachedBanks.map(b => [
    b.bank_id, b.bank_name, b.account_no, b.branch,
    b.coa_id, b.account_title, b.account_type,
    b.opening_date ? new Date(b.opening_date).toLocaleDateString('en-GB') : ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `banks_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

async function exportBanksPdf() {
  try {
    const res = await fetch(`${API_BASE}/api/cheque-conversion/export/pdf`);
    if (!res.ok) throw new Error('PDF export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    alert('PDF Export Error: ' + err.message);
  }
}
/* ================================================================ */

/* ---------------- Stock Adjustments Functions ---------------- */
let cachedStockAdjustments = [];

function renderStockAdjustmentsTable(list) {
  const tbody = document.getElementById('stockAdjustmentsList');
  if (!tbody) return;
  tbody.innerHTML = '';

  const fmtDate = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    if (isNaN(d)) return String(v).split('T')[0] || '-';
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  list.forEach(adj => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${adj.product || '-'}</td>
      <td>${adj.batch || '-'}</td>
      <td>${adj.quantity ?? '-'}</td>
      <td>${Number(adj.rate ?? 0).toFixed(4)}</td>
      <td>${fmtDate(adj.expiry_date)}</td>
      <td>${Number(adj.cost_price ?? 0).toFixed(4)}</td>
      <td>${Number(adj.sales_tax ?? adj.salesTax ?? 0).toFixed(4)}</td>
      <td>${adj.store || '-'}</td>
      <td>${fmtDate(adj.date)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editStockAdjustment(${adj.id})">Edit</button>
        <button class="btn btn-sm btn-outline-success me-1" onclick="viewStockAdjustmentPdf(${adj.id})">PDF</button>
        <button class="btn btn-sm btn-danger" onclick="deleteStockAdjustment(${adj.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Populate the form with an existing stock record for editing
window.editStockAdjustment = function (id) {
  const adj = cachedStockAdjustments.find(a => a.id === id);
  if (!adj) return alert('Stock record not found.');

  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
  setVal('saProduct', adj.product || '');
  setVal('saBatch', adj.batch || '');
  setVal('saQuantity', adj.quantity ?? '');
  setVal('saRate', adj.rate ?? '');
  setVal('saCostPrice', adj.cost_price ?? '');
  setVal('saSalesTax', adj.sales_tax ?? '');
  setVal('saStore', adj.store || '');

  // Dates — format to YYYY-MM-DD for date inputs
  const toInputDate = (v) => {
    if (!v) return '';
    try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
  };
  setVal('saExpiryDate', toInputDate(adj.expiry_date));
  setVal('saDate', toInputDate(adj.date));

  // Switch form to Edit mode
  document.getElementById('saEditId').value = String(id);
  document.getElementById('saSubmitBtn').textContent = 'Update Stock';
  const cancelBtn = document.getElementById('saCancelEdit');
  if (cancelBtn) cancelBtn.classList.remove('d-none');

  // Scroll form into view
  document.getElementById('stockAdjustmentForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

async function loadStockAdjustments() {
  try {
    const res = await fetch(`${API_BASE}/api/stock-adjustments`);
    if (!res.ok) throw new Error('Failed to load stock adjustments');
    cachedStockAdjustments = await res.json();

    renderStockAdjustmentsTable(cachedStockAdjustments);

    // Wire search bar
    const searchEl = document.getElementById('stockAdjustmentsSearch');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        const q = searchEl.value.trim().toLowerCase();
        if (!q) {
          renderStockAdjustmentsTable(cachedStockAdjustments);
          return;
        }
        const filtered = cachedStockAdjustments.filter(adj => {
          return (
            String(adj.product || '').toLowerCase().includes(q) ||
            String(adj.batch || '').toLowerCase().includes(q) ||
            String(adj.store || '').toLowerCase().includes(q) ||
            String(adj.status || '').toLowerCase().includes(q)
          );
        });
        renderStockAdjustmentsTable(filtered);
      });
    }
  } catch (err) {
    console.error('Failed to load stock adjustments', err);
  }
}

// Open Stock Adjustment PDF
window.viewStockAdjustmentPdf = function (id) {
  try {
    window.open(`${API_BASE}/api/stock-adjustments/${id}/pdf`, '_blank');
  } catch (err) {
    console.error('Open stock adjustment PDF failed', err);
    alert('Could not open PDF');
  }
};

async function approveStockAdjustment(id) {
  if (!confirm('Approve this stock adjustment?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/stock-adjustments/${id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'Manager' })
    });
    if (!res.ok) throw new Error('Approve failed');
    await loadStockAdjustments();
    alert('Stock approved');
  } catch (err) {
    console.error('Approve failed', err);
    alert('Approve failed: ' + err.message);
  }
}

async function rejectStockAdjustment(id) {
  const reason = prompt('Enter rejection reason:');
  if (!reason) return;
  try {
    const res = await fetch(`${API_BASE}/api/stock-adjustments/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'Manager', reason })
    });
    if (!res.ok) throw new Error('Reject failed');
    await loadStockAdjustments();
    alert('Stock rejected');
  } catch (err) {
    console.error('Reject failed', err);
    alert('Reject failed: ' + err.message);
  }
}

async function deleteStockAdjustment(id) {
  if (!confirm('Delete this stock record?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/stock-adjustments/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error('Delete failed');
    await loadStockAdjustments();
    alert('Stock record deleted');
  } catch (err) {
    console.error('Delete failed', err);
    alert('Delete failed: ' + err.message);
  }
}

async function exportStockAdjustmentsCsv() {
  try {
    const res = await fetch(`${API_BASE}/api/stock-adjustments`);
    const data = await res.json();
    if (!data.length) return alert('No stocks to export');

    const csv = [['ID', 'Product', 'Batch', 'Type', 'Quantity', 'Reason', 'Date', 'Status', 'Approved By'],
    ...data.map(adj => [adj.id, `"${adj.product}"`, `"${adj.batch || ''}"`, adj.adjustmentType, adj.quantity, `"${adj.reason}"`, adj.date, adj.status, `"${adj.approvedBy || ''}"`])
    ].map(r => r.join(',')).join('\n');
    downloadCsv(csv, 'stock_adjustments.csv');
  } catch (err) {
    console.error('CSV export failed', err);
    alert('Failed to export CSV');
  }
}

async function exportStockAdjustmentsPdf() {
  try {
    window.open(`${API_BASE}/api/stock-adjustments/export/pdf`, '_blank');
  } catch (err) {
    console.error('PDF export failed', err);
    alert('Failed to export PDF');
  }
}

/* ---------- Delivery Summary integration (renderer.js) ---------- */

// Add navigation handler (inside your nav click bindings)
// ensure you have a nav link: <a class="nav-link" data-target="page-delivery-summary">Delivery Summary</a>
// wiring example (if your code enumerates links): add a branch
// when clicking the link you'll already call showPage('page-delivery-summary'); below we call loadDeliverySummary() from that handler

// Hook filter/export buttons after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const filterBtn = document.getElementById('filterDeliveryBtn');
  if (filterBtn) filterBtn.addEventListener('click', applyDeliveryFilters);

  const resetFilterBtn = document.getElementById('resetDeliveryFilterBtn');
  if (resetFilterBtn) resetFilterBtn.addEventListener('click', () => {
    document.getElementById('dsFrom').value = '';
    document.getElementById('dsTo').value = '';
    document.getElementById('dsRoute').value = '';
    document.getElementById('dsDriverVehicle').value = '';
    loadDeliverySummary();
  });

  const addForm = document.getElementById('addDeliveryForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          tripId: document.getElementById('dsTripId')?.value.trim(),
          route: document.getElementById('dsRouteInput')?.value.trim(),
          vehicle: document.getElementById('dsVehicle')?.value.trim(),
          driver: document.getElementById('dsDriver')?.value.trim(),
          loadedQty: Number(document.getElementById('dsLoadedQty')?.value) || 0,
          deliveredQty: Number(document.getElementById('dsDeliveredQty')?.value) || 0,
          returnedQty: Number(document.getElementById('dsReturnedQty')?.value) || 0,
          notes: document.getElementById('dsNotes')?.value.trim(),
          date: new Date().toISOString().split('T')[0]
        };

        const res = await fetch(`${API_BASE}/api/delivery-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to save');

        addForm.reset();
        await loadDeliverySummary();
        alert('Trip saved');
      } catch (err) {
        console.error('Save trip failed', err);
        alert('Save failed: ' + (err.message || err));
      }
    });
  }

  const exportCsvBtn = document.getElementById('exportDeliveryCsv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportDeliveryCsv);
  const exportPdfBtn = document.getElementById('exportDeliveryPdf');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => {
    window.open(`${API_BASE}/api/delivery-summary/report/pdf`, '_blank'); // you'll need to implement report/pdf on server if required
  });

  // POD modal wiring
  const podFileInput = document.getElementById('podFileInput');
  const uploadPodBtn = document.getElementById('uploadPodBtn');
  if (uploadPodBtn) {
    uploadPodBtn.addEventListener('click', async () => {
      const filename = podFileInput?.files?.[0];
      if (!filename) return alert('Please choose a file first');
      if (!window._currentPodRecordId) return alert('No record selected');

      const fd = new FormData();
      fd.append('pod', filename);

      try {
        const res = await fetch(`${API_BASE}/api/delivery-summary/${window._currentPodRecordId}/pod`, {
          method: 'POST',
          body: fd
        });
        if (!res.ok) throw new Error('Upload failed');

        $('#podModal').modal('hide'); // for bootstrap v4/5 jQuery usage, or use bootstrap.Modal API
        await loadDeliverySummary();
        alert('POD uploaded');
      } catch (err) {
        console.error('POD upload failed', err);
        alert('Upload failed: ' + (err.message || err));
      }
    });
  }
});

/* ---------- loadDeliverySummary ---------- */
async function loadDeliverySummary(filters) {
  try {
    const res = await fetch(`${API_BASE}/api/delivery-summary`);
    if (!res.ok) throw new Error('Fetch failed');
    let data = await res.json();
    if (!Array.isArray(data)) data = [];

    // apply simple client-side filters
    if (!filters) {
      const from = document.getElementById('dsFrom')?.value;
      const to = document.getElementById('dsTo')?.value;
      const routeFilter = document.getElementById('dsRoute')?.value?.trim().toLowerCase();
      const dv = document.getElementById('dsDriverVehicle')?.value?.trim().toLowerCase();
      filters = { from, to, routeFilter, dv };
    }

    data = data.filter(item => {
      if (filters.from && item.date < filters.from) return false;
      if (filters.to && item.date > filters.to) return false;
      if (filters.routeFilter && !String(item.route || '').toLowerCase().includes(filters.routeFilter)) return false;
      if (filters.dv && !(`${item.driver} ${item.vehicle}`.toLowerCase()).includes(filters.dv)) return false;
      return true;
    });

    // render table
    const tbody = document.getElementById('deliverySummaryList');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${it.id}</td>
        <td>${escapeHtml(it.tripId)}</td>
        <td>${escapeHtml(it.route)}</td>
        <td>${escapeHtml(it.vehicle)}</td>
        <td>${escapeHtml(it.driver)}</td>
        <td>${it.loadedQty}</td>
        <td>${it.deliveredQty}</td>
        <td>${it.returnedQty}</td>
        <td>${it.podStatus === 'Captured' ? '<span class="badge bg-success">Captured</span>' : '<span class="badge bg-secondary">Not Captured</span>'}</td>
        <td>${it.date}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="openPodModal(${it.id}, '${it.podFilename || ''}')">View POD</button>
          <button class="btn btn-sm btn-danger me-1" onclick="deleteDelivery(${it.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('loadDeliverySummary error', err);
  }
}

function applyDeliveryFilters() {
  loadDeliverySummary(true);
}

/* ---------- View / Upload / Delete helpers ---------- */
window.openPodModal = function (id, podFilename) {
  window._currentPodRecordId = id;
  const img = document.getElementById('podPreview');
  if (podFilename) {
    img.src = `${API_BASE}/api/delivery-summary/pod/file/${podFilename}`;
  } else {
    img.src = '';
  }
  // reset file input
  document.getElementById('podFileInput').value = '';
  // show modal (Bootstrap)
  const modalEl = document.getElementById('podModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
};

async function deleteDelivery(id) {
  if (!confirm('Delete this trip?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/delivery-summary/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error('Delete failed');
    await loadDeliverySummary();
    alert('Deleted');
  } catch (err) {
    console.error('delete delivery failed', err);
    alert('Delete failed: ' + (err.message || err));
  }
}

/* ---------- small helpers ---------- */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function (s) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' })[s]; });
}

/* ---------- Export CSV ---------- */
async function exportDeliveryCsv() {
  try {
    const res = await fetch(`${API_BASE}/api/delivery-summary`);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (!data.length) return alert('No data to export');

    const rows = [
      ['ID', 'TripID', 'Route', 'Vehicle', 'Driver', 'Loaded', 'Delivered', 'Returned', 'POD Status', 'Date', 'Notes'],
      ...data.map(d => [
        d.id, `"${d.tripId || ''}"`, `"${d.route || ''}"`, `"${d.vehicle || ''}"`, `"${d.driver || ''}"`,
        d.loadedQty, d.deliveredQty, d.returnedQty, d.podStatus || '', d.date, `"${(d.notes || '').replace(/"/g, '""')}"`
      ])
    ].map(r => r.join(',')).join('\n');

    downloadCsv(rows, 'delivery_summary.csv');
  } catch (err) {
    console.error('export delivery csv failed', err);
    alert('Export failed');
  }
}

/* ---------- ensure this page loads on startup if last page ---------- */
/* Add this to your existing 'restore last page' block */

// Load Summary Collection
function loadSummaryCollection() {
  fetch(`${API_BASE}/api/summary-collection`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('summaryCollectionBody');
      tbody.innerHTML = '';
      data.forEach(s => {
        const row = `
          <tr>
            <td>${s.salesman}</td>
            <td>${s.route}</td>
            <td class="text-end">${parseFloat(s.expectedAmount || 0).toFixed(2)}
            </td>
            <td class="text-end">${parseFloat(s.collectedAmount || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(s.difference || 0).toFixed(2)}</td>
            <td class="text-center">${s.status || '-'}</td>
            <td>${s.date || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteSummary(${s.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading summary collection:', err));
}

// Add new summary
document.getElementById('summaryAddForm').addEventListener('submit', e => {
  e.preventDefault();

  const expectedAmount = parseFloat(document.getElementById('summaryExpected').value) || 0;
  const collectedAmount = parseFloat(document.getElementById('summaryAmount').value) || 0;
  const difference = expectedAmount - collectedAmount;
  const status = collectedAmount >= expectedAmount ? 'Complete' : 'Pending';

  const newSummary = {
    salesman: document.getElementById('summarySalesman').value.trim(),
    route: document.getElementById('summaryRoute').value.trim(),
    expectedAmount,
    collectedAmount,
    difference,
    status,
    reason: document.getElementById('summaryReason').value.trim(),
    notes: document.getElementById('summaryNotes').value.trim(),
    date: document.getElementById('summaryDate').value
  };

  fetch(`${API_BASE}/api/summary-collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSummary)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('summaryAddForm').reset();
      document.getElementById('summaryAddCard').style.display = 'none';
      loadSummaryCollection();
    })
    .catch(err => console.error('Error adding summary:', err));
});

// Delete summary
function deleteSummary(id) {
  if (confirm('Are you sure to delete this record?')) {
    fetch(`${API_BASE}/api/summary-collection/${id}`, { method: "DELETE" })
      .then(() => loadSummaryCollection())
      .catch(err => console.error('Error deleting summary:', err));
  }
}

// Buttons
document.getElementById('btnAddSummary').addEventListener('click', () => {
  document.getElementById('summaryAddCard').style.display = 'block';
});
document.getElementById('cancelSummaryAdd').addEventListener('click', () => {
  document.getElementById('summaryAddCard').style.display = 'none';
});
document.getElementById('btnExportSummaryPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/summary-collection/report/pdf`, '_blank');
});


// ===== 2.1 Discount Claim =====

// Load all claims
function loadDiscountClaims() {
  fetch(`${API_BASE}/api/discount-claims`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('discountClaimBody');
      tbody.innerHTML = '';
      data.forEach(c => {
        const row = `
          <tr>
            <td>${c.vendorName}</td>
            <td>${c.schemeName}</td>
            <td>${c.invoicePeriod}</td>
            <td class="text-end">${parseFloat(c.claimAmount).toFixed(2)}</td>
            <td class="text-center">${c.claimStatus}</td>
            <td>${c.claimDate}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteDiscountClaim(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading discount claims:', err));
}

// Add new claim
document.getElementById('discountClaimForm').addEventListener('submit', e => {
  e.preventDefault();
  const newClaim = {
    vendorName: document.getElementById('vendorName').value,
    schemeName: document.getElementById('schemeName').value,
    invoicePeriod: document.getElementById('invoicePeriod').value,
    claimAmount: document.getElementById('claimAmount').value,
    claimStatus: document.getElementById('claimStatus').value,
    claimDate: document.getElementById('claimDate').value
  };

  fetch(`${API_BASE}/api/discount-claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newClaim)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('discountClaimAddCard').style.display = 'none';
      loadDiscountClaims();
    });

});
/* Load data automatically when page loads */
document.addEventListener("DOMContentLoaded", () => {
  loadDiscountClaims();
});


// Delete claim
function deleteDiscountClaim(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/discount-claims/${id}`, { method: "DELETE" })
      .then(() => loadDiscountClaims());
  }
}

// Buttons
document.getElementById('btnAddDiscountClaim').addEventListener('click', () => {
  document.getElementById('discountClaimAddCard').style.display = 'block';
});

document.getElementById('cancelDiscountClaimAdd').addEventListener('click', () => {
  document.getElementById('discountClaimAddCard').style.display = 'none';
});

document.getElementById('btnExportDiscountClaimPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/discount-claims/report/pdf`, '_blank');
});


// ===== 2.2 Bonus Claim =====

// Load all bonus claims
function loadBonusClaims() {
  fetch(`${API_BASE}/api/bonus-claims`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('bonusClaimBody');
      tbody.innerHTML = '';
      data.forEach(c => {
        const row = `
          <tr>
            <td>${c.bonusVendor}</td>
            <td>${c.bonusScheme}</td>
            <td class="text-end">${c.promisedQty}</td>
            <td class="text-end">${c.receivedQty}</td>
            <td class="text-end">${parseFloat(c.valuation).toFixed(2)}</td>
            <td class="text-center">${c.bonusStatus}</td>
            <td>${c.bonusDate}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteBonusClaim(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading bonus claims:', err));
}

// Add new bonus claim
document.getElementById('bonusClaimForm').addEventListener('submit', e => {
  e.preventDefault();
  const newClaim = {
    bonusVendor: document.getElementById('bonusVendor').value,
    bonusScheme: document.getElementById('bonusScheme').value,
    promisedQty: document.getElementById('promisedQty').value,
    receivedQty: document.getElementById('receivedQty').value,
    valuation: document.getElementById('valuation').value,
    bonusStatus: document.getElementById('bonusStatus').value,
    bonusDate: document.getElementById('bonusDate').value
  };

  fetch(`${API_BASE}/api/bonus-claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newClaim)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('bonusClaimAddCard').style.display = 'none';
      loadBonusClaims();
    });
});

// Delete
function deleteBonusClaim(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/bonus-claims/${id}`, { method: "DELETE" })
      .then(() => loadBonusClaims());
  }
}

// Buttons
document.getElementById('btnAddBonusClaim').addEventListener('click', () => {
  document.getElementById('bonusClaimAddCard').style.display = 'block';
});

document.getElementById('cancelBonusClaimAdd').addEventListener('click', () => {
  document.getElementById('bonusClaimAddCard').style.display = 'none';
});

document.getElementById('btnExportBonusClaimPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/bonus-claims/export/pdf`, '_blank');
});

// Auto load
document.addEventListener("DOMContentLoaded", () => {
  loadBonusClaims();
});


// ===== 2.3 Claims Adjustment =====

// Load all claims adjustments
function loadClaimsAdjustments() {
  fetch(`${API_BASE}/api/claims-adjustments`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('claimsAdjustmentBody');
      tbody.innerHTML = '';
      data.forEach(c => {
        // Ensure numeric formatting digit-by-digit
        const adj = Number(c.adjustmentAmount || 0).toFixed(2);
        const settled = Number(c.settledAmount || 0).toFixed(2);
        const variance = Number(c.variance || 0).toFixed(2);

        const row = `
          <tr>
            <td>${escapeHtml(c.vendor)}</td>
            <td>${escapeHtml(c.claimRef)}</td>
            <td>${escapeHtml(c.invoiceRef)}</td>
            <td class="text-end">${adj}</td>
            <td class="text-end">${settled}</td>
            <td class="text-end">${variance}</td>
            <td class="text-center">${escapeHtml(c.status)}</td>
            <td>${c.date}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteClaimsAdjustment(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => {
      console.error('Load claims adjustments error:', err);
    });
}

// Small helper: escape HTML to avoid simple injection in table rendering
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Auto-calc variance when amounts change
const caAdjustmentAmountEl = document.getElementById('caAdjustmentAmount');
const caSettledAmountEl = document.getElementById('caSettledAmount');
const caVarianceEl = document.getElementById('caVariance');

function calcVarianceAndStatus() {
  const adj = parseFloat(caAdjustmentAmountEl.value || 0);
  const settled = parseFloat(caSettledAmountEl.value || 0);
  // digit-by-digit arithmetic: compute difference precisely using Number
  const variance = Number(adj - settled);
  caVarianceEl.value = variance.toFixed(2);

  // set status automatically if values make sense
  const statusEl = document.getElementById('caStatus');
  if (settled === 0) statusEl.value = 'Pending';
  else if (settled > 0 && settled < adj) statusEl.value = 'Partially Settled';
  else if (settled >= adj) statusEl.value = 'Settled';
}

if (caAdjustmentAmountEl && caSettledAmountEl) {
  caAdjustmentAmountEl.addEventListener('input', calcVarianceAndStatus);
  caSettledAmountEl.addEventListener('input', calcVarianceAndStatus);
}

// Add new claims adjustment
document.getElementById('claimsAdjustmentForm').addEventListener('submit', e => {
  e.preventDefault();

  // build object and ensure numeric conversions digit-by-digit
  const adjustmentAmount = Number(parseFloat(document.getElementById('caAdjustmentAmount').value || 0));
  const settledAmount = Number(parseFloat(document.getElementById('caSettledAmount').value || 0));
  const variance = Number(adjustmentAmount - settledAmount);

  const newRec = {
    id: Date.now(),
    vendor: document.getElementById('caVendor').value,
    claimRef: document.getElementById('caClaimRef').value,
    invoiceRef: document.getElementById('caInvoiceRef').value,
    adjustmentAmount: adjustmentAmount.toFixed(2),
    settledAmount: settledAmount.toFixed(2),
    variance: variance.toFixed(2),
    status: document.getElementById('caStatus').value,
    date: document.getElementById('caDate').value,
    notes: document.getElementById('caNotes').value || ''
  };

  fetch(`${API_BASE}/api/claims-adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRec)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('claimsAdjustmentAddCard').style.display = 'none';
      // clear form
      document.getElementById('claimsAdjustmentForm').reset();
      document.getElementById('caVariance').value = '';
      loadClaimsAdjustments();
    })
    .catch(err => {
      console.error('Save claims adjustment error:', err);
    });
});

// Delete record
function deleteClaimsAdjustment(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/claims-adjustments/${id}`, { method: "DELETE" })
      .then(() => loadClaimsAdjustments())
      .catch(err => console.error('Delete error:', err));
  }
}

// Buttons
document.getElementById('btnAddClaimsAdjustment').addEventListener('click', () => {
  document.getElementById('claimsAdjustmentAddCard').style.display = 'block';
});

document.getElementById('cancelClaimsAdjustmentAdd').addEventListener('click', () => {
  document.getElementById('claimsAdjustmentAddCard').style.display = 'none';
});

// Export PDF button
document.getElementById('btnExportClaimsAdjustmentPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/claims-adjustments/export/pdf`, '_blank');
});

// Auto load
document.addEventListener("DOMContentLoaded", () => {
  loadClaimsAdjustments();
});

// ===== 2.4 Open Claim =====

// Load Open Claims
function loadOpenClaims(filters = {}) {
  let url = `${API_BASE}/api/open-claims`;
  const params = new URLSearchParams(filters).toString();
  if (params) url += `?${params}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('openClaimBody');
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No records found</td></tr>`;
        return;
      }

      data.forEach(c => {
        const row = `
          <tr>
            <td>${escapeHtml(c.vendor)}</td>
            <td>${escapeHtml(c.brand)}</td>
            <td>${escapeHtml(c.month)}</td>
            <td class="text-end">${Number(c.claimAmount).toFixed(2)}</td>
            <td class="text-end">${Number(c.settledAmount).toFixed(2)}</td>
            <td class="text-end">${Number(c.pendingAmount).toFixed(2)}</td>
            <td class="text-center">${c.agingDays}</td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Load open claims error:', err));
}

// Filter
document.getElementById('btnFilterOpenClaims').addEventListener('click', () => {
  const filters = {
    vendor: document.getElementById('openClaimVendor').value,
    brand: document.getElementById('openClaimBrand').value,
    month: document.getElementById('openClaimMonth').value
  };
  loadOpenClaims(filters);
});

// Reset
document.getElementById('btnResetOpenClaims').addEventListener('click', () => {
  document.getElementById('openClaimVendor').value = '';
  document.getElementById('openClaimBrand').value = '';
  document.getElementById('openClaimMonth').value = '';
  loadOpenClaims();
});

// Export PDF
document.getElementById('btnExportOpenClaimPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/open-claims/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadOpenClaims();
});

// ===== 2.5 Store Expiry =====

// Calculate remaining days
function calcRemainingDays(expDate) {
  const today = new Date();
  const expiry = new Date(expDate);
  const diff = expiry - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Load batches
function loadStoreExpiry() {
  fetch(`${API_BASE}/api/store-expiry`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('storeExpiryBody');
      tbody.innerHTML = '';

      data.forEach(batch => {
        const daysLeft = calcRemainingDays(batch.expDate);
        const status =
          daysLeft <= 0
            ? '<span class="badge bg-danger">Expired</span>'
            : daysLeft <= 30
              ? '<span class="badge bg-warning text-dark">Near Expiry</span>'
              : '<span class="badge bg-success">Good</span>';

        const row = `
          <tr>
            <td>${escapeHtml(batch.batchNo)}</td>
            <td>${escapeHtml(batch.productName)}</td>
            <td>${escapeHtml(batch.vendorName)}</td>
            <td>${batch.mfgDate}</td>
            <td>${batch.expDate}</td>
            <td class="text-end">${daysLeft}</td>
            <td class="text-center">${status}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteStoreExpiry(${batch.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

// Add new batch
document.getElementById('storeExpiryForm').addEventListener('submit', e => {
  e.preventDefault();
  const newBatch = {
    batchNo: document.getElementById('batchNo').value,
    productName: document.getElementById('productName').value,
    vendorName: document.getElementById('vendorName').value,
    mfgDate: document.getElementById('mfgDate').value,
    expDate: document.getElementById('expDate').value
  };

  fetch(`${API_BASE}/api/store-expiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBatch)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('storeExpiryAddCard').style.display = 'none';
      document.getElementById('storeExpiryForm').reset();
      loadStoreExpiry();
    });
});

// Delete batch
function deleteStoreExpiry(id) {
  if (confirm('Are you sure you want to delete this batch?')) {
    fetch(`${API_BASE}/api/store-expiry/${id}`, { method: "DELETE" })
      .then(() => loadStoreExpiry());
  }
}

// Buttons
document.getElementById('btnAddStoreExpiry').addEventListener('click', () => {
  document.getElementById('storeExpiryAddCard').style.display = 'block';
});

document.getElementById('cancelStoreExpiryAdd').addEventListener('click', () => {
  document.getElementById('storeExpiryAddCard').style.display = 'none';
});

document.getElementById('btnExportStoreExpiryPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/store-expiry/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', loadStoreExpiry);

// ===== 2.6 Market Expiry =====

// Load customer dropdown from ERP Customers API
function loadCustomerDropdown() {
  fetch(`${API_BASE}/api/customers?limit=500`)
    .then(res => res.json())
    .then(data => {
      const customers = Array.isArray(data.customers) ? data.customers : (Array.isArray(data) ? data : []);
      const select = document.getElementById('marketCustomer');
      select.innerHTML = '<option value="">Select Customer</option>';
      customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error('Failed to load customers:', err));
}

// ===== Auto-fill Product Details when Customer Selected (from openInvoices.json) =====
function autoFillCustomerData(customerName) {
  if (!customerName) return;

  fetch(`${API_BASE}/api/open-invoices`)
    .then(res => res.json())
    .then(invoices => {
      console.log('Fetched open invoices:', invoices); // debug line

      // Find matching invoice for selected customer
      const invoice = invoices.find(inv => inv.customer === customerName);

      if (invoice && invoice.products && invoice.products.length > 0) {
        const product = invoice.products[0]; // use first product entry

        document.getElementById('marketProduct').value = product.name || '';
        document.getElementById('marketBatch').value = product.batch || '';
        document.getElementById('marketExpiryDate').value = product.expiry || '';
        document.getElementById('marketQty').value = product.qty || '';
      } else {
        // clear fields if no match found
        document.getElementById('marketProduct').value = '';
        document.getElementById('marketBatch').value = '';
        document.getElementById('marketExpiryDate').value = '';
        document.getElementById('marketQty').value = '';
      }
    })
    .catch(err => console.error('Auto-fill error:', err));
}

// Listen to customer dropdown change
document.getElementById('marketCustomer').addEventListener('change', (e) => {
  const selectedCustomer = e.target.value;
  autoFillCustomerData(selectedCustomer);
});

// Load all market expiry records
function loadMarketExpiry() {
  fetch(`${API_BASE}/api/market-expiry`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('marketExpiryBody');
      tbody.innerHTML = '';
      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.customer}</td>
            <td>${r.product}</td>
            <td>${r.batch}</td>
            <td>${r.expiry}</td>
            <td class="text-end">${r.qty}</td>
            <td class="text-center">${r.status}</td>
            <td>${r.vendorClaim || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteMarketExpiry(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

// Add new record
document.getElementById('marketExpiryForm').addEventListener('submit', e => {
  e.preventDefault();
  const newRecord = {
    customer: document.getElementById('marketCustomer').value,
    product: document.getElementById('marketProduct').value,
    batch: document.getElementById('marketBatch').value,
    expiry: document.getElementById('marketExpiryDate').value,
    qty: document.getElementById('marketQty').value,
    status: document.getElementById('marketStatus').value,
    vendorClaim: document.getElementById('marketVendorClaim').value
  };

  fetch(`${API_BASE}/api/market-expiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRecord)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('marketExpiryAddCard').style.display = 'none';
      loadMarketExpiry();
    });
});

// Delete record
function deleteMarketExpiry(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/market-expiry/${id}`, { method: "DELETE" })
      .then(() => loadMarketExpiry());
  }
}

// Buttons
document.getElementById('btnAddMarketExpiry').addEventListener('click', () => {
  loadCustomerDropdown();
  document.getElementById('marketExpiryAddCard').style.display = 'block';
});

document.getElementById('cancelMarketExpiryAdd').addEventListener('click', () => {
  document.getElementById('marketExpiryAddCard').style.display = 'none';
});

document.getElementById('btnExportMarketExpiryPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/market-expiry/export/pdf`, '_blank');
});

// Auto load records
document.addEventListener('DOMContentLoaded', () => {
  loadMarketExpiry();
});

// ===== 2.7 Regenerate Expiry by Receiving =====

// Load all records
function loadRegenerateExpiry() {
  fetch(`${API_BASE}/api/regenerate-expiry`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('regenerateExpiryBody');
      tbody.innerHTML = '';
      data.forEach((item) => {
        const row = `
          <tr>
            <td>${item.regenProduct}</td>
            <td>${item.regenBatch}</td>
            <td>${item.regenReceivedDate}</td>
            <td>${item.regenExpiryDate}</td>
            <td class="text-center">${item.remainingDays}</td>
            <td class="text-center">${item.fefoOrder}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteRegenerateExpiry(${item.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

// Add new batch
document.getElementById('regenerateExpiryForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const today = new Date();
  const expiry = new Date(document.getElementById('regenExpiryDate').value);
  const diffTime = expiry - today;
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const newBatch = {
    regenProduct: document.getElementById('regenProduct').value,
    regenBatch: document.getElementById('regenBatch').value,
    regenReceivedDate: document.getElementById('regenReceivedDate').value,
    regenExpiryDate: document.getElementById('regenExpiryDate').value,
    remainingDays: remainingDays > 0 ? remainingDays : 0
  };

  fetch(`${API_BASE}/api/regenerate-expiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBatch)
  })
    .then(() => {
      document.getElementById('regenerateExpiryAddCard').style.display = 'none';
      loadRegenerateExpiry();
    });
});

// Delete
function deleteRegenerateExpiry(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/regenerate-expiry/${id}`, { method: "DELETE" })
      .then(() => loadRegenerateExpiry());
  }
}

// Buttons
document.getElementById('btnAddRegenerateExpiry').addEventListener('click', () => {
  document.getElementById('regenerateExpiryAddCard').style.display = 'block';
});

document.getElementById('cancelRegenerateExpiryAdd').addEventListener('click', () => {
  document.getElementById('regenerateExpiryAddCard').style.display = 'none';
});

document.getElementById('btnExportRegenerateExpiryPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/regenerate-expiry/export/pdf`, '_blank');
});

// Auto-load
document.addEventListener('DOMContentLoaded', () => {
  loadRegenerateExpiry();
});

// ===== 3.1 Expense Type & Heads =====

// Load all Expense Heads
function loadExpenseTypes() {
  fetch(`${API_BASE}/api/expense-types`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('expenseTypeBody');
      tbody.innerHTML = '';
      data.forEach(e => {
        const row = `
          <tr>
            <td>${e.expenseHead}</td>
            <td>${e.costCenter}</td>
            <td>${e.projectName || '-'}</td>
            <td>${e.distributionKey}</td>
            <td>${e.taxCategory}</td>
            <td>${e.expenseDate}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteExpenseType(${e.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

// Add new Expense Head
document.getElementById('expenseTypeForm').addEventListener('submit', e => {
  e.preventDefault();
  const newExpense = {
    expenseHead: document.getElementById('expenseHead').value,
    costCenter: document.getElementById('costCenter').value,
    projectName: document.getElementById('projectName').value,
    distributionKey: document.getElementById('distributionKey').value,
    taxCategory: document.getElementById('taxCategory').value,
    expenseDate: document.getElementById('expenseDate').value
  };

  fetch(`${API_BASE}/api/expense-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newExpense)
  })
    .then(() => {
      document.getElementById('expenseTypeAddCard').style.display = 'none';
      e.target.reset();
      loadExpenseTypes();
    })
    .catch(err => console.error('Error adding expense type:', err));
});

// Buttons
document.getElementById('btnAddExpenseType').addEventListener('click', () => {
  document.getElementById('expenseTypeAddCard').style.display = 'block';
});

document.getElementById('cancelExpenseTypeAdd').addEventListener('click', () => {
  document.getElementById('expenseTypeAddCard').style.display = 'none';
});

document.getElementById('btnExportExpenseTypePDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/expense-types/export/pdf`, '_blank');
});

// Auto-load
document.addEventListener('DOMContentLoaded', () => {
  loadExpenseTypes();
});
// ======================= 3.2 Expense Vouchers =======================

// Load all expense vouchers
function loadExpenseVouchers() {
  fetch(`${API_BASE}/api/expense-vouchers`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('expenseVoucherBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const attachmentBtn = v.attachment
          ? `<button class="btn btn-sm btn-outline-primary" onclick="viewVoucherAttachment('${v.attachment}')">
               <i class="bi bi-paperclip"></i> View
             </button>`
          : `<span class="text-muted small">No File</span>`;

        const row = `
          <tr>
            <td>${v.voucherNo || '-'}</td>
            <td>${v.paymentMode || '-'}</td>
            <td>${v.expenseHead || (v.distribution?.[0]?.expenseHead || '-')}</td>
            <td class="text-end">${parseFloat(v.amount || 0).toFixed(2)}</td>
            <td>${v.paymentMode || '-'}</td>
            <td>${v.date || '-'}</td>
            <td>${v.status || '-'}</td>
            <td class="text-center">${attachmentBtn}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteExpenseVoucher(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading expense vouchers:', err));
}

// View attachment
function viewVoucherAttachment(filePath) {
  if (filePath) {
    window.open(`${API_BASE}${filePath}`, '_blank');
  } else {
    alert('No attachment available for this voucher.');
  }
}

// Delete voucher
function deleteExpenseVoucher(id) {
  if (confirm('Are you sure you want to delete this voucher?')) {
    fetch(`${API_BASE}/api/expense-vouchers/${id}`, { method: 'DELETE' })
      .then(() => loadExpenseVouchers());
  }
}

// Add new distribution line
document.getElementById('addDistributionLine').addEventListener('click', () => {
  const tbody = document.getElementById('distributionBody');
  const newRow = document.createElement('tr');
  newRow.innerHTML = `
    <td><input type="text" class="form-control expense-head" placeholder="Expense Head" required></td>
    <td><input type="text" class="form-control cost-center" placeholder="Cost Center" required></td>
    <td><input type="number" class="form-control line-amount" placeholder="Amount" required></td>
    <td class="text-center"><button type="button" class="btn btn-sm btn-danger remove-line"><i class="bi bi-trash"></i></button></td>
  `;
  tbody.appendChild(newRow);
});

// Remove distribution line
document.getElementById('distributionTable').addEventListener('click', e => {
  if (e.target.closest('.remove-line')) {
    e.target.closest('tr').remove();
  }
});

// Save Expense Voucher
document.getElementById('expenseVoucherForm').addEventListener('submit', async e => {
  e.preventDefault();

  const formData = new FormData();
  const voucherNo = document.getElementById('voucherNumber').value.trim();
  const voucherDate = document.getElementById('voucherDate').value;
  const paymentMode = document.getElementById('paymentMode').value;
  const voucherStatus = document.getElementById('voucherStatus').value;
  const fileInput = document.getElementById('voucherAttachment');
  const attachment = fileInput.files[0];

  // Collect multi-line distribution lines
  const lines = [];
  document.querySelectorAll('#distributionBody tr').forEach(row => {
    const expenseHead = row.querySelector('.expense-head')?.value || '';
    const costCenter = row.querySelector('.cost-center')?.value || '';
    const amount = parseFloat(row.querySelector('.line-amount')?.value || 0);
    lines.push({ expenseHead, costCenter, amount });
  });

  // Calculate total amount
  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

  // Build the final voucher object
  const newVoucher = {
    voucherNo,
    voucherType: paymentMode === 'Petty Cash' ? 'Petty Cash Voucher' : 'Bank Voucher',
    expenseHead: lines.length ? lines[0].expenseHead : '',
    amount: totalAmount,
    paymentMode,
    date: voucherDate,
    status: voucherStatus,
    lines
  };

  // Attach fields to FormData
  formData.append('data', JSON.stringify(newVoucher));
  if (attachment) formData.append('attachment', attachment);

  try {
    const res = await fetch(`${API_BASE}/api/expense-vouchers`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('Expense Voucher saved successfully!');
      document.getElementById('expenseVoucherForm').reset();
      document.getElementById('distributionBody').innerHTML = '';
      document.getElementById('expenseVoucherAddCard').style.display = 'none';
      loadExpenseVouchers();
    } else {
      alert('Failed to save voucher. Please try again.');
    }
  } catch (err) {
    console.error('Error saving expense voucher:', err);
    alert('Error saving expense voucher.');
  }
});


// Buttons
document.getElementById('btnAddExpenseVoucher').addEventListener('click', () => {
  document.getElementById('expenseVoucherAddCard').style.display = 'block';
});

document.getElementById('cancelExpenseVoucherAdd').addEventListener('click', () => {
  document.getElementById('expenseVoucherAddCard').style.display = 'none';
});

document.getElementById('btnExportExpenseVoucherPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/expense-vouchers/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadExpenseVouchers();
});
// ======================= 4.1 Cheque Entry =======================

// Load Cheques
function loadCheques() {
  fetch(`${API_BASE}/api/cheque-entry`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('chequeBody');
      tbody.innerHTML = '';

      data.forEach(chq => {
        const row = `
          <tr>
            <td>${chq.chequeNo || '-'}</td>
            <td>${chq.customer || '-'}</td>
            <td>${chq.bank || '-'}</td>
            <td class="text-end">${parseFloat(chq.amount || 0).toFixed(2)}</td>
            <td>${chq.date || '-'}</td>
            <td>${chq.status || '-'}</td>
            <td>${chq.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteCheque(${chq.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading cheques:', err));
}

// Add Cheque
document.getElementById('chequeForm').addEventListener('submit', e => {
  e.preventDefault();

  const newCheque = {
    chequeNo: document.getElementById('chequeNo').value.trim(),
    customer: document.getElementById('chequeCustomerName').value.trim(),
    bank: document.getElementById('chequeBankName').value.trim(),
    amount: parseFloat(document.getElementById('chequeAmountValue').value) || 0,
    date: document.getElementById('chequeDateValue').value,
    status: document.getElementById('chequeStatusValue').value,
    remarks: document.getElementById('chequeRemarksValue').value.trim()
  };

  console.log('Submitting cheque:', newCheque);

  fetch(`${API_BASE}/api/cheque-entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCheque)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('chequeAddCard').style.display = 'none';
      e.target.reset();
      loadCheques();
    })
    .catch(err => console.error('Error adding cheque:', err));
});

// Delete Cheque
function deleteCheque(id) {
  if (confirm('Are you sure you want to delete this cheque?')) {
    fetch(`${API_BASE}/api/cheque-entry/${id}`, { method: 'DELETE' })
      .then(() => loadCheques());
  }
}

// Buttons
document.getElementById('btnAddCheque').addEventListener('click', () => {
  document.getElementById('chequeAddCard').style.display = 'block';
});
document.getElementById('cancelChequeAdd').addEventListener('click', () => {
  document.getElementById('chequeAddCard').style.display = 'none';
});
document.getElementById('btnExportChequePDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/cheque-entry/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', loadCheques);

// ======================= 4.2 Bank Deposit Voucher =======================

// Load Deposits
function loadDeposits() {
  fetch(`${API_BASE}/api/bank-deposits`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('depositBody');
      tbody.innerHTML = '';

      data.forEach(d => {
        const row = `
          <tr>
            <td>${d.voucherNo || '-'}</td>
            <td>${d.slipNo || '-'}</td>
            <td>${d.bank || '-'}</td>
            <td class="text-end">${parseFloat(d.amount || 0).toFixed(2)}</td>
            <td>${d.date || '-'}</td>
            <td>${d.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteDeposit(${d.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading deposits:', err));
}

// Add Deposit
document.getElementById('depositForm').addEventListener('submit', e => {
  e.preventDefault();

  const newDeposit = {
    voucherNo: document.getElementById('depositVoucherNo').value.trim(),
    slipNo: document.getElementById('depositSlipNo').value.trim(),
    bank: document.getElementById('depositBank').value.trim(),
    amount: parseFloat(document.getElementById('depositAmount').value) || 0,
    date: document.getElementById('depositDate').value,
    remarks: document.getElementById('depositRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/bank-deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newDeposit)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('depositAddCard').style.display = 'none';
      e.target.reset();
      loadDeposits();
    })
    .catch(err => console.error('Error adding deposit:', err));
});

// Delete Deposit
function deleteDeposit(id) {
  if (confirm('Are you sure you want to delete this deposit record?')) {
    fetch(`${API_BASE}/api/bank-deposits/${id}`, { method: 'DELETE' })
      .then(() => loadDeposits());
  }
}

// Buttons
document.getElementById('btnAddDeposit').addEventListener('click', () => {
  document.getElementById('depositAddCard').style.display = 'block';
});
document.getElementById('cancelDepositAdd').addEventListener('click', () => {
  document.getElementById('depositAddCard').style.display = 'none';
});
document.getElementById('btnExportDepositPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/bank-deposits/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadDeposits();
});
// ======================= 4.3 Cheque Conversion =======================


// NOTE: Cheque Conversion module has been replaced by Banks (4.3).
// All Banks logic is handled by loadBanks() — see BANKS MODULE section above.



// ======================= 4.6 Vendor Credit Note =======================

// Load all credits
function loadVendorCredits() {
  fetch(`${API_BASE}/api/vendor-credit-notes`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('vendorCreditBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const row = `
          <tr>
            <td>${v.creditNoteNo || '-'}</td>
            <td>${v.vendorName || '-'}</td>
            <td>${v.reference || '-'}</td>
            <td class="text-end">${parseFloat(v.amount || 0).toFixed(2)}</td>
            <td>${v.date || '-'}</td>
            <td>${v.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteVendorCredit(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading vendor credits:', err));
}

// Add new vendor credit note
document.getElementById('vendorCreditForm').addEventListener('submit', e => {
  e.preventDefault();

  const newCredit = {
    creditNoteNo: document.getElementById('creditNoteNoField').value.trim(),
    vendorName: document.getElementById('creditVendorField').value.trim(),
    reference: document.getElementById('creditReferenceField').value.trim(),
    amount: parseFloat(document.getElementById('creditAmountField').value) || 0,
    date: document.getElementById('creditDateField').value,
    remarks: document.getElementById('creditRemarksField').value.trim()
  };

  console.log('Submitting Vendor Credit:', newCredit);

  fetch(`${API_BASE}/api/vendor-credit-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCredit)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('vendorCreditAddCard').style.display = 'none';
      e.target.reset();
      loadVendorCredits();
    })
    .catch(err => console.error('Error adding vendor credit:', err));
});

// Delete vendor credit
function deleteVendorCredit(id) {
  if (confirm('Are you sure you want to delete this credit note?')) {
    fetch(`${API_BASE}/api/vendor-credit-notes/${id}`, { method: 'DELETE' })
      .then(() => loadVendorCredits());
  }
}

// Buttons
document.getElementById('btnAddVendorCredit').addEventListener('click', () => {
  document.getElementById('vendorCreditAddCard').style.display = 'block';
});
document.getElementById('cancelVendorCreditAdd').addEventListener('click', () => {
  document.getElementById('vendorCreditAddCard').style.display = 'none';
});
document.getElementById('btnExportVendorCreditPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/vendor-credit-notes/export/pdf`, '_blank');
});

// Auto-load
document.addEventListener('DOMContentLoaded', () => {
  loadVendorCredits();
});

// ======================= 5.1 Bank / Cash Payment =======================

// ======================= 5.1 Bank / Cash Payment =======================

document.addEventListener('DOMContentLoaded', () => {
  // Load Payments
  function loadBankPayments() {
    fetch(`${API_BASE}/api/bank-payments`)
      .then(res => res.json())
      .then(data => {
        const tbody = document.getElementById('bankPaymentBody');
        tbody.innerHTML = '';

        data.forEach(p => {
          const row = `
            <tr>
              <td>${p.paymentNo || '-'}</td>
              <td>${p.type || '-'}</td>
              <td>${p.payee || '-'}</td>
              <td>${p.account || '-'}</td>
              <td class="text-end">${parseFloat(p.amount || 0).toFixed(2)}</td>
              <td>${p.date || '-'}</td>
              <td>${p.remarks || '-'}</td>
              <td class="text-center">
                <button class="btn btn-danger btn-sm" onclick="deleteBankPayment(${p.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`;
          tbody.insertAdjacentHTML('beforeend', row);
        });
      })
      .catch(err => console.error('Error loading payments:', err));
  }

  // Submit using FormData (robust)
  const bankPaymentForm = document.getElementById('bankPaymentForm');
  bankPaymentForm.addEventListener('submit', e => {
    e.preventDefault();

    const fd = new FormData(e.target);
    const newPayment = {
      paymentNo: (fd.get('paymentNumber') || '').toString().trim(),
      type: (fd.get('paymentType') || '').toString().trim(),
      payee: (fd.get('paymentPayee') || '').toString().trim(),
      account: (fd.get('paymentAccount') || '').toString().trim(),
      amount: parseFloat(fd.get('paymentAmount') || 0) || 0,
      date: (fd.get('paymentDate') || '').toString(),
      remarks: (fd.get('paymentRemarks') || '').toString().trim()
    };

    // Debug log to confirm values before sending
    console.log('Submitting payment via FormData:', newPayment);

    fetch(`${API_BASE}/api/bank-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment)
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById('bankPaymentAddCard').style.display = 'none';
        e.target.reset();
        loadBankPayments();
      })
      .catch(err => console.error('Error adding payment:', err));
  });

  // Delete
  window.deleteBankPayment = function (id) {
    if (confirm('Are you sure you want to delete this payment?')) {
      fetch(`${API_BASE}/api/bank-payments/${id}`, { method: 'DELETE' })
        .then(() => loadBankPayments());
    }
  };

  // Buttons
  document.getElementById('btnAddBankPayment').addEventListener('click', () => {
    document.getElementById('bankPaymentAddCard').style.display = 'block';
  });
  document.getElementById('cancelBankPaymentAdd').addEventListener('click', () => {
    document.getElementById('bankPaymentAddCard').style.display = 'none';
  });
  document.getElementById('btnExportBankPaymentPDF').addEventListener('click', () => {
    window.open(`${API_BASE}/api/bank-payments/export/pdf`, '_blank');
  });

  // initial load
  loadBankPayments();
});

// ======================= 5.2 Customer/Vendor Debit Note & Credit Note =======================

document.addEventListener('DOMContentLoaded', () => {
  function loadDebitCreditNotes() {
    fetch(`${API_BASE}/api/debit-credit`)
      .then(res => res.json())
      .then(data => {
        const tbody = document.getElementById('debitCreditBody');
        tbody.innerHTML = '';
        data.forEach(n => {
          const row = `
            <tr>
              <td>${n.noteNo || '-'}</td>
              <td>${n.type || '-'}</td>
              <td>${n.party || '-'}</td>
              <td>${n.category || '-'}</td>
              <td class="text-end">${parseFloat(n.amount || 0).toFixed(2)}</td>
              <td>${n.date || '-'}</td>
              <td>${n.remarks || '-'}</td>
              <td class="text-center">
                <button class="btn btn-danger btn-sm" onclick="deleteDebitCredit(${n.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`;
          tbody.insertAdjacentHTML('beforeend', row);
        });
      });
  }

  // Add Note
  document.getElementById('debitCreditForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newNote = {
      noteNo: fd.get('noteNumber').trim(),
      type: fd.get('noteType').trim(),
      party: fd.get('noteParty').trim(),
      category: fd.get('noteCategory').trim(),
      amount: parseFloat(fd.get('noteAmount')) || 0,
      date: fd.get('noteDate'),
      remarks: fd.get('noteRemarks').trim()
    };

    fetch(`${API_BASE}/api/debit-credit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNote)
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById('debitCreditAddCard').style.display = 'none';
        e.target.reset();
        loadDebitCreditNotes();
      });
  });

  // Delete
  window.deleteDebitCredit = id => {
    if (confirm('Are you sure you want to delete this note?')) {
      fetch(`${API_BASE}/api/debit-credit/${id}`, { method: 'DELETE' })
        .then(() => loadDebitCreditNotes());
    }
  };

  // Buttons
  document.getElementById('btnAddDebitCredit').addEventListener('click', () => {
    document.getElementById('debitCreditAddCard').style.display = 'block';
  });
  document.getElementById('cancelDebitCreditAdd').addEventListener('click', () => {
    document.getElementById('debitCreditAddCard').style.display = 'none';
  });
  document.getElementById('btnExportDebitCreditPDF').addEventListener('click', () => {
    window.open(`${API_BASE}/api/debit-credit/export/pdf`, '_blank');
  });

  loadDebitCreditNotes();
});

// ======================= 5.3 Vendor Payment / Vendor Receipt =======================

function loadVendorPayments() {
  fetch(`${API_BASE}/api/vendor-payments`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('vendorPaymentBody');
      tbody.innerHTML = '';

      data.forEach(p => {
        const row = `
          <tr>
            <td>${p.paymentNo || '-'}</td>
            <td>${p.type || '-'}</td>
            <td>${p.vendor || '-'}</td>
            <td>${p.mode || '-'}</td>
            <td class="text-end">${parseFloat(p.amount || 0).toFixed(2)}</td>
            <td>${p.date || '-'}</td>
            <td>${p.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteVendorPayment(${p.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading vendor payments:', err));
}

document.getElementById('vendorPaymentForm').addEventListener('submit', e => {
  e.preventDefault();

  const newPayment = {
    paymentNo: document.getElementById('vendorPaymentNo').value.trim(),
    type: document.getElementById('vendorPaymentType').value.trim(),
    vendor: document.getElementById('vendorPaymentVendor').value.trim(),
    mode: document.getElementById('vendorPaymentMode').value.trim(),
    amount: parseFloat(document.getElementById('vendorPaymentAmount').value) || 0,
    date: document.getElementById('vendorPaymentDate').value,
    remarks: document.getElementById('vendorPaymentRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/vendor-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPayment)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('vendorPaymentAddCard').style.display = 'none';
      e.target.reset();
      loadVendorPayments();
    })
    .catch(err => console.error('Error adding vendor payment:', err));
});

function deleteVendorPayment(id) {
  if (confirm('Are you sure you want to delete this vendor payment?')) {
    fetch(`${API_BASE}/api/vendor-payments/${id}`, { method: 'DELETE' })
      .then(() => loadVendorPayments());
  }
}

document.getElementById('btnAddVendorPayment').addEventListener('click', () => {
  document.getElementById('vendorPaymentAddCard').style.display = 'block';
});
document.getElementById('cancelVendorPaymentAdd').addEventListener('click', () => {
  document.getElementById('vendorPaymentAddCard').style.display = 'none';
});
document.getElementById('btnExportVendorPaymentPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/vendor-payments/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', () => {
  loadVendorPayments();
});

// ======================= 5.4 Customer Payment / Customer Receipt =======================

function loadCustomerPayments() {
  fetch(`${API_BASE}/api/customer-payments`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('customerPaymentBody');
      tbody.innerHTML = '';

      data.forEach(p => {
        const row = `
          <tr>
            <td>${p.paymentNo || '-'}</td>
            <td>${p.type || '-'}</td>
            <td>${p.customer || '-'}</td>
            <td>${p.mode || '-'}</td>
            <td class="text-end">${parseFloat(p.amount || 0).toFixed(2)}</td>
            <td>${p.date || '-'}</td>
            <td>${p.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteCustomerPayment(${p.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading customer payments:', err));
}

document.getElementById('customerPaymentForm').addEventListener('submit', e => {
  e.preventDefault();

  const newPayment = {
    paymentNo: document.getElementById('customerPaymentNo').value.trim(),
    type: document.getElementById('customerPaymentType').value.trim(),
    customer: document.getElementById('customerPaymentCustomer').value.trim(),
    mode: document.getElementById('customerPaymentMode').value.trim(),
    amount: parseFloat(document.getElementById('customerPaymentAmount').value) || 0,
    date: document.getElementById('customerPaymentDate').value,
    remarks: document.getElementById('customerPaymentRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/customer-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPayment)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('customerPaymentAddCard').style.display = 'none';
      e.target.reset();
      loadCustomerPayments();
    })
    .catch(err => console.error('Error adding customer payment:', err));
});

function deleteCustomerPayment(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/customer-payments/${id}`, { method: 'DELETE' })
      .then(() => loadCustomerPayments());
  }
}

document.getElementById('btnAddCustomerPayment').addEventListener('click', () => {
  document.getElementById('customerPaymentAddCard').style.display = 'block';
});
document.getElementById('cancelCustomerPaymentAdd').addEventListener('click', () => {
  document.getElementById('customerPaymentAddCard').style.display = 'none';
});
document.getElementById('btnExportCustomerPaymentPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/customer-payments/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', () => {
  loadCustomerPayments();
});

// ======================= 5.5 Customer/Vendor Opening (Debit/Credit) =======================

function loadOpeningBalances() {
  fetch(`${API_BASE}/api/opening-balances`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('openingBalanceBody');
      tbody.innerHTML = '';

      data.forEach(e => {
        const row = `
          <tr>
            <td>${e.entryNo || '-'}</td>
            <td>${e.type || '-'}</td>
            <td>${e.entity || '-'}</td>
            <td class="text-end">${parseFloat(e.debit || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(e.credit || 0).toFixed(2)}</td>
            <td>${e.date || '-'}</td>
            <td>${e.remarks || '-'}</td>
            <td>${e.auditStatus || 'Pending'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteOpeningBalance(${e.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading opening balances:', err));
}

// Add new
document.getElementById('openingBalanceForm').addEventListener('submit', e => {
  e.preventDefault();

  const newEntry = {
    entryNo: document.getElementById('openingEntryNo').value.trim(),
    type: document.getElementById('openingType').value.trim(),
    entity: document.getElementById('openingEntity').value.trim(),
    debit: parseFloat(document.getElementById('openingDebit').value) || 0,
    credit: parseFloat(document.getElementById('openingCredit').value) || 0,
    date: document.getElementById('openingDate').value,
    remarks: document.getElementById('openingRemarks').value.trim(),
    auditStatus: 'Pending'
  };

  fetch(`${API_BASE}/api/opening-balances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEntry)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('openingBalanceAddCard').style.display = 'none';
      e.target.reset();
      loadOpeningBalances();
    })
    .catch(err => console.error('Error adding opening balance:', err));
});

// Delete
function deleteOpeningBalance(id) {
  if (confirm('Are you sure you want to delete this entry?')) {
    fetch(`${API_BASE}/api/opening-balances/${id}`, { method: 'DELETE' })
      .then(() => loadOpeningBalances());
  }
}

// Buttons
document.getElementById('btnAddOpeningBalance').addEventListener('click', () => {
  document.getElementById('openingBalanceAddCard').style.display = 'block';
});
document.getElementById('cancelOpeningBalanceAdd').addEventListener('click', () => {
  document.getElementById('openingBalanceAddCard').style.display = 'none';
});
document.getElementById('btnExportOpeningPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/opening-balances/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadOpeningBalances();
});

// ======================= 5.6 Employee Receipt (Expense Returns / Advances) =======================

function loadEmployeeReceipts() {
  fetch(`${API_BASE}/api/employee-receipts`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('employeeReceiptBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.receiptNo || '-'}</td>
            <td>${r.type || '-'}</td>
            <td>${r.employee || '-'}</td>
            <td class="text-end">${parseFloat(r.amount || 0).toFixed(2)}</td>
            <td>${r.date || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteEmployeeReceipt(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading employee receipts:', err));
}

// 🟢 Add
document.getElementById('employeeReceiptForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReceipt = {
    receiptNo: document.getElementById('employeeReceiptNo').value.trim(),
    type: document.getElementById('employeeReceiptType').value.trim(),
    employee: document.getElementById('employeeReceiptEmployee').value.trim(),
    amount: parseFloat(document.getElementById('employeeReceiptAmount').value) || 0,
    date: document.getElementById('employeeReceiptDate').value,
    remarks: document.getElementById('employeeReceiptRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/employee-receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReceipt)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('employeeReceiptAddCard').style.display = 'none';
      e.target.reset();
      loadEmployeeReceipts();
    })
    .catch(err => console.error('Error adding employee receipt:', err));
});

// 🗑️ Delete
function deleteEmployeeReceipt(id) {
  if (confirm('Are you sure you want to delete this receipt?')) {
    fetch(`${API_BASE}/api/employee-receipts/${id}`, { method: 'DELETE' })
      .then(() => loadEmployeeReceipts());
  }
}

// Buttons
document.getElementById('btnAddEmployeeReceipt').addEventListener('click', () => {
  document.getElementById('employeeReceiptAddCard').style.display = 'block';
});
document.getElementById('cancelEmployeeReceiptAdd').addEventListener('click', () => {
  document.getElementById('employeeReceiptAddCard').style.display = 'none';
});
document.getElementById('btnExportEmployeeReceiptPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/employee-receipts/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadEmployeeReceipts();
});


// ======================= 5.7 Knock-Off Document (Inter-Company Netting) =======================

function loadKnockOffs() {
  fetch(`${API_BASE}/api/knockoff-documents`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('knockOffBody');
      tbody.innerHTML = '';

      data.forEach(k => {
        const net = (parseFloat(k.receivable || 0) - parseFloat(k.payable || 0)).toFixed(2);
        const row = `
          <tr>
            <td>${k.knockOffNo || '-'}</td>
            <td>${k.party || '-'}</td>
            <td class="text-end">${parseFloat(k.receivable || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(k.payable || 0).toFixed(2)}</td>
            <td class="text-end">${net}</td>
            <td>${k.date || '-'}</td>
            <td>${k.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteKnockOff(${k.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading knock-off documents:', err));
}

// Add Knock-Off
document.getElementById('knockOffForm').addEventListener('submit', e => {
  e.preventDefault();

  const newKnockOff = {
    knockOffNo: document.getElementById('knockOffNo').value.trim(),
    party: document.getElementById('knockOffParty').value.trim(),
    receivable: parseFloat(document.getElementById('knockOffReceivable').value) || 0,
    payable: parseFloat(document.getElementById('knockOffPayable').value) || 0,
    netAmount: parseFloat(document.getElementById('knockOffReceivable').value) -
      parseFloat(document.getElementById('knockOffPayable').value),
    date: document.getElementById('knockOffDate').value,
    remarks: document.getElementById('knockOffRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/knockoff-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newKnockOff)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('knockOffAddCard').style.display = 'none';
      e.target.reset();
      loadKnockOffs();
    })
    .catch(err => console.error('Error adding knock-off document:', err));
});

// Delete
function deleteKnockOff(id) {
  if (confirm('Are you sure you want to delete this Knock-Off?')) {
    fetch(`${API_BASE}/api/knockoff-documents/${id}`, { method: 'DELETE' })
      .then(() => loadKnockOffs());
  }
}

// Buttons
document.getElementById('btnAddKnockOff').addEventListener('click', () => {
  document.getElementById('knockOffAddCard').style.display = 'block';
});
document.getElementById('cancelKnockOffAdd').addEventListener('click', () => {
  document.getElementById('knockOffAddCard').style.display = 'none';
});
document.getElementById('btnExportKnockOffPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/knockoff-documents/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadKnockOffs();
});

// ======================= 6.1 Company / Group / Contacts Masters =======================

// Load contacts
function loadContacts() {
  fetch(`${API_BASE}/api/contacts`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('contactsBody');
      tbody.innerHTML = '';

      data.forEach(c => {
        const row = `
          <tr>
            <td>${c.company || '-'}</td>
            <td>${c.name || '-'}</td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
            <td>${c.consentSMS || '-'}</td>
            <td>${c.consentEmail || '-'}</td>
            <td>${c.preference || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteContact(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading contacts:', err));
}

// Add contact
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();

  const newContact = {
    company: document.getElementById('contactCompany').value.trim(),
    name: document.getElementById('contactName').value.trim(),
    phone: document.getElementById('contactPhone').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    consentSMS: document.getElementById('contactConsentSMS').value,
    consentEmail: document.getElementById('contactConsentEmail').value,
    preference: document.getElementById('contactPreference').value
  };

  fetch(`${API_BASE}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newContact)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('contactAddCard').style.display = 'none';
      e.target.reset();
      loadContacts();
    })
    .catch(err => console.error('Error adding contact:', err));
});

// Delete contact
function deleteContact(id) {
  if (confirm('Are you sure you want to delete this contact?')) {
    fetch(`${API_BASE}/api/contacts/${id}`, { method: 'DELETE' })
      .then(() => loadContacts());
  }
}

// Buttons
document.getElementById('btnAddContact').addEventListener('click', () => {
  document.getElementById('contactAddCard').style.display = 'block';
});
document.getElementById('cancelContactAdd').addEventListener('click', () => {
  document.getElementById('contactAddCard').style.display = 'none';
});
document.getElementById('btnExportContactsPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/contacts/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadContacts();
});

// ======================= 6.2 SMS Statuses / Orders / Schedules =======================

// Load SMS Orders
function loadSMSOrders() {
  fetch(`${API_BASE}/api/sms-orders`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('smsBody');
      tbody.innerHTML = '';
      data.forEach(o => {
        const row = `
          <tr>
            <td>${o.orderId || '-'}</td>
            <td>${o.recipient || '-'}</td>
            <td>${o.message || '-'}</td>
            <td><span class="badge bg-${getSMSStatusColor(o.status)}">${o.status}</span></td>
            <td>${o.schedule || '-'}</td>
            <td>${o.createdAt || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteSMSOrder(${o.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading SMS orders:', err));
}

function getSMSStatusColor(status) {
  switch (status) {
    case 'Queued': return 'secondary';
    case 'Sent': return 'info';
    case 'Delivered': return 'success';
    case 'Failed': return 'danger';
    default: return 'light';
  }
}

// Add new SMS
document.getElementById('smsForm').addEventListener('submit', e => {
  e.preventDefault();
  const newOrder = {
    orderId: 'SPD-' + Math.floor(Math.random() * 10000),
    recipient: document.getElementById('smsRecipient').value.trim(),
    message: document.getElementById('smsMessage').value.trim(),
    status: document.getElementById('smsStatus').value,
    schedule: document.getElementById('smsSchedule').value || 'Immediate',
    createdAt: new Date().toLocaleString()
  };
  fetch(`${API_BASE}/api/sms-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newOrder)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('smsAddCard').style.display = 'none';
      e.target.reset();
      loadSMSOrders();
    })
    .catch(err => console.error('Error adding SMS order:', err));
});

// Delete
function deleteSMSOrder(id) {
  if (confirm('Delete this SMS order?')) {
    fetch(`${API_BASE}/api/sms-orders/${id}`, { method: 'DELETE' })
      .then(() => loadSMSOrders());
  }
}

// Buttons
document.getElementById('btnAddSMS').addEventListener('click', () => {
  document.getElementById('smsAddCard').style.display = 'block';
});
document.getElementById('cancelSMSAdd').addEventListener('click', () => {
  document.getElementById('smsAddCard').style.display = 'none';
});
document.getElementById('btnExportSMSPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/sms-orders/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadSMSOrders();
});

// ======================= 6.3 Email Groups / Email Schedule =======================

// Load Email Schedules
function loadEmailSchedules() {
  fetch(`${API_BASE}/api/email-schedules`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('emailBody');
      tbody.innerHTML = '';

      data.forEach(e => {
        const row = `
          <tr>
            <td>${e.group || '-'}</td>
            <td>${e.recipient || '-'}</td>
            <td>${e.subject || '-'}</td>
            <td>${truncateText(e.template, 40)}</td>
            <td>${e.schedule || '-'}</td>
            <td><span class="badge bg-${getEmailStatusColor(e.status)}">${e.status}</span></td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteEmailSchedule(${e.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading email schedules:', err));
}

function getEmailStatusColor(status) {
  switch (status) {
    case 'Scheduled': return 'secondary';
    case 'Sent': return 'success';
    case 'Failed': return 'danger';
    default: return 'light';
  }
}

function truncateText(text, maxLen) {
  if (!text) return '-';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

// Add Email Schedule
document.getElementById('emailForm').addEventListener('submit', e => {
  e.preventDefault();

  const newEmail = {
    id: Date.now(),
    group: document.getElementById('emailGroup').value.trim(),
    recipient: document.getElementById('emailRecipient').value.trim(),
    subject: document.getElementById('emailSubject').value.trim(),
    template: document.getElementById('emailTemplate').value.trim(),
    schedule: document.getElementById('emailSchedule').value,
    status: document.getElementById('emailStatus').value,
    createdAt: new Date().toLocaleString()
  };

  fetch(`${API_BASE}/api/email-schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEmail)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('emailAddCard').style.display = 'none';
      e.target.reset();
      loadEmailSchedules();
    })
    .catch(err => console.error('Error adding email schedule:', err));
});

// Delete Email
function deleteEmailSchedule(id) {
  if (confirm('Delete this email schedule?')) {
    fetch(`${API_BASE}/api/email-schedules/${id}`, { method: 'DELETE' })
      .then(() => loadEmailSchedules());
  }
}

// Buttons
document.getElementById('btnAddEmail').addEventListener('click', () => {
  document.getElementById('emailAddCard').style.display = 'block';
});
document.getElementById('cancelEmailAdd').addEventListener('click', () => {
  document.getElementById('emailAddCard').style.display = 'none';
});
document.getElementById('btnExportEmailPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/email-schedules/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadEmailSchedules();
});

// ======================= 6.4 Opt-Out Compliance & Audit Log =======================

// Load Audit Entries
function loadAuditLogs() {
  fetch(`${API_BASE}/api/audit-logs`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('auditBody');
      tbody.innerHTML = '';

      data.forEach(a => {
        const row = `
          <tr>
            <td>${a.messageID || '-'}</td>
            <td>${a.recipient || '-'}</td>
            <td>${a.channel || '-'}</td>
            <td><span class="badge bg-${getAuditStatusColor(a.status)}">${a.status}</span></td>
            <td>${a.optOut === 'Yes' ? '<span class="badge bg-danger">Yes</span>' : '<span class="badge bg-success">No</span>'}</td>
            <td>${a.dateSent || '-'}</td>
            <td>${a.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteAuditLog(${a.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading audit logs:', err));
}

function getAuditStatusColor(status) {
  switch (status) {
    case 'Queued': return 'secondary';
    case 'Sent': return 'info';
    case 'Delivered': return 'success';
    case 'Failed': return 'danger';
    default: return 'light';
  }
}

// Add Audit Log
document.getElementById('auditForm').addEventListener('submit', e => {
  e.preventDefault();

  const newAudit = {
    id: Date.now(),
    messageID: document.getElementById('auditMessageID').value.trim(),
    recipient: document.getElementById('auditRecipient').value.trim(),
    channel: document.getElementById('auditChannel').value,
    status: document.getElementById('auditStatus').value,
    optOut: document.getElementById('auditOptOut').value,
    dateSent: document.getElementById('auditDate').value,
    remarks: document.getElementById('auditRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/audit-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newAudit)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('auditAddCard').style.display = 'none';
      e.target.reset();
      loadAuditLogs();
    })
    .catch(err => console.error('Error adding audit log:', err));
});

// Delete
function deleteAuditLog(id) {
  if (confirm('Are you sure you want to delete this log?')) {
    fetch(`${API_BASE}/api/audit-logs/${id}`, { method: 'DELETE' })
      .then(() => loadAuditLogs());
  }
}

// Buttons
document.getElementById('btnAddAudit').addEventListener('click', () => {
  document.getElementById('auditAddCard').style.display = 'block';
});
document.getElementById('cancelAuditAdd').addEventListener('click', () => {
  document.getElementById('auditAddCard').style.display = 'none';
});
document.getElementById('btnExportAuditPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/audit-logs/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadAuditLogs();
});

// ======================= 7.1 Sales Target =======================

// Load Sales Targets
function loadSalesTargets() {
  fetch(`${API_BASE}/api/sales-targets`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('salesTargetBody');
      tbody.innerHTML = '';

      data.forEach(t => {
        const row = `
          <tr>
            <td>${t.targetNo || '-'}</td>
            <td>${t.rep || '-'}</td>
            <td>${t.customer || '-'}</td>
            <td>${t.item || '-'}</td>
            <td>${t.period || '-'}</td>
            <td class="text-end">${parseFloat(t.amount || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(t.achieved || 0).toFixed(2)}</td>
            <td>${t.status || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteSalesTarget(${t.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading sales targets:', err));
}

// Add Target
document.getElementById('salesTargetForm').addEventListener('submit', e => {
  e.preventDefault();

  const newTarget = {
    targetNo: document.getElementById('targetNumber').value.trim(),
    rep: document.getElementById('targetRep').value.trim(),
    customer: document.getElementById('targetCustomer').value.trim(),
    item: document.getElementById('targetItem').value.trim(),
    period: document.getElementById('targetPeriod').value,
    amount: parseFloat(document.getElementById('targetAmount').value) || 0,
    achieved: parseFloat(document.getElementById('targetAchieved').value) || 0,
    status: document.getElementById('targetStatus').value
  };

  fetch(`${API_BASE}/api/sales-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newTarget)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('salesTargetAddCard').style.display = 'none';
      e.target.reset();
      loadSalesTargets();
    })
    .catch(err => console.error('Error adding sales target:', err));
});

// Delete Target
function deleteSalesTarget(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/sales-targets/${id}`, { method: 'DELETE' })
      .then(() => loadSalesTargets());
  }
}

// Buttons
document.getElementById('btnAddSalesTarget').addEventListener('click', () => {
  document.getElementById('salesTargetAddCard').style.display = 'block';
});
document.getElementById('cancelSalesTargetAdd').addEventListener('click', () => {
  document.getElementById('salesTargetAddCard').style.display = 'none';
});
document.getElementById('btnExportSalesTargetPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/sales-targets/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadSalesTargets();
});

// ======================= 7.2 Employee Incentives =======================

// Load Incentives
function loadIncentives() {
  fetch(`${API_BASE}/api/employee-incentives`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('incentiveBody');
      tbody.innerHTML = '';

      data.forEach(i => {
        const row = `
          <tr>
            <td>${i.employee || '-'}</td>
            <td>${i.targetType || '-'}</td>
            <td class="text-end">${parseFloat(i.achieved || 0).toFixed(2)}%</td>
            <td class="text-end">${parseFloat(i.amount || 0).toFixed(2)}</td>
            <td>${i.month || '-'}</td>
            <td>${i.status || '-'}</td>
            <td>${i.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteIncentive(${i.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading incentives:', err));
}

// Add Incentive
document.getElementById('incentiveForm').addEventListener('submit', e => {
  e.preventDefault();

  const newIncentive = {
    id: Date.now(),
    employee: document.getElementById('incentiveEmployee').value.trim(),
    targetType: document.getElementById('incentiveTargetType').value,
    achieved: parseFloat(document.getElementById('incentiveAchieved').value) || 0,
    amount: parseFloat(document.getElementById('incentiveAmount').value) || 0,
    month: document.getElementById('incentiveMonth').value,
    status: document.getElementById('incentiveStatus').value,
    remarks: document.getElementById('incentiveRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/employee-incentives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newIncentive)
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      document.getElementById('incentiveAddCard').style.display = 'none';
      loadIncentives();
    });
});

// Delete
function deleteIncentive(id) {
  if (confirm('Are you sure you want to delete this incentive?')) {
    fetch(`${API_BASE}/api/employee-incentives/${id}`, { method: 'DELETE' })
      .then(() => loadIncentives());
  }
}

// Buttons
document.getElementById('btnAddIncentive').addEventListener('click', () => {
  document.getElementById('incentiveAddCard').style.display = 'block';
});
document.getElementById('cancelIncentiveAdd').addEventListener('click', () => {
  document.getElementById('incentiveAddCard').style.display = 'none';
});
document.getElementById('btnExportIncentivePDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/employee-incentives/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', loadIncentives);

// ======================= 7.3 Fleet / Route =======================

// Load fleet records
function loadFleet() {
  fetch(`${API_BASE}/api/fleet-route`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('fleetBody');
      tbody.innerHTML = '';

      data.forEach(f => {
        const row = `
          <tr>
            <td>${f.vehicleType || '-'}</td>
            <td>${f.vehicleNo || '-'}</td>
            <td>${f.driver || '-'}</td>
            <td>${f.routePlan || '-'}</td>
            <td class="text-end">${parseFloat(f.fuel || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(f.maintenance || 0).toFixed(2)}</td>
            <td>${f.date || '-'}</td>
            <td>${f.gpsImported || '-'}</td>
            <td>${f.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteFleet(${f.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading fleet:', err));
}

// Add Fleet Record
document.getElementById('fleetForm').addEventListener('submit', e => {
  e.preventDefault();

  const newFleet = {
    id: Date.now(),
    vehicleType: document.getElementById('fleetVehicleType').value.trim(),
    vehicleNo: document.getElementById('fleetVehicleNo').value.trim(),
    driver: document.getElementById('fleetDriver').value.trim(),
    routePlan: document.getElementById('fleetRoutePlan').value.trim(),
    fuel: parseFloat(document.getElementById('fleetFuel').value) || 0,
    maintenance: parseFloat(document.getElementById('fleetMaintenance').value) || 0,
    date: document.getElementById('fleetDate').value,
    gpsImported: document.getElementById('fleetGPS').value,
    remarks: document.getElementById('fleetRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/fleet-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newFleet)
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      document.getElementById('fleetAddCard').style.display = 'none';
      loadFleet();
    });
});

// Delete Fleet Record
function deleteFleet(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/fleet-route/${id}`, { method: 'DELETE' })
      .then(() => loadFleet());
  }
}

// Buttons
document.getElementById('btnAddFleet').addEventListener('click', () => {
  document.getElementById('fleetAddCard').style.display = 'block';
});
document.getElementById('cancelFleetAdd').addEventListener('click', () => {
  document.getElementById('fleetAddCard').style.display = 'none';
});
document.getElementById('btnExportFleetPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/fleet-route/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', loadFleet);

// ======================= 8.1 Sales Reports =======================

// Load Sales Reports
function loadSalesReports() {
  fetch(`${API_BASE}/api/sales-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('salesReportsBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.type || '-'}</td>
            <td>${r.reference || '-'}</td>
            <td>${r.repOrRoute || '-'}</td>
            <td>${r.itemOrBrand || '-'}</td>
            <td>${r.customer || '-'}</td>
            <td class="text-end">${parseFloat(r.booked || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(r.invoiced || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(r.returns || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(r.margin || 0).toFixed(2)}</td>
            <td>${r.date || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteSalesReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading Sales Reports:', err));
}

// Add Report
document.getElementById('salesReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    id: Date.now(),
    type: document.getElementById('salesType').value.trim(),
    reference: document.getElementById('salesReference').value.trim(),
    repOrRoute: document.getElementById('salesRepRoute').value.trim(),
    itemOrBrand: document.getElementById('salesItemBrand').value.trim(),
    customer: document.getElementById('salesCustomer').value.trim(),
    booked: parseFloat(document.getElementById('salesBooked').value) || 0,
    invoiced: parseFloat(document.getElementById('salesInvoiced').value) || 0,
    returns: parseFloat(document.getElementById('salesReturns').value) || 0,
    margin: parseFloat(document.getElementById('salesMargin').value) || 0,
    date: document.getElementById('salesDate').value
  };

  fetch(`${API_BASE}/api/sales-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('salesReportAddCard').style.display = 'none';
      e.target.reset();
      loadSalesReports();
    })
    .catch(err => console.error('Error adding Sales Report:', err));
});

// Delete Report
function deleteSalesReport(id) {
  if (confirm('Are you sure you want to delete this report?')) {
    fetch(`${API_BASE}/api/sales-reports/${id}`, { method: 'DELETE' })
      .then(() => loadSalesReports())
      .catch(err => console.error('Error deleting report:', err));
  }
}

// Buttons
document.getElementById('btnAddSalesReport').addEventListener('click', () => {
  document.getElementById('salesReportAddCard').style.display = 'block';
});
document.getElementById('cancelSalesReportAdd').addEventListener('click', () => {
  document.getElementById('salesReportAddCard').style.display = 'none';
});
document.getElementById('btnExportSalesReportPDF')?.addEventListener('click', () => {
  const searchInput = document.getElementById('salesReportsSearch');
  const query = searchInput ? searchInput.value.trim() : '';
  window.open(`${API_BASE}/api/sales-reports/export/pdf?search=${encodeURIComponent(query)}`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => {
  loadSalesReports();
});

// ======================= 8.2 Inventory Reports =======================

function loadInventoryReports() {
  fetch(`${API_BASE}/api/inventory-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('inventoryReportBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.type || '-'}</td>
            <td>${r.batch || '-'}</td>
            <td>${r.expiry || '-'}</td>
            <td>${r.item || '-'}</td>
            <td>${r.qty || 0}</td>
            <td>${r.status || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteInventoryReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading inventory reports:', err));
}

document.getElementById('inventoryReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    type: document.getElementById('inventoryType').value.trim(),
    batch: document.getElementById('inventoryBatch').value.trim(),
    expiry: document.getElementById('inventoryExpiry').value,
    item: document.getElementById('inventoryItem').value.trim(),
    qty: parseInt(document.getElementById('inventoryQty').value) || 0,
    status: document.getElementById('inventoryStatus').value.trim(),
    remarks: document.getElementById('inventoryRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/inventory-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('inventoryReportAddCard').style.display = 'none';
      e.target.reset();
      loadInventoryReports();
    })
    .catch(err => console.error('Error adding inventory report:', err));
});

function deleteInventoryReport(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/inventory-reports/${id}`, { method: 'DELETE' })
      .then(() => loadInventoryReports());
  }
}

document.getElementById('btnAddInventoryReport').addEventListener('click', () => {
  document.getElementById('inventoryReportAddCard').style.display = 'block';
});
document.getElementById('cancelInventoryReportAdd').addEventListener('click', () => {
  document.getElementById('inventoryReportAddCard').style.display = 'none';
});
document.getElementById('btnExportInventoryReportPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/inventory-reports/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', () => {
  loadInventoryReports();
});

// ======================= 8.3 Finance Reports =======================

function loadFinanceReports() {
  fetch(`${API_BASE}/api/finance-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('financeReportBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.type || '-'}</td>
            <td>${r.account || '-'}</td>
            <td>${r.code || '-'}</td>
            <td class="text-end">${parseFloat(r.debit || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(r.credit || 0).toFixed(2)}</td>
            <td>${r.date || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteFinanceReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading finance reports:', err));
}

document.getElementById('financeReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    type: document.getElementById('financeType').value.trim(),
    account: document.getElementById('financeAccount').value.trim(),
    code: document.getElementById('financeCode').value.trim(),
    debit: parseFloat(document.getElementById('financeDebit').value) || 0,
    credit: parseFloat(document.getElementById('financeCredit').value) || 0,
    date: document.getElementById('financeDate').value,
    remarks: document.getElementById('financeRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/finance-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('financeReportAddCard').style.display = 'none';
      e.target.reset();
      loadFinanceReports();
    })
    .catch(err => console.error('Error adding finance report:', err));
});

function deleteFinanceReport(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/finance-reports/${id}`, { method: 'DELETE' })
      .then(() => loadFinanceReports());
  }
}

document.getElementById('btnAddFinanceReport').addEventListener('click', () => {
  document.getElementById('financeReportAddCard').style.display = 'block';
});
document.getElementById('cancelFinanceReportAdd').addEventListener('click', () => {
  document.getElementById('financeReportAddCard').style.display = 'none';
});
document.getElementById('btnExportFinanceReportPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/finance-reports/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', () => {
  loadFinanceReports();
});

// ======================= 8.4 Claims Reports =======================

function loadClaimReports() {
  fetch(`${API_BASE}/api/claims-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('claimReportBody');
      tbody.innerHTML = '';

      data.forEach(c => {
        const row = `
          <tr>
            <td>${c.claimId || '-'}</td>
            <td>${c.vendor || '-'}</td>
            <td>${c.type || '-'}</td>
            <td class="text-end">${parseFloat(c.claimAmount || 0).toFixed(2)}</td>
            <td>${c.status || '-'}</td>
            <td>${c.aging || '-'}</td>
            <td>${c.claimDate || '-'}</td>
            <td>${c.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteClaimReport(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading claim reports:', err));
}

// ✅ Add new claim report
document.getElementById('claimReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newClaim = {
    claimId: document.getElementById('claimReportId').value.trim(),
    vendor: document.getElementById('claimReportVendor').value.trim(),
    type: document.getElementById('claimReportType').value.trim(),
    claimAmount: parseFloat(document.getElementById('claimReportAmount').value) || 0,
    status: document.getElementById('claimReportStatus').value.trim(),
    aging: document.getElementById('claimReportAging').value.trim(),
    claimDate: document.getElementById('claimReportDate').value,
    remarks: document.getElementById('claimReportRemarks').value.trim()
  };

  console.log("Submitting claim:", newClaim);

  fetch(`${API_BASE}/api/claims-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newClaim)
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      document.getElementById('claimReportAddCard').style.display = 'none';
      loadClaimReports();
    })
    .catch(err => console.error('Error adding claim report:', err));
});

function deleteClaimReport(id) {
  if (confirm('Are you sure you want to delete this claim?')) {
    fetch(`${API_BASE}/api/claims-reports/${id}`, { method: 'DELETE' })
      .then(() => loadClaimReports());
  }
}

document.getElementById('btnAddClaimReport').addEventListener('click', () => {
  document.getElementById('claimReportAddCard').style.display = 'block';
});
document.getElementById('cancelClaimReportAdd').addEventListener('click', () => {
  document.getElementById('claimReportAddCard').style.display = 'none';
});
document.getElementById('btnExportClaimReportPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/claims-reports/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', loadClaimReports);

// ======================= 8.5 Payroll Reports =======================

function loadPayrollReports() {
  fetch(`${API_BASE}/api/payroll-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('payrollReportBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.reportId || '-'}</td>
            <td>${r.employeeName || '-'}</td>
            <td>${r.department || '-'}</td>
            <td class="text-end">${r.attendance || 0}%</td>
            <td class="text-end">${parseFloat(r.payslip || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(r.incentive || 0).toFixed(2)}</td>
            <td>${r.reportDate || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deletePayrollReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading payroll reports:', err));
}

document.getElementById('payrollReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    reportId: document.getElementById('payrollReportId').value.trim(),
    employeeName: document.getElementById('payrollReportEmployee').value.trim(),
    department: document.getElementById('payrollReportDepartment').value.trim(),
    attendance: parseFloat(document.getElementById('payrollReportAttendance').value) || 0,
    payslip: parseFloat(document.getElementById('payrollReportPayslip').value) || 0,
    incentive: parseFloat(document.getElementById('payrollReportIncentive').value) || 0,
    reportDate: document.getElementById('payrollReportDate').value,
    remarks: document.getElementById('payrollReportRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/payroll-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('payrollReportAddCard').style.display = 'none';
      e.target.reset();
      loadPayrollReports();
    })
    .catch(err => console.error('Error adding payroll report:', err));
});

function deletePayrollReport(id) {
  if (confirm('Are you sure you want to delete this report?')) {
    fetch(`${API_BASE}/api/payroll-reports/${id}`, { method: 'DELETE' })
      .then(() => loadPayrollReports());
  }
}

document.getElementById('btnAddPayrollReport').addEventListener('click', () => {
  document.getElementById('payrollReportAddCard').style.display = 'block';
});
document.getElementById('cancelPayrollReportAdd').addEventListener('click', () => {
  document.getElementById('payrollReportAddCard').style.display = 'none';
});
document.getElementById('btnExportPayrollPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/payroll-reports/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', loadPayrollReports);

// ======================= 8.6 Distribution Reports =======================

// Load all
function loadDistributionReports() {
  fetch(`${API_BASE}/api/distribution-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('distributionReportBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.reportId || '-'}</td>
            <td>${r.type || '-'}</td>
            <td>${r.route || '-'}</td>
            <td class="text-end">${r.efficiency || 0}</td>
            <td class="text-end">${r.podExceptions || 0}</td>
            <td class="text-end">${parseFloat(r.profit || 0).toFixed(2)}</td>
            <td>${r.date || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteDistributionReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading distribution reports:', err));
}

// Add Report
document.getElementById('distributionReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    reportId: document.getElementById('distributionReportID').value.trim(),
    type: document.getElementById('distributionType').value.trim(),
    route: document.getElementById('distributionRoute').value.trim(),
    efficiency: document.getElementById('distributionEfficiency').value.trim(),
    podExceptions: document.getElementById('distributionPOD').value.trim(),
    profit: document.getElementById('distributionProfit').value.trim(),
    date: document.getElementById('distributionDate').value,
    remarks: document.getElementById('distributionRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/distribution-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      document.getElementById('distributionReportAddCard').style.display = 'none';
      loadDistributionReports();
    })
    .catch(err => console.error('Error adding report:', err));
});

// Delete
function deleteDistributionReport(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/distribution-reports/${id}`, { method: 'DELETE' })
      .then(() => loadDistributionReports());
  }
}

// Buttons
document.getElementById('btnAddDistributionReport').addEventListener('click', () => {
  document.getElementById('distributionReportAddCard').style.display = 'block';
});
document.getElementById('cancelDistributionReportAdd').addEventListener('click', () => {
  document.getElementById('distributionReportAddCard').style.display = 'none';
});
document.getElementById('btnExportDistributionReportPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/distribution-reports/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadDistributionReports();
});

// ======================= 8.7 Admin & Audit Reports =======================

// Load all
function loadAdminAuditReports() {
  fetch(`${API_BASE}/api/admin-audit-reports`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('adminAuditReportBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.reportId || '-'}</td>
            <td>${r.user || '-'}</td>
            <td>${r.activityType || '-'}</td>
            <td>${r.module || '-'}</td>
            <td>${r.status || '-'}</td>
            <td>${r.dateTime || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteAdminAuditReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading admin audit reports:', err));
}

// Add new
document.getElementById('adminAuditReportForm').addEventListener('submit', e => {
  e.preventDefault();

  const newReport = {
    reportId: document.getElementById('adminAuditReportID').value.trim(),
    user: document.getElementById('adminAuditUser').value.trim(),
    activityType: document.getElementById('adminAuditActivity').value.trim(),
    module: document.getElementById('adminAuditModule').value.trim(),
    status: document.getElementById('adminAuditStatus').value.trim(),
    dateTime: document.getElementById('adminAuditDate').value,
    remarks: document.getElementById('adminAuditRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/admin-audit-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      document.getElementById('adminAuditReportAddCard').style.display = 'none';
      loadAdminAuditReports();
    })
    .catch(err => console.error('Error adding admin audit report:', err));
});

// Delete
function deleteAdminAuditReport(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/admin-audit-reports/${id}`, { method: 'DELETE' })
      .then(() => loadAdminAuditReports());
  }
}

// Buttons
document.getElementById('btnAddAdminAuditReport').addEventListener('click', () => {
  document.getElementById('adminAuditReportAddCard').style.display = 'block';
});
document.getElementById('cancelAdminAuditReportAdd').addEventListener('click', () => {
  document.getElementById('adminAuditReportAddCard').style.display = 'none';
});
document.getElementById('btnExportAdminAuditReportPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/admin-audit-reports/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadAdminAuditReports();
});

// ======================= 10.1 Pending Orders / Purchase Order =======================

// Load Orders
function loadPurchaseOrders() {
  fetch(`${API_BASE}/api/purchase-orders`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('purchaseOrderBody');
      tbody.innerHTML = '';

      data.forEach(po => {
        const row = `
          <tr>
            <td>${po.poNo || '-'}</td>
            <td>${po.vendor || '-'}</td>
            <td>${po.item || '-'}</td>
            <td>${po.quantity || '-'}</td>
            <td>${po.moq || '-'}</td>
            <td>${po.leadTime || '-'}</td>
            <td>${po.status || '-'}</td>
            <td>${po.date || '-'}</td>
            <td>${po.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deletePurchaseOrder(${po.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading purchase orders:', err));
}

// Delete
function deletePurchaseOrder(id) {
  if (confirm('Are you sure you want to delete this order?')) {
    fetch(`${API_BASE}/api/purchase-orders/${id}`, { method: 'DELETE' })
      .then(() => loadPurchaseOrders());
  }
}

// Buttons
document.getElementById('btnAddPurchaseOrder').addEventListener('click', () => {
  document.getElementById('purchaseOrderAddCard').style.display = 'block';
});
document.getElementById('cancelPurchaseOrderAdd').addEventListener('click', () => {
  document.getElementById('purchaseOrderAddCard').style.display = 'none';
});
document.getElementById('btnExportPurchaseOrderPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/purchase-orders/export/pdf`, '_blank');
});

// Auto Load
document.addEventListener('DOMContentLoaded', () => loadPurchaseOrders());

// ======================= 10.2 Stock Receiving (GRN) =======================

// Load GRNs
function loadGRNs() {
  fetch(`${API_BASE}/api/grn`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('grnBody');
      tbody.innerHTML = '';

      data.forEach(g => {
        const row = `
          <tr>
            <td>${g.grnNo || '-'}</td>
            <td>${g.poNo || '-'}</td>
            <td>${g.vendor || '-'}</td>
            <td>${g.item || '-'}</td>
            <td>${g.batch || '-'}</td>
            <td>${g.expiry || '-'}</td>
            <td>${g.quantity || 0}</td>
            <td>${g.qaStatus || '-'}</td>
            <td>${g.location || '-'}</td>
            <td>${g.date || '-'}</td>
            <td>${g.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteGRN(${g.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading GRNs:', err));
}

// Add GRN
document.getElementById('grnForm').addEventListener('submit', e => {
  e.preventDefault();

  const newGRN = {
    grnNo: document.getElementById('grnNumber').value.trim(),
    poNo: document.getElementById('grnPO').value.trim(),
    vendor: document.getElementById('grnVendor').value.trim(),
    item: document.getElementById('grnItem').value.trim(),
    batch: document.getElementById('grnBatch').value.trim(),
    expiry: document.getElementById('grnExpiry').value,
    quantity: parseInt(document.getElementById('grnQuantity').value) || 0,
    qaStatus: document.getElementById('grnQAStatus').value,
    location: document.getElementById('grnLocation').value.trim(),
    date: document.getElementById('grnDate').value,
    remarks: document.getElementById('grnRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/grn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newGRN)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('grnAddCard').style.display = 'none';
      e.target.reset();
      loadGRNs();
    })
    .catch(err => console.error('Error adding GRN:', err));
});

// Delete
function deleteGRN(id) {
  if (confirm('Are you sure you want to delete this GRN?')) {
    fetch(`${API_BASE}/api/grn/${id}`, { method: 'DELETE' })
      .then(() => loadGRNs());
  }
}

// Buttons
document.getElementById('btnAddGRN').addEventListener('click', () => {
  document.getElementById('grnAddCard').style.display = 'block';
});
document.getElementById('cancelGRNAdd').addEventListener('click', () => {
  document.getElementById('grnAddCard').style.display = 'none';
});
document.getElementById('btnExportGRNPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/grn/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => loadGRNs());
// ======================= 10.3 Purchase Invoice / Purchase Return =======================

// Load all invoices
function loadPurchaseInvoices() {
  fetch(`${API_BASE}/api/purchase-invoices`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('purchaseInvoiceBody');
      tbody.innerHTML = '';

      data.forEach(inv => {
        const row = `
          <tr>
            <td>${inv.invoiceNo || '-'}</td>
            <td>${inv.poNo || '-'}</td>
            <td>${inv.grnNo || '-'}</td>
            <td>${inv.vendor || '-'}</td>
            <td>${inv.type || '-'}</td>
            <td class="text-end">${parseFloat(inv.amount || 0).toFixed(2)}</td>
            <td>${inv.purchaseInvoiceDate || '-'}</td>   <!-- updated -->
            <td>${inv.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deletePurchaseInvoice(${inv.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading invoices:', err));
}

// Add new invoice
document.getElementById('purchaseInvoiceForm').addEventListener('submit', e => {
  e.preventDefault();

  const newInvoice = {
    invoiceNo: document.getElementById('invoiceNumber').value.trim(),
    poNo: document.getElementById('invoicePO').value.trim(),
    grnNo: document.getElementById('invoiceGRN').value.trim(),
    vendor: document.getElementById('invoiceVendor').value.trim(),
    type: document.getElementById('invoiceType').value,
    amount: parseFloat(document.getElementById('invoiceAmount').value) || 0,
    purchaseInvoiceDate: document.getElementById('purchaseInvoiceDate').value, // updated
    remarks: document.getElementById('invoiceRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/purchase-invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newInvoice)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('purchaseInvoiceAddCard').style.display = 'none';
      e.target.reset();
      loadPurchaseInvoices();
    })
    .catch(err => console.error('Error adding invoice:', err));
});


// Delete
function deletePurchaseInvoice(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/purchase-invoices/${id}`, { method: 'DELETE' })
      .then(() => loadPurchaseInvoices());
  }
}

// Buttons
document.getElementById('btnAddPurchaseInvoice').addEventListener('click', () => {
  document.getElementById('purchaseInvoiceAddCard').style.display = 'block';
});
document.getElementById('cancelPurchaseInvoiceAdd').addEventListener('click', () => {
  document.getElementById('purchaseInvoiceAddCard').style.display = 'none';
});
document.getElementById('btnExportPurchaseInvoicePDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/purchase-invoices/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => loadPurchaseInvoices());

// ======================= 10.4 Vendor AP Settlement =======================

// Load all records
function loadVendorAP() {
  fetch(`${API_BASE}/api/vendor-ap`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('vendorAPBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const row = `
          <tr>
            <td>${v.refNo || '-'}</td>
            <td>${v.vendor || '-'}</td>
            <td>${v.type || '-'}</td>
            <td class="text-end">${parseFloat(v.amount || 0).toFixed(2)}</td>
            <td>${v.vendorAPDate || '-'}</td>
            <td>${v.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteVendorAP(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading Vendor AP data:', err));
}

// Add new record
document.getElementById('vendorAPForm').addEventListener('submit', e => {
  e.preventDefault();

  const newRecord = {
    refNo: document.getElementById('vendorAPRefNo').value.trim(),
    vendor: document.getElementById('vendorAPVendor').value.trim(),
    type: document.getElementById('vendorAPType').value.trim(),
    amount: parseFloat(document.getElementById('vendorAPAmount').value) || 0,
    vendorAPDate: document.getElementById('vendorAPDate').value,
    remarks: document.getElementById('vendorAPRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/vendor-ap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRecord)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('vendorAPAddCard').style.display = 'none';
      e.target.reset();
      loadVendorAP();
    })
    .catch(err => console.error('Error adding Vendor AP record:', err));
});

// Delete
function deleteVendorAP(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/vendor-ap/${id}`, { method: 'DELETE' })
      .then(() => loadVendorAP());
  }
}

// Buttons
document.getElementById('btnAddVendorAP').addEventListener('click', () => {
  document.getElementById('vendorAPAddCard').style.display = 'block';
});
document.getElementById('cancelVendorAPAdd').addEventListener('click', () => {
  document.getElementById('vendorAPAddCard').style.display = 'none';
});
document.getElementById('btnExportVendorAPPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/vendor-ap/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadVendorAP();
});

/* ========================= 11.1 DMS — Region & Masters (renderer) ========================= */

/* ----- helper: populate select with regions/item categories/vehicle types ----- */
function populateSelect(url, selectId, textKey = 'name', valueKey = 'code') {
  fetch(url).then(r => r.json()).then(arr => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select</option>';
    arr.forEach(it => {
      const opt = document.createElement('option');
      opt.value = it[valueKey] ?? it.id ?? '';
      opt.text = it[textKey] ?? it.name ?? opt.value;
      sel.appendChild(opt);
    });
  }).catch(() => { });
}

/* ----------------- REGIONS ----------------- */
/* ================================================================
   REGIONS — 8 SSMS fields
   parent_id, region_id, own_id, description, category, region_type, level_id, inactive
   API: /api/regions
================================================================ */
let cachedRegions = [];

function renderRegionsTable(list) {
  const body = document.getElementById('dmsRegionsBody');
  if (!body) return;
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-2">No regions found.</td></tr>';
    return;
  }
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.parent_id || '-'}</td>
      <td>${r.region_id || '-'}</td>
      <td>${r.own_id || '-'}</td>
      <td>${r.description || '-'}</td>
      <td>${r.category || '-'}</td>
      <td>${r.region_type || '-'}</td>
      <td class="text-center">${r.level_id ?? '-'}</td>
      <td class="text-center">${r.inactive == 1 ? '<span class="badge bg-danger">Yes</span>' : '<span class="badge bg-success">No</span>'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editDmsRegion(${r.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteDmsRegion(${r.id})">Delete</button>
      </td>`;
    body.appendChild(tr);
  });
}

function loadDmsRegions() {
  fetch(`${API_BASE}/api/regions`)
    .then(r => r.json())
    .then(data => {
      cachedRegions = data;
      renderRegionsTable(cachedRegions);

      // Search
      const srch = document.getElementById('dmsRegionSearch');
      if (srch) {
        srch.oninput = () => {
          const q = srch.value.toLowerCase();
          renderRegionsTable(q
            ? cachedRegions.filter(r =>
                (r.region_id||'').toLowerCase().includes(q) ||
                (r.description||'').toLowerCase().includes(q) ||
                (r.category||'').toLowerCase().includes(q) ||
                (r.region_type||'').toLowerCase().includes(q)
              )
            : cachedRegions
          );
        };
      }

      // Export CSV
      const csvBtn = document.getElementById('dmsBtnExportRegionCSV');
      if (csvBtn) csvBtn.onclick = () => exportRegionsCSV();
    })
    .catch(err => console.error('Error loading regions:', err));
}

function showRegionForm(r) {
  const card  = document.getElementById('dmsRegionAddCard');
  const title = document.getElementById('dmsRegionFormTitle');
  if (!card) return;
  document.getElementById('dmsRegionEditId').value       = r?.id          || '';
  document.getElementById('dms_region_parent').value     = r?.parent_id   || '';
  document.getElementById('dms_region_code').value       = r?.region_id   || '';
  document.getElementById('dms_region_own').value        = r?.own_id      || '';
  document.getElementById('dms_region_name').value       = r?.description || '';
  document.getElementById('dms_region_category').value  = r?.category     || '';
  document.getElementById('dms_region_type').value      = r?.region_type  || '';
  document.getElementById('dms_region_level').value     = r?.level_id     ?? '';
  document.getElementById('dms_region_inactive').value  = r?.inactive != null ? String(r.inactive) : '0';
  if (title) title.textContent = r ? 'Edit Region' : 'Add Region';
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideRegionForm() {
  const card = document.getElementById('dmsRegionAddCard');
  if (card) card.style.display = 'none';
  const form = document.getElementById('dmsRegionForm');
  if (form) form.reset();
  const editId = document.getElementById('dmsRegionEditId');
  if (editId) editId.value = '';
  const title = document.getElementById('dmsRegionFormTitle');
  if (title) title.textContent = 'Add Region';
}

window.editDmsRegion = function(id) {
  const r = cachedRegions.find(x => x.id === id);
  if (r) showRegionForm(r);
};

window.deleteDmsRegion = function(id) {
  if (!confirm('Delete this region?')) return;
  fetch(`${API_BASE}/api/regions/${id}`, { method: 'DELETE' })
    .then(() => loadDmsRegions())
    .catch(err => alert('Delete failed: ' + err.message));
};

function exportRegionsCSV() {
  if (!cachedRegions.length) return alert('No data to export.');
  const h = ['Parent ID','Region ID','Own ID','Description','Category','Region Type','Level ID','Inactive'];
  const rows = cachedRegions.map(r => [
    r.parent_id, r.region_id, r.own_id, r.description,
    r.category, r.region_type, r.level_id ?? '', r.inactive == 1 ? 'Yes' : 'No'
  ]);
  const csv = [h,...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `regions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// Wire buttons
const _rAddBtn = document.getElementById('dmsBtnAddRegion');
if (_rAddBtn) _rAddBtn.addEventListener('click', () => showRegionForm());

const _rCancelBtn = document.getElementById('dmsCancelRegionAdd');
if (_rCancelBtn) _rCancelBtn.addEventListener('click', () => hideRegionForm());

const _rPdfBtn = document.getElementById('dmsExportRegionsPDF');
if (_rPdfBtn) _rPdfBtn.addEventListener('click', () =>
  window.open(`${API_BASE}/api/regions/export/pdf`, '_blank'));

// Form submit
const _rForm = document.getElementById('dmsRegionForm');
if (_rForm) {
  _rForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const editId = document.getElementById('dmsRegionEditId')?.value.trim();
      const payload = {
        parent_id:   document.getElementById('dms_region_parent')?.value.trim(),
        region_id:   document.getElementById('dms_region_code')?.value.trim(),
        own_id:      document.getElementById('dms_region_own')?.value.trim(),
        description: document.getElementById('dms_region_name')?.value.trim(),
        category:    document.getElementById('dms_region_category')?.value.trim(),
        region_type: document.getElementById('dms_region_type')?.value.trim(),
        level_id:    parseInt(document.getElementById('dms_region_level')?.value) || null,
        inactive:    parseInt(document.getElementById('dms_region_inactive')?.value) || 0
      };
      if (!payload.region_id || !payload.description) {
        alert('Region ID and Description are required.'); return;
      }
      const isEdit = !!editId;
      const url    = isEdit ? `${API_BASE}/api/regions/${editId}` : `${API_BASE}/api/regions`;
      const res    = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(isEdit ? 'Update failed' : 'Add failed');
      alert(isEdit ? 'Region updated!' : 'Region added!');
      hideRegionForm();
      loadDmsRegions();
    } catch (err) { alert('Error: ' + err.message); }
  });
}
/* ================================================================ */



/* ----------------- CUSTOMERS ----------------- */
function loadDmsCustomers() {
  fetch(`${API_BASE}/api/dms/customers`).then(r => r.json()).then(data => {
    const body = document.getElementById('dmsCustomersBody'); body.innerHTML = '';
    data.forEach(c => {
      body.insertAdjacentHTML('beforeend', `<tr>
        <td>${c.customerId || '-'}</td><td>${c.name || '-'}</td><td>${c.region || '-'}</td><td>${c.route || '-'}</td><td>${c.phone || '-'}</td>
        <td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('customers',${c.id})"><i class="bi bi-trash"></i></button></td>
      </tr>`);
    });
  });
}
document.getElementById('dmsBtnAddCustomer').addEventListener('click', () => { document.getElementById('dmsCustomerAddCard').style.display = 'block'; populateSelect(`${API_BASE}/api/dms/regions`, 'dms_customer_region', 'name', 'code'); });
document.getElementById('dmsCancelCustomerAdd').addEventListener('click', () => document.getElementById('dmsCustomerAddCard').style.display = 'none');
document.getElementById('dmsCustomerForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    customerId: document.getElementById('dms_customer_id').value.trim(),
    name: document.getElementById('dms_customer_name').value.trim(),
    region: document.getElementById('dms_customer_region').value,
    route: document.getElementById('dms_customer_route').value.trim(),
    phone: document.getElementById('dms_customer_phone').value.trim(),
    notes: document.getElementById('dms_customer_notes').value.trim()
  };
  fetch(`${API_BASE}/api/dms/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(() => { document.getElementById('dmsCustomerAddCard').style.display = 'none'; e.target.reset(); loadDmsCustomers(); });
});

/* ----------------- ITEM CATEGORIES ----------------- */
function loadDmsItemCats() {
  fetch(`${API_BASE}/api/dms/itemcategories`).then(r => r.json()).then(data => {
    const body = document.getElementById('dmsItemCatsBody'); body.innerHTML = '';
    data.forEach(i => {
      body.insertAdjacentHTML('beforeend', `<tr>
        <td>${i.code || '-'}</td><td>${i.name || '-'}</td><td>${i.remarks || '-'}</td>
        <td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('itemcategories',${i.id})"><i class="bi bi-trash"></i></button></td>
      </tr>`);
    });
    // Items form no longer has category; only populate if the select exists
    if (document.getElementById('dms_item_category')) {
      populateSelect(`${API_BASE}/api/dms/itemcategories`, 'dms_item_category', 'name', 'code');
    }
  });
}
document.getElementById('dmsBtnAddItemCat').addEventListener('click', () => document.getElementById('dmsItemCatAddCard').style.display = 'block');
document.getElementById('dmsCancelItemCatAdd').addEventListener('click', () => document.getElementById('dmsItemCatAddCard').style.display = 'none');
document.getElementById('dmsItemCatForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    code: document.getElementById('dms_itemcat_code').value.trim(),
    name: document.getElementById('dms_itemcat_name').value.trim(),
    remarks: document.getElementById('dms_itemcat_remarks').value.trim()
  };
  fetch(`${API_BASE}/api/dms/itemcategories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(() => { document.getElementById('dmsItemCatAddCard').style.display = 'none'; e.target.reset(); loadDmsItemCats(); });
});

/* ----------------- VENDORS ----------------- */
function loadDmsVendors() {
  fetch(`${API_BASE}/api/dms/vendors`).then(r => r.json()).then(data => {
    const body = document.getElementById('dmsVendorsBody'); body.innerHTML = '';
    data.forEach(v => {
      body.insertAdjacentHTML('beforeend', `<tr>
        <td>${v.vendorId || '-'}</td><td>${v.name || '-'}</td><td>${v.phone || '-'}</td>
        <td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('vendors',${v.id})"><i class="bi bi-trash"></i></button></td>
      </tr>`);
    });
  });
}
document.getElementById('dmsBtnAddVendor').addEventListener('click', () => document.getElementById('dmsVendorAddCard').style.display = 'block');
document.getElementById('dmsCancelVendorAdd').addEventListener('click', () => document.getElementById('dmsVendorAddCard').style.display = 'none');
document.getElementById('dmsVendorForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    vendorId: document.getElementById('dms_vendor_id').value.trim(),
    name: document.getElementById('dms_vendor_name').value.trim(),
    phone: document.getElementById('dms_vendor_phone').value.trim()
  };
  fetch(`${API_BASE}/api/dms/vendors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(() => { document.getElementById('dmsVendorAddCard').style.display = 'none'; e.target.reset(); loadDmsVendors(); });
});

/* ================================================================
   COMPANY GROUPS — 4 SSMS fields
   group_id, description, inactive, company_id
   API: /api/company-groups
================================================================ */
let cachedCompanyGroups = [];

function renderCompanyGroupsTable(list) {
  const body = document.getElementById('dmsCompaniesBody');
  if (!body) return;
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-2">No groups found.</td></tr>';
    return;
  }
  list.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.group_id || '-'}</td>
      <td>${g.description || '-'}</td>
      <td class="text-center">${g.inactive == 1 ? '<span class="badge bg-danger">Yes</span>' : '<span class="badge bg-success">No</span>'}</td>
      <td class="text-center">${g.company_id || '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editCompanyGroup(${g.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCompanyGroup(${g.id})">Delete</button>
      </td>`;
    body.appendChild(tr);
  });
}

function loadDmsCompanies() {
  fetch(`${API_BASE}/api/company-groups`)
    .then(r => r.json())
    .then(data => {
      cachedCompanyGroups = data;
      renderCompanyGroupsTable(cachedCompanyGroups);

      // Search
      const srch = document.getElementById('dmsGroupSearch');
      if (srch) {
        srch.oninput = () => {
          const q = srch.value.toLowerCase();
          renderCompanyGroupsTable(q
            ? cachedCompanyGroups.filter(g =>
                (g.group_id||'').toLowerCase().includes(q) ||
                (g.description||'').toLowerCase().includes(q) ||
                (g.company_id||'').toLowerCase().includes(q)
              )
            : cachedCompanyGroups
          );
        };
      }

      // Export CSV
      const csvBtn = document.getElementById('dmsBtnExportGroupCSV');
      if (csvBtn) csvBtn.onclick = () => exportCompanyGroupsCSV();
    })
    .catch(err => console.error('Error loading company groups:', err));
}

function showCompanyGroupForm(g) {
  const card  = document.getElementById('dmsCompanyAddCard');
  const title = document.getElementById('dmsGroupFormTitle');
  if (!card) return;
  document.getElementById('dmsGroupEditId').value        = g?.id          || '';
  document.getElementById('dms_company_code').value      = g?.group_id    || '';
  document.getElementById('dms_company_name').value      = g?.description || '';
  document.getElementById('dms_group_inactive').value    = g?.inactive != null ? String(g.inactive) : '0';
  document.getElementById('dms_group_company_id').value  = g?.company_id  || '';
  if (title) title.textContent = g ? 'Edit Company Group' : 'Add Company Group';
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideCompanyGroupForm() {
  const card = document.getElementById('dmsCompanyAddCard');
  if (card) card.style.display = 'none';
  const form = document.getElementById('dmsCompanyForm');
  if (form) form.reset();
  const editId = document.getElementById('dmsGroupEditId');
  if (editId) editId.value = '';
  const title = document.getElementById('dmsGroupFormTitle');
  if (title) title.textContent = 'Add Company Group';
}

window.editCompanyGroup = function(id) {
  const g = cachedCompanyGroups.find(x => x.id === id);
  if (g) showCompanyGroupForm(g);
};

window.deleteCompanyGroup = function(id) {
  if (!confirm('Delete this group?')) return;
  fetch(`${API_BASE}/api/company-groups/${id}`, { method: 'DELETE' })
    .then(() => loadDmsCompanies())
    .catch(err => alert('Delete failed: ' + err.message));
};

function exportCompanyGroupsCSV() {
  if (!cachedCompanyGroups.length) return alert('No data to export.');
  const headers = ['Group ID', 'Description', 'Inactive', 'Company ID'];
  const rows = cachedCompanyGroups.map(g => [
    g.group_id, g.description,
    g.inactive == 1 ? 'Yes' : 'No',
    g.company_id
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `company_groups_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// Wire Add / Cancel buttons
const _cgAddBtn = document.getElementById('dmsBtnAddCompany');
if (_cgAddBtn) _cgAddBtn.addEventListener('click', () => showCompanyGroupForm());

const _cgCancelBtn = document.getElementById('dmsCancelCompanyAdd');
if (_cgCancelBtn) _cgCancelBtn.addEventListener('click', () => hideCompanyGroupForm());

// Form submit (Add + Edit)
const _cgForm = document.getElementById('dmsCompanyForm');
if (_cgForm) {
  _cgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const editId  = document.getElementById('dmsGroupEditId')?.value.trim();
      const payload = {
        group_id:    document.getElementById('dms_company_code')?.value.trim(),
        description: document.getElementById('dms_company_name')?.value.trim(),
        inactive:    parseInt(document.getElementById('dms_group_inactive')?.value) || 0,
        company_id:  document.getElementById('dms_group_company_id')?.value.trim()
      };
      if (!payload.group_id || !payload.description) {
        alert('Group ID and Description are required.');
        return;
      }
      const isEdit = !!editId;
      const url    = isEdit ? `${API_BASE}/api/company-groups/${editId}` : `${API_BASE}/api/company-groups`;
      const res    = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(isEdit ? 'Update failed' : 'Add failed');
      alert(isEdit ? 'Group updated!' : 'Group added!');
      hideCompanyGroupForm();
      loadDmsCompanies();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}
/* ================================================================ */


/* ----------------- ITEMS ----------------- */
let dmsItemsOffset = 0;
let dmsItemsTotal = 0;
const DMS_ITEMS_PAGE_SIZE = 100;
let dmsItemsCache = [];

function renderDmsItemsTable(list) {
  const body = document.getElementById('dmsItemsBody');
  if (!body) return;
  body.innerHTML = '';
  list.forEach(i => {
    const remainingRaw = (i.nearExpiryRemaining !== undefined && i.nearExpiryRemaining !== null)
      ? Number(i.nearExpiryRemaining)
      : Number(i.territory);
    const remaining = Number.isFinite(remainingRaw) ? remainingRaw : 0;
    const expired = (i.isExpired === 1 || i.isExpired === true || remaining < 0);
    const strengthNum = Number(i.status);
    const strength = Number.isFinite(strengthNum) ? strengthNum : null;
    const lowStock = strength !== null && strength >= 0 && strength <= 50;
    const badgeExpired = expired ? `<span class="badge bg-danger me-1" style="font-size:0.72em;">Expired</span>` : '';
    const badgeLow = lowStock ? `<span class="badge bg-warning text-dark me-1" style="font-size:0.72em;">Low stock</span>` : '';
    body.insertAdjacentHTML('beforeend', `<tr>
      <td>${i.code || '-'}</td>
      <td>${badgeLow}${badgeExpired}${i.name || '-'}</td>
      <td>${i.description || '-'}</td>
      <td>${strength !== null ? strength : (i.status || '-')}</td>
      <td>${i.region || '-'}</td>
      <td>${Number.isFinite(remaining) ? remaining : (i.territory || '-')}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary me-1" onclick="editDmsItem(${i.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="dmsDelete('items',${i.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`);
  });
}

function bindDmsItemNameAutocomplete() {
  const input = document.getElementById('dms_item_name');
  if (!input || input._poAutocompleteBound) return;
  input._poAutocompleteBound = true;

  const parent = input.parentElement;
  if (parent) parent.style.position = 'relative';

  let list = document.getElementById('dmsItemNameResults');
  if (!list) {
    list = document.createElement('div');
    list.id = 'dmsItemNameResults';
    list.className = 'list-group';
    list.style.position = 'absolute';
    list.style.left = '0';
    list.style.right = '0';
    list.style.top = '100%';
    list.style.zIndex = '3000';
    list.style.maxHeight = '260px';
    list.style.overflowY = 'auto';
    list.style.display = 'none';
    if (parent) parent.appendChild(list);
  }

  const hide = () => { list.style.display = 'none'; list.innerHTML = ''; };

  const apply = (it) => {
    input.value = it.name || '';
    const companyEl = document.getElementById('dms_item_company');
    const packEl = document.getElementById('dms_item_pack');
    const strengthEl = document.getElementById('dms_item_strength');

    if (companyEl && it.vendorId != null) companyEl.value = String(it.vendorId);
    if (packEl && it.packSize) packEl.value = String(it.packSize);
    if (strengthEl) {
      // Requirement: show total purchased quantity in Strength field
      if (it.totalQty != null && it.totalQty !== '') strengthEl.value = String(it.totalQty);
      else if (it.strength) strengthEl.value = String(it.strength);
    }
    hide();
  };

  const doSearch = debounce(async () => {
    const q = String(input.value || '').trim();
    if (q.length < 2) { hide(); return; }
    list.style.display = 'block';
    list.innerHTML = `<div class="list-group-item text-muted small">Searching…</div>`;
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/items/search?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      if (!items.length) {
        list.innerHTML = `<div class="list-group-item text-muted small">No matches</div>`;
        return;
      }
      list.innerHTML = items.map((it, idx) => {
        const meta = [
          it.vendorName ? `Company: ${escapeHtml(it.vendorName)}` : null,
          it.poNumber ? `PO: ${escapeHtml(it.poNumber)}` : null
        ].filter(Boolean).join(' | ');
        return `
          <button type="button" class="list-group-item list-group-item-action dms-item-suggestion" data-idx="${idx}">
            <div class="fw-semibold">${escapeHtml(it.name || '')}</div>
            ${meta ? `<div class="text-muted small">${meta}</div>` : ''}
          </button>
        `;
      }).join('');

      list.querySelectorAll('.dms-item-suggestion').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const idx = Number(btn.getAttribute('data-idx'));
          apply(items[idx]);
        });
      });
    } catch (err) {
      console.error('DMS item name search error', err);
      list.innerHTML = `<div class="list-group-item text-danger small">Search failed</div>`;
    }
  }, 250);

  input.addEventListener('input', doSearch);
  input.addEventListener('focus', doSearch);
  input.addEventListener('blur', () => setTimeout(hide, 150));
}

function renderDmsItemsLoadMore() {
  const container = document.getElementById('dmsItemsContainer');
  if (!container) return;
  let btn = document.getElementById('dmsItemsLoadMoreBtn');
  const hasMore = dmsItemsCache.length < dmsItemsTotal;
  if (hasMore && dmsItemsCache.length > 0) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'dmsItemsLoadMoreBtn';
      btn.className = 'btn btn-outline-primary btn-sm mt-2';
      btn.onclick = () => {
        dmsItemsOffset = dmsItemsCache.length;
        loadDmsItems(false);
      };
      container.appendChild(btn);
    }
    btn.style.display = 'inline-block';
    btn.textContent = `Load more (${dmsItemsCache.length} of ${dmsItemsTotal})`;
  } else if (btn) {
    btn.style.display = 'none';
  }
}

function loadDmsItems(reset = true) {
  if (reset) {
    dmsItemsOffset = 0;
    dmsItemsCache = [];
  }
  fetch(`${API_BASE}/api/dms/items/paged?limit=${DMS_ITEMS_PAGE_SIZE}&offset=${dmsItemsOffset}`)
    .then(r => r.json())
    .then(data => {
      const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      dmsItemsTotal = data.total != null ? data.total : items.length;
      if (reset) dmsItemsCache = items;
      else dmsItemsCache = dmsItemsCache.concat(items);
      renderDmsItemsTable(dmsItemsCache);
      renderDmsItemsLoadMore();

      // Wire search
      const searchEl = document.getElementById('dmsItemsSearch');
      if (searchEl && !searchEl._bound) {
        searchEl._bound = true;
        searchEl.addEventListener('input', () => {
          const q = String(searchEl.value || '').trim().toLowerCase();
          if (!q) {
            renderDmsItemsTable(dmsItemsCache);
            return;
          }
          const filtered = dmsItemsCache.filter(i => {
            const code = String(i.code || '').toLowerCase();
            const name = String(i.name || '').toLowerCase();
            return code.includes(q) || name.includes(q);
          });
          renderDmsItemsTable(filtered);
        });
      }
    })
    .catch(err => console.error('Failed to load DMS items', err));
}
document.getElementById('dmsBtnAddItem').addEventListener('click', () => {
  document.getElementById('dmsItemAddCard').style.display = 'block';
  bindDmsItemNameAutocomplete();
});
document.getElementById('dmsCancelItemAdd').addEventListener('click', () => document.getElementById('dmsItemAddCard').style.display = 'none');
document.getElementById('dmsItemForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    code: document.getElementById('dms_item_id').value.trim(),
    name: document.getElementById('dms_item_name').value.trim(),
    description: document.getElementById('dms_item_pack').value.trim(),      // Pack Size
    region: document.getElementById('dms_item_company').value.trim(),        // Company ID
    territory: document.getElementById('dms_item_near_expiry').value.trim(), // Near Expiry Days
    status: document.getElementById('dms_item_strength').value.trim()        // Strength / Total Qty
  };
  fetch(`${API_BASE}/api/dms/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => {
    document.getElementById('dmsItemAddCard').style.display = 'none';
    e.target.reset();
    loadDmsItems();
  });
});

// Edit DMS item into the form
function editDmsItem(id) {
  const item = dmsItemsCache.find(i => Number(i.id) === Number(id));
  if (!item) return;
  document.getElementById('dms_item_id').value = item.code || '';
  document.getElementById('dms_item_name').value = item.name || '';
  document.getElementById('dms_item_pack').value = item.description || '';
  document.getElementById('dms_item_strength').value = item.status || '';
  document.getElementById('dms_item_company').value = item.region || '';
  document.getElementById('dms_item_near_expiry').value = item.territory || '';
  document.getElementById('dmsItemAddCard').style.display = 'block';
}

/* ----------------- MEDICATION COURSES ----------------- */
function loadDmsMeds() { fetch(`${API_BASE}/api/dms/medcourses`).then(r => r.json()).then(data => { const body = document.getElementById('dmsMedsBody'); body.innerHTML = ''; data.forEach(m => { body.insertAdjacentHTML('beforeend', `<tr><td>${m.code || '-'}</td><td>${m.description || '-'}</td><td>${m.notes || '-'}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('medcourses',${m.id})"><i class="bi bi-trash"></i></button></td></tr>`); }); }); }
document.getElementById('dmsBtnAddMed').addEventListener('click', () => document.getElementById('dmsMedAddCard').style.display = 'block');
document.getElementById('dmsCancelMedAdd').addEventListener('click', () => document.getElementById('dmsMedAddCard').style.display = 'none');
document.getElementById('dmsMedForm').addEventListener('submit', e => { e.preventDefault(); const payload = { code: document.getElementById('dms_med_code').value.trim(), description: document.getElementById('dms_med_desc').value.trim(), notes: document.getElementById('dms_med_notes').value.trim() }; fetch(`${API_BASE}/api/dms/medcourses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(() => { document.getElementById('dmsMedAddCard').style.display = 'none'; e.target.reset(); loadDmsMeds(); }); });

/* ----------------- POLICIES ----------------- */
function loadDmsPolicies() { fetch(`${API_BASE}/api/dms/policies`).then(r => r.json()).then(data => { const body = document.getElementById('dmsPoliciesBody'); body.innerHTML = ''; data.forEach(p => { body.insertAdjacentHTML('beforeend', `<tr><td>${p.code || '-'}</td><td>${p.description || '-'}</td><td>${p.active ? 'Yes' : 'No'}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('policies',${p.id})"><i class="bi bi-trash"></i></button></td></tr>`); }); }); }
document.getElementById('dmsBtnAddPolicy').addEventListener('click', () => document.getElementById('dmsPolicyAddCard').style.display = 'block');
document.getElementById('dmsCancelPolicyAdd').addEventListener('click', () => document.getElementById('dmsPolicyAddCard').style.display = 'none');
document.getElementById('dmsPolicyForm').addEventListener('submit', e => { e.preventDefault(); const payload = { code: document.getElementById('dms_policy_code').value.trim(), description: document.getElementById('dms_policy_desc').value.trim(), active: document.getElementById('dms_policy_active').value === 'true' }; fetch(`${API_BASE}/api/dms/policies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(() => { document.getElementById('dmsPolicyAddCard').style.display = 'none'; e.target.reset(); loadDmsPolicies(); }); });

/* ----------------- MANAGERS ----------------- */
function loadDmsManagers() {
  fetch(`${API_BASE}/api/dms/managers`).then(r => r.json()).then(data => {
    const body = document.getElementById('dmsManagersBody');
    body.innerHTML = '';
    data.forEach(m => {
      body.insertAdjacentHTML('beforeend', `<tr>
        <td>${m.code || '-'}</td>
        <td>${m.region || '-'}</td>
        <td>${m.name || '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary me-1" onclick="editDmsManager(${m.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="dmsDelete('managers',${m.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`);
    });

    // Wire search
    const searchEl = document.getElementById('dmsManagersSearch');
    if (searchEl && !searchEl._bound) {
      searchEl._bound = true;
      searchEl.addEventListener('input', () => {
        const q = String(searchEl.value || '').trim().toLowerCase();
        const rows = body.querySelectorAll('tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = !q || text.includes(q) ? '' : 'none';
        });
      });
    }
  });
}
document.getElementById('dmsBtnAddManager').addEventListener('click', () => document.getElementById('dmsManagerAddCard').style.display = 'block');
document.getElementById('dmsCancelManagerAdd').addEventListener('click', () => document.getElementById('dmsManagerAddCard').style.display = 'none');
document.getElementById('dmsManagerForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    code: document.getElementById('dms_mgr_id').value.trim(),       // Manager ID
    region: document.getElementById('dms_mgr_company').value.trim(),// Company ID
    name: document.getElementById('dms_mgr_name').value.trim()      // Manager Name
  };
  fetch(`${API_BASE}/api/dms/managers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => {
    document.getElementById('dmsManagerAddCard').style.display = 'none';
    e.target.reset();
    loadDmsManagers();
  });
});

// Edit DMS manager into the form
function editDmsManager(id) {
  const row = Array.from(document.getElementById('dmsManagersBody').querySelectorAll('tr'))
    .find(tr => tr.querySelector('button.btn-primary') && tr.querySelector('button.btn-primary').getAttribute('onclick') === `editDmsManager(${id})`);
  if (!row) return;
  const cells = row.querySelectorAll('td');
  document.getElementById('dms_mgr_id').value = (cells[0]?.textContent || '').trim();
  document.getElementById('dms_mgr_company').value = (cells[1]?.textContent || '').trim();
  document.getElementById('dms_mgr_name').value = (cells[2]?.textContent || '').trim();
  document.getElementById('dmsManagerAddCard').style.display = 'block';
}

/* ----------------- VEHICLE TYPES & VEHICLES ----------------- */
function loadDmsVehicleTypes() { fetch(`${API_BASE}/api/dms/vehicletypes`).then(r => r.json()).then(data => { const body = document.getElementById('dmsVehicleTypesBody'); body.innerHTML = ''; data.forEach(vt => { body.insertAdjacentHTML('beforeend', `<tr><td>${vt.code || '-'}</td><td>${vt.description || '-'}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('vehicletypes',${vt.id})"><i class="bi bi-trash"></i></button></td></tr>`); }); populateSelect(`${API_BASE}/api/dms/vehicletypes`, 'dms_vehicle_type', 'description', 'code'); }); }
document.getElementById('dmsBtnAddVehicleType').addEventListener('click', () => document.getElementById('dmsVehicleTypeAddCard').style.display = 'block');
document.getElementById('dmsCancelVehicleTypeAdd').addEventListener('click', () => document.getElementById('dmsVehicleTypeAddCard').style.display = 'none');
document.getElementById('dmsVehicleTypeForm').addEventListener('submit', e => { e.preventDefault(); const payload = { code: document.getElementById('dms_vehicletype_code').value.trim(), description: document.getElementById('dms_vehicletype_desc').value.trim() }; fetch(`${API_BASE}/api/dms/vehicletypes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(() => { document.getElementById('dmsVehicleTypeAddCard').style.display = 'none'; e.target.reset(); loadDmsVehicleTypes(); }); });

function loadDmsVehicles() { fetch(`${API_BASE}/api/dms/vehicles`).then(r => r.json()).then(data => { const body = document.getElementById('dmsVehiclesBody'); body.innerHTML = ''; data.forEach(v => { body.insertAdjacentHTML('beforeend', `<tr><td>${v.regNo || '-'}</td><td>${v.type || '-'}</td><td>${v.driver || '-'}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="dmsDelete('vehicles',${v.id})"><i class="bi bi-trash"></i></button></td></tr>`); }); }); }
document.getElementById('dmsBtnAddVehicle').addEventListener('click', () => { document.getElementById('dmsVehicleAddCard').style.display = 'block'; populateSelect(`${API_BASE}/api/dms/vehicletypes`, 'dms_vehicle_type', 'description', 'code'); });
document.getElementById('dmsCancelVehicleAdd').addEventListener('click', () => document.getElementById('dmsVehicleAddCard').style.display = 'none');
document.getElementById('dmsVehicleForm').addEventListener('submit', e => { e.preventDefault(); const payload = { regNo: document.getElementById('dms_vehicle_reg').value.trim(), type: document.getElementById('dms_vehicle_type').value, driver: document.getElementById('dms_vehicle_driver').value.trim() }; fetch(`${API_BASE}/api/dms/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(() => { document.getElementById('dmsVehicleAddCard').style.display = 'none'; e.target.reset(); loadDmsVehicles(); }); });

/* ----------------- Generic delete helper ----------------- */
function dmsDelete(entity, id) {
  if (!confirm('Delete record?')) return;
  fetch(`${API_BASE}/api/dms/${entity}/${id}`, { method: 'DELETE' })
    .then(() => {
      // reload appropriate list
      loadDmsRegions(); loadDmsCustomers(); loadDmsItemCats(); loadDmsVendors();
      loadDmsCompanies(); loadDmsItems(); loadDmsMeds(); loadDmsPolicies();
      loadDmsManagers(); loadDmsVehicleTypes(); loadDmsVehicles();
    })
    .catch(err => console.error('Delete error', err));
}

/* ----------------- Exports (PDF) - simply open existing endpoints ----------------- */
document.getElementById('dmsExportRegionsPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/regions/export/pdf`, '_blank'));
document.getElementById('dmsExportCustomersPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/customers/export/pdf`, '_blank'));
document.getElementById('dmsExportItemCatsPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/itemcategories/export/pdf`, '_blank'));
document.getElementById('dmsExportVendorsPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/vendors/export/pdf`, '_blank'));
document.getElementById('dmsExportItemsPDF').addEventListener('click', () => {
  const q = String(document.getElementById('dmsItemsSearch')?.value || '').trim();
  const url = `${API_BASE}/api/dms/items/export/pdf${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  window.open(url, '_blank');
});
document.getElementById('dmsExportMedsPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/medcourses/export/pdf`, '_blank'));
document.getElementById('dmsExportPoliciesPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/policies/export/pdf`, '_blank'));
document.getElementById('dmsExportManagersPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/managers/export/pdf`, '_blank'));
document.getElementById('dmsExportVehiclesPDF').addEventListener('click', () => window.open(`${API_BASE}/api/dms/vehicles/export/pdf`, '_blank'));

// document.getElementById('dmsRefreshAll').addEventListener('click', ()=> {
//   loadDmsRegions(); loadDmsCustomers(); loadDmsItemCats(); loadDmsVendors();
//   loadDmsCompanies(); loadDmsItems(); loadDmsMeds(); loadDmsPolicies(); loadDmsManagers();
//   loadDmsVehicleTypes(); loadDmsVehicles();
// });

/* Auto load when DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  loadDmsRegions(); loadDmsCustomers(); loadDmsItemCats(); loadDmsVendors();
  loadDmsCompanies(); loadDmsItems(); loadDmsMeds(); loadDmsPolicies(); loadDmsManagers();
  loadDmsVehicleTypes(); loadDmsVehicles();
});

// ======================= 11.2 DMS Operations: Routes & Orders =======================
document.addEventListener('DOMContentLoaded', () => {

  // Function to load data
  function loadDmsOperations() {
    fetch(`${API_BASE}/api/dms-operations`)
      .then(res => res.json())
      .then(data => {
        const tbody = document.getElementById('dmsOpBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(op => {
          const row = `
            <tr>
              <td>${op.operationNo || '-'}</td>
              <td>${op.employee || '-'}</td>
              <td>${op.visitDate || '-'}</td>
              <td>${op.route || '-'}</td>
              <td>${op.plannedVisits || '-'}</td>
              <td>${op.completedVisits || '-'}</td>
              <td>${op.vanStock || '-'}</td>
              <td>${op.salesMapping || '-'}</td>
              <td>${op.remarks || '-'}</td>
              <td class="text-center">
                <button class="btn btn-danger btn-sm" onclick="deleteDmsOperation(${op.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`;
          tbody.insertAdjacentHTML('beforeend', row);
        });
      })
      .catch(err => console.error('Error loading DMS Operations:', err));
  }

  // ✅ Add Operation
  const form = document.getElementById('dmsOpForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newOp = {
        operationNo: document.getElementById('opNumber').value.trim(),
        employee: document.getElementById('opEmployee').value.trim(),
        visitDate: document.getElementById('opDate').value.trim(),
        route: document.getElementById('opRoute').value.trim(),
        plannedVisits: parseInt(document.getElementById('opPlanned').value) || 0,
        completedVisits: parseInt(document.getElementById('opCompleted').value) || 0,
        vanStock: document.getElementById('opVanStock').value.trim(),
        salesMapping: document.getElementById('opSalesMapping').value.trim(),
        remarks: document.getElementById('opRemarks').value.trim()
      };

      fetch(`${API_BASE}/api/dms-operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOp)
      })
        .then(res => res.json())
        .then(() => {
          document.getElementById('dmsOpAddCard').style.display = 'none';
          e.target.reset();
          loadDmsOperations();
        })
        .catch(err => console.error('Error adding operation:', err));
    });
  }

  // 🗑️ Delete
  window.deleteDmsOperation = function (id) {
    if (confirm('Are you sure you want to delete this operation?')) {
      fetch(`${API_BASE}/api/dms-operations/${id}`, { method: 'DELETE' })
        .then(() => loadDmsOperations());
    }
  };

  // Buttons
  const addBtn = document.getElementById('btnAddDmsOp');
  const cancelBtn = document.getElementById('cancelDmsOp');
  const exportBtn = document.getElementById('btnExportDmsOpPDF');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('dmsOpAddCard').style.display = 'block';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('dmsOpAddCard').style.display = 'none';
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.open(`${API_BASE}/api/dms-operations/export/pdf`, '_blank');
    });
  }

  // Load table initially
  loadDmsOperations();
});

// ======================= 12.0 Payroll Setup (Designation / Department) =======================

// Load
function loadPayrollSetup() {
  fetch(`${API_BASE}/api/payroll-setup`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('payrollSetupBody');
      tbody.innerHTML = '';

      data.forEach(p => {
        const row = `
          <tr>
            <td>${p.designation || '-'}</td>
            <td>${p.department || '-'}</td>
            <td>${p.head || '-'}</td>
            <td>${p.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deletePayrollSetup(${p.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading payroll setup:', err));
}

// Add
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('payrollSetupForm');
  const addCard = document.getElementById('payrollSetupAddCard');
  const btnAdd = document.getElementById('btnAddPayrollSetup');
  const btnCancel = document.getElementById('cancelPayrollSetupAdd');
  const btnExport = document.getElementById('btnExportPayrollSetupPDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newEntry = {
        designation: document.getElementById('designationTitle').value.trim(),
        department: document.getElementById('departmentName').value.trim(),
        head: document.getElementById('departmentHead').value.trim(),
        remarks: document.getElementById('designationRemarks').value.trim()
      };

      fetch(`${API_BASE}/api/payroll-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadPayrollSetup();
        })
        .catch(err => console.error('Error adding payroll setup:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/payroll-setup/export/pdf`, '_blank');
  });

  loadPayrollSetup();
});

// Delete
function deletePayrollSetup(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/payroll-setup/${id}`, { method: 'DELETE' })
      .then(() => loadPayrollSetup());
  }
}
// ======================= 12.1 Employee Groups / Employee / Track Employee =======================

// Load Employees
function loadEmployeeGroups() {
  fetch(`${API_BASE}/api/employee-groups`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('employeeGroupBody');
      tbody.innerHTML = '';

      data.forEach(emp => {
        const row = `
          <tr>
            <td>${emp.empId || '-'}</td>
            <td>${emp.name || '-'}</td>
            <td>${emp.group || '-'}</td>
            <td>${emp.designation || '-'}</td>
            <td>${emp.department || '-'}</td>
            <td>${emp.geoLocation || '-'}</td>
            <td>${emp.routeLogs || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteEmployeeGroup(${emp.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading employees:', err));
}

// Add Employee
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('employeeGroupForm');
  const addCard = document.getElementById('employeeGroupAddCard');
  const btnAdd = document.getElementById('btnAddEmployeeGroup');
  const btnCancel = document.getElementById('cancelEmployeeGroupAdd');
  const btnExport = document.getElementById('btnExportEmployeeGroupPDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newEmployee = {
        empId: document.getElementById('empUniqueId').value.trim(),
        name: document.getElementById('empFullName').value.trim(),
        group: document.getElementById('empGroup').value.trim(),
        designation: document.getElementById('empDesignation').value.trim(),
        department: document.getElementById('empDepartment').value.trim(),
        geoLocation: document.getElementById('empGeoLocation').value.trim(),
        routeLogs: document.getElementById('empRouteLogs').value.trim()
      };

      fetch(`${API_BASE}/api/employee-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadEmployeeGroups();
        })
        .catch(err => console.error('Error adding employee:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/employee-groups/export/pdf`, '_blank');
  });

  loadEmployeeGroups();
});

// Delete Employee
function deleteEmployeeGroup(id) {
  if (confirm('Are you sure you want to delete this employee record?')) {
    fetch(`${API_BASE}/api/employee-groups/${id}`, { method: 'DELETE' })
      .then(() => loadEmployeeGroups());
  }
}

// ======================= 12.2 Employee Visiting Days (Schedule Management) =======================

function loadVisitingDays() {
  fetch(`${API_BASE}/api/visiting-days`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('visitingDayBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const row = `
          <tr>
            <td>${v.empId || '-'}</td>
            <td>${v.empName || '-'}</td>
            <td>${v.day || '-'}</td>
            <td>${v.client || '-'}</td>
            <td>${v.route || '-'}</td>
            <td>${v.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteVisitingDay(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading visiting days:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('visitingDayForm');
  const addCard = document.getElementById('visitingDayAddCard');
  const btnAdd = document.getElementById('btnAddVisitingDay');
  const btnCancel = document.getElementById('cancelVisitingDayAdd');
  const btnExport = document.getElementById('btnExportVisitingDayPDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newVisit = {
        empId: document.getElementById('visitEmpId').value.trim(),
        empName: document.getElementById('visitEmpName').value.trim(),
        day: document.getElementById('visitDay').value.trim(),
        client: document.getElementById('visitClient').value.trim(),
        route: document.getElementById('visitRoute').value.trim(),
        remarks: document.getElementById('visitRemarks').value.trim()
      };

      fetch(`${API_BASE}/api/visiting-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVisit)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadVisitingDays();
        })
        .catch(err => console.error('Error adding visit:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/visiting-days/export/pdf`, '_blank');
  });

  loadVisitingDays();
});

function deleteVisitingDay(id) {
  if (confirm('Are you sure you want to delete this schedule?')) {
    fetch(`${API_BASE}/api/visiting-days/${id}`, { method: 'DELETE' })
      .then(() => loadVisitingDays());
  }
}
// ======================= 12.3 Bulk Attendance Upload & Editor =======================

function loadAttendance() {
  fetch(`${API_BASE}/api/attendance`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('attendanceBody');
      tbody.innerHTML = '';

      data.forEach(a => {
        const row = `
          <tr>
            <td>${a.empId || '-'}</td>
            <td>${a.name || '-'}</td>
            <td>${a.date || '-'}</td>
            <td>${a.status || '-'}</td>
            <td>${a.checkIn || '-'}</td>
            <td>${a.checkOut || '-'}</td>
            <td>${a.overtime || '-'}</td>
            <td>${a.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteAttendance(${a.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading attendance:', err));
}

// Add attendance
document.getElementById('attendanceForm')?.addEventListener('submit', e => {
  e.preventDefault();

  const newAttendance = {
    empId: document.getElementById('attEmpId').value.trim(),
    name: document.getElementById('attEmpName').value.trim(),
    date: document.getElementById('attDate').value,
    status: document.getElementById('attStatus').value,
    checkIn: document.getElementById('attCheckIn').value,
    checkOut: document.getElementById('attCheckOut').value,
    overtime: document.getElementById('attOvertime').value,
    remarks: document.getElementById('attRemarks').value
  };

  fetch(`${API_BASE}/api/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newAttendance)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('attendanceAddCard').style.display = 'none';
      e.target.reset();
      loadAttendance();
    })
    .catch(err => console.error('Error adding attendance:', err));
});

// Delete record
function deleteAttendance(id) {
  if (confirm('Are you sure you want to delete this attendance record?')) {
    fetch(`${API_BASE}/api/attendance/${id}`, { method: 'DELETE' })
      .then(() => loadAttendance());
  }
}

// Show/Hide form
document.getElementById('btnAddAttendance')?.addEventListener('click', () => {
  document.getElementById('attendanceAddCard').style.display = 'block';
});
document.getElementById('cancelAttendanceAdd')?.addEventListener('click', () => {
  document.getElementById('attendanceAddCard').style.display = 'none';
});

// CSV Import
document.getElementById('attendanceCSV')?.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const lines = event.target.result.split('\n').slice(1);
    const records = lines
      .map(line => line.split(','))
      .filter(cols => cols.length >= 5)
      .map(cols => ({
        empId: cols[0],
        name: cols[1],
        date: cols[2],
        status: cols[3],
        overtime: cols[4],
        remarks: cols[5] || ''
      }));

    fetch(`${API_BASE}/api/attendance/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records)
    })
      .then(res => res.json())
      .then(() => loadAttendance());
  };
  reader.readAsText(file);
});

// Export PDF
document.getElementById('btnExportAttendancePDF')?.addEventListener('click', () => {
  window.open(`${API_BASE}/api/attendance/export/pdf`, '_blank');
});

// Auto load
document.addEventListener('DOMContentLoaded', () => loadAttendance());

// ======================= 12.4 Expense Claims =======================

function loadExpenseClaims() {
  fetch(`${API_BASE}/api/expense-claims`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('expenseClaimsBody');
      tbody.innerHTML = '';
      data.forEach(c => {
        const attachBtn = c.attachment
          ? `<button class="btn btn-sm btn-outline-primary" onclick="viewFile('${c.attachment}')"><i class="bi bi-paperclip"></i> View</button>`
          : `<span class="text-muted small">No</span>`;
        const row = `
          <tr>
            <td>${c.claimNo || '-'}</td>
            <td>${c.employee || '-'}</td>
            <td>${c.type || '-'}</td>
            <td class="text-end">${parseFloat(c.total || 0).toFixed(2)}</td>
            <td>${c.period || '-'}</td>
            <td>${c.status || '-'}</td>
            <td class="text-center">${attachBtn}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteExpenseClaim(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading expense claims:', err));
}

// small helper to open uploaded file path
function viewFile(path) {
  if (!path) return alert('No file.');
  window.open(`${API_BASE}${path}`, '_blank');
}

// Distribution line helpers
function addClaimLineRow(line = {}) {
  const tbody = document.getElementById('claimDistributionBody');
  const id = `line-${Date.now()}-${Math.floor(Math.random() * 999)}`;
  const row = `
    <tr id="${id}">
      <td><input class="form-control form-control-sm cc-center" placeholder="Cost Center" value="${line.costCenter || ''}"></td>
      <td><input class="form-control form-control-sm cc-amount" type="number" value="${line.amount || 0}"></td>
      <td><input class="form-control form-control-sm cc-notes" value="${line.notes || ''}"></td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('${id}').remove();">Remove</button>
      </td>
    </tr>`;
  tbody.insertAdjacentHTML('beforeend', row);
}

document.addEventListener('DOMContentLoaded', () => {
  // UI elements
  const form = document.getElementById('expenseClaimsForm');
  const addCard = document.getElementById('expenseClaimsAddCard');
  const btnAdd = document.getElementById('btnAddExpenseClaim');
  const btnCancel = document.getElementById('cancelExpenseClaimsAdd');
  const btnExport = document.getElementById('btnExportExpenseClaimsPDF');
  const btnAddLine = document.getElementById('btnAddClaimLine');
  const attachmentInput = document.getElementById('claimAttachment');

  if (btnAdd) btnAdd.addEventListener('click', () => {
    addCard.style.display = 'block';
    // ensure at least one blank distribution line
    if (!document.querySelector('#claimDistributionBody tr')) addClaimLineRow();
  });
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnAddLine) btnAddLine.addEventListener('click', () => addClaimLineRow());
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/expense-claims/export/pdf`, '_blank');
  });

  // handle form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // collect distribution lines
      const lines = Array.from(document.querySelectorAll('#claimDistributionBody tr')).map(tr => {
        return {
          costCenter: tr.querySelector('.cc-center')?.value.trim(),
          amount: parseFloat(tr.querySelector('.cc-amount')?.value || 0) || 0,
          notes: tr.querySelector('.cc-notes')?.value.trim() || ''
        };
      });

      // compute total
      const total = lines.reduce((s, l) => s + (l.amount || 0), 0);

      // handle attachment upload if file chosen
      let attachmentPath = '';
      const file = attachmentInput?.files?.[0];
      if (file) {
        // simple client-side upload to server endpoint (you likely already have /uploads handling)
        const fd = new FormData();
        fd.append('file', file);
        try {
          const up = await fetch(`${API_BASE}/api/uploads`, { method: 'POST', body: fd });
          const upRes = await up.json();
          if (upRes && upRes.path) attachmentPath = upRes.path;
        } catch (err) {
          console.warn('Attachment upload failed, continuing without it.', err);
        }
      }

      const payload = {
        claimNo: document.getElementById('claimNumber').value.trim(),
        employee: document.getElementById('claimEmployee').value.trim(),
        type: document.getElementById('claimType').value,
        period: document.getElementById('claimPeriod').value,
        total,
        lines,
        attachment: attachmentPath,
        status: 'Draft',
        createdAt: new Date().toISOString()
      };

      fetch(`${API_BASE}/api/expense-claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          form.reset();
          document.getElementById('claimDistributionBody').innerHTML = '';
          loadExpenseClaims();
        })
        .catch(err => console.error('Error saving expense claim:', err));
    });
  }

  loadExpenseClaims();
});

// ======================= 12.5 Salary Generation / Payment =======================

function loadSalaries() {
  fetch(`${API_BASE}/api/salary-generation`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('salaryBody');
      tbody.innerHTML = '';
      data.forEach(s => {
        const net = (parseFloat(s.earnings || 0) - parseFloat(s.deductions || 0) - parseFloat(s.advances || 0)).toFixed(2);
        const row = `
          <tr>
            <td>${s.salaryNo || '-'}</td>
            <td>${s.employee || '-'}</td>
            <td>${s.month || '-'}</td>
            <td class="text-end">${parseFloat(s.earnings || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(s.deductions || 0).toFixed(2)}</td>
            <td class="text-end">${parseFloat(s.advances || 0).toFixed(2)}</td>
            <td class="text-end">${net}</td>
            <td>${s.mode || '-'}</td>
            <td>${s.date || '-'}</td>
            <td>${s.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteSalary(${s.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

document.getElementById('salaryForm').addEventListener('submit', e => {
  e.preventDefault();
  const newSalary = {
    salaryNo: document.getElementById('salaryNumber').value.trim(),
    employee: document.getElementById('salaryEmployee').value.trim(),
    month: document.getElementById('salaryMonth').value,
    earnings: parseFloat(document.getElementById('salaryEarnings').value) || 0,
    deductions: parseFloat(document.getElementById('salaryDeductions').value) || 0,
    advances: parseFloat(document.getElementById('salaryAdvances').value) || 0,
    mode: document.getElementById('salaryMode').value,
    date: document.getElementById('salaryDate').value,
    remarks: document.getElementById('salaryRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/salary-generation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSalary)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('salaryAddCard').style.display = 'none';
      e.target.reset();
      loadSalaries();
    });
});

function deleteSalary(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/salary-generation/${id}`, { method: 'DELETE' })
      .then(() => loadSalaries());
  }
}

document.getElementById('btnAddSalary').addEventListener('click', () => {
  document.getElementById('salaryAddCard').style.display = 'block';
});
document.getElementById('cancelSalaryAdd').addEventListener('click', () => {
  document.getElementById('salaryAddCard').style.display = 'none';
});
document.getElementById('btnExportSalaryPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/salary-generation/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', loadSalaries);

// ======================= 12.7 Employee Bulk → Employee Balance =======================

function loadEmployeeBalances() {
  fetch(`${API_BASE}/api/employee-balances`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('employeeBalanceBody');
      tbody.innerHTML = '';
      data.forEach(b => {
        const row = `
          <tr>
            <td>${b.balanceNo || '-'}</td>
            <td>${b.employee || '-'}</td>
            <td class="text-end">${parseFloat(b.openingBalance || 0).toFixed(2)}</td>
            <td class="text-center">${b.leaveBalance || 0}</td>
            <td class="text-end">${parseFloat(b.loanBalance || 0).toFixed(2)}</td>
            <td>${b.effectiveDate || '-'}</td>
            <td>${b.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteEmployeeBalance(${b.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading balances:', err));
}

document.getElementById('employeeBalanceForm').addEventListener('submit', e => {
  e.preventDefault();

  const newBalance = {
    balanceNo: document.getElementById('balanceNumber').value.trim(),
    employee: document.getElementById('balanceEmployee').value.trim(),
    openingBalance: parseFloat(document.getElementById('balanceOpening').value) || 0,
    leaveBalance: parseFloat(document.getElementById('balanceLeave').value) || 0,
    loanBalance: parseFloat(document.getElementById('balanceLoan').value) || 0,
    effectiveDate: document.getElementById('balanceEffectiveDate').value,
    remarks: document.getElementById('balanceRemarks').value.trim()
  };

  fetch(`${API_BASE}/api/employee-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBalance)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('balanceAddCard').style.display = 'none';
      e.target.reset();
      loadEmployeeBalances();
    })
    .catch(err => console.error('Error adding balance:', err));
});

function deleteEmployeeBalance(id) {
  if (confirm('Are you sure you want to delete this balance record?')) {
    fetch(`${API_BASE}/api/employee-balance/${id}`, { method: "DELETE" })
      .then(() => loadEmployeeBalances());
  }
}

document.getElementById('btnAddBalance').addEventListener('click', () => {
  document.getElementById('balanceAddCard').style.display = 'block';
});

// ======================= 12.8 Payslip PDF & Email =======================

function loadPayslips() {
  fetch(`${API_BASE}/api/payslips`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('payslipBody');
      tbody.innerHTML = '';

      data.forEach(p => {
        const row = `
          <tr>
            <td>${p.payslipNo || '-'}</td>
            <td>${p.employee || '-'}</td>
            <td>${p.month || '-'}</td>
            <td class="text-end">${parseFloat(p.netSalary || 0).toFixed(2)}</td>
            <td>${p.status || 'Generated'}</td>
            <td>${p.emailSent ? '✅ Yes' : '❌ No'}</td>
            <td class="text-center">
              <button class="btn btn-outline-primary btn-sm" onclick="viewPayslipPDF('${p.id}')">
                <i class="bi bi-file-earmark-text"></i>
              </button>
              <button class="btn btn-outline-success btn-sm" onclick="emailPayslip('${p.id}')">
                <i class="bi bi-envelope"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="deletePayslip(${p.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading payslips:', err));
}

// Add Payslip
document.getElementById('payslipForm').addEventListener('submit', e => {
  e.preventDefault();

  const newPayslip = {
    payslipNo: document.getElementById('payslipNumber').value.trim(),
    employee: document.getElementById('payslipEmployee').value.trim(),
    month: document.getElementById('payslipMonth').value,
    netSalary: parseFloat(document.getElementById('payslipSalary').value) || 0,
    email: document.getElementById('payslipEmail').value.trim(),
    remarks: document.getElementById('payslipRemarks').value.trim(),
    status: 'Generated',
    emailSent: false
  };

  fetch(`${API_BASE}/api/payslips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPayslip)
  })
    .then(res => res.json())
    .then(() => {
      document.getElementById('payslipAddCard').style.display = 'none';
      e.target.reset();
      loadPayslips();
    })
    .catch(err => console.error('Error adding payslip:', err));
});

function deletePayslip(id) {
  if (confirm('Are you sure you want to delete this payslip?')) {
    fetch(`${API_BASE}/api/payslips/${id}`, { method: 'DELETE' })
      .then(() => loadPayslips());
  }
}

function viewPayslipPDF(id) {
  window.open(`${API_BASE}/api/payslips/export/pdf/${id}`, '_blank');
}

function emailPayslip(id) {
  fetch(`${API_BASE}/api/payslips/email/${id}`, { method: 'POST' })
    .then(res => res.json())
    .then(res => {
      alert(res.message || 'Payslip email sent!');
      loadPayslips();
    })
    .catch(err => console.error('Error emailing payslip:', err));
}

document.getElementById('btnAddPayslip').addEventListener('click', () => {
  document.getElementById('payslipAddCard').style.display = 'block';
});
document.getElementById('cancelPayslipAdd').addEventListener('click', () => {
  document.getElementById('payslipAddCard').style.display = 'none';
});
document.getElementById('btnExportPayslipsPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/payslips/export/pdf`, '_blank');
});

document.addEventListener('DOMContentLoaded', loadPayslips);

// ======================= 13.1 Financial Year Management =======================

// Load Years
function loadFinancialYears() {
  fetch(`${API_BASE}/api/financial-years`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('financialYearBody');
      tbody.innerHTML = '';

      data.forEach(fy => {
        const row = `
          <tr>
            <td>${fy.code || '-'}</td>
            <td>${fy.startDate || '-'}</td>
            <td>${fy.endDate || '-'}</td>
            <td>${fy.status || '-'}</td>
            <td>${fy.createdAt ? new Date(fy.createdAt).toLocaleDateString() : '-'}</td>
            <td>${fy.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteFinancialYear(${fy.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading years:', err));
}

// Add Year
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('financialYearForm');
  const addCard = document.getElementById('financialYearAddCard');
  const btnAdd = document.getElementById('btnAddFinancialYear');
  const btnCancel = document.getElementById('cancelFinancialYearAdd');
  const btnExport = document.getElementById('btnExportFinancialYearPDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newYear = {
        code: document.getElementById('fyCode').value.trim(),
        startDate: document.getElementById('fyStartDate').value,
        endDate: document.getElementById('fyEndDate').value,
        status: document.getElementById('fyStatus').value,
        remarks: document.getElementById('fyRemarks').value.trim(),
        createdAt: new Date()
      };

      fetch(`${API_BASE}/api/financial-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newYear)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadFinancialYears();
        })
        .catch(err => console.error('Error adding year:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/financial-years/export/pdf`, '_blank');
  });

  loadFinancialYears();
});

// Delete Year
function deleteFinancialYear(id) {
  if (confirm('Are you sure you want to delete this financial year?')) {
    fetch(`${API_BASE}/api/financial-years/${id}`, { method: 'DELETE' })
      .then(() => loadFinancialYears());
  }
}

// ================================================================
//  13.2) Chart of Accounts (COA) — 7 SSMS fields
//  API: /api/chart-of-accounts  →  routes/chartOfAccounts.js
// ================================================================
let cachedCOA = [];

function renderCOATable(list) {
  const tbody = document.getElementById('coaBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No accounts found.</td></tr>';
    return;
  }
  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.coa_id || '-'}</td>
      <td>${c.own_id || '-'}</td>
      <td>${c.parent || '-'}</td>
      <td>${c.description || '-'}</td>
      <td>${c.family || '-'}</td>
      <td class="text-center">${c.coa_level ?? '-'}</td>
      <td class="text-center">${c.coa_type || '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editCOA(${c.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCOA(${c.id})">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function loadCOA() {
  fetch(`${API_BASE}/api/chart-of-accounts`)
    .then(res => res.json())
    .then(data => {
      cachedCOA = data;
      renderCOATable(cachedCOA);

      // Search
      const searchEl = document.getElementById('coaSearch');
      if (searchEl) {
        searchEl.oninput = () => {
          const q = searchEl.value.toLowerCase();
          renderCOATable(q
            ? cachedCOA.filter(c =>
                (c.coa_id||'').toLowerCase().includes(q) ||
                (c.description||'').toLowerCase().includes(q) ||
                (c.family||'').toLowerCase().includes(q) ||
                (c.parent||'').toLowerCase().includes(q)
              )
            : cachedCOA
          );
        };
      }

      // Add btn
      const addBtn = document.getElementById('btnAddCOA');
      if (addBtn) addBtn.onclick = () => showCOAForm();

      // Cancel btn
      const cancelBtn = document.getElementById('cancelCOAForm');
      if (cancelBtn) cancelBtn.onclick = () => hideCOAForm();

      // Export CSV
      const csvBtn = document.getElementById('btnExportCOACSV');
      if (csvBtn) csvBtn.onclick = () => exportCOAcsv();

      // Export PDF
      const pdfBtn = document.getElementById('btnExportCOAPDF');
      if (pdfBtn) pdfBtn.onclick = () => window.open(`${API_BASE}/api/chart-of-accounts/export/pdf`, '_blank');

      // Form submit
      const form = document.getElementById('coaForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          try {
            const editId = document.getElementById('coaEditId')?.value.trim();
            const payload = {
              coa_id:      document.getElementById('coaId')?.value.trim(),
              own_id:      document.getElementById('coaOwnId')?.value.trim(),
              parent:      document.getElementById('coaParent')?.value.trim(),
              description: document.getElementById('coaDescription')?.value.trim(),
              family:      document.getElementById('coaFamily')?.value.trim(),
              coa_level:   Number(document.getElementById('coaLevel')?.value) || null,
              coa_type:    document.getElementById('coaType')?.value
            };
            if (!payload.coa_id || !payload.description) {
              alert('COA ID and Description are required.');
              return;
            }
            const isEdit = !!editId;
            const url = isEdit
              ? `${API_BASE}/api/chart-of-accounts/${editId}`
              : `${API_BASE}/api/chart-of-accounts`;
            const res = await fetch(url, {
              method: isEdit ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(isEdit ? 'Failed to update' : 'Failed to add');
            alert(isEdit ? 'Account updated!' : 'Account added!');
            hideCOAForm();
            loadCOA();
          } catch (err) {
            alert('Error: ' + err.message);
          }
        };
      }
    })
    .catch(err => console.error('Error loading COA:', err));
}

function showCOAForm(c) {
  const card = document.getElementById('coaFormCard');
  const title = document.getElementById('coaFormTitle');
  if (!card) return;
  document.getElementById('coaEditId').value   = c?.id          || '';
  document.getElementById('coaId').value        = c?.coa_id      || '';
  document.getElementById('coaOwnId').value     = c?.own_id      || '';
  document.getElementById('coaParent').value    = c?.parent      || '';
  document.getElementById('coaDescription').value = c?.description || '';
  document.getElementById('coaFamily').value    = c?.family      || '';
  document.getElementById('coaLevel').value     = c?.coa_level   ?? '';
  document.getElementById('coaType').value      = c?.coa_type    || '';
  if (title) title.textContent = c ? 'Edit Account' : 'Add Account';
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideCOAForm() {
  const card = document.getElementById('coaFormCard');
  if (card) card.style.display = 'none';
  const form = document.getElementById('coaForm');
  if (form) form.reset();
  const editId = document.getElementById('coaEditId');
  if (editId) editId.value = '';
}

window.editCOA = function(id) {
  const c = cachedCOA.find(x => x.id === id);
  if (c) showCOAForm(c);
};

function deleteCOA(id) {
  if (!confirm('Delete this account?')) return;
  fetch(`${API_BASE}/api/chart-of-accounts/${id}`, { method: 'DELETE' })
    .then(() => loadCOA())
    .catch(err => alert('Delete failed: ' + err.message));
}

function exportCOAcsv() {
  if (!cachedCOA.length) return alert('No data to export.');
  const headers = ['COA ID','Own ID','Parent','Description','Family','COA Level','COA Type'];
  const rows = cachedCOA.map(c => [
    c.coa_id, c.own_id, c.parent, c.description,
    c.family, c.coa_level ?? '', c.coa_type
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `coa_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
// ================================================================



// ======================= 13.3 Bank / Cash & Currency Masters =======================

function loadBankCashCurrency() {
  fetch(`${API_BASE}/api/bank-cash-currency`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('bankCashCurrencyBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.type || '-'}</td>
            <td>${r.name || '-'}</td>
            <td>${r.accountNo || '-'}</td>
            <td>${r.currency || '-'}</td>
            <td>${r.rate || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteBankCashCurrency(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading records:', err));
}

// Add Record
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('bankCashCurrencyForm');
  const addCard = document.getElementById('bankCashCurrencyAddCard');
  const btnAdd = document.getElementById('btnAddBankCashCurrency');
  const btnCancel = document.getElementById('cancelBankCashCurrencyAdd');
  const btnExport = document.getElementById('btnExportBankCashCurrencyPDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newRecord = {
        type: document.getElementById('bcmType').value,
        name: document.getElementById('bcmName').value.trim(),
        accountNo: document.getElementById('bcmAccountNo').value.trim(),
        currency: document.getElementById('bcmCurrency').value.trim(),
        rate: parseFloat(document.getElementById('bcmRate').value) || 0,
        remarks: document.getElementById('bcmRemarks').value.trim()
      };

      fetch(`${API_BASE}/api/bank-cash-currency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          form.reset();
          loadBankCashCurrency();
        })
        .catch(err => console.error('Error adding record:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/bank-cash-currency/export/pdf`, '_blank');
  });

  loadBankCashCurrency();
});

// Delete Record
function deleteBankCashCurrency(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/bank-cash-currency/${id}`, { method: 'DELETE' })
      .then(() => loadBankCashCurrency());
  }
}

// ======================= 13.4 Voucher Management (Fixed & Enhanced) =======================

// Generate Unique Voucher No
function generateUniqueVoucherNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000);
  return `VOUCH-${y}${m}${d}-${rand}`;
}

// Load Vouchers
function loadFinancialVouchers() {
  fetch(`${API_BASE}/api/vouchers`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('financialVoucherBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const row = `
          <tr>
            <td>${v.voucherNo}</td>
            <td>${v.date}</td>
            <td>${v.type}</td>
            <td>${v.account}</td>
            <td>${v.amount}</td>
            <td>${v.status}</td>
            <td class="text-center">
              ${v.attachment
            ? `<a href="${v.attachment}" target="_blank" class="btn btn-outline-primary btn-sm">View</a>`
            : '<span class="text-muted">No</span>'}
            </td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteFinancialVoucher(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading vouchers:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('financialVoucherForm');
  const addCard = document.getElementById('financialVoucherAddCard');
  const btnAdd = document.getElementById('btnAddFinancialVoucher');
  const btnCancel = document.getElementById('cancelFinancialVoucherAdd');
  const btnExport = document.getElementById('btnExportFinancialVoucherPDF');
  const voucherNoField = document.getElementById('financialVoucherNo');
  const voucherDateField = document.getElementById('financialVoucherDate');

  // Add Voucher Button
  if (btnAdd) btnAdd.addEventListener('click', () => {
    voucherNoField.value = generateUniqueVoucherNo();
    const today = new Date().toISOString().split('T')[0];
    voucherDateField.value = today;
    addCard.style.display = 'block';
  });

  // Cancel Button
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');

  // Save Form
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fileInput = document.getElementById('financialVoucherAttachment');
      let filePath = '';

      if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const uploadRes = await fetch(`${API_BASE}/api/uploads`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        filePath = uploadData.path;
      }

      const voucherData = {
        voucherNo: document.getElementById('financialVoucherNo').value.trim(),
        date: document.getElementById('financialVoucherDate').value,
        type: document.getElementById('financialVoucherType').value,
        account: document.getElementById('financialVoucherAccount').value.trim(),
        narration: document.getElementById('financialVoucherNarration').value.trim(),
        amount: document.getElementById('financialVoucherAmount').value,
        status: document.getElementById('financialVoucherStatus').value,
        attachment: filePath
      };

      await fetch(`${API_BASE}/api/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voucherData)
      });

      form.reset();
      addCard.style.display = 'none';
      loadFinancialVouchers();
    });
  }

  // PDF Export
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/vouchers/export/pdf`, '_blank');
  });

  loadFinancialVouchers();
});

// Delete Voucher
function deleteFinancialVoucher(id) {
  if (confirm('Delete this voucher?')) {
    fetch(`${API_BASE}/api/vouchers/${id}`, { method: 'DELETE' })
      .then(() => loadFinancialVouchers());
  }
}

// ======================= 13.5 Enhanced Voucher Types / Posting =======================

function loadVoucherTypes() {
  fetch(`${API_BASE}/api/voucher-types`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('voucherTypesBody');
      tbody.innerHTML = '';

      data.forEach(v => {
        const row = `
          <tr>
            <td>${v.code}</td>
            <td>${v.name}</td>
            <td>${v.postingMode}</td>
            <td>${v.sequence}</td>
            <td>${v.status}</td>
            <td>${v.postedBy || '-'}</td>
            <td>${v.postedOn || '-'}</td>
            <td>${v.reversalRef || '-'}</td>
            <td>
              <button class="btn btn-sm btn-primary me-1" onclick="postVoucher(${v.id})">
                <i class="bi bi-upload"></i>
              </button>
              <button class="btn btn-sm btn-warning me-1" onclick="reverseVoucher(${v.id})">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteVoucherType(${v.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading vouchers:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('voucherTypeForm');
  const addCard = document.getElementById('voucherTypeAddCard');
  const btnAdd = document.getElementById('btnAddVoucherType');
  const btnCancel = document.getElementById('cancelVoucherTypeAdd');
  const btnExport = document.getElementById('btnExportVoucherTypePDF');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newVoucher = {
        code: document.getElementById('voucherCodeUnique').value.trim(),
        name: document.getElementById('voucherNameType').value.trim(),
        postingMode: document.getElementById('voucherPostingMode').value,
        sequence: document.getElementById('voucherSequenceNo').value || 0,
        status: document.getElementById('voucherStatus').value,
        reversalRef: document.getElementById('voucherReversalRef').value.trim(),
        postedBy: document.getElementById('voucherPostedBy').value || 'System Admin',
        postedOn: document.getElementById('voucherPostedOn').value || new Date().toLocaleString(),
      };

      fetch(`${API_BASE}/api/voucher-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVoucher)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadVoucherTypes();
        });
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/voucher-types/export/pdf`, '_blank');
  });

  loadVoucherTypes();
});

function postVoucher(id) {
  fetch(`${API_BASE}/api/voucher-types/post/${id}`, { method: 'PUT' })
    .then(() => loadVoucherTypes());
}

function reverseVoucher(id) {
  fetch(`${API_BASE}/api/voucher-types/reverse/${id}`, { method: 'PUT' })
    .then(() => loadVoucherTypes());
}

function deleteVoucherType(id) {
  if (confirm('Delete this voucher type?')) {
    fetch(`${API_BASE}/api/voucher-types/${id}`, { method: 'DELETE' })
      .then(() => loadVoucherTypes());
  }
}

// ======================= 13.6) Bank Reconcile =======================

function loadBankReconcile() {
  fetch(`${API_BASE}/api/bank-reconcile`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('bankReconcileBody');
      tbody.innerHTML = '';
      data.forEach(txn => {
        const row = `
          <tr>
            <td>${txn.date}</td>
            <td>${txn.description}</td>
            <td>${txn.debit || '-'}</td>
            <td>${txn.credit || '-'}</td>
            <td>${txn.balance || '-'}</td>
            <td>${txn.matchedVoucher || '-'}</td>
            <td>
              <span class="badge bg-${txn.status === 'Matched' ? 'success' : txn.status === 'Pending' ? 'warning' : 'danger'}">
                ${txn.status}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-success me-1" onclick="markAsMatched(${txn.id})">
                <i class="bi bi-check-circle"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="markAsPending(${txn.id})">
                <i class="bi bi-clock"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading Bank Reconcile:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const btnUpload = document.getElementById('btnUploadBankStatement');
  const btnMatch = document.getElementById('btnAutoMatch');
  const btnExport = document.getElementById('btnExportBankReconcilePDF');

  // Upload CSV
  if (btnUpload) {
    btnUpload.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.addEventListener('change', async e => {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`${API_BASE}/api/bank-reconcile/upload`, {
          method: 'POST',
          body: formData
        });
        loadBankReconcile();
      });
      input.click();
    });
  }

  // Auto-Match
  if (btnMatch) {
    btnMatch.addEventListener('click', () => {
      fetch(`${API_BASE}/api/bank-reconcile/auto-match`, { method: 'POST' })
        .then(() => loadBankReconcile());
    });
  }

  // Export PDF
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      window.open(`${API_BASE}/api/bank-reconcile/export/pdf`, '_blank');
    });
  }

  loadBankReconcile();
});

function markAsMatched(id) {
  fetch(`${API_BASE}/api/bank-reconcile/match/${id}`, { method: 'PUT' })
    .then(() => loadBankReconcile());
}

function markAsPending(id) {
  fetch(`${API_BASE}/api/bank-reconcile/pending/${id}`, { method: 'PUT' })
    .then(() => loadBankReconcile());
}

// ======================= 13.7) Cheque Book Record Keeping / Cancellation =======================

function loadChequeBooks() {
  fetch(`${API_BASE}/api/cheque-books`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('chequeBookBody');
      tbody.innerHTML = '';
      data.forEach(cb => {
        const row = `
          <tr>
            <td>${cb.bankName}</td>
            <td>${cb.branch}</td>
            <td>${cb.accountNo}</td>
            <td>${cb.range}</td>
            <td>${cb.issuedDate}</td>
            <td><span class="badge bg-${cb.status === 'Cancelled' ? 'danger' : cb.status === 'Cleared' ? 'success' : 'secondary'}">${cb.status}</span></td>
            <td>
              <button class="btn btn-danger btn-sm me-1" onclick="cancelChequeBook(${cb.id})">
                <i class="bi bi-x-circle"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="deleteChequeBook(${cb.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading cheque books:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chequeBookForm');
  const addCard = document.getElementById('chequeBookAddCard');
  const btnAdd = document.getElementById('btnAddChequeBook');
  const btnCancel = document.getElementById('cancelChequeBookAdd');
  const btnExport = document.getElementById('btnExportChequeBookPDF');

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newChequeBook = {
        bankName: document.getElementById('cbBankName').value.trim(),
        branch: document.getElementById('cbBranch').value.trim(),
        accountNo: document.getElementById('cbAccountNo').value.trim(),
        range: document.getElementById('cbRange').value.trim(),
        issuedDate: document.getElementById('cbIssuedDate').value,
        status: document.getElementById('cbStatus').value
      };

      fetch(`${API_BASE}/api/cheque-books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChequeBook)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadChequeBooks();
        });
    });
  }

  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/cheque-books/export/pdf`, '_blank');
  });

  loadChequeBooks();
});

function cancelChequeBook(id) {
  if (confirm('Are you sure you want to cancel this cheque book?')) {
    fetch(`${API_BASE}/api/cheque-books/cancel/${id}`, { method: 'PUT' })
      .then(() => loadChequeBooks());
  }
}

function deleteChequeBook(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`${API_BASE}/api/cheque-books/${id}`, { method: 'DELETE' })
      .then(() => loadChequeBooks());
  }
}

// ======================= 13.8 Taxes & Compliance =======================

function ensureTaxDataFiles() {
  // optional: called on startup if you want to pre-create the JSON files on client side check
}

// Load Tax Masters
function loadTaxMasters() {
  fetch(`${API_BASE}/api/taxes/masters`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('taxMasterBody');
      tbody.innerHTML = '';
      data.forEach(t => {
        const row = `
          <tr>
            <td>${t.id}</td>
            <td>${t.type}</td>
            <td>${t.code}</td>
            <td>${t.description || '-'}</td>
            <td class="text-end">${Number(t.rate || 0).toFixed(2)}</td>
            <td>${t.appliesTo || '-'}</td>
            <td>${t.identifier || '-'}</td>
            <td>${t.createdAt ? (new Date(t.createdAt)).toLocaleDateString() : '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteTaxMaster(${t.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });

      // fill adjustment tax code selector
      const adjSel = document.getElementById('taxAdjCode');
      if (adjSel) {
        adjSel.innerHTML = '<option value="">Select Tax</option>';
        data.forEach(t => adjSel.insertAdjacentHTML('beforeend', `<option value="${t.code}">${t.code} — ${t.type}</option>`));
      }
    })
    .catch(err => console.error('Error loading tax masters:', err));
}

// Add Tax Master
document.getElementById('taxMasterForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    type: document.getElementById('taxType').value,
    code: document.getElementById('taxCode').value.trim(),
    description: document.getElementById('taxDescription').value.trim(),
    rate: parseFloat(document.getElementById('taxRate').value) || 0,
    appliesTo: document.getElementById('taxAppliesTo').value,
    identifier: document.getElementById('taxIdentifier').value.trim(),
    createdAt: new Date().toISOString()
  };
  fetch(`${API_BASE}/api/taxes/masters`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })
    .then(() => {
      document.getElementById('taxMasterAddCard').style.display = 'none';
      e.target.reset();
      loadTaxMasters();
    })
    .catch(err => console.error('Error adding tax master:', err));
});

function deleteTaxMaster(id) {
  if (!confirm('Delete this tax master?')) return;
  fetch(`${API_BASE}/api/taxes/masters/${id}`, { method: 'DELETE' })
    .then(() => loadTaxMasters());
}

// Buttons
document.getElementById('btnAddTaxMaster').addEventListener('click', () => {
  document.getElementById('taxMasterAddCard').style.display = 'block';
});
document.getElementById('cancelTaxMasterAdd').addEventListener('click', () => {
  document.getElementById('taxMasterAddCard').style.display = 'none';
});
document.getElementById('btnExportTaxMastersPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/taxes/export/masters/pdf`, '_blank');
});

document.getElementById('btnExportTaxRegisterPDF').addEventListener('click', () => {
  window.open(`${API_BASE}/api/taxes/export/register/pdf`, '_blank');
});

// Tax Adjustments logic
function loadTaxAdjustments() {
  fetch(`${API_BASE}/api/taxes/adjustments`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('taxAdjBody');
      tbody.innerHTML = '';
      data.forEach(a => {
        const row = `
          <tr>
            <td>${a.adjNo || '-'}</td>
            <td>${a.type}</td>
            <td>${a.code || '-'}</td>
            <td class="text-end">${Number(a.amount || 0).toFixed(2)}</td>
            <td>${a.reference || '-'}</td>
            <td>${a.remarks || '-'}</td>
            <td>${a.date ? (new Date(a.date)).toLocaleDateString() : '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteTaxAdjustment(${a.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading tax adjustments:', err));
}

document.getElementById('taxAdjustmentForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    adjNo: document.getElementById('taxAdjNo').value.trim() || `ADJ-${Date.now()}`,
    type: document.getElementById('taxAdjType').value,
    code: document.getElementById('taxAdjCode').value,
    amount: parseFloat(document.getElementById('taxAdjAmount').value) || 0,
    reference: document.getElementById('taxAdjRef').value.trim(),
    remarks: document.getElementById('taxAdjRemarks').value.trim(),
    date: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  fetch(`${API_BASE}/api/taxes/adjustments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })
    .then(() => {
      e.target.reset();
      loadTaxAdjustments();
    })
    .catch(err => console.error('Error adding tax adjustment:', err));
});

function deleteTaxAdjustment(id) {
  if (!confirm('Delete adjustment?')) return;
  fetch(`${API_BASE}/api/taxes/adjustments/${id}`, { method: 'DELETE' })
    .then(() => loadTaxAdjustments());
}

// Auto load
document.addEventListener('DOMContentLoaded', () => {
  loadTaxMasters();
  loadTaxAdjustments();
});

// ======================= 13.9 Costing & Inventory Valuation (Enhanced) =======================

function loadCostingRecords() {
  fetch(`${API_BASE}/api/costing-valuation`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('costingBody');
      tbody.innerHTML = '';

      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.batchId || '-'}</td>
            <td>${r.item || '-'}</td>
            <td>${r.method || '-'}</td>
            <td>${r.cogs?.toFixed(2) || 0}</td>
            <td>${r.date || '-'}</td>
            <td>${r.remarks || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="deleteCostingRecord(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    })
    .catch(err => console.error('Error loading Costing Records:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('costingForm');
  const addCard = document.getElementById('costingAddCard');
  const btnAdd = document.getElementById('btnAddCostingRecord');
  const btnCancel = document.getElementById('cancelCostingAdd');
  const btnExport = document.getElementById('btnExportCostingPDF');
  const btnSummary = document.getElementById('btnExportCOGSSummary');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const newRecord = {
        batchId: document.getElementById('valuationBatchId').value.trim(),
        item: document.getElementById('valuationItem').value.trim(),
        method: document.getElementById('valuationMethod').value,
        cogs: parseFloat(document.getElementById('valuationCOGS').value || 0),
        date: document.getElementById('valuationDateUnique').value,
        remarks: document.getElementById('valuationRemarks').value.trim()
      };

      fetch(`${API_BASE}/api/costing-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = 'none';
          e.target.reset();
          loadCostingRecords();
        })
        .catch(err => console.error('Error adding record:', err));
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', () => addCard.style.display = 'block');
  if (btnCancel) btnCancel.addEventListener('click', () => addCard.style.display = 'none');
  if (btnExport) btnExport.addEventListener('click', () => {
    window.open(`${API_BASE}/api/costing-valuation/export/pdf`, '_blank');
  });
  if (btnSummary) btnSummary.addEventListener('click', () => {
    window.open(`${API_BASE}/api/costing-valuation/export/summary`, '_blank');
  });

  loadCostingRecords();
});

function deleteCostingRecord(id) {
  if (confirm('Are you sure you want to delete this valuation record?')) {
    fetch(`${API_BASE}/api/costing-valuation/${id}`, { method: 'DELETE' })
      .then(() => loadCostingRecords());
  }
}

// ======================= 13.10 Closing & Reporting =======================
function loadClosingReports() {
  fetch(`${API_BASE}/api/closing-reporting`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("closingReportBody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.id}</td>
            <td>${r.type}</td>
            <td>${r.period}</td>
            <td>${r.debit}</td>
            <td>${r.credit}</td>
            <td>${(r.debit - r.credit).toFixed(2)}</td>
            <td>${r.status}</td>
            <td>${r.date}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteClosingReport(${r.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    })
    .catch(err => console.error("Error loading closing reports:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  const addCard = document.getElementById("closingReportFormCard");
  const btnAdd = document.getElementById("btnAddClosingReport");
  const btnCancel = document.getElementById("cancelClosingReport");
  const form = document.getElementById("closingReportForm");
  const btnExportPDF = document.getElementById("btnExportClosingPDF");
  const btnExportExcel = document.getElementById("btnExportClosingExcel");

  if (btnAdd) btnAdd.addEventListener("click", () => (addCard.style.display = "block"));
  if (btnCancel) btnCancel.addEventListener("click", () => (addCard.style.display = "none"));

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();

      const newEntry = {
        type: document.getElementById("closingReportType").value,
        period: document.getElementById("closingPeriod").value,
        debit: parseFloat(document.getElementById("closingDebit").value),
        credit: parseFloat(document.getElementById("closingCredit").value),
        status: document.getElementById("closingStatus").value,
        balance: parseFloat(document.getElementById("closingDebit").value) - parseFloat(document.getElementById("closingCredit").value),
        date: new Date().toISOString().split('T')[0]
      };


      fetch(`${API_BASE}/api/closing-reporting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = "none";
          e.target.reset();
          loadClosingReports();
        });
    });
  }

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () => window.open(`${API_BASE}/api/closing-reporting/export/pdf`, "_blank"));
  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () => window.open(`${API_BASE}/api/closing-reporting/export/excel`, "_blank"));

  loadClosingReports();
});

// ------- Global PDF download interceptor (applies to all modules) -------
// Force-download any window.open(url, '_blank') where url ends with /pdf or contains /export/pdf
// without opening a viewer tab. This keeps existing call sites unchanged.
(function setupGlobalPdfDownloader() {
  if (window.__pdfDownloaderInstalled) return; // idempotent
  window.__pdfDownloaderInstalled = true;

  async function fetchAndDownload(url, suggestedName) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      // Determine filename from Content-Disposition if present
      let filename = suggestedName || 'file.pdf';
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      if (m) {
        filename = decodeURIComponent(m[1] || m[2] || filename);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);
    } catch (err) {
      console.error('PDF download error', err);
      // as a fallback, open normally
      try { window.__origOpen ? window.__origOpen(url, '_blank') : window.open(url, '_blank'); } catch (_) { }
    }
  }

  // Save original open
  window.__origOpen = window.open.bind(window);

  // Override window.open for PDF endpoints only
  window.open = function (url, target, features) {
    try {
      if (typeof url === 'string' && /\/(export\/)?pdf(\b|$)/i.test(url)) {
        // Attempt to craft a friendly filename from URL
        const parts = url.split('/').filter(Boolean);
        const tail = parts.slice(-3).join('-').replace(/[^a-z0-9\-_.]/ig, '');
        const name = (tail || 'document') + '.pdf';
        fetchAndDownload(url, name);
        return null; // prevent opening a new tab
      }
    } catch (_) { }
    return window.__origOpen(url, target, features);
  };
})();

function deleteClosingReport(id) {
  if (confirm("Are you sure you want to delete this report?")) {
    fetch(`${API_BASE}/api/closing-reporting/${id}`, { method: 'DELETE' }).then(() =>
      loadClosingReports()
    );
  }
}

// ======================= 14.1 Item Master =======================
function loadItems() {
  fetch(`${API_BASE}/api/item-master`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("itemMasterBody");
      tbody.innerHTML = "";
      data.forEach(i => {
        const row = `
          <tr>
            <td>${i.id}</td>
            <td>${i.name}</td>
            <td>${i.strength}</td>
            <td>${i.form}</td>
            <td>${i.pack}</td>
            <td>${i.hsn}</td>
            <td>${i.barcode}</td>
            <td>${i.quantity}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteItem(${i.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const addCard = document.getElementById("itemFormCard");
  const btnAdd = document.getElementById("btnAddItem");
  const btnCancel = document.getElementById("cancelItemForm");
  const form = document.getElementById("itemMasterForm");
  const btnScan = document.getElementById("btnScanBarcode");
  const btnExportPDF = document.getElementById("btnExportItemPDF");
  const btnExportExcel = document.getElementById("btnExportItemExcel");

  if (btnAdd) btnAdd.addEventListener("click", () => (addCard.style.display = "block"));
  if (btnCancel) btnCancel.addEventListener("click", () => (addCard.style.display = "none"));

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const newItem = {
        name: itemName.value,
        strength: itemStrength.value,
        form: itemForm.value,
        pack: itemPack.value,
        hsn: itemHSN.value,
        barcode: itemBarcode.value,
        quantity: parseFloat(itemQty.value || 0)
      };
      fetch(`${API_BASE}/api/item-master`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = "none";
          e.target.reset();
          loadItems();
        });
    });
  }

  if (btnScan) {
    btnScan.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("barcodeModal"));
      modal.show();
      startBarcodeScanner(modal);
    });
  }

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/item-master/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/item-master/export/excel`, "_blank")
    );
  loadItems();
});

// ---------- Delete ----------
function deleteItem(id) {
  if (confirm("Delete this item?")) {
    fetch(`${API_BASE}/api/item-master/${id}`, { method: 'DELETE' })
      .then(() => loadItems());
  }
}

// ---------- Barcode Scanner ----------
function startBarcodeScanner(modal) {
  const target = document.querySelector("#scanner-container");
  try { Quagga.stop(); } catch (e) { }

  const cfg = {
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target,
      constraints: { facingMode: "environment", width: 640, height: 480 }
    },
    decoder: { readers: ["code_128_reader", "ean_reader", "upc_reader"] },
    locate: true
  };

  Quagga.init(cfg, err => {
    if (err) {
      console.error(err);
      alert("Camera access denied or unavailable.");
      return;
    }
    Quagga.start();
  });

  const onDetected = result => {
    const code = result.codeResult.code;
    Quagga.offDetected(onDetected);
    Quagga.stop();
    modal.hide();
    scanBarcode(code);
  };

  Quagga.onDetected(onDetected);

  document.getElementById("barcodeModal").addEventListener("hidden.bs.modal", () => {
    try { Quagga.offDetected(onDetected); Quagga.stop(); } catch (e) { }
  }, { once: true });
}
function scanBarcode(code) {
  fetch(`${API_BASE}/api/item-master/scan/${code}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.item) {
        if (confirm(`Item found: ${data.item.name}\nQty: ${data.item.quantity}\nAccept to inventory?`)) {
          fetch(`${API_BASE}/api/item-master/accept`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.item)
          })
            .then(res => res.json())
            .then(resp => {
              if (resp.success) {
                alert("✅ Item accepted & added to inventory + warehouse successfully!");
                loadItems();
                if (typeof loadWarehouses === "function") loadWarehouses(); // auto-refresh 14.2
              }
            });
        }
      } else {
        alert("No item found for this barcode!");
      }
    });
}


// ======================= 14.2 Multi-Warehouse / Bins =======================
function loadWarehouses() {
  fetch(`${API_BASE}/api/warehouse-bins`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("warehouseBody");
      tbody.innerHTML = "";
      data.forEach(w => {
        const row = `
          <tr>
            <td>${w.id}</td>
            <td>${w.warehouseName}</td>
            <td>${w.binCode}</td>
            <td>${w.batchNo}</td>
            <td>${w.mfgDate}</td>
            <td>${w.expiryDate}</td>
            <td>${w.batchQty}</td>
            <td>${w.batchStatus}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteWarehouse(${w.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const addCard = document.getElementById("warehouseFormCard");
  const btnAdd = document.getElementById("btnAddWarehouse");
  const btnCancel = document.getElementById("cancelWarehouseForm");
  const form = document.getElementById("warehouseForm");
  const btnExportPDF = document.getElementById("btnExportWarehousePDF");
  const btnExportExcel = document.getElementById("btnExportWarehouseExcel");

  if (btnAdd) btnAdd.addEventListener("click", () => (addCard.style.display = "block"));
  if (btnCancel) btnCancel.addEventListener("click", () => (addCard.style.display = "none"));

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const newEntry = {
        warehouseName: document.getElementById("warehouseName").value,
        binCode: document.getElementById("warehouseBinCode").value,
        batchNo: document.getElementById("warehouseBatchNo").value,
        mfgDate: document.getElementById("warehouseMfgDate").value,
        expiryDate: document.getElementById("warehouseExpiryDate").value,
        batchQty: parseInt(document.getElementById("warehouseBatchQty").value),
        batchStatus: document.getElementById("warehouseBatchStatus").value
      };
      fetch(`${API_BASE}/api/warehouse-bins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      })
        .then(res => res.json())
        .then(() => {
          addCard.style.display = "none";
          e.target.reset();
          loadWarehouses();
        });
    });
  }

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/warehouse-bins/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/warehouse-bins/export/excel`, "_blank")
    );

  loadWarehouses();
});

function deleteWarehouse(id) {
  if (confirm("Delete this record?")) {
    fetch(`${API_BASE}/api/warehouse-bins/${id}`, { method: 'DELETE' })
      .then(() => loadWarehouses());
  }
}

// ======================= 14.3 FEFO / Expiry Management =======================
function loadFefoBatches() {
  fetch(`${API_BASE}/api/fefo-management`)
    .then(res => res.json())
    .then(data => renderFefoTable(data));
}

function renderFefoTable(data) {
  const tbody = document.getElementById("fefoBody");
  tbody.innerHTML = "";
  data.forEach(b => {
    const exp = new Date(b.expiryDate);
    const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
    let rowClass = diff <= 0 ? "table-danger" : diff <= 30 ? "table-warning" : "";
    const row = `
      <tr class="${rowClass}">
        <td>${b.id}</td>
        <td>${b.warehouseName}</td>
        <td>${b.batchNo}</td>
        <td>${b.mfgDate}</td>
        <td>${b.expiryDate}</td>
        <td>${b.batchQty}</td>
        <td>${b.batchStatus}</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnCheckExpiry = document.getElementById("btnCheckExpiry");
  const btnFefoPick = document.getElementById("btnFefoPick");
  const btnAutoReturn = document.getElementById("btnAutoReturn");
  const btnExportPDF = document.getElementById("btnExportFefoPDF");
  const btnExportExcel = document.getElementById("btnExportFefoExcel");
  const btnExportReturnNote = document.getElementById("btnExportReturnNote");

  if (btnCheckExpiry)
    btnCheckExpiry.addEventListener("click", () =>
      fetch(`${API_BASE}/api/fefo-management/check-expiry`)
        .then(res => res.json())
        .then(data => renderFefoTable(data))
    );

  if (btnFefoPick)
    btnFefoPick.addEventListener("click", () =>
      fetch(`${API_BASE}/api/fefo-management/fefo-pick`)
        .then(res => res.json())
        .then(data => renderFefoTable(data))
    );

  if (btnAutoReturn)
    btnAutoReturn.addEventListener("click", () =>
      fetch(`${API_BASE}/api/fefo-management/auto-return`)
        .then(res => res.json())
        .then(data => renderFefoTable(data))
    );

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/fefo-management/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/fefo-management/export/excel`, "_blank")
    );

  if (btnExportReturnNote)
    btnExportReturnNote.addEventListener("click", () =>
      window.open(`${API_BASE}/api/fefo-management/export/return-note`, "_blank")
    );

  loadFefoBatches();
});

// ======================= 15.1 Role-Based Access (RBAC) =======================
function loadRoles() {
  fetch(`${API_BASE}/api/role-access`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("roleBody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.id}</td>
            <td>${r.roleName}</td>
            <td>${r.branch}</td>
            <td>${r.region}</td>
            <td>${r.permissions.join(", ")}</td>
            <td>${r.maker}</td>
            <td>${r.checker}</td>
            <td><span class="badge ${r.status === "Approved" ? "bg-success" : r.status === "Rejected" ? "bg-danger" : "bg-warning"}">${r.status}</span></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteRole(${r.id})"><i class="bi bi-trash"></i></button>
              ${r.status === "Pending" ? `
                <button class="btn btn-sm btn-success ms-1" onclick="approveRole(${r.id})"><i class="bi bi-check2-circle"></i></button>
                <button class="btn btn-sm btn-warning ms-1" onclick="rejectRole(${r.id})"><i class="bi bi-x-circle"></i></button>
              ` : ""}
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const addCard = document.getElementById("roleFormCard");
  const btnAdd = document.getElementById("btnAddRole");
  const btnCancel = document.getElementById("cancelRoleForm");
  const form = document.getElementById("roleForm");
  const btnExportPDF = document.getElementById("btnExportRolePDF");
  const btnExportExcel = document.getElementById("btnExportRoleExcel");
  const btnHistory = document.getElementById("btnViewHistory");

  if (btnAdd) btnAdd.addEventListener("click", () => (addCard.style.display = "block"));
  if (btnCancel) btnCancel.addEventListener("click", () => (addCard.style.display = "none"));

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const newRole = {
        roleName: roleName.value,
        branch: roleBranch.value,
        region: roleRegion.value,
        permissions: [
          ...(permView.checked ? ["View"] : []),
          ...(permAdd.checked ? ["Add"] : []),
          ...(permEdit.checked ? ["Edit"] : []),
          ...(permDelete.checked ? ["Delete"] : [])
        ],
        maker: makerName.value,
        checker: checkerName.value,
        status: "Pending"
      };
      fetch(`${API_BASE}/api/role-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole)
      })
        .then(() => {
          addCard.style.display = "none";
          e.target.reset();
          loadRoles();
        });
    });
  }

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/role-access/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/role-access/export/excel`, "_blank")
    );

  if (btnHistory)
    btnHistory.addEventListener("click", () => loadApprovalHistory());

  loadRoles();
});

// ---------- Delete ----------
function deleteRole(id) {
  if (confirm("Delete this role?")) {
    fetch(`${API_BASE}/api/role-access/${id}`, { method: 'DELETE' })
      .then(() => loadRoles());
  }
}

// ---------- Approve / Reject with Modal ----------
let currentAction = null;
let approvalModal = null;

function approveRole(id) {
  currentAction = "approve";
  document.getElementById("approvalModalTitle").innerText = "Approve Role";
  document.getElementById("approvalRoleId").value = id;
  document.getElementById("approvalChecker").value = "";
  document.getElementById("approvalRemarks").value = "";
  approvalModal = new bootstrap.Modal(document.getElementById("approvalModal"));
  approvalModal.show();
}

function rejectRole(id) {
  currentAction = "reject";
  document.getElementById("approvalModalTitle").innerText = "Reject Role";
  document.getElementById("approvalRoleId").value = id;
  document.getElementById("approvalChecker").value = "";
  document.getElementById("approvalRemarks").value = "";
  approvalModal = new bootstrap.Modal(document.getElementById("approvalModal"));
  approvalModal.show();
}

// ---------- Modal Logic ----------
document.addEventListener("DOMContentLoaded", () => {
  const btnApprove = document.getElementById("btnApproveConfirm");
  const btnReject = document.getElementById("btnRejectConfirm");

  btnApprove.addEventListener("click", e => {
    e.preventDefault();
    const id = document.getElementById("approvalRoleId").value;
    const checker = document.getElementById("approvalChecker").value;
    const remarks = document.getElementById("approvalRemarks").value;
    fetch(`${API_BASE}/api/role-access/approve/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedBy: checker, remarks })
    }).then(() => {
      approvalModal.hide();
      loadRoles();
    });
  });

  btnReject.addEventListener("click", e => {
    e.preventDefault();
    const id = document.getElementById("approvalRoleId").value;
    const checker = document.getElementById("approvalChecker").value;
    const remarks = document.getElementById("approvalRemarks").value;
    fetch(`${API_BASE}/api/role-access/reject/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectedBy: checker, remarks })
    }).then(() => {
      approvalModal.hide();
      loadRoles();
    });
  });
});

// ---------- Load Approval History ----------
function loadApprovalHistory() {
  fetch(`${API_BASE}/api/role-access/history`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        alert("No audit trail records found.");
        return;
      }
      let log = "";
      data.slice(-10).reverse().forEach(h => {
        log += `#${h.id} • ${h.action} by ${h.performedBy} (${h.timestamp})\n→ ${h.remarks}\n\n`;
      });
      alert(`🧾 Recent Maker-Checker Activity:\n\n${log}`);
      console.table(data);
    });
}

// ======================= 15.2 Field-Level Audit Log =======================
function loadAuditLogs() {
  fetch(`${API_BASE}/api/audit-trail`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("auditLogBody");
      tbody.innerHTML = "";
      data.slice().reverse().forEach(l => {
        const row = `
          <tr>
            <td>${l.id}</td>
            <td>${l.module}</td>
            <td>${l.field}</td>
            <td>${l.oldValue}</td>
            <td>${l.newValue}</td>
            <td>${l.user}</td>
            <td>${l.action}</td>
            <td>${new Date(l.timestamp).toLocaleString()}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnExportPDF = document.getElementById("btnExportAuditPDF");
  const btnExportExcel = document.getElementById("btnExportAuditExcel");
  const btnRefresh = document.getElementById("btnRefreshAudit");

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/audit-trail/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/audit-trail/export/excel`, "_blank")
    );

  if (btnRefresh)
    btnRefresh.addEventListener("click", loadAuditLogs);

  loadAuditLogs();
});

// ---------- Helper to Log Field Changes ----------
function logAudit(module, field, oldValue, newValue, user, action = "Update") {
  fetch(`${API_BASE}/api/audit-trail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module, field, oldValue, newValue, user, action })
  });
}

// ======================= 15.3 Backup & Recovery =======================
function loadBackups() {
  fetch(`${API_BASE}/api/backup-recovery/list`)
    .then(res => res.json())
    .then(files => {
      const tbody = document.getElementById("backupBody");
      tbody.innerHTML = "";
      files.forEach(f => {
        const row = `
          <tr>
            <td>${f.name}</td>
            <td>${new Date(f.date).toLocaleString()}</td>
            <td>
              <button class="btn btn-warning btn-sm" onclick="restoreBackup('${f.name}')">
                <i class="bi bi-arrow-counterclockwise"></i> Restore
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnCreate = document.getElementById("btnCreateBackup");
  const btnRefresh = document.getElementById("btnRefreshBackups");

  if (btnCreate)
    btnCreate.addEventListener("click", () => {
      fetch(`${API_BASE}/api/backup-recovery/create`)
        .then(res => res.json())
        .then(() => loadBackups());
    });

  if (btnRefresh)
    btnRefresh.addEventListener("click", loadBackups);

  loadBackups();
});

function restoreBackup(filename) {
  if (!confirm(`Restore backup "${filename}"?\nThis will overwrite existing data.`)) return;
  fetch(`${API_BASE}/api/backup-recovery/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename })
  })
    .then(res => res.json())
    .then(resp => {
      if (resp.success) alert("Backup restored successfully!");
      else alert("Restore failed: " + (resp.message || "Unknown error"));
    });
}

// ======================= 16.1 Clear User Sessions / Locks / Reserve =======================
function loadAdminActions() {
  fetch(`${API_BASE}/api/admin-clear`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("clearSessionBody");
      tbody.innerHTML = "";
      data.reverse().forEach(a => {
        const row = `
          <tr>
            <td>${a.id}</td>
            <td>${a.type}</td>
            <td>${a.description}</td>
            <td>${new Date(a.timestamp).toLocaleString()}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnClearSessions = document.getElementById("btnClearSessions");
  const btnClearLocks = document.getElementById("btnClearLocks");
  const btnClearReserve = document.getElementById("btnClearReserve");
  const btnExportPDF = document.getElementById("btnExportSessionsPDF");
  const btnExportExcel = document.getElementById("btnExportSessionsExcel");

  if (btnClearSessions)
    btnClearSessions.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all user sessions?")) {
        fetch(`${API_BASE}/api/admin-clear/clear-sessions`, { method: "POST" })
          .then(() => loadAdminActions());
      }
    });

  if (btnClearLocks)
    btnClearLocks.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all locks?")) {
        fetch(`${API_BASE}/api/admin-clear/clear-locks`, { method: "POST" })
          .then(() => loadAdminActions());
      }
    });

  if (btnClearReserve)
    btnClearReserve.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear reserve data?")) {
        fetch(`${API_BASE}/api/admin-clear/clear-reserve`, { method: "POST" })
          .then(() => loadAdminActions());
      }
    });

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/admin-clear/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/admin-clear/export/excel`, "_blank")
    );

  loadAdminActions();
});
// ======================= 16.2 Control Panel (Company Parameters) =======================
function loadControlParams() {
  fetch(`${API_BASE}/api/control-panel`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("controlPanelBody");
      tbody.innerHTML = "";
      data.forEach(p => {
        const row = `
          <tr>
            <td>${p.id}</td>
            <td>${p.taxRegime}</td>
            <td>${p.numbering}</td>
            <td>${p.creditLimit}</td>
            <td>${p.fefoPolicy}</td>
            <td>${p.date}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("controlPanelForm");
  const btnExportPDF = document.getElementById("btnExportControlPDF");
  const btnExportExcel = document.getElementById("btnExportControlExcel");

  if (form)
    form.addEventListener("submit", e => {
      e.preventDefault();
      const newParam = {
        taxRegime: document.getElementById("paramTaxRegime").value,
        numbering: document.getElementById("paramNumbering").value,
        creditLimit: parseFloat(document.getElementById("paramCreditLimit").value || 0),
        fefoPolicy: document.getElementById("paramFEFO").value
      };
      fetch(`${API_BASE}/api/control-panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newParam)
      })
        .then(res => res.json())
        .then(() => {
          e.target.reset();
          loadControlParams();
        });
    });

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/control-panel/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/control-panel/export/excel`, "_blank")
    );

  loadControlParams();
});

// ======================= 16.3 Repost GL Entries / Update Balances =======================
function loadRepostLogs() {
  fetch(`${API_BASE}/api/repost-gl`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("repostGLBody");
      tbody.innerHTML = "";
      data.reverse().forEach(l => {
        const row = `
          <tr>
            <td>${l.id}</td>
            <td>${l.action}</td>
            <td>${l.description}</td>
            <td>${l.status}</td>
            <td>${l.date}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnRepost = document.getElementById("btnRepostGL");
  const btnUpdate = document.getElementById("btnUpdateBalances");
  const btnPDF = document.getElementById("btnExportRepostPDF");
  const btnExcel = document.getElementById("btnExportRepostExcel");

  if (btnRepost)
    btnRepost.addEventListener("click", () => {
      if (confirm("Repost all GL entries now?")) {
        fetch(`${API_BASE}/api/repost-gl/repost`, { method: "POST" })
          .then(() => loadRepostLogs());
      }
    });

  if (btnUpdate)
    btnUpdate.addEventListener("click", () => {
      if (confirm("Recalculate and update all balances?")) {
        fetch(`${API_BASE}/api/repost-gl/update-balances`, { method: "POST" })
          .then(() => loadRepostLogs());
      }
    });

  if (btnPDF)
    btnPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/repost-gl/export/pdf`, "_blank")
    );

  if (btnExcel)
    btnExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/repost-gl/export/excel`, "_blank")
    );

  loadRepostLogs();
});

// ======================= 16.4 Day-End Closing Checks =======================
function loadDayEndStatus() {
  fetch(`${API_BASE}/api/day-end/status`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("checkPosting").className =
        data.postingsCompleted ? "badge bg-success" : "badge bg-danger";
      document.getElementById("checkPosting").textContent =
        data.postingsCompleted ? "Completed" : "Pending";

      document.getElementById("checkCollection").className =
        data.collectionsReconciled ? "badge bg-success" : "badge bg-danger";
      document.getElementById("checkCollection").textContent =
        data.collectionsReconciled ? "Reconciled" : "Unmatched";

      document.getElementById("checkBackup").className =
        data.backupTaken ? "badge bg-success" : "badge bg-danger";
      document.getElementById("checkBackup").textContent =
        data.backupTaken ? "Done" : "Missing";

      document.getElementById("btnRunDayEnd").disabled = !data.allChecksPassed;
    });
}

function loadDayEndReports() {
  fetch(`${API_BASE}/api/day-end`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("dayEndTableBody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const row = `
          <tr>
            <td>${r.id}</td>
            <td>${r.date}</td>
            <td>${r.status}</td>
            <td>${r.closedAt}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnRunDayEnd = document.getElementById("btnRunDayEnd");
  const btnExportPDF = document.getElementById("btnExportDayEndPDF");
  const btnExportExcel = document.getElementById("btnExportDayEndExcel");

  if (btnRunDayEnd)
    btnRunDayEnd.addEventListener("click", () => {
      fetch(`${API_BASE}/api/day-end/close`, { method: "POST" })
        .then(res => res.json())
        .then(() => {
          alert("✅ Day-End Closed Successfully!");
          loadDayEndStatus();
          loadDayEndReports();
        });
    });

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/day-end/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/day-end/export/excel`, "_blank")
    );

  loadDayEndStatus();
  loadDayEndReports();
});

const btnTakeBackup = document.getElementById("btnTakeBackup");

if (btnTakeBackup)
  btnTakeBackup.addEventListener("click", () => {
    fetch(`${API_BASE}/api/day-end/backup`, { method: "POST" })
      .then(res => res.json())
      .then(data => {
        alert(data.message || "Backup successful!");
        loadDayEndStatus();
      })
      .catch(err => {
        console.error("Backup failed:", err);
        alert("Error while taking backup.");
      });
  });

// ======================= 16.5 Change Account Date =======================
function loadCurrentAccountDate() {
  fetch(`${API_BASE}/api/change-account-date`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("currentAccountDate").textContent = data.date || "Not Set";
    });
}

function loadAccountDateAudit() {
  fetch(`${API_BASE}/api/change-account-date/audit`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("accountDateAuditBody");
      tbody.innerHTML = "";
      data.forEach(d => {
        const row = `
          <tr>
            <td>${d.id}</td>
            <td>${d.oldDate}</td>
            <td>${d.newDate}</td>
            <td>${d.changedBy}</td>
            <td>${d.timestamp}</td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnChange = document.getElementById("btnChangeDate");
  const btnExportPDF = document.getElementById("btnExportAccDatePDF");
  const btnExportExcel = document.getElementById("btnExportAccDateExcel");

  if (btnChange)
    btnChange.addEventListener("click", () => {
      const newDate = document.getElementById("newAccountDate").value;
      if (!newDate) return alert("Please select a date.");

      fetch(`${API_BASE}/api/change-account-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate, userRole: "Admin", userName: "System Admin" })
      })
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            alert(result.message);
            loadCurrentAccountDate();
            loadAccountDateAudit();
          } else {
            alert(result.message);
          }
        });
    });

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/change-account-date/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/change-account-date/export/excel`, "_blank")
    );

  loadCurrentAccountDate();
  loadAccountDateAudit();
});

// ======================= 16.6 Costing Center =======================
function loadCostCenters() {
  fetch(`${API_BASE}/api/costing-center`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("costCenterTableBody");
      tbody.innerHTML = "";
      data.forEach(c => {
        const row = `
          <tr>
            <td>${c.id}</td>
            <td>${c.code}</td>
            <td>${c.name}</td>
            <td>${c.parent}</td>
            <td>${c.defaultRule}</td>
            <td>${c.status}</td>
            <td>${c.createdAt}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteCostCenter(${c.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    });
}

function deleteCostCenter(id) {
  if (confirm("Delete this cost center?")) {
    fetch(`${API_BASE}/api/costing-center/${id}`, { method: 'DELETE' })
      .then(() => loadCostCenters());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("costCenterForm");
  const btnExportPDF = document.getElementById("btnExportCostPDF");
  const btnExportExcel = document.getElementById("btnExportCostExcel");

  if (form)
    form.addEventListener("submit", e => {
      e.preventDefault();

      const newCenter = {
        code: costCode.value,
        name: costName.value,
        parent: costParent.value || "None",
        defaultRule: costRule.value,
        status: costStatus.value,
      };

      fetch(`${API_BASE}/api/costing-center`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCenter),
      })
        .then(res => res.json())
        .then(() => {
          form.reset();
          loadCostCenters();
        });
    });

  if (btnExportPDF)
    btnExportPDF.addEventListener("click", () =>
      window.open(`${API_BASE}/api/costing-center/export/pdf`, "_blank")
    );

  if (btnExportExcel)
    btnExportExcel.addEventListener("click", () =>
      window.open(`${API_BASE}/api/costing-center/export/excel`, "_blank")
    );

  loadCostCenters();
});
// ======================= 16.7) Document Posting =======================
document.addEventListener("DOMContentLoaded", () => {
  const btnLoad = document.getElementById("btnLoadDocs");
  const btnPost = document.getElementById("btnBulkPost");
  const btnPDF = document.getElementById("btnExportDocsPDF");
  const btnExcel = document.getElementById("btnExportDocsExcel");
  const tbody = document.getElementById("documentPostingBody");

  let pendingDocs = [];

  function loadPendingDocs() {
    fetch(`${API_BASE}/api/document-posting/pending`)
      .then(res => res.json())
      .then(data => {
        pendingDocs = data;
        tbody.innerHTML = "";

        if (!data.length) {
          tbody.innerHTML = `<tr><td colspan="5" class="text-muted">✅ All documents are already posted.</td></tr>`;
          return;
        }

        data.forEach(d => {
          const row = `
            <tr>
              <td><input type="checkbox" class="form-check-input" checked></td>
              <td>${d.type}</td>
              <td>${d.docNo}</td>
              <td>${d.date}</td>
              <td>${d.amount.toLocaleString()}</td>
            </tr>`;
          tbody.insertAdjacentHTML("beforeend", row);
        });
      })
      .catch(err => console.error("Error loading pending docs:", err));
  }

  if (btnLoad) btnLoad.onclick = loadPendingDocs;

  if (btnPost)
    btnPost.onclick = () => {
      const checkboxes = tbody.querySelectorAll("input.form-check-input");
      const selectedDocs = pendingDocs.filter((_, i) => checkboxes[i]?.checked);

      if (!selectedDocs.length) return alert("No documents selected for posting.");

      fetch(`${API_BASE}/api/document-posting/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docs: selectedDocs }),
      })
        .then(res => res.json())
        .then(res => {
          alert(`${res.count} documents successfully posted.`);
          loadPendingDocs();
        });
    };

  if (btnPDF)
    btnPDF.onclick = () =>
      window.open(`${API_BASE}/api/document-posting/export/pdf`, "_blank");

  if (btnExcel)
    btnExcel.onclick = () =>
      window.open(`${API_BASE}/api/document-posting/export/excel`, "_blank");
});

// ======================= 16.8 User Groups / Users / Roles =======================
function loadUserGroups() {
  fetch(`${API_BASE}/api/user-groups/groups`)
    .then(res => res.json())
    .then(data => {
      const body = document.getElementById("userGroupsBody");
      body.innerHTML = "";
      data.forEach(g => {
        const row = `
          <tr>
            <td>${g.id}</td>
            <td>${g.name}</td>
            <td>${g.description || ""}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteGroup(${g.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        body.insertAdjacentHTML("beforeend", row);
      });
    });
}

function loadUsers() {
  fetch(`${API_BASE}/api/user-groups/users`)
    .then(res => res.json())
    .then(data => {
      const body = document.getElementById("usersBody");
      body.innerHTML = "";
      data.forEach(u => {
        const row = `
          <tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.role}</td>
            <td>${u.group}</td>
            <td>${u.region}</td>
            <td>${u.branch}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        body.insertAdjacentHTML("beforeend", row);
      });
    });
}

function deleteGroup(id) {
  if (!confirm("Delete this group?")) return;
  fetch(`${API_BASE}/api/user-groups/groups/${id}`, { method: 'DELETE' })
    .then(() => loadUserGroups());
}

function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  fetch(`${API_BASE}/api/user-groups/users/${id}`, { method: 'DELETE' })
    .then(() => loadUsers());
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAddGroup = document.getElementById("btnAddGroup");
  const btnAddUser = document.getElementById("btnAddUser");
  const btnPDF = document.getElementById("btnExportUsersPDF");
  const btnExcel = document.getElementById("btnExportUsersExcel");

  const groupModalEl = document.getElementById("groupModal");
  const userModalEl = document.getElementById("userModal");
  const groupModal = new bootstrap.Modal(groupModalEl);
  const userModal = new bootstrap.Modal(userModalEl);

  const groupForm = document.getElementById("groupForm");
  const userForm = document.getElementById("userForm");

  // === Add Group ===
  if (btnAddGroup)
    btnAddGroup.onclick = () => groupModal.show();

  if (groupForm)
    groupForm.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("groupName").value.trim();
      const description = document.getElementById("groupDesc").value.trim();

      fetch(`${API_BASE}/api/user-groups/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description })
      }).then(() => {
        groupModal.hide();
        e.target.reset();
        loadUserGroups();
      });
    });

  // === Add User ===
  if (btnAddUser)
    btnAddUser.onclick = () => userModal.show();

  if (userForm)
    userForm.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("userName").value.trim();
      const role = document.getElementById("userRole").value.trim();
      const group = document.getElementById("userGroup").value.trim();
      const region = document.getElementById("userRegion").value.trim();
      const branch = document.getElementById("userBranch").value.trim();

      fetch(`${API_BASE}/api/user-groups/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, group, region, branch })
      }).then(() => {
        userModal.hide();
        e.target.reset();
        loadUsers();
      });
    });

  if (btnPDF)
    btnPDF.onclick = () => window.open(`${API_BASE}/api/user-groups/export/pdf`, "_blank");

  if (btnExcel)
    btnExcel.onclick = () => window.open(`${API_BASE}/api/user-groups/export/excel`, "_blank");

  loadUserGroups();
  loadUsers();
});

// ======================= 16.9) Export Data =======================
document.addEventListener("DOMContentLoaded", () => {
  const exportForm = document.getElementById("exportForm");
  const exportStatus = document.getElementById("exportStatus");

  if (exportForm) {
    exportForm.addEventListener("submit", e => {
      e.preventDefault();

      const dataset = document.getElementById("datasetSelect").value;
      const format = document.getElementById("formatSelect").value;

      if (!dataset || !format) return alert("Please select both dataset and format.");

      exportStatus.classList.remove("d-none");
      exportStatus.innerHTML = `<i class='bi bi-hourglass-split'></i> Preparing ${dataset} export...`;

      fetch(`${API_BASE}/api/export-data/${dataset}/${format}`)
        .then(res => {
          if (!res.ok) throw new Error("Export failed");
          return res.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${dataset}.${format === "excel" ? "xlsx" : format}`;
          a.click();
          exportStatus.classList.replace("alert-info", "alert-success");
          exportStatus.innerHTML = `<i class='bi bi-check2-circle'></i> ${dataset} exported successfully!`;
        })
        .catch(() => {
          exportStatus.classList.replace("alert-info", "alert-danger");
          exportStatus.innerHTML = `<i class='bi bi-exclamation-triangle'></i> Failed to export ${dataset}.`;
        });
    });
  }
});

// ======================= 16.11) Help / About / Utilities =======================
document.addEventListener("DOMContentLoaded", () => {
  const aboutSection = document.getElementById("aboutSection");
  const complaintForm = document.getElementById("complaintForm");
  const dataFileSelect = document.getElementById("dataFileSelect");
  const btnViewFile = document.getElementById("btnViewFile");
  const fileContent = document.getElementById("fileContent");

  // Load About Info
  fetch(`${API_BASE}/api/help-utilities/about`)
    .then(res => res.json())
    .then(info => {
      aboutSection.innerHTML = `
        <p><strong>Application:</strong> ${info.name}</p>
        <p><strong>Version:</strong> ${info.version}</p>
        <p><strong>Developer:</strong> ${info.developer}</p>
        <p><strong>Support Email:</strong> <a href="mailto:${info.supportEmail}">${info.supportEmail}</a></p>
        <p><strong>Release Date:</strong> ${info.releaseDate}</p>
      `;
    });

  // Submit Complaint
  if (complaintForm) {
    complaintForm.addEventListener("submit", e => {
      e.preventDefault();
      const newComplaint = {
        user: document.getElementById("complaintUser").value,
        type: document.getElementById("complaintType").value,
        message: document.getElementById("complaintMessage").value
      };
      fetch(`${API_BASE}/api/help-utilities/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newComplaint)
      })
        .then(res => res.json())
        .then(() => {
          alert("Complaint submitted successfully!");
          complaintForm.reset();
        });
    });
  }

  // Load JSON Files List
  fetch(`${API_BASE}/api/help-utilities/data-files`)
    .then(res => res.json())
    .then(files => {
      dataFileSelect.innerHTML = files.map(f => `<option value="${f}">${f}</option>`).join("");
    });

  // View File Content
  if (btnViewFile)
    btnViewFile.onclick = () => {
      const selectedFile = dataFileSelect.value;
      if (!selectedFile) return alert("Select a file to view.");
      fetch(`${API_BASE}/api/help-utilities/data-files/${selectedFile}`)
        .then(res => res.json())
        .then(content => {
          fileContent.textContent = JSON.stringify(content, null, 2);
        });
    };
});

// Launch Office Tools
function launchApp(app) {
  fetch(`${API_BASE}/api/help-utilities/launch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app })
  })
    .then(res => res.json())
    .then(data => alert(data.message))
    .catch(() => alert("Failed to launch application."));
}

// ======================= 16.12) User Account Management =======================
document.addEventListener("DOMContentLoaded", () => {

  // -------- Change Password --------
  const changeForm = document.getElementById("changePasswordForm");
  if (changeForm) {
    changeForm.addEventListener("submit", async e => {
      e.preventDefault();
      const current = document.getElementById("currentPassword").value.trim();
      const newPass = document.getElementById("newPassword").value.trim();
      const confirm = document.getElementById("confirmPassword").value.trim();

      if (newPass !== confirm) return alert("❌ Passwords do not match!");
      if (newPass.length < 5) return alert("⚠️ Password must be at least 5 characters.");

      try {
        const res = await fetch(`${API_BASE}/api/admin/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });
        const data = await res.json();

        if (data.success) {
          alert("✅ " + data.message);
          changeForm.reset();
        } else {
          alert("❌ " + (data.message || "Error updating password"));
        }
      } catch (err) {
        console.error("Error:", err);
        alert("⚠️ Server error occurred while updating password.");
      }
    });
  }

  // -------- Switch User --------
  const switchForm = document.getElementById("switchUserForm");
  if (switchForm) {
    switchForm.addEventListener("submit", e => {
      e.preventDefault();
      const user = document.getElementById("switchUserSelect").value;
      if (!user || user === "-- Select --") return alert("Please select a user!");
      alert(`🔄 Switched to user: ${user} (simulated)`);
      switchForm.reset();
    });
  }

  // -------- Quick Lock --------
  const unlockBtn = document.getElementById("btnUnlockScreen");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => {
      const pass = document.getElementById("unlockPassword").value.trim();
      if (pass === "") return alert("Enter password to unlock!");
      alert("🔓 Screen unlocked (temporary simulation).");
      document.getElementById("unlockPassword").value = "";
    });
  }

  // -------- Logout --------
  const loginBtn = document.getElementById("btnLoginAgain");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      localStorage.removeItem("erpSession");
      localStorage.removeItem("lastPage");
      window.location.href = "login.html";
    });
  }

});

// ======================= 17.1) Roles & Permissions (checkbox tree + save/load) =======================


// ...existing code...
/* ---------- REPLACE: rolesModules (full sidebar modules list) ---------- */
const rolesModules = [
  {
    id: "core-sales",
    label: "1) Core Sales & Billing",
    children: [
      { id: "1.1", label: "1.1 Import App Data" },
      { id: "1.2", label: "1.2 Sale Booking" },
      { id: "1.3", label: "1.3 Generate Booking Invoice" },
      { id: "1.4", label: "1.4 Controlled Invoice" },
      { id: "1.5", label: "1.5 Open Invoice" },
      { id: "1.6", label: "1.6 Sales Return" },
      { id: "1.7", label: "1.7 Customer Receipt" },
      { id: "1.8", label: "1.8 Stocks" },
      { id: "1.9", label: "1.9 Delivery Summary" },
      { id: "1.10", label: "1.10 Summary Collection" }
    ]
  },
  {
    id: "claims-expiry",
    label: "2) Claims & Expiry",
    children: [
      { id: "2.1", label: "2.1 Discount Claim" },
      { id: "2.2", label: "2.2 Bonus Claim" },
      { id: "2.3", label: "2.3 Claims Adjustment" },
      { id: "2.4", label: "2.4 Open Claim" },
      { id: "2.5", label: "2.5 Store Expiry" },
      { id: "2.6", label: "2.6 Market Expiry" },
      { id: "2.7", label: "2.7 Regenerate Expiry by Receiving" }
    ]
  },
  {
    id: "expenses",
    label: "3) Expenses",
    children: [
      { id: "3.1", label: "3.1 Expense Type & Heads" },
      { id: "3.2", label: "3.2 Expense Vouchers" }
    ]
  },
  {
    id: "receivings",
    label: "4) Receivings (Collections & Bank)",
    children: [
      { id: "4.1", label: "4.1 Cheque Entry" },
      { id: "4.2", label: "4.2 Bank Deposit Voucher" },
      { id: "4.3", label: "4.3 Cheque Conversion" },
      { id: "4.4", label: "4.4 Customer Receipt" },
      { id: "4.5", label: "4.5 Summary Collection" },
      { id: "4.6", label: "4.6 Vendor Credit Note" }
    ]
  },
  {
    id: "payments",
    label: "5) Payments",
    children: [
      { id: "5.1", label: "5.1 Bank / Cash Payment" },
      { id: "5.2", label: "5.2 Customer/Vendor Debit & Credit Note" },
      { id: "5.3", label: "5.3 Vendor Payment / Receipt" },
      { id: "5.4", label: "5.4 Customer Payment / Receipt" },
      { id: "5.5", label: "5.5 Opening Balances (Debit / Credit)" },
      { id: "5.6", label: "5.6 Employee Receipt (Expense Returns / Advances)" },
      { id: "5.7", label: "5.7 Knock-Off Document (Inter-Company Netting)" }
    ]
  },
  {
    id: "sms-email",
    label: "6) SMS & Emails",
    children: [
      { id: "6.1", label: "6.1 Company / Group / Contacts Masters" },
      { id: "6.2", label: "6.2 SMS Statuses & Orders" },
      { id: "6.3", label: "6.3 Email Groups & Schedules" },
      { id: "6.4", label: "6.4 Opt-Out Compliance & Audit Log" }
    ]
  },
  {
    id: "targets-fleet",
    label: "7) Targets / Fleet",
    children: [
      { id: "7.1", label: "7.1 Sales Target" },
      { id: "7.2", label: "7.2 Employee Incentives" },
      { id: "7.3", label: "7.3 Fleet / Route" }
    ]
  },
  {
    id: "reports",
    label: "8) Reports",
    children: [
      { id: "8.1", label: "8.1 Sales Reports" },
      { id: "8.2", label: "8.2 Inventory Reports" },
      { id: "8.3", label: "8.3 Finance Reports" },
      { id: "8.4", label: "8.4 Claims Reports" },
      { id: "8.5", label: "8.5 Payroll Reports" },
      { id: "8.6", label: "8.6 Distribution Reports" },
      { id: "8.7", label: "8.7 Admin & Audit Reports" }
    ]
  },
  {
    id: "purchases",
    label: "10) Purchases",
    children: [
      { id: "10.1", label: "10.1 Pending Orders / Purchase Order" },
      { id: "10.2", label: "10.2 Stock Receiving (GRN)" },
      { id: "10.3", label: "10.3 Purchase Invoice / Purchase Return" },
      { id: "10.4", label: "10.4 Vendor Debit/Credit Note & AP Settlement" }
    ]
  },
  {
    id: "distribution",
    label: "11) Distribution (DMS)",
    children: [
      { id: "11.1", label: "11.1 DMS — Region & Masters" },
      { id: "11.2", label: "11.2 DMS Operations: Routes & Orders" }
    ]
  },
  {
    id: "payroll-hr",
    label: "12) Payroll & HR",
    children: [
      { id: "12.0", label: "12.0 Setup (Designation / Dept)" },
      { id: "12.1", label: "12.1 Employee Groups / Track Employee" },
      { id: "12.2", label: "12.2 Employee Visiting Days" },
      { id: "12.3", label: "12.3 Bulk Attendance Upload" },
      { id: "12.4", label: "12.4 Monthly Expense Claims" },
      { id: "12.5", label: "12.5 Salary Generation / Payment" },
      { id: "12.6", label: "12.6 Employee Receipt / Payment" },
      { id: "12.7", label: "12.7 Employee Bulk → Employee Balance" },
      { id: "12.8", label: "12.8 Payslip PDF & Email" }
    ]
  },
  {
    id: "financials",
    label: "13) Financials",
    children: [
      { id: "13.1", label: "13.1 Financial Year Management" },
      { id: "13.2", label: "13.2 Chart of Accounts (COA)" },
      { id: "13.3", label: "13.3 Bank / Cash & Currency Masters" },
      { id: "13.4", label: "13.4 Voucher Management" },
      { id: "13.5", label: "13.5 Voucher Types / Voucher Posting" },
      { id: "13.6", label: "13.6 Bank Reconcile" },
      { id: "13.7", label: "13.7 Cheque Book Record Keeping / Cancellation" },
      { id: "13.8", label: "13.8 Taxes & Compliance" },
      { id: "13.9", label: "13.9 Costing & Inventory Valuation" },
      { id: "13.10", label: "13.10 Closing & Reporting" }
    ]
  },
  {
    id: "inventory-batches",
    label: "14) Inventory & Batches",
    children: [
      { id: "14.1", label: "14.1 Item Master (strength/form/pack/HSN/barcode)" },
      { id: "14.1.1", label: "14.1.1 Barcode Scan & Accept" },
      { id: "14.2", label: "14.2 Multi-Warehouse / Bins" },
      { id: "14.3", label: "14.3 FEFO Management / Near-expiry Alerts" }
    ]
  },
  {
    id: "security-audit",
    label: "15) Security, Audit, Backup",
    children: [
      { id: "15.1", label: "15.1 Role-based Access (RBAC), Maker-Checker" },
      { id: "15.2", label: "15.2 Field-level Audit Log" },
      { id: "15.3", label: "15.3 Backup & Recovery" }
    ]
  },
  {
    id: "admin-utilities",
    label: "16) Admin & Utilities",
    children: [
      { id: "16.1", label: "16.1 Clear User Sessions / Locks / Reserve" },
      { id: "16.2", label: "16.2 Control Panel (Company Parameters)" },
      { id: "16.3", label: "16.3 Repost GL / Update Balances" },
      { id: "16.4", label: "16.4 Day End (Closing Checks)" },
      { id: "16.5", label: "16.5 Change Account Date" },
      { id: "16.6", label: "16.6 Costing Center" },
      { id: "16.7", label: "16.7 Document Posting (Bulk)" },
      { id: "16.8", label: "16.8 User Groups / Users / Roles" },
      { id: "16.9", label: "16.9 Export Data" },
      { id: "16.11", label: "16.11 Help / Utilities" },
      { id: "16.12", label: "16.12 User Account Management" }
    ]
  },
  {
    id: "roles-permissions-17",
    label: "17) Roles & Permissions",
    children: [
      { id: "17.1", label: "17.1 Manage Roles & Permissions" }
    ]
  },
  {
    id: "field-sales",
    label: "18) Field Sales",
    children: [
      { id: "18.1", label: "18.1 Salesman Department" }
    ]
  }

];
/* ---------- END: rolesModules ---------- */
// ...existing code...

// Build nested checkbox tree in the form container
function buildModulesTree() {
  const container = document.getElementById("modulesCheckboxTree");
  if (!container) return;
  container.innerHTML = "";

  rolesModules.forEach(group => {
    const groupId = `g-${group.id}`;
    const divGroup = document.createElement("div");
    divGroup.className = "mb-3";

    // Parent checkbox label
    const parentHtml = `
      <div class="form-check">
        <input class="form-check-input parent-chk" type="checkbox" id="${groupId}" data-group="${groupId}">
        <label class="form-check-label fw-bold" for="${groupId}">${group.label}</label>
      </div>
    `;
    divGroup.insertAdjacentHTML("beforeend", parentHtml);

    // children list
    const ul = document.createElement("div");
    ul.style.paddingLeft = "18px";
    ul.className = "mt-2";

    group.children.forEach(child => {
      const childId = `c-${child.id}`;
      const childHtml = `
        <div class="form-check">
          <input class="form-check-input child-chk" type="checkbox" id="${childId}" data-group="${groupId}" data-label="${child.label}">
          <label class="form-check-label" for="${childId}">${child.label}</label>
        </div>
      `;
      ul.insertAdjacentHTML("beforeend", childHtml);
    });

    divGroup.appendChild(ul);
    container.appendChild(divGroup);
  });

  // Parent toggle logic
  container.querySelectorAll(".parent-chk").forEach(parent => {
    parent.addEventListener("change", (e) => {
      const gid = parent.getAttribute("id");
      const checked = parent.checked;
      container.querySelectorAll(`.child-chk[data-group="${gid}"]`).forEach(ch => ch.checked = checked);
    });
  });

  // If child toggled and all children checked -> parent checked, else unchecked
  container.querySelectorAll(".child-chk").forEach(child => {
    child.addEventListener("change", (e) => {
      const gid = child.dataset.group;
      const all = [...container.querySelectorAll(`.child-chk[data-group="${gid}"]`)];
      const parent = container.querySelector(`#${gid}`);
      if (!parent) return;
      parent.checked = all.every(c => c.checked);
    });
  });
}

// extract selected modules into array of { id, label }
function getSelectedModules() {
  const container = document.getElementById("modulesCheckboxTree");
  const selected = [];
  if (!container) return selected;
  container.querySelectorAll(".child-chk:checked").forEach(ch => {
    selected.push({
      id: ch.id.replace(/^c-/, ""),
      label: ch.dataset.label || ch.nextElementSibling?.textContent?.trim()
    });
  });
  return selected;
}

// render roles table
function loadRolesPermissions() {
  fetch(`${API_BASE}/api/roles-permissions`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("rolesPermissionBody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const employeeName = r.employeeName || r.name || "";
        const loginId = r.loginID || r.email || "";
        const modulesArray =
          Array.isArray(r.modules) && r.modules.length
            ? r.modules.map(m => m.label || m.id || m)
            : Array.isArray(r.modulesAccess)
              ? r.modulesAccess
              : [];
        const modulesText = modulesArray.join(", ");
        const row = `
          <tr>
            <td>${r.id}</td>
            <td>${escapeHtml(employeeName)}</td>
            <td>${escapeHtml(loginId)}</td>
            <td>${escapeHtml(r.password)}</td>
            <td class="text-start" style="max-width:400px; white-space:normal;">${escapeHtml(modulesText)}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteRolePermission(${r.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    }).catch(err => console.error("Load roles failed:", err));
}

// helpers
function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// wire up form actions when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  buildModulesTree();
  loadRolesPermissions();

  const addCard = document.getElementById("rolePermissionFormCard");
  const btnAdd = document.getElementById("btnAddRolePermission");
  const btnCancel = document.getElementById("cancelRolePermission");
  const btnClose = document.getElementById("closeRoleForm");
  const form = document.getElementById("rolesPermissionForm");

  if (btnAdd) btnAdd.addEventListener("click", () => {
    addCard.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  if (btnCancel) btnCancel.addEventListener("click", () => {
    addCard.style.display = "none";
  });
  if (btnClose) btnClose.addEventListener("click", () => {
    addCard.style.display = "none";
  });

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const selected = getSelectedModules();
      if (!selected.length)
        return alert("Please select at least one submodule for access.");

      const name = document.getElementById("employeeName").value.trim();
      const email = document.getElementById("loginID").value.trim();
      const password = document
        .getElementById("loginPassword")
        .value.trim();

      if (!name || !email || !password)
        return alert("Please fill all fields.");

      const payload = {
        name,
        email,
        password,
        modulesAccess: selected.map((m) => m.label),
      };

      fetch(`${API_BASE}/api/roles-permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then(() => {
          alert("✅ Employee role created successfully!");
          form.reset();
          buildModulesTree();
          addCard.style.display = "none";
          loadRolesPermissions();
        })
        .catch((err) => {
          console.error("Save failed:", err);
          alert("Failed to save role — check console for details.");
        });
    });
  }
});

// ======================= Company Module Event Handlers =======================
// Use event delegation for company page handlers
function initializeCompanyHandlers() {
  // Get the page container
  const companyPageContainer = document.getElementById("page-company");
  if (!companyPageContainer) return;

  // Use event delegation - attach once to the page container
  if (companyPageContainer.hasAttribute("data-handlers-attached")) return;
  companyPageContainer.setAttribute("data-handlers-attached", "true");

  // Add Company button click handler
  companyPageContainer.addEventListener("click", (e) => {
    if (e.target.closest("#btnAddCompany")) {
      e.preventDefault();
      document.getElementById("companyId").value = "";
      const form = document.getElementById("companyForm");
      if (form) form.reset();
      const productsBody = document.getElementById("companyProductsBody");
      if (productsBody) productsBody.innerHTML = "";
      const addCard = document.getElementById("companyAddCard");
      if (addCard) {
        addCard.style.display = "block";
        const header = addCard.querySelector(".card-header");
        if (header) header.textContent = "Add Company";
        addCard.scrollIntoView({ behavior: "smooth" });
      }
    }

    // Cancel button handler
    if (e.target.closest("#cancelCompanyAdd")) {
      e.preventDefault();
      const addCard = document.getElementById("companyAddCard");
      if (addCard) addCard.style.display = "none";
      const form = document.getElementById("companyForm");
      if (form) form.reset();
    }
  });

  // Form submit handler - attach directly to form
  const companyForm = document.getElementById("companyForm");
  if (companyForm) {
    // Remove old listener if exists and attach new one
    const newForm = companyForm.cloneNode(true);
    companyForm.parentNode.replaceChild(newForm, companyForm);
    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const companyId = document.getElementById("companyId")?.value || "";
      const products = [];

      document
        .querySelectorAll("#companyProductsBody tr")
        .forEach((row) => {
          const productName =
            row.querySelector('[name="productName"]')?.value || "";
          if (productName) {
            products.push({
              productName,
              productType:
                row.querySelector('[name="productType"]')?.value || "",
              productId:
                row.querySelector('[name="productId"]')?.value || "",
              group:
                row.querySelector('[name="group"]')?.value || "",
              tradePrice: Number(
                row.querySelector('[name="tradePrice"]')?.value || 0
              ),
              salesTax: Number(
                row.querySelector('[name="salesTax"]')?.value || 0
              ),
              purchaseDiscount: Number(
                row.querySelector('[name="purchaseDiscount"]')?.value || 0
              ),
            });
          }
        });

      const companyData = {
        name: document.getElementById("companyName")?.value || "",
        address: document.getElementById("companyAddress")?.value || "",
        policies: document.getElementById("companyPolicies")?.value || "",
        manager: document.getElementById("companyManager")?.value || "",
        spos: document.getElementById("companySPOs")?.value || "",
        areas: document.getElementById("companyAreas")?.value || "",
        products,
      };

      try {
        const url = companyId
          ? `${API_BASE}/api/companies/${companyId}`
          : `${API_BASE}/api/companies`;
        const method = companyId ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(companyData),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Failed to save company");
        }

        await loadCompanies();
        const addCard = document.getElementById("companyAddCard");
        if (addCard) addCard.style.display = "none";
        const form = document.getElementById("companyForm");
        if (form) form.reset();
        alert(
          companyId
            ? "Company updated successfully!"
            : "Company added successfully!"
        );
      } catch (err) {
        console.error("Save company failed", err);
        alert("Failed to save company: " + err.message);
      }
    });
  }
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  initializeCompanyHandlers();
});

// delete handler (global function used in markup)
function deleteRolePermission(id) {
  if (!confirm("Are you sure you want to delete this role?")) return;
  fetch(`${API_BASE}/api/roles-permissions/${id}`, { method: 'DELETE' })
    .then(() => loadRolesPermissions())
    .catch(err => console.error("Delete failed:", err));
}

function exportCompanyDetailsPdf() {
  if (!cachedCompanies || !cachedCompanies.length) {
    alert('No companies to export');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocked. Please allow popups for this app to export PDF.');
    return;
  }

  const companyDetailsHtml = cachedCompanies.map(c => {
    const productsHtml = (c.products && Array.isArray(c.products) && c.products.length > 0) ? c.products.map(p => `
      <tr>
        <td>${p.productName || ''}</td>
        <td>${p.productType || ''}</td>
        <td>${p.productId || ''}</td>
        <td>${p.group || ''}</td>
        <td>${p.tradePrice || 0}</td>
        <td>${p.salesTax || 0}</td>
        <td>${p.purchaseDiscount || p.discountCustomer || 0}</td>
      </tr>
    `).join('') : '<tr><td colspan="7">No products found.</td></tr>';

    return `
      <div class="company-section">
        <div class="company-header">
          <h3>${c.name || 'N/A'}</h3>
        </div>
        <table class="details-table">
          <tr><th>Company Manager</th><td>${c.manager || ''}</td></tr>
          <tr><th>Address</th><td>${c.address || ''}</td></tr>
          <tr><th>Policies</th><td>${c.policies || ''}</td></tr>
          <tr><th>SPOs</th><td>${c.spos || ''}</td></tr>
          <tr><th>Areas</th><td>${c.areas || ''}</td></tr>
        </table>
        <h4>Products</h4>
        <table class="products-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Product Type</th>
              <th>Product ID</th>
              <th>Group</th>
              <th>Trade Price</th>
              <th>Sales Tax</th>
              <th>Discount</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  win.document.write(`
    <html>
      <head>
        <title>Company Details Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h2 { color: #04792d; text-align: center; margin-bottom: 8px; }
          h3 { color: #04792d; border-bottom: 2px solid #04792d; padding-bottom: 5px; }
          h4 { margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;}
          .header-logo { text-align: center; margin-bottom: 8px; }
          .header-logo img { max-height: 70px; }
          .company-section { margin-bottom: 40px; page-break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: left; }
          th { background: #e6f4ea; }
          .details-table th { width: 150px; }
          .footer { margin-top: 24px; font-size: 9px; color: #555; text-align: center; }
          .warranty { margin-top: 20px; font-size: 7px; color: #444; text-align: left; page-break-before: auto; }
          .warranty p { margin-bottom: 5px; }
          .credits { margin-top: 20px; font-size: 8px; color: #666; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header-logo">
          <img src="assets/logo.png" alt="Logo">
        </div>
        <h2>Company Details Report</h2>
        ${companyDetailsHtml}
        <div class="footer">
          <div>Faizan Medicine Company</div>
          <div>House No CB-28, Sikandarabad Supply Mansehra Road (Abbottabad)</div>
          <div>Phone: +92 3028225831 , +92 3127000265</div>
          <div>Email: fezanmc@gmail.com , fezanmc@yahoo.com</div>
          <div>Thank you for your business!</div>
        </div>

        <div class="warranty">
          <strong>Warranty:</strong>
          <p>Form 2A (See Rules (19 & 30)) Warranty Under Section 23(1)(i) Of The Drugs Act, 1976</p>
          <p>I Zeeshan khan Abbasi being a person resident in Pakistan, carrying on business at Janjua Street Supply Abbottabad under the name of FEZAN MEDICINE COMPANY-ABBOTTABAD, do hereby give this warranty that the drugs here above described as sold by me/specified and contained in the bill of sale, invoice, bill of lading or other document describing the goods referred to herein do not contravene in any way the provisions of section 23 of the Drugs Act, 1976.</p>
          <p>Form 11 [See Rule 10(3)] Warranty Under Alternative Medicines & Health Products (Enlistment) Rules, 2014</p>
          <p>It is hereby certified and I Zeshan Khan Abbasi undertake that above mentioned finished products of specified batch number (or lot number) supplied by me do not contravene any provision of DRAP Act, 2012 and rules framed there under.</p>
          <p><strong>NOTE:</strong><br>
          1- For near expiry products we must be informed six months prior to expiry.<br>
          2- Ensure that you have received the stock according to mentioned quantities and values in this invoice.<br>
          3- In case of any discrepancy, breakage & leakage please inform us immediately otherwise we don't accept any responsibility afterward.</p>
        </div>

        <div class="credits">
          <p>Software Developed by: Auxwork PVT LTD</p>
          <p>auxwork.com, support@auxwork.com</p>
          <p>+923219985472</p>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

// ======================= Purchase Reports Module ========================
let selectedPOItems = [];
let poVendorProducts = [];

// Generate PO Number  
function generatePONumber() {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const sequence = String(timestamp).slice(-4);
  return `PO-${year}-${sequence}`;
}

// Load vendors into dropdown
async function loadVendorsIntoPOForm() {
  try {
    const res = await fetch(`${API_BASE}/api/companies`);
    if (!res.ok) throw new Error('Failed to load companies');
    const companies = await res.json();

    const vendorSelect = document.getElementById('poVendor');
    if (!vendorSelect) return;

    vendorSelect.innerHTML = '<option value="">Select Vendor</option>';
    companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.id;
      option.textContent = company.name;
      option.setAttribute('data-company-name', company.name);
      vendorSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load vendors', err);
  }
}

// Handle vendor selection change
async function onPOVendorChange() {
  const vendorSelect = document.getElementById('poVendor');
  const vendorId = vendorSelect?.value;
  const itemDropdownBtn = document.getElementById('poItemDropdown');
  const itemList = document.getElementById('poItemList');

  // Reset items
  selectedPOItems = [];
  poVendorProducts = [];
  updatePOItemsDisplay();

  if (!vendorId) {
    if (itemDropdownBtn) {
      itemDropdownBtn.disabled = true;
      itemDropdownBtn.textContent = 'Select vendor first';
    }
    if (itemList) {
      itemList.innerHTML = '<li class="px-3 py-2 text-muted">Select a vendor to see items</li>';
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/companies/${vendorId}`);
    if (!res.ok) throw new Error('Failed to load vendor products');
    const company = await res.json();

    poVendorProducts = company.products || [];
    // Add Pack Size default to each product for PO items
    // If product has no packSize, use productType as a fallback hint.
    poVendorProducts = poVendorProducts.map(p => ({
      ...p,
      packSize: p.packSize || p.pack || p.productType || ''
    }));

    if (itemDropdownBtn) {
      itemDropdownBtn.disabled = false;
      itemDropdownBtn.textContent = 'Select items';
    }

    if (itemList) {
      if (poVendorProducts.length === 0) {
        itemList.innerHTML = '<li class="px-3 py-2 text-muted">No products available for this vendor</li>';
      } else {
        itemList.innerHTML = '';
        poVendorProducts.forEach((product, index) => {
          const li = document.createElement('li');
          li.className = 'dropdown-item';
          li.innerHTML = `
            <div class="form-check">
              <input class="form-check-input" type="checkbox" value="${index}" id="poItem${index}" onchange="togglePOItem(${index})">
              <label class="form-check-label" for="poItem${index}">
                ${product.productName || 'Unnamed Product'}
              </label>
            </div>
          `;
          itemList.appendChild(li);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load vendor products', err);
    if (itemList) {
      itemList.innerHTML = '<li class="px-3 py-2 text-danger">Error loading products</li>';
    }
  }
}

// Toggle item selection
function togglePOItem(index) {
  const checkbox = document.getElementById(`poItem${index}`);
  if (!checkbox) return;

  if (checkbox.checked) {
    if (!selectedPOItems.includes(index)) {
      selectedPOItems.push(index);
    }
  } else {
    selectedPOItems = selectedPOItems.filter(i => i !== index);
  }

  updatePOItemsDisplay();
}

// Update items display
function updatePOItemsDisplay() {
  const itemDropdownBtn = document.getElementById('poItemDropdown');
  const selectedCountEl = document.getElementById('selectedItemsCount');
  const hiddenInput = document.getElementById('poItems');
  const packSizeEl = document.getElementById('poPackSize');

  if (selectedPOItems.length === 0) {
    if (itemDropdownBtn) itemDropdownBtn.textContent = 'Select items';
    if (selectedCountEl) selectedCountEl.textContent = '';
    if (hiddenInput) hiddenInput.value = '';
    if (packSizeEl) packSizeEl.value = '';
  } else {
    const selectedNames = selectedPOItems.map(i => poVendorProducts[i]?.productName || 'Unknown').join(', ');
    if (itemDropdownBtn) {
      itemDropdownBtn.textContent = `${selectedPOItems.length} item(s) selected`;
    }
    if (selectedCountEl) {
      selectedCountEl.textContent = `Selected: ${selectedNames}`;
    }
    if (hiddenInput) {
      hiddenInput.value = JSON.stringify(selectedPOItems.map(i => poVendorProducts[i]));
    }
    // Auto-fill Pack Size based on first selected item
    if (packSizeEl) {
      const first = poVendorProducts[selectedPOItems[0]];
      packSizeEl.value = first?.packSize || '';
    }
  }
}

// Load and render purchase orders
async function loadPurchaseOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders`);
    if (!res.ok) throw new Error('Failed to load purchase orders');
    const orders = await res.json();

    const tbody = document.getElementById('purchaseOrderBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No purchase orders found</td></tr>';
      return;
    }

    orders.forEach(order => {
      const tr = document.createElement('tr');

      // Format items display
      let itemsDisplay = '-';
      if (order.items) {
        if (Array.isArray(order.items)) {
          itemsDisplay = order.items.map(item => item.productName || item).join(', ');
        } else if (typeof order.items === 'string') {
          itemsDisplay = order.items;
        }
      } else if (order.item) {
        itemsDisplay = order.item;
      }

      // Format expiry date
      let expiryDisplay = '-';
      const expiryRaw = order.expiry_date || order.expiryDate;
      if (expiryRaw) {
        try {
          expiryDisplay = new Date(expiryRaw).toLocaleDateString();
        } catch {
          expiryDisplay = expiryRaw;
        }
      }

      // Format order date
      let dateDisplay = '-';
      const dateRaw = order.order_date || order.date || order.orderDate;
      if (dateRaw) {
        try {
          dateDisplay = new Date(dateRaw).toLocaleDateString();
        } catch {
          dateDisplay = dateRaw;
        }
      }

      // Group display: from items array or fallback
      let groupDisplay = '-';
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        const groups = order.items.map(item => item.group || '').filter(g => g);
        groupDisplay = groups.length ? groups.join(', ') : '-';
      }

      tr.innerHTML = `
        <td>${order.po_number || order.poNumber || order.id || '-'}</td>
        <td>${order.vendor_name || order.vendor || order.vendorName || '-'}</td>
        <td>${itemsDisplay}</td>
        <td>${groupDisplay}</td>
        <td>${order.quantity || '-'}</td>
        <td>${order.batch || '-'}</td>
        <td>${expiryDisplay}</td>
        <td>${dateDisplay}</td>
        <td>${order.notes || order.remarks || '-'}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deletePurchaseOrder(${order.id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load purchase orders', err);
    const tbody = document.getElementById('purchaseOrderBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error loading purchase orders</td></tr>';
    }
  }
}

// Delete purchase order
async function deletePurchaseOrder(id) {
  if (!confirm('Are you sure you want to delete this purchase order?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/purchase-orders/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete purchase order');

    await loadPurchaseOrders();
    alert('Purchase order deleted successfully');
  } catch (err) {
    console.error('Delete purchase order failed', err);
    alert('Failed to delete purchase order: ' + err.message);
  }
}

// Make delete function global
window.deletePurchaseOrder = deletePurchaseOrder;

// Load SPO'S Reports
async function loadSposReports() {
  try {
    const res = await fetch(`${API_BASE}/api/spos-reports`);
    const reports = await res.json();
    const tbody = document.getElementById('sposReportsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    reports.forEach(report => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${report.productName}</td>
        <td>${report.group}</td>
        <td>${report.area}</td>
        <td>${report.quantity}</td>
        <td>${report.price}</td>
      `;
      tbody.appendChild(tr);
    });

    // Wire up search
    const searchInput = document.getElementById('sposReportsSearch');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filtered = reports.filter(r =>
          r.productName.toLowerCase().includes(query) ||
          r.group.toLowerCase().includes(query) ||
          r.area.toLowerCase().includes(query)
        );
        tbody.innerHTML = '';
        filtered.forEach(report => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${report.productName}</td>
            <td>${report.group}</td>
            <td>${report.area}</td>
            <td>${report.quantity}</td>
            <td>${report.price}</td>
          `;
          tbody.appendChild(tr);
        });
      });
    }
  } catch (err) {
    console.error('Failed to load SPO\'S reports:', err);
    alert('Failed to load SPO\'S reports: ' + err.message);
  }
}

document.getElementById('btnExportSposReportsPDF').addEventListener('click', async () => {
  const searchQuery = document.getElementById('sposReportsSearch').value;
  const url = new URL(`${API_BASE}/api/spos-reports/pdf`);
  if (searchQuery) {
    url.searchParams.append('q', searchQuery);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Failed to generate PDF');
    }
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = objectUrl;
    a.download = 'spos-reports.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Failed to export SPO\'S reports PDF:', err);
    alert('Failed to export SPO\'S reports PDF: ' + err.message);
  }
});

// Initialize Purchase Order handlers
function initializePurchaseOrderHandlers() {
  const btnAddPO = document.getElementById('btnAddPurchaseOrder');
  const btnCancelPO = document.getElementById('cancelPurchaseOrderAdd');
  const poForm = document.getElementById('purchaseOrderForm');
  const vendorSelect = document.getElementById('poVendor');

  if (btnAddPO) {
    btnAddPO.addEventListener('click', () => {
      const poNumberInput = document.getElementById('poNumber');
      if (poNumberInput) {
        poNumberInput.value = generatePONumber();
      }

      const addCard = document.getElementById('purchaseOrderAddCard');
      if (addCard) {
        addCard.style.display = 'block';
        addCard.scrollIntoView({ behavior: 'smooth' });
      }

      loadVendorsIntoPOForm();

      // Reset form
      if (poForm) poForm.reset();
      if (poNumberInput) poNumberInput.value = generatePONumber();
      selectedPOItems = [];
      poVendorProducts = [];
      updatePOItemsDisplay();
    });
  }

  if (btnCancelPO) {
    btnCancelPO.addEventListener('click', () => {
      const addCard = document.getElementById('purchaseOrderAddCard');
      if (addCard) addCard.style.display = 'none';
      if (poForm) poForm.reset();
      selectedPOItems = [];
      poVendorProducts = [];
    });
  }

  if (vendorSelect) {
    vendorSelect.addEventListener('change', onPOVendorChange);
  }

  if (poForm) {
    poForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const vendorSelect = document.getElementById('poVendor');
      const vendorId = vendorSelect?.value;
      const vendorName = vendorSelect?.options[vendorSelect.selectedIndex]?.getAttribute('data-company-name') || '';

      if (!vendorId) {
        alert('Please select a vendor');
        return;
      }

      if (selectedPOItems.length === 0) {
        alert('Please select at least one item');
        return;
      }

      const items = selectedPOItems.map(i => poVendorProducts[i]);

      const poNumber = document.getElementById('poNumber')?.value || '';
      const orderDate = document.getElementById('poDate')?.value || '';
      const remarks = document.getElementById('poRemarks')?.value || '';
      const quantity = parseInt(document.getElementById('poQuantity')?.value || '0') || null;
      const packSize = String(document.getElementById('poPackSize')?.value || '').trim();
      const batch = document.getElementById('poBatch')?.value || '';
      const expiryDate = document.getElementById('poExpiryDate')?.value || null;

      // Store packSize on each selected item so it can appear in exports/search
      const itemsWithPack = (items || []).map(it => {
        if (!it || typeof it !== 'object') return it;
        return { ...it, packSize: it.packSize || packSize || '' };
      });

      const poData = {
        poNumber,
        vendorId,
        vendorName,
        items: itemsWithPack,
        quantity,
        batch,
        expiryDate,
        orderDate,
        deliveryDate: null,
        totalAmount: 0,
        status: 'Draft',
        remarks
      };

      try {
        const res = await fetch(`${API_BASE}/api/purchase-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(poData)
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Failed to save purchase order');
        }

        alert('Purchase order saved successfully!');
        const addCard = document.getElementById('purchaseOrderAddCard');
        if (addCard) addCard.style.display = 'none';
        if (poForm) poForm.reset();
        selectedPOItems = [];
        poVendorProducts = [];

        // Reload purchase orders table if function exists
        if (typeof loadPurchaseOrders === 'function') {
          loadPurchaseOrders();
        }
      } catch (err) {
        console.error('Save purchase order failed', err);
        alert('Failed to save purchase order: ' + err.message);
      }
    });
  }
}

// Make toggle function global
window.togglePOItem = togglePOItem;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializePurchaseOrderHandlers();
});



// ======================= 8.1) Sales Reports (Stock & Sales) =======================

// Generate Sale Number
function generateSaleNumber() {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const sequence = String(timestamp).slice(-4);
  return `SR-${year}-${sequence}`;
}

// Load Customers into Dropdown
async function loadCustomersIntoSalesForm() {
  try {
    // Assuming api/customers exists, otherwise use companies or dummy
    // Checking if loadCustomers exists globally or fetch manually
    // For now, let's try to fetch customers if the endpoint typically exists
    // If not, we might need to rely on a different source. 
    const res = await fetch(`${API_BASE}/api/customers?limit=500`);
    if (!res.ok) {
      console.warn('No customers API found');
      return;
    }
    const data = await res.json();
    const customers = Array.isArray(data.customers) ? data.customers : (Array.isArray(data) ? data : []);

    const customerSelect = document.getElementById('saleCustomer');
    if (!customerSelect) return;

    customerSelect.innerHTML = '<option value="">Select Customer</option>';
    customers.forEach(cust => {
      const option = document.createElement('option');
      option.value = cust.id || cust.name;
      option.textContent = cust.name;
      customerSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load customers', err);
    // Silent fail or fallback
  }
}

// Load Available Stock (PO Items) into Dropdown
async function loadAvailableStockIntoSalesForm() {
  try {
    const [posRes, salesRes] = await Promise.all([
      fetch(`${API_BASE}/api/purchase-orders`),
      fetch(`${API_BASE}/api/sales-reports`)
    ]);

    const pos = posRes.ok ? await posRes.json() : [];
    const sales = salesRes.ok ? await salesRes.json() : [];

    // Calculate Stock
    // Flatten PO items
    let stockItems = [];
    pos.forEach(po => {
      let items = [];
      if (Array.isArray(po.items)) items = po.items;
      else if (typeof po.items === 'string') items = [{ productName: po.items, quantity: po.quantity }]; // Fallback
      else if (po.item) items = [{ productName: po.item, quantity: po.quantity }];

      items.forEach((item, idx) => {
        // Find existing sales for this specific PO Item reference
        // We match by PO Number and Item Name/Batch for consistency
        const soldQty = sales
          .filter(s => s.poNumber === po.poNumber && s.itemName === (item.productName || item.item))
          .reduce((sum, s) => sum + Number(s.quantity || 0), 0);

        const originalQty = Number(item.quantity || po.quantity || 0);
        const remaining = originalQty - soldQty;

        if (remaining > 0) {
          stockItems.push({
            poNumber: po.poNumber,
            itemName: item.productName || item.item || 'Unknown',
            batch: po.batch || item.batch || '-',
            expiry: po.expiryDate || item.expiryDate || '-',
            remaining: remaining,
            original: originalQty
          });
        }
      });
    });

    const itemSelect = document.getElementById('saleItem');
    if (!itemSelect) return;

    itemSelect.innerHTML = '<option value="">Select Item to Sell</option>';
    stockItems.forEach((item, index) => {
      const option = document.createElement('option');
      // Store index or composite key
      option.value = JSON.stringify(item);
      option.textContent = `${item.itemName} (Batch: ${item.batch}) - Avail: ${item.remaining}`;
      itemSelect.appendChild(option);
    });

  } catch (err) {
    console.error('Failed to load stock', err);
  }
}

// Load and Render Sales Reports (Inventory View)
async function loadSalesReports() {
  try {
    // 1. Fetch Data - Purchase Orders, Bookings, AND Companies (for Trade Price)
    const [posRes, bookingsRes, companiesRes] = await Promise.all([
      fetch(`${API_BASE}/api/purchase-orders`),
      fetch(`${API_BASE}/api/bookings`),
      fetch(`${API_BASE}/api/companies`)
    ]);

    const pos = posRes.ok ? await posRes.json() : [];
    const bookings = bookingsRes.ok ? await bookingsRes.json() : [];
    const companies = companiesRes.ok ? await companiesRes.json() : [];

    // Build Product Price, Company & Group Map
    const productPriceMap = {};
    const productCompanyMap = {};
    const productGroupMap = {};
    if (Array.isArray(companies)) {
      companies.forEach(company => {
        const cName = company.name || company.companyName || '';
        if (company.products && Array.isArray(company.products)) {
          company.products.forEach(p => {
            if (p.productName) {
              const pKey = p.productName.toLowerCase().trim();
              productPriceMap[pKey] = Number(p.tradePrice || 0);
              productCompanyMap[pKey] = cName;
              productGroupMap[pKey] = p.group || '-';
            }
          });
        }
      });
    }

    const tbody = document.getElementById('salesReportsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (pos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No stock available (No Purchase Orders)</td></tr>';
      return;
    }

    // 2. Process each Purchase Order
    pos.forEach(po => {
      // Normalize Items
      let items = [];
      if (Array.isArray(po.items)) items = po.items;
      else if (po.item) items = [{ productName: po.item, quantity: po.quantity, batch: po.batch, expiryDate: po.expiryDate }];

      items.forEach(item => {
        const itemName = (item.productName || item.item || 'Unknown').trim();
        const batch = po.batch || item.batch || '-';
        const expiry = po.expiryDate || item.expiryDate || '-';
        const originalQty = Number(item.quantity || po.quantity || 0);
        const poNum = po.poNumber || po.poNo || '-';

        // Calculate sold quantity by searching through all bookings
        let totalSold = 0;
        bookings.forEach(booking => {
          const products = booking.products || [];
          products.forEach(product => {
            const bookingProductName = (product.product || product.productName || '').trim();
            const bookingBatch = (product.batch || '').trim();

            // Match by product name (case-insensitive) and optionally by batch
            const nameMatch = bookingProductName.toLowerCase() === itemName.toLowerCase();
            const batchMatch = batch === '-' || bookingBatch === '-' || batch === bookingBatch;

            if (nameMatch && batchMatch) {
              // Include both qty and bonus in total sold
              const qty = Number(product.qty || 0);
              const bonus = Number(product.bonus || 0);
              totalSold += qty + bonus;
            }
          });
        });

        const remainingQty = originalQty - totalSold;


        // Get Unit Price, Company, Group
        let unitPrice = productPriceMap[itemName.toLowerCase()] || 0;
        const companyName = productCompanyMap[itemName.toLowerCase()] || '-';
        const groupName = productGroupMap[itemName.toLowerCase()] || '-';
        if (unitPrice === 0) {
          unitPrice = Number(po.unitPrice || po.price || item.unitPrice || item.price || 0);
        }

        // Calculate values
        const totalValue = originalQty * unitPrice;
        const soldValue = totalSold * unitPrice;
        const remainingValue = remainingQty * unitPrice;

        // Render Row
        const tr = document.createElement('tr');
        tr.className = 'sales-report-row'; // For search filtering
        tr.setAttribute('data-item-name', itemName.toLowerCase());
        tr.setAttribute('data-batch', batch.toLowerCase());
        tr.setAttribute('data-po-num', poNum.toLowerCase());
        tr.setAttribute('data-company', companyName.toLowerCase());

        tr.innerHTML = `
          <td>${poNum}</td>
          <td>${itemName}</td>
          <td>${companyName}</td>
          <td>${groupName}</td>
          <td>${batch}</td>
          <td>${expiry}</td>
          <td class="text-end">${unitPrice.toFixed(2)}</td>
          <td class="text-end">${originalQty}</td>
          <td class="text-end fw-bold text-info">${totalValue.toFixed(2)}</td>
          <td class="text-end fw-bold text-primary">${totalSold}</td>
          <td class="text-end fw-bold text-primary">${soldValue.toFixed(2)}</td>
          <td class="text-end fw-bold ${remainingQty < 10 ? 'text-danger' : 'text-success'}">${remainingQty}</td>
          <td class="text-end fw-bold ${remainingQty < 10 ? 'text-danger' : 'text-success'}">${remainingValue.toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-info" onclick="viewSalesHistory('${poNum}', '${escapeHtml(itemName)}')">
              <i class="bi bi-clock-history"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });

    // Add search functionality
    const searchInput = document.getElementById('salesReportsSearch');
    if (searchInput) {
      // Remove existing listener if any
      searchInput.removeEventListener('input', window.salesReportsSearchHandler);

      // Create and store the handler
      window.salesReportsSearchHandler = function (e) {
        const query = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.sales-report-row');

        rows.forEach(row => {
          const itemName = row.getAttribute('data-item-name') || '';
          const batch = row.getAttribute('data-batch') || '';
          const poNum = row.getAttribute('data-po-num') || '';
          const company = row.getAttribute('data-company') || '';

          const matches = itemName.includes(query) ||
            batch.includes(query) ||
            poNum.includes(query) ||
            company.includes(query);

          row.style.display = matches ? '' : 'none';
        });
      };

      searchInput.addEventListener('input', window.salesReportsSearchHandler);
    }

  } catch (err) {
    console.error('Failed to load sales reports', err);
    const tbody = document.getElementById('salesReportsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading data</td></tr>';
  }
}

// View History Helper (Optional, for "Actions" column)
function viewSalesHistory(poNum, item) {
  alert(`History feature for ${item} (PO: ${poNum}) coming soon!`);
}
window.viewSalesHistory = viewSalesHistory;


// Initialize Handlers
function initializeSalesReportsHandlers() {
  const btnAdd = document.getElementById('btnAddSalesReport');
  const btnCancel = document.getElementById('cancelSalesReportAdd');
  const form = document.getElementById('salesReportForm');

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      document.getElementById('salesReportAddCard').style.display = 'block';
      document.getElementById('saleNumber').value = generateSaleNumber();
      // Load Data
      loadCustomersIntoSalesForm();
      loadAvailableStockIntoSalesForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      document.getElementById('salesReportAddCard').style.display = 'none';
      form.reset();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const itemSelect = document.getElementById('saleItem');
      if (!itemSelect.value) {
        alert("Please select an item");
        return;
      }

      const selectedItemData = JSON.parse(itemSelect.value);
      const qty = Number(document.getElementById('saleQuantity').value);

      if (qty > selectedItemData.remaining) {
        alert(`Insufficient stock! Only ${selectedItemData.remaining} available.`);
        return;
      }

      const saleData = {
        saleNumber: document.getElementById('saleNumber').value,
        customer: document.getElementById('saleCustomer').value, // ID or Name
        customerName: document.getElementById('saleCustomer').options[document.getElementById('saleCustomer').selectedIndex].text,
        poNumber: selectedItemData.poNumber, // Link to Stock
        itemName: selectedItemData.itemName,
        batch: selectedItemData.batch,
        quantity: qty,
        date: document.getElementById('saleDate').value,
        remarks: document.getElementById('saleRemarks').value
      };

      try {
        const res = await fetch(`${API_BASE}/api/sales-reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData)
        });

        if (!res.ok) throw new Error("Failed to save sale");

        alert("✅ Sale Saved & Stock Updated!");
        document.getElementById('salesReportAddCard').style.display = 'none';
        form.reset();
        loadSalesReports(); // Refresh Table
      } catch (err) {
        console.error(err);
        alert("Error saving sale: " + err.message);
      }
    });
  }
}

// Register Init
document.addEventListener('DOMContentLoaded', () => {
  initializeSalesReportsHandlers();
});

// ======================= 18.1) Salesman Department =======================
async function loadSalesmen() {
  try {
    const res = await fetch(`${API_BASE}/api/salesman`);
    if (!res.ok) throw new Error('Failed to load salesmen');
    const data = await res.json();
    const tbody = document.getElementById('salesmenBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.id}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.loginID)}</td>
        <td>${escapeHtml(s.password)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteSalesman(${s.id})"><i class="bi bi-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Load salesmen failed', err);
  }
}

async function saveSalesman(e) {
  e.preventDefault();
  const name = document.getElementById('salesmanName')?.value.trim();
  const loginID = document.getElementById('salesmanLoginID')?.value.trim();
  const password = document.getElementById('salesmanPassword')?.value.trim();
  if (!name || !loginID || !password) {
    alert('Please fill all fields.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/salesman`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, loginID, password })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to save salesman');
    alert('✅ Salesman saved');
    document.getElementById('salesmanForm').reset();
    document.getElementById('salesmanFormCard').style.display = 'none';
    loadSalesmen();
  } catch (err) {
    console.error('Save salesman failed', err);
    alert('Failed to save salesman');
  }
}

async function deleteSalesman(id) {
  if (!confirm('Delete this salesman?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/salesman/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadSalesmen();
  } catch (err) {
    console.error('Delete salesman failed', err);
    alert('Delete failed');
  }
}
window.deleteSalesman = deleteSalesman;

document.addEventListener('DOMContentLoaded', () => {
  const btnAddSalesman = document.getElementById('btnAddSalesman');
  const btnCloseSalesman = document.getElementById('closeSalesmanForm');
  const btnCancelSalesman = document.getElementById('cancelSalesman');
  const salesmanForm = document.getElementById('salesmanForm');
  if (btnAddSalesman) btnAddSalesman.addEventListener('click', () => {
    document.getElementById('salesmanFormCard').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  if (btnCloseSalesman) btnCloseSalesman.addEventListener('click', () => {
    document.getElementById('salesmanFormCard').style.display = 'none';
  });
  if (btnCancelSalesman) btnCancelSalesman.addEventListener('click', () => {
    document.getElementById('salesmanFormCard').style.display = 'none';
  });
  if (salesmanForm) salesmanForm.addEventListener('submit', saveSalesman);
});
