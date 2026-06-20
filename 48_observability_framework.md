# Observability Framework - Mi Despensa

> [!WARNING]
> **ESTADO DE REFERENCIA:** Este documento ha sido auditado y contiene especificaciones de infraestructura obsoletas (como el uso obligatorio de Cloudflare Logpush en el MVP). El sistema de logs y auditoría técnica se rige por la abstracción **Audit Evidence Provider** utilizando la base de datos D1 (`D1 Audit Trail` en tabla `auditoria_legal`) y se detalla en [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md).

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
