# 84_sprint_5_execution_report.md — Informe de Ejecución Sprint 5: Push Notifications + Lista de Compras + Bugfixes

**Sprint:** 5 (Push Notifications + Lista de Compras Inteligente)
**Fecha de Ejecución:** 2026-07-31
**Estado:** ✅ COMPLETADO
**Commit principal:** `8f1ea40`
**Worker Version ID:** `bcd1df86-a05a-4d7b-ab98-9386ef24a66a`

---

## 1. Bugfixes Correctivos (Previos al Sprint 5)

Los siguientes bugs fueron reportados por el usuario y corregidos antes de continuar con el Sprint 5.

| Bug Reportado | Causa Raíz | Archivo | Fix Aplicado |
| :--- | :--- | :--- | :--- |
| "Error al cargar precios" | `API_BASE` en `sync.js` apuntaba a `midespensa.biteradigital.com` (dominio no configurado) | `client/sync.js` | Corregido a `web-api-midespensa.administracion-698.workers.dev` |
| +/- botones sincronizan en cada click (bug de race condition con recargas de valor) | `triggerSync()` se llamaba en cada click → round-trip D1 → re-render con valor viejo | `client/app.js` | Implementado **debounce local-first**: cambios van solo a IndexedDB, sync se dispara 800ms después del último click |
| Escáner no detecta webcam / sin selector de cámara | `getUserMedia` usaba `facingMode: 'environment'` sin fallback, sin enumeración de dispositivos | `client/barcode.js` | Reescritura completa: enumera `videoinput` devices post-permiso, popula dropdown con labels, permite cambiar cámara mid-session |
| `min_stock` no podía ser 0 | `min="1"` en HTML y `|| 1` en app.js | `client/index.html`, `client/app.js` | `min="0"`, `value="0"`, `Math.max(0, parseInt(...) || 0)` |

---

## 2. Sprint 5 — Entregables Backend

### 2.1 Tabla D1: `push_subscriptions` (migración aplicada en remoto)

```sql
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hogar_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, endpoint)
);
CREATE INDEX idx_push_subscriptions_hogar ON push_subscriptions(hogar_id);
```

### 2.2 `worker/src/routes/push.ts` — Módulo nuevo

| Endpoint | Método | Descripción |
| :--- | :--- | :--- |
| `/api/v1/push/vapid-key` | GET | Retorna la VAPID public key para que el cliente registre la suscripción |
| `/api/v1/push/subscribe` | POST | Registra o actualiza (upsert) una push subscription por `user_id + endpoint` |
| `/api/v1/push/subscribe` | DELETE | Elimina la suscripción (opt-out) |

**VAPID JWT:** Implementado con `SubtleCrypto` nativo — importación de clave PKCS8 P-256, firma ECDSA SHA-256, encabezado `Authorization: vapid t=...,k=...`. **Cero dependencias npm.**

### 2.3 Scheduled Trigger (Cron Diario)

- **Cron:** `0 11 * * *` (11:00 UTC = 08:00 UYU)
- **Lógica:** Busca todos los productos con `quantity <= min_stock` en D1, agrupa por hogar, envía push notification vía Web Push API a cada suscriptor registrado.
- **Configurado en:** `worker/wrangler.toml` → `[triggers] crons = ["0 11 * * *"]`
- **Activado en producción:** ✅

### 2.4 `worker/src/routes/inventory.ts` — `handleGetShoppingList` enriquecido

```sql
SELECT i.*, 
  (SELECT hp.price FROM historial_precios hp WHERE hp.hogar_id = i.hogar_id 
   AND hp.product_name = i.product_name ORDER BY hp.timestamp DESC LIMIT 1) AS last_price,
  (SELECT hp.currency FROM historial_precios hp WHERE hp.hogar_id = i.hogar_id 
   AND hp.product_name = i.product_name ORDER BY hp.timestamp DESC LIMIT 1) AS last_currency
FROM inventario i WHERE i.hogar_id = ? AND i.quantity <= i.min_stock
ORDER BY i.category ASC, i.product_name ASC
```

### 2.5 `handleRestockItem` — Nuevo endpoint POST `/api/v1/shopping-list/restock`

- Calcula `qty_added = min_stock + 1 - current_quantity` (o acepta `quantity_added` explícito)
- UPDATE en `inventario` + INSERT en `events_stock` con tipo `RESTOCK`
- Registro en `auditoria_legal` con evento `RESTOCK_FROM_SHOPPING_LIST`

