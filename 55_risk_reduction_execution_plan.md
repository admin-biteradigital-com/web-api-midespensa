# 55_risk_reduction_execution_plan.md — Plan de Mitigación de Riesgos de Ejecución

Este documento establece el plan operativo y experimental para gestionar y mitigar los riesgos técnicos de mayor severidad identificados para la plataforma **Mi Despensa**. Define experimentos concretos de validación con criterios explícitos de éxito y fracaso.

---

## 1. Plan de Experimentos Críticos y Mitigación de Riesgos

### Experimento 1: Aislamiento Lógico Multi-Tenant (Severidad: Crítica)
*   **Contexto de Riesgo:** Fallos de software o inyecciones que permitan a un usuario de un hogar consultar o modificar el inventario de otro hogar diferente.
*   **Metodología del Experimento:**
    1.  Crear una base de datos local SQLite simulando D1 con datos de prueba pertenecientes a dos hogares distintos: Hogar A (`hogar_id = "A"`) y Hogar B (`hogar_id = "B"`).
    2.  Escribir una batería de 50 consultas automáticas en Vitest que representen todas las llamadas posibles de la API.
    3.  Modificar la consulta programáticamente para omitir el parámetro `hogar_id` o inyectar un ID cruzado.
*   **Criterio de Éxito:** El 100% de las consultas alteradas deben fallar arrojando error de violación de restricción SQL o interceptores de seguridad de datos.
*   **Criterio de Fracaso:** Si una sola consulta retorna datos del Hogar B cuando el contexto del hilo de ejecución del test está asignado al Hogar A.

### Experimento 2: Reconciliación de Datos Offline en Redes Inestables (Severidad: Alta)
*   **Contexto de Riesgo:** Pérdida o corrupción de datos lógicos al enviar actualizaciones simultáneas desde múltiples dispositivos desconectados de un mismo hogar una vez recuperada la conexión a internet.
*   **Metodología del Experimento:**
    1.  Desconectar virtualmente la red de dos navegadores que simulan clientes activos del mismo hogar.
    2.  Modificar simultáneamente el stock de un producto específico (ej. "Leche") en ambos navegadores.
    3.  Establecer marcas de tiempo diferentes para cada acción física (Simulación de concurrencia real).
    4.  Activar nuevamente el adaptador de red inalámbrica y forzar la sincronización local-nube.
*   **Criterio de Éxito:** La base de datos D1 del Edge debe adoptar el estado del cambio con la marca de tiempo más reciente (Last Write Wins) de forma transparente y sin error de persistencia.
*   **Criterio de Fracaso:** Si el inventario entra en un estado inconsistente (ej. stock negativo) o la cola de peticiones HTTP en D1 se bloquea arrojando códigos de error 500.

### Experimento 3: Desbordamiento de los Recursos del Plan Gratuito (Severidad: Media)
*   **Contexto de Riesgo:** Exceder los límites de uso diario de la API gratuita de Cloudflare (100,000 requests por día en Workers y 5 millones de filas leídas en D1 diarios) debido a llamadas cíclicas en bucles del cliente.
*   **Metodología del Experimento:**
    1.  Instrumentar la consola de comandos de local y dev con un contador de peticiones por segundo por cliente.
    2.  Dejar la interfaz de la PWA abierta en primer plano durante 2 horas continuas con comportamiento pasivo del usuario.
    3.  Medir el volumen total de bytes y requests HTTP salientes enviados al Edge.
*   **Criterio de Éxito:** El cliente pasivo debe consumir un total neto de 0 peticiones HTTP tras su carga inicial (gracias al modelo de desconexión por inactividad y anulación de polling repetitivo).
*   **Criterio de Fracaso:** Si se identifican ráfagas de llamadas automáticas en segundo plano del navegador que incrementan el volumen acumulado sin acción explícita del usuario.

---

## 2. Decisiones Pospuestas Intencionalmente (Deferral Registry)

Con el fin de evitar la sobreingeniería en fases tempranas y mantener el foco en la validación rápida de la propuesta de valor del producto, se posponen formalmente las siguientes decisiones arquitectónicas hasta las fechas o hitos indicados:

| Decisión Pospuesta | Justificación del Aplazamiento | Hito / Puerta de Decisión de Activación |
| :--- | :--- | :--- |
| **Sincronización WebSockets (Durable Objects)** | Introduce costos fijos mínimos y complejidad de retención de conexiones que pueden evitarse inicialmente mediante HTTP corto con reintentos controlados. | Se evaluará en el Hito **`DG-02`** si los datos cualitativos demuestran que más del 15% de los hogares reportan colisiones lógicas por modificación concurrente. |
| **Integraciones con APIs de Supermercados** | Las APIs de los proveedores locales cambian constantemente y no disponen de entornos abiertos estables para desarrollo sin acuerdos comerciales previos. | Pospuesto para la fase **`V3`** del plan maestro de producto, cuando la base de usuarios esté validada. |
| **Pasarelas de Pago Complejas (B2B)** | El MVP es 100% gratuito (B2C). Añadir integraciones de pago incrementa innecesariamente el alcance y la complejidad del compliance financiero. | Hito de transición de MVP a **`V2`** tras alcanzar el objetivo de retención inicial. |
