const SUPABASE_CONFIG = {
  url: 'https://cjqxomccvgmqelqmfdih.supabase.co',
  anonKey: 'sb_publishable_knWN1qaeEs9CIqGFSq6ySg_89Y4DNSw',
};

const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

const state = {
  activeView: 'dashboard',
  currentUser: null,
  currentUserProfile: null,
};

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authMessage = document.getElementById('authMessage');
const userNameLabel = document.getElementById('userNameLabel');
const pageTitle = document.getElementById('pageTitle');

const views = {
  dashboard: document.getElementById('dashboardView'),
  receivables: document.getElementById('receivablesView'),
  payables: document.getElementById('payablesView'),
  payments: document.getElementById('paymentsView'),
  products: document.getElementById('productsView'),
  customers: document.getElementById('customersView'),
  suppliers: document.getElementById('suppliersView'),
  invoices: document.getElementById('invoicesView'),
  history: document.getElementById('historyView'),
  users: document.getElementById('usersView'),
};

function showMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#fca5a5' : '#86efac';
}

function getFormField(form, fieldId, fallbackId = null) {
  const field = form?.querySelector(`#${fieldId}`) || document.getElementById(fieldId) || (fallbackId ? document.getElementById(fallbackId) : null);
  return field || null;
}

function closeEditModal() {
  const modal = document.getElementById('recordEditModal');
  const body = document.getElementById('recordEditBody');
  if (modal) modal.classList.add('hidden');
  if (body) body.innerHTML = '';
}

function resetUserFormState() {
  const userForm = document.getElementById('userForm');
  if (!userForm) return;

  userForm.reset();
  delete userForm.dataset.editingId;
  const passwordField = document.getElementById('adminUserPassword');
  if (passwordField) {
    passwordField.required = true;
  }
  const submitBtn = document.getElementById('userSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Guardar';
}

function syncInvoicePaymentFields(form = document) {
  const paymentTypeField = getFormField(form, 'invoicePaymentType', 'invoicePaymentType');
  const initialPaymentField = getFormField(form, 'invoiceInitialPayment', 'invoiceInitialPayment');
  const useCreditCheckbox = getFormField(form, 'invoiceUseCreditBalance', 'invoiceUseCreditBalance');
  const creditBalanceEl = getFormField(form, 'availableCreditBalance', 'availableCreditBalance');

  if (!paymentTypeField || !initialPaymentField) return;

  const isAbono = (paymentTypeField.value || 'TOTAL').toUpperCase() === 'ABONO';
  initialPaymentField.classList.toggle('hidden', !isAbono);
  initialPaymentField.disabled = !isAbono;

  if (useCreditCheckbox) {
    if (!isAbono && !useCreditCheckbox.checked) {
      useCreditCheckbox.disabled = false;
    }
  }

  if (!isAbono) {
    initialPaymentField.value = '';
  }
}

function resetFormState(form) {
  if (!form || typeof form.reset !== 'function') return;

  form.reset();

  if (form.id === 'invoiceForm') {
    const invoiceType = document.getElementById('invoiceType');
    const operationReference = document.getElementById('invoiceOperationReference');
    const customerSelect = document.getElementById('invoiceCustomerId');
    const supplierSelect = document.getElementById('invoiceSupplierId');
    const paymentType = document.getElementById('invoicePaymentType');
    const paymentMethod = document.getElementById('invoicePaymentMethod');
    const initialPayment = document.getElementById('invoiceInitialPayment');
    const preview = document.getElementById('invoiceTotalPreview');

    if (invoiceType) invoiceType.value = 'SALE';
    if (operationReference) {
      operationReference.value = '';
      operationReference.placeholder = 'Remisión';
    }
    if (customerSelect) {
      customerSelect.disabled = false;
      customerSelect.classList.remove('hidden');
    }
    if (supplierSelect) {
      supplierSelect.disabled = true;
      supplierSelect.classList.add('hidden');
    }
    if (paymentType) paymentType.value = 'TOTAL';
    if (paymentMethod) paymentMethod.value = 'EFECTIVO';
    if (initialPayment) {
      initialPayment.value = '';
      initialPayment.classList.add('hidden');
      initialPayment.disabled = true;
    }
    const useCreditCheckbox = document.getElementById('invoiceUseCreditBalance');
    if (useCreditCheckbox) {
      useCreditCheckbox.checked = false;
    }
    const creditBalanceEl = document.getElementById('availableCreditBalance');
    if (creditBalanceEl) {
      creditBalanceEl.textContent = '';
    }
    if (preview) preview.textContent = formatMoney(0);
    syncInvoiceNumber();
  }

  if (form.id === 'userForm') {
    const passwordField = document.getElementById('adminUserPassword');
    if (passwordField) passwordField.required = true;
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function parseFormattedNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value)
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatNumberInput(value, allowDecimal = true) {
  if (value === null || value === undefined || value === '') return '';

  let raw = String(value).replace(/[^\d,.-]/g, '');
  if (!raw) return '';

  const isNegative = raw.startsWith('-');
  raw = raw.replace(/^-/, '');

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let integerPart = raw;
  let decimalPart = '';

  if (allowDecimal && decimalIndex > -1) {
    integerPart = raw.slice(0, decimalIndex);
    decimalPart = raw.slice(decimalIndex + 1);
    integerPart = integerPart.replace(/[.,]/g, '');
    decimalPart = decimalPart.replace(/[.,]/g, '');
  } else {
    integerPart = raw.replace(/[.,]/g, '');
  }

  if (!integerPart && !decimalPart) return '';

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalSuffix = allowDecimal && decimalPart ? ',' + decimalPart : '';

  return `${isNegative ? '-' : ''}${formattedInteger}${decimalSuffix}`;
}

function applyFormattedNumberListener(elementId, allowDecimal = true, root = document) {
  const element = root && root.querySelector ? root.querySelector(`#${elementId}`) : document.getElementById(elementId);
  if (!element) return;

  element.addEventListener('input', (event) => {
    const formatted = formatNumberInput(event.target.value, allowDecimal);
    event.target.value = formatted;
  });
}

function getTypeLabel(type) {
  const map = {
    ENTRY: 'Entrada',
    EXIT: 'Salida',
    ADJUSTMENT: 'Ajuste',
    SALE: 'Venta',
    PURCHASE: 'Compra',
  };

  return map[String(type || '').toUpperCase()] || String(type || '-');
}

function getInvoiceOperationValue(invoice) {
  if (!invoice) return 'SIN_TIPO';
  const type = invoice.type || invoice.kind || 'SALE';
  const raw = invoice.operation_reference || invoice.operation_type || invoice.operationType || invoice.operation || '';
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized) return type;
  if (type === 'PURCHASE') return 'PURCHASE';
  return 'SALE';
}

function getInvoiceOperationLabel(invoice) {
  if (!invoice) return 'Sin tipo';
  const type = invoice.type || invoice.kind || 'SALE';
  const raw = invoice.operation_reference || invoice.operation_type || invoice.operationType || invoice.operation || '';
  const normalized = String(raw).trim();

  if (!normalized) return type === 'PURCHASE' ? 'Compra' : 'Venta';

  const upper = normalized.toUpperCase();
  if (type === 'PURCHASE') {
    return upper.includes('REC') || upper.includes('RECIBIDO') ? 'Compra' : 'Compra';
  }
  return upper.includes('REM') || upper.includes('REMISION') || upper.includes('REMISIÓN') ? 'Venta' : 'Venta';
}

function getInvoiceOperationId(invoice) {
  if (!invoice) return '';
  const raw = invoice.operation_reference || invoice.operation_id || invoice.operationTypeId || invoice.operation_type_id || invoice.operationId || invoice.id_operacion || '';
  if (raw === null || raw === undefined || raw === '') return '';
  return String(raw).trim();
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAuditDetails(details) {
  if (!details) return '-';

  if (typeof details === 'string') return details;

  try {
    const obj = typeof details === 'object' ? details : JSON.parse(details);
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ')
      .slice(0, 120);
  } catch {
    return String(details).slice(0, 120);
  }
}

function setPageTitle(viewName) {
  const map = {
    dashboard: 'Dashboard',
    receivables: 'Cuentas por cobrar',
    payables: 'Cuentas por pagar',
    payments: 'Pagos/Abonos',
    products: 'Productos',
    customers: 'Clientes',
    suppliers: 'Proveedores',
    invoices: 'Facturación',
    history: 'Historial',
    users: 'Usuarios',
  };
  pageTitle.textContent = map[viewName] || 'Dashboard';
}

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN';
}

async function loadCurrentUserProfile() {
  if (!state.currentUser?.id) {
    state.currentUserProfile = null;
    return null;
  }

  const { data, error } = await supabaseClient.from('profiles').select('id, full_name, email, role').eq('id', state.currentUser.id).single();
  if (error) {
    state.currentUserProfile = null;
    return null;
  }

  state.currentUserProfile = data;
  return data;
}

async function recordAudit(action, entityType, entityId, details = {}) {
  if (!state.currentUser) return;

  await supabaseClient.from('audit_logs').insert([
    {
      actor_id: state.currentUser.id,
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      details,
    },
  ]);
}

async function setActiveView(viewName) {
  state.activeView = viewName;
  setPageTitle(viewName);

  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle('active-view', key === viewName);
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });

  if (state.currentUser) {
    if (viewName === 'users') {
      resetUserFormState();
    }
    if (viewName === 'products') await loadProducts();
    if (viewName === 'customers') await loadCustomers();
    if (viewName === 'suppliers') await loadSuppliers();
    if (viewName === 'invoices') await loadInvoices();
    if (viewName === 'receivables') await loadAccountsReceivable();
    if (viewName === 'payables') await loadAccountsPayable();
    if (viewName === 'payments') await loadPayments();
    if (viewName === 'users') await loadUsers();
    if (viewName === 'history') await loadHistory();
    if (viewName === 'dashboard') await loadDashboard();
  }
}

function checkSupabaseSetup() {
  const isConfigured = SUPABASE_CONFIG.url.includes('supabase.co') && SUPABASE_CONFIG.anonKey !== 'TU_SUPABASE_ANON_KEY';
  if (!isConfigured) {
    showMessage('Configura la URL y la anon key de Supabase en app.js antes de usar la app.', true);
    return false;
  }
  return true;
}

async function initSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    state.currentUser = session.user;
    await loadCurrentUserProfile();
    await renderUserState();
    await loadAllModules();
  } else {
    state.currentUser = null;
    state.currentUserProfile = null;
    await renderUserState();
  }
}

async function renderUserState() {
  if (state.currentUser) {
    authView.classList.add('hidden');
    appView.classList.remove('hidden');

    if (!state.currentUserProfile) {
      await loadCurrentUserProfile();
    }

    const displayName = state.currentUserProfile?.full_name || state.currentUserProfile?.email || state.currentUser?.user_metadata?.full_name || state.currentUser?.email || 'Usuario';
    userNameLabel.textContent = displayName;
    await setActiveView(state.activeView);
  } else {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
}

async function loginUser(email, password) {
  if (!checkSupabaseSetup()) return;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }

  state.currentUser = data.user;
  await renderUserState();
  await loadAllModules();
  showMessage('Sesión iniciada correctamente.');
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  await renderUserState();
  showMessage('Sesión cerrada.');
}

async function registerInvoicePayment(invoiceId, amount, source = 'ABONO', paymentMethod = 'EFECTIVO') {
  if (!invoiceId || !Number(amount) || Number(amount) <= 0) return;

  const { error } = await supabaseClient.from('invoice_payments').insert([
    {
      invoice_id: invoiceId,
      amount: Number(amount),
      payment_type: source,
      payment_method: paymentMethod,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    alert(error.message);
  }
}

let purchasesSalesChart = null;

function getInvoiceYear(invoice) {
  const date = new Date(invoice.created_at || invoice.date || new Date());
  return date.getFullYear();
}

function getInvoiceMonth(invoice) {
  const date = new Date(invoice.created_at || invoice.date || new Date());
  return date.getMonth() + 1;
}

function getAvailableYears(invoices) {
  const years = new Set();
  (invoices || []).forEach((invoice) => {
    const year = getInvoiceYear(invoice);
    if (year > 1970) years.add(year);
  });
  return Array.from(years).sort((a, b) => a - b);
}

function getMonthlyAggregates(invoices, year) {
  const salesByMonth = new Array(12).fill(0);
  const purchasesByMonth = new Array(12).fill(0);

  (invoices || []).forEach((invoice) => {
    if (getInvoiceYear(invoice) !== year) return;
    const month = getInvoiceMonth(invoice) - 1;
    const total = Number(invoice.total || 0);
    if (invoice.type === 'SALE') {
      salesByMonth[month] += total;
    } else if (invoice.type === 'PURCHASE') {
      purchasesByMonth[month] += total;
    }
  });

  return { salesByMonth, purchasesByMonth };
}

function renderPurchasesSalesChart(invoices, year) {
  const ctx = document.getElementById('purchasesSalesChart');
  if (!ctx) return;

  const { salesByMonth, purchasesByMonth } = getMonthlyAggregates(invoices, year);
  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  if (purchasesSalesChart) {
    purchasesSalesChart.destroy();
  }

  purchasesSalesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Compras',
          data: purchasesByMonth,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
        },
        {
          label: 'Ventas',
          data: salesByMonth,
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatMoney(context.raw)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            callback: (value) => formatMoney(value),
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
        },
      },
    },
  });
}

