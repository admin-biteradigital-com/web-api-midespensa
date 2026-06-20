# Non Functional Requirements (NFR) - Mi Despensa

> [!WARNING]
> **ESTADO DE REFERENCIA:** Este documento ha sido auditado y contiene especificaciones parciales obsoletas respecto al MVP (como latencias de WebSockets y Durable Objects). La versión canónica y oficial de la arquitectura se detalla en [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md). Los objetivos de latencia y rendimiento oficial se alinean con [46_performance_validation_framework.md](file:///d:/Desarrollos/web-api-midespensa/46_performance_validation_framework.md).

Para lograr un sistema robusto, con latencia ultra-baja y escalabilidad masiva con costo operativo cero, se definen los siguientes Requerimientos No Funcionales organizados por pilares de ingeniería de software.

---

## 1. Rendimiento y Latencia (Performance & Latency)
*   **RNF-01 (Latencia del API en el Edge):** El 95% de las llamadas HTTP de lectura de inventario (GET) deben responder en menos de **50ms** desde los puntos de presencia de Cloudflare (*PoPs*), excluyendo la latencia de red del último kilómetro del ISP del usuario.
*   **RNF-02 (Tiempo de Respuesta en Escrituras Distribuidas):** Las operaciones de mutación de stock (POST/PUT) procesadas por Cloudflare Workers y D1 deben retornar una confirmación en menos de **150ms** ($p95$).
*   **RNF-03 (Sincronización en Tiempo Real):** La propagación de cambios del inventario a través de WebSockets (manejados mediante Durable Objects en el Edge) a los clientes concurrentes del mismo Hogar debe completarse en menos de **250ms** desde que el servidor procesa el evento.

---

## 2. Disponibilidad y Resiliencia (Availability & Fault Tolerance)
*   **RNF-04 (Disponibilidad de la API):** El backend serverless debe asegurar un nivel de disponibilidad de **99.9%** ($3\text{ nueves}$), apalancándose en la infraestructura global multiregión y tolerante a fallos de Cloudflare.
*   **RNF-05 (Resiliencia Offline-First):** La aplicación cliente (PWA) debe permanecer 100% operativa para visualización de la última copia local de datos almacenados y registros de consumo locales durante eventos de pérdida total de conectividad a internet.

---

## 3. Seguridad y Privacidad (Security & Privacy)
*   **RNF-06 (Cifrado de Datos en Tránsito y Reposo):** Todos los flujos de red deben obligar el uso de **TLS 1.3** como versión mínima y cipher suites seguras (Zero Trust). Los datos persistidos en D1 y R2 deben cifrarse automáticamente en reposo mediante algoritmos AES-256.
*   **RNF-07 (Control de Acceso basado en Mínimo Privilegio):** El API debe validar tokens criptográficos firmados (JWT / Cloudflare Access Tokens) en cada petición entrante. La base de datos D1 debe contar con políticas de aislamiento a nivel de consulta para impedir fugas de datos entre inquilinos.

---

## 4. Costos Operativos y Eficiencia de Infraestructura
*   **RNF-08 (Costo Base Cero):** El consumo de recursos del sistema debe mantenerse por debajo del límite de cortesía de los planes gratuitos de Cloudflare para un volumen inicial de hasta **5,000 hogares activos mensuales**:
    *   Límite de solicitudes HTTP del Worker: $<100,000$ peticiones/día por cuenta.
    *   Base de datos D1: $<5\text{ GB}$ de almacenamiento total y límites estándar de operaciones de lectura/escritura diarias gratuitas.
    *   Cloudflare R2: $<10\text{ GB}$ de almacenamiento de archivos/fotos gratuito sin cargos de descarga.

---

## 5. Portabilidad y Compatibilidad
*   **RNF-09 (Responsive / Mobile-First):** La interfaz de la PWA debe adaptarse perfectamente a pantallas desde 320px de ancho (móviles de gama baja) hasta monitores de escritorio (4K).
*   **RNF-10 (Compatibilidad del Navegador):** Las características offline (Service Workers, Cache API, IndexedDB) deben ser compatibles con las últimas 3 versiones mayores de Google Chrome, Apple Safari (iOS/macOS), Mozilla Firefox y Microsoft Edge.
