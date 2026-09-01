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

function resetFormState(form) {
  if (!form || typeof form.reset !== 'function') return;

  form.reset();

  if (form.id === 'invoiceForm') {
    const invoiceType = document.getElementById('invoiceType');
    const customerSelect = document.getElementById('invoiceCustomerId');
    const supplierSelect = document.getElementById('invoiceSupplierId');
    const paymentType = document.getElementById('invoicePaymentType');
    const preview = document.getElementById('invoiceTotalPreview');

    if (invoiceType) invoiceType.value = 'SALE';
    if (customerSelect) {
      customerSelect.disabled = false;
      customerSelect.classList.remove('hidden');
    }
    if (supplierSelect) {
      supplierSelect.disabled = true;
      supplierSelect.classList.add('hidden');
    }
    if (paymentType) paymentType.value = 'TOTAL';
    if (preview) preview.textContent = formatMoney(0);
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

async function registerUser(name, email, password) {
  if (!checkSupabaseSetup()) return;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) {
    showMessage(error.message, true);
    return;
  }

  if (!data.user) {
    showMessage('No se pudo crear el usuario en Auth.', true);
    return;
  }

  const { error: profileError } = await supabaseClient.from('profiles').upsert(
    { id: data.user.id, full_name: name, email, role: 'VIEWER' },
    { onConflict: 'id' }
  );

  if (profileError) {
    showMessage('El usuario quedó creado en Auth, pero falló el perfil: ' + profileError.message, true);
    return;
  }

  await recordAudit('create_user', 'profile', data.user.id, { name, email, role: 'VIEWER' });
  showMessage('Cuenta creada correctamente. Ya puedes iniciar sesión.');
  switchTab('login');
  document.getElementById('registerForm').reset();
  switchTab('login');
  document.getElementById('registerForm').reset();
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  await renderUserState();
  showMessage('Sesión cerrada.');
}

async function registerInvoicePayment(invoiceId, amount, source = 'ABONO') {
  if (!invoiceId || !Number(amount) || Number(amount) <= 0) return;

  const { error } = await supabaseClient.from('invoice_payments').insert([
    {
      invoice_id: invoiceId,
      amount: Number(amount),
      payment_type: source,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    alert(error.message);
  }
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

  const salesTotal = invoices.filter((invoice) => invoice.type === 'SALE').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const purchasesTotal = invoices.filter((invoice) => invoice.type === 'PURCHASE').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const pendingCustomerDebt = invoices.filter((invoice) => invoice.type === 'SALE' && Number(invoice.balance || 0) > 0).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const pendingSupplierDebt = invoices.filter((invoice) => invoice.type === 'PURCHASE' && Number(invoice.balance || 0) > 0).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const netBalance = salesTotal - purchasesTotal;

  const customerDebtList = document.getElementById('customerDebtList');
  const supplierDebtList = document.getElementById('supplierDebtList');

  customerDebtList.innerHTML = invoices
    .filter((invoice) => invoice.type === 'SALE' && Number(invoice.balance || 0) > 0)
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
    .filter((invoice) => invoice.type === 'PURCHASE' && Number(invoice.balance || 0) > 0)
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

  document.getElementById('productsTotal').textContent = productsResult.data?.length ?? 0;
  document.getElementById('customerPaymentsTotal').textContent = formatMoney(pendingCustomerDebt);
  document.getElementById('supplierPaymentsTotal').textContent = formatMoney(pendingSupplierDebt);
  document.getElementById('netBalanceTotal').textContent = `${netBalance >= 0 ? 'A favor' : 'Debe'} ${formatMoney(Math.abs(netBalance))}`;
  document.getElementById('customersTotal')?.remove();
  document.getElementById('suppliersTotal')?.remove();
  document.getElementById('usersTotal')?.remove();
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
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay clientes.</td></tr>';
    return;
  }

  data.forEach((customer) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${customer.name || '-'}</td>
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
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay proveedores.</td></tr>';
    return;
  }

  data.forEach((supplier) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${supplier.name || '-'}</td>
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

  data.forEach((invoice) => {
    const customer = customerMap.get(invoice.customer_id);
    const supplier = supplierMap.get(invoice.supplier_id);
    const product = productMap.get(invoice.product_id);
    const type = invoice.type || invoice.kind || 'SALE';
    const partyName = type === 'PURCHASE' ? (supplier ? supplier.name : '-') : (customer ? customer.name : '-');
    const balance = Number(invoice.balance || 0);
    const hasAbono = String(invoice.payment_type || '').toUpperCase() === 'ABONO';
    const totalDisplay = hasAbono ? `${formatMoney(invoice.paid_amount || 0)}/${formatMoney(invoice.total || 0)}` : formatMoney(invoice.total || 0);
    const paymentTypeLabel = hasAbono ? 'Abono' : 'Total';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${invoice.invoice_number || '-'}</td>
      <td>${getTypeLabel(type)}</td>
      <td>${partyName}</td>
      <td>${product ? product.name : '-'}</td>
      <td>${invoice.quantity ?? 0}</td>
      <td>${totalDisplay}</td>
      <td>${paymentTypeLabel}</td>
      <td>${formatDate(invoice.created_at)}</td>
      <td>
        <button class="secondary-action-btn" data-id="${invoice.id}" data-type="edit-invoice">Editar</button>
        ${hasAbono && balance > 0 ? `<button class="secondary-action-btn" data-id="${invoice.id}" data-type="add-invoice-abono">Abonar</button>` : ''}
        ${hasAbono ? `<button class="secondary-action-btn" data-id="${invoice.id}" data-type="view-invoice-payments">Abonos</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function applyInvoiceAbono(invoiceId, currentTotal, currentPaid, currentBalance) {
  if (!invoiceId) return;

  const remainingBalance = Number(currentBalance || 0);
  if (remainingBalance <= 0) {
    alert('Esta factura ya está totalmente pagada.');
    return;
  }

  const amountPrompt = window.prompt('Ingrese el valor del abono adicional:', '0');
  if (amountPrompt === null) return;

  const amount = Number(String(amountPrompt).replace(/\./g, '').replace(',', '.').trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('El abono debe ser mayor a cero.');
    return;
  }

  if (amount > remainingBalance) {
    alert(`El abono no puede superar el saldo pendiente de ${formatMoney(remainingBalance)}.`);
    return;
  }

  const nextPaid = Number(currentPaid || 0) + amount;
  const nextBalance = Number(currentTotal || 0) - nextPaid;

  const { error } = await supabaseClient
    .from('invoices')
    .update({
      paid_amount: nextPaid,
      balance: nextBalance,
      status: nextBalance > 0 ? 'PENDING' : 'PAID',
      payment_type: 'ABONO',
    })
    .eq('id', invoiceId);

  if (error) {
    alert(error.message);
    return;
  }

  await registerInvoicePayment(invoiceId, amount, 'ABONO');

  await recordAudit('add_invoice_abono', 'invoice', invoiceId, {
    previousPaid: Number(currentPaid || 0),
    addedAmount: amount,
    newPaid: nextPaid,
    newBalance: nextBalance,
  });

  await loadAllModules();
}

async function loadHistory() {
  const typeFilter = document.getElementById('historyTypeFilter')?.value || 'all';
  const paymentFilter = document.getElementById('historyPaymentFilter')?.value || 'all';

  const [invoicesResult, productsResult, customersResult, suppliersResult] = await Promise.all([
    supabaseClient.from('invoices').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('products').select('*'),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('suppliers').select('*'),
  ]);

  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const customerMap = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const supplierMap = new Map((suppliersResult.data || []).map((supplier) => [supplier.id, supplier]));

  const generalBody = document.getElementById('historyGeneralBody');
  const personalBody = document.getElementById('historyPersonalBody');
  generalBody.innerHTML = '';
  personalBody.innerHTML = '';

  const rows = [];

  (invoicesResult.data || []).forEach((invoice) => {
    const product = productMap.get(invoice.product_id);
    const partyName = invoice.type === 'PURCHASE'
      ? supplierMap.get(invoice.supplier_id)?.name || 'Proveedor'
      : customerMap.get(invoice.customer_id)?.name || 'Cliente';

    const paymentType = String(invoice.payment_type || 'TOTAL').toUpperCase();
    const typeKey = invoice.type === 'PURCHASE' ? 'PURCHASE' : 'SALE';

    rows.push({
      source: 'invoice',
      created_at: invoice.created_at,
      type: invoice.type === 'PURCHASE' ? 'Compra' : 'Venta',
      typeKey,
      paymentType,
      product: product ? product.name : 'Producto',
      quantity: `${invoice.quantity ?? 0} ${product?.measure || 'und'}`,
      totalCompra: invoice.type === 'PURCHASE' ? formatMoney(invoice.total || 0) : '-',
      totalVenta: invoice.type === 'SALE' ? formatMoney(invoice.total || 0) : '-',
      detail: `${invoice.type === 'PURCHASE' ? 'Compra a' : 'Venta a'} ${partyName}${invoice.payment_type === 'ABONO' ? ` • Abono ${formatMoney(invoice.paid_amount || 0)} • Saldo ${formatMoney(invoice.balance || 0)}` : ` • Pago total ${formatMoney(invoice.total || 0)}`}`,
    });
  });

  const filteredRows = rows.filter((row) => {
    const typeMatches = typeFilter === 'all' || row.typeKey === typeFilter;
    const paymentMatches = paymentFilter === 'all' || row.paymentType === paymentFilter;
    return typeMatches && paymentMatches;
  });

  filteredRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filteredRows.length === 0) {
    const emptyMessage = 'No hay facturas para este filtro.';
    generalBody.innerHTML = `<tr><td colspan="7" class="empty-state">${emptyMessage}</td></tr>`;
    personalBody.innerHTML = `<tr><td colspan="7" class="empty-state">${emptyMessage}</td></tr>`;
    return;
  }

  filteredRows.forEach((row) => {
    const badgeClass = row.typeKey === 'PURCHASE' ? 'history-badge-purchase' : 'history-badge-sale';

    const generalRow = document.createElement('tr');
    generalRow.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td><span class="history-badge ${badgeClass}">${row.type}</span></td>
      <td>${row.product}</td>
      <td>${row.quantity}</td>
      <td>${row.totalCompra}</td>
      <td>${row.totalVenta}</td>
      <td>${row.detail}</td>
    `;
    generalBody.appendChild(generalRow);

    const personalRow = document.createElement('tr');
    personalRow.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td><span class="history-badge ${badgeClass}">${row.type}</span></td>
      <td>${row.product}</td>
      <td>${row.quantity}</td>
      <td>${row.totalCompra}</td>
      <td>${row.totalVenta}</td>
      <td>${row.detail}</td>
    `;
    personalBody.appendChild(personalRow);
  });
}

async function loadAllModules() {
  await Promise.all([
    loadDashboard(),
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

  const { data: productData, error: productError } = await supabaseClient
    .from('products')
    .select('*')
    .eq('id', payload.product_id)
    .single();

  if (productError || !productData) {
    alert('No se pudo obtener el producto para registrar el movimiento.');
    return;
  }

  let newStock = Number(productData.stock || 0);

  if (payload.type === 'EXIT' && payload.quantity > newStock) {
    alert(`No hay suficiente stock para el producto ${productData.name}. Stock actual: ${newStock}.`);
    return;
  }

  if (payload.type === 'ENTRY') newStock += payload.quantity;
  if (payload.type === 'EXIT') newStock -= payload.quantity;
  if (payload.type === 'ADJUSTMENT') newStock = payload.quantity;

  const { error: movementError } = await supabaseClient.from('inventory_movements').insert([payload]);
  if (movementError) {
    alert(movementError.message);
    return;
  }

  const { error: stockError } = await supabaseClient.from('products').update({ stock: newStock, measure: payload.measure || productData.measure || 'und' }).eq('id', payload.product_id);
  if (stockError) {
    alert(stockError.message);
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
  const note = noteField?.value.trim() || '';

  const partyId = type === 'PURCHASE' ? supplierId : customerId;

  if (!partyId || !invoiceNumber || !productId) {
    alert(type === 'PURCHASE' ? 'Debe completar proveedor, factura y producto.' : 'Debe completar cliente, factura y producto.');
    return;
  }

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

  if (editingInvoiceId) {
    const { data: existingInvoice, error: existingError } = await supabaseClient.from('invoices').select('*').eq('id', editingInvoiceId).single();
    if (existingError || !existingInvoice) {
      alert('No se pudo cargar la factura a editar.');
      return;
    }

    const currentPaid = Number(existingInvoice.paid_amount || 0);
    if (normalizedPaymentType === 'TOTAL') {
      finalPaidAmount = total;
      finalBalance = 0;
    } else {
      finalPaidAmount = Math.min(Math.max(currentPaid, 0), total);
      finalBalance = Math.max(total - finalPaidAmount, 0);
    }
  } else {
    finalPaidAmount = normalizedPaymentType === 'TOTAL' ? total : 0;
    finalBalance = total - finalPaidAmount;
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
    if (!editingInvoiceId && normalizedPaymentType === 'TOTAL') {
      await registerInvoicePayment(invoiceResult.id, invoiceResult.total, 'TOTAL');
    }

    await recordAudit(editingInvoiceId ? 'update_invoice' : 'create_invoice', 'invoice', invoiceResult.id, { customerId, supplierId, invoiceNumber, total, type, paymentType: normalizedPaymentType, paidAmount: finalPaidAmount, balance: finalBalance });
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
  };

  const table = map[type];
  if (!table) return;

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

  title.textContent = 'Historial de abonos';
  body.innerHTML = '<div class="empty-state">Cargando abonos...</div>';
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

    if (!payments || payments.length === 0) {
      body.innerHTML = '<div class="empty-state">No hay abonos registrados para esta factura.</div>';
      return;
    }

    body.innerHTML = payments.map((payment) => `
      <div class="history-modal-item">
        <div class="history-modal-head">
          <strong>${payment.payment_type === 'TOTAL' ? 'Pago total' : 'Abono'}</strong>
          <span>${formatDate(payment.created_at)}</span>
        </div>
        <div class="history-modal-body-text">
          <span>Monto: ${formatMoney(payment.amount || 0)}</span>
          <span>Factura: ${invoiceData.invoice_number || '-'}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
    body.innerHTML = '<div class="empty-state">No se pudo cargar el historial de pagos.</div>';
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const forms = document.querySelectorAll('.auth-form');
  forms.forEach((form) => {
    form.classList.toggle('active-form', form.id === `${tabName}Form`);
  });
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

  updateVisibility();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.querySelectorAll('.history-tab').forEach((tab) => {
  tab.addEventListener('click', () => switchHistoryTab(tab.dataset.history));
});

document.getElementById('historyTypeFilter')?.addEventListener('change', async () => {
  await loadHistory();
});

document.getElementById('historyPaymentFilter')?.addEventListener('change', async () => {
  await loadHistory();
});

document.getElementById('invoiceHistoryBtn')?.addEventListener('click', () => openModuleHistory('invoice'));
document.getElementById('closeModuleHistory')?.addEventListener('click', () => {
  const modal = document.getElementById('moduleHistoryModal');
  if (modal) modal.classList.add('hidden');
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

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  await registerUser(name, email, password);
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

document.getElementById('invoiceType').addEventListener('change', async (event) => {
  const isPurchase = event.target.value === 'PURCHASE';
  const customerSelect = document.getElementById('invoiceCustomerId');
  const supplierSelect = document.getElementById('invoiceSupplierId');
  const productId = document.getElementById('invoiceProductId').value;

  await syncInvoiceNumber();

  if (customerSelect) {
    customerSelect.classList.toggle('hidden', isPurchase);
    customerSelect.disabled = isPurchase;
  }

  if (supplierSelect) {
    supplierSelect.classList.toggle('hidden', !isPurchase);
    supplierSelect.disabled = !isPurchase;
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

document.getElementById('productForm').addEventListener('submit', saveProduct);
document.getElementById('customerForm').addEventListener('submit', saveCustomer);
document.getElementById('supplierForm').addEventListener('submit', saveSupplier);
document.getElementById('invoiceForm').addEventListener('submit', saveInvoice);
refreshInvoiceFormDefaults();
document.getElementById('userForm').addEventListener('submit', saveUser);

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
    if (type === 'add-invoice-abono') {
      const invoice = (await supabaseClient.from('invoices').select('*').eq('id', id).single()).data;
      if (!invoice) return;
      await applyInvoiceAbono(invoice.id, Number(invoice.total || 0), Number(invoice.paid_amount || 0), Number(invoice.balance || 0));
    }
    return;
  }

  const deleteButton = event.target.closest('.action-btn');
  if (!deleteButton) return;

  const { id, type } = deleteButton.dataset;
  if (type === 'delete-product' || type === 'delete-customer' || type === 'delete-supplier' || type === 'delete-user') {
    await deleteRecord(type, id);
  }
});

(() => {
  if (!checkSupabaseSetup()) {
    renderUserState();
    return;
  }

  initSession();
})();
