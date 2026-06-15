# 57_architecture_guardrails.md — Salvaguardas de la Arquitectura

Este documento establece los límites arquitectónicos inquebrantables (*Architecture Guardrails*) para el desarrollo del sistema **Mi Despensa**. Define las reglas que no pueden ser modificadas bajo ninguna circunstancia sin un proceso formal de aprobación y aquellas decisiones técnicas que requieren un Registro de Decisión de Arquitectura (ADR) obligatorio.

---

## 1. Límites Arquitectónicos Inquebrantables (No Negociables)

Las siguientes decisiones y límites son absolutos. Su alteración se considera una violación del diseño base y congelará el pipeline de despliegue continuo:

1.  **Aislamiento Estricto Multi-Tenant en Base de Datos (D1):**
    *   *Regla:* Ninguna sentencia SQL de lectura o escritura puede ser ejecutada sin un filtro explícito de `hogar_id`.
    *   *Control:* Todo repositorio o capa de acceso a datos debe heredar de una abstracción que inyecte de manera forzosa el contexto del tenant extraído criptográficamente en el Edge.
    *   *Consecuencia:* Cualquier Pull Request que contenga consultas SQL sin validación de `hogar_id` será rechazado automáticamente por las reglas de análisis estático del pipeline.

2.  **Presupuesto Cero de Operación (Free Tier de Cloudflare):**
    *   *Regla:* El sistema debe operar en producción dentro de los límites del plan gratuito de Cloudflare (100k requests/día en Workers, 5M de lecturas/día en D1, 1GB de storage).
    *   *Control:* Queda estrictamente prohibida la introducción de servicios con costos de arranque fijos (ej. bases de datos tradicionales en VPS, servicios de mensajería externos pagos).
    *   *Consecuencia:* El uso de cualquier API o binding que requiera activación de facturación mensual en Cloudflare (ej. Durable Objects en su versión de pago obligatoria) está bloqueado hasta la aprobación de la puerta de decisión `DG-02`.

3.  **Seguridad Zero Trust en el Edge (Identity Validated):**
    *   *Regla:* Toda petición HTTP que acceda a zonas privadas de la API debe estar firmada criptográficamente con un JWT válido emitido por el Worker.
    *   *Control:* No se permite delegar la autenticación al cliente (PWA). El cliente no almacena secretos del sistema ni realiza validaciones lógicas de identidad.

---

## 2. Decisiones Técnicas que Requieren ADR Obligatorio

Cualquier desviación de las directrices documentadas requiere la redacción, revisión y aprobación de un **Registro de Decisión de Arquitectura (ADR)**. Es mandatorio iniciar un ADR antes de realizar commits en las siguientes áreas:

*   **Introducción de Dependencias del Lado del Servidor:** Agregar cualquier librería de terceros (NPM package) en el código del Worker que incremente el tamaño del bundle por encima de los 100KB o introduzca dependencias de APIs nativas de Node.js (que rompen la compatibilidad con el runtime de Cloudflare).
*   **Cambios en el Mecanismo de Sincronización Offline:** Modificar la lógica de reconciliación de conflictos basada en marcas de tiempo (Last Write Wins) por otra técnica de consistencia (ej. CRDTs o colas de eventos distribuidas).
*   **Modificación del Flujo de Identidad (Passwordless):** Intentar reemplazar el esquema de Magic Links de inicio de sesión por contraseñas tradicionales o proveedores externos de OAuth (ej. Google, Apple) en la fase de MVP.
*   **Esquemas de Base de Datos Modificados:** Cambios en las llaves foráneas o alteración del flujo de auditoría inmutable del stock en D1.

---

## 3. Matriz de Impacto por Alteración de Componentes

| Componente a Alterar | Requisito de Validación Previa | Impacto Arquitectónico | Acción en Caso de Desviación |
| :--- | :--- | :--- | :--- |
| **Controlador de Base de Datos** | Revisión por el Arquitecto de Datos | Alto (Riesgo de fugas de datos y corrupción) | Rechazo automático de PR. Reversión inmediata en Staging. |
| **Service Worker (PWA)** | Tests de rendimiento Lighthouse | Medio (Riesgo de degradación de Core Web Vitals) | Advertencia en CI. Bloqueo de promoción a producción si la puntuación baja de 90. |
| **Esquema de Eventos del Dominio** | Event Storming de control | Alto (Riesgo de acoplamiento de contextos) | Revisión manual en PR. Requiere aprobación explícita de dos desarrolladores senior. |
| **Configuración de Wrangler (`wrangler.toml`)** | Aprobación de DevOps | Crítico (Riesgo de degradación del pipeline de CI/CD) | Bloqueo físico de la rama en Git para cambios directos sin PR aprobado. |
