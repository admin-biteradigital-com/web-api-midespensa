# Observability Framework - Mi Despensa

Especificación del diseño de telemetría, trazas distribuidas y alarmas para monitorear la salud técnica y operativa del Edge.

---

## 1. Mapeo de Telemetría (Logs, Métricas y Alertas)

Para conservar los objetivos de rendimiento y costos, el diseño de observabilidad se divide en:

### 1.1. Métricas Técnicas (Edge Metrics)
*   **Worker Error Rate:** Porcentaje de llamadas que retornan HTTP 5xx respecto del total de requests (Alerta si $>0.5\%$ en un intervalo de 5 minutos).
*   **D1 Query Exec Time:** Tiempo consumido por las transacciones SQLite (Alerta si $p95 > 100\text{ms}$).
*   **Subida a R2 Fail Rate:** Tasa de fallos en la carga de assets.

### 1.2. Trazabilidad de Eventos (Traces)
*   Se inyecta un identificador de request único (`cf-ray-id`) en los encabezados HTTP para correlacionar los logs del cliente PWA con la ejecución asíncrona en los Workers de Cloudflare.

### 1.3. Alerta de Anomalías Operativas
*   **Detección de Caída de Tráfico Familiar:** Alerta si el volumen total de peticiones de consumo (`stock_decrementado`) a nivel global cae a cero durante un periodo de 4 horas hábiles diurnas, lo que podría indicar un fallo silencioso de la API o del Service Worker.
