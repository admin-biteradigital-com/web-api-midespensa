# Non-Functional Governance - Mi Despensa

Límites técnicos y restricciones operativas obligatorias para la ejecución y despliegue del sistema.

---

## 1. Límites Operativos del Sistema

Cualquier cambio de código o refactorización que degrade los indicadores definidos en esta tabla será rechazado automáticamente en los pipelines de integración continua (CI/CD):

| Métrica | Límite Máximo Aceptado | Frecuencia de Control |
| :--- | :--- | :--- |
| **Latencia p95 (API Edge)** | $100\text{ms}$ | Monitoreo sintético semanal |
| **Tiempo de Carga de PWA (LCP)**| $1.8\text{s}$ | Pruebas de Lighthouse en CI |
| **Costo Operativo Fijo Inicial**| $0\text{ USD}$ / mes | Auditoría de facturación mensual |
| **Consumo de CPU por request** | $10\text{ms}$ (Límite Workers) | Métricas de Cloudflare Analytics |
| **Tamaño de Bundle JS (Cliente)** | $150\text{KB}$ (gzip/br) | Build check en pipeline CI |

---

## 2. Gobernanza de Base de Datos (Persistencia D1)

*   **Restricción de Lectura en Caliente:** Para conservar el rendimiento de SQLite (D1), el inventario transaccional activo debe leerse de la caché local de IndexedDB o de tablas cacheadas en primer nivel, reduciendo las consultas complejas y repetitivas a la base de datos distribuida en el Edge.
*   **Limpieza de Eventos Analíticos:** Los eventos de la bitácora inmutable histórica que superen los 18 meses de antigüedad deben ser comprimidos, agregados y respaldados de forma masiva en Cloudflare R2, depurando la base de datos de producción D1 para asegurar su escalabilidad y costo base cero.
