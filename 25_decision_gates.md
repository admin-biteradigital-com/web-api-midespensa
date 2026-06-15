# Decision Gates - Mi Despensa

Los *Decision Gates* definen los umbrales específicos de datos necesarios para autorizar la transición entre versiones del roadmap o activar planes de contingencia (pivotes).

---

## 1. Puerta de Decisión DG-01: Lanzamiento de MVP a V1 (Escáner y R2)

Para justificar la adición del escáner de códigos de barra e imágenes, debemos asegurar que el inventario cooperativo básico ya es utilizado activamente.

*   **Criterio para CONTINUAR (Hacia V1):**
    *   W4 Retention de los hogares registrados en el MVP es $\ge 30\%$.
    *   La North Star Metric (WAC) promedio por hogar activo es $\ge 8$ movimientos por semana.
*   **Criterio para PIVOTAR/REFACTORIZAR (Pausa en el roadmap):**
    *   W4 Retention $<20\%$.
    *   La tasa de finalización de carga de inventario manual es $<40\%$ (los usuarios no pasan del registro).
    *   *Acción de pivote:* Detener el desarrollo de R2 y de la V1. Rediseñar el flujo de entrada manual con un catálogo asistido por autocompletado inteligente predictivo antes de liberar la versión final.

---

## 2. Puerta de Decisión DG-02: Implementación de Durable Objects (Tiempo Real Completo)

Establece la regla formal para decidir si introducimos la complejidad del tiempo real persistente.

*   **Criterio para ACELERAR / INCORPORAR Durable Objects:**
    *   Los datos del experimento `MVP-EXP-02` indican que $>10\%$ de los hogares beta reportan inconsistencias de stock derivadas de compras simultáneas.
    *   El feedback cualitativo señala la sincronización instantánea como una característica crítica exigida por los usuarios para no abandonar la app.
*   **Criterio para ELIMINAR / MANTENER HTTP simple:**
    *   Los incidentes de desincronización concurrentes representan $<5\%$ del uso total.
    *   *Acción:* Mantener sincronización asíncrona optimizada mediante llamados HTTP en primer plano al abrir la aplicación. Esto ahorra cuota de conexión de Durable Objects y simplifica el backend, preservando el objetivo de presupuesto operativo de infraestructura cero.
