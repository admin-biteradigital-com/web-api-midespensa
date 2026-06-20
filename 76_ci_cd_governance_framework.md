# 76_ci_cd_governance_framework.md — Marco de Gobernanza de CI/CD (CI/CD Governance Framework)

Este documento formaliza la gobernanza, especificaciones y límites del pipeline de Integración Continua (CI), Despliegue Continuo (CD), Verificación Continua (CV) y Cumplimiento Continuo (CC) para la plataforma **Mi Despensa**, propiedad de **Bitera Digital SAS**. 

---

## 1. Objetivos Estratégicos
El pipeline CI/CD no es una simple herramienta operacional; constituye un componente central del **Control Plane** de construcción y despliegue del software. Sus objetivos fundamentales son:
*   **Validación de Calidad y Prevención de Regresiones:** Ejecutar automáticamente la suite de pruebas unitarias y de integración ante cualquier cambio en el repositorio.
*   **Aseguramiento de Seguridad Activa:** Escanear dependencias y descartar librerías con vulnerabilidades críticas o altas antes de que ingresen al flujo de empaquetado.
*   **Verificación de Cumplimiento (Compliance):** Garantizar de forma automatizada que no se introduzcan dependencias comerciales (manteniendo el **Costo Operativo = USD 0**), y comprobar la inmutabilidad de políticas de PII y TEL.
*   **Trazabilidad del Proceso:** Registrar de manera indeleble en la bitácora legal del sistema cada hito de construcción, análisis de seguridad y despliegue.

---

## 2. Restricciones de Costo e Infraestructura

Para respetar la política corporativa inquebrantable de **Costo Operativo = USD 0**, se establece el uso exclusivo de las siguientes tecnologías:

### 2.1. Tecnologías Permitidas (Costo USD 0)
*   **GitHub Actions (Free Tier):** Orquestador principal de CI/CD para repositorios públicos o dentro de las cuotas gratuitas de repositorios privados.
*   **Cloudflare Pages & Workers (Free Tier):** Destinos de despliegue en entornos de Staging y Producción, administrados mediante Wrangler.
*   **Wrangler CLI:** Interfaz oficial para despliegues automáticos desde GitHub Actions hacia Cloudflare sin costo base de middleware.
*   **npm audit:** Herramienta nativa para el análisis de dependencias sin costos comerciales de herramientas SaaS externas.
*   **Lighthouse CI:** Automatización de auditorías de rendimiento y accesibilidad en el pipeline.

### 2.2. Tecnologías Prohibidas (Por introducción de costos o desviación arquitectónica)
*   **Jenkins o servidores autohostedos:** Excluidos por requerir costos mensuales de servidores virtuales (v.g. AWS EC2, GCP Compute Engine).
*   **CircleCI / Travis CI (Planes de Pago):** Prohibidos al existir una alternativa gratuita nativa en GitHub Actions.
*   **GitHub Enterprise (Suscripciones Corporativas de Pago):** Toda validación debe ser realizable bajo el plan estándar/gratuito de GitHub.
*   **Cloudflare Deployments / Bindings de Pago:** El pipeline tiene prohibido desplegar configuraciones que activen facturas mensuales.

---

## 3. Integración Continua (CI), Verificación Continua (CV) y Cumplimiento Continuo (CC)

Cada Pull Request dirigido a las ramas de control (`develop`, `main`) gatilla automáticamente el workflow de verificación, estructurado en tres áreas de gobernanza:

```
[GitHub PR] ──► [TypeScript Build] ──► [Tests (Unit/Integration)] ──► [Security & Compliance Scan]
```

### 3.1. Pipeline de Validación de Calidad (CI)
*   **TypeScript Build:** Compila el código del Edge Worker y de la PWA del cliente. Si hay algún error sintáctico o de tipado, el pipeline se aborta inmediatamente.
*   **Unit & Integration Testing:** Ejecución de la suite de pruebas bajo Mocha/Vitest. La cobertura debe cumplir obligatoriamente con el umbral de aceptación del **85%**.

### 3.2. Pipeline de Cumplimiento y Seguridad (CC / CV)
*   **Escaneo de Seguridad (`npm audit`):** Inspecciona el árbol de dependencias. Se bloquea la integración de forma obligatoria si existen vulnerabilidades con severidad alta o crítica.
*   **Validación contra Drift Arquitectónico:** Compara el archivo de configuración `wrangler.toml` para verificar la ausencia de bindings de pago (como Durable Objects, bindings KV activos sin costo cero, Cloudflare Queues comerciales) antes de permitir el despliegue.

---

## 4. Despliegue Continuo (CD) e Integración con Entornos

El flujo de promoción entre entornos se define en función de las ramas del repositorio:

```
  [PR Merge a develop]  ──────►  [Auto-Deploy a Staging]
  [PR Merge a main]     ──────►  [Manual Approval Check]  ──────►  [Deploy a Production]
```

### 4.1. Entorno de Staging (Automático)
*   **Rama de Origen:** `develop`
*   **Mecanismo:** Al integrarse un Pull Request en la rama `develop`, GitHub Actions ejecuta la validación completa de CI y, al completarse con éxito, despliega automáticamente el Worker y los assets al subdominio de Staging en Cloudflare mediante Wrangler.

### 4.2. Entorno de Producción (Aprobación Manual Obligatoria)
*   **Rama de Origen:** `main`
*   **Mecanismo:** Al integrarse cambios en `main`, el pipeline de CD se ejecuta pero se detiene en la compuerta de despliegue. Requiere la **firma digital y aprobación manual** a través de GitHub Environments de una identidad asignada del Control Plane (`admin@biteradigital.com`) antes de invocar la acción de Wrangler para sobrescribir la versión de producción.

---

## 5. Auditoría de Pipelines (Audit Trail Compliance)

Para garantizar la evidencia inalterable del proceso de entrega continua (requisito ISO 27001 / A.14), el pipeline CD/CI interactúa directamente con el `Audit Evidence Provider` registrando los siguientes eventos mínimos en la tabla `auditoria_legal`:

*   **CI_BUILD_STARTED:** Registra el inicio de una compilación a nivel de pipeline asociando el SHA del commit y actor de GitHub.
*   **CI_BUILD_SUCCESS:** Registra la compilación exitosa y la aprobación de las pruebas.
*   **CI_BUILD_FAILED:** Registra fallos en construcción o no cumplimiento del umbral del 85% de cobertura.
*   **CD_DEPLOY_STAGING:** Registra el inicio y finalización del despliegue en el entorno de desarrollo y pruebas.
*   **CD_DEPLOY_PRODUCTION:** Registra el despliegue productivo y el ID de aprobación manual de Control Plane.
*   **SECURITY_SCAN_PASSED:** Registra que el análisis estático de vulnerabilidades no encontró dependencias inseguras.
*   **SECURITY_SCAN_FAILED:** Registra la detención del pipeline debido a vulnerabilidades altas o críticas detectadas.
