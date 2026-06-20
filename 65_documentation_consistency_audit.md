# 65_documentation_consistency_audit.md — Auditoría de Consistencia Documental

Matriz completa de inconsistencias, conflictos, duplicaciones, riesgos y drift arquitectónico identificados en los 62 documentos existentes del proyecto **Mi Despensa**.

---

## 1. Inconsistencias Críticas (Gravedad: ALTA)

### INC-01: Contradicción en uso de Durable Objects en MVP

| Atributo | Detalle |
| :--- | :--- |
| **Documentos en conflicto** | Doc 01, 04, 05, 10, 16 vs. Doc 21, 22, 25, 52, 55 |
| **Naturaleza** | Los documentos tempranos (01-10) describen Durable Objects y WebSockets como componentes del MVP en tiempo real. Los documentos posteriores (21, 22, 25, 52, 55) los excluyen explícitamente del MVP y los difieren a V1 tras validación experimental (DG-02). |
| **Detalle** | Doc 01 (L20): `DO[Durable Objects: Sincronización Familiar]`. Doc 05 (L11): `CF_DO[Durable Objects: Coordina Hogar]`. Pero Doc 21 (L36): "El MVP se construirá inicialmente **sin Durable Objects ni WebSockets permanentes**". Doc 52 confirma que el MVP usa HTTP simple. |
| **Impacto** | Confusión sobre el stack real del MVP. Un desarrollador podría implementar DO innecesariamente. |
| **Resolución** | Los documentos 21, 25 y 52 representan la decisión más reciente y validada. **El MVP NO usa Durable Objects.** Los docs 01, 04, 05, 10 deben actualizarse para reflejar que DO es condicional a DG-02. |
| **Gravedad** | 🔴 ALTA |

### INC-02: Esquema D1 divergente entre documentos y código real

| Atributo | Detalle |
| :--- | :--- |
| **Documentos en conflicto** | Doc 05 (esquema SQL) vs. `schema/d1-schema.sql` vs. `docs/sprint_0_patch_document.md` |
| **Naturaleza** | Doc 05 define tablas `usuarios`, `productos`, `vencimientos`, `compras_historial` con columnas en español. El esquema real en `schema/d1-schema.sql` define tablas `users`, `inventario`, `events_stock` con columnas en inglés y estructura completamente diferente. El patch document formaliza la tabla `events_stock` como Source of Truth, que no existía en Doc 05. |
| **Detalle** | Doc 05 tiene `stock_actual`, `stock_minimo`, `stock_deseado` como columnas de `productos`. El schema real tiene `quantity` en `inventario`. Doc 05 no tiene `events_stock`. Doc 05 tiene `vencimientos` y `compras_historial` que no existen en el schema real. |
| **Impacto** | El esquema de Doc 05 es completamente obsoleto. Genera confusión total si alguien lo usa como referencia de implementación. |
| **Resolución** | `schema/d1-schema.sql` + `docs/sprint_0_patch_document.md` representan la fuente de verdad. Doc 05 debe marcarse como parcialmente obsoleto en su sección de esquema SQL. |
| **Gravedad** | 🔴 ALTA |

### INC-03: Cloudflare KV referenciado pero no utilizado en schema ni implementación

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | Doc 05 (L10), Doc 33 (L38), Doc 34 (L36), Doc 54 (L52-L68), README (L3) |
| **Naturaleza** | Múltiples documentos referencian Cloudflare KV para sesiones, catálogos y feature flags. Sin embargo, no existe binding de KV en `wrangler.toml`, no hay código que use KV, y el sprint 0 patch document no menciona KV. |
| **Impacto** | KV podría requerir costos de lectura/escritura si se usa mal. Su inclusión sin formalización viola "Simplicity First". |
| **Resolución** | KV es un componente **planificado pero no implementado**. Requiere ADR formal antes de su introducción. Los docs deben clarificar que KV es condicional. |
| **Gravedad** | 🟡 MEDIA |

### INC-04: Algoritmo JWT — Asimétrico vs Simétrico

| Atributo | Detalle |
| :--- | :--- |
| **Documentos en conflicto** | Doc 06 (L21): "RS256/ES256" vs. `wrangler.toml` (L11): `JWT_SECRET` (clave simétrica HMAC) vs. Doc 52 (L93): menciona switch a HMAC-SHA256 como contingencia |
| **Naturaleza** | Doc 06 y Doc 52 especifican JWT firmado con RS256/ES256 (asimétrico). La implementación real usa una clave simétrica `JWT_SECRET` compatible con HS256. |
| **Detalle** | Las claves asimétricas RS256 requieren un par público/privado. La implementación actual usa un solo secreto compartido. Doc 52 ya preveía este escenario como Decision Gate. |
| **Impacto** | La documentación sugiere un nivel de seguridad (asimétrico) que no coincide con la implementación (simétrico). |
| **Resolución** | Se requiere una evaluación formal mediante `ADR-JWT-ALGORITHM-DECISION` para comparar HS256, ES256 y Ed25519 antes de confirmar la migración definitiva a una clave simétrica. |
| **Gravedad** | 🟡 MEDIA |

