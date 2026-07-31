# 67_final_architecture_canonical_model.md — Modelo Canónico de Arquitectura Oficial

Este documento se constituye formalmente como la **Fuente Única de Verdad (Source of Truth)** de la arquitectura del proyecto **Mi Despensa**. En caso de discrepancia, contradicción o drift con cualquier otro documento del repositorio (del 01 al 66), los términos y especificaciones definidos aquí prevalecen de forma absoluta.

---

## 1. Stack Tecnológico Oficial del MVP (Costo USD 0)

| Capa | Componente Oficial | Restricciones de Uso en MVP |
| :--- | :--- | :--- |
| **Edge Compute** | Cloudflare Workers (TypeScript) | Límite estricto de CPU (10ms por request). Sin uso de sub-workers pagos. |
| **Base de Datos** | Cloudflare D1 (SQLite en el Edge) | Transacciones atómicas en query. Límite de 5M de filas (Free Tier). |
| **Almacenamiento** | Cache de Cloudflare (assets estáticos) | No se usa Cloudflare R2 en MVP. Binding R2 diferido para V1. |
| **Identidad / Auth** | Magic Links vía Resend API | Envío de correos restringido al plan gratuito de Resend (100 emails/día). |
| **Sesión** | JWT Simétrico (HS256) | Validado vía `ADR-JWT-ALGORITHM-DECISION`. |
| **Auditoría Legal** | `D1 Audit Trail` (Tabla local D1) | Validado vía abstracción `Audit Evidence Provider`. |
| **Cliente Web** | PWA (HTML, Vanilla CSS, JS/TS) | Service Workers + IndexedDB para operaciones y cola offline. |

---

## 2. Resoluciones de Conflictos Arquitectónicos

### 2.1. Cloudflare Durable Objects y WebSockets
*   **Decisión Final:** **EXCLUIDOS del MVP**. 
*   **Resolución:** Los documentos que sugerían sincronización en tiempo real basada en Durable Objects (Doc 01, 04, 05, 10, 16) quedan anulados en esa sección. El MVP utiliza HTTP simple contra la API del Edge Worker. La introducción de Durable Objects y WebSockets permanentes está diferida a la versión V1+ y condicionada al cumplimiento de la Decision Gate `DG-02` y su respectiva evaluación de costos.

### 2.2. Cloudflare KV
*   **Decisión Final:** **EXCLUIDO del MVP**.
*   **Resolución:** Las referencias a Cloudflare KV para almacenar sesiones de usuario o catálogos (Doc 05, 33, 34, 54) quedan en estado condicional. El MVP almacena las sesiones de forma descentralizada mediante tokens JWT auto-contenidos, y el catálogo/estado se almacena localmente en IndexedDB. KV se reevaluará mediante ADR en la Fase 2 si el volumen de lectura de datos estáticos justifica la sobrecarga operativa.

---

## 3. Cuestiones Críticas de Seguridad y Privacidad

### 3.1. Esquema SQL Oficial de D1

El esquema real y oficial para el inicio de construcción (Sprint 1) se define de la siguiente manera, agregando la tabla `auditoria_legal` para soportar la evidencia de cumplimiento:

