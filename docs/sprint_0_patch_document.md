# Sprint 0 Patch Document: Enmiendas Arquitectónicas Obligatorias

Este documento formaliza las tres enmiendas obligatorias requeridas para el inicio del **Sprint 0** de la plataforma **Mi Despensa**. Estas especificaciones superan cualquier definición previa y actúan como reglas inquebrantables de desarrollo.

---

## 🔐 1. Identity Model Formalization

Para garantizar la privacidad por diseño, el cumplimiento de GDPR/Ley 18.331 y evitar la inconsistencia en auditorías de identidad, se establecen tres capas de representación de identidad en el sistema:

1. **user_id (Primary System Identity):** 
   * *Naturaleza:* Identificador operacional interno del sistema.
   * *Tipo:* UUID v4 generado de forma aleatoria e inmutable.
   * *Rol:* Llave primaria (`PRIMARY KEY`) en la tabla de base de datos y llave foránea (`FOREIGN KEY`) utilizada en todas las tablas transaccionales del dominio (v.g. `actor_user_id` en `events_stock`). Nunca expone datos de identificación directa del titular.

2. **email_hash (Lookup and Uniqueness Index):**
   * *Naturaleza:* Hash criptográfico SHA-256 no reversible del correo electrónico en minúsculas y sin espacios adicionales.
   * *Fórmula:* `SHA-256(normalize(email))`
   * *Rol:* Almacenado en la columna `email` de la tabla `users` con restricción de unicidad (`UNIQUE NOT NULL`). Utilizado exclusivamente para búsquedas de login y verificación de Magic Link sin revelar el dato original.

3. **email_encrypted (Reversible PII Storage):**
   * *Naturaleza:* Texto cifrado de forma simétrica reversible.
   * *Algoritmo:* AES-GCM (256-bit) utilizando una clave secreta configurada como variable de entorno secreta en Cloudflare.
   * *Rol:* Almacenado en la columna `email_encrypted` de la tabla `users`. Utilizado únicamente en flujos de envío de notificaciones por correo electrónico y flujos de recuperación o exportación por cumplimiento de portabilidad.

---

## 🧱 2. Tenant Enforcement Layer (TEL) as Query Gate

El aislamiento multi-tenant a nivel de Hogar deja de ser considerado una simple capa de enrutamiento/middleware y se formaliza como un **Query Gate Pattern** con política **fail-closed**:

* **Principio de Aislamiento:** Toda consulta SQL de lectura, inserción, actualización o borrado debe incluir de manera forzada la validación del `hogar_id` asociado.
* **Fail-Closed Enforcement:** El cliente de acceso a la base de datos de la aplicación no expondrá métodos de consulta genéricos desprotegidos. Toda llamada de persistencia o lectura a D1 se encapsulará en repositorios tipados que exijan recibir explícitamente el `context.hogar_id`. Si se detecta un valor nulo, indefinido o no verificado en `context.hogar_id`, la capa de datos lanzará inmediatamente una excepción de seguridad e interrumpirá la ejecución.

---

## 📦 3. Event Model & Projection Clarification

Se aclara el rol y la sincronización de las dos tablas que registran el stock en la base de datos D1 del Edge Worker:

1. **events_stock (Source of Truth Log):**
   * *Rol:* Sistema de registro principal append-only e inmutable.
   * *Operaciones:* Únicamente sentencias `INSERT`. Queda prohibido cualquier comando `UPDATE` o `DELETE`.
   * *Contenido:* Almacena el delta exacto del stock (+X o -X) y la procedencia de cada cambio (actor, marca de tiempo y hogar).

2. **inventario (Materialized View):**
   * *Rol:* Vista materializada optimizada exclusivamente para consultas rápidas de lectura (Dashboard de la UI).
   * *Operaciones:* Sentencias `INSERT`, `UPDATE` y `DELETE`.
   * *Consistencia:* Es una proyección derivada del log histórico de eventos. En el MVP, la mutación del inventario y el registro del evento en `events_stock` deben ocurrir dentro de la misma transacción SQL atómica en D1 para asegurar consistencia dura en base de datos.
