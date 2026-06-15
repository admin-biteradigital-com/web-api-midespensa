// Registrar Service Worker para soporte offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("Service Worker registrado con éxito:", reg.scope))
      .catch(err => console.error("Error al registrar Service Worker:", err));
  });
}

// Estado Global de la Aplicación
let token = localStorage.getItem("token") || "";
let user = JSON.parse(localStorage.getItem("user") || "null");

const ui = {
  syncStatus: document.getElementById("sync-status"),
  viewAuth: document.getElementById("view-auth"),
  viewSetupHogar: document.getElementById("view-setup-hogar"),
  viewDashboard: document.getElementById("view-dashboard"),
  authStepEmail: document.getElementById("auth-step-email"),
  authStepVerify: document.getElementById("auth-step-verify"),
  inputEmail: document.getElementById("login-email"),
  inputToken: document.getElementById("verify-token"),
  inputHogarName: document.getElementById("hogar-name"),
  inputProductName: document.getElementById("new-product-name"),
  dashboardHogarName: document.getElementById("dashboard-hogar-name"),
  dashboardUserIdentity: document.getElementById("dashboard-user-identity"),
  inventoryContainer: document.getElementById("inventory-list-container"),
  eventLogList: document.getElementById("event-log-list"),
  toast: document.getElementById("toast"),
  
  // Botones
  btnRequestLink: document.getElementById("btn-request-link"),
  btnSubmitToken: document.getElementById("btn-submit-token"),
  btnBackEmail: document.getElementById("btn-back-email"),
  btnCreateHogar: document.getElementById("btn-create-hogar"),
  btnCreateProduct: document.getElementById("btn-add-product"),
  btnRefreshManual: document.getElementById("btn-refresh-manual"),
  btnLogout: document.getElementById("btn-logout")
};

// --- Gestión de Vistas ---
function showView(viewId) {
  ui.viewAuth.classList.add("hidden");
  ui.viewSetupHogar.classList.add("hidden");
  ui.viewDashboard.classList.add("hidden");
  
  if (viewId === "auth") {
    ui.viewAuth.classList.remove("hidden");
  } else if (viewId === "setup") {
    ui.viewSetupHogar.classList.remove("hidden");
  } else if (viewId === "dashboard") {
    ui.viewDashboard.classList.remove("hidden");
    loadDashboard();
  }
}

function updateSyncBadge(status) {
  ui.syncStatus.className = "sync-badge";
  ui.syncStatus.textContent = status;
  
  if (status === "Sincronizado") {
    ui.syncStatus.classList.add("synced");
  } else if (status === "Sincronizando...") {
    ui.syncStatus.classList.add("syncing");
  } else {
    ui.syncStatus.classList.add("offline");
  }
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  setTimeout(() => {
    ui.toast.classList.remove("show");
  }, 3000);
}

// --- Flujo de Autenticación ---

// 1. Solicitar Magic Link
ui.btnRequestLink.addEventListener("click", async () => {
  const email = ui.inputEmail.value.trim();
  if (!email) {
    showToast("Por favor ingresa un correo");
    return;
  }
  
  ui.btnRequestLink.disabled = true;
  ui.btnRequestLink.textContent = "Solicitando...";
  
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      showToast("Magic Link simulado con éxito!");
      console.log(`[DEV ONLY] Token de Login:`, data.token);
      console.log(`[DEV ONLY] Link de Login:`, data.debugUrl);
      
      // Auto rellenar el input del token para facilitar el testing
      ui.inputToken.value = data.token;
      
      ui.authStepEmail.classList.add("hidden");
      ui.authStepVerify.classList.remove("hidden");
    } else {
      showToast(data.error || "Fallo al solicitar Magic Link");
    }
  } catch (err) {
    showToast("Error de conexión");
    console.error(err);
  } finally {
    ui.btnRequestLink.disabled = false;
    ui.btnRequestLink.textContent = "Obtener Magic Link";
  }
});

// Volver al paso 1
ui.btnBackEmail.addEventListener("click", () => {
  ui.authStepVerify.classList.add("hidden");
  ui.authStepEmail.classList.remove("hidden");
});

// 2. Verificar Token e Iniciar Sesión
ui.btnSubmitToken.addEventListener("click", async () => {
  const tokenInput = ui.inputToken.value.trim();
  if (!tokenInput) {
    showToast("Ingresa el token");
    return;
  }
  
  ui.btnSubmitToken.disabled = true;
  ui.btnSubmitToken.textContent = "Verificando...";
  
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      token = data.token;
      user = data.user;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      showToast("Inicio de sesión exitoso");
      
      if (user.hogarId) {
        showView("dashboard");
      } else {
        showView("setup");
      }
    } else {
      showToast(data.error || "Token inválido");
    }
  } catch (err) {
    showToast("Error de conexión al verificar");
    console.error(err);
  } finally {
    ui.btnSubmitToken.disabled = false;
    ui.btnSubmitToken.textContent = "Iniciar Sesión";
  }
});