```sql
-- Tabla de Usuarios (PII Protegida por Diseño)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL, -- normalize(SHA-256(email)) para búsquedas únicas y rápidas
  email_encrypted TEXT NOT NULL, -- AES-GCM(email) para envíos de correos
  created_at TEXT NOT NULL
);

-- Tabla de Hogares (Tenant Boundaries)
CREATE TABLE hogares (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL
);

-- Tabla de Inventario (Vista Materializada)
CREATE TABLE inventario (
  id TEXT PRIMARY KEY,
  hogar_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabla de Eventos de Stock (Source of Truth del Dominio - Append Only)
CREATE TABLE events_stock (
  id TEXT PRIMARY KEY,
  hogar_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'ADD', 'REMOVE', 'UPDATE_TARGET'
  quantity_delta INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  actor_user_id TEXT NOT NULL
);

-- Tabla de Auditoría Legal (Audit Evidence Provider - D1 Audit Trail)
CREATE TABLE auditoria_legal (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL, -- ISO-8601 UTC
  actor_id TEXT NOT NULL, -- user_id (Data Plane), 'SYSTEM_CONTROL_PLANE' (Control Plane) o actor GitHub (CI/CD)
  hogar_id TEXT, -- Null para Auth/Control Plane/CI-CD, UUIDv4 para operaciones dentro del hogar
  action TEXT NOT NULL, -- Eventos de negocio, seguridad y CI/CD
  details TEXT NOT NULL, -- JSON serializado sin secretos
  hash TEXT NOT NULL, -- Hash acumulativo SHA-256 (hash del anterior + datos del actual)
  signature TEXT NOT NULL -- Firma HMAC-SHA256 del registro usando JWT_SECRET
);
```

### 3.1.1. Especificación del Audit Trail y Eventos Logueados

Para dar cumplimiento formal a las directrices de seguridad (ISO 27001 e ISO 27701) y la gobernanza del pipeline, el `Audit Evidence Provider` registrará obligatoriamente los siguientes eventos:

*   **AUTH_MAGIC_LINK_REQUESTED:** Registra cuando un email normalizado solicita un Magic Link.
*   **AUTH_SUCCESS:** Registra cuando un usuario final se valida de forma exitosa y recibe un JWT.
*   **AUTH_FAILED:** Registra intentos de verificación con tokens inválidos o expirados.
*   **TENANT_BREACH_ATTEMPT:** Registra intentos de evasión del TEL (ej. invocar endpoints de inventario sin `hogar_id` o con discrepancia de claims en JWT).
*   **STOCK_MUTATION_ADD / STOCK_MUTATION_REMOVE:** Registra la traza del actor y el delta modificado en el inventario.
*   **HOGAR_CREATE:** Registra la inicialización de un nuevo Tenant.
*   **CI_BUILD_STARTED / CI_BUILD_SUCCESS / CI_BUILD_FAILED:** Registra el ciclo de vida de la compilación y validación estática de código.
*   **CD_DEPLOY_STAGING / CD_DEPLOY_PRODUCTION:** Registra los despliegues automáticos a Staging y despliegues aprobados a Producción.
*   **SECURITY_SCAN_PASSED / SECURITY_SCAN_FAILED:** Registra los resultados de las auditorías de dependencias y vulnerabilidades.

#### Mecanismo de Cadena de Hashes (Hash Chain)
Para asegurar que ningún registro de la base de datos sea modificado o eliminado ad-hoc en el Edge, el `hash` de cada registro se calcula concatenando:
`SHA-256(registro_anterior.hash + actual.timestamp + actual.actor_id + actual.action + actual.details)`
Si el log es alterado o truncado, el hash secuencial se romperá en la siguiente inserción, levantando una alarma de integridad en las auditorías de Control Plane.

#### Firma de Registro (No Repudio)
La columna `signature` almacena el resultado de:
`HMAC-SHA-256(actual.hash, env.JWT_SECRET)`
Esto garantiza que solo la API legítima en el Edge Worker de Cloudflare pudo haber escrito el registro de auditoría, previniendo alteraciones manuales en la base de datos D1.


### 3.2. Aislamiento Multi-Tenant (Tenant Enforcement Layer - TEL)
El control `TEL` opera en la capa de acceso a datos (`Query Gate`). Ninguna consulta de lectura o escritura a las tablas `inventario` o `events_stock` puede omitir el parámetro `hogar_id`. El repositorio de datos valida obligatoriamente este parámetro de la siguiente manera:
1. Extrae el `hogar_id` verificado desde los claims del token JWT decodificado en el middleware.
2. Inyecta este parámetro en el query SQL de D1 parametrizado.
3. Si el parámetro es nulo o inválido, la query se aborta arrojando una excepción del tipo `SecurityBoundariesViolation` y registrando el evento en `auditoria_legal`.

