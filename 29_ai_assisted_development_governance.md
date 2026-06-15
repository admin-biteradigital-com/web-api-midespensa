# AI-Assisted Development Governance - Mi Despensa

Protocolo obligatorio para el desarrollo, refactorización y mantenimiento del sistema utilizando agentes inteligentes, asistentes de codificación (LLMs) y pipelines autónomos.

---

## 1. Reglas de Validación y Aprobación Humana

*   **Revisión del 100% de Lógica de Seguridad:** Cualquier cambio sugerido por IA en los módulos de autenticación, control de accesos de sesión (JWT) y row-level security (RLS) en D1 debe ser auditado de forma manual y visual por un desarrollador humano antes de su fusión.
*   **Prevención de Alucinaciones en Dependencias:** Los agentes IA no tienen permitido agregar librerías externas a los archivos `package.json` o dependencias de código sin verificar explícitamente su existencia en registros oficiales y validar su compatibilidad con el runtime de Cloudflare Workers (que carece de soporte nativo de APIs de Node.js completas).

---

## 2. Trazabilidad e Historial de Cambios

*   **Estructura de Commits Asistidos:** Los commits generados por agentes deben detallar explícitamente el origen analítico y la justificación del cambio técnico.
*   **Directiva de Preservación de Comentarios:** Las herramientas automáticas de edición de código no deben depurar ni eliminar comentarios y docstrings explicativos preexistentes, a menos que se trate de código completamente en desuso o refactorizado de raíz.
