# 80_security_reality_check.md — Reality Check: Estado Físico de Seguridad

Este reporte realiza una validación física detallada sobre la base de código para comprobar el estado real de los controles de seguridad y cumplimiento del producto.

---

## 1. Verificación Física de Componentes de Seguridad

### 1.1. Protección de PII (Tres Capas)
*   **Estado:** **✅ Implementado**
*   **Detalle:** El archivo [worker/src/utils/crypto.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/utils/crypto.ts) implementa la encriptación simétrica AES-GCM-96 reversible y el hash SHA-256 no reversible. La ruta de registro de usuarios en [worker/src/routes/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/auth.ts) normaliza la dirección de correo y almacena el email cifrado en D1.

### 1.2. Aislamiento Multi-Tenant (TEL)
*   **Estado:** **✅ Implementado**
*   **Detalle:** El interceptor de consultas `D1QueryGate` en [worker/src/middleware/tel.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/tel.ts) valida la existencia de `hogarId` en el contexto y rechaza en runtime cualquier query que intente saltarse el campo `hogar_id` arrojando un error de tipo `SECURE_GATE_VIOLATION`.

### 1.3. Firma y Validación de Sesión (JWT)
*   **Estado:** **✅ Implementado**
*   **Detalle:** El middleware [worker/src/middleware/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/auth.ts) contiene la lógica real de firmado y decodificación de JSON Web Tokens mediante el algoritmo HS256 utilizando la librería `jose`.

### 1.4. Integración de Magic Links (Resend API)
*   **Estado:** **🔴 Documentado pero no implementado**
*   **Detalle:** El backend no cuenta con cliente HTTP o wrapper SDK para conectarse a la API de Resend en [worker/src/routes/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/auth.ts). La URL generada se emite como un link de depuración local.

### 1.5. Tabla `auditoria_legal` en Base de Datos DDL
*   **Estado:** **✅ Implementado**
*   **Detalle:** El archivo físico [schema/d1-schema.sql](file:///d:/Desarrollos/web-api-midespensa/schema/d1-schema.sql) contiene la definición correcta e idéntica de la tabla `auditoria_legal` para D1.

### 1.6. Audit Evidence Provider (Logger Criptográfico)
*   **Estado:** **🔴 Documentado pero no implementado**
*   **Detalle:** No existen las clases o funciones para calcular el Hash Chain (concatenación SHA-256 acumulativa del registro anterior) ni la firma digital HMAC del registro utilizando `JWT_SECRET`. Las rutas no invocan ninguna lógica de auditoría legal en este estado.

---

## 2. Matriz de Estado de Controles de Seguridad

| Control de Seguridad | Requisito Relacionado | Estado de Implementación | Ubicación del Archivo Físico |
| :--- | :--- | :---: | :--- |
| **Cifrado de PII** | ISO 27701 (Privacidad) | **✅ Implementado** | [worker/src/utils/crypto.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/utils/crypto.ts) |
| **Middleware de JWT** | Autenticación y Autorización | **✅ Implementado** | [worker/src/middleware/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/auth.ts) |
| **Tenant Enforcement Layer (TEL)**| Multi-Tenancy Aislado | **✅ Implementado** | [worker/src/middleware/tel.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/middleware/tel.ts) |
| **Esquema de Base de Datos** | Estructura SQL inicial | **✅ Implementado** | [schema/d1-schema.sql](file:///d:/Desarrollos/web-api-midespensa/schema/d1-schema.sql) |
| **Envío de Correos (Magic Links)** | Autenticación passwordless real | **🔴 No implementado** | Simulación local en [worker/src/routes/auth.ts](file:///d:/Desarrollos/web-api-midespensa/worker/src/routes/auth.ts) |
| **Registro de Eventos de Seguridad** | ISO 27001 A.12.4 (Logs) | **🔴 No implementado** | Pendiente implementación de logger criptográfico. |
