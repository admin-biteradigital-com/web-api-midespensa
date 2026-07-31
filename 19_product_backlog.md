# Product Backlog - Mi Despensa

Clasificación y priorización de las historias de usuario y tareas de ingeniería para el desarrollo del producto.

> **Última actualización:** 2026-07-31 — Sprint 5 completado (Push VAPID + Lista de Compras). Sprint 6 planificado.

---

## 1. Estado de Completitud del Backlog

| ID | Funcionalidad | MoSCoW | Valor | Complejidad | Sprint | Estado |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **PB-01** | Autenticación Passwordless Magic Link | **Must Have** | Alto | Media | Sprint 1 | ✅ Done |
| **PB-02** | Panel de Inventario Colaborativo en Edge | **Must Have** | Crítico | Alta | Sprint 0-1 | ✅ Done |
| **PB-03** | Motor de Sincronización Local Offline (Outbox) | **Must Have** | Alto | Alta | Sprint 1 | ✅ Done |
| **PB-04** | Lista de Compras Automática por Stock Bajo | **Must Have** | Alto | Bajo | Sprint 1 | ✅ Done |
| **PB-05** | Historial y Estadísticas de Precios | **Must Have** | Alto | Media | Sprint 2 | ✅ Done |
| **PB-06** | Categorización Visual por Pasillo | **Should Have** | Alto | Media | Sprint 3 | ✅ Done |
| **PB-07** | Escáner de Códigos de Barra (BarcodeDetector API) | **Should Have** | Alto | Media | Sprint 3 | ✅ Done |
| **PB-08** | Analytics de Consumo + Gráfico Canvas + CSV Export | **Should Have** | Alto | Media | Sprint 4 | ✅ Done |
| **PB-09** | Hogares Compartidos — Invitación y Multi-Usuario | **Must Have** | Crítico | Alta | Sprint 2.6 | ✅ Done |
| **PB-BF1** | Fix: API_BASE URL (precios fallaban en producción) | **Bug** | Crítico | Bajo | Bugfix | ✅ Done |
| **PB-BF2** | Fix: +/- debounce local-first (race condition) | **Bug** | Alto | Bajo | Bugfix | ✅ Done |
| **PB-BF3** | Fix: Barcode scanner webcam + selector de cámara | **Bug** | Alto | Medio | Bugfix | ✅ Done |
| **PB-BF4** | Fix: min_stock = 0 permitido | **Bug** | Bajo | Bajo | Bugfix | ✅ Done |
| **PB-10** | Notificaciones Push de Stock Bajo (Web Push API + VAPID) | **Should Have** | Alto | Alta | Sprint 5 | ✅ Done |
| **PB-11** | Lista de Compras Inteligente con Precios de Referencia | **Should Have** | Alto | Media | Sprint 5 | ✅ Done |
| **PB-12** | Compartir Lista de Compras (Web Share API) | **Could Have** | Medio | Bajo | Sprint 5 | ✅ Done |
| **PB-13** | Carga de Imágenes de Productos (Cloudflare R2) | **Could Have** | Medio | Medio | Sprint 6 | 🔲 Backlog |
| **PB-14** | Motor Predictivo de Agotamiento de Stock (regresión lineal) | **Could Have** | Alto | Alta | Sprint 6 | 🔲 Backlog |
| **PB-15** | Vista Expandida de Producto (imagen + gráfico de tendencia) | **Could Have** | Medio | Media | Sprint 6 | 🔲 Backlog |
| **PB-16** | Comparador de Precios entre Supermercados | **Could Have** | Alto | Alta | V2 | 🔲 Backlog |
| **PB-17** | Integración Automática con Catálogos de Supermercados | **Won't Have** | Medio | Alta | V3 | ❌ No aplica V1 |

---

## 2. Sprint 5 — Backlog Detallado (COMPLETADO)

### PB-10: Notificaciones Push de Stock Bajo ✅
- **Historia:** Como usuario, quiero recibir una notificación en mi teléfono cuando algún producto de mi despensa llegue al mínimo, sin tener que abrir la app.
- **Criterios de Aceptación:**
  1. Registro de Push Subscription vía Web Push API + VAPID keys. ✅
  2. Cloudflare Worker Scheduled Trigger `crons = ["0 11 * * *"]` (costo USD 0). ✅
  3. Payload de notificación incluye nombre del producto y cantidad actual. ✅
  4. El usuario puede activar/desactivar notificaciones desde la app. *(pendiente: botón UI en frontend — se implementa en Sprint 6 junto con onboarding de permisos)*
- **DoD:** Worker desplegado con cron activo. Endpoint `/api/v1/push/subscribe` funcional en producción.
- **Commit:** `8f1ea40` | **Worker Version:** `bcd1df86`

### PB-11: Lista de Compras Inteligente ✅
- **Historia:** Como miembro del hogar, quiero ver una lista de compras organizada por pasillo con los precios de referencia y poder marcar lo que ya compré para actualizar el stock.
- **Criterios de Aceptación:**
  1. Endpoint `/api/v1/shopping-list` enriquecido con `last_price` / `last_currency` por correlated subquery. ✅
  2. Agrupación por categoría con emoji de pasillo (simula recorrido por supermercado). ✅
  3. Checkbox "comprado" → POST `/api/v1/shopping-list/restock` → fade-out item → toast confirmación. ✅
  4. Precio de referencia del último registro visible como chip verde junto a cada ítem. ✅
