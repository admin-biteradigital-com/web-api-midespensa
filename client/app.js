// ============================================================================
// Mi Despensa PWA — App Controller
// Uses AUTH FSM from auth-state.js as single source of truth
// ============================================================================

// --- Service Worker Registration ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("Service Worker registrado con éxito:", reg.scope))
      .catch(err => console.error("Error al registrar Service Worker:", err));
  });
}

// --- Local Presentation Cache (Owned by ApplicationOrchestrator via Domain Events) ---
// RULE: This cache is strictly for presentation/UI rendering purposes.
// The sole source of truth for session validity is the SessionModule.
let token = "";
let user = null;

// --- DOM References ---
const ui = {
  syncStatus:           document.getElementById("sync-status"),
  viewLoading:          document.getElementById("view-loading"),
  loadingTitle:         document.getElementById("loading-title"),
  loadingDesc:          document.getElementById("loading-desc"),
  viewAuth:             document.getElementById("view-auth"),
  viewAuthSent:         document.getElementById("view-auth-sent"),
  viewAuthFail:         document.getElementById("view-auth-fail"),
  viewAuthSuccess:      document.getElementById("view-auth-success"),
  viewSetupHogar:       document.getElementById("view-setup-hogar"),
  viewDashboard:        document.getElementById("view-dashboard"),
  inputEmail:           document.getElementById("login-email"),
  inputHogarName:       document.getElementById("hogar-name"),
  inputHogarJoinCode:   document.getElementById("hogar-join-code"),
  btnJoinHogar:         document.getElementById("btn-join-hogar"),
  btnShowInviteCode:    document.getElementById("btn-show-invite-code"),
  inputProductName:     document.getElementById("new-product-name"),
  inputProductQty:      document.getElementById("new-product-qty"),
  inputProductMin:      document.getElementById("new-product-min"),
  inputProductPrice:    document.getElementById("new-product-price"),
  inputProductCategory: document.getElementById("new-product-category"),
  inputProductCurrency: document.getElementById("new-product-currency"),
  tabFilterAll:         document.getElementById("tab-filter-all"),
  tabFilterLow:         document.getElementById("tab-filter-low"),
  inputSearchInventory: document.getElementById("input-search-inventory"),
  modalPriceHistory:    document.getElementById("modal-price-history"),
  modalPriceTitle:      document.getElementById("modal-price-title"),
  modalPriceList:       document.getElementById("modal-price-list"),
  btnClosePriceModal:   document.getElementById("btn-close-price-modal"),
  dashboardHogarName:   document.getElementById("dashboard-hogar-name"),
  dashboardUserIdentity:document.getElementById("dashboard-user-identity"),
  metricTotalItems:     document.getElementById("metric-total-items"),
  metricLowItems:       document.getElementById("metric-low-items"),
  inventoryContainer:   document.getElementById("inventory-list-container"),
  eventLogList:         document.getElementById("event-log-list"),
  toast:                document.getElementById("toast"),
  btnRequestLink:       document.getElementById("btn-request-link"),
  btnResendEmail:       document.getElementById("btn-resend-email"),
  btnChangeEmail:       document.getElementById("btn-change-email"),
  btnRequestNewLink:    document.getElementById("btn-request-new-link"),
  btnCreateHogar:       document.getElementById("btn-create-hogar"),
  btnCreateProduct:     document.getElementById("btn-add-product"),
  btnRefreshManual:     document.getElementById("btn-refresh-manual"),
  btnLogout:            document.getElementById("btn-logout"),
};

// --- View Map (viewId string → DOM element) ---
const VIEW_ELEMENTS = {
  "view-loading":      ui.viewLoading,
  "view-auth":         ui.viewAuth,
  "view-auth-sent":    ui.viewAuthSent,
  "view-auth-fail":    ui.viewAuthFail,
  "view-auth-success": ui.viewAuthSuccess,
  "view-setup-hogar":  ui.viewSetupHogar,
  "view-dashboard":    ui.viewDashboard,
};

