# Product Backlog - Mi Despensa

Clasificación y priorización de las historias de usuario y tareas de ingeniería para el desarrollo del producto.

---

## 1. Priorización del Backlog (Matriz de Priorización)

| ID | Funcionalidad | Prioridad MoSCoW | Valor de Negocio | Complejidad | Riesgo | Versión Objetivo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PB-01** | Autenticación Passwordless Magic Link | **Must Have** | Alto | Media | Bajo | MVP |
| **PB-02** | Panel de Inventario Colaborativo en Edge | **Must Have** | Crítico | Alta | Alto | MVP |
| **PB-03** | Motor de Sincronización Local Offline | **Must Have** | Alto | Alta | Alto | MVP |
| **PB-04** | Generación Automática de Lista de Compras | **Must Have** | Alto | Bajo | Bajo | MVP |
| **PB-05** | Integración de Escáner de Códigos de Barra | **Should Have**| Alto | Media | Medio | V1 |
| **PB-06** | Carga de Imágenes de Productos (R2) | **Should Have**| Medio | Bajo | Bajo | V1 |
| **PB-07** | Historial y Estadísticas de Precios | **Should Have**| Alto | Media | Bajo | V1 |
| **PB-08** | Motor Predictivo de Agotamiento de Stock | **Could Have** | Alto | Alta | Alto | V2 |
| **PB-09** | Integración Automática con Supermercados | **Won't Have** | Medio | Alta | Medio | V3 |

---

## 2. Descripción de Epics del MVP

### Epic 1: Sincronización Concurrente Familiar (PB-02)
*   *Descripción:* Implementación de Durable Objects para coordinar las conexiones abiertas vía WebSockets en el Edge. Cualquier decremento de stock se distribuye en broadcast instantáneo a los miembros del Hogar conectados.
*   *Definición de Terminado (DoD):* El stock se actualiza en menos de 250ms en dos pantallas simuladas simultáneamente en diferentes ubicaciones físicas.

### Epic 2: Operación Offline Resiliente (PB-03)
*   *Descripción:* Registro local de operaciones utilizando Service Workers y base de datos local IndexedDB en la PWA. Al recuperar la red, se gatilla la sincronización en bloque de transacciones pendientes.
*   *Definición de Terminado (DoD):* Bloquear la red del navegador, realizar 3 decrementos de stock, reconectar la red y verificar que D1 se ha actualizado sin duplicados ni pérdida de eventos.