async function loadDashboard() {
  const [productsResult, customersResult, suppliersResult, usersResult, invoicesResult] = await Promise.all([
    supabaseClient.from('products').select('*'),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('suppliers').select('*'),
    supabaseClient.from('profiles').select('*'),
    supabaseClient.from('invoices').select('*'),
  ]);

  const invoices = invoicesResult.data || [];
  const customerMap = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const supplierMap = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier]));

  const salesTotal = invoices.filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'SALE').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const purchasesTotal = invoices.filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'PURCHASE').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const pendingCustomerDebt = invoices.filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'SALE' && Number(invoice.balance || 0) > 0).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const pendingSupplierDebt = invoices.filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'PURCHASE' && Number(invoice.balance || 0) > 0).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const grossProfit = salesTotal - purchasesTotal;

  const customerDebtList = document.getElementById('customerDebtList');
  const supplierDebtList = document.getElementById('supplierDebtList');

  customerDebtList.innerHTML = invoices
    .filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'SALE' && Number(invoice.balance || 0) > 0)
    .map((invoice) => {
      const customerName = customerMap.get(invoice.customer_id)?.name || 'Cliente';
      return `
        <li>
          <div class="debt-meta">
            <span class="debt-name">${customerName}</span>
            <small>${invoice.invoice_number || 'Factura'}</small>
          </div>
          <span class="debt-amount">${formatMoney(invoice.balance || 0)}</span>
        </li>
      `;
    })
    .join('') || '<li class="empty-item">No hay deudas pendientes.</li>';

  supplierDebtList.innerHTML = invoices
    .filter((invoice) => (invoice.type || getInvoiceOperationValue(invoice)) === 'PURCHASE' && Number(invoice.balance || 0) > 0)
    .map((invoice) => {
      const supplierName = supplierMap.get(invoice.supplier_id)?.name || 'Proveedor';
      return `
        <li>
          <div class="debt-meta">
            <span class="debt-name">${supplierName}</span>
            <small>${invoice.invoice_number || 'Factura'}</small>
          </div>
          <span class="debt-amount">${formatMoney(invoice.balance || 0)}</span>
        </li>
      `;
    })
    .join('') || '<li class="empty-item">No hay deudas pendientes.</li>';

  document.getElementById('productsTotal').textContent = formatMoney(purchasesTotal);
  document.getElementById('customerPaymentsTotal').textContent = formatMoney(salesTotal);
  document.getElementById('supplierPaymentsTotal').textContent = formatMoney(grossProfit);
  document.getElementById('payablesTotal').textContent = formatMoney(pendingSupplierDebt);
  document.getElementById('netBalanceTotal')?.remove();
  document.getElementById('customersTotal')?.remove();
  document.getElementById('suppliersTotal')?.remove();
  document.getElementById('usersTotal')?.remove();

  const availableYears = getAvailableYears(invoices);
  const yearFilter = document.getElementById('chartYearFilter');
  if (yearFilter) {
    const currentYear = new Date().getFullYear();
    const selectedYear = yearFilter.value ? Number(yearFilter.value) : (availableYears.includes(currentYear) ? currentYear : (availableYears[0] || currentYear));
    yearFilter.innerHTML = availableYears.map((year) => `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`).join('');
    renderPurchasesSalesChart(invoices, selectedYear);
  }
}

async function loadPayments() {
  const [invoicesResult, customersResult, suppliersResult, productsResult] = await Promise.all([
    supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('suppliers').select('*'),
    supabaseClient.from('products').select('*'),
  ]);

  const search = (document.getElementById('paymentSearch')?.value || '').trim().toLowerCase();
  const operationFilter = document.getElementById('paymentOperationFilter')?.value || 'all';
  const list = document.getElementById('paymentsList');
  if (!list) return;

  const customerMap = new Map((customersResult.data || []).map((c) => [c.id, c]));
  const supplierMap = new Map((suppliersResult.data || []).map((s) => [s.id, s]));
  const productMap = new Map((productsResult.data || []).map((p) => [p.id, p]));

  const rows = (invoicesResult.data || [])
    .filter((invoice) => {
      const isPending = Number(invoice.balance || 0) > 0;
      if (!isPending) return false;

      const matchesSearch = !search ||
        (invoice.invoice_number || '').toLowerCase().includes(search) ||
        (getInvoiceOperationId(invoice) || '').toLowerCase().includes(search);

      const operationType = getInvoiceOperationValue(invoice);
      const matchesOperation = operationFilter === 'all' || operationType === operationFilter;

      return matchesSearch && matchesOperation;
    })
    .map((invoice) => {
      const customer = customerMap.get(invoice.customer_id);
      const supplier = supplierMap.get(invoice.supplier_id);
      const product = productMap.get(invoice.product_id);
      const partyName = invoice.type === 'PURCHASE' ? (supplier?.name || 'Proveedor') : (customer?.name || 'Cliente');
      const operationLabel = getInvoiceOperationLabel(invoice);
      const operationId = getInvoiceOperationId(invoice);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || 'Factura',
        operationId,
        operationLabel,
        type: invoice.type,
        partyName,
        productName: product?.name || 'Producto',
        quantity: invoice.quantity ?? 0,
        measure: product?.measure || 'und',
        total: Number(invoice.total || 0),
        paid: Number(invoice.paid_amount || 0),
        balance: Number(invoice.balance || 0),
      };
    });

  list.innerHTML = rows.length
    ? `<li class="debt-header">
        <div>Factura</div>
        <div>Tipo</div>
        <div>Cliente/Proveedor</div>
        <div>Producto</div>
        <div>Cantidad</div>
        <div>Total</div>
        <div>Pagado</div>
        <div>Saldo</div>
        <div>Acciones</div>
      </li>` + rows.map((row) => `
        <li class="debt-row">
          <div class="debt-cell">${row.invoiceNumber}</div>
          <div class="debt-cell">${row.operationLabel}</div>
          <div class="debt-cell">${row.partyName}</div>
          <div class="debt-cell">${row.productName}</div>
          <div class="debt-cell">${row.quantity} ${row.measure}</div>
          <div class="debt-cell debt-amount">${formatMoney(row.total)}</div>
          <div class="debt-cell debt-amount">${formatMoney(row.paid)}</div>
          <div class="debt-cell debt-amount">${formatMoney(row.balance)}</div>
          <div class="debt-cell debt-actions">
            <button class="secondary-action-btn" data-id="${row.id}" data-type="open-payment-total">Pagar</button>
            <button class="secondary-action-btn" data-id="${row.id}" data-type="open-payment-abono">Abonar</button>
          </div>
        </li>
      `).join('')
    : '<li class="empty-item">No hay facturas pendientes por pagar.</li>';
}

async function loadAccountsReceivable() {
  const [invoicesResult, customersResult, productsResult] = await Promise.all([
    supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('products').select('*'),
  ]);

  const receivableSearch = document.getElementById('receivableInvoiceSearch');
  const receivableBody = document.getElementById('accountsReceivableList');
  if (!receivableBody) return;

  const customerMap = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const rows = (invoicesResult.data || [])
    .filter((invoice) => invoice.type === 'SALE' && String(invoice.payment_type || 'TOTAL').toUpperCase() === 'ABONO' && Number(invoice.balance || 0) > 0)
    .map((invoice) => {
      const product = productMap.get(invoice.product_id);
      return {
        id: invoice.id,
        name: customerMap.get(invoice.customer_id)?.name || 'Cliente',
        invoice_number: invoice.invoice_number || 'Factura',
        operation: getInvoiceOperationLabel(invoice),
        productName: product?.name || 'Producto',
        quantity: invoice.quantity ?? 0,
        measure: product?.measure || 'und',
        createdAt: invoice.created_at,
        operation_id: getInvoiceOperationId(invoice),
        balance: Number(invoice.balance || 0),
        search: `${invoice.invoice_number || ''} ${getInvoiceOperationId(invoice) || ''} ${getInvoiceOperationLabel(invoice)}`.toLowerCase(),
      };
    })
    .filter((invoice) => {
      const searchTerm = (receivableSearch?.value || '').trim().toLowerCase();
      return !searchTerm || invoice.search.includes(searchTerm);
    });

  receivableBody.innerHTML = rows.length
    ? `<li class="debt-header">
        <div>Factura</div>
        <div>Tipo</div>
        <div>Cliente</div>
        <div>Producto</div>
        <div>Cantidad</div>
        <div>Fecha</div>
        <div>Saldo</div>
        <div>Acciones</div>
      </li>` + rows.map((row) => `
        <li class="debt-row">
          <div class="debt-cell">${row.invoice_number || '-'}</div>
          <div class="debt-cell">${row.operation || '-'}</div>
          <div class="debt-cell">${row.name}</div>
          <div class="debt-cell">${row.productName}</div>
          <div class="debt-cell">${row.quantity} ${row.measure}</div>
          <div class="debt-cell">${formatDate(row.createdAt)}</div>
          <div class="debt-cell debt-amount">${formatMoney(row.balance)}</div>
          <div class="debt-cell debt-actions">
            <button class="secondary-action-btn" data-id="${row.id}" data-type="view-invoice-payments">Abonos</button>
          </div>
        </li>
      `).join('')
    : '<li class="empty-item">No hay facturas en abono por cobrar.</li>';
}

async function loadAccountsPayable() {
  const [invoicesResult, suppliersResult, productsResult] = await Promise.all([
    supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('suppliers').select('*'),
    supabaseClient.from('products').select('*'),
  ]);

  const payableSearch = document.getElementById('payableInvoiceSearch');
  const payableBody = document.getElementById('accountsPayableList');
  if (!payableBody) return;

  const supplierMap = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier]));
  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const rows = (invoicesResult.data || [])
    .filter((invoice) => invoice.type === 'PURCHASE' && String(invoice.payment_type || 'TOTAL').toUpperCase() === 'ABONO' && Number(invoice.balance || 0) > 0)
    .map((invoice) => {
      const product = productMap.get(invoice.product_id);
      return {
        id: invoice.id,
        name: supplierMap.get(invoice.supplier_id)?.name || 'Proveedor',
        invoice_number: invoice.invoice_number || 'Factura',
        operation: getInvoiceOperationLabel(invoice),
        productName: product?.name || 'Producto',
        quantity: invoice.quantity ?? 0,
        measure: product?.measure || 'und',
        createdAt: invoice.created_at,
        operation_id: getInvoiceOperationId(invoice),
        balance: Number(invoice.balance || 0),
        search: `${invoice.invoice_number || ''} ${getInvoiceOperationId(invoice) || ''} ${getInvoiceOperationLabel(invoice)}`.toLowerCase(),
      };
    })
    .filter((invoice) => {
      const searchTerm = (payableSearch?.value || '').trim().toLowerCase();
      return !searchTerm || invoice.search.includes(searchTerm);
    });

  payableBody.innerHTML = rows.length
    ? `<li class="debt-header">
        <div>Factura</div>
        <div>Tipo</div>
        <div>Proveedor</div>
        <div>Producto</div>
        <div>Cantidad</div>
        <div>Fecha</div>
        <div>Saldo</div>
        <div>Acciones</div>
      </li>` + rows.map((row) => `
        <li class="debt-row">
          <div class="debt-cell">${row.invoice_number || '-'}</div>
          <div class="debt-cell">${row.operation || '-'}</div>
          <div class="debt-cell">${row.name}</div>
          <div class="debt-cell">${row.productName}</div>
          <div class="debt-cell">${row.quantity} ${row.measure}</div>
          <div class="debt-cell">${formatDate(row.createdAt)}</div>
          <div class="debt-cell debt-amount">${formatMoney(row.balance)}</div>
          <div class="debt-cell debt-actions">
            <button class="secondary-action-btn" data-id="${row.id}" data-type="view-invoice-payments">Abonos</button>
          </div>
        </li>
      `).join('')
    : '<li class="empty-item">No hay facturas en abono por pagar.</li>';
}

function fillProductSelects() {
  const productSelect = document.getElementById('invoiceProductId');

  if (productSelect) {
    productSelect.innerHTML = '<option value="">Seleccione</option>';
  }

  return async function refreshProductsList(data = []) {
    if (!productSelect) return;
    const allOptions = data.map((product) => `<option value="${product.id}">${product.name} (${product.measure || 'und'})</option>`).join('');
    productSelect.innerHTML = '<option value="">Seleccione</option>' + allOptions;
  };
}

