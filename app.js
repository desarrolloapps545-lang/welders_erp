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
  inventory: document.getElementById('inventoryView'),
  invoices: document.getElementById('invoicesView'),
  history: document.getElementById('historyView'),
  users: document.getElementById('usersView'),
};

function showMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? '#fca5a5' : '#86efac';
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

function applyFormattedNumberListener(elementId, allowDecimal = true) {
  const element = document.getElementById(elementId);
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
    inventory: 'Inventario',
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
    if (viewName === 'products') await loadProducts();
    if (viewName === 'customers') await loadCustomers();
    if (viewName === 'suppliers') await loadSuppliers();
    if (viewName === 'inventory') await loadInventory();
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
    userNameLabel.textContent = state.currentUser.email || 'Usuario';
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

async function loadDashboard() {
  const [productsResult, customersResult, suppliersResult, usersResult] = await Promise.all([
    supabaseClient.from('products').select('*'),
    supabaseClient.from('customers').select('*'),
    supabaseClient.from('suppliers').select('*'),
    supabaseClient.from('profiles').select('*'),
  ]);

  document.getElementById('productsTotal').textContent = productsResult.data?.length ?? 0;
  document.getElementById('customersTotal').textContent = customersResult.data?.length ?? 0;
  document.getElementById('suppliersTotal').textContent = suppliersResult.data?.length ?? 0;
  document.getElementById('usersTotal').textContent = usersResult.data?.length ?? 0;
}

function fillProductSelects() {
  const options = ['<option value="">Seleccione</option>'];
  const productSelects = [document.getElementById('inventoryProductId'), document.getElementById('invoiceProductId')];

  productSelects.forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Seleccione</option>';
  });

  return async function refreshProductsList(data = []) {
    const allOptions = data.map((product) => `<option value="${product.id}">${product.name} (${product.measure || 'und'})</option>`).join('');
    productSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="">Seleccione</option>' + allOptions;
    });
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
      <td>${product.code || '-'}</td>
      <td>${product.name || '-'}</td>
      <td>${product.measure || 'und'}</td>
      <td>${formatMoney(product.price || 0)}</td>
      <td>${product.stock ?? 0}</td>
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
      <td>${customer.phone || '-'}</td>
      <td>${customer.email || '-'}</td>
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
      <td>${supplier.phone || '-'}</td>
      <td>${supplier.email || '-'}</td>
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