---

## 4. Registro de Decisiones de Arquitectura (ADR)

### ADR-JWT-ALGORITHM-DECISION: Selección del Algoritmo de Firma de Tokens

#### Contexto
El sistema requiere emitir y validar tokens JSON Web Token (JWT) en el Edge Worker para representar las sesiones de los usuarios finales y asegurar el aislamiento multi-tenant. Debemos seleccionar un algoritmo que cumpla con los estándares de seguridad, minimice la latencia y la CPU en Cloudflare Workers Free Tier (límite de 10ms de CPU por request), y mantenga el Costo Operativo = USD 0.

#### Opciones Evaluadas

##### Opción A: HS256 (HMAC using SHA-256) — Simétrico
*   **Seguridad:** Adecuada si el secreto de firma se mantiene confidencial. Al ser simétrico, el emisor y el verificador comparten la misma clave secreta (`JWT_SECRET`).
*   **Consumo de CPU:** Extremadamente bajo. La verificación HMAC-SHA256 toma menos de 0.2ms en Cloudflare Workers usando la Web Crypto API nativa.
*   **Complejidad:** Muy baja. No requiere generar ni administrar pares de claves públicas/privadas.
*   **Costo:** USD 0.

##### Opción B: ES256 (ECDSA using P-256 and SHA-256) — Asimétrico
*   **Seguridad:** Alta. Separación estricta de responsabilidades: la clave privada firma, la clave pública verifica.
*   **Consumo de CPU:** Moderado-Alto en el Edge. La verificación de firmas ECDSA de curvas elípticas consume entre 1.5ms y 3ms de CPU por validación, lo que representa hasta un 30% del límite de CPU del plan gratuito de Cloudflare Workers.
*   **Complejidad:** Alta. Requiere configurar variables de entorno para la clave privada y distribuir/almacenar la clave pública.
*   **Costo:** USD 0.

##### Opción C: Ed25519 (EdDSA using SHA-512) — Asimétrico (Criptografía Moderna)
*   **Seguridad:** Excelente. Resistente a ataques de canal lateral, diseño de clave pública moderno.
*   **Consumo de CPU:** Bajo-Moderado. Ed25519 es significativamente más rápido en verificación que ES256 (típicamente menos de 1ms de CPU en el Edge Worker).
*   **Complejidad:** Alta. Requiere generación y administración de claves Ed25519 en formato PEM/JWK e importación en Web Crypto API.
*   **Costo:** USD 0.

#### Recomendación Fundamentada y Decisión
Para el **MVP de Mi Despensa**, se adopta formalmente **HS256**.

**Justificación:**
1.  **Modelo de Ejecución Edge-Monolítico:** El Edge Worker de Cloudflare actúa simultáneamente como el emisor del Magic Link/JWT (Autenticación) y como el consumidor que valida el JWT (Acceso al inventario). Al no existir distribución del JWT a sistemas externos fuera del control de Bitera Digital SAS, la debilidad del algoritmo simétrico (compartir clave de firma/verificación) queda neutralizada.
2.  **Restricción de Recursos (CPU Limit):** El plan gratuito de Cloudflare Workers otorga un límite estricto de 10ms de CPU. HS256 consume una fracción despreciable (0.2ms) en comparación con ES256 (hasta 3ms) o Ed25519 (1ms), lo que deja un presupuesto holgado de CPU para operaciones complejas como el descifrado AES-GCM del email de usuario o las queries SQLite contra D1.

**Política de Evolución (V1+):**
Si el sistema evoluciona y el servicio de autenticación se separa en un microservicio independiente (o se abren APIs públicas a terceros), se migrará obligatoriamente a **Ed25519** para obtener los beneficios de la firma asimétrica sin incurrir en la penalización de CPU que supone ES256.

---

### ADR-AUDIT-PROVIDER-DECISION: Selección de Proveedor para Auditoría Legal