- **DoD:** Tab "📋 Lista" funcional. Marcado de items actualiza stock en D1.
- **Commit:** `8f1ea40`

### PB-12: Compartir Lista de Compras ✅
- **Historia:** Como usuario, quiero compartir mi lista de compras vía WhatsApp o mensaje de texto.
- **Criterios de Aceptación:**
  1. Botón "📤 Compartir" usa Web Share API nativa (donde esté disponible). ✅
  2. Fallback: texto plano copiado al portapapeles con toast de confirmación. ✅
  3. Formato: `• Producto (Necesitas +N)` por línea con encabezado "🛒 Mi Lista de Compras". ✅
- **DoD:** Compartir lista en 2 taps.
- **Commit:** `8f1ea40`

---

## 3. Sprint 6 — Backlog Detallado (PRÓXIMO)

### PB-13: Imágenes de Productos (Cloudflare R2)
- **Historia:** Como usuario, quiero ver una foto del producto en su ficha para identificarlo más rápido.
- **Criterios de Aceptación:**
  1. Binding `IMAGES_BUCKET` en `wrangler.toml` apuntando a Cloudflare R2.
  2. Endpoint `POST /api/v1/products/:id/image` — acepta multipart/form-data, valida MIME (jpg/png/webp ≤2MB), sube a R2.
  3. Endpoint `GET /api/v1/products/:id/image` — retorna URL pública o redirect.
  4. Miniatura visible en la tarjeta del inventario (circular, 40×40px).
- **Complejidad:** Media | **Costo:** R2 gratuito hasta 10GB/mes

### PB-14: Motor Predictivo de Agotamiento
- **Historia:** Como usuario, quiero saber cuántos días me quedan de stock de cada producto antes de que se agote, sin tener que calcularlo.
- **Criterios de Aceptación:**
  1. Regresión lineal sobre `events_stock` de los últimos 30 días por producto.
  2. Badge "~N días" en la tarjeta de inventario para productos con historial suficiente (≥5 eventos).
  3. Endpoint `GET /api/v1/inventory/predictions` retorna lista con `product_name`, `days_remaining`, `confidence`.
  4. Alertas push anticipadas: notificación 3 días antes del agotamiento predicho.
- **Complejidad:** Alta | **Costo:** USD 0 (compute en edge)

### PB-15: Vista Expandida de Producto
- **Historia:** Como usuario, quiero hacer tap en un producto para ver su detalle completo: imagen, gráfico de consumo, historial de precios y predicción.
- **Criterios de Aceptación:**
  1. Modal o panel deslizante al hacer tap en tarjeta de producto.
  2. Gráfico de línea (Canvas) con evolución de precios en el tiempo.
  3. Gráfico de consumo mensual (barras).
  4. Imagen del producto si está cargada en R2.
  5. Badge de predicción de días restantes.
- **Complejidad:** Media | **Dependencia:** PB-13, PB-14

---

## 4. Epics Históricos (Referencia)

### Epic: Sincronización Concurrente Familiar (PB-02, PB-03)
- Motor Outbox en `sync.js` + IndexedDB. Offline-first con replay al reconectar.
- **Estado:** ✅ **Completado en Sprint 1** — Reforzado con debounce en bugfix Sprint 5.

### Epic: Multi-Hogar Compartido (PB-09)
- Código de invitación UUID, endpoint `/api/v1/hogar/join`, JWT con `hogar_id` compartido.
- **Estado:** ✅ **Completado en Sprint 2.6**

### Epic: Analytics de Consumo (PB-08)
- Panel de Reportes con gráfico Canvas animado, Top 6 productos, resumen por categoría y CSV con BOM.
- **Estado:** ✅ **Completado en Sprint 4** — commit `6e79ed3`

### Epic: Push Notifications + Lista de Compras (PB-10, PB-11, PB-12)
- VAPID JWT con SubtleCrypto nativo, cron diario, tabla `push_subscriptions`, lista enriquecida con precios.
- **Estado:** ✅ **Completado en Sprint 5** — commit `8f1ea40`

---

## 5. Notas de Arquitectura — Constraints

> [!IMPORTANT]
> Para activar Push Notifications se requieren secrets de Wrangler:
> ```bash
> wrangler secret put VAPID_PRIVATE_KEY   # PKCS8 P-256 en base64url
> wrangler secret put VAPID_PUBLIC_KEY    # public key en base64url
> wrangler secret put VAPID_SUBJECT       # mailto:admin@biteradigital.com
> ```
> Sin estas secrets, el endpoint retorna `push_enabled: false` (fail-safe).

> [!NOTE]
> Cron trigger activo en producción: `0 11 * * *` (11:00 UTC = 08:00 Uruguay).
> Cloudflare Free Tier incluye 100,000 invocaciones de cron gratuitas por día.

> [!NOTE]
> Toda operación D1 que requiera `hogar_id` debe pasar por `D1QueryGate`.
> Mutaciones: `queryGate.prepare(sql).bind(...params).run()`.
> Queries: `queryGate.executeTenantQuery<T>(ctx, sql, params)`.
