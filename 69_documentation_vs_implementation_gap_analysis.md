# 69_documentation_vs_implementation_gap_analysis.md — Análisis de Brecha (Gap Analysis): Documentación vs. Implementación

Este documento realiza un contraste detallado entre los requerimientos, decisiones y especificaciones definidos en el cuerpo documental de arquitectura (documentos 01 al 68) y el estado real de la base de código del proyecto **Mi Despensa** tras la finalización del **Sprint 0**.

---

## 1. Convención de Clasificación de Cobertura

*   **✅ Implementado:** El requerimiento está completamente codificado, probado y coincide con las directrices de arquitectura.
*   **🟡 Parcialmente implementado:** El requerimiento tiene soporte en código, pero requiere mayor cobertura, refinamiento o carece de integración completa con otras áreas del sistema.
*   **🔴 No implementado:** El requerimiento está ausente de la base de código del MVP y está planificado para sprints futuros.
*   **⚫ Obsoleto:** El componente o diseño fue retirado o reemplazado mediante una enmienda arquitectónica oficial (v.g. debido a la restricción de costo USD 0).

---

## 2. Matriz Comparativa Detallada

### 2.1. Modelo del Dominio e Inventario

| Requisito / Concepto | Documentos Relacionados | Estado | Implementación Real en Sprint 0 / Brecha |
| :--- | :--- | :---: | :--- |
| **Events Stock como Source of Truth** | Doc 09, 11, 12, 13, 58 | **✅** | La tabla `events_stock` actúa como log append-only e inmutable. Implementado en `worker/src/routes/inventory.ts`. |
| **Proyección de Inventario (Materialized View)** | Doc 09, 12, 58, 67 | **✅** | La tabla `inventario` almacena el stock actual consolidado para optimizar lecturas del Dashboard. Implementado. |
| **Sincronización Transaccional** | Doc 12, 58, 67 | **✅** | La inserción en `events_stock` y la actualización/inserción en `inventario` ocurren de forma atómica en una única transacción de D1 vía `db.batch()`. |
| **Multi-Hogar por Usuario** | Doc 03, 05 | **🔴** | No implementado. Actualmente el claim `hogarId` en el JWT es único y no hay tabla asociativa de membresías múltiples. El MVP asume un usuario = un hogar. |
| **Alertas de Stock Mínimo** | Doc 03, 15 | **🔴** | No implementado en código. La tabla `inventario` actual no posee columnas de `stock_minimo` (diferido a V1). |
| **Historial de Fechas de Vencimiento** | Doc 05, 12 | **⚫** | Obsoleto para el MVP. Reemplazado por el log simplificado de eventos de stock (`events_stock`). |

### 2.2. Seguridad e Identidad (Identity & Access)

| Requisito / Concepto | Documentos Relacionados | Estado | Implementación Real en Sprint 0 / Brecha |
| :--- | :--- | :---: | :--- |
| **Capa de Identidad de 3 Niveles** | Doc 06, 31, 32, docs/sprint_0_patch | **✅** | Tabla `users` implementada con UUID `id`, hash SHA-256 no reversible `email`, y cifrado AES-GCM `email_encrypted` en `worker/src/routes/auth.ts` y `worker/src/utils/crypto.ts`. |
| **Validación de Firma JWT** | Doc 06, 32 | **✅** | Implementado en `worker/src/middleware/auth.ts` usando la librería `jose`. |
| **Algoritmo JWT (HS256)** | Doc 06, 52, 67 (ADR) | **✅** | Implementado firma y verificación simétrica HS256 utilizando la Web Crypto API nativa a través de `jose`. ES256 y Ed25519 quedan diferidos. |
| **Separación Control vs. Data Plane** | Doc 63, 64 | **✅** | Enrutamiento e identidades aisladas. `admin@biteradigital.com` no posee registros operativos en la base de datos de producción. |
| **Magic Links con Token Temporal** | Doc 03, 32, docs/sprint_0_patch | **🟡** | Parcialmente implementado. Se genera un JWT temporal con validez de 10 min y se expone por consola y debugUrl. Falta la integración directa con la API de Resend para envío por correo. |
| **Tenant Enforcement Layer (TEL)** | Doc 05, 32, 34, 57, 58 | **✅** | Implementada la clase `D1QueryGate` en `worker/src/middleware/tel.ts` que intercepta las sentencias SQL y rechaza la ejecución si falta `hogar_id`. |
| **Cookies HTTP-Only Seguras** | Doc 06, 62 | **🔴** | No implementado. El MVP actual transmite el JWT a través del encabezado `Authorization: Bearer <token>` para simplificar la interoperabilidad de la PWA. |