// --- View Controller ---
function showView(viewId) {
  console.log("[showView] Solicitada:", viewId, "User:", user, "user.hogarId:", user ? user.hogarId : undefined);
  // Hide all views
  for (const el of Object.values(VIEW_ELEMENTS)) {
    if (el) el.classList.add("hidden");
  }
  
  // Resolve dashboard view dynamically to setup-hogar if no hogarId exists
  let targetViewId = viewId;
  if (viewId === "view-dashboard" && (!user || !user.hogarId)) {
    console.log("[showView] Guard activado: redirecting from view-dashboard to view-setup-hogar");
    targetViewId = "view-setup-hogar";
  }

  console.log("[showView] Mostrada finalmente:", targetViewId);
  // Show target
  const target = VIEW_ELEMENTS[targetViewId];
  if (target) {
    target.classList.remove("hidden");
  } else {
    console.error(`[VIEW] Unknown viewId: ${targetViewId}`);
  }

  // Dashboard side-effect
  if (targetViewId === "view-dashboard") {
    loadDashboard();
  }
}

function setLoadingMessage(title, desc) {
  if (ui.loadingTitle) ui.loadingTitle.textContent = title;
  if (ui.loadingDesc)  ui.loadingDesc.textContent  = desc;
}

// --- FSM Context (passed to setAuthState) ---
const fsmContext = {
  showView,
  setLoadingMessage,
  onTimeout: () => {
    showToast("La verificación tardó demasiado. Intenta nuevamente.");
    setAuthState(AUTH_STATES.AUTH_FAIL, fsmContext);
  },
};

// --- Toast ---
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  setTimeout(() => { ui.toast.classList.remove("show"); }, 3000);
}

// --- Sync Badge ---
function updateSyncBadge(status) {
  ui.syncStatus.className = "sync-badge";
  ui.syncStatus.textContent = status;
  if (status === "Sincronizado")      ui.syncStatus.classList.add("synced");
  else if (status === "Sincronizando...") ui.syncStatus.classList.add("syncing");
  else                                    ui.syncStatus.classList.add("offline");
}

// ============================================================================
// AUTH FLOW — Email-First Magic Link
// ============================================================================

// --- Request Magic Link ---
async function requestMagicLink(email) {
  if (!email) {
    showToast("Por favor ingresa un correo electrónico");
    return;
  }

  ui.btnRequestLink.disabled = true;
  ui.btnRequestLink.textContent = "Solicitando...";
  ui.btnResendEmail.disabled = true;
  ui.btnResendEmail.textContent = "Enviando...";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (res.ok && data.success) {
      showToast("¡Enlace de acceso enviado a tu correo!");
      console.log("[DEV ONLY] Token de Login:", data.token);
      console.log("[DEV ONLY] Link de Login:", data.debugUrl);
      setAuthState(AUTH_STATES.EMAIL_SENT, fsmContext);
    } else {
      showToast(data.error || "No se pudo enviar el enlace. Por favor, verifica tu correo.");
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      showToast("El servidor tardó demasiado en responder. Intenta de nuevo.");
    } else {
      showToast("No hay conexión con el servidor. Verifica tu internet.");
    }
    console.error(err);
  } finally {
    ui.btnRequestLink.disabled = false;
    ui.btnRequestLink.textContent = "Enviar enlace de acceso";
    ui.btnResendEmail.disabled = false;
    ui.btnResendEmail.textContent = "Reenviar correo";
  }
}

// --- Verify Token (Edge API) ---
async function verifyToken(tokenInput) {
  setAuthState(AUTH_STATES.AUTHENTICATING, fsmContext);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (res.ok && data.success) {
      // Delegate session initialization to SessionModule (Domain Layer)
      SessionModule.initSession(data.token, data.user);
      showToast("¡Ingreso exitoso!");
      return true;
    } else {
      setAuthState(AUTH_STATES.AUTH_FAIL, fsmContext);
      return false;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(err);
    if (err.name === "AbortError") {
      showToast("La verificación de acceso tardó demasiado tiempo.");
    } else {
      showToast("Error de conexión al verificar el enlace.");
    }
    setAuthState(AUTH_STATES.AUTH_FAIL, fsmContext);
    return false;
  }
}