---

## 2. Inconsistencias de Dominio (Gravedad: MEDIA)

### INC-05: Modelo de datos del dominio no refleja events_stock

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | Doc 12 (Domain Model) |
| **Naturaleza** | Doc 12 define `HistorialAggregate` con `BitacoraHistorica` pero no menciona `events_stock` como tabla ni como concepto de Event Sourcing híbrido. Este concepto fue formalizado posteriormente en `docs/sprint_0_patch_document.md`. |
| **Impacto** | El modelo de dominio de Doc 12 está desactualizado respecto de la arquitectura canónica. |
| **Resolución** | Doc 12 debe actualizarse para reflejar el modelo de Event Sourcing híbrido con `events_stock` como Source of Truth y `inventario` como Materialized View. |

### INC-06: Tabla `hogares` sin columna hogar_id-usuario link

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | `schema/d1-schema.sql` vs. Doc 05, Doc 03 (multi-user) |
| **Naturaleza** | El schema real no tiene relación FK entre `users` y `hogares`. `hogares` tiene `owner_id` pero no hay tabla de membresías. Doc 05 tenía `hogar_id` como FK en `usuarios`. La implementación actual parece depender del JWT claim `hogarId` sin tabla de membresía. |
| **Impacto** | Un usuario solo puede pertenecer a un hogar si el JWT lo codifica. No hay soporte multi-hogar ni validación de membresía en DB. |
| **Resolución** | Para el MVP es aceptable. A futuro se necesitará tabla `hogar_miembros` (user_id, hogar_id, rol). Documentar como decisión técnica diferida. |

### INC-07: Roles RBAC parcialmente definidos

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | Doc 05 (L65), Doc 32 (L18-21), Doc 03 (L6) vs. `schema/d1-schema.sql` |
| **Naturaleza** | Los docs definen roles ADMIN, MIEMBRO, INVITADO con permisos diferenciados. El schema real no tiene columna `rol` en la tabla `users`. No hay tabla de membresía con roles. |
| **Impacto** | El RBAC está documentado pero no implementado en el esquema. |
| **Resolución** | Para MVP, el `owner_id` en `hogares` implica ADMIN. El RBAC granular se difiere a V1. Documentar explícitamente. |

---

## 3. Inconsistencias de Nomenclatura (Gravedad: BAJA)

### INC-08: Idioma mixto en nombres de tablas y columnas

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | Doc 05 vs. `schema/d1-schema.sql` |
| **Naturaleza** | Doc 05 usa nombres en español (`hogares`, `usuarios`, `productos`, `vencimientos`). El schema real mezcla español (`hogares`, `inventario`, `events_stock`) con inglés (`users`, `product_name`, `quantity`, `event_type`). |
| **Impacto** | Baja. Es una convención de código, no un problema funcional. |
| **Resolución** | Establecer convención: **tablas en español** (`hogares`, `inventario`, `events_stock`, `users` como excepción). **Columnas en inglés** para compatibilidad con el código TypeScript. Documentar en el canonical model. |

### INC-09: "Bitera Digital" vs "Bitera Digital SAS"

| Atributo | Detalle |
| :--- | :--- |
| **Documentos afectados** | Doc 62 (L9): "Bitera Digital" sin "SAS" |
| **Naturaleza** | Doc 62 refiere a la organización como "Bitera Digital" sin la razón social completa. |
| **Impacto** | Baja. Falta de formalidad legal. |
| **Resolución** | El nombre oficial es **Bitera Digital SAS**. Actualizar Doc 62. |

---

## 4. Duplicaciones Documentales

### DUP-01: Capacidades de Negocio duplicadas

| Documentos | Contenido duplicado |
| :--- | :--- |
| Doc 09 (Sec 3) y Doc 13 | Ambos definen el mapa de Business Capabilities con contenido superpuesto |
| **Resolución** | Doc 09 es el contexto DDD estratégico; Doc 13 es el mapa operativo. Mantener ambos con referencia cruzada. |

### DUP-02: Validación de seguridad duplicada

| Documentos | Contenido duplicado |
| :--- | :--- |
| Doc 08 (Sec 2), Doc 42, Doc 47, Doc 50 | Cuatro documentos cubren validación de SSL Labs y Security Headers |
| **Resolución** | Doc 42 y Doc 50 son los canónicos para targets externos. Doc 08 y Doc 47 deben referenciarlos. |

