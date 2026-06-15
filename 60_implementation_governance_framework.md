# 60_implementation_governance_framework.md — Marco de Gobernanza de Implementación

Este documento define las directrices y controles para guiar el desarrollo incremental de **Mi Despensa**. Establece las reglas operativas para controlar la deuda técnica, medir la desviación arquitectónica (*Architecture Drift*) y validar de forma continua que el software construido coincida exactamente con las especificaciones.

---

## 1. Reglas para el Desarrollo Incremental y Control de Deuda Técnica

Para evitar que la prisa en la entrega degrade la calidad estructural del sistema, se definen los siguientes límites cuantitativos a la deuda técnica permitida en el repositorio:

1.  **Límite de Cobertura de Código Mínima:**
    *   Toda nueva funcionalidad o corrección de error debe ingresar al repositorio acompañada de sus respectivas pruebas automatizadas.
    *   *Umbral obligatorio:* Cobertura mínima del 85% en código de dominio e infraestructura de datos. El pipeline de CI bloqueará automáticamente los commits que reduzcan la cobertura global del proyecto.

2.  **Complejidad Ciclomática Máxima:**
    *   Para mantener la simplicidad y legibilidad del código (especialmente en funciones críticas ejecutadas en el Edge), ninguna función individual de Javascript o Typescript puede exceder una complejidad ciclomática de 10.
    *   *Control:* Ejecución de herramientas de análisis estático (ESLint + complementos de métricas) antes de cada commit.

3.  **Límites de Duplicación de Código:**
    *   No se permite más de un 5% de código duplicado en el repositorio (evaluado mediante herramientas SAST en CI). Toda lógica compartida entre el Service Worker del cliente y el Edge Worker debe extraerse a submódulos compartidos limpios de dependencias del runtime.

---

## 2. Monitoreo y Control del Drift Arquitectónico

El desvío de la arquitectura (*Architecture Drift*) ocurre cuando los desarrolladores implementan soluciones rápidas que violan las reglas del diseño base. Se mitigará mediante:

*   **Revisiones de Integridad en Pull Requests:** Las PRs no pueden ser aprobadas únicamente por su validez funcional. Es mandatorio que los revisores humanos o agentes de IA verifiquen el cumplimiento de los principios arquitectónicos (ej. Edge-First, mínimo acoplamiento y aislamiento multi-tenant).
*   **Gestión de Deuda Técnica Registrada:** Si por motivos de urgencia se permite de manera excepcional una desviación del diseño, esta debe ser documentada como un item con etiqueta `technical-debt` en el backlog de producto. Ningún release mayor (GA o actualizaciones de versión de API) puede ser liberado si existen más de 3 items de deuda técnica pendientes de resolución.