// --- Event Listeners ---
ui.btnRequestLink.addEventListener("click", () => {
  requestMagicLink(ui.inputEmail.value.trim());
});

ui.btnResendEmail.addEventListener("click", () => {
  requestMagicLink(ui.inputEmail.value.trim());
});

ui.btnChangeEmail.addEventListener("click", () => {
  setAuthState(AUTH_STATES.EMAIL_ENTRY, fsmContext);
});

ui.btnRequestNewLink.addEventListener("click", () => {
  setAuthState(AUTH_STATES.EMAIL_ENTRY, fsmContext);
});

// ============================================================================
// HOGAR SETUP FLOW
// ============================================================================

ui.btnCreateHogar.addEventListener("click", async () => {
  const name = ui.inputHogarName.value.trim();
  if (!name) { showToast("Ingresa un nombre para tu hogar"); return; }

  ui.btnCreateHogar.disabled = true;
  ui.btnCreateHogar.textContent = "Creando...";

  try {
    const res = await fetch(`${API_BASE}/api/v1/hogar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Create a shallow copy of the user object to avoid mutating a frozen payload
      const updatedUser = { ...user, hogarId: data.hogar.id };
      // Persist new session details via SessionModule
      SessionModule.initSession(data.token, updatedUser);
      showToast("Hogar creado con éxito");
    } else {
      showToast(data.error || "No se pudo crear el hogar");
    }
  } catch (err) {
    showToast("Error de conexión");
    console.error(err);
  } finally {
    ui.btnCreateHogar.disabled = false;
    ui.btnCreateHogar.textContent = "Crear Hogar";
  }
});

if (ui.btnJoinHogar) {
  ui.btnJoinHogar.addEventListener("click", async () => {
    const hogarId = ui.inputHogarJoinCode.value.trim();
    if (!hogarId) {
      showToast("Ingresa el código de invitación del hogar");
      return;
    }

    ui.btnJoinHogar.disabled = true;
    ui.btnJoinHogar.textContent = "Uniéndote...";

    try {
      const res = await fetch(`${API_BASE}/api/v1/hogar/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ hogarId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedUser = { ...user, hogarId: data.hogar.id };
        SessionModule.initSession(data.token, updatedUser);
        showToast(`Te has unido a "${data.hogar.name}"`);
      } else {
        showToast(data.error || "No se pudo unirse al hogar");
      }
    } catch (err) {
      showToast("Error de conexión");
      console.error(err);
    } finally {
      ui.btnJoinHogar.disabled = false;
      ui.btnJoinHogar.textContent = "Unirme al Hogar";
    }
  });
}

