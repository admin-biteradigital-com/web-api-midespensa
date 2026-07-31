# Protocolo de Depuración y Diagnóstico (Debugging Constitution)
## Mi Despensa PWA

Este documento establece las reglas de gobernanza técnica y metodológica para la investigación de fallos y depuración en todo el ciclo de vida del software de **Mi Despensa**. Su cumplimiento es obligatorio y tiene prioridad sobre cualquier intento de implementación o despliegue rápido.

---

## 1. Reglas Fundamentales

1.  **Cero Modificaciones Preventivas:** Queda estrictamente prohibido alterar líneas de código, agregar parches "por si acaso" o realizar despliegues de prueba antes de haber identificado y demostrado empíricamente la causa raíz del fallo.
2.  **Un Cambio = Una Hipótesis Validada:** Cada cambio en el código fuente debe corresponder a una única hipótesis previamente demostrada mediante evidencia física del entorno de ejecución.
3.  **Consistencia Total:** Toda hipótesis planteada debe ser capaz de explicar **la totalidad** de los síntomas observados y los datos recolectados. Si una hipótesis no puede explicar por qué ocurre o deja de ocurrir un síntoma específico, queda automáticamente descartada.
4.  **Minimización del Costo de Búsqueda:** Cada solicitud de evidencia en tiempo de ejecución debe poseer el máximo poder de descarte binario posible, permitiendo eliminar el mayor número de hipótesis viables con el mínimo de pasos u observaciones.
5.  **Prohibición de Logs Permanentes:** No se debe ensuciar el código base con logs temporales de depuración (`console.log`, etc.) de forma definitiva. Si se requiere instrumentación temporal para obtener evidencia, esta debe ser removida inmediatamente después de aislar el fallo.
6.  **Criterio de Cierre Empírico:** Una incidencia no se considera resuelta ni "certificada" por el paso de pruebas automáticas o análisis estáticos. Solo se da por cerrada cuando el usuario pueda reproducir con éxito el Happy Path de extremo a extremo sin asistencia.
7.  **Verificar siempre el estado persistido:** Antes de investigar EventBus, FSM, Router o UI, se debe inspeccionar el almacenamiento físico (`localStorage`), decodificar el JWT y contrastar la consistencia de datos entre ambos. Nunca se debe asumir que el estado persistido es consistente o que pertenece a la versión actual del código.

---

## 2. Proceso de Investigación en Cuatro Fases

Cualquier incidencia reportada se investigará siguiendo rigurosamente este orden secuencial:

### Fase 1: Reconstrucción Completa del Flujo
Trazar de inicio a fin la cadena de ejecución esperada para la funcionalidad afectada. Se debe detallar para cada paso:
*   Módulo o archivo de origen.
*   Función o bloque de código ejecutable.
*   Parámetros de entrada recibidos.
*   Parámetros de salida devueltos.
*   Estado mutado en el sistema (en memoria o persistencia).
*   Eventos despachados o notificados.
*   Siguiente paso en la secuencia temporal.

### Fase 2: Puntos de Ruptura
Identificar de forma abstracta todos los puntos a lo largo de la cadena reconstruida donde la ejecución podría desviarse, bloquearse, retornar datos incorrectos o crashear.

### Fase 3: Hipótesis Cruzadas
Definir las explicaciones causales para el fallo. Para cada hipótesis se listará explícitamente:
*   Evidencia teórica/empírica a favor.
*   Evidencia teórica/empírica en contra.
*   Hechos observados que explica.
*   Hechos observados que **no** explica (causa de descarte inmediato).

### Fase 4: Protocolo de Evidencia Iterativo
Formular solicitudes de observación física del runtime (DevTools, consola, tráfico HTTP, almacenamiento) solicitando **únicamente un dato o acción a la vez**, guiando la depuración hacia el descarte sistemático de hipótesis hasta aislar la causa raíz única.