#### Contexto
El cumplimiento normativo de la norma ISO 27001 (Control A.12.4) exige registrar logs de eventos de seguridad de forma inalterable y auditable. En la documentación original se prescribía el uso de Cloudflare Logpush para exportar logs automáticamente a un bucket R2 en modo append-only. Sin embargo, Logpush requiere una cuenta de Cloudflare con plan Enterprise o Workers Paid, lo que viola la política estratégica de **Costo Operativo = USD 0**.

#### Abstracción: Audit Evidence Provider
Se define una interfaz de software abstracta para el registro de auditoría legal:
```typescript
interface AuditEvidenceProvider {
  recordEvent(actor: string, action: string, details: Record<string, any>): Promise<void>;
}
```

#### Implementación MVP: D1 Audit Trail
*   **Mecanismo:** El Worker implementa la interfaz utilizando la tabla `auditoria_legal` en la base de datos D1.
*   **Garantía de Integridad:** Se implementa una política estrictamente append-only a nivel lógico. La API no expone ningún endpoint de actualización o borrado en la tabla `auditoria_legal`. Las migraciones DDL automáticas que alteren o eliminen registros de esta tabla están bloqueadas por el pipeline de CI/CD.
*   **Costo:** USD 0.

#### Implementación Evolutiva: Cloudflare Logpush
*   **Mecanismo:** Cuando Bitera Digital SAS apruebe la Decision Gate de financiamiento comercial del producto, se habilitará Logpush a nivel de infraestructura para desviar los eventos hacia buckets R2 configurados con políticas de retención e inmutabilidad estricta (Object Lock).

**Decisión:** Adoptar **D1 Audit Trail** para el MVP y dejar **Logpush** como el proveedor configurado para escalado futuro.

---

### ADR-MAIL-PROVIDER: Selección y Gobernanza del Proveedor de Email (Magic Links)

#### Contexto
El sistema de autenticación de **Mi Despensa** depende de la entrega segura y rápida de enlaces Magic Links. Para cumplir con la restricción estratégica de **Costo Operativo = USD 0** y asegurar las políticas de compliance, se evalúa e implementa un proveedor transaccional gratuito.

#### Proveedor Seleccionado: Resend (Free Tier)
*   **Límites de Uso:** El plan gratuito de Resend otorga un límite de **3.000 emails al mes** (máximo **100 emails al día**). Para la fase MVP y testing controlado de Bitera Digital SAS, este límite es holgado y se ajusta a la restricción de costo cero.
*   **Dominio Remitente Oficial:** Todos los Magic Links se transmitirán bajo el dominio corporativo autenticado:
    `auth@biteradigital.com` o `no-reply@biteradigital.com`

#### Configuración de Seguridad y Autenticación del Dominio
Para evitar que los correos sean clasificados como Spam y asegurar el no repudio, se configuran las siguientes directivas DNS a nivel de Control Plane en Cloudflare para `biteradigital.com`:
1.  **SPF (Sender Policy Framework):** Registro TXT que autoriza a los servidores de Resend a enviar emails en nombre de Bitera Digital SAS.
    `v=spf1 include:amazonses.com include:resend.com ~all`
2.  **DKIM (DomainKeys Identified Mail):** Clave criptográfica pública en DNS que permite al servidor receptor validar que el correo no fue alterado durante el transporte. Se configuran las tres claves CNAME provistas por el Dashboard de Resend.
3.  **DMARC (Domain-based Message Authentication, Reporting, and Conformance):** Política de alineación que prescribe qué hacer si falla SPF o DKIM:
    `v=DMARC1; p=quarantine; pct=100; rua=mailto:admin@biteradigital.com`
    (Los correos fallidos se envían a cuarentena y los reportes de anomalías de seguridad se consolidan en `admin@biteradigital.com`).

