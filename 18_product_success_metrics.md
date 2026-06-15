# Product Success Metrics - Mi Despensa

Para medir la viabilidad y el éxito del producto a lo largo de sus iteraciones, se definen los siguientes indicadores estratégicos.

---

## 1. North Star Metric (Métrica Estrella)

> **Acciones de Consumo y Compra Confirmadas por Hogar a la Semana (WAC)**

*   *Por qué importa:* Refleja la adopción activa del sistema como fuente de verdad en el día a día. Si una familia no registra lo que consume o compra, la aplicación pierde su utilidad de inventario en tiempo real.

---

## 2. KPIs por Categoría

### 2.1. Adopción y Uso
*   **Hogares Creados Activos (HA):** Número de hogares con al menos 2 miembros que registran al menos 5 movimientos a la semana.
*   **Usuarios por Hogar:** Promedio de miembros activos vinculados a una cuenta familiar (Target: $\ge 2.2$).

### 2.2. Retención
*   **Retención a la Semana 4 (W4 Retention):** Porcentaje de hogares que continúan usando la app después de 28 días de su registro inicial (Target: $>35\%$).

### 2.3. Valor de Negocio / Calidad
*   **Ítems Comprados desde la Lista:** Cantidad de productos marcados como "comprados" en la lista de compras que actualizaron automáticamente el inventario (mide la efectividad del flujo cerrado de abastecimiento).
*   **Reducción Estimada de Desperdicio:** Cantidad de alertas de vencimiento atendidas por el usuario antes de la fecha límite.

### 2.4. Calidad y Rendimiento Técnico
*   **Tiempo de Sincronización Post-Offline:** Menos de $1.5\text{s}$ para procesar y consolidar la cola local de IndexedDB una vez recuperada la conexión.
*   **Crash-Free Sessions:** Porcentaje de sesiones libres de excepciones JavaScript (Target: $>99.8\%$).
