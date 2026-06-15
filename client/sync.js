const API_BASE =
  window.location.origin.includes("localhost") ||
  window.location.origin.includes("127.0.0.1")
    ? "http://localhost:8787"
    : "https://midespensa.biteradigital.com";

async function pullInventory(token) {
  const response = await fetch(`${API_BASE}/api/v1/inventory`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Error al obtener el inventario del servidor");
  }

  const data = await response.json();
  if (data.success && data.inventory) {
    await saveInventoryLocal(data.inventory);
    return data.inventory;
  }
  throw new Error("Formato de respuesta incorrecto");
}

async function syncEngine(token, onStatusChange) {
  if (!navigator.onLine) {
    if (onStatusChange) onStatusChange("Offline (Sin Conexión)");
    return await getInventoryLocal();
  }

  if (onStatusChange) onStatusChange("Sincronizando...");

  try {
    const events = await getOfflineEvents();
    
    if (events.length > 0) {
      console.log(`Sincronizando ${events.length} eventos locales offline...`);
      
      for (const evt of events) {
        const route =
          evt.event_type === "ADD"
            ? "/api/v1/inventory/add"
            : "/api/v1/inventory/remove";

        try {
          const res = await fetch(`${API_BASE}${route}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              product_name: evt.product_name,
              quantity_delta: evt.quantity_delta,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            console.warn(
              `Evento offline no pudo sincronizarse: ${evt.product_name}. Error: ${errData.error}`
            );
          }
        } catch (fetchErr) {
          console.error(`Fallo de red al sincronizar evento individual:`, fetchErr);
          throw fetchErr; // Interrumpe y mantiene el resto de eventos en la cola local
        }
      }
      
      // Limpiar cola local una vez enviados
      await clearOfflineEvents();
    }

    // Obtener estado consolidado del servidor
    const updatedInventory = await pullInventory(token);
    if (onStatusChange) onStatusChange("Sincronizado");
    return updatedInventory;
  } catch (err) {
    console.error("Fallo general en syncEngine:", err);
    if (onStatusChange) onStatusChange("Error de Sincronización");
    return await getInventoryLocal();
  }
}
