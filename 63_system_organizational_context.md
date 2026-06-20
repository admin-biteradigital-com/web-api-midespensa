# 63_system_organizational_context.md — Contexto Organizacional del Sistema

Este documento establece la fuente de verdad organizacional para la plataforma **Mi Despensa** y formaliza la identidad corporativa, las responsabilidades operativas y las reglas de gobierno que rigen la relación entre la organización propietaria y el producto.

---

## 1. Identidad Organizacional

| Atributo | Valor |
| :--- | :--- |
| **Organización Responsable** | Bitera Digital SAS |
| **Sitio Web Corporativo** | [https://biteradigital.com](https://biteradigital.com) |
| **Producto** | Mi Despensa |
| **URL Productiva Canónica** | [https://midespensa.biteradigital.com](https://midespensa.biteradigital.com) |
| **Contacto Operativo Institucional** | admin@biteradigital.com |
| **Clasificación del Contacto** | `SYSTEM_OWNER_CONTACT` — Identidad del Control Plane |

---

## 2. Clasificación de admin@biteradigital.com

### 2.1. Naturaleza

`admin@biteradigital.com` **NO es un usuario del producto Mi Despensa**. Es una identidad organizacional de nivel corporativo que opera exclusivamente dentro del **Control Plane** del sistema.

### 2.2. Usos Permitidos (Control Plane)

| Función | Ejemplo |
| :--- | :--- |
| Administración de Infraestructura | Gestión de cuenta Cloudflare, DNS, Workers |
| Gestión Google Workspace | Administración de dominio biteradigital.com |
| Alertas de Monitoreo | Destino de alertas de Worker Error Rate, anomalías |
| Seguridad y Auditoría | Receptor de reportes de seguridad, logs de SGSI |
| CI/CD | Notificaciones de pipelines de despliegue |
| Rollbacks y Disaster Recovery | Ejecutor de `wrangler rollback`, restauraciones D1 |
| Compliance | Receptor de solicitudes ARCO/GDPR, auditorías ISO |

### 2.3. Usos Prohibidos (Data Plane)

`admin@biteradigital.com` **jamás** debe aparecer como:

- Usuario final registrado en la tabla `users` de D1.
- Miembro de un Hogar (`hogares`).
- Actor en eventos de inventario (`events_stock.actor_user_id`).
- Propietario de datos de producto en la tabla `inventario`.
- Sujeto de analytics de producto.
- Titular de un Tenant Membership o rol RBAC del dominio.

### 2.4. Razón Arquitectónica

La contaminación entre identidades del Control Plane y del Data Plane representa un riesgo de seguridad de nivel **CRÍTICO**:

1. **Escalada de privilegios:** Un compromiso de la cuenta organizacional podría otorgar acceso directo a datos de hogares si existiese asociación en la base de datos.
2. **Violación de compliance:** GDPR Art 25 (Privacy by Design) exige separación de datos operativos y administrativos.
3. **Ruptura de aislamiento multi-tenant:** La cuenta organizacional no tiene `hogar_id`, lo que violaría el Query Gate (TEL) si intentase ejecutar consultas de dominio.

---

## 3. Mapa de Clasificación Arquitectónica

| Elemento | Clasificación | Plano |
| :--- | :--- | :--- |
| admin@biteradigital.com | Control Plane Identity | Control |
| Usuarios Mi Despensa (tabla `users`) | Data Plane Identity | Data |
| Hogares (tabla `hogares`) | Tenant Boundary | Data |
| Inventario (tabla `inventario`) | Core Domain — Materialized View | Data |
| events_stock | Core Domain — Source of Truth | Data |
| JWT de Usuario | Data Plane Security Token | Data |
| Cuenta Cloudflare | Control Plane Infrastructure | Control |
| Google Workspace | Control Plane Collaboration | Control |
| Wrangler CLI / Dashboard | Control Plane Operations | Control |
| Resend / Email API | Control Plane — Transactional Delivery | Control |

---

## 4. Ownership del Producto

### 4.1. Product Ownership

**Bitera Digital SAS** es la propietaria legal, técnica y operativa del producto Mi Despensa.

### 4.2. Infraestructura Ownership

Toda la infraestructura productiva opera bajo la cuenta de Cloudflare de Bitera Digital, administrada exclusivamente a través de `admin@biteradigital.com`.

### 4.3. Propiedad Intelectual

El código fuente, la documentación arquitectónica, los esquemas de base de datos y los diseños de API son propiedad intelectual de Bitera Digital SAS.

---

## 5. Restricción Financiera Inquebrantable

> **COSTO OPERATIVO = USD 0**

Esta restricción es de prioridad superior a cualquier decisión técnica del sistema:

- Solo Cloudflare Free Tier.
- No se introducen servicios con costos recurrentes.
- No se introducen dependencias que requieran upgrade obligatorio de plan.
- No se introducen componentes con costo de arranque fijo.
- Toda excepción requiere un ADR formal y una Decision Gate aprobada.

---

## 6. Trazabilidad Regulatoria

| Marco Regulatorio | Implicación Organizacional |
| :--- | :--- |
| **GDPR (EU)** | Bitera Digital SAS actúa como Data Controller. admin@biteradigital.com es el contacto DPO designado. |
| **Ley 18.331 (UY)** | Bitera Digital SAS es el Responsable del Tratamiento registrado ante la URCDP. |
| **ISO/IEC 27001** | El SGSI está bajo la gobernanza del Comité de Seguridad liderado por admin@biteradigital.com. |
| **ISO/IEC 27701** | El PIMS establece a admin@biteradigital.com como el Privacy Contact Point. |
| **ISO 22301** | El BCMS designa a admin@biteradigital.com como receptor de alertas de continuidad. |
