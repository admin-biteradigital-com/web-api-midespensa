# 72_pre_sprint_1_architecture_validation.md — Validación de Consistencia de Arquitectura Pre-Sprint 1

Este reporte realiza una validación formal de consistencia y alineación arquitectónica sobre el repositorio del proyecto **Mi Despensa** antes de la ejecución del **Sprint 1**, bajo la gobernanza de **Bitera Digital SAS**.

---

## 1. Clasificación Oficial de Componentes del Ecosistema

Para resolver contradicciones y unificar las especificaciones de los documentos anteriores, se ratifica el estado de los componentes tecnológicos frente al MVP:

| Componente | Clasificación | Justificación / Sustituto en MVP | Documento de Referencia |
| :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | **MVP** | Runtime principal serverless en el Edge. Costo USD 0. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **Cloudflare D1** | **MVP** | Base de datos relacional para usuarios, hogares y logs. Costo USD 0. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **IndexedDB** | **MVP** | Cache local del inventario y cola offline del cliente. Costo USD 0. | [69_documentation_vs_implementation_gap_analysis.md](file:///d:/Desarrollos/web-api-midespensa/69_documentation_vs_implementation_gap_analysis.md) |
| **Service Workers** | **MVP** | Cache local de assets estáticos de la PWA. Costo USD 0. | [69_documentation_vs_implementation_gap_analysis.md](file:///d:/Desarrollos/web-api-midespensa/69_documentation_vs_implementation_gap_analysis.md) |
| **JWT (HS256)** | **MVP** | Gestión simétrica de sesión del usuario en el Edge Worker. Costo USD 0. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **Magic Links (Resend)** | **MVP** | Autenticación transaccional passwordless. Plan gratuito. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **D1 Audit Trail** | **MVP** | Abstracción de logs inmutables en la tabla `auditoria_legal`. Costo USD 0. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **GitHub Actions** | **MVP** | Orquestador principal del plano de control de construcción y despliegue. Costo USD 0. | [76_ci_cd_governance_framework.md](file:///d:/Desarrollos/web-api-midespensa/76_ci_cd_governance_framework.md) |
| **OAuth Providers** | **Diferido** | Autenticación social (Google/GitHub) diferida para Fase 2. | [69_documentation_vs_implementation_gap_analysis.md](file:///d:/Desarrollos/web-api-midespensa/69_documentation_vs_implementation_gap_analysis.md) |
| **Cloudflare KV** | **Diferido / Obsoleto** | Excluido de MVP. Sesiones desacopladas en JWT y caché local. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **Durable Objects** | **Diferido / Obsoleto** | Excluido de MVP. Reemplazado por HTTP simple y transacciones D1. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **WebSockets** | **Diferido / Obsoleto** | Excluido de MVP. Reemplazado por polling simple bajo demanda. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **Cloudflare Queues** | **Diferido / Obsoleto** | Excluido de MVP. Reemplazado por IndexedDB `sync_queue` local. | [69_documentation_vs_implementation_gap_analysis.md](file:///d:/Desarrollos/web-api-midespensa/69_documentation_vs_implementation_gap_analysis.md) |
| **Cloudflare Logpush** | **Diferido / Obsoleto** | Excluido de MVP. Sustituido por `D1 Audit Trail` en el plan gratuito. | [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md) |
| **Cloudflare R2** | **Diferido / Futuro** | Hosting de imágenes diferido para V1 comercial. | [64_control_plane_architecture.md](file:///d:/Desarrollos/web-api-midespensa/64_control_plane_architecture.md) |
| **Workers AI** | **Diferido / Futuro** | Motor predictivo de consumo e IA diferido para Fase 3+. | [69_documentation_vs_implementation_gap_analysis.md](file:///d:/Desarrollos/web-api-midespensa/69_documentation_vs_implementation_gap_analysis.md) |

---

## 2. Validación de Directivas Críticas

### 2.1. Restricción Costo Operativo = USD 0
*   **Estado:** **Verificado ✅**.
*   **Análisis:** Todos los componentes requeridos para el MVP operan en límites gratuitos (Workers, D1, Resend, Github Actions). Los bindings de infraestructura con coste recurrente (Durable Objects, Logpush, KV activo en wrangler, R2) han sido completamente removidos o clasificados como diferidos.

### 2.2. Aislamiento e Identidades del Control Plane y Data Plane
*   **Estado:** **Verificado ✅**.
*   **Análisis:** 
    *   El correo `admin@biteradigital.com` está clasificado estrictamente como `SYSTEM_OWNER_EMAIL` (Control Plane) y se excluye de las tablas de datos operativos. Los JWT de los usuarios finales no tienen permisos sobre herramientas de administración. El patrón `Query Gate` de la Tenant Enforcement Layer (TEL) inyecta obligatoriamente el `hogar_id` y detiene en runtime cualquier ejecución transversa.
    *   **CI/CD Control Plane:** El orquestador GitHub Actions orquesta las tareas de compilación, escaneo y despliegue (Control Plane), interactuando con Cloudflare mediante Wrangler. Este proceso está lógicamente separado del Data Plane de la aplicación, ejecutando validaciones de código previas a la fusión y despliegue.

### 2.3. Consistencia de la Estructura de auditoria_legal
*   **Estado:** **Verificado ✅ (Centralizado)**.
*   **Análisis:** 
    *   La tabla `auditoria_legal` está definida de forma idéntica en [schema/d1-schema.sql](file:///d:/Desarrollos/web-api-midespensa/schema/d1-schema.sql) y en el Source of Truth oficial ([67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md)).
    *   Se ha resuelto mantener la definición de esquema SQL centralizada únicamente en estos dos documentos para evitar drifts futuros, agregando notas de referencia conceptual en `70` y `71`.

### 2.4. Alineación de Eventos de Seguridad Obligatorios
*   **Estado:** **Verificado ✅ (Corregido y Ampliado)**.
*   **Análisis:** Se ha validado la alineación de todos los eventos de auditoría obligatorios, incluyendo los eventos incorporados para el pipeline CI/CD:
    1.  `AUTH_MAGIC_LINK_REQUESTED`
    2.  `AUTH_SUCCESS`
    3.  `AUTH_FAILED`
    4.  `TENANT_BREACH_ATTEMPT`
    5.  `STOCK_MUTATION_ADD`
    6.  `STOCK_MUTATION_REMOVE`
    7.  `HOGAR_CREATE`
    8.  `CI_BUILD_STARTED` / `CI_BUILD_SUCCESS` / `CI_BUILD_FAILED`
    9.  `CD_DEPLOY_STAGING` / `CD_DEPLOY_PRODUCTION`
    10. `SECURITY_SCAN_PASSED` / `SECURITY_SCAN_FAILED`
    *   La Fase 2 y la nueva Fase 5 del plan de construcción ([implementation_plan.md](file:///C:/Users/zelma/.gemini/antigravity-ide/brain/b9210552-f600-439a-ad30-e7dfe181bb04/implementation_plan.md)) contienen explícitamente el cableado e implementación de todos estos eventos.

### 2.5. Ausencia de Decisiones en Conflicto
*   **Estado:** **Verificado ✅ (Corregido)**.
*   **Análisis:** 
    *   Se ha agregado el banner obligatorio `[!WARNING]` a [10_technical_decisions_validation.md](file:///d:/Desarrollos/web-api-midespensa/10_technical_decisions_validation.md), declarando obsoletas sus justificaciones iniciales de Durable Objects, KV y R2 para el MVP, y redirigiendo al modelo canónico oficial. Con esto se elimina cualquier riesgo de drift de decisiones técnicas.

### 2.6. Viabilidad de Execution en Free Tier de Recovery Drill #1 y CI/CD
*   **Estado:** **Verificado ✅**.
*   **Análisis:** GitHub Actions (plan gratuito), Wrangler CLI, `npm audit` y Lighthouse CI se configuran sin incurrir en costes de licencia o mantenimiento de infraestructura.

### 2.7. Ejecutabilidad del Construction Plan sin nuevos ADRs bloqueantes
*   **Estado:** **Verificado ✅**.
*   **Análisis:** Las bases de diseño y los proveedores ya cuentan con ADRs firmados en [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md). No se requieren nuevos análisis de arquitectura bloqueantes para comenzar el Sprint 1.