#### Fallback Operativo (Testing y Contingencia)
En entornos de desarrollo local o si el límite del plan gratuito de Resend es excedido (100/día):
*   El Edge Worker redirigirá la salida del Magic Link a la consola de logs de Cloudflare (`wrangler tail`).
*   La API del Worker retornará la URL de verificación directamente en el payload JSON de depuración (`debugUrl`) solo si el entorno es de desarrollo local (`env.ENVIRONMENT === "local"`). Esto evita bloqueos de testing E2E en pipelines de CI/CD.

---

## 5. CI/CD Control Plane

Se incorpora formalmente la gobernanza y orquestación del ciclo de vida como parte de la arquitectura del plano de control del sistema, totalmente segregado de la ejecución en caliente (Data Plane) y bajo la política estricta de **Costo USD 0**:

```
GitHub Repository ──► GitHub Actions ──► Validation Gates ──► Cloudflare Staging ──► Manual Approval ──► Production
```

### 5.1. Componentes y Flujos de Promoción
1.  **GitHub Repository (Control Plane Source):** Punto de partida de almacenamiento y control de versiones bajo políticas de ramificación obligatorias.
2.  **GitHub Actions (Orquestador CI/CD):** Ejecuta automáticamente validaciones y despliegues sin coste operativo.
3.  **Validation Gates (Compuertas):** Aseguran la calidad del código bloqueando integraciones si no se cumple con los objetivos de testeo (cobertura >= 85%) y seguridad (0 vulnerabilidades altas o críticas).
4.  **Cloudflare Staging (Entorno de Pruebas):** Despliegue automático de Wrangler al integrar cambios en `develop`.
5.  **Manual Approval (Aprobación Manual):** Firma y validación humana obligatoria antes de desplegar en producción desde `main` por `admin@biteradigital.com`.
6.  **Production (Entorno de Producción):** Despliegue final e inalterable en el Edge.

---

## 6. Gobernanza del Estado de Presentación y Sesión (FSM & Session Module)

Para blindar la separación de responsabilidades y asegurar que la arquitectura evolucione de forma limpia sin acoplamientos entre la lógica de interfaz de usuario y la persistencia de datos, se establecen las siguientes directivas de diseño:

### 6.1. Semántica del Origen de Transiciones
> *The origin of a state transition is not part of the state semantics. Any behavior that depends on the origin of AUTH_SUCCESS MUST be determined by the domain event that preceded the transition, not by the UI state itself.*

El estado `AUTH_SUCCESS` de la FSM de presentación es estrictamente visual y no contiene información histórica sobre cómo se alcanzó. Toda diferenciación sobre si un usuario acaba de autenticarse mediante credenciales (`UserAuthenticated`) o si su sesión fue recuperada de forma transparente (`SessionRestored`) es propiedad de los eventos del dominio y debe ser resuelta por sus receptores correspondientes (como el orquestador), nunca inspeccionando el estado visual de la FSM.

### 6.2. Fuente de Verdad sobre la Validez de Sesión
> *The FSM MUST NEVER be considered the source of truth for session validity. Session validity is owned exclusively by SessionModule. The FSM only reflects the current presentation state.*

> *The ApplicationOrchestrator may cache session information for presentation purposes. This cache MUST NOT be considered the source of truth for session validity.*

La FSM tiene como único propósito reflejar la interfaz visual en un momento dado. Ningún componente del sistema fuera de la capa de presentación debe leer el estado actual de la FSM (ej. `fsm.state === 'AUTH_SUCCESS'`) para deducir si una sesión es válida o para autorizar operaciones. El estado real y la validez de la sesión residen única y exclusivamente bajo la custodia del `SessionModule`. Cualquier variable local o caché en el orquestador (`token`, `user`) tiene como único fin evitar lecturas excesivas al almacenamiento físico para fines de renderizado visual; no representa la fuente de verdad de la validez de la sesión.

### 6.3. Aislamiento y Limitación de Payloads FSM
> *The payload associated with an FSM state transition belongs exclusively to the presentation layer and MUST NOT contain domain data whose interpretation triggers business logic or session state mutations.*