if (ui.btnShowInviteCode) {
  ui.btnShowInviteCode.addEventListener("click", () => {
    if (!user || !user.hogarId) {
      showToast("No tienes un hogar asignado");
      return;
    }
    navigator.clipboard.writeText(user.hogarId)
      .then(() => showToast("Código de invitación copiado al portapapeles"))
      .catch(() => alert(`Tu código de invitación del hogar es:\n\n${user.hogarId}`));
  });
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard() {
  ui.dashboardUserIdentity.textContent = `Usuario: ${user.emailHash.substring(0, 8)}`;

  const localInventory = await getInventoryLocal();
  renderInventoryList(localInventory);

  if (navigator.onLine) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/hogar`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        ui.dashboardHogarName.textContent = data.hogar.name;
      }
    } catch (err) {
      console.warn("No se pudo obtener el nombre del hogar del servidor");
    }
    loadEventLogs();
  } else {
    ui.dashboardHogarName.textContent = "Mi Despensa (Offline)";
    ui.eventLogList.innerHTML = `<div class="empty-state">Historial de eventos disponible solo en línea.</div>`;
  }

  triggerSync();
}

async function loadEventLogs() {
  if (!navigator.onLine) return;

  try {
    const res = await fetch(`${API_BASE}/api/v1/events_stock`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      ui.eventLogList.innerHTML = "";
      if (data.events.length === 0) {
        ui.eventLogList.innerHTML = `<div class="empty-state">No hay eventos registrados en events_stock.</div>`;
        return;
      }
      data.events.forEach(evt => {
        const row = document.createElement("div");
        row.className = `event-row ${evt.event_type.toLowerCase()}`;
        row.innerHTML = `
          <span><strong>${evt.event_type === "ADD" ? "ALTA" : "BAJA"}</strong> ${evt.quantity_delta > 0 ? "+" + evt.quantity_delta : evt.quantity_delta} - Prod ID: ${evt.product_id.substring(0, 8)}...</span>
          <span class="event-time">${new Date(evt.timestamp).toLocaleTimeString()}</span>
        `;
        ui.eventLogList.appendChild(row);
      });
    }
  } catch (err) {
    console.error("Fallo al obtener logs:", err);
  }
}

let activeTab = "ALL"; // "ALL" | "LOW"
let searchQuery = "";
let selectedCategory = "ALL";

// Render dynamic stock cards
function renderInventoryList(items) {
  ui.inventoryContainer.innerHTML = "";

  // Actualizar métricas resumen UI/UX
  if (ui.metricTotalItems && ui.metricLowItems) {
    const totalCount = items.length;
    const lowCount = items.filter(i => i.quantity <= (i.min_stock !== undefined ? i.min_stock : 1)).length;
    ui.metricTotalItems.textContent = totalCount;
    ui.metricLowItems.textContent = lowCount;
  }

  const filteredItems = items.filter(item => {
    const matchesTab = activeTab === "LOW"
      ? item.quantity <= (item.min_stock !== undefined ? item.min_stock : 1)
      : true;
    const matchesQuery = searchQuery
      ? item.product_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesCat = selectedCategory === "ALL"
      ? true
      : (item.category || "Almacén") === selectedCategory;

    return matchesTab && matchesQuery && matchesCat;
  });

  if (filteredItems.length === 0) {
    const emptyMsg = searchQuery
      ? `No se encontraron productos que coincidan con "${searchQuery}".`
      : (selectedCategory !== "ALL"
          ? `No hay productos en la categoría "${selectedCategory}".`
          : (activeTab === "LOW"
              ? "¡Excelente! No tienes productos pendientes por recomprar."
              : "Tu alacena está vacía. ¡Agrega tu primer artículo!"));
    ui.inventoryContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.1 1.7 3.8 3.8 4v7.1c0 .5.4.9.9.9h2.6c.5 0 .9-.4.9-.9V13c2.1-.2 3.8-1.9 3.8-4V2h-2v7zm8-3h-2V2h-2v4h-2V2h-2v4c0 2.2 1.8 4 4 4v9.1c0 .5.4.9.9.9h.2c.5 0 .9-.4.9-.9V10c2.2 0 4-1.8 4-4V2h-2v4z"/></svg>
        ${emptyMsg}
      </div>
    `;
    return;
  }

  filteredItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "product-card";

    const info = document.createElement("div");
    info.className = "product-info";

    const name = document.createElement("span");
    name.className = "product-name";
    name.textContent = item.product_name;

    const catBadge = document.createElement("span");
    catBadge.style.fontSize = "10px";
    catBadge.style.padding = "2px 6px";
    catBadge.style.borderRadius = "10px";
    catBadge.style.background = "rgba(124, 58, 237, 0.15)";
    catBadge.style.color = "var(--primary-hover)";
    catBadge.style.marginLeft = "6px";
    catBadge.textContent = item.category || "Almacén";
    name.appendChild(catBadge);

    const minStock = item.min_stock !== undefined ? item.min_stock : 1;
    if (item.quantity <= minStock) {
      const lowBadge = document.createElement("span");
      lowBadge.className = "stock-badge-low";
      lowBadge.textContent = "⚠️ Recomprar";
      name.appendChild(lowBadge);
    }

    const updated = document.createElement("span");
    updated.className = "product-updated";
    updated.textContent = `Actualizado: ${new Date(item.updated_at).toLocaleTimeString()}`;

    const btnPrices = document.createElement("button");
    btnPrices.className = "btn-secondary";
    btnPrices.style.padding = "2px 6px";
    btnPrices.style.fontSize = "10px";
    btnPrices.style.marginTop = "4px";
    btnPrices.style.boxShadow = "none";
    btnPrices.textContent = "📊 Ver Precios";
    btnPrices.addEventListener("click", () => openPriceHistoryModal(item.product_name));

    info.appendChild(name);
    info.appendChild(updated);
    info.appendChild(btnPrices);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const btnMin = document.createElement("button");
    btnMin.className = "qty-btn";
    btnMin.textContent = "-";
    btnMin.addEventListener("click", () => handleUpdateQuantity(item.product_name, "REMOVE", 1));

    const qty = document.createElement("span");
    qty.className = "qty-number";
    qty.textContent = item.quantity;

    const btnAdd = document.createElement("button");
    btnAdd.className = "qty-btn";
    btnAdd.textContent = "+";
    btnAdd.addEventListener("click", () => handleUpdateQuantity(item.product_name, "ADD", 1));

    controls.appendChild(btnMin);
    controls.appendChild(qty);
    controls.appendChild(btnAdd);

    card.appendChild(info);
    card.appendChild(controls);
    ui.inventoryContainer.appendChild(card);
  });
}