---

## 3. Sprint 5 — Entregables Frontend

### 3.1 Tercera pestaña de navegación: "📋 Lista"

- **Tabs:** 🛒 Inventario | 📋 Lista | 📊 Reportes
- `setActiveTab(id)` centraliza el cambio de estilo de todos los tabs

### 3.2 Panel `#panel-lista` — Lista de Compras Inteligente

| Feature | Implementación |
| :--- | :--- |
| **Agrupación por categoría** | Items ordenados por `category ASC`, cada categoría en su `glass-card` con emoji |
| **Badge de déficit** | `Necesitas +N` en rojo por cada item |
| **Chip de precio de referencia** | Verde si hay `last_price` del historial |
| **Checkbox de restock** | Click → POST al backend → fade-out del item → toast de confirmación |
| **Estado vacío** | 🎉 "¡Todo en orden!" cuando no hay items pendientes |
| **Fallback offline** | Lee IndexedDB local si no hay token o hay error de red |

### 3.3 Web Share API con Fallback

```
📤 Compartir → navigator.share() → clipboard fallback → toast "Lista copiada"
```

Formato del texto: `• Producto (Necesitas +N)` por línea

### 3.4 `barcode.js` — Reescritura con selector de cámara

```
openScanner() → getUserMedia (environment) → enumerateCameras() → 
populates <select> con labels → usuario elige → startCamera(deviceId)
```

- Labels con anotación "(Trasera)" / "(Frontal)" donde corresponda
- Botón "🔄 Usar" para cambiar cámara sin cerrar el modal
- Fallback manual para browsers sin BarcodeDetector (muestra input de nombre directamente)

---

## 4. Criterios de Aceptación — Verificación

| Criterio | Estado |
| :--- | :--- |
| "Error al cargar precios" resuelto | ✅ API_BASE corregida |
| +/- botones sin race condition (no recarga desde DB por click rápido) | ✅ Debounce 800ms |
| Webcam aparece en lista de cámaras disponibles | ✅ enumerateDevices post-permiso |
| min_stock = 0 es aceptado | ✅ |
| `/api/v1/push/vapid-key` retorna 503 si no hay VAPID config | ✅ |
| `/api/v1/push/subscribe` registra suscripción en D1 | ✅ upsert |
| Cron `0 11 * * *` activo en producción | ✅ en Cloudflare dashboard |
| Lista de Compras muestra items agrupados por categoría | ✅ |
| Precios de referencia visibles si existen | ✅ correlated subquery |
| Checkbox restock → fades item → toast | ✅ |
| Compartir lista → Web Share / clipboard | ✅ |
| 89 tests passing / 0 errores TypeScript | ✅ |

---

## 5. Notas de Configuración para Activar Push Notifications

Para activar las notificaciones push en producción se requieren 2 secrets en Wrangler:

```bash
# 1. Generar par de claves VAPID P-256 (herramienta externa o web-push CLI)
# wrangler secret put VAPID_PRIVATE_KEY   # clave privada en base64url PKCS8
# wrangler secret put VAPID_PUBLIC_KEY    # clave pública en base64url
# wrangler secret put VAPID_SUBJECT       # mailto:admin@biteradigital.com
```

> [!IMPORTANT]
> Las notificaciones push **no se envían** hasta que `VAPID_PRIVATE_KEY` y `VAPID_PUBLIC_KEY` estén configuradas como secrets. El endpoint `/api/v1/push/vapid-key` retorna `push_enabled: false` hasta entonces.

---

## 6. Métricas de Calidad

| Métrica | Resultado |
| :--- | :--- |
| Tests totales | 89 passed / 0 failed |
| Test suites | 11 passed |
| TypeScript errors | 0 |
| Worker deploy | ✅ `bcd1df86-a05a-4d7b-ab98-9386ef24a66a` |
| Cron trigger | ✅ `0 11 * * *` activo |
| Costo incremental | USD 0 |

---

## 7. Sprint 6 — Próxima Fase

Ver [82_sprint_roadmap_master_plan.md](82_sprint_roadmap_master_plan.md) y [19_product_backlog.md](19_product_backlog.md).

**Hitos clave Sprint 6:**
1. Motor predictivo de agotamiento: regresión lineal sobre `events_stock` por producto
2. Cloudflare R2 para imágenes de productos (binding `IMAGES_BUCKET`)
3. Vista de producto expandida con imagen y gráfico de tendencia de consumo