async function loadInventory() {
  const [productsResult, inventoryResult] = await Promise.all([
    supabaseClient.from('products').select('*'),
    supabaseClient.from('inventory_movements').select('*').order('created_at', { ascending: false }),
  ]);

  const productSelect = document.getElementById('inventoryProductId');
  if (productSelect) {
    productSelect.innerHTML = '<option value="">Seleccione producto</option>' + (productsResult.data || []).map((p) => `<option value="${p.id}">${p.name} (${p.measure || 'und'})</option>`).join('');
  }

  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = '';

  if (!inventoryResult.data || inventoryResult.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay movimientos de inventario.</td></tr>';
    return;
  }

  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));

  inventoryResult.data.forEach((movement) => {
    const product = productMap.get(movement.product_id);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${getTypeLabel(movement.type)}</td>
      <td>${product ? product.name : '-'}</td>
      <td>${movement.quantity ?? 0}</td>
      <td>${movement.measure || '-'}</td>
      <td>${movement.note || '-'}</td>
      <td>${formatDate(movement.created_at)}</td>
    `;
    tbody.appendChild(row);
  });
}

async function openModuleHistory(module) {
  const modal = document.getElementById('moduleHistoryModal');
  const title = document.getElementById('moduleHistoryTitle');
  const body = document.getElementById('moduleHistoryBody');

  if (!modal || !title || !body) return;

  title.textContent = module === 'inventory' ? 'Historial de inventario' : 'Historial de facturación';
  body.innerHTML = '<div class="empty-state">Cargando...</div>';
  modal.classList.remove('hidden');

  try {
    if (module === 'inventory') {
      const [productsResult, movementsResult] = await Promise.all([
        supabaseClient.from('products').select('*'),
        supabaseClient.from('inventory_movements').select('*').order('created_at', { ascending: false }),
      ]);

      const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
      const rows = (movementsResult.data || []).map((movement) => {
        const product = productMap.get(movement.product_id);
        return `
          <div class="history-modal-item">
            <div class="history-modal-head">
              <strong>${getTypeLabel(movement.type)}</strong>
              <span>${formatDate(movement.created_at)}</span>
            </div>
            <div class="history-modal-body-text">
              <span>Producto: ${product ? product.name : 'Sin producto'}</span>
              <span>Cantidad: ${movement.quantity ?? 0} ${movement.measure || product?.measure || 'und'}</span>
              <span>Nota: ${movement.note || 'Sin observación'}</span>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = rows || '<div class="empty-state">No hay movimientos de inventario.</div>';
      return;
    }

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
            <span>Total: ${formatMoney(invoice.total || 0)}</span>
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
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay facturas.</td></tr>';
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
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${invoice.invoice_number || '-'}</td>
      <td>${getTypeLabel(type)}</td>
      <td>${partyName}</td>
      <td>${product ? product.name : '-'}</td>
      <td>${invoice.quantity ?? 0}</td>
      <td>${formatMoney(invoice.total || 0)}</td>
      <td>${formatDate(invoice.created_at)}</td>
    `;
    tbody.appendChild(row);
  });
}

async function loadHistory() {
  const selectedFilter = document.getElementById('historyFilter')?.value || 'all';

  const [movementsResult, invoicesResult, productsResult, customersResult, suppliersResult] = await Promise.all([
    supabaseClient.from('inventory_movements').select('*').order('created_at', { ascending: false }),
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

  (movementsResult.data || []).forEach((movement) => {
    const product = productMap.get(movement.product_id);
    const typeLabel = movement.type === 'ENTRY' ? 'Entrada' : movement.type === 'EXIT' ? 'Salida' : 'Ajuste';
    rows.push({
      source: 'inventory',
      created_at: movement.created_at,
      type: typeLabel,
      typeKey: movement.type || 'ENTRY',
      product: product ? product.name : 'Producto',
      quantity: `${movement.quantity ?? 0} ${movement.measure || product?.measure || 'und'}`,
      totalCompra: '-',
      totalVenta: '-',
      detail: movement.note || 'Sin observación',
    });
  });

  (invoicesResult.data || []).forEach((invoice) => {
    const product = productMap.get(invoice.product_id);
    const partyName = invoice.type === 'PURCHASE'
      ? supplierMap.get(invoice.supplier_id)?.name || 'Proveedor'
      : customerMap.get(invoice.customer_id)?.name || 'Cliente';

    rows.push({
      source: 'invoice',
      created_at: invoice.created_at,
      type: invoice.type === 'PURCHASE' ? 'Compra' : 'Venta',
      typeKey: invoice.type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
      product: product ? product.name : 'Producto',
      quantity: `${invoice.quantity ?? 0} ${product?.measure || 'und'}`,
      totalCompra: invoice.type === 'PURCHASE' ? formatMoney(invoice.total || 0) : '-',
      totalVenta: invoice.type === 'SALE' ? formatMoney(invoice.total || 0) : '-',
      detail: `${invoice.type === 'PURCHASE' ? 'Compra a' : 'Venta a'} ${partyName}`,
    });
  });

  const filteredRows = rows.filter((row) => selectedFilter === 'all' || row.source === selectedFilter);
  filteredRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filteredRows.length === 0) {
    const emptyMessage = selectedFilter === 'all'
      ? 'No hay movimientos de inventario ni facturación.'
      : selectedFilter === 'inventory'
        ? 'No hay movimientos de inventario para este filtro.'
        : 'No hay facturas para este filtro.';

    generalBody.innerHTML = `<tr><td colspan="7" class="empty-state">${emptyMessage}</td></tr>`;
    personalBody.innerHTML = `<tr><td colspan="7" class="empty-state">${emptyMessage}</td></tr>`;
    return;
  }

  filteredRows.forEach((row) => {
    const badgeClass = row.typeKey === 'ENTRY' ? 'history-badge-entry' : row.typeKey === 'EXIT' ? 'history-badge-exit' : row.typeKey === 'PURCHASE' ? 'history-badge-purchase' : row.typeKey === 'SALE' ? 'history-badge-sale' : 'history-badge-adjust';

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
    loadInventory(),
    loadInvoices(),
    loadUsers(),
    loadHistory(),
  ]);
}

async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const payload = {
    name: document.getElementById('productName').value.trim(),
    code: document.getElementById('productCode').value.trim(),
    price: parseFormattedNumber(document.getElementById('productPrice').value),
    stock: parseFormattedNumber(document.getElementById('productStock').value),
    measure: document.getElementById('productMeasure').value.trim() || 'und',
    supplier_id: document.getElementById('productSupplierId').value || null,
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

  form.reset();
  delete form.dataset.editingId;
  document.getElementById('productSubmitBtn').textContent = 'Guardar';
  await loadAllModules();
}

async function saveCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const payload = {
    name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
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

  form.reset();
  delete form.dataset.editingId;
  document.getElementById('customerSubmitBtn').textContent = 'Guardar';
  await loadAllModules();
}

async function saveSupplier(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const payload = {
    name: document.getElementById('supplierName').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
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

  form.reset();
  delete form.dataset.editingId;
  document.getElementById('supplierSubmitBtn').textContent = 'Guardar';
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
  if (form && typeof form.reset === 'function') {
    form.reset();
  }
  await loadAllModules();
}

async function saveInvoice(event) {
  event.preventDefault();

  const type = document.getElementById('invoiceType').value || 'SALE';
  const customerId = document.getElementById('invoiceCustomerId').value;
  const supplierId = document.getElementById('invoiceSupplierId').value;
  const invoiceNumber = document.getElementById('invoiceNumber').value.trim();
  const productId = document.getElementById('invoiceProductId').value;
  const quantity = parseFormattedNumber(document.getElementById('invoiceQty').value);
  const price = parseFormattedNumber(document.getElementById('invoicePrice').value);
  const note = document.getElementById('invoiceNote').value.trim();

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

  const total = quantity * price;
  let newStock = Number(productData.stock || 0);

  if (type === 'SALE' && quantity > newStock) {
    alert(`No hay suficiente stock para vender ${productData.name}. Stock actual: ${newStock}.`);
    return;
  }

  if (type === 'PURCHASE') {
    newStock += quantity;
  } else {
    newStock -= quantity;
  }

  const { data: invoiceData, error: invoiceError } = await supabaseClient.from('invoices').insert([
    {
      type,
      customer_id: type === 'SALE' ? customerId : null,
      supplier_id: type === 'PURCHASE' ? supplierId : null,
      invoice_number: invoiceNumber,
      product_id: productId,
      quantity,
      total,
      status: 'PENDING',
      note,
    },
  ]).select();

  if (invoiceError) {
    alert(invoiceError.message);
    return;
  }

  const { error: stockError } = await supabaseClient
    .from('products')
    .update({ stock: newStock, measure: productData.measure || 'und' })
    .eq('id', productId);

  if (stockError) {
    alert('La factura se guardó, pero no se pudo actualizar el stock: ' + stockError.message);
    return;
  }

  const { error: movementError } = await supabaseClient.from('inventory_movements').insert([
    {
      product_id: productId,
      type: type === 'PURCHASE' ? 'ENTRY' : 'EXIT',
      quantity,
      measure: productData.measure || 'und',
      note: `Factura ${invoiceNumber}`,
    },
  ]);

  if (movementError) {
    alert('La factura y el stock se actualizaron, pero falló el movimiento de inventario: ' + movementError.message);
    return;
  }

  if (invoiceData && invoiceData[0]) {
    await recordAudit('create_invoice', 'invoice', invoiceData[0].id, { customerId, supplierId, invoiceNumber, total, type });
  }

  event.currentTarget.reset();
  await loadAllModules();
}

async function saveUser(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const id = form.dataset.editingId || null;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const password = document.getElementById('adminUserPassword').value;
  const role = document.getElementById('userRole').value;

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
    form.reset();
    delete form.dataset.editingId;
    document.getElementById('userSubmitBtn').textContent = 'Guardar';
    document.getElementById('adminUserPassword').required = true;
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
  form.reset();
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

async function startEditProduct(id) {
  const { data, error } = await supabaseClient.from('products').select('*').eq('id', id).single();
  if (error) return;

  document.getElementById('productName').value = data.name || '';
  document.getElementById('productCode').value = data.code || '';
  document.getElementById('productPrice').value = formatNumberInput(String(Number(data.price || 0)), true);
  document.getElementById('productStock').value = formatNumberInput(String(Number(data.stock || 0)), false);
  document.getElementById('productMeasure').value = data.measure || 'und';
  document.getElementById('productSupplierId').value = data.supplier_id || '';
  document.getElementById('productForm').dataset.editingId = id;
  document.getElementById('productSubmitBtn').textContent = 'Actualizar';
  await setActiveView('products');
}

async function startEditCustomer(id) {
  const { data, error } = await supabaseClient.from('customers').select('*').eq('id', id).single();
  if (error) return;

  document.getElementById('customerName').value = data.name || '';
  document.getElementById('customerPhone').value = data.phone || '';
  document.getElementById('customerEmail').value = data.email || '';
  document.getElementById('customerForm').dataset.editingId = id;
  document.getElementById('customerSubmitBtn').textContent = 'Actualizar';
}

async function startEditSupplier(id) {
  const { data, error } = await supabaseClient.from('suppliers').select('*').eq('id', id).single();
  if (error) return;

  document.getElementById('supplierName').value = data.name || '';
  document.getElementById('supplierPhone').value = data.phone || '';
  document.getElementById('supplierEmail').value = data.email || '';
  document.getElementById('supplierForm').dataset.editingId = id;
  document.getElementById('supplierSubmitBtn').textContent = 'Actualizar';
}

async function startEditUser(id) {
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
  if (error) return;

  document.getElementById('userName').value = data.full_name || '';
  document.getElementById('userEmail').value = data.email || '';
  document.getElementById('userRole').value = data.role || 'VIEWER';
  document.getElementById('adminUserPassword').value = '';
  document.getElementById('userForm').dataset.editingId = id;
  document.getElementById('userSubmitBtn').textContent = 'Actualizar';
  document.getElementById('adminUserPassword').required = false;
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

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.querySelectorAll('.history-tab').forEach((tab) => {
  tab.addEventListener('click', () => switchHistoryTab(tab.dataset.history));
});

document.getElementById('historyFilter')?.addEventListener('change', async () => {
  await loadHistory();
});

document.getElementById('inventoryHistoryBtn')?.addEventListener('click', () => openModuleHistory('inventory'));
document.getElementById('invoiceHistoryBtn')?.addEventListener('click', () => openModuleHistory('invoice'));
document.getElementById('closeModuleHistory')?.addEventListener('click', () => {
  const modal = document.getElementById('moduleHistoryModal');
  if (modal) modal.classList.add('hidden');
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

applyFormattedNumberListener('productPrice', false);
applyFormattedNumberListener('productStock', false);
applyFormattedNumberListener('inventoryQty', false);
applyFormattedNumberListener('invoiceQty', false);
applyFormattedNumberListener('invoicePrice', false);

document.getElementById('inventoryProductId').addEventListener('change', async (event) => {
  const productId = event.target.value;
  if (!productId) {
    document.getElementById('inventoryMeasure').value = '';
    return;
  }

  const { data, error } = await supabaseClient
    .from('products')
    .select('measure')
    .eq('id', productId)
    .single();

  if (!error && data) {
    document.getElementById('inventoryMeasure').value = data.measure || 'und';
  }
});

document.getElementById('invoiceType').addEventListener('change', (event) => {
  const isPurchase = event.target.value === 'PURCHASE';
  const customerSelect = document.getElementById('invoiceCustomerId');
  const supplierSelect = document.getElementById('invoiceSupplierId');

  if (customerSelect) {
    customerSelect.classList.toggle('hidden', isPurchase);
    customerSelect.disabled = isPurchase;
  }

  if (supplierSelect) {
    supplierSelect.classList.toggle('hidden', !isPurchase);
    supplierSelect.disabled = !isPurchase;
  }
});

document.getElementById('productForm').addEventListener('submit', saveProduct);
document.getElementById('customerForm').addEventListener('submit', saveCustomer);
document.getElementById('supplierForm').addEventListener('submit', saveSupplier);
document.getElementById('inventoryForm').addEventListener('submit', saveInventoryMovement);
document.getElementById('invoiceForm').addEventListener('submit', saveInvoice);
document.getElementById('userForm').addEventListener('submit', saveUser);

document.addEventListener('click', async (event) => {
  const button = event.target.closest('.secondary-action-btn');
  if (button) {
    const { id, type } = button.dataset;
    if (type === 'edit-product') await startEditProduct(id);
    if (type === 'edit-customer') await startEditCustomer(id);
    if (type === 'edit-supplier') await startEditSupplier(id);
    if (type === 'edit-user') await startEditUser(id);
    if (type === 'reset-user-password') await resetPasswordForUser(id);
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