// ============================================================================
// STOCK MANAGEMENT
// ============================================================================

async function handleUpdateQuantity(productName, eventType, delta, minStock = 1, category = "Almacén") {
  if (eventType === "REMOVE") {
    const currentList = await getInventoryLocal();
    const item = currentList.find(i => i.product_name === productName);
    if (!item || item.quantity - delta < 0) {
      showToast("La cantidad no puede ser menor a cero");
      return;
    }
    minStock = item.min_stock !== undefined ? item.min_stock : 1;
    category = item.category || "Almacén";
  }

  await enqueueOfflineEvent(productName, eventType, delta, minStock, category);
  const localInventory = await getInventoryLocal();
  renderInventoryList(localInventory);
  triggerSync();
}

ui.btnCreateProduct.addEventListener("click", async () => {
  const name = ui.inputProductName.value.trim();
  const qty = parseInt(ui.inputProductQty ? ui.inputProductQty.value : "1", 10) || 1;
  const minStock = parseInt(ui.inputProductMin ? ui.inputProductMin.value : "1", 10) || 1;
  const priceVal = parseFloat(ui.inputProductPrice ? ui.inputProductPrice.value : "");
  const categoryVal = ui.inputProductCategory ? ui.inputProductCategory.value : "Almacén";
  const currencyVal = ui.inputProductCurrency ? ui.inputProductCurrency.value : "UYU";

  if (!name) { showToast("Ingresa el nombre del producto"); return; }
  handleUpdateQuantity(name, "ADD", qty, minStock, categoryVal);

  if (!isNaN(priceVal) && priceVal > 0 && token) {
    try {
      await fetch(`${API_BASE}/api/v1/prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_name: name, price: priceVal, currency: currencyVal }),
      });
    } catch (err) {
      console.warn("No se pudo registrar el precio histórico:", err);
    }
  }

  ui.inputProductName.value = "";
  if (ui.inputProductQty) ui.inputProductQty.value = "1";
  if (ui.inputProductMin) ui.inputProductMin.value = "1";
  if (ui.inputProductPrice) ui.inputProductPrice.value = "";
});

// ============================================================================
// SYNC ENGINE
// ============================================================================

let isSyncing = false;
async function triggerSync() {
  if (isSyncing) return;
  isSyncing = true;

  const updatedList = await syncEngine(token, (status) => {
    updateSyncBadge(status);
  });

  if (updatedList) {
    renderInventoryList(updatedList);
    loadEventLogs();
  }

  isSyncing = false;
}

const catPills = document.querySelectorAll(".cat-pill");
if (catPills.length > 0) {
  catPills.forEach(pill => {
    pill.addEventListener("click", async () => {
      catPills.forEach(p => {
        p.style.background = "rgba(0,0,0,0.2)";
        p.style.color = "var(--text-muted)";
        p.style.borderColor = "var(--border-color)";
      });
      pill.style.background = "var(--primary)";
      pill.style.color = "#fff";
      pill.style.borderColor = "var(--primary)";

      selectedCategory = pill.getAttribute("data-cat") || "ALL";
      const items = await getInventoryLocal();
      renderInventoryList(items);
    });
  });
}

if (ui.inputSearchInventory) {
  ui.inputSearchInventory.addEventListener("input", async (e) => {
    searchQuery = e.target.value.trim();
    const items = await getInventoryLocal();
    renderInventoryList(items);
  });
}

if (ui.btnClosePriceModal && ui.modalPriceHistory) {
  ui.btnClosePriceModal.addEventListener("click", () => {
    ui.modalPriceHistory.classList.add("hidden");
  });
}

async function openPriceHistoryModal(productName) {
  if (!ui.modalPriceHistory || !ui.modalPriceTitle || !ui.modalPriceList) return;

  ui.modalPriceTitle.textContent = `Precios: ${productName}`;
  ui.modalPriceList.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">Cargando historial...</div>`;
  ui.modalPriceHistory.classList.remove("hidden");

  if (!token) {
    ui.modalPriceList.innerHTML = `<div style="font-size: 12px; color: var(--accent-red);">Inicia sesión para ver precios.</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/prices?product_name=${encodeURIComponent(productName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("No se pudo obtener el historial de precios");

    const data = await res.json();
    const history = data.price_history || [];

    if (history.length === 0) {
      ui.modalPriceList.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center;">No hay precios registrados para este producto.</div>`;
      return;
    }

    ui.modalPriceList.innerHTML = "";
    history.forEach(p => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "8px 12px";
      row.style.borderRadius = "var(--radius-sm)";
      row.style.background = "rgba(0, 0, 0, 0.2)";
      row.style.fontSize = "12px";

      const priceTag = document.createElement("span");
      priceTag.style.fontWeight = "600";
      priceTag.style.color = "var(--accent-green)";
      priceTag.textContent = `${p.currency} $${p.price.toFixed(2)}`;

      const timeTag = document.createElement("span");
      timeTag.style.color = "var(--text-muted)";
      timeTag.style.fontSize = "11px";
      timeTag.textContent = new Date(p.timestamp).toLocaleDateString();

      row.appendChild(priceTag);
      row.appendChild(timeTag);
      ui.modalPriceList.appendChild(row);
    });
  } catch (err) {
    ui.modalPriceList.innerHTML = `<div style="font-size: 12px; color: var(--accent-red);">Error al cargar precios.</div>`;
  }
}

// ============================================================================
// APPLICATION ORCHESTRATOR
// ============================================================================

const ApplicationOrchestrator = (function () {
  let _eventBus = null;
  let _sessionModule = null;
  let _fsmContext = null;

  function setupListeners() {
    if (!_eventBus) return;

    // 1. Listen for new logins
    _eventBus.on("UserAuthenticated", (event) => {
      console.log("[Orchestrator] UserAuthenticated domain event received.");
      token = event.data.token;
      user = event.data.user;
      if (getAuthState() !== AUTH_STATES.AUTH_SUCCESS) {
        setAuthState(AUTH_STATES.AUTH_SUCCESS, _fsmContext);
      }
      routeToAppView();
    });

    // 2. Listen for rehydrated sessions
    _eventBus.on("SessionRestored", (event) => {
      console.log("[Orchestrator] SessionRestored domain event received.");
      token = event.data.token;
      user = event.data.user;
      if (getAuthState() !== AUTH_STATES.AUTH_SUCCESS) {
        setAuthState(AUTH_STATES.AUTH_SUCCESS, _fsmContext);
      }
      routeToAppView();
    });

    // 3. Listen for logouts
    _eventBus.on("SessionCleared", () => {
      console.log("[Orchestrator] SessionCleared domain event received.");
      token = "";
      user = null;
      setAuthState(AUTH_STATES.EMAIL_ENTRY, _fsmContext);
    });

    // 4. Listen for session expiration triggers (e.g. from network layers)
    _eventBus.on("SessionExpired", (event) => {
      console.log("[Orchestrator] SessionExpired domain event received.");
      token = "";
      user = null;
      showToast("Tu sesión ha expirado. Por favor ingresa nuevamente.");
      setAuthState(AUTH_STATES.AUTH_FAIL, _fsmContext);
    });
  }

  function routeToAppView() {
    console.log("[routeToAppView] Ejecutada. User:", user, "user.hogarId:", user ? user.hogarId : undefined);
    if (user && user.hogarId) {
      showView("view-dashboard");
    } else {
      showView("view-setup-hogar");
    }
  }

  return {
    initialize(eventBus, sessionModule, fsmContext) {
      _eventBus = eventBus;
      _sessionModule = sessionModule;
      _fsmContext = fsmContext;
      setupListeners();
      console.log("[Orchestrator] Initialized and listening to domain events.");
    },

    async boot() {
      setAuthState(AUTH_STATES.BOOTSTRAP, _fsmContext);

      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");

      if (tokenFromUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthState(AUTH_STATES.LOADING_VERIFY, _fsmContext);
        await verifyToken(tokenFromUrl);
      } else {
        setAuthState(AUTH_STATES.SESSION_REHYDRATING, _fsmContext);
        const session = _sessionModule.rehydrateSession();
        if (!session) {
          // Guard: rehydrateSession() may have already cleared the session internally
          // (e.g. schema mismatch, expired JWT), which triggers SessionCleared → EMAIL_ENTRY
          // via the event listener. Avoid the redundant transition.
          if (getAuthState() !== AUTH_STATES.EMAIL_ENTRY) {
            setAuthState(AUTH_STATES.EMAIL_ENTRY, _fsmContext);
          }
        }
      }
    }
  };
})();

// ============================================================================
// LOGOUT
// ============================================================================

ui.btnLogout.addEventListener("click", () => {
  showToast("Sesión cerrada");
  // Clean up session via SessionModule. Events will handle state reset.
  SessionModule.clearSession();
});

// ============================================================================
// NETWORK LISTENERS
// ============================================================================

window.addEventListener("online", () => {
  showToast("Conexión restablecida. Sincronizando...");
  triggerSync();
});

window.addEventListener("offline", () => {
  showToast("Modo sin conexión activado.");
  updateSyncBadge("Offline (Sin Conexión)");
});

// ============================================================================
// APP INITIALIZATION
// ============================================================================

async function initApp() {
  // 1. Inject FSM dependencies
  setFSMEventBus(EventBus);

  // 2. Initialize Session Module
  SessionModule.initialize(EventBus, DOMAIN_EVENTS);

  // 3. Initialize and Boot Application Orchestrator
  ApplicationOrchestrator.initialize(EventBus, SessionModule, fsmContext);
  await ApplicationOrchestrator.boot();

  // Network state
  if (!navigator.onLine) {
    updateSyncBadge("Offline (Sin Conexión)");
  } else {
    updateSyncBadge("Sincronizado");
  }
}

// --- Launch ---
initApp();