async function loadProducts() {
  const [productsResult, suppliersResult] = await Promise.all([
    supabaseClient.from('products').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('suppliers').select('*').order('created_at', { ascending: false }),
  ]);

  if (productsResult.error) {
    console.error(productsResult.error);
    return;
  }

  const productSupplierSelect = document.getElementById('productSupplierId');
  if (productSupplierSelect) {
    productSupplierSelect.innerHTML = '<option value="">Sin proveedor</option>' + (suppliersResult.data || []).map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`).join('');
  }

  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '';

  if (!productsResult.data || productsResult.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay productos.</td></tr>';
    return;
  }

  const refreshOptions = fillProductSelects();
  await refreshOptions(productsResult.data);

  productsResult.data.forEach((product) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.name || '-'}</td>
      <td>${product.measure || 'und'}</td>
      <td>${formatMoney(product.purchase_price || 0)}</td>
      <td>${formatMoney(product.sale_price || 0)}</td>
      <td>${product.supplier_id ? (suppliersResult.data || []).find((supplier) => supplier.id === product.supplier_id)?.name || 'Proveedor' : 'Sin proveedor'}</td>
      <td>
        <button class="secondary-action-btn" data-id="${product.id}" data-type="edit-product">Editar</button>
        <button class="action-btn" data-id="${product.id}" data-type="delete-product">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadCustomers() {
  const { data, error } = await supabaseClient.from('customers').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById('customersTableBody');
  tbody.innerHTML = '';

  const customerSelect = document.getElementById('invoiceCustomerId');
  if (customerSelect) {
    customerSelect.innerHTML = '<option value="">Seleccione cliente</option>' + (data || []).map((customer) => `<option value="${customer.id}">${customer.name}</option>`).join('');
  }

  const supplierSelect = document.getElementById('invoiceSupplierId');
  if (supplierSelect) {
    const suppliers = await supabaseClient.from('suppliers').select('*');
    supplierSelect.innerHTML = '<option value="">Seleccione proveedor</option>' + (suppliers.data || []).map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`).join('');
  }

  const invoiceTypeSelect = document.getElementById('invoiceType');
  if (invoiceTypeSelect) {
    const currentType = invoiceTypeSelect.value || 'SALE';
    const isPurchase = currentType === 'PURCHASE';
    if (customerSelect) {
      customerSelect.classList.toggle('hidden', isPurchase);
      customerSelect.disabled = isPurchase;
    }
    if (supplierSelect) {
      supplierSelect.classList.toggle('hidden', !isPurchase);
      supplierSelect.disabled = !isPurchase;
    }
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay clientes.</td></tr>';
    return;
  }

  data.forEach((customer) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${customer.name || '-'}</td>
      <td>${formatMoney(Number(customer.credit_balance || 0))}</td>
      <td>
        <button class="secondary-action-btn" data-id="${customer.id}" data-type="edit-customer">Editar</button>
        <button class="action-btn" data-id="${customer.id}" data-type="delete-customer">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadSuppliers() {
  const { data, error } = await supabaseClient.from('suppliers').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById('suppliersTableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay proveedores.</td></tr>';
    return;
  }

  data.forEach((supplier) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${supplier.name || '-'}</td>
      <td>${formatMoney(Number(supplier.credit_balance || 0))}</td>
      <td>
        <button class="secondary-action-btn" data-id="${supplier.id}" data-type="edit-supplier">Editar</button>
        <button class="action-btn" data-id="${supplier.id}" data-type="delete-supplier">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadUsers() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error leyendo profiles:', error);
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No se pudieron cargar los usuarios.</td></tr>';
    return;
  }

  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay usuarios.</td></tr>';
    return;
  }

  const currentUserRole = state.currentUserProfile?.role || 'VIEWER';

  data.forEach((profile) => {
    const isCurrentUser = profile.id === state.currentUser?.id;
    const isTargetAdmin = isAdminRole(profile.role);
    const canChangePassword = isCurrentUser || (isAdminRole(currentUserRole) && !isTargetAdmin);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${profile.full_name || 'Sin nombre'}</td>
      <td>${profile.email || '-'}</td>
      <td>${profile.role || 'VIEWER'}</td>
      <td>
        <button class="secondary-action-btn" data-id="${profile.id}" data-type="edit-user">Editar</button>
        <button class="secondary-action-btn" data-id="${profile.id}" data-type="reset-user-password" ${canChangePassword ? '' : 'disabled title="No puedes cambiar la contraseña de otro administrador"'}>${canChangePassword ? 'Cambiar clave' : 'Bloqueado'}</button>
        <button class="action-btn" data-id="${profile.id}" data-type="delete-user">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function openModuleHistory(module) {
  const modal = document.getElementById('moduleHistoryModal');
  const title = document.getElementById('moduleHistoryTitle');
  const body = document.getElementById('moduleHistoryBody');

  if (!modal || !title || !body) return;

  title.textContent = 'Historial de facturación';
  body.innerHTML = '<div class="empty-state">Cargando...</div>';
  modal.classList.remove('hidden');

  try {
    const [productsResult, invoicesResult, customersResult, suppliersResult] = await Promise.all([
      supabaseClient.from('products').select('*'),
      supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('customers').select('*'),
      supabaseClient.from('suppliers').select('*'),
    ]);

    const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
    const customerMap = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
    const supplierMap = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier]));

    const rows = (invoicesResult.data || []).map((invoice) => {
      const product = productMap.get(invoice.product_id);
      const typeLabel = getTypeLabel(invoice.type || 'SALE');
      const partyName = invoice.type === 'PURCHASE'
        ? supplierMap.get(invoice.supplier_id)?.name || 'Proveedor'
        : customerMap.get(invoice.customer_id)?.name || 'Cliente';

      const paymentInfo = invoice.payment_type === 'ABONO'
        ? ` | Abono: ${formatMoney(invoice.paid_amount || 0)} | Saldo: ${formatMoney(invoice.balance || 0)}`
        : ` | Pago total: ${formatMoney(invoice.total || 0)}`;

      return `
        <div class="history-modal-item">
          <div class="history-modal-head">
            <strong>${typeLabel} • ${invoice.invoice_number || 'Factura'}</strong>
            <span>${formatDate(invoice.created_at)}</span>
          </div>
          <div class="history-modal-body-text">
            <span>Producto: ${product ? product.name : 'Sin producto'}</span>
            <span>Cliente/Proveedor: ${partyName}</span>
            <span>Cantidad: ${invoice.quantity ?? 0}</span>
            <span>Total: ${formatMoney(invoice.total || 0)}${paymentInfo}</span>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = rows || '<div class="empty-state">No hay facturas registradas.</div>';
  } catch (error) {
    console.error(error);
    body.innerHTML = '<div class="empty-state">No se pudo cargar el historial.</div>';
  }
}

async function generateInvoiceNumber(type = 'SALE', currentInvoiceId = null) {
  const { data, error } = await supabaseClient
    .from('invoices')
    .select('id, invoice_number, type');

  if (error) {
    console.error(error);
    return '0001';
  }

  let highestNumber = 0;

  (data || []).forEach((invoice) => {
    if (currentInvoiceId && invoice.id === currentInvoiceId) return;
    const rawNumber = String(invoice.invoice_number || '').replace(/\D/g, '');
    if (!rawNumber) return;
    const numericValue = Number(rawNumber);
    if (!Number.isNaN(numericValue) && numericValue > highestNumber) {
      highestNumber = numericValue;
    }
  });

  return String(highestNumber + 1).padStart(4, '0');
}

async function syncInvoiceNumber() {
  const invoiceType = document.getElementById('invoiceType')?.value || 'SALE';
  const invoiceNumberField = document.getElementById('invoiceNumber');
  if (!invoiceNumberField) return;

  const nextNumber = await generateInvoiceNumber(invoiceType);
  invoiceNumberField.value = nextNumber;
}

async function loadInvoices() {
  const { data, error } = await supabaseClient
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const invoiceSearch = document.getElementById('invoiceListSearch');
  const operationFilter = document.getElementById('invoiceOperationFilter')?.value || 'all';
  const partyTypeFilter = document.getElementById('invoicePartyTypeFilter')?.value || 'all';
  const partyFilter = document.getElementById('invoicePartyFilter')?.value || '';
  const tbody = document.getElementById('invoicesTableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No hay facturas.</td></tr>';
    return;
  }

  const customers = await supabaseClient.from('customers').select('*');
  const suppliers = await supabaseClient.from('suppliers').select('*');
  const products = await supabaseClient.from('products').select('*');
  const customerMap = new Map((customers.data || []).map((c) => [c.id, c]));
  const supplierMap = new Map((suppliers.data || []).map((s) => [s.id, s]));
  const productMap = new Map((products.data || []).map((p) => [p.id, p]));

  const rows = (data || [])
    .map((invoice) => {
      const customer = customerMap.get(invoice.customer_id);
      const supplier = supplierMap.get(invoice.supplier_id);
      const product = productMap.get(invoice.product_id);
      const type = invoice.type || invoice.kind || 'SALE';
      const partyName = type === 'PURCHASE' ? (supplier ? supplier.name : '-') : (customer ? customer.name : '-');
      const operationLabel = getInvoiceOperationLabel(invoice);
      const operationId = getInvoiceOperationId(invoice);
      const hasAbono = String(invoice.payment_type || '').toUpperCase() === 'ABONO';
      const totalDisplay = formatMoney(Number(invoice.total || 0));
      const paymentTypeLabel = hasAbono ? 'Abono' : 'Total';
      return {
        invoice,
        customer,
        supplier,
        product,
        type,
        partyName,
        operationLabel,
        operationId,
        totalDisplay,
        paymentTypeLabel,
        search: `${invoice.invoice_number || ''} ${invoice.operation_reference || ''} ${operationLabel}`.toLowerCase(),
      };
    })
    .filter((row) => {
      const searchTerm = (invoiceSearch?.value || '').trim().toLowerCase();
      const matchesSearch = !searchTerm || row.search.includes(searchTerm);
      const matchesType = operationFilter === 'all' || row.type === operationFilter;

      let matchesParty = true;
      if (partyTypeFilter === 'CLIENTE') {
        matchesParty = row.type === 'SALE' && row.invoice.customer_id === partyFilter;
      } else if (partyTypeFilter === 'PROVEEDOR') {
        matchesParty = row.type === 'PURCHASE' && row.invoice.supplier_id === partyFilter;
      }

      return matchesSearch && matchesType && matchesParty;
    });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No hay facturas para este filtro.</td></tr>';
    return;
  }

  rows.forEach(({ invoice, partyName, product, operationLabel, totalDisplay, paymentTypeLabel }) => {
    const row = document.createElement('tr');
    const paymentMethodLabel = invoice.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
    row.innerHTML = `
      <td>${invoice.invoice_number || '-'}</td>
      <td>${operationLabel}</td>
      <td>${invoice.operation_reference || '-'}</td>
      <td>${partyName}</td>
      <td>${product ? product.name : '-'}</td>
      <td>${invoice.quantity ?? 0}</td>
      <td>${totalDisplay}</td>
      <td>${paymentTypeLabel}</td>
      <td>${paymentMethodLabel}</td>
      <td>${formatDate(invoice.created_at)}</td>
      <td>
        <button class="secondary-action-btn" data-id="${invoice.id}" data-type="edit-invoice">Editar</button>
        <button class="action-btn" data-id="${invoice.id}" data-type="delete-invoice">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function applyInvoiceAbono(invoiceId, currentTotal, currentPaid, currentBalance, amount) {
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return;

  const remainingBalance = Number(currentBalance || 0);
  const total = Number(currentTotal || 0);
  const isOverpayment = amount > remainingBalance;
  const nextPaid = Number(currentPaid || 0) + amount;
  const nextBalance = Math.max(total - nextPaid, 0);

  const { error } = await supabaseClient
    .from('invoices')
    .update({
      paid_amount: nextPaid,
      balance: nextBalance,
      status: nextBalance > 0 ? 'PENDING' : 'PAID',
    })
    .eq('id', invoiceId);

  if (error) {
    alert(error.message);
    return;
  }

  const { data: invoiceForPayment } = await supabaseClient
    .from('invoices')
    .select('payment_method')
    .eq('id', invoiceId)
    .single();

  await registerInvoicePayment(invoiceId, amount, 'ABONO', invoiceForPayment?.payment_method || 'EFECTIVO');

  if (isOverpayment) {
    const overpayment = amount - remainingBalance;
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('type, customer_id, supplier_id')
      .eq('id', invoiceId)
      .single();

    if (!invoiceError && invoice) {
      const updateTable = invoice.type === 'PURCHASE' ? 'suppliers' : 'customers';
      const updateId = invoice.type === 'PURCHASE' ? invoice.supplier_id : invoice.customer_id;

      if (updateId) {
        const { data: party, error: partyError } = await supabaseClient
          .from(updateTable)
          .select('credit_balance')
          .eq('id', updateId)
          .single();

        if (!partyError && party) {
          const currentCredit = Number(party.credit_balance || 0);
          await supabaseClient
            .from(updateTable)
            .update({ credit_balance: currentCredit + overpayment })
            .eq('id', updateId);
        }
      }
    }
  }

  await recordAudit('add_invoice_abono', 'invoice', invoiceId, {
    previousPaid: Number(currentPaid || 0),
    addedAmount: amount,
    newPaid: nextPaid,
    newBalance: nextBalance,
    overpayment: isOverpayment ? amount - remainingBalance : 0,
  });

  await Promise.all([
    loadInvoices(),
    loadHistory(),
    loadDashboard(),
    loadAccountsReceivable(),
    loadAccountsPayable(),
    loadPayments(),
    loadCustomers(),
    loadSuppliers(),
  ]);
}

let currentPaymentInvoiceId = null;
let currentPaymentMode = 'total';
let currentEditingPaymentId = null;

function openPaymentModal(invoiceId, mode, paymentId = null) {
  currentPaymentInvoiceId = invoiceId;
  currentPaymentMode = mode;
  currentEditingPaymentId = paymentId;

  const modal = document.getElementById('paymentModal');
  const title = document.getElementById('paymentModalTitle');
  const amountInput = document.getElementById('paymentAmount');
  const paymentIdInput = document.getElementById('paymentId');
  if (!modal || !title || !amountInput) return;

  if (paymentId) {
    title.textContent = 'Editar pago';
    const { data: payment, error } = supabaseClient.from('invoice_payments').select('amount').eq('id', paymentId).single();
    if (!error && payment) {
      amountInput.value = formatNumberInput(String(Number(payment.amount || 0)), false);
    }
    if (paymentIdInput) paymentIdInput.value = paymentId;
  } else {
    title.textContent = mode === 'total' ? 'Registrar pago' : 'Registrar abono';
    amountInput.value = '';
    if (paymentIdInput) paymentIdInput.value = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => amountInput.focus(), 50);
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.add('hidden');
  currentPaymentInvoiceId = null;
  currentPaymentMode = 'total';
  currentEditingPaymentId = null;
}

async function submitPaymentForm(event) {
  event.preventDefault();

  const invoiceId = currentPaymentInvoiceId;
  const paymentId = currentEditingPaymentId;
  if (!invoiceId) return;

  const amountInput = document.getElementById('paymentAmount');
  const rawAmount = String(amountInput?.value || '').replace(/\./g, '').replace(',', '.').trim();
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert('El monto debe ser mayor a cero.');
    return;
  }

  const { data: invoice, error } = await supabaseClient.from('invoices').select('*').eq('id', invoiceId).single();
  if (error || !invoice) {
    alert('No se pudo cargar la factura.');
    closePaymentModal();
    return;
  }

  const balance = Number(invoice.balance || 0);
  if (paymentId) {
    const { data: payment, error: paymentError } = await supabaseClient.from('invoice_payments').select('*').eq('id', paymentId).single();
    if (paymentError || !payment) {
      alert('No se pudo cargar el pago.');
      closePaymentModal();
      return;
    }
    const currentPaid = Number(invoice.paid_amount || 0) - Number(payment.amount || 0);
    const nextPaid = currentPaid + amount;
    const nextBalance = Math.max(Number(invoice.total || 0) - nextPaid, 0);

    const { error: updatePaymentError } = await supabaseClient
      .from('invoice_payments')
      .update({ amount })
      .eq('id', paymentId);

    if (updatePaymentError) {
      alert(updatePaymentError.message);
      return;
    }

    const { error: updateInvoiceError } = await supabaseClient
      .from('invoices')
      .update({
        paid_amount: nextPaid,
        balance: nextBalance,
        status: nextBalance > 0 ? 'PENDING' : 'PAID',
      })
      .eq('id', invoiceId);

    if (updateInvoiceError) {
      alert(updateInvoiceError.message);
      return;
    }

    await recordAudit('edit_invoice_payment', 'invoice_payment', paymentId, {
      invoiceId,
      previousAmount: payment.amount,
      newAmount: amount,
    });

    if (amount > Number(invoice.balance || 0)) {
      const overpayment = amount - Number(invoice.balance || 0);
      const updateTable = invoice.type === 'PURCHASE' ? 'suppliers' : 'customers';
      const updateId = invoice.type === 'PURCHASE' ? invoice.supplier_id : invoice.customer_id;

      if (updateId) {
        const { data: party, error: partyError } = await supabaseClient
          .from(updateTable)
          .select('credit_balance')
          .eq('id', updateId)
          .single();

        if (!partyError && party) {
          const currentCredit = Number(party.credit_balance || 0);
          await supabaseClient
            .from(updateTable)
            .update({ credit_balance: currentCredit + overpayment })
            .eq('id', updateId);
        }
      }
    }
  } else {
    if (currentPaymentMode === 'total') {
      await applyTotalPayment(invoiceId, amount);
    } else {
      await applyInvoiceAbono(invoiceId, Number(invoice.total || 0), Number(invoice.paid_amount || 0), Number(invoice.balance || 0), amount);
    }
  }

  closePaymentModal();
}

async function applyTotalPayment(invoiceId, amount) {
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return;

  const { data: invoice, error } = await supabaseClient.from('invoices').select('*').eq('id', invoiceId).single();
  if (error || !invoice) {
    alert('No se pudo cargar la factura.');
    return;
  }

  const balance = Number(invoice.balance || 0);
  const total = Number(invoice.total || 0);
  const isFullPayment = amount >= balance;
  const nextPaid = Number(invoice.paid_amount || 0) + amount;
  const nextBalance = Math.max(total - nextPaid, 0);

  const updatePayload = {
    paid_amount: nextPaid,
    balance: nextBalance,
    status: nextBalance > 0 ? 'PENDING' : 'PAID',
  };

  if (isFullPayment) {
    updatePayload.payment_type = 'TOTAL';
  }

  const { error: updateError } = await supabaseClient
    .from('invoices')
    .update(updatePayload)
    .eq('id', invoiceId);

  if (updateError) {
    alert(updateError.message);
    return;
  }

  await registerInvoicePayment(invoiceId, amount, isFullPayment ? 'TOTAL' : 'ABONO', invoice.payment_method || 'EFECTIVO');

  if (isFullPayment && amount > balance) {
    const overpayment = amount - balance;
    const updateTable = invoice.type === 'PURCHASE' ? 'suppliers' : 'customers';
    const updateId = invoice.type === 'PURCHASE' ? invoice.supplier_id : invoice.customer_id;

    if (updateId) {
      const { data: party, error: partyError } = await supabaseClient
        .from(updateTable)
        .select('credit_balance')
        .eq('id', updateId)
        .single();

      if (!partyError && party) {
        const currentCredit = Number(party.credit_balance || 0);
        await supabaseClient
          .from(updateTable)
          .update({ credit_balance: currentCredit + overpayment })
          .eq('id', updateId);
      }
    }
  }

  await recordAudit(isFullPayment ? 'pay_invoice_total' : 'add_invoice_abono', 'invoice', invoiceId, {
    previousPaid: Number(invoice.paid_amount || 0),
    amount,
    newPaid: nextPaid,
    newBalance: nextBalance,
    overpayment: isFullPayment ? Math.max(amount - balance, 0) : 0,
  });

  await Promise.all([
    loadInvoices(),
    loadHistory(),
    loadDashboard(),
    loadAccountsReceivable(),
    loadAccountsPayable(),
    loadPayments(),
    loadCustomers(),
    loadSuppliers(),
  ]);
}

async function editInvoicePayment(paymentId) {
  if (!paymentId) return;

  const { data: payment, error: paymentError } = await supabaseClient
    .from('invoice_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    alert('No se pudo cargar el pago.');
    return;
  }

  const { data: invoice, error: invoiceError } = await supabaseClient
    .from('invoices')
    .select('*')
    .eq('id', payment.invoice_id)
    .single();

  if (invoiceError || !invoice) {
    alert('No se pudo cargar la factura asociada.');
    return;
  }

  const newAmountPrompt = window.prompt(`Editar monto del pago (actual: ${formatMoney(payment.amount || 0)}):`, formatMoney(payment.amount || 0));
  if (newAmountPrompt === null) return;

  const newAmount = Number(String(newAmountPrompt).replace(/\./g, '').replace(',', '.').trim());
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    alert('El monto debe ser mayor a cero.');
    return;
  }

  const total = Number(invoice.total || 0);
  const currentPaid = Number(invoice.paid_amount || 0) - Number(payment.amount || 0);
  const nextPaid = currentPaid + newAmount;
  const nextBalance = Math.max(total - nextPaid, 0);

  const { error: updatePaymentError } = await supabaseClient
    .from('invoice_payments')
    .update({ amount: newAmount })
    .eq('id', paymentId);

  if (updatePaymentError) {
    alert(updatePaymentError.message);
    return;
  }

  const { error: updateInvoiceError } = await supabaseClient
    .from('invoices')
    .update({
      paid_amount: nextPaid,
      balance: nextBalance,
      status: nextBalance > 0 ? 'PENDING' : 'PAID',
    })
    .eq('id', payment.invoice_id);

  if (updateInvoiceError) {
    alert(updateInvoiceError.message);
    return;
  }

  await recordAudit('edit_invoice_payment', 'invoice_payment', paymentId, {
    invoiceId: payment.invoice_id,
    previousAmount: payment.amount,
    newAmount,
  });

  await Promise.all([
    loadInvoices(),
    loadHistory(),
    loadDashboard(),
    loadAccountsReceivable(),
    loadAccountsPayable(),
    loadPayments(),
  ]);
}

async function deleteInvoicePayment(paymentId) {
  if (!paymentId) return;

  const { data: payment, error: paymentError } = await supabaseClient
    .from('invoice_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    alert('No se pudo cargar el pago.');
    return;
  }

  const { data: invoice, error: invoiceError } = await supabaseClient
    .from('invoices')
    .select('*')
    .eq('id', payment.invoice_id)
    .single();

  if (invoiceError || !invoice) {
    alert('No se pudo cargar la factura asociada.');
    return;
  }

  const total = Number(invoice.total || 0);
  const currentPaid = Number(invoice.paid_amount || 0) - Number(payment.amount || 0);
  const nextBalance = Math.max(total - currentPaid, 0);

  const { error: deletePaymentError } = await supabaseClient
    .from('invoice_payments')
    .delete()
    .eq('id', paymentId);

  if (deletePaymentError) {
    alert(deletePaymentError.message);
    return;
  }

  const { error: updateInvoiceError } = await supabaseClient
    .from('invoices')
    .update({
      paid_amount: currentPaid,
      balance: nextBalance,
      status: nextBalance > 0 ? 'PENDING' : 'PAID',
    })
    .eq('id', payment.invoice_id);

  if (updateInvoiceError) {
    alert(updateInvoiceError.message);
    return;
  }

  await recordAudit('delete_invoice_payment', 'invoice_payment', paymentId, {
    invoiceId: payment.invoice_id,
    deletedAmount: payment.amount,
  });

  await Promise.all([
    loadInvoices(),
    loadHistory(),
    loadDashboard(),
    loadAccountsReceivable(),
    loadAccountsPayable(),
    loadPayments(),
  ]);
}

async function loadHistory() {
  const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
  const paymentFilter = document.getElementById('historyPaymentFilter')?.value || 'all';

  const [invoicesResult, paymentsResult, productsResult, customersResult, suppliersResult] = await Promise.all([
    supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('invoice_payments').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('products').select('*'),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('suppliers').select('*'),
  ]);

  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const customerMap = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const supplierMap = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier]));
  const invoiceMap = new Map((invoicesResult.data || []).map((invoice) => [invoice.id, invoice]));

  const generalBody = document.getElementById('historyGeneralBody');
  const personalBody = document.getElementById('historyPersonalBody');
  generalBody.innerHTML = '';
  personalBody.innerHTML = '';

  const rows = [];

  const paidInvoiceIds = new Set((paymentsResult.data || []).map((payment) => payment.invoice_id));

  (paymentsResult.data || []).forEach((payment) => {
    const invoice = invoiceMap.get(payment.invoice_id);
    if (!invoice) return;

    const product = productMap.get(invoice.product_id);
    const partyName = invoice.type === 'PURCHASE'
      ? supplierMap.get(invoice.supplier_id)?.name || 'Proveedor'
      : customerMap.get(invoice.customer_id)?.name || 'Cliente';

    const paymentType = String(payment.payment_type || 'ABONO').toUpperCase();
    const operationType = getInvoiceOperationValue(invoice);
    const operationLabel = getInvoiceOperationLabel(invoice);
    const totalValue = Number(payment.amount || 0);

    const detailLabel = paymentType === 'TOTAL' ? 'Pago neto' : 'Abono';

    rows.push({
      source: 'payment',
      created_at: payment.created_at || invoice.created_at,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || '-',
      operationType: invoice.type || 'SALE',
      operationLabel: paymentType === 'TOTAL' ? 'Pago neto' : 'Abono',
      paymentType,
      paymentId: payment.id,
      product: product ? product.name : 'Producto',
      quantity: `${invoice.quantity ?? 0} ${product?.measure || 'und'}`,
      total: formatMoney(totalValue),
      detail: `${invoice.type === 'PURCHASE' ? 'Compra' : 'Venta'} ${partyName} • ${formatMoney(payment.amount || 0)}`,
      badgeClass: paymentType === 'TOTAL' ? 'history-badge-purchase' : 'history-badge-sale',
    });
  });

  (invoicesResult.data || []).forEach((invoice) => {
    if (paidInvoiceIds.has(invoice.id)) return;

    const product = productMap.get(invoice.product_id);
    const partyName = invoice.type === 'PURCHASE'
      ? supplierMap.get(invoice.supplier_id)?.name || 'Proveedor'
      : customerMap.get(invoice.customer_id)?.name || 'Cliente';

    const operationType = getInvoiceOperationValue(invoice);
    const operationLabel = getInvoiceOperationLabel(invoice);
    const totalValue = Number(invoice.total || 0);

    rows.push({
      source: 'invoice',
      created_at: invoice.created_at,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || '-',
      operationType: invoice.type || 'SALE',
      operationLabel: 'Pendiente',
      paymentType: 'PENDIENTE',
      product: product ? product.name : 'Producto',
      quantity: `${invoice.quantity ?? 0} ${product?.measure || 'und'}`,
      total: formatMoney(totalValue),
      detail: `Factura ${invoice.type === 'PURCHASE' ? 'de compra' : 'de venta'} ${partyName} • Pendiente`,
      badgeClass: 'history-badge-sale',
    });
  });

  const filteredRows = rows.filter((row) => {
    const typeMatches = typeFilter === 'all' || row.operationType === typeFilter;
    const paymentMatches = paymentFilter === 'all' || row.paymentType === paymentFilter;
    return typeMatches && paymentMatches;
  });

  filteredRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filteredRows.length === 0) {
    const emptyMessage = 'No hay facturas para este filtro.';
    generalBody.innerHTML = `<tr><td colspan="8" class="empty-state">${emptyMessage}</td></tr>`;
    personalBody.innerHTML = `<tr><td colspan="8" class="empty-state">${emptyMessage}</td></tr>`;
    return;
  }

  filteredRows.forEach((row) => {
    const isPayment = row.source === 'payment';
    const hasInvoiceId = !!row.invoiceId;

    const generalRow = document.createElement('tr');
    if (hasInvoiceId) {
      generalRow.setAttribute('data-invoice-id', row.invoiceId);
      generalRow.style.cursor = 'pointer';
    }
    generalRow.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td>${row.invoiceNumber || '-'}</td>
      <td><span class="history-badge ${row.badgeClass}">${row.operationLabel}</span></td>
      <td>${row.product}</td>
      <td>${row.quantity}</td>
      <td>${row.total}</td>
      <td>${row.detail}</td>
      <td>${isPayment ? `<button class="secondary-action-btn" data-id="${row.paymentId}" data-type="edit-invoice-payment">Editar</button><button class="action-btn" data-id="${row.paymentId}" data-type="delete-invoice-payment">Eliminar</button>` : '-'}</td>
    `;
    generalBody.appendChild(generalRow);

    const personalRow = document.createElement('tr');
    if (hasInvoiceId) {
      personalRow.setAttribute('data-invoice-id', row.invoiceId);
      personalRow.style.cursor = 'pointer';
    }
    personalRow.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td>${row.invoiceNumber || '-'}</td>
      <td><span class="history-badge ${row.badgeClass}">${row.operationLabel}</span></td>
      <td>${row.product}</td>
      <td>${row.quantity}</td>
      <td>${row.total}</td>
      <td>${row.detail}</td>
      <td>${isPayment ? `<button class="secondary-action-btn" data-id="${row.paymentId}" data-type="edit-invoice-payment">Editar</button><button class="action-btn" data-id="${row.paymentId}" data-type="delete-invoice-payment">Eliminar</button>` : '-'}</td>
    `;
    personalBody.appendChild(personalRow);
  });
}