El parámetro `data` que se transmite opcionalmente a través de `setAuthState` y en el evento `FSM_STATE_CHANGED` sirve únicamente para enviar datos necesarios para pintar o controlar elementos visuales (por ejemplo, el mensaje de error o la causa de fallo de un timeout, o el correo electrónico para feedback visual). Está estrictamente prohibido pasar en este payload información del dominio (como tokens de autenticación o datos del perfil del usuario) con el propósito de que sean leídos y procesados por capas como el `SessionModule` para escribir o modificar la sesión activa. La FSM puede transportar payload de UI, pero nunca payload hacia el dominio.

### 6.4. Límite de Acceso al Almacenamiento de Sesión (SessionModule API Boundary)
> *No module other than SessionModule may directly read or write the persistent session storage (e.g. localStorage).*

Queda estrictamente prohibido que cualquier módulo del cliente fuera del `SessionModule` realice llamadas directas de lectura o escritura a la API de persistencia local (como `localStorage.setItem("token", ...)`). Toda interacción física con las credenciales almacenadas debe encapsularse a través de la interfaz pública provista por el `SessionModule` para asegurar la cohesión de los datos y evitar regresiones de acoplamiento.

### 6.5. Inmutabilidad de Payloads del EventBus (Domain Event Immutability Rule)
> *Every payload received from the EventBus SHALL be treated as an immutable value object. Consumers MUST NEVER mutate received payloads. Any required modification SHALL create a new object.*

Para preservar el desacoplamiento y evitar efectos secundarios inesperados en la propagación de datos del dominio, todo payload transmitido a través del `EventBus` y recibido por los suscriptores es inmutable por definición. Está estrictamente prohibido que cualquier módulo suscriptor (como el `ApplicationOrchestrator`) intente modificar o añadir propiedades a estos objetos directamente. Si una funcionalidad requiere actualizar la información recibida (por ejemplo, asignar el identificador de hogar al usuario tras su creación), el consumidor deberá construir un nuevo objeto utilizando copias (ej. `{ ...user, hogarId: ... }`) o mediante transformaciones explícitas, dejando intacto el payload original.

### 6.6. Fuente de Verdad Criptográfica y Jerarquía de Estado del Cliente (JWT Primacy Rule)
> *The JWT issued by the backend is the cryptographically signed Source of Truth for session identity. The `localStorage.user` object is a local cache derived from the JWT. In any conflict between the two, the JWT prevails unconditionally.*

**Decisión Arquitectónica:** El sistema reconoce formalmente dos representaciones del estado de sesión en el cliente:

1.  **JWT (`localStorage.token`):** Firmado criptográficamente por el backend mediante HMAC-SHA256. Sus claims (`userId`, `email`, `hogarId`, `exp`, `iss`, `aud`, `typ`) constituyen datos verificables e inalterables por el cliente. Es la **fuente de verdad primaria**.
2.  **Objeto de Usuario (`localStorage.user`):** Un JSON plano derivado del JWT al momento de la autenticación. Actúa como **caché de lectura rápida** para evitar decodificaciones repetidas del JWT en la capa de presentación. No posee ninguna garantía criptográfica y es susceptible de quedar desactualizado o corrompido por evoluciones del código del cliente.

**Implicación:** Si el JWT contiene un claim con un valor diferente al del objeto `user` persistido, el valor del JWT es el correcto por definición. El `SessionModule` corregirá automáticamente el objeto de usuario al detectar la discrepancia durante la rehidratación.

### 6.7. Motor de Reconciliación de Sesión (Session Reconciliation Engine)
> *On every session rehydration, the SessionModule MUST validate the JWT semantics and reconcile any divergence between JWT claims and the persisted user object before dispatching SessionRestored.*

El `SessionModule` implementa un motor de reconciliación declarativo que se ejecuta en cada arranque de la aplicación como parte del proceso de rehidratación. Su diseño sigue tres principios fundamentales:

#### 6.7.1. Pipeline de Reconciliación
La rehidratación ejecuta las siguientes fases secuenciales. Si cualquier fase falla, la sesión se destruye y el flujo se aborta:

