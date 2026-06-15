# Experimentation Framework - Mi Despensa

Plan de experimentos estructurados para validar las hipótesis clave por fase de entrega.

---

## 1. Experimento MVP-EXP-01: Validación de Carga Inicial Manual vs. Retención

*   **Objetivo:** Determinar si la barrera de entrada de la carga manual del inventario impide la adopción.
*   **Métrica Clave:** Tasa de finalización de carga de despensa (Hogar con $\ge 10$ productos en las primeras 48 horas).
*   **Duración:** 14 días.
*   **Grupo de Prueba:** 50 hogares beta.
*   **Criterio de Éxito:** $>60\%$ de los hogares registrados cargan al menos 10 productos en menos de 48 horas.
*   **Criterio de Fracaso:** $<40\%$ de los hogares completan el setup de inventario, indicando que se debe priorizar el escáner (V1) de forma inmediata antes del lanzamiento general.

---

## 2. Experimento MVP-EXP-02: Validación de la Necesidad de Tiempo Real en el Supermercado

*   **Objetivo:** Validar si la falta de actualización instantánea (WebSockets) genera compras duplicadas reales en hogares.
*   **Métrica Clave:** Cantidad de incidentes de "Compras Duplicadas" reportados por los usuarios en encuestas semanales y registros históricos de stock.
*   **Duración:** 21 días.
*   **Flujo Técnico:** La app realiza sincronizaciones HTTP asíncronas sencillas en lugar de sockets abiertos.
*   **Criterio de Éxito (Mantiene HTTP simple):** $<5\%$ de los hogares reportan compras duplicadas causadas por desincronización de pantallas mientras compraban en simultáneo.
*   **Criterio de Fracaso (Fuerza adopción de Durable Objects):** $\ge 10\%$ de los hogares experimentan desajustes de stock en las compras concurrentes, lo que justifica la implementación de Durable Objects.

---

## 3. Experimento V1-EXP-01: Adopción del Historial de Precios

*   **Objetivo:** Validar si los usuarios están dispuestos a registrar el costo unitario de los productos de forma manual a cambio de ver las gráficas de fluctuación.
*   **Métrica Clave:** Porcentaje de compras cerradas con campos de precio/comercio rellenados en la app.
*   **Duración:** 30 días.
*   **Criterio de Éxito:** $>50\%$ de las compras registradas incluyen la captura del precio unitario de los productos.
*   **Criterio de Fracaso:** $<25\%$ de las compras registran precios, lo que indica que esta entrada de datos debe ser automatizada mediante OCR (V2) para ser viable.