async function loadAllModules() {
  await Promise.all([
    loadDashboard(),
    loadAccountsReceivable(),
    loadAccountsPayable(),
    loadPayments(),
    loadProducts(),
    loadCustomers(),
    loadSuppliers(),
    loadInvoices(),
    loadUsers(),
    loadHistory(),
  ]);
}

async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const nameField = getFormField(form, 'productName', 'productName');
  const purchaseField = getFormField(form, 'productPurchasePrice', 'productPurchasePrice');
  const saleField = getFormField(form, 'productSalePrice', 'productSalePrice');
  const measureField = getFormField(form, 'productMeasure', 'productMeasure');
  const supplierField = getFormField(form, 'productSupplierId', 'productSupplierId');

  const payload = {
    name: nameField?.value.trim(),
    purchase_price: parseFormattedNumber(purchaseField?.value),
    sale_price: parseFormattedNumber(saleField?.value),
    measure: measureField?.value.trim() || 'und',
    supplier_id: supplierField?.value || null,
  };

  let result;
  if (id) {
    result = await supabaseClient.from('products').update(payload).eq('id', id);
    await recordAudit('update_product', 'product', id, payload);
  } else {
    result = await supabaseClient.from('products').insert([payload]);
    if (result.data && result.data[0]) {
      await recordAudit('create_product', 'product', result.data[0].id, payload);
    }
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  resetFormState(form);
  delete form.dataset.editingId;
  if (form.id !== 'productForm') {
    closeEditModal();
  } else {
    document.getElementById('productSubmitBtn').textContent = 'Guardar';
  }
  await loadAllModules();
}

async function saveCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const nameField = getFormField(form, 'customerName', 'customerName');
  const payload = {
    name: nameField?.value.trim(),
  };

  let result;
  if (id) {
    result = await supabaseClient.from('customers').update(payload).eq('id', id);
    await recordAudit('update_customer', 'customer', id, payload);
  } else {
    result = await supabaseClient.from('customers').insert([payload]);
    if (result.data && result.data[0]) {
      await recordAudit('create_customer', 'customer', result.data[0].id, payload);
    }
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  resetFormState(form);
  delete form.dataset.editingId;
  if (form.id !== 'customerForm') {
    closeEditModal();
  } else {
    document.getElementById('customerSubmitBtn').textContent = 'Guardar';
  }
  await loadAllModules();
}

