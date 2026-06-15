# Architecture Decision Framework - Mi Despensa

Protocolo sistemático para evaluar, documentar e introducir cambios de arquitectura y tecnologías en el sistema.

---

## 1. Criterios de Evaluación Obligatorios

Toda propuesta de cambio tecnológico o adición al stack de la plataforma debe ser evaluada ponderando los siguientes cinco pilares:

```mermaid
radar
    title Ponderación de Cambios Técnicos
    "Valor de Negocio" : 5
    "Simplicidad/Mantenibilidad" : 5
    "Costo Operativo (Presupuesto Cero)" : 4
    "Mitigación de Riesgos" : 4
    "Experiencia del Usuario (Latencia)" : 5
```

1.  **Valor de Negocio (Weight: 25%):** ¿Cómo impacta la solución en la retención del hogar o en el flujo de reabastecimiento doméstico?
2.  **Complejidad y Mantenibilidad (Weight: 25%):** ¿Incrementa la cantidad de servicios? ¿Introduce dependencias complejas?
3.  **Costo Operativo (Weight: 20%):** ¿Se sale de la cuota del plan gratuito de Cloudflare? ¿Requiere suscripciones mensuales fijas de terceros?
4.  **Riesgos y Seguridad (Weight: 15%):** ¿Abre vulnerabilidades? ¿Comprobará adecuadamente los límites de privacidad (GDPR/Ley 18.331)?
5.  **Experiencia de Usuario (Weight: 15%):** ¿Afecta negativamente el tiempo de interacción inicial de la app en pantallas móviles?

---

## 2. Proceso de Registro (ADR workflow)

1.  **Propuesta:** El proponente crea un archivo `.md` bajo la plantilla estándar de ADR en la carpeta del repositorio (`ADR-XXX`).
2.  **Evaluación por Matriz:** Se asienta una puntuación ponderada del 1 al 5 por cada pilar de evaluación.
3.  **Aprobación del Governance Lead:** Revisión de la compatibilidad del cambio con los principios rectores de `Simplicity First` y `Cost-Efficiency First`.
