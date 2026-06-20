# 78_repository_reality_check.md — Reality Check: Estado Físico del Repositorio

Este documento audita de forma estricta los archivos físicos reales presentes en la base de código del proyecto **Mi Despensa** tras la finalización del Sprint 0, contrastando la documentación existente con la realidad del código.

---

## 1. Inventario de Archivos Físicos Existentes

Se ha verificado la existencia de las siguientes carpetas y archivos en el entorno local:

### 1.1. Backend (Edge Worker - TypeScript)
*   [worker/package.json](file:///d:/Desarrollos/web-api-midespensa/worker/package.json)
*   [worker/tsconfig.json](file:///d:/Desarrollos/web-api-midespensa/worker/tsconfig.json)
*   [worker/wrangler.toml](file:///d:/Desarrollos/web-api-midespensa/worker/wrangler.toml)
*   [worker/src/index.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/index.ts)
*   **Middlewares:**
    *   [worker/src/middleware/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/auth.ts) (JWT sign/verify)
    *   [worker/src/middleware/tel.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/tel.ts) (Tenant Enforcement Layer)
*   **Routes:**
    *   [worker/src/routes/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/auth.ts)
    *   [worker/src/routes/events.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/events.ts)
    *   [worker/src/routes/hogar.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/hogar.ts)
    *   [worker/src/routes/inventory.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/inventory.ts)
*   **Utils:**
    *   [worker/src/utils/crypto.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/utils/crypto.ts) (AES-GCM encryption helper)
*   **Tests:**
    *   [worker/src/tests/smoke.test.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/tests/smoke.test.ts)

### 1.2. Frontend (PWA Client - HTML/CSS/JS)
*   [client/index.html](file:///d:/Desarrollos/web-api-midespensa/client/index.html)
*   [client/styles.css](file:///d:/Desarrollos/web-api-midespensa/client/styles.css)
*   [client/app.js](file:///d:/Desarrollos/web-api-midespensa/client/app.js)
*   [client/indexeddb.js](file:///d:/Desarrollos/web-api-midespensa/client/indexeddb.js)
*   [client/sw.js](file:///d:/Desarrollos/web-api-midespensa/client/sw.js)
*   [client/sync.js](file:///d:/Desarrollos/web-api-midespensa/client/sync.js)

### 1.3. Base de Datos (SQL DDL)
*   [schema/d1-schema.sql](file:///d:/Desarrollos/web-api-midespensa/schema/d1-schema.sql)

---

## 2. Matriz de Cobertura Física vs. Documental

| Componente Técnico | Estado Físico | Observaciones y Ubicación Real |
| :--- | :---: | :--- |
| **Edge Compute (Workers)** | **✅ Implementado** | Rutas compilando en [worker/src/index.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/index.ts). |
| **Base de Datos (D1)** | **✅ Implementado** | `wrangler.toml` configurado. Tabla `auditoria_legal` incluida en DDL. |
| **Wrangler Configuration** | **✅ Implementado** | Configuración activa en [worker/wrangler.toml](file:///d:/Desarrollos/web-api-midespensa/worker/wrangler.toml) con variables locales de testing. |
| **Control Offline (IndexedDB)** | **✅ Implementado** | Base IndexedDB configurada en frontend en [client/indexeddb.js](file:///d:/Desarrollos/web-api-midespensa/client/indexeddb.js). |
| **Service Worker UI Cache** | **✅ Implementado** | Service Worker registrado en [client/sw.js](file:///d:/Desarrollos/web-api-midespensa/client/sw.js) para almacenamiento estático offline. |
| **Autenticación (JWT)** | **✅ Implementado** | Implementación real de firmado y validación HS256 en [worker/src/middleware/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/auth.ts). |
| **Tenant Enforcement (TEL)** | **✅ Implementado** | Implementación del interceptor `D1QueryGate` en [worker/src/middleware/tel.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/tel.ts). |
| **Soporte de Criptografía local**| **✅ Implementado** | Encriptación AES-GCM del email de usuario en [worker/src/utils/crypto.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/utils/crypto.ts). |
| **Integración Resend API** | **🔴 Documentado pero no implementado** | El backend no posee dependencias ni código de Resend en esta fase. Se emite url de debug en consola. |
| **AuditEvidenceProvider** | **🔴 Documentado pero no implementado** | No existe la clase/interfaz del log criptográfico ni la inyección en las rutas. |
| **GitHub Actions (Workflows)** | **🔴 Documentado pero no implementado** | La carpeta `.github/workflows` no existe físicamente en el repositorio. |
