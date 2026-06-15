# Quality Assurance Blueprint - Mi Despensa

Estrategia general y gobierno de calidad de software para **Mi Despensa**.

---

## 1. Objetivos y Métricas de Calidad

La calidad se mide de manera cuantitativa para evitar valoraciones subjetivas en el ciclo de entrega:

| Dimensión | Métrica Clave | Target Objetivo |
| :--- | :--- | :--- |
| **Defectos** | Densidad de defectos por sprint | $<0.5$ errores por historia de usuario |
| **Estabilidad** | Tasa de fallos en producción (Crash-Free Sessions) | $>99.8\%$ |
| **Testing** | Cobertura de código en lógica de negocio (p95) | $\ge 85\%$ |
| **Velocidad** | Tiempo de ejecución de test suite en CI | $<2\text{ minutos}$ |

---

## 2. Responsabilidades
*   **Engineering Lead:** Garantizar que ningún commit sea fusionado a `main` si viola las restricciones del linter o la cobertura mínima de testing.
*   **QA Lead:** Diseñar los escenarios de pruebas de integración complejos y coordinar las pruebas de exploración del comportamiento.
*   **Product Lead:** Validar los criterios de aceptación (formatos Gherkin) definidos en cada historia de usuario antes de promover el software.