### 2.3. Almacenamiento Local y Offline (PWA)

| Requisito / Concepto | Documentos Relacionados | Estado | Implementación Real en Sprint 0 / Brecha |
| :--- | :--- | :---: | :--- |
| **Cache de Assets Estáticos** | Doc 04, 05, 14, 46 | **✅** | `client/sw.js` implementa Service Worker con estrategia de almacenamiento en cache y recuperación offline de la UI. |
| **Copia Local del Inventario** | Doc 04, 14, 20, 52 | **✅** | Implementado uso de IndexedDB en `client/indexeddb.js` y `client/app.js` para persistencia local del estado del inventario. |
| **Cola Offline de Transacciones** | Doc 14, 52 | **🟡** | Parcialmente implementado. `client/sync.js` maneja la cola en IndexedDB para registrar adiciones/sustracciones de stock offline. Falta la resolución automatizada de conflictos bidireccional compleja. |
| **Sincronización en Tiempo Real** | Doc 01, 05, 10 | **⚫** | Obsoleto para el MVP. Reemplazado por sincronización bajo demanda y reintento en segundo plano (Free Tier compliance). |

### 2.4. Infraestructura y Límites Financieros

| Requisito / Concepto | Documentos Relacionados | Estado | Implementación Real en Sprint 0 / Brecha |
| :--- | :--- | :---: | :--- |
| **Infraestructura Costo USD 0** | Todos los documentos, 67 | **✅** | Todo el sistema corre sobre Cloudflare Free Tier (Workers + D1). `wrangler.toml` no define bindings con costo comercial. |
| **Cloudflare Durable Objects** | Doc 01, 04, 05, 10, 16 | **⚫** | Obsoleto en MVP. Excluido del código. Las transacciones se realizan directamente sobre D1 SQLite. |
| **Cloudflare KV** | Doc 05, 33, 34, 54 | **⚫** | Obsoleto en MVP. Excluido temporalmente del código del Worker; la sesión y tokens se validan de forma descentralizada. |
| **Cloudflare Queues** | Doc 09 | **⚫** | Obsoleto en MVP. La cola de mensajería offline se gestiona en el cliente mediante IndexedDB. |
| **Workers AI** | Doc 09, 14 | **⚫** | Obsoleto en MVP. El motor predictivo de consumo queda diferido para fases avanzadas de V1+. |
| **Backup y Recuperación** | Doc 40, Doc 55 | **🔴** | No implementado. D1 no cuenta con un sistema automático de exportación/backup periódico hacia almacenamiento externo. |

### 2.5. Auditoría y Observabilidad

| Requisito / Concepto | Documentos Relacionados | Estado | Implementación Real en Sprint 0 / Brecha |
| :--- | :--- | :---: | :--- |
| **Audit Evidence Provider** | Doc 41, 48, 64, 67 (ADR) | **🟡** | Parcialmente implementado. El concepto está definido en el modelo canónico. Falta crear la tabla `auditoria_legal` e inyectar las llamadas automatizadas de log en el middleware del Worker. |
| **Cloudflare Logpush** | Doc 41, 48, 64 | **⚫** | Obsoleto en MVP. Mantenido únicamente como alternativa evolutiva para V1+ debido a su incompatibilidad con el Free Tier de Cloudflare. |

## 3. Clasificación y Priorización de Brechas para Sprint 1

Se clasifican las brechas del sistema según su criticidad para el inicio y puesta en marcha del desarrollo productivo de la plataforma:

