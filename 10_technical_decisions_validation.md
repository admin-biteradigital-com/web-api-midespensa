# Validación y Justificación Técnica de Decisiones Arquitectónicas

Para asegurar que las elecciones tecnológicas estén impulsadas estrictamente por el dominio de negocio, los casos de uso específicos y la restricción financiera del proyecto, se realiza el siguiente análisis técnico-comercial.

---

## 1. Cloudflare Durable Objects (DO)

### 1.1. Requerimiento de Negocio e Impacto
*   **Requerimiento:** Colaboración familiar en tiempo real. Todos los miembros del hogar deben ver reflejada de forma instantánea cualquier alteración de stock (altas, bajas, consumo) para evitar compras duplicadas en el supermercado mientras otro integrante está comprando.
*   **Caso de Uso:** Dos usuarios acceden simultáneamente al inventario del mismo Hogar desde dos teléfonos diferentes. El usuario A decrementa la leche en la alacena. El usuario B, que está en la caja del supermercado, ve cómo la lista de compras del hogar se actualiza dinámicamente en su pantalla sin recargar la app.

### 1.2. Justificación Técnica y Alternativas

| Atributo | Solución Propuesta (Durable Objects) | Alternativa A (Polling HTTP a D1) | Alternativa B (Redis Pub/Sub tradicional) |
| :--- | :--- | :--- | :--- |
| **Consistencia** | **Fuerte en el Edge.** Cada Hogar tiene un DO con estado en memoria único. | Inconsistencia temporal hasta el próximo intervalo de consulta (*pull*). | Eventualmente fuerte, requiere servidor centralizado. |
| **Latencia** | **Ultra-baja ($<50\text{ms}$).** Websocket directo al Edge. | Alta (peticiones periódicas HTTP). | Depende de la ubicación del clúster de servidores Redis. |
| **Costo Operativo** | **Cero (Free tier / Pago por uso serverless).** | Alto en lecturas y escrituras de base de datos debido a consultas repetitivas de pooling. | Alto costo de infraestructura mensual base ($>15\text{ USD}$/mes por base de datos activa). |

### 1.3. Riesgos Asociados y Mitigación
*   **Riesgo:** Limitación de concurrencia en escrituras a nivel de un único Durable Object.
*   **Mitigación:** El tamaño de un núcleo familiar promedio ($<6$ personas concurrentes) no ejerce presión de concurrencia sobre los límites de DO, haciéndolo ideal para este modelo multi-tenant.

---

## 2. Cloudflare D1 Database

### 2.1. Requerimiento de Negocio e Impacto
*   **Requerimiento:** Almacenamiento estructurado, consultas relacionales complejas para reportes de consumo, historial financiero de fluctuación de precios y resguardo del principal activo del negocio: el conocimiento histórico familiar.
*   **Caso de Uso:** Comparar precios pagados por el producto "Leche Entera 1L" en los últimos 6 meses en distintos supermercados locales para determinar cuál comercio ofrece el mejor precio promedio.

### 2.2. Justificación Técnica y Alternativas

| Atributo | Solución Propuesta (Cloudflare D1 SQLite) | Alternativa A (Cloudflare KV) | Alternativa B (PostgreSQL Cloud Managed - Supabase/AWS) |
| :--- | :--- | :--- | :--- |
| **Tipo de Datos** | **Relacional SQL.** | Clave-Valor (Sin soporte nativo para joins o agregaciones complejas). | Relacional SQL Completo. |
| **Costo Base** | **Cero (Free Tier).** | Cero (Free Tier). | Elevado en producción, o límites muy bajos en capas gratuitas con pausa de inactividad. |
| **Consultas Complejas** | Excelente (Soporta sintaxis SQL y agregados). | Deficiente (Obliga a procesar joins e índices manualmente en código JS). | Excelente. |

### 2.3. Riesgos Asociados y Mitigación
*   **Riesgo:** Tamaño máximo inicial limitado en D1 por base de datos y falta de herramientas de backup complejas integradas en planes gratuitos.
*   **Mitigación:** Se estructuran esquemas normalizados optimizados. Adicionalmente, se diseña un worker cron asíncrono diario que exporta los registros históricos agregados del hogar hacia almacenamiento R2 para mitigar pérdidas por fallos.

---

## 3. Cloudflare R2 Storage

### 3.1. Requerimiento de Negocio e Impacto
*   **Requerimiento:** Soporte de imágenes asociadas a productos y capturas visuales de empaques para reconocimiento inmediato por parte de los niños o cuidadores del hogar.
*   **Caso de Uso:** El usuario sube una foto del producto específico para diferenciar visualmente "Galletas sin gluten" de "Galletas tradicionales", facilitando la tarea a personas que no están familiarizadas con las marcas.

### 3.2. Justificación Técnica y Alternativas

| Atributo | Solución Propuesta (Cloudflare R2) | Alternativa A (Almacenamiento Base64 en D1/KV) | Alternativa B (Amazon S3) |
| :--- | :--- | :--- | :--- |
| **Costo de Egreso (Egress)**| **Cero.** Sin cobros por descargar imágenes. | Crítico (Eleva el tamaño de D1 y causa sobrecostos en base de datos). | Costoso en egreso de datos por descarga masiva. |
| **Free Tier** | **Hasta 10 GB gratis al mes.** | Limitado al espacio de D1. | 5 GB iniciales por 12 meses únicamente. |

### 3.3. Riesgos Asociados y Mitigación
*   **Riesgo:** Carga ilimitada de imágenes pesadas por parte de usuarios malintencionados que saturen el storage.
*   **Mitigación:** El cliente optimizará y comprimirá las imágenes localmente en la PWA (usando `Canvas` en Javascript) a un tamaño máximo de $300\text{KB}$ antes de realizar la subida de datos a R2.
