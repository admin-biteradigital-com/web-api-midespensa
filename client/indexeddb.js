const DB_NAME = "MiDespensaDB";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Almacén para el inventario local (vista materializada local)
      if (!db.objectStoreNames.contains("inventario")) {
        db.createObjectStore("inventario", { keyPath: "product_name" });
      }
      
      // Almacén para cola de eventos pendientes por subir (outbox)
      if (!db.objectStoreNames.contains("offline_events")) {
        db.createObjectStore("offline_events", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

async function getInventoryLocal() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("inventario", "readonly");
    const store = transaction.objectStore("inventario");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveInventoryLocal(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("inventario", "readwrite");
    const store = transaction.objectStore("inventario");
    
    store.clear();
    items.forEach(item => {
      store.put({
        product_name: item.product_name,
        quantity: item.quantity,
        updated_at: item.updated_at
      });
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getOfflineEvents() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_events", "readonly");
    const store = transaction.objectStore("offline_events");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueOfflineEvent(productName, eventType, quantityDelta) {
  const db = await openDB();
  const timestamp = new Date().toISOString();
  
  // 1. Guardar el evento en outbox
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_events", "readwrite");
    const store = transaction.objectStore("offline_events");
    const request = store.add({
      product_name: productName,
      event_type: eventType,
      quantity_delta: quantityDelta,
      timestamp: timestamp
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 2. Modificar el stock local en la vista materializada local (Optimistic Update)
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("inventario", "readwrite");
    const store = transaction.objectStore("inventario");
    const request = store.get(productName);

    request.onsuccess = () => {
      const existing = request.result;
      if (existing) {
        const newQty = existing.quantity + (eventType === "ADD" ? quantityDelta : -quantityDelta);
        if (newQty <= 0) {
          store.delete(productName);
        } else {
          existing.quantity = newQty;
          existing.updated_at = timestamp;
          store.put(existing);
        }
      } else if (eventType === "ADD") {
        store.put({
          product_name: productName,
          quantity: quantityDelta,
          updated_at: timestamp
        });
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearOfflineEvents() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("offline_events", "readwrite");
    const store = transaction.objectStore("offline_events");
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
