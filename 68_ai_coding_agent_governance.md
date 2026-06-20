# 68_ai_coding_agent_governance.md — Gobierno de Agentes de Codificación de IA

Este documento establece el marco de gobierno, límites y reglas de ejecución obligatorias para cualquier agente cognitivo de IA que realice tareas de análisis, refactorización, auditoría o desarrollo de software en el repositorio de **Mi Despensa**.

---

## 1. Reglas Absolutas e Inviolables

Cualquier cambio propuesto por un agente de IA que viole alguna de estas reglas será rechazado automáticamente en el proceso de revisión y auditoría:

1.  **Costo Operativo = USD 0 (Finanzas):** No se permite la introducción de componentes que requieran suscripción, pago por uso, pasarelas de pago con costos de inicio, o dependencias de infraestructura fuera de los planes gratuitos oficiales (Cloudflare Free Tier, Resend Free Tier, GitHub Actions Free).
2.  **Aislamiento Multi-Tenant (Seguridad):** Toda consulta a la base de datos que lea o escriba en tablas del dominio (`inventario`, `events_stock`) debe pasar obligatoriamente por el filtro del parámetro `hogar_id` inyectado por el repositorio (`Query Gate`). Está estrictamente prohibido crear métodos que realicen consultas globales sin este parámetro.
3.  **Separación de Planos (Gobernanza):** La identidad institucional `admin@biteradigital.com` pertenece únicamente al **Control Plane** (administración de Cloudflare, Workspace, CI/CD). Queda prohibida su inclusión en el **Data Plane** (no puede registrarse en `users`, pertenecer a `hogares`, ni ser actor de `events_stock`).
4.  **Privacidad por Diseño (Criptografía):** Las direcciones de correo electrónico de los usuarios finales jamás deben almacenarse en texto claro. Para búsquedas y validación única se debe usar `SHA-256(normalize(email))`. Para comunicación se debe usar cifrado simétrico reversible `AES-GCM` con clave rotatoria.

---

## 2. Mapa de Permisos y Modificaciones (Scope Matrix)

| Directorio / Componente | ¿Modificable por IA? | Condiciones y Restricciones |
| :--- | :--- | :--- |
| `client/` (Frontend PWA) | **SÍ** | Seguir Vanilla CSS, HTML semántico e Inter de Google Fonts. Evitar dependencias/CSS frameworks de terceros (ej. Tailwind) salvo solicitud explícita. |
| `worker/src/routes/` | **SÍ** | Solo lógica de enrutamiento y validación de parámetros de entrada. |
| `worker/src/domain/` | **SÍ** | Reglas puras del negocio. Garantizar consistencia del Event Sourcing híbrido (`events_stock` + `inventario`). |
| `schema/d1-schema.sql` | **NO** | Solo modificable mediante un ADR formal y la aprobación de la Decision Gate de cambios de esquema. |
| `wrangler.toml` | **NO** | No se permite agregar bindings (Durable Objects, KV, R2, Queues) ni cambiar nombres de recursos de producción sin un ADR financiero de costo cero. |
| Middleware de Seguridad | **NO** | No alterar validación de CORS, CSP, Cookie Security attributes (HttpOnly, SameSite=Strict) ni algoritmos criptográficos. |
| Tests Automatizados | **SÍ** | Agregar cobertura sobre código nuevo o modificado. |

---

## 3. Límites Técnicos y Restricciones en el Edge

### 3.1. Restricciones de Recursos en Workers Free Tier
*   **CPU Limit:** El agente debe escribir código altamente optimizado. El tiempo máximo de CPU por petición no debe superar los **10ms**. Evitar loops anidados innecesarios, importaciones de librerías NPM pesadas, o parsing de payloads gigantescos en memoria.
*   **Request Limits:** El número de consultas D1 por petición debe ser el mínimo posible para no agotar el límite de 100k requests/día en Cloudflare Free.
*   **Startup Limit:** El Worker compilado final (`worker.js`) debe ser inferior a **1MB** (límite del plan gratuito). No importar frameworks de backend pesados en el Worker (usar micro-routers ultralivianos).

### 3.2. Criptografía y Secrets
*   El agente no debe guardar claves criptográficas en texto claro dentro del código fuente. Todas las llaves (`JWT_SECRET`, `ENCRYPTION_KEY_HEX`) deben extraerse de las variables de entorno inyectadas por Cloudflare en el objeto `env`.
*   El algoritmo JWT oficial para el MVP es **HS256** (según `ADR-JWT-ALGORITHM-DECISION`). No cambiar unilateralmente el middleware a RS256 o ES256.

---

## 4. Auditoría y Registro (Audit Trail)
Cualquier acción de seguridad crítica ejecutada por el agente de IA dentro del código debe generar un registro de auditoría utilizando el `Audit Evidence Provider` a través de la tabla `auditoria_legal` en D1, documentando:
*   Identificador del Actor (ej. ID de usuario del Data Plane o `SYSTEM_CONTROL_PLANE` en Control Plane).
*   Acción ejecutada (ej. `LOGIN_ATTEMPT`, `TOKEN_RENEWAL`).
*   Detalles serializados en formato JSON (sin almacenar contraseñas, tokens completos ni emails en claro).

---

## 5. Proceso de Cambio y Contribución de la IA

Si un agente de IA determina que es técnicamente indispensable violar alguna de estas restricciones para resolver un bug o implementar una característica:
1.  **Frenar el desarrollo:** No modificar el código fuente.
2.  **Redactar un ADR:** Escribir un Architectural Decision Record formal en la documentación del proyecto explicando el "Trade-off", justificación y costos.
3.  **Proponer Decision Gate:** Definir las condiciones bajo las cuales el cambio es seguro.
4.  **Solicitar aprobación humana:** Esperar confirmación explícita del Staff Software Architect o Product Owner de Bitera Digital SAS.
