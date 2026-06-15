# 61_system_integrity_validation_plan.md — Plan de Validación de Integridad del Sistema

Este documento establece el plan operativo y técnico para auditar y verificar que el software implementado en los entornos de Staging y Producción coincide de manera exacta con las especificaciones arquitectónicas, de seguridad y de cumplimiento diseñadas para **Mi Despensa**.

---

## 1. Auditorías Técnicas Automatizadas en el Pipeline (CI/CD)

El sistema de integración continua (GitHub Actions o similar) funcionará como el primer validador de integridad automatizado. Cada compilación o intento de push ejecutará de forma mandatoria:

```
[Código del Desarrollador]
           |
           v
+------------------------------------+
| 1. Linter & Static Analysis (ESLint)| --> Bloquea si complejidad > 10
+------------------------------------+
           |
           v
+------------------------------------+
| 2. Dependency Audit (npm audit)    | --> Bloquea si hay vulnerabilidades altas/críticas
+------------------------------------+
           |
           v
+------------------------------------+
| 3. Architecture Linter (Dependency)| --> Bloquea si hay acoplamientos prohibidos
+------------------------------------+
           |
           v
+------------------------------------+
| 4. Security Scan (Semgrep / SAST)  | --> Bloquea si detecta fugas de tenant o inyecciones SQL
+------------------------------------+
```

*   **Auditoría de Dependencias Prohibidas:** Herramientas de análisis de dependencias de importación (ej. Dependency Cruiser) comprobarán de forma estática que ningún archivo en el subdirectorio `/src/domain` realice importaciones desde `/src/infrastructure` o paquetes nativos de Node.js.
*   **Escaneo de Seguridad SAST:** Semgrep o herramientas similares analizarán de forma estática el código del Worker buscando patrones inseguros de SQL (ej. interpolación directa de variables sin sanitización o consultas D1 que no incluyan la variable de binding de `hogar_id`).

---

## 2. Checkpoints de Integridad Arquitectónica y Auditorías Manuales

Independientemente de las validaciones automatizadas, se programarán checkpoints y auditorías de integridad técnica en hitos clave del proyecto:

### Checkpoint 1: Pre-Alpha (Transición a Staging)
*   **Frecuencia:** Una sola vez al finalizar los Pasos 1 y 2 de la secuencia de construcción del MVP.
*   **Foco de Auditoría:** Verificar físicamente el aislamiento lScale de base de datos D1 en el Edge.
*   **Entregable Requerido:** Reporte de cobertura de tests unitarios de aislamiento con 100% de éxito.

### Checkpoint 2: Pre-Release (Promoción a Beta Cerrada)
*   **Frecuencia:** Previo al lanzamiento del Release Beta a los usuarios de control.
*   **Foco de Auditoría:** Medir la eficiencia de recursos y consumo. Se auditarán los Core Web Vitals en dispositivos móviles reales de gama media y se comprobará el perfil de ejecución (CPU time) de los Workers de Cloudflare en el panel web.
*   **Entregable Requerido:** Reporte de PageSpeed con puntuación > 90 en todos los rubros.

### Checkpoint 3: Auditoría Trimestral de Compliance
*   **Frecuencia:** Cada 3 meses tras el despliegue general (GA) de la plataforma en producción.
*   **Foco de Auditoría:** Revisión de logs en Cloudflare Logpush y base de datos de auditoría D1 para validar el cumplimiento de las políticas de retención de datos de la Ley 18.331 y el RGPD.
*   **Entregable Requerido:** Certificado firmado por el Oficial de Privacidad del proyecto validando la ejecución del derecho de supresión de datos (derecho al olvido) solicitado por usuarios históricos.