```
Schema Version Check → JWT Decode → Semantic Validation → Declarative Reconciliation → Persist → Emit Events
```

1.  **Schema Version Check:** Verifica que la versión del esquema de almacenamiento (`schema_version`) coincida con la versión esperada por el código activo. Si hay discrepancia, se invalida toda la sesión.
2.  **JWT Decode:** Extrae el payload del JWT de forma segura.
3.  **Semantic Validation:** Verifica `exp` (expiración), `iss` (emisor), `aud` (audiencia) y `typ` (tipo de token). Si falla alguna, la sesión se destruye inmediatamente.
    > [!WARNING]
    > **Verificación Semántica vs. Validación Criptográfica:** El cliente realiza estas validaciones semánticas de forma offline. El cliente **no** valida la firma criptográfica (ya que no posee el secreto simétrico `JWT_SECRET`). La validación criptográfica de firmas ocurre estrictamente online en la API del Edge Worker. Modificar el payload del token localmente (por ejemplo, en tests o mediante la consola de desarrollo) servirá para evaluar la lógica de reconciliación y limpieza semántica local, pero dicho token será rechazado criptográficamente por la API ante cualquier petición de red posterior.
4.  **Declarative Reconciliation:** Recorre un mapa declarativo (`SESSION_MAP`) que define las correspondencias entre claims del JWT y propiedades del objeto de usuario. Las discrepancias detectadas se recolectan, se aplican al objeto de usuario y se persisten en disco.
5.  **Event Emission:** Si hubo reconciliación, se emite `SessionReconciled` con el detalle de las diferencias. Siempre se emite `SessionRestored` al final con el usuario (posiblemente corregido).

#### 6.7.2. Mapa Declarativo de Correspondencias (Open/Closed Principle)
El motor no conoce el dominio. Opera exclusivamente sobre un mapa estático de correspondencias:

```javascript
const SESSION_MAP = {
  "userId":  "id",        // JWT claim → User property
  "email":   "emailHash",
  "hogarId": "hogarId"
};
```

Para incorporar nuevos campos en el futuro (roles, permisos, tenantId, locale, featureFlags), basta con extender este mapa. El algoritmo de reconciliación no requiere modificaciones.

#### 6.7.3. Evolución: Motor de Reconciliación Multi-Origen (V1+)
El diseño actual reconcilia una única fuente criptográfica (JWT) contra una caché local (user). En versiones futuras del producto, cuando existan múltiples orígenes de verdad (endpoint de sesión `GET /api/v1/me`, servicio de feature flags, perfil de usuario, configuración de tenant), el motor podrá evolucionar hacia un pipeline genérico de reconciliación multi-origen:

```
Source A (JWT)         ─┐
Source B (API /me)      ├─► Normalizer ─► Conflict Detector ─► Conflict Resolver ─► Persist ─► Emit
Source C (Feature Flags)─┘
```

Esta evolución no requerirá reescribir el motor actual, sino extender las entradas del pipeline manteniendo la misma interfaz declarativa.

#### 6.7.4. Evolución: Session Health (V1+)
Para mejorar la observabilidad, se evaluará en sprints posteriores la incorporación de un modelo explícito de salud de la sesión con los siguientes estados internos:

| Estado | Significado |
| :--- | :--- |
| `Healthy` | JWT válido, usuario consistente, esquema actual. |
| `Reconciling` | Discrepancias detectadas, corrección en curso. |
| `Invalid` | JWT semánticamente inválido (issuer, audience o tipo incorrectos). |
| `Expired` | JWT expirado. |
| `Corrupted` | Datos de almacenamiento irrecuperables (JSON malformado). |

La infraestructura de eventos actual (`SessionRestored`, `SessionReconciled`, `SessionCleared`, `SessionExpired`) ya captura implícitamente estas transiciones de estado. La formalización en un modelo explícito de `SessionHealth` se realizará cuando existan requerimientos concretos de telemetría o monitoreo que lo justifiquen.


