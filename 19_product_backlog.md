# Product Backlog - Mi Despensa

Clasificación y priorización de las historias de usuario y tareas de ingeniería para el desarrollo del producto.

> **Última actualización:** 2026-07-31 — Sprint 4 Analytics completado. Backlog actualizado con Sprint 5.

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
| **PB-10** | Notificaciones Push de Stock Bajo (Web Push API) | **Should Have** | Alto | Alta | Sprint 5 | ⏳ Planificado |
| **PB-11** | Lista de Compras Inteligente con Precios de Referencia | **Should Have** | Alto | Media | Sprint 5 | ⏳ Planificado |
| **PB-12** | Compartir Lista de Compras (Web Share API) | **Could Have** | Medio | Bajo | Sprint 5 | ⏳ Planificado |
| **PB-13** | Carga de Imágenes de Productos (Cloudflare R2) | **Could Have** | Medio | Medio | Sprint 6 | 🔲 Backlog |
| **PB-14** | Motor Predictivo de Agotamiento de Stock (ML Edge) | **Could Have** | Alto | Alta | Sprint 6+ | 🔲 Backlog |
| **PB-15** | Comparador de Precios entre Supermercados | **Could Have** | Alto | Alta | V2 | 🔲 Backlog |
| **PB-16** | Integración Automática con Catálogos de Supermercados | **Won't Have** | Medio | Alta | V3 | ❌ No aplica V1 |

---

## 2. Sprint 5 — Backlog Detallado

### PB-10: Notificaciones Push de Stock Bajo
- **Historia:** Como usuario, quiero recibir una notificación en mi teléfono cuando algún producto de mi despensa llegue al mínimo, sin tener que abrir la app.
- **Criterios de Aceptación:**
  1. Registro de Push Subscription vía Web Push API + VAPID keys.
  2. Cloudflare Worker Scheduled Trigger (cron diario, costo USD 0).
  3. Payload de notificación incluye nombre del producto y cantidad actual.
  4. El usuario puede activar/desactivar notificaciones desde la app.
- **DoD:** Recibir notificación push en dispositivo Android/iOS-Safari con la app cerrada.

### PB-11: Lista de Compras Inteligente
- **Historia:** Como miembro del hogar, quiero ver una lista de compras organizada por pasillo con los precios de referencia y poder marcar lo que ya compré para actualizar el stock.
- **Criterios de Aceptación:**
  1. Endpoint `/api/v1/shopping-list` enriquecido con historial de precios.
  2. Agrupación por categoría (simula recorrido por pasillo).
  3. Checkbox "comprado" → dispara evento de restock en D1 + IndexedDB.
  4. Precio de referencia del último registro visible junto a cada ítem.
- **DoD:** Marcar un ítem como comprado y verificar que el stock se actualiza en D1.

### PB-12: Compartir Lista de Compras
- **Historia:** Como usuario, quiero compartir mi lista de compras vía WhatsApp o mensaje de texto para coordinar con un familiar.
- **Criterios de Aceptación:**
  1. Botón "Compartir" usa Web Share API (donde esté disponible).
  2. Fallback: texto plano copiado al portapapeles.
  3. Formato legible: emoji + producto + cantidad.
- **DoD:** Compartir lista en 2 taps desde la vista de Lista de Compras.

---

## 3. Descripción de Epics del MVP (Referencia Histórica)

### Epic: Sincronización Concurrente Familiar (PB-02, PB-03)
- **Descripción:** Motor Outbox en `sync.js` + IndexedDB para operaciones offline. Al recuperar la red, se sincroniza en bloque contra D1 de Cloudflare respetando el `hogar_id`.
- **DoD:** Bloquear red, hacer 3 decrementos, reconectar y verificar D1 sin duplicados ni pérdida.
- **Estado:** ✅ **Completado en Sprint 1** — Corrección sync validada en Sprint 3.

### Epic: Multi-Hogar Compartido (PB-09)
- **Descripción:** Código de invitación UUID, endpoint `/api/v1/hogar/join`, JWT con `hogar_id` compartido.
- **DoD:** Dos usuarios con correos distintos ven el mismo inventario en tiempo real.
- **Estado:** ✅ **Completado en Sprint 2.6**

### Epic: Analytics de Consumo (PB-08)
- **Descripción:** Panel de Reportes con gráfico Canvas de barras animado (gasto por categoría), Top 6 productos, resumen por categoría y exportación CSV con BOM.
- **DoD:** El usuario puede ver el gráfico y descargar el CSV desde la pestaña Reportes.
- **Estado:** ✅ **Completado en Sprint 4** — commit `6e79ed3`

---

## 4. Notas de Arquitectura para Sprint 5

> [!IMPORTANT]
> Para Web Push VAPID keys, generar par ECDH P-256 y almacenar la private key como **secret de Wrangler** (`wrangler secret put VAPID_PRIVATE_KEY`). La public key se expone al cliente vía endpoint `/api/v1/push/vapid-public-key`. Costo operativo: **USD 0** con Cloudflare Workers Free Tier.

> [!NOTE]
> El Scheduled Trigger para verificar stock bajo puede configurarse como `crons = ["0 8 * * *"]` en `wrangler.toml` (08:00 UTC diario). Cloudflare Free Tier incluye 100,000 invocaciones de cron gratuitas por día.