*   **🚨 Bloqueante para Sprint 1:** Brechas de seguridad, autenticación básica o infraestructura indispensable que impiden un desarrollo operativo mínimo o violan regulaciones. Debe resolverse al inicio de Sprint 1.
*   **🟡 Importante pero diferible:** Capacidades planeadas del dominio o frontend que aportan valor de negocio, pero su postergación temporal no introduce riesgos de arquitectura ni bloquea los flujos esenciales.
*   **🟢 Cosmética/documental:** Aspectos visuales menores, logs informativos o actualizaciones menores en los diagramas descriptivos de la documentación.

---

### 3.1. Matriz de Priorización de Brechas

| Gap ID | Requisito / Brecha | Clasificación | Riesgo | Impacto | Esfuerzo | Sprint Recomendado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | Integración real de Resend API (Magic Links) | 🚨 Bloqueante (Gate A) | **Alto** (Imposibilidad de login real) | **Alto** (Flujo de entrada roto) | Bajo (1-2 días) | **Sprint 1 (Gate A)** |
| **GAP-02** | Tabla `auditoria_legal` en D1 e integraciones | 🚨 Bloqueante (Gate A) | **Alto** (Falta de registros de auditoría) | **Alto** (Incumplimiento ISO 27001) | Bajo (1 día) | **Sprint 1 (Gate A)** |
| **GAP-03** | Multi-Hogar por Usuario (membresías) | 🟡 Importante / Diferible | **Bajo** (Limitado a un hogar único en MVP) | **Medio** (Menor flexibilidad funcional) | Medio-Alto (4-5 días) | **Sprint 2** (Fase V1) |
| **GAP-04** | Cookies HTTP-Only SameSite=Strict | 🟡 Importante / Diferible | **Medio** (JWT expuesto en memoria cliente) | **Medio** (Riesgo potencial XSS mitigado en PWA) | Bajo-Medio (2 días) | **Sprint 2** |
| **GAP-05** | Alertas de Stock Mínimo | 🟡 Importante / Diferible | **Bajo** (No altera funcionalidad de inventario) | **Bajo** (Ausencia de aviso visual) | Bajo (1-2 días) | **Sprint 2** |
| **GAP-06** | Sincronización y resolución compleja offline | 🟡 Importante / Diferible | **Bajo** (Flujo secuencial simple es suficiente) | **Medio** (Conflictos en concurrencia extrema) | Alto (5-7 días) | **Sprint 2** |
| **GAP-07** | Backup & Disaster Recovery (Export D1) | 🟡 Importante / Diferible | **Medio** (Pérdida de datos si D1 se corrompe) | **Alto** (Pérdida del inventario doméstico) | Bajo-Medio (2 días) | **Sprint 2** |

---

## 4. Conclusión de Viabilidad de Inicio (Sprint 1 Readiness)

Tras completar la auditoría global de coherencia y comparar de forma sistemática el cuerpo documental con la base de código real:

> [!IMPORTANT]
> **DIAGNÓSTICO ARQUITECTÓNICO COMPLETO:**
> **El Sprint 1 de construcción real puede comenzar de forma inmediata y segura bajo una estructura de Gates.**
> 
> *   **Sprint 1 Gate A (Bloqueantes):** El desarrollo funcional está condicionado a la aprobación de la **Gate A**, que exige resolver de forma prioritaria el login productivo real (**GAP-01**) y el Audit Trail (**GAP-02**). Esto previene dependencias críticas sin cerrar y asegura el no repudio desde el día uno.
> *   **Aislamiento y Costos Protegidos:** El aislamiento multi-tenant a través de la capa `TEL` (D1QueryGate) está plenamente operativo en código y previene cualquier intrusión transversal de datos en la persistencia. La política financiera de **costo operativo USD 0** está asegurada en la base de código actual (sin Durable Objects, R2, ni bindings KV activos en `wrangler.toml`).
> *   **Gobernanza y DR:** La separación de Control Plane y Data Plane está correctamente definida y se cuenta con un marco sólido de gobierno para agentes de desarrollo IA (`68`). La estrategia de mitigación para el backup de base de datos se ha diferido de forma segura para el Sprint 2 mediante la especificación de backup y DR.