// --- Flujo de Configuración de Hogar ---
ui.btnCreateHogar.addEventListener("click", async () => {
  const name = ui.inputHogarName.value.trim();
  if (!name) {
    showToast("Ingresa un nombre para tu hogar");
    return;
  }
  
  ui.btnCreateHogar.disabled = true;
  ui.btnCreateHogar.textContent = "Creando...";
  
  try {
    const res = await fetch(`${API_BASE}/api/v1/hogar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      token = data.token; // Guardar el nuevo token con el claim de hogarId
      user.hogarId = data.hogar.id;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      
      showToast("Hogar creado con éxito");
      showView("dashboard");
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

// --- Flujo del Dashboard ---
async function loadDashboard() {
  ui.dashboardUserIdentity.textContent = `Identidad (SHA-256): ${user.emailHash.substring(0, 15)}...`;
  
  // Renderizado inicial desde IndexedDB
  const localInventory = await getInventoryLocal();
  renderInventoryList(localInventory);
  
  // Consultar nombre del hogar (solo si estamos online)
  if (navigator.onLine) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/hogar`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        ui.dashboardHogarName.textContent = data.hogar.name;
      }
    } catch (err) {
      console.warn("No se pudo obtener el nombre del hogar del servidor");
    }
    
    // Obtener logs de eventos
    loadEventLogs();
  } else {
    ui.dashboardHogarName.textContent = "Mi Despensa (Offline)";
    ui.eventLogList.innerHTML = `<div class="empty-state">Historial de eventos disponible solo en línea.</div>`;
  }
  
  // Ejecutar motor de sincronización de fondo
  triggerSync();
}

async function loadEventLogs() {
  if (!navigator.onLine) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/v1/events_stock`, {
      headers: { "Authorization": `Bearer ${token}` }
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

function renderInventoryList(items) {
  ui.inventoryContainer.innerHTML = "";
  
  if (items.length === 0) {
    ui.inventoryContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.1 1.7 3.8 3.8 4v7.1c0 .5.4.9.9.9h2.6c.5 0 .9-.4.9-.9V13c2.1-.2 3.8-1.9 3.8-4V2h-2v7zm8-3h-2V2h-2v4h-2V2h-2v4c0 2.2 1.8 4 4 4v9.1c0 .5.4.9.9.9h.2c.5 0 .9-.4.9-.9V10c2.2 0 4-1.8 4-4V2h-2v4z"/></svg>
        Tu alacena está vacía. ¡Agrega tu primer artículo!
      </div>
    `;
    return;
  }
  
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "product-card";
    
    const info = document.createElement("div");
    info.className = "product-info";
    
    const name = document.createElement("span");
    name.className = "product-name";
    name.textContent = item.product_name;
    
    const updated = document.createElement("span");
    updated.className = "product-updated";
    updated.textContent = `Actualizado: ${new Date(item.updated_at).toLocaleTimeString()}`;
    
    info.appendChild(name);
    info.appendChild(updated);
    
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

// --- Manejo de Acciones sobre el Stock ---
async function handleUpdateQuantity(productName, eventType, delta) {
  // Comprobar invariante de stock no negativo localmente antes de encolar
  if (eventType === "REMOVE") {
    const currentList = await getInventoryLocal();
    const item = currentList.find(i => i.product_name === productName);
    if (!item || item.quantity - delta < 0) {
      showToast("La cantidad no puede ser menor a cero");
      return;
    }
  }

  // Guardar cambio en IndexedDB local e incremental
  await enqueueOfflineEvent(productName, eventType, delta);
  
  // Renderizar la UI de inmediato (Optimistic UI)
  const localInventory = await getInventoryLocal();
  renderInventoryList(localInventory);
  
  // Sincronizar de fondo si hay red
  triggerSync();
}

// Agregar artículo completo
ui.btnCreateProduct.addEventListener("click", () => {
  const name = ui.inputProductName.value.trim();
  if (!name) {
    showToast("Ingresa el nombre del producto");
    return;
  }
  
  handleUpdateQuantity(name, "ADD", 1);
  ui.inputProductName.value = "";
});

// --- Motor de Sincronización ---
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

// Refresco manual
ui.btnRefreshManual.addEventListener("click", () => {
  triggerSync();
  showToast("Actualizando datos...");
});

// Cerrar sesión
ui.btnLogout.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  token = "";
  user = null;
  showToast("Sesión cerrada");
  showView("auth");
});

// Listeners de Red
window.addEventListener("online", () => {
  showToast("Conexión restablecida. Sincronizando...");
  triggerSync();
});

window.addEventListener("offline", () => {
  showToast("Modo sin conexión activado.");
  updateSyncBadge("Offline (Sin Conexión)");
});

// --- Inicialización de la Aplicación ---
function initApp() {
  if (token && user) {
    if (user.hogarId) {
      showView("dashboard");
    } else {
      showView("setup");
    }
  } else {
    showView("auth");
  }
  
  // Verificar estado de red inicial
  if (!navigator.onLine) {
    updateSyncBadge("Offline (Sin Conexión)");
  } else {
    updateSyncBadge("Sincronizado");
  }
}

// Arrancar App
initApp();
