# SGSI Blueprint (ISO/IEC 27001) - Mi Despensa

Diseño conceptual y de gobierno del Sistema de Gestión de la Seguridad de la Información (SGSI) para **Mi Despensa**.

---

## 1. Alcance del SGSI (Scope)

El alcance del SGSI comprende la totalidad del ciclo de vida del desarrollo, despliegue, operación y mantenimiento del software serverless de **Mi Despensa** que corre sobre la infraestructura global de Cloudflare, incluyendo el almacenamiento relacional de datos en D1 y activos multimedia en R2.

---

## 2. Inventario Crítico de Activos de Información

| ID Activo | Nombre del Activo | Tipo | Clasificación de Confidencialidad |
| :--- | :--- | :--- | :--- |
| **ACT-01** | Base de Datos Transaccional D1 | Software / Datos | Confidencial (L3) |
| **ACT-02** | Historial de Consumo y Compras | Datos | Confidencial / Sensible (L3/L4) |
| **ACT-03** | Repositorio de Código Fuente | Propiedad Intelectual| Interno (L2) |
| **ACT-04** | Servidor DNS e Infraestructura Edge | Infraestructura Cloud | Interno (L2) |

---

## 3. Gobierno y Estructura del SGSI
*   **Comité de Seguridad:** Formado por el Enterprise Solution Architect (Lead) y el Technical Lead de Operaciones.
*   **Revisión del SGSI:** Se establece una auditoría interna automatizada mensual que valida que ningún commit rompa los límites definidos en la *Non-Functional Governance* y *Definition of Done*.