async function saveSupplier(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const nameField = getFormField(form, 'supplierName', 'supplierName');
  const payload = {
    name: nameField?.value.trim(),
  };

  let result;
  if (id) {
    result = await supabaseClient.from('suppliers').update(payload).eq('id', id);
    await recordAudit('update_supplier', 'supplier', id, payload);
  } else {
    result = await supabaseClient.from('suppliers').insert([payload]);
    if (result.data && result.data[0]) {
      await recordAudit('create_supplier', 'supplier', result.data[0].id, payload);
    }
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  resetFormState(form);
  delete form.dataset.editingId;
  if (form.id !== 'supplierForm') {
    closeEditModal();
  } else {
    document.getElementById('supplierSubmitBtn').textContent = 'Guardar';
  }
  await loadAllModules();
}

async function saveInventoryMovement(event) {
  event.preventDefault();
  const form = event.currentTarget || document.getElementById('inventoryForm');

  const payload = {
    product_id: document.getElementById('inventoryProductId').value,
    type: document.getElementById('inventoryType').value,
    quantity: parseFormattedNumber(document.getElementById('inventoryQty').value),
    measure: document.getElementById('inventoryMeasure').value.trim() || 'und',
    note: document.getElementById('inventoryNote').value.trim(),
  };

  if (!payload.product_id) {
    alert('Debe seleccionar un producto.');
    return;
  }

  if (payload.quantity <= 0) {
    alert('La cantidad debe ser mayor a cero.');
    return;
  }

  const { error: movementError } = await supabaseClient.from('inventory_movements').insert([payload]);
  if (movementError) {
    alert(movementError.message);
    return;
  }

  await recordAudit('inventory_move', 'inventory_movement', payload.product_id, payload);
  if (form) {
    resetFormState(form);
  }
  await loadAllModules();
}

async function saveInvoice(event) {
  event.preventDefault();

  const form = event?.currentTarget || document.getElementById('invoiceForm');
  const editingInvoiceId = form.dataset.editingInvoiceId || null;
  const typeField = getFormField(form, 'invoiceType', 'invoiceType');
  const customerField = getFormField(form, 'invoiceCustomerId', 'invoiceCustomerId');
  const supplierField = getFormField(form, 'invoiceSupplierId', 'invoiceSupplierId');
  const numberField = getFormField(form, 'invoiceNumber', 'invoiceNumber');
  const productField = getFormField(form, 'invoiceProductId', 'invoiceProductId');
  const qtyField = getFormField(form, 'invoiceQty', 'invoiceQty');
  const priceField = getFormField(form, 'invoicePrice', 'invoicePrice');
  const paymentTypeField = getFormField(form, 'invoicePaymentType', 'invoicePaymentType');
  const paymentMethodField = getFormField(form, 'invoicePaymentMethod', 'invoicePaymentMethod');
  const operationReferenceField = getFormField(form, 'invoiceOperationReference', 'invoiceOperationReference');
  const initialPaymentField = getFormField(form, 'invoiceInitialPayment', 'invoiceInitialPayment');
  const noteField = getFormField(form, 'invoiceNote', 'invoiceNote');

  const type = typeField?.value || 'SALE';
  const customerId = customerField?.value || '';
  const supplierId = supplierField?.value || '';
  let invoiceNumber = numberField?.value.trim() || '';
  if (!invoiceNumber) {
    invoiceNumber = await generateInvoiceNumber(type, editingInvoiceId || null);
    if (numberField) numberField.value = invoiceNumber;
  }

  if (invoiceNumber) {
    const { data: existingInvoiceByNumber, error: duplicateCheckError } = await supabaseClient
      .from('invoices')
      .select('id, invoice_number')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (!duplicateCheckError && existingInvoiceByNumber && existingInvoiceByNumber.id !== editingInvoiceId) {
      invoiceNumber = await generateInvoiceNumber(type, editingInvoiceId || null);
      if (numberField) numberField.value = invoiceNumber;
    }
  }
  const productId = productField?.value || '';
  const quantity = parseFormattedNumber(qtyField?.value);
  const price = parseFormattedNumber(priceField?.value);
  const paymentType = paymentTypeField?.value || 'TOTAL';
  const paymentMethod = paymentMethodField?.value || 'EFECTIVO';
  const operationReference = (operationReferenceField?.value || '').trim();
  const initialPaymentAmount = parseFormattedNumber(initialPaymentField?.value);
  const note = noteField?.value.trim() || '';

  const partyId = type === 'PURCHASE' ? supplierId : customerId;

  if (!partyId || !invoiceNumber || !productId) {
    alert(type === 'PURCHASE' ? 'Debe completar proveedor, factura y producto.' : 'Debe completar cliente, factura y producto.');
    return;
  }

  const { data: partyData, error: partyError } = await supabaseClient
    .from(type === 'PURCHASE' ? 'suppliers' : 'customers')
    .select('credit_balance')
    .eq('id', partyId)
    .single();

  const availableCredit = Number(partyData?.credit_balance || 0);

  if (quantity <= 0 || price <= 0) {
    alert('La cantidad y el precio deben ser mayores a cero.');
    return;
  }

  const { data: productData, error: productError } = await supabaseClient
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (productError || !productData) {
    alert('No se pudo cargar el producto seleccionado.');
    return;
  }

  const productPrice = Number(price || (type === 'SALE' ? productData.sale_price : productData.purchase_price) || 0);
  const total = quantity * productPrice;
  const normalizedPaymentType = paymentType === 'ABONO' ? 'ABONO' : 'TOTAL';

  let finalPaidAmount = 0;
  let finalBalance = total;
  let creditUsed = 0;

  if (editingInvoiceId) {
    const { data: existingInvoice, error: existingError } = await supabaseClient.from('invoices').select('*').eq('id', editingInvoiceId).single();
    if (existingError || !existingInvoice) {
      alert('No se pudo cargar la factura a editar.');
      return;
    }

    const currentPaid = Number(existingInvoice.paid_amount || 0);
    finalPaidAmount = Math.min(Math.max(currentPaid, 0), total);
    finalBalance = Math.max(total - finalPaidAmount, 0);
  } else {
    const useCreditCheckbox = getFormField(form, 'invoiceUseCreditBalance', 'invoiceUseCreditBalance');
    const creditApplied = useCreditCheckbox && useCreditCheckbox.checked && availableCredit > 0;

    if (normalizedPaymentType === 'ABONO') {
      const maxAllowedAbono = total + availableCredit;
      if (initialPaymentAmount > maxAllowedAbono) {
        alert(`El abono inicial no puede superar el total de la factura más el saldo a favor disponible (${formatMoney(maxAllowedAbono)}).`);
        return;
      }

      if (creditApplied) {
        creditUsed = Math.min(initialPaymentAmount, availableCredit);
      } else {
        const creditToUse = Math.max(initialPaymentAmount - total, 0);
        creditUsed = Math.min(creditToUse, availableCredit);
      }
      finalPaidAmount = initialPaymentAmount;
      finalBalance = Math.max(total - initialPaymentAmount, 0);
    } else if (creditApplied) {
      creditUsed = Math.min(availableCredit, total);
      finalPaidAmount = creditUsed;
      finalBalance = Math.max(total - creditUsed, 0);
    } else {
      finalPaidAmount = 0;
      finalBalance = total;
    }
  }

  const payload = {
    type,
    customer_id: type === 'SALE' ? customerId : null,
    supplier_id: type === 'PURCHASE' ? supplierId : null,
    invoice_number: invoiceNumber,
    product_id: productId,
    quantity,
    unit_price: productPrice,
    total,
    payment_type: normalizedPaymentType,
    payment_method: paymentMethod,
    operation_type: type,
    operation_reference: operationReference || null,
    paid_amount: finalPaidAmount,
    balance: finalBalance,
    status: finalBalance > 0 ? 'PENDING' : 'PAID',
    note,
  };

  let result;
  if (editingInvoiceId) {
    result = await supabaseClient.from('invoices').update(payload).eq('id', editingInvoiceId).select();
  } else {
    result = await supabaseClient.from('invoices').insert([payload]).select();
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  const invoiceResult = result.data && result.data[0] ? result.data[0] : null;
  if (invoiceResult) {
    if (!editingInvoiceId && normalizedPaymentType === 'ABONO' && initialPaymentAmount > 0) {
      await registerInvoicePayment(invoiceResult.id, initialPaymentAmount, 'ABONO', paymentMethod);
    }

    if (!editingInvoiceId && creditUsed > 0 && normalizedPaymentType === 'TOTAL') {
      await registerInvoicePayment(invoiceResult.id, creditUsed, 'TOTAL', paymentMethod);
    }

    if (!editingInvoiceId && creditUsed > 0) {
      const updateTable = type === 'PURCHASE' ? 'suppliers' : 'customers';
      const updateId = type === 'PURCHASE' ? supplierId : customerId;

      if (updateId) {
        const { data: party, error: partyError } = await supabaseClient
          .from(updateTable)
          .select('credit_balance')
          .eq('id', updateId)
          .single();

        if (!partyError && party) {
          const currentCredit = Number(party.credit_balance || 0);
          await supabaseClient
            .from(updateTable)
            .update({ credit_balance: Math.max(currentCredit - creditUsed, 0) })
            .eq('id', updateId);
        }
      }
    }

    await recordAudit(editingInvoiceId ? 'update_invoice' : 'create_invoice', 'invoice', invoiceResult.id, { customerId, supplierId, invoiceNumber, total, type, paymentType: normalizedPaymentType, paymentMethod, paidAmount: finalPaidAmount, balance: finalBalance, initialPaymentAmount, creditUsed });
  }

  if (form) {
    resetFormState(form);
  }
  if (form) {
    delete form.dataset.editingInvoiceId;
  }
  const submitButton = form?.querySelector('button[type="submit"]');
  if (submitButton && form.id === 'invoiceForm') {
    submitButton.textContent = 'Crear factura';
  }
  if (form.id !== 'invoiceForm') {
    closeEditModal();
  }
  await loadAllModules();
}

async function saveUser(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const nameField = getFormField(form, 'userName', 'userName');
  const emailField = getFormField(form, 'userEmail', 'userEmail');
  const passwordField = getFormField(form, 'adminUserPassword', 'adminUserPassword');
  const roleField = getFormField(form, 'userRole', 'userRole');

  const name = nameField?.value.trim();
  const email = emailField?.value.trim();
  const password = passwordField?.value || '';
  const role = roleField?.value || 'VIEWER';

  if (!name || !email) {
    alert('Debes completar nombre y email.');
    return;
  }

  if (!id && !password) {
    alert('Debes ingresar una contraseña para crear el usuario.');
    return;
  }

  if (id) {
    const { data: targetProfile, error: targetProfileError } = await supabaseClient.from('profiles').select('role').eq('id', id).single();
    if (targetProfileError) {
      alert('No se pudo validar el rol del usuario: ' + targetProfileError.message);
      return;
    }

    const currentUserRole = state.currentUserProfile?.role || 'VIEWER';
    const isCurrentUser = id === state.currentUser?.id;
    const isTargetAdmin = isAdminRole(targetProfile?.role);
    const isAdminChangingOtherAdmin = isAdminRole(currentUserRole) && !isCurrentUser && isTargetAdmin;

    if (isAdminChangingOtherAdmin) {
      alert('Un administrador no puede cambiar la contraseña de otro administrador.');
      return;
    }

    const { error: profileError } = await supabaseClient.from('profiles').update({ full_name: name, email, role }).eq('id', id);
    if (profileError) {
      alert(profileError.message);
      return;
    }

    if (password) {
      try {
        if (id === state.currentUser?.id) {
          const { error: authError } = await supabaseClient.auth.updateUser({ password });
          if (authError) {
            alert('La información del usuario se actualizó, pero la contraseña no pudo cambiarse: ' + authError.message);
            return;
          }
        } else {
          if (!isAdminRole(currentUserRole)) {
            alert('Solo un administrador puede cambiar la contraseña de otro usuario.');
            return;
          }

          alert('Para cambiar la clave de otro usuario, debes hacerlo desde un backend seguro con service_role. En la app solo se bloquea la edición de otros administradores.');
          return;
        }
      } catch (error) {
        alert('No se pudo actualizar la contraseña desde esta sesión: ' + (error?.message || 'Error desconocido'));
        return;
      }
    }

    await recordAudit('update_profile', 'profile', id, { full_name: name, email, role, passwordChanged: Boolean(password) });
    resetFormState(form);
    delete form.dataset.editingId;
    if (form.id !== 'userForm') {
      closeEditModal();
    } else {
      document.getElementById('userSubmitBtn').textContent = 'Guardar';
      document.getElementById('adminUserPassword').required = true;
    }
    await loadAllModules();
    return;
  }

  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  if (authError) {
    alert('No se pudo crear el usuario en Auth: ' + authError.message);
    return;
  }

  if (!authData.user) {
    alert('No se obtuvo el usuario creado en Auth.');
    return;
  }

  const { error: profileError } = await supabaseClient.from('profiles').upsert({ id: authData.user.id, full_name: name, email, role }, { onConflict: 'id' });
  if (profileError) {
    alert('El usuario se creó en Auth, pero falló el perfil: ' + profileError.message);
    return;
  }

  await recordAudit('create_user', 'profile', authData.user.id, { name, email, role });
  resetFormState(form);
  await loadAllModules();
}

async function resetPasswordForUser(userId) {
  if (!userId) {
    alert('No hay usuario seleccionado para cambiar la clave.');
    return;
  }

  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) {
    alert('No se pudo cargar el usuario para cambiar la contraseña.');
    return;
  }

  const currentUserRole = state.currentUserProfile?.role || 'VIEWER';

  if (isAdminRole(data.role) && userId !== state.currentUser?.id && isAdminRole(currentUserRole)) {
    alert('No puedes cambiar la contraseña de otro administrador.');
    return;
  }

  if (userId !== state.currentUser?.id && !isAdminRole(currentUserRole)) {
    alert('Solo un administrador puede cambiar la contraseña de otro usuario.');
    return;
  }

  document.getElementById('userName').value = data.full_name || '';
  document.getElementById('userEmail').value = data.email || '';
  document.getElementById('userRole').value = data.role || 'VIEWER';
  document.getElementById('userForm').dataset.editingId = userId;
  document.getElementById('userSubmitBtn').textContent = 'Guardar nueva contraseña';
  document.getElementById('adminUserPassword').value = '';
  document.getElementById('adminUserPassword').required = true;
  document.getElementById('adminUserPassword').focus();
  await setActiveView('users');
  document.getElementById('userForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteRecord(type, id) {
  const map = {
    'delete-product': 'products',
    'delete-customer': 'customers',
    'delete-supplier': 'suppliers',
    'delete-user': 'profiles',
    'delete-invoice': 'invoices',
  };

  const table = map[type];
  if (!table) return;

  if (type === 'delete-invoice') {
    await supabaseClient.from('invoice_payments').delete().eq('invoice_id', id);
  }

  const { error } = await supabaseClient.from(table).delete().eq('id', id);
  if (error) {
    alert(error.message);
    return;
  }

  await recordAudit('delete_record', table, id, { type });
  await loadAllModules();
}

function renderEditModal(title, html) {
  const modal = document.getElementById('recordEditModal');
  const titleNode = document.getElementById('recordEditTitle');
  const body = document.getElementById('recordEditBody');
  if (!modal || !titleNode || !body) return;

  titleNode.textContent = title;
  body.innerHTML = html;
  modal.classList.remove('hidden');
}

async function startEditProduct(id) {
  const { data, error } = await supabaseClient.from('products').select('*').eq('id', id).single();
  if (error || !data) return;

  const productSupplierOptions = await supabaseClient.from('suppliers').select('*');
  const supplierOptionsHtml = (productSupplierOptions.data || []).map((supplier) => `<option value="${supplier.id}" ${supplier.id === data.supplier_id ? 'selected' : ''}>${supplier.name}</option>`).join('');

  renderEditModal('Editar producto', `
    <form id="editProductForm" class="edit-form" data-editing-id="${id}">
      <div class="row-form">
        <label>
          <span>Nombre del producto</span>
          <input type="text" id="productName" value="${(data.name || '').replace(/"/g, '&quot;')}" required />
        </label>
        <label>
          <span>Precio de compra</span>
          <input type="text" id="productPurchasePrice" value="${formatNumberInput(String(Number(data.purchase_price || 0)), false)}" required />
        </label>
        <label>
          <span>Precio de venta</span>
          <input type="text" id="productSalePrice" value="${formatNumberInput(String(Number(data.sale_price || 0)), false)}" required />
        </label>
        <label>
          <span>Medida</span>
          <input type="text" id="productMeasure" value="${(data.measure || 'und').replace(/"/g, '&quot;')}" required />
        </label>
        <label>
          <span>Proveedor</span>
          <select id="productSupplierId">
            <option value="">Sin proveedor</option>
            ${supplierOptionsHtml}
          </select>
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="primary-btn">Guardar cambios</button>
      </div>
    </form>
  `);

  const form = document.getElementById('editProductForm');
  form?.addEventListener('submit', saveProduct);
  applyFormattedNumberListener('productPurchasePrice', false, form);
  applyFormattedNumberListener('productSalePrice', false, form);
}

async function startEditCustomer(id) {
  const { data, error } = await supabaseClient.from('customers').select('*').eq('id', id).single();
  if (error || !data) return;

  renderEditModal('Editar cliente', `
    <form id="editCustomerForm" class="edit-form" data-editing-id="${id}">
      <div class="row-form">
        <label>
          <span>Nombre del cliente</span>
          <input type="text" id="customerName" value="${(data.name || '').replace(/"/g, '&quot;')}" required />
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="primary-btn">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('editCustomerForm')?.addEventListener('submit', saveCustomer);
}

async function startEditSupplier(id) {
  const { data, error } = await supabaseClient.from('suppliers').select('*').eq('id', id).single();
  if (error || !data) return;

  renderEditModal('Editar proveedor', `
    <form id="editSupplierForm" class="edit-form" data-editing-id="${id}">
      <div class="row-form">
        <label>
          <span>Nombre del proveedor</span>
          <input type="text" id="supplierName" value="${(data.name || '').replace(/"/g, '&quot;')}" required />
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="primary-btn">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('editSupplierForm')?.addEventListener('submit', saveSupplier);
}

async function startEditUser(id) {
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
  if (error || !data) return;

  renderEditModal('Editar usuario', `
    <form id="editUserForm" class="edit-form" data-editing-id="${id}">
      <div class="row-form">
        <label>
          <span>Nombre completo</span>
          <input type="text" id="userName" value="${(data.full_name || '').replace(/"/g, '&quot;')}" required />
        </label>
        <label>
          <span>Email</span>
          <input type="email" id="userEmail" value="${(data.email || '').replace(/"/g, '&quot;')}" required />
        </label>
        <label>
          <span>Nueva contraseña</span>
          <input type="password" id="adminUserPassword" placeholder="Opcional" />
        </label>
        <label>
          <span>Rol</span>
          <select id="userRole">
            <option value="ADMIN" ${data.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            <option value="OPERATIVE" ${data.role === 'OPERATIVE' ? 'selected' : ''}>OPERATIVE</option>
            <option value="VIEWER" ${data.role === 'VIEWER' ? 'selected' : ''}>VIEWER</option>
          </select>
        </label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="primary-btn">Guardar cambios</button>
      </div>
    </form>
  `);

  document.getElementById('editUserForm')?.addEventListener('submit', saveUser);
}

async function startEditInvoice(id) {
  const { data, error } = await supabaseClient.from('invoices').select('*').eq('id', id).single();
  if (error || !data) return;

  const customers = await supabaseClient.from('customers').select('*');
  const suppliers = await supabaseClient.from('suppliers').select('*');
  const products = await supabaseClient.from('products').select('*');

  const customerOptions = (customers.data || []).map((customer) => `<option value="${customer.id}" ${customer.id === data.customer_id ? 'selected' : ''}>${customer.name}</option>`).join('');
  const supplierOptions = (suppliers.data || []).map((supplier) => `<option value="${supplier.id}" ${supplier.id === data.supplier_id ? 'selected' : ''}>${supplier.name}</option>`).join('');
  const productOptions = (products.data || []).map((product) => `<option value="${product.id}" ${product.id === data.product_id ? 'selected' : ''}>${product.name}</option>`).join('');
  const isPurchase = (data.type || 'SALE') === 'PURCHASE';

  renderEditModal('Editar factura', `
    <form id="editInvoiceForm" class="edit-form" data-editing-invoice-id="${id}">
      <div class="row-form">
        <label>
          <span>Tipo de documento</span>
          <select id="invoiceType">
            <option value="SALE" ${data.type === 'SALE' ? 'selected' : ''}>Venta</option>
            <option value="PURCHASE" ${data.type === 'PURCHASE' ? 'selected' : ''}>Compra</option>
          </select>
        </label>
        <label id="invoiceCustomerField" ${isPurchase ? 'class="hidden"' : ''}>
          <span>Cliente</span>
          <select id="invoiceCustomerId" ${isPurchase ? 'class="hidden" disabled' : ''}>
            <option value="">Seleccione cliente</option>
            ${customerOptions}
          </select>
        </label>
        <label id="invoiceSupplierField" ${!isPurchase ? 'class="hidden"' : ''}>
          <span>Proveedor</span>
          <select id="invoiceSupplierId" ${!isPurchase ? 'class="hidden" disabled' : ''}>
            <option value="">Seleccione proveedor</option>
            ${supplierOptions}
          </select>
        </label>
        <label>
          <span>Número de factura</span>
          <input type="text" id="invoiceNumber" value="${(data.invoice_number || '').replace(/"/g, '&quot;')}" required />
        </label>
        <label>
          <span>Producto</span>
          <select id="invoiceProductId">
            <option value="">Seleccione producto</option>
            ${productOptions}
          </select>
        </label>
        <label>
          <span>Cantidad</span>
          <input type="text" id="invoiceQty" value="${String(data.quantity ?? 0)}" inputmode="decimal" required />
        </label>
        <label>
          <span>Precio unitario</span>
          <input type="text" id="invoicePrice" value="${formatNumberInput(String(Number(data.unit_price || 0)), false)}" inputmode="decimal" required />
        </label>
        <label>
          <span>Tipo de pago</span>
          <select id="invoicePaymentType">
            <option value="TOTAL" ${data.payment_type === 'TOTAL' ? 'selected' : ''}>Pago total</option>
            <option value="ABONO" ${data.payment_type === 'ABONO' ? 'selected' : ''}>Abono</option>
          </select>
        </label>
        <label>
          <span>Método de pago</span>
          <select id="invoicePaymentMethod">
            <option value="EFECTIVO" ${data.payment_method === 'EFECTIVO' ? 'selected' : ''}>Efectivo</option>
            <option value="TRANSFERENCIA" ${data.payment_method === 'TRANSFERENCIA' ? 'selected' : ''}>Transferencia</option>
          </select>
        </label>
        <label>
          <span>Remisión</span>
          <input type="text" id="invoiceOperationReference" value="${(data.operation_reference || '').replace(/"/g, '&quot;')}" />
        </label>
        <label>
          <span>Observación</span>
          <input type="text" id="invoiceNote" value="${(data.note || '').replace(/"/g, '&quot;')}" />
        </label>
      </div>
      <div class="invoice-summary">
        <span>Total estimado</span>
        <strong id="invoiceTotalPreview">$0</strong>
      </div>
      <div class="modal-actions">
        <button type="submit" class="primary-btn">Guardar cambios</button>
      </div>
    </form>
  `);

  const form = document.getElementById('editInvoiceForm');
  form?.addEventListener('submit', saveInvoice);
  applyFormattedNumberListener('invoiceQty', false, form);
  applyFormattedNumberListener('invoicePrice', false, form);
  bindInvoiceEditModalBehavior(form);
  syncInvoicePreview(form);
}

async function openInvoicePaymentHistory(invoiceId) {
  const modal = document.getElementById('moduleHistoryModal');
  const title = document.getElementById('moduleHistoryTitle');
  const body = document.getElementById('moduleHistoryBody');

  if (!modal || !title || !body) return;

  title.textContent = 'Detalle de factura y pagos';
  body.innerHTML = '<div class="empty-state">Cargando...</div>';
  modal.classList.remove('hidden');

  try {
    const { data: invoiceData, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoiceData) {
      body.innerHTML = '<div class="empty-state">No se pudo cargar la factura.</div>';
      return;
    }

    const { data: payments, error: paymentsError } = await supabaseClient
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      body.innerHTML = `<div class="empty-state">${paymentsError.message}</div>`;
      return;
    }

    const partyTable = invoiceData.type === 'PURCHASE' ? 'suppliers' : 'customers';
    const partyId = invoiceData.type === 'PURCHASE' ? invoiceData.supplier_id : invoiceData.customer_id;
    let partyName = '';
    let invoiceOverpayment = 0;

    const invoiceTotal = Number(invoiceData.total || 0);
    const invoicePaid = Number(invoiceData.paid_amount || 0);
    if (invoicePaid > invoiceTotal) {
      invoiceOverpayment = invoicePaid - invoiceTotal;
    }

    if (partyId) {
      const { data: party, error: partyError } = await supabaseClient
        .from(partyTable)
        .select('name')
        .eq('id', partyId)
        .single();

      if (!partyError && party) {
        partyName = party.name || '';
      }
    }

    const { data: productData, error: productError } = await supabaseClient
      .from('products')
      .select('name, measure')
      .eq('id', invoiceData.product_id)
      .single();

    const productName = productError || !productData ? 'Producto' : productData.name;
    const productMeasure = productError || !productData ? 'und' : productData.measure;
    const paymentMethodLabel = invoiceData.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
    const paymentTypeLabel = invoiceData.payment_type === 'ABONO' ? 'Abono' : 'Pago total';
    const typeLabel = invoiceData.type === 'PURCHASE' ? 'Compra' : 'Venta';

    const isSale = invoiceData.type === 'SALE';
    const creditBalanceLabel = isSale
      ? `Saldo a favor de "${partyName}"`
      : 'Saldo a favor en';

    const showCreditBalance = invoiceOverpayment > 0;
    const creditBalanceSection = showCreditBalance ? `
      <div class="history-modal-details" style="margin-top: 12px; border-color: rgba(34, 197, 94, 0.4);">
        <div class="history-modal-detail-row"><span>Excedente:</span><strong style="color: #86efac;">${formatMoney(invoiceOverpayment)}</strong></div>
        <div class="history-modal-detail-row"><span>${creditBalanceLabel}:</span><strong style="color: #86efac;">${formatMoney(invoiceOverpayment)}</strong></div>
      </div>
    ` : '';

    const invoiceDetails = `
      <div class="history-modal-details">
        <div class="history-modal-detail-row"><span>Número de factura:</span><strong>${invoiceData.invoice_number || '-'}</strong></div>
        <div class="history-modal-detail-row"><span>Tipo:</span><strong>${typeLabel}</strong></div>
        <div class="history-modal-detail-row"><span>Producto:</span><strong>${productName}</strong></div>
        <div class="history-modal-detail-row"><span>Cantidad:</span><strong>${invoiceData.quantity ?? 0} ${productMeasure}</strong></div>
        <div class="history-modal-detail-row"><span>Precio unitario:</span><strong>${formatMoney(Number(invoiceData.unit_price || 0))}</strong></div>
        <div class="history-modal-detail-row"><span>Total factura:</span><strong>${formatMoney(Number(invoiceData.total || 0))}</strong></div>
        <div class="history-modal-detail-row"><span>Total pagado:</span><strong>${formatMoney(Number(invoiceData.paid_amount || 0))}</strong></div>
        <div class="history-modal-detail-row"><span>Saldo pendiente:</span><strong>${formatMoney(Number(invoiceData.balance || 0))}</strong></div>
        <div class="history-modal-detail-row"><span>Tipo de pago:</span><strong>${paymentTypeLabel}</strong></div>
        <div class="history-modal-detail-row"><span>Método de pago:</span><strong>${paymentMethodLabel}</strong></div>
        <div class="history-modal-detail-row"><span>Remisión:</span><strong>${invoiceData.operation_reference || '-'}</strong></div>
        <div class="history-modal-detail-row"><span>Fecha:</span><strong>${formatDate(invoiceData.created_at)}</strong></div>
        <div class="history-modal-detail-row"><span>Estado:</span><strong>${invoiceData.status === 'PAID' ? 'Pagada' : 'Pendiente'}</strong></div>
        ${invoiceData.note ? `<div class="history-modal-detail-row"><span>Observación:</span><strong>${invoiceData.note}</strong></div>` : ''}
      </div>
      ${creditBalanceSection}
    `;

    const paymentsTitle = `
      <h4 style="margin: 18px 0 12px; font-size: 0.95rem; color: var(--text);">Historial de pagos (${payments ? payments.length : 0})</h4>
    `;

    if (!payments || payments.length === 0) {
      body.innerHTML = invoiceDetails + paymentsTitle + '<div class="empty-state">No hay pagos registrados para esta factura.</div>';
      return;
    }

    const paymentsHtml = payments.map((payment) => {
      const paymentMethod = payment.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
      return `
        <div class="history-modal-item">
          <div class="history-modal-head">
            <strong>${payment.payment_type === 'TOTAL' ? 'Pago total' : 'Abono'}</strong>
            <span>${formatDate(payment.created_at)}</span>
          </div>
          <div class="history-modal-body-text">
            <span>Monto: ${formatMoney(payment.amount || 0)}</span>
            <span>Método: ${paymentMethod}</span>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = invoiceDetails + paymentsTitle + paymentsHtml;
  } catch (error) {
    console.error(error);
    body.innerHTML = '<div class="empty-state">No se pudo cargar el historial de pagos.</div>';
  }
}

function switchHistoryTab(tabName) {
  document.querySelectorAll('.history-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.history === tabName);
  });

  const screens = document.querySelectorAll('.history-table');
  screens.forEach((screen) => {
    const isActive = screen.id === `history${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
    screen.classList.toggle('active-history', isActive);
  });
}

function syncInvoicePreview(form = document) {
  const targetForm = form && form.querySelector ? form : document;
  const qtyValue = parseFormattedNumber(targetForm.querySelector('#invoiceQty')?.value || targetForm.getElementById?.('invoiceQty')?.value || 0);
  const unitPriceValue = parseFormattedNumber(targetForm.querySelector('#invoicePrice')?.value || targetForm.getElementById?.('invoicePrice')?.value || 0);
  const preview = targetForm.querySelector('#invoiceTotalPreview') || document.getElementById('invoiceTotalPreview');

  if (!preview) return;

  const total = qtyValue * unitPriceValue;
  preview.textContent = formatMoney(total);
}

function bindInvoiceEditModalBehavior(form) {
  if (!form) return;

  const typeField = form.querySelector('#invoiceType');
  const customerField = form.querySelector('#invoiceCustomerField');
  const supplierField = form.querySelector('#invoiceSupplierField');
  const customerSelect = form.querySelector('#invoiceCustomerId');
  const supplierSelect = form.querySelector('#invoiceSupplierId');
  const productSelect = form.querySelector('#invoiceProductId');
  const qtyField = form.querySelector('#invoiceQty');
  const priceField = form.querySelector('#invoicePrice');
  const originalProductId = productSelect?.value || '';
  const originalPrice = priceField?.value || '';

  const updateVisibility = async () => {
    const isPurchase = typeField?.value === 'PURCHASE';

    const operationReferenceField = form.querySelector('#invoiceOperationReference');
    if (operationReferenceField) {
      operationReferenceField.placeholder = 'Remisión';
    }

    if (customerField) {
      customerField.classList.toggle('hidden', isPurchase);
    }
    if (supplierField) {
      supplierField.classList.toggle('hidden', !isPurchase);
    }

    if (customerSelect) {
      customerSelect.disabled = isPurchase;
      customerSelect.classList.toggle('hidden', isPurchase);
    }

    if (supplierSelect) {
      supplierSelect.disabled = !isPurchase;
      supplierSelect.classList.toggle('hidden', !isPurchase);
    }

    const partySelect = isPurchase ? supplierSelect : customerSelect;
    const partyId = partySelect?.value;
    const creditBalanceEl = form.querySelector('#availableCreditBalance');

    if (creditBalanceEl) {
      if (!partyId) {
        creditBalanceEl.textContent = '';
      } else {
        const table = isPurchase ? 'suppliers' : 'customers';
        const { data: party, error } = await supabaseClient.from(table).select('credit_balance').eq('id', partyId).single();
        if (!error && party) {
          const credit = Number(party.credit_balance || 0);
          creditBalanceEl.textContent = credit > 0 ? `Saldo a favor: ${formatMoney(credit)}` : '';
        } else {
          creditBalanceEl.textContent = '';
        }
      }
    }

    const productId = productSelect?.value;
    if (productId) {
      const { data } = await supabaseClient.from('products').select('*').eq('id', productId).single();
      if (data) {
        const isSameProduct = !originalProductId || originalProductId === productId;
        const shouldKeepInvoicePrice = isSameProduct && !!originalPrice && parseFormattedNumber(originalPrice) > 0;

        if (shouldKeepInvoicePrice && priceField && priceField.value !== originalPrice) {
          priceField.value = originalPrice;
        } else if (!priceField || !priceField.value || parseFormattedNumber(priceField.value) === 0) {
          const defaultPrice = typeField?.value === 'PURCHASE' ? Number(data.purchase_price || 0) : Number(data.sale_price || 0);
          priceField.value = formatNumberInput(String(defaultPrice), false);
        }

        syncInvoicePreview(form);
      }
    }
  };

  typeField?.addEventListener('change', updateVisibility);
  productSelect?.addEventListener('change', async (event) => {
    const productId = event.target.value;
    if (!productId) return;

    const { data } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!data) return;

    const isChangingProduct = originalProductId && originalProductId !== productId;
    const defaultPrice = typeField?.value === 'PURCHASE' ? Number(data.purchase_price || 0) : Number(data.sale_price || 0);

    if (priceField) {
      if (!isChangingProduct && originalPrice && parseFormattedNumber(originalPrice) > 0) {
        priceField.value = originalPrice;
      } else {
        priceField.value = formatNumberInput(String(defaultPrice), false);
      }
    }
    syncInvoicePreview(form);
  });

  qtyField?.addEventListener('input', () => syncInvoicePreview(form));
  priceField?.addEventListener('input', () => syncInvoicePreview(form));

  const useCreditCheckbox = form.querySelector('#invoiceUseCreditBalance');
  const initialPaymentField = form.querySelector('#invoiceInitialPayment');
  if (useCreditCheckbox && initialPaymentField) {
    useCreditCheckbox.addEventListener('change', async () => {
      if (!useCreditCheckbox.checked) {
        initialPaymentField.value = '';
        syncInvoicePreview(form);
        return;
      }

      const isPurchase = typeField?.value === 'PURCHASE';
      const partySelect = isPurchase ? form.querySelector('#invoiceSupplierId') : form.querySelector('#invoiceCustomerId');
      const partyId = partySelect?.value;

      if (!partyId) {
        alert('Seleccione un cliente o proveedor primero.');
        useCreditCheckbox.checked = false;
        return;
      }

      const table = isPurchase ? 'suppliers' : 'customers';
      const { data: party, error } = await supabaseClient.from(table).select('credit_balance').eq('id', partyId).single();
      if (error || !party) {
        alert('No se pudo cargar el saldo a favor.');
        useCreditCheckbox.checked = false;
        return;
      }

      const credit = Number(party.credit_balance || 0);
      if (credit <= 0) {
        alert('No hay saldo a favor disponible.');
        useCreditCheckbox.checked = false;
        return;
      }

      initialPaymentField.value = formatNumberInput(String(credit), false);
      syncInvoicePreview(form);
    });
  }

  updateVisibility();
}



document.querySelectorAll('.history-tab').forEach((tab) => {
  tab.addEventListener('click', () => switchHistoryTab(tab.dataset.history));
});

document.getElementById('historyTypeFilter')?.addEventListener('change', async () => {
  await loadHistory();
});

document.getElementById('historyPaymentFilter')?.addEventListener('change', async () => {
  await loadHistory();
});

document.getElementById('invoiceListSearch')?.addEventListener('input', async () => {
  await loadInvoices();
});

document.getElementById('invoiceOperationFilter')?.addEventListener('change', async () => {
  await loadInvoices();
});

document.getElementById('invoicePartyTypeFilter')?.addEventListener('change', async () => {
  await refreshPartyFilterOptions();
  await loadInvoices();
});

document.getElementById('invoicePartyFilter')?.addEventListener('change', async () => {
  await loadInvoices();
});

async function refreshPartyFilterOptions() {
  const partyTypeFilter = document.getElementById('invoicePartyTypeFilter')?.value || 'all';
  const partyFilter = document.getElementById('invoicePartyFilter');
  if (!partyFilter) return;

  partyFilter.innerHTML = '<option value="">Seleccionar</option>';

  if (partyTypeFilter === 'CLIENTE') {
    const { data: customers } = await supabaseClient.from('customers').select('*').order('name');
    if (customers) {
      customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        partyFilter.appendChild(option);
      });
    }
  } else if (partyTypeFilter === 'PROVEEDOR') {
    const { data: suppliers } = await supabaseClient.from('suppliers').select('*').order('name');
    if (suppliers) {
      suppliers.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        partyFilter.appendChild(option);
      });
    }
  }
}

