# 73_cross_document_traceability_matrix.md — Matriz de Trazabilidad Cruzada Documental

Este documento establece la correspondencia y trazabilidad de los requerimientos y decisiones clave a lo largo del cuerpo documental de la plataforma **Mi Despensa**. Asegura que no existan contradicciones activas y que todos los documentos de referencia cruzada estén al 100% alineados.

---

## 1. Matriz de Mapeo de Requerimientos y Decisiones

| Requisito / Decisión Clave | Documentos de Definición (01-62) | Documentos de Consolidación (63-71, 76, 77) | Estado de Coherencia | Observaciones y Parches Aplicados |
| :--- | :--- | :--- | :---: | :--- |
| **Costo Operativo = USD 0** | Doc 01, 04, 05, 16, 26, 27, 28, 52, 57, 60 | Doc 63, 64, 65, 66, 67, 68, 69, 71, 76, 77 | **✅ Consistente** | Exclusión de Durable Objects, Logpush, KV y R2 del MVP. GitHub Actions (Free) + CF. |
| **Aislamiento Multi-Tenant (TEL)** | Doc 03, 05, 12, 31, 32, 34, 35, 36, 57, 58, 61 | Doc 64, 65, 66, 67, 68, 69, 71 | **✅ Consistente** | Implementado vía `D1QueryGate` inyectando `hogar_id` obligatoriamente en consultas del dominio. |
| **Protección de PII (Tres Capas)** | Doc 06, 31, 32, 33, 34, 62 | Doc 63, 64, 67, 68, 69 | **✅ Consistente** | `id` (UUID), `email` (SHA-256 no reversible), `email_encrypted` (AES-GCM reversible para notificaciones). |
| **Firma JWT Simétrica (HS256)** | Doc 06, 31, 32, 52 | Doc 64, 65, 67 (ADR-JWT), 68, 69, 71 | **✅ Consistente** | Resuelto mediante `ADR-JWT-ALGORITHM-DECISION` adoptando HS256 para el MVP para optimizar la CPU. |
| **Audit Trail (auditoria_legal)** | Doc 38, 39, 41, 47, 48, 61 | Doc 64, 65, 66, 67 (ADR-AUDIT), 69, 70, 71, 76, 77 | **✅ Consistente** | Tabla de logs inmutables en D1. Referenciada operacionalmente sin redundancias en 70 y 71. |
| **Eventos obligatorios** | Doc 38, 39, 41, 47, 48, 61 | Doc 67, 71, 76, 77 | **✅ Consistente** | Los 7 eventos originales + 7 eventos nuevos de CI/CD se definen en `67`, `76` y en [implementation_plan.md](file:///C:/Users/zelma/.gemini/antigravity-ide/brain/b9210552-f600-439a-ad30-e7dfe181bb04/implementation_plan.md). |
| **Continuidad y Disaster Recovery** | Doc 40, 55, 61 | Doc 69, 70, 71 | **✅ Consistente** | Respaldos diarios vía Wrangler CLI y restauración / reconstrucción de inventario a partir de `events_stock`. |
| **Identidad Corporativa** | Doc 62 | Doc 63, 64, 65, 66, 67, 68, 71 | **✅ Consistente** | Bitera Digital SAS y segregación de `admin@biteradigital.com` como Control Plane Identity. |
| **Gobernanza de Decisiones** | Doc 10, 29, 57, 60 | Doc 68 | **✅ Consistente** | Corregido: Se aplicó el banner `[!WARNING]` a `10_technical_decisions_validation.md` marcando decisiones antiguas como obsoletas. |
| **Gobernanza CI/CD** | Doc 56 | Doc 64, 76, 77 | **✅ Consistente** | Integrado GitHub Actions + Cloudflare como plano de control de construcción y despliegue oficial. |

---

## 2. Acciones de Desambiguación Completadas

Para asegurar la trazabilidad y que ningún desarrollador siga directrices obsoletas, se ratifica la culminación de las siguientes acciones del parche documental previo al Sprint 1:

1.  **Banners de Warning Aplicados:** Los documentos 01, 04, 05, 06, 09, 10 (agregado en este parche), 12, 28, 41, 48 y 62 cuentan ahora con un encabezado explícito que redirige al lector hacia el modelo canónico [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) para resolver cualquier discrepancia de diseño.
2.  **Sincronización del Plan de Tareas:** Se incorporó formalmente la tarea de registrar `HOGAR_CREATE` en la Fase 2 y se agregó la nueva **Fase 5 — CI/CD Hardening** en el plan de construcción oficial [implementation_plan.md](file:///C:/Users/zelma/.gemini/antigravity-ide/brain/b9210552-f600-439a-ad30-e7dfe181bb04/implementation_plan.md).
3.  **Cierre documental:** Con el cierre de estas brechas e incorporación de la gobernanza de CI/CD, se declara el **Documentation Freeze** a nivel de repositorio.
