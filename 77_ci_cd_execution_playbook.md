# 77_ci_cd_execution_playbook.md — Playbook de Ejecución de CI/CD (CI/CD Execution Playbook)

Este documento detalla el procedimiento operacional paso a paso para el flujo de desarrollo, validación y despliegue del proyecto **Mi Despensa**, gobernado por **Bitera Digital SAS**. 

Describe el ciclo de vida completo de un cambio en el código, desde la máquina local del desarrollador hasta su despliegue final en producción y su registro inalterable en el Audit Trail.

---

## 1. Diagrama de Flujo del Ciclo de Vida del Cambio

```
[Developer] 
    │
    ▼ (Crea Rama / Commits locales)
[Pull Request] (Hacia develop)
    │
    ▼ (Dispara)
[CI Validation] (TypeScript Build + Tests >= 85% + npm audit)
    │
    ▼ (Aprobado)
[Merge a develop]
    │
    ▼ (Auto-Despliegue)
[Deploy Staging] (Cloudflare Edge - Wrangler)
    │
    ▼
[QA Validation] (Lighthouse >= 95 + Smoke Tests + Recovery Drill)
    │
    ▼ (Pull Request a main)
[Manual Approval] (Aprobación por admin@biteradigital.com)
    │
    ▼ (Despliegue)
[Production] (Cloudflare Edge - Wrangler)
    │
    ▼ (Dispara)
[Audit Registration] (Registro de eventos en tabla auditoria_legal en D1)
```

---

## 2. Pasos Detallados del Playbook

### Paso 1: Developer (Desarrollo Local)
*   **Acción:** El desarrollador crea una rama de trabajo local (`feature/*` o `bugfix/*`) a partir de la rama `develop`.
*   **Control de Calidad Local:** Antes de subir los cambios, el desarrollador ejecuta localmente la suite de pruebas unitarias y validación de tipos (`npm run test` y `npm run build`).

### Paso 2: Pull Request (Propuesta de Cambio)
*   **Acción:** Se crea un Pull Request (PR) en GitHub dirigido a la rama `develop`.
*   **Control Plane Trigger:** La creación o actualización del PR dispara automáticamente la orquestación del pipeline en GitHub Actions.

### Paso 3: CI Validation (Compuerta de Calidad y Seguridad)
*   **Acción:** GitHub Actions inicializa un runner gratuito (Costo USD 0) y ejecuta consecutivamente:
    1.  **TypeScript compilation:** Garantiza que no existen errores de sintaxis o de tipado.
    2.  **Unit & Integration Tests:** Corre la suite completa. Si la cobertura es menor al **85%**, el pipeline se aborta.
    3.  **npm audit:** Escanea dependencias en busca de fallos de seguridad. Si se detecta alguna vulnerabilidad con nivel *High* o *Critical*, el pipeline se aborta.
    4.  **Drift Check:** Verifica que el archivo `wrangler.toml` no contenga recursos de pago configurados.
*   **Audit Trail:** Se genera el log de auditoría correspondiente (`CI_BUILD_STARTED`, y consecuentemente `CI_BUILD_SUCCESS` o `CI_BUILD_FAILED` + `SECURITY_SCAN_PASSED` o `SECURITY_SCAN_FAILED`).

### Paso 4: Merge (Fusión a develop)
*   **Acción:** Si todas las comprobaciones de CI son exitosas y se cuenta con las revisiones requeridas, se fusiona el PR en la rama `develop`.

### Paso 5: Deploy Staging (Despliegue a Pruebas)
*   **Acción:** La fusión en `develop` dispara automáticamente el workflow `deploy-staging.yml`.
*   **Ejecución:** Wrangler CLI despliega la API en Cloudflare Workers y los assets del cliente en Cloudflare Pages bajo el subdominio de staging.
*   **Audit Trail:** Se inserta el evento `CD_DEPLOY_STAGING` en la tabla `auditoria_legal`.

### Paso 6: QA Validation (Verificación Funcional e Integridad)
*   **Acción:** El equipo de desarrollo realiza las pruebas de humo sobre staging y ejecuta auditorías automatizadas de Lighthouse en el pipeline de validación para garantizar puntuaciones de rendimiento y accesibilidad móviles mayores o iguales a **95**.
*   **Disaster Recovery Test:** Se valida la integridad funcional de la base de datos D1 y el comportamiento offline de la PWA.

### Paso 7: Manual Approval (Aprobación y Merge a main)
*   **Acción:** Se crea un Pull Request desde la rama `develop` hacia la rama `main`.
*   **Orquestación:** El pipeline valida el código. Una vez aprobado, se fusiona en `main`.
*   **Compuerta de Aprobación Manual:** El workflow de producción `deploy-production.yml` se inicia pero queda en estado de pausa. Solicita la aprobación explícita y firma de la identidad administradora corporativa (`admin@biteradigital.com`).

### Paso 8: Production (Despliegue Productivo)
*   **Acción:** Con la aprobación humana concedida, el pipeline ejecuta Wrangler CLI y despliega el Edge Worker y la PWA de cara a los usuarios finales.
*   **Audit Trail:** Se inserta el evento `CD_DEPLOY_PRODUCTION` detallando el SHA del commit y el autorizador de la operación.

### Paso 9: Audit Registration (Cierre de Evidencia)
*   **Acción:** El pipeline CI/CD invoca de manera automática la API de logs de auditoría inmutables del sistema para almacenar y sellar el historial acumulativo (hash chain) y firma HMAC del despliegue en la tabla `auditoria_legal` de la base de datos de producción.