async function downloadInvoiceExcel() {
  const invoiceSearch = document.getElementById('invoiceListSearch')?.value || '';
  const operationFilter = document.getElementById('invoiceOperationFilter')?.value || 'all';
  const partyTypeFilter = document.getElementById('invoicePartyTypeFilter')?.value || 'all';
  const partyFilter = document.getElementById('invoicePartyFilter')?.value || '';

  const { data: invoices, error } = await supabaseClient
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    alert('Error al cargar las facturas: ' + error.message);
    return;
  }

  if (!invoices || invoices.length === 0) {
    alert('No hay facturas para exportar.');
    return;
  }

  const customers = await supabaseClient.from('customers').select('*');
  const suppliers = await supabaseClient.from('suppliers').select('*');
  const products = await supabaseClient.from('products').select('*');
  const payments = await supabaseClient.from('invoice_payments').select('*');

  const customerMap = new Map((customers.data || []).map((c) => [c.id, c]));
  const supplierMap = new Map((suppliers.data || []).map((s) => [s.id, s]));
  const productMap = new Map((products.data || []).map((p) => [p.id, p]));
  const paymentsByInvoice = new Map();

  (payments.data || []).forEach((payment) => {
    if (!paymentsByInvoice.has(payment.invoice_id)) {
      paymentsByInvoice.set(payment.invoice_id, []);
    }
    paymentsByInvoice.get(payment.invoice_id).push(payment);
  });

  const filteredInvoices = (invoices || []).filter((invoice) => {
    const searchTerm = invoiceSearch.trim().toLowerCase();
    const matchesSearch = !searchTerm ||
      (invoice.invoice_number || '').toLowerCase().includes(searchTerm) ||
      (invoice.operation_reference || '').toLowerCase().includes(searchTerm);

    const matchesType = operationFilter === 'all' || invoice.type === operationFilter;

    let matchesParty = true;
    if (partyTypeFilter === 'CLIENTE') {
      matchesParty = invoice.type === 'SALE' && invoice.customer_id === partyFilter;
    } else if (partyTypeFilter === 'PROVEEDOR') {
      matchesParty = invoice.type === 'PURCHASE' && invoice.supplier_id === partyFilter;
    }

    return matchesSearch && matchesType && matchesParty;
  });

  const wb = XLSX.utils.book_new();

  const operacionesHeader = ['Id operacion', 'Fecha', 'Remisión', 'Unidades', 'Producto', 'Precio de compra', 'Total de compra', 'Saldo pendiente', 'Metodo de pago', 'Observacion'];
  const operacionesData = [operacionesHeader];

  filteredInvoices.forEach((invoice) => {
    const product = productMap.get(invoice.product_id);
    const measure = product?.measure || 'und';
    const productName = product?.name || '';
    const paymentMethodLabel = invoice.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
    const saldoPendiente = Number(invoice.balance || 0);

    operacionesData.push([
      invoice.invoice_number || '',
      formatDate(invoice.created_at),
      invoice.operation_reference || '',
      `${invoice.quantity ?? 0} ${measure}`,
      productName,
      Number(invoice.unit_price || 0),
      Number(invoice.total || 0),
      saldoPendiente,
      paymentMethodLabel,
      invoice.note || '',
    ]);
  });

  const operacionesSheet = XLSX.utils.aoa_to_sheet(operacionesData);
  operacionesSheet['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 25 },
  ];

  for (let j = 0; j < operacionesHeader.length; j++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: j });
    if (operacionesSheet[cellRef]) {
      operacionesSheet[cellRef].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, operacionesSheet, 'Operaciones');

  for (const invoice of filteredInvoices) {
    const invoicePayments = paymentsByInvoice.get(invoice.id) || [];
    const invoiceTotal = Number(invoice.total || 0);
    const product = productMap.get(invoice.product_id);
    const measure = product?.measure || 'und';
    const productName = product?.name || '';
    const paymentMethodLabel = invoice.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo';
    const saldoPendiente = Number(invoice.balance || 0);

    const sheetName = `Op ${invoice.invoice_number || invoice.id}`.substring(0, 31);
    const sheetData = [];

    sheetData.push([`Operacion ${invoice.invoice_number || ''}`]);
    sheetData.push([]);

    sheetData.push(['Fecha', 'Producto', 'Total factura', 'Remisión', 'Precio de compra', 'Unidades', 'Saldo pendiente', 'Metodo de pago']);
    sheetData.push([
      formatDate(invoice.created_at),
      productName,
      invoiceTotal,
      invoice.operation_reference || '',
      Number(invoice.unit_price || 0),
      `${invoice.quantity ?? 0} ${measure}`,
      saldoPendiente,
      paymentMethodLabel,
    ]);

    sheetData.push([]);
    const pagoTitleRow = sheetData.length;
    sheetData.push([`Pago a operacion ${invoice.invoice_number || ''}`]);
    sheetData.push([]);

    const paymentHeaderRow = sheetData.length;
    if (invoicePayments.length > 0) {
      sheetData.push(['Fecha', 'Id operacion', 'Remisión', 'Medio de pago', 'Valor', 'Excedente']);
      invoicePayments.forEach((payment) => {
        const paymentValue = Number(payment.amount || 0);
        const excedente = paymentValue > invoiceTotal ? paymentValue - invoiceTotal : 0;
        sheetData.push([
          formatDate(payment.created_at),
          invoice.invoice_number || '',
          invoice.operation_reference || '',
          payment.payment_method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo',
          paymentValue,
          excedente > 0 ? excedente : '',
        ]);
      });
    } else {
      sheetData.push(['No hay pagos registrados para esta factura.']);
    }

    const paymentSheet = XLSX.utils.aoa_to_sheet(sheetData);

    paymentSheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: pagoTitleRow, c: 0 }, e: { r: pagoTitleRow, c: 7 } },
    ];

    paymentSheet['!cols'] = [
      { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 16 },
    ];

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      for (let j = 0; j < row.length; j++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
        if (paymentSheet[cellRef]) {
          paymentSheet[cellRef].s = {
            font: { bold: i === 0 || i === pagoTitleRow || i === 2 || i === paymentHeaderRow },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, paymentSheet, sheetName);
  }

  XLSX.writeFile(wb, `Facturas_${new Date().toISOString().split('T')[0]}.xlsx`);
}

