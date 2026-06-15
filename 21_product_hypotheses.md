# Product Hypotheses - Mi Despensa

Estructura de las hipótesis fundamentales que sostienen la propuesta de valor y el modelo de negocio de **Mi Despensa**.

---

## 1. Matriz de Hipótesis Estratégicas

### 1.1. Hipótesis de Adopción (H-AD)
> **Hipótesis:** Las familias están dispuestas a ingresar manualmente sus productos la primera vez si se les provee un catálogo de autocompletado inteligente simplificado.
*   **Riesgo:** Alto (el usuario abandona la app antes de terminar la carga de la primera alacena por fatiga de teclado).
*   **Impacto:** Crítico.
*   **Método de Validación:** Medición del porcentaje de conversión desde "Hogar Creado" hasta "Hogar con $\ge 10$ productos cargados".

### 1.2. Hipótesis de Comportamiento (H-CO)
> **Hipótesis:** Los integrantes de la familia recordarán registrar el consumo del producto en el momento en que lo retiran de la despensa.
*   **Riesgo:** Alto (el inventario se desincroniza porque los usuarios consumen pero olvidan apretar el botón en la app).
*   **Impacto:** Crítico (si el inventario se desincroniza, la app deja de ser útil).
*   **Método de Validación:** Auditoría manual aleatoria en hogares beta a los 14 días de uso para comparar stock real vs. stock digital.

### 1.3. Hipótesis de Retención (H-RE)
> **Hipótesis:** La autogeneración automática de la lista de compras es una utilidad suficiente para que los hogares utilicen la app de forma recurrente semanalmente.
*   **Riesgo:** Medio.
*   **Impacto:** Alto.
*   **Método de Validación:** Tasa de retención de la semana 4 (W4 Retention).

---

## 2. Validación de la Necesidad de Tiempo Real (Durable Objects / WebSockets)

Planteamos como hipótesis crítica la necesidad de sincronicidad extrema en el MVP:

> **Hipótesis de Sincronicidad:** Para el 90% de los hogares, la consistencia eventual mediante peticiones HTTP estándar en la apertura de la aplicación es suficiente. La sincronización instantánea en milisegundos mediante Durable Objects y WebSockets no altera significativamente la adopción inicial del MVP.

*   **Riesgo de Complejidad Prematura:** El uso de Durable Objects introduce complejidad en el backend y puede consumir rápidamente la capa gratuita por mantener sockets abiertos de forma persistente.
*   **Decisión Metodológica de Validación:** El MVP se construirá inicialmente **sin Durable Objects ni WebSockets permanentes**. Utilizará llamadas HTTP estándar y almacenamiento en caché IndexedDB local con refresco automático en primer plano (Foreground App Visibility). Durable Objects se migrará a la versión `V1` únicamente si los datos demuestran que ocurren conflictos recurrentes de stock durante compras simultáneas.