### DUP-03: NFR de rendimiento duplicados

| Documentos | Contenido duplicado |
| :--- | :--- |
| Doc 04 y Doc 28 y Doc 46 | Los tres definen límites de latencia con valores ligeramente diferentes |
| **Detalle** | Doc 04: p95 API < 50ms. Doc 28: p95 API < 100ms. Doc 46: TTFB < 50ms (excelente), 100ms (máx). |
| **Resolución** | Doc 46 es el más maduro con targets graduados. Adoptar su modelo. Doc 04 y 28 deben referenciar Doc 46. |

---

## 5. Drift Arquitectónico

### DRIFT-01: R2 Storage excluido del MVP pero referenciado como activo

| Documentos | Doc 01, 05, 10 mencionan R2 activamente. Doc 16 lo excluye del MVP. |
| :--- | :--- |
| **Resolución** | R2 no se usa en el MVP. No hay binding en `wrangler.toml`. Los docs deben clarificar que R2 es para V1+. |

### DRIFT-02: Cloudflare Queues mencionadas pero no confirmadas

| Documentos | Doc 09 (L118) menciona Cloudflare Queues para Event-Driven Architecture. |
| :--- | :--- |
| **Impacto** | Queues puede tener costos fuera del Free Tier. |
| **Resolución** | Queues es un componente planificado para Fase 3. No se introduce sin ADR formal ni validación de costo. |

### DRIFT-03: Workers AI mencionado sin evaluación de costo

| Documentos | Doc 09 (L103), Doc 14 (L14) mencionan Workers AI para predicciones. |
| :--- | :--- |
| **Impacto** | Workers AI tiene Free Tier limitado pero podría exceder los límites. |
| **Resolución** | Workers AI es Fase 3. Requiere evaluación de costo y ADR formal antes de adopción. |

---

## 6. Riesgos de Compliance Identificados

### COMP-01: Cloudflare Logpush requiere Workers Paid Plan

| Gravedad | 🔴 ALTA |
| :--- | :--- |
| **Documentos afectados** | Doc 41 (L21), Doc 48 |
| **Naturaleza** | Logpush está disponible solo en planes de pago de Cloudflare. La documentación asume su disponibilidad en Free Tier. |
| **Impacto** | Sin Logpush, la inmutabilidad de logs de auditoría (ISO 27001) debe implementarse de otra manera (ej. logging en D1 o R2 manual). |
| **Resolución** | Definir la abstracción `Audit Evidence Provider`. Implementar D1 Audit Trail para el MVP (Free Tier compatible) y mantener Logpush como alternativa evolutiva futura. |

### COMP-02: Cloudflare Rate Limiting tiene Free Tier limitado

| Gravedad | 🟡 MEDIA |
| :--- | :--- |
| **Documentos afectados** | Doc 06 (L22), Doc 36 |
| **Naturaleza** | Cloudflare Rate Limiting avanzado (reglas configurables) requiere plan de pago. El Free Tier ofrece protección básica. |
| **Resolución** | Implementar rate limiting a nivel de Worker code (contador por IP con KV o en memoria). |

---

## 7. Documentos que Requieren Corrección

| Documento | Corrección Requerida | Prioridad |
| :--- | :--- | :--- |
| **01_executive_summary** | Aclarar que DO es condicional, no parte del MVP. Añadir "Bitera Digital SAS". | Alta |
| **05_system_architecture** | Marcar esquema SQL como obsoleto. Referenciar `schema/d1-schema.sql`. Aclarar que KV y DO no están en MVP. | Alta |
| **06_security_privacy_compliance** | Actualizar RS256 a HS256 para reflejar implementación real. | Media |
| **09_domain_driven_product_vision** | Marcar Cloudflare Queues y Workers AI como condicional Fase 3. | Media |
| **12_domain_model** | Actualizar para incluir `events_stock` como Source of Truth. | Alta |
| **62_organizational_context_deployment** | Actualizar "Bitera Digital" a "Bitera Digital SAS". Añadir clasificación Control Plane. | Media |

## 8. Documentos que Requieren Actualización

| Documento | Actualización Requerida |
| :--- | :--- |
| **04_non_functional_requirements** | Alinear targets de latencia con Doc 46. |
| **28_non_functional_governance** | Alinear targets de latencia con Doc 46. |
| **41_audit_evidence_framework** | Reemplazar Logpush por alternativa Free Tier. |
| **48_observability_framework** | Reemplazar Logpush por alternativa Free Tier. |

## 9. Documentos Obsoletos (Parcialmente)

| Documento | Sección Obsoleta |
| :--- | :--- |
| **05_system_architecture** | Sección 3 completa (esquema SQL) |
| **10_technical_decisions_validation** | Sección 1 (Durable Objects como decisión actual; es condicional) |
