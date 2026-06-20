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