document.getElementById('invoiceHistoryBtn')?.addEventListener('click', () => openModuleHistory('invoice'));
document.getElementById('downloadInvoiceExcelBtn')?.addEventListener('click', downloadInvoiceExcel);
document.getElementById('closeModuleHistory')?.addEventListener('click', () => {
  const modal = document.getElementById('moduleHistoryModal');
  if (modal) modal.classList.add('hidden');
});

document.getElementById('closePaymentModal')?.addEventListener('click', closePaymentModal);

document.getElementById('paymentModal')?.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'paymentModal') {
    closePaymentModal();
  }
});

document.getElementById('closeRecordEditModal')?.addEventListener('click', () => {
  closeEditModal();
});

document.getElementById('recordEditModal')?.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'recordEditModal') {
    closeEditModal();
  }
});

document.getElementById('moduleHistoryModal')?.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'moduleHistoryModal') {
    event.target.classList.add('hidden');
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  await loginUser(email, password);
});

document.getElementById('paymentForm')?.addEventListener('submit', submitPaymentForm);

document.getElementById('closePaymentModal')?.addEventListener('click', closePaymentModal);

document.getElementById('paymentModal')?.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'paymentModal') {
    closePaymentModal();
  }
});

document.getElementById('logoutBtn').addEventListener('click', logoutUser);

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', async () => {
    await setActiveView(button.dataset.view);
  });
});

