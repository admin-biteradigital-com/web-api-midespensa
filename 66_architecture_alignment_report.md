# 66_architecture_alignment_report.md — Reporte de Alineación Arquitectónica

Este reporte establece el mapa de alineación y trazabilidad multidimensional de la plataforma **Mi Despensa**, propiedad de **Bitera Digital SAS**. Garantiza que las decisiones tecnológicas y operativas respondan directamente a los objetivos estratégicos, restricciones financieras, requisitos de seguridad y mandatos de compliance del negocio.

---

## 1. Matriz de Alineación Global (Traceability Matrix)

| Objetivo / Restricción de Negocio | Concepto de Dominio (Domain) | Control de Seguridad (Security) | Mandato de Compliance | Componente de Infraestructura |
| :--- | :--- | :--- | :--- | :--- |
| **Costo Operativo = USD 0** | Simplicidad de Agregados y Proyecciones | Algoritmos de baja CPU (SHA-256, AES-GCM, JWT Simétrico/Asimétrico evaluado) | ISO 27001 A.12.1.3 (Gestión de Capacidad) | Cloudflare Free Tier (Workers, D1, R2, KV opcional) |
| **Aislamiento Multi-Tenant (Hogares)** | `Tenant Boundary` en `HogarAggregate` y `InventarioAggregate` | Tenant Enforcement Layer (TEL) como Query Gate inquebrantable | GDPR Art. 32 (Seguridad del tratamiento) | D1 Database (Consultas parametrizadas forzadas con `hogar_id`) |
| **Privacidad por Diseño (PII Protegida)** | `User` sin datos identificables expuestos | Cifrado reversible AES-GCM (Email) + Hash SHA-256 no reversible (Búsquedas) | GDPR Art. 25 & Ley 18.331 Art. 9 | Edge Worker (Procesamiento criptográfico local) |
| **Evidencia de Auditoría Inmutable** | Registro de Auditoría Local | `Audit Evidence Provider` con implementación `D1 Audit Trail` append-only | ISO 27001 A.12.4 (Registros y Evidencia) | D1 Database (Tabla `auditoria_legal`) / Logpush (Evolutivo futuro) |
| **Operación Offline / Conectividad Intermitente** | Cola local transaccional y sincronización | Token JWT de sesión almacenado de forma segura en almacenamiento local | GDPR Art. 32 (Disponibilidad y resiliencia) | PWA Client (Service Worker + IndexedDB) |
| **Separación de Responsabilidades Operativas** | Exclusión de identidades corporativas del Data Plane | Control Plane Identity (`admin@biteradigital.com`) separado de Data Plane Identity | ISO 27001 A.6.1.2 (Segregación de funciones) | Google Workspace + Cloudflare Account |

---

## 2. Desglose de Alineación por Capa

### 2.1. Capa de Negocio (Business Layer)
*   **Visión:** Proveer una solución móvil de gestión de despensa familiar, rápida y sin fricciones.
*   **Restricción Financiera Inquebrantable:** Límite financiero estricto de **USD 0**. Toda decisión arquitectónica debe ser ejecutable dentro del Free Tier de Cloudflare, Resend y GitHub. Esto descarta Durable Objects en la fase MVP, forzando a usar transacciones en D1.
*   **Identidad Corporativa:** Gobernado legal y técnicamente por **Bitera Digital SAS**.

### 2.2. Capa de Dominio (Domain Layer)
*   **Event Sourcing Híbrido:** El estado del inventario se deriva de un registro inmutable de cambios (`events_stock`), garantizando trazabilidad total de quién, cuándo y cuánto stock se modificó.
*   **Vista Materializada (`inventario`):** Optimizada para lectura rápida en el Edge, sincronizada atómicamente mediante transacciones en la misma query D1 en el MVP.
*   **Membresía:** El límite del hogar actúa como el límite del tenant (`Tenant Boundary`).

### 2.3. Capa de Seguridad (Security Layer)
*   **TEL (Tenant Enforcement Layer):** Interceptor a nivel de base de datos que obliga a incluir `hogar_id` en toda consulta de dominio. Si el contexto de ejecución carece de un `hogar_id` válido, la consulta falla de inmediato (fail-closed).
*   **Criptografía en el Edge:** Uso de Web Crypto API en Cloudflare Workers para el hash SHA-256 de búsqueda de emails y el cifrado/descifrado AES-GCM de emails para envío de notificaciones.

### 2.4. Capa de Compliance (Compliance Layer)
*   **GDPR / Ley 18.331 (Uruguay):** El uso de hashes no reversibles (`email_hash`) para login evita el almacenamiento de PII en texto claro para indexación. El cifrado AES-GCM protege el email transaccional (`email_encrypted`).
*   **ISO 27001 / SGSI:** El `Audit Evidence Provider` (implementado mediante D1 Audit Trail) captura de forma inmutable todas las operaciones administrativas e intentos de acceso fallidos, sirviendo como registro formal de auditoría.

### 2.5. Capa de Infraestructura (Infrastructure Layer)
*   **Edge Compute:** Cloudflare Workers ejecutan la API en milisegundos cerca del usuario final.
*   **Serverless Storage:** D1 Database proporciona almacenamiento relacional SQL ligero y gratuito compatible con transacciones atómicas.
*   **PWA Assets:** Service Worker con cache `stale-while-revalidate` para minimizar el tráfico hacia el Worker, reduciendo el conteo de solicitudes contra el Free Tier (límite de 100k requests/día).

---

## 3. Mecanismos de Gobierno y Control de Alineación

Para evitar el "Drift" arquitectónico en la fase de construcción real (Sprint 1 en adelante), se definen tres puntos de control integrados:

1.  **Pipeline CI/CD con Gates Financieros:** El pipeline de GitHub Actions verificará la ausencia de bindings costosos (como Durable Objects, Cloudflare Queues o Hyperdrive) en el archivo `wrangler.toml` antes de permitir el despliegue a Staging/Producción.
2.  **Linting y Análisis Estático de TEL:** Herramientas automatizadas validarán que todas las consultas SQL pasen por la abstracción de repositorio que inyecta automáticamente el `hogar_id`.
3.  **Registro Obligatorio de Excepciones:** Cualquier desviación del modelo costo cero debe documentarse en un ADR y validarse en una Decision Gate firmada por el Staff Software Architect de Bitera Digital SAS.