applyFormattedNumberListener('productPurchasePrice', false);
applyFormattedNumberListener('productSalePrice', false);
applyFormattedNumberListener('invoiceQty', false);
applyFormattedNumberListener('invoicePrice', false);
applyFormattedNumberListener('invoiceInitialPayment', false);
applyFormattedNumberListener('paymentAmount', false);
applyFormattedNumberListener('customCreditAmount', false);

['invoiceQty', 'invoicePrice'].forEach((id) => {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener('input', syncInvoicePreview);
  }
});

const invoicePaymentType = document.getElementById('invoicePaymentType');
if (invoicePaymentType) {
  invoicePaymentType.value = 'TOTAL';
}

async function refreshInvoiceFormDefaults() {
  await syncInvoiceNumber();
  if (invoicePaymentType) {
    invoicePaymentType.value = 'TOTAL';
  }
}

document.getElementById('invoicePaymentType')?.addEventListener('change', () => {
  syncInvoicePaymentFields(document);
});

document.getElementById('receivableInvoiceSearch')?.addEventListener('input', async () => {
  await loadAccountsReceivable();
});

document.getElementById('receivableOperationFilter')?.addEventListener('change', async () => {
  await loadAccountsReceivable();
});

document.getElementById('payableInvoiceSearch')?.addEventListener('input', async () => {
  await loadAccountsPayable();
});

document.getElementById('payableOperationFilter')?.addEventListener('change', async () => {
  await loadAccountsPayable();
});

document.getElementById('paymentSearch')?.addEventListener('input', async () => {
  await loadPayments();
});

document.getElementById('paymentOperationFilter')?.addEventListener('change', async () => {
  await loadPayments();
});

document.getElementById('chartYearFilter')?.addEventListener('change', async () => {
  const invoices = (await supabaseClient.from('invoices').select('*')).data || [];
  const selectedYear = Number(document.getElementById('chartYearFilter').value);
  renderPurchasesSalesChart(invoices, selectedYear);
});

syncInvoicePaymentFields(document);

document.getElementById('invoiceType').addEventListener('change', async (event) => {
  const isPurchase = event.target.value === 'PURCHASE';
  const customerSelect = document.getElementById('invoiceCustomerId');
  const supplierSelect = document.getElementById('invoiceSupplierId');
  const productId = document.getElementById('invoiceProductId').value;

  await syncInvoiceNumber();

  const operationReferenceField = document.getElementById('invoiceOperationReference');
  if (operationReferenceField) {
    operationReferenceField.placeholder = 'Remisión';
  }

  if (customerSelect) {
    customerSelect.classList.toggle('hidden', isPurchase);
    customerSelect.disabled = isPurchase;
  }

  if (supplierSelect) {
    supplierSelect.classList.toggle('hidden', !isPurchase);
    supplierSelect.disabled = !isPurchase;
  }

  const creditBalanceEl = document.getElementById('availableCreditBalance');
  if (creditBalanceEl) {
    const partySelect = isPurchase ? supplierSelect : customerSelect;
    const partyId = partySelect?.value;
    if (!partyId) {
      creditBalanceEl.textContent = '';
    } else {
      const table = isPurchase ? 'suppliers' : 'customers';
      const { data: party, error } = await supabaseClient.from(table).select('credit_balance').eq('id', partyId).single();
      if (!error && party) {
        const credit = Number(party.credit_balance || 0);
        creditBalanceEl.textContent = credit > 0 ? `Saldo a favor: ${formatMoney(credit)}` : '';
      } else {
        creditBalanceEl.textContent = '';
      }
    }
  }

  if (productId) {
    const { data } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (data) {
      const defaultPrice = isPurchase ? Number(data.purchase_price || 0) : Number(data.sale_price || 0);
      document.getElementById('invoicePrice').value = formatNumberInput(String(defaultPrice), false);
      syncInvoicePreview();
    }
  }
});

const invoiceCustomer = document.getElementById('invoiceCustomerId');
if (invoiceCustomer) {
  invoiceCustomer.addEventListener('change', async () => {
    const creditBalanceEl = document.getElementById('availableCreditBalance');
    if (!creditBalanceEl) return;

    const partyId = invoiceCustomer.value;
    if (!partyId) {
      creditBalanceEl.textContent = '';
      return;
    }

    const { data: customer, error } = await supabaseClient.from('customers').select('credit_balance').eq('id', partyId).single();
    if (!error && customer) {
      const credit = Number(customer.credit_balance || 0);
      creditBalanceEl.textContent = credit > 0 ? `Saldo a favor: ${formatMoney(credit)}` : '';
    } else {
      creditBalanceEl.textContent = '';
    }
  });
}

const invoiceSupplier = document.getElementById('invoiceSupplierId');
if (invoiceSupplier) {
  invoiceSupplier.addEventListener('change', async () => {
    const creditBalanceEl = document.getElementById('availableCreditBalance');
    if (!creditBalanceEl) return;

    const partyId = invoiceSupplier.value;
    if (!partyId) {
      creditBalanceEl.textContent = '';
      return;
    }

    const { data: supplier, error } = await supabaseClient.from('suppliers').select('credit_balance').eq('id', partyId).single();
    if (!error && supplier) {
      const credit = Number(supplier.credit_balance || 0);
      creditBalanceEl.textContent = credit > 0 ? `Saldo a favor: ${formatMoney(credit)}` : '';
    } else {
      creditBalanceEl.textContent = '';
    }
  });
}

const invoiceProduct = document.getElementById('invoiceProductId');
if (invoiceProduct) {
  invoiceProduct.addEventListener('change', async (event) => {
    const productId = event.target.value;
    if (!productId) return;

    const { data } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!data) return;

    const type = document.getElementById('invoiceType').value || 'SALE';
    const defaultPrice = type === 'PURCHASE' ? Number(data.purchase_price || 0) : Number(data.sale_price || 0);
    document.getElementById('invoicePrice').value = formatNumberInput(String(defaultPrice), false);
    syncInvoicePreview();
  });
}

const invoiceUseCreditCheckbox = document.getElementById('invoiceUseCreditBalance');
const invoiceInitialPaymentField = document.getElementById('invoiceInitialPayment');
let pendingCreditBalance = 0;

function openCreditBalanceModal(credit, partyName) {
  pendingCreditBalance = credit;
  const modal = document.getElementById('creditBalanceModal');
  const availableEl = document.getElementById('creditBalanceAvailable');
  const customSection = document.getElementById('customCreditAmountSection');
  const customInput = document.getElementById('customCreditAmount');

  availableEl.textContent = `Saldo a favor disponible: ${formatMoney(credit)}${partyName ? ` (${partyName})` : ''}`;
  customSection.classList.add('hidden');
  customInput.value = '';
  modal.classList.remove('hidden');
}

function closeCreditBalanceModal() {
  const modal = document.getElementById('creditBalanceModal');
  modal.classList.add('hidden');
  pendingCreditBalance = 0;
}

if (invoiceUseCreditCheckbox) {
  invoiceUseCreditCheckbox.addEventListener('change', async () => {
    if (!invoiceUseCreditCheckbox.checked) {
      invoiceInitialPaymentField.value = '';
      return;
    }

    const type = document.getElementById('invoiceType').value || 'SALE';
    const isPurchase = type === 'PURCHASE';
    const partySelect = isPurchase ? document.getElementById('invoiceSupplierId') : document.getElementById('invoiceCustomerId');
    const partyId = partySelect?.value;

    if (!partyId) {
      alert('Seleccione un cliente o proveedor primero.');
      invoiceUseCreditCheckbox.checked = false;
      return;
    }

    const table = isPurchase ? 'suppliers' : 'customers';
    const { data: party, error } = await supabaseClient.from(table).select('credit_balance, name').eq('id', partyId).single();
    if (error || !party) {
      alert('No se pudo cargar el saldo a favor.');
      invoiceUseCreditCheckbox.checked = false;
      return;
    }

    const credit = Number(party.credit_balance || 0);
    if (credit <= 0) {
      alert('No hay saldo a favor disponible.');
      invoiceUseCreditCheckbox.checked = false;
      return;
    }

    openCreditBalanceModal(credit, party.name || '');
  });
}

document.getElementById('closeCreditBalanceModal')?.addEventListener('click', () => {
  closeCreditBalanceModal();
  invoiceUseCreditCheckbox.checked = false;
});

document.getElementById('creditBalanceModal')?.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'creditBalanceModal') {
    closeCreditBalanceModal();
    invoiceUseCreditCheckbox.checked = false;
  }
});

document.getElementById('useAllCreditBtn')?.addEventListener('click', () => {
  invoiceInitialPaymentField.value = formatNumberInput(String(pendingCreditBalance), false);
  closeCreditBalanceModal();
});

document.getElementById('useCustomCreditBtn')?.addEventListener('click', () => {
  const customSection = document.getElementById('customCreditAmountSection');
  const customInput = document.getElementById('customCreditAmount');
  customSection.classList.remove('hidden');
  customInput.value = formatNumberInput(String(pendingCreditBalance), false);
  setTimeout(() => customInput.focus(), 50);
});

document.getElementById('confirmCustomCreditBtn')?.addEventListener('click', () => {
  const customInput = document.getElementById('customCreditAmount');
  const parsedAmount = parseFormattedNumber(customInput.value);

  if (parsedAmount <= 0 || parsedAmount > pendingCreditBalance) {
    alert(`El monto debe ser mayor a 0 y no exceder ${formatMoney(pendingCreditBalance)}.`);
    return;
  }

  invoiceInitialPaymentField.value = formatNumberInput(String(parsedAmount), false);
  closeCreditBalanceModal();
});

document.getElementById('productForm').addEventListener('submit', saveProduct);
document.getElementById('customerForm').addEventListener('submit', saveCustomer);
document.getElementById('supplierForm').addEventListener('submit', saveSupplier);
document.getElementById('invoiceForm').addEventListener('submit', saveInvoice);
refreshInvoiceFormDefaults();
document.getElementById('userForm').addEventListener('submit', saveUser);
document.getElementById('paymentForm')?.addEventListener('submit', submitPaymentForm);

document.addEventListener('click', async (event) => {
  const button = event.target.closest('.secondary-action-btn');
  if (button) {
    const { id, type } = button.dataset;
    if (type === 'edit-product') await startEditProduct(id);
    if (type === 'edit-customer') await startEditCustomer(id);
    if (type === 'edit-supplier') await startEditSupplier(id);
    if (type === 'edit-user') await startEditUser(id);
    if (type === 'edit-invoice') await startEditInvoice(id);
    if (type === 'reset-user-password') await resetPasswordForUser(id);
    if (type === 'view-invoice-payments') await openInvoicePaymentHistory(id);
    if (type === 'open-payment-total') {
      openPaymentModal(id, 'total');
    }
    if (type === 'open-payment-abono') {
      const invoice = (await supabaseClient.from('invoices').select('*').eq('id', id).single()).data;
      if (!invoice) return;
      openPaymentModal(id, 'abono');
    }
    if (type === 'edit-invoice-payment') {
      const payment = (await supabaseClient.from('invoice_payments').select('invoice_id').eq('id', id).single()).data;
      if (!payment) return;
      openPaymentModal(payment.invoice_id, 'total', id);
    }
    return;
  }

  const deleteButton = event.target.closest('.action-btn');
  if (deleteButton) {
    const { id, type } = deleteButton.dataset;
    if (type === 'delete-product' || type === 'delete-customer' || type === 'delete-supplier' || type === 'delete-user' || type === 'delete-invoice') {
      closePaymentModal();
      await deleteRecord(type, id);
    }
    if (type === 'delete-invoice-payment') {
      closePaymentModal();
      await deleteInvoicePayment(id);
    }
    return;
  }

  const historyRow = event.target.closest('tr[data-invoice-id]');
  if (historyRow) {
    const invoiceId = historyRow.dataset.invoiceId;
    if (invoiceId) {
      await openInvoicePaymentHistory(invoiceId);
    }
  }
});

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    sidebar.classList.toggle('open');
  });
}

(() => {
  if (!checkSupabaseSetup()) {
    renderUserState();
    return;
  }

  initSession();
})();
