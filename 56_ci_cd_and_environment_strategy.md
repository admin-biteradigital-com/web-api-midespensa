# 56_ci_cd_and_environment_strategy.md — Estrategia de Entornos y CI/CD

Este documento especifica la configuración de entornos físicos y lógicos, el flujo de desarrollo git de control de versiones y los pipelines de integración y entrega continua para la plataforma **Mi Despensa**. El diseño está concebido para operar bajo el plan gratuito de Cloudflare, optimizando los recursos mediante asignaciones de entornos locales y en la nube.

---

## 1. Topología y Estructuración de Entornos

```
[Máquina Local del Dev] ----> Push a PR ----> [Entorno de Staging] ----> Merge a Main ----> [Entorno de Producción]
* SQLite Local Emulado                         * Cloudflare D1 Staging                     * Cloudflare D1 Productivo
* Wrangler Dev Local                           * Worker Staging                            * Worker Productivo
                                               * Tests E2E Automáticos                     * Monitoreo de Errores Activo
```

### Entorno 1: Local / Desarrollo (Localhost)
*   **Infraestructura:** SQLite local in-memory o archivo persistido en disco de desarrollo simulando Cloudflare D1. El código del Worker se ejecuta en Node.js local mediante el emulador de CLI `wrangler dev`.
*   **Propósito:** Iteración ultrarrápida de lógica de negocio y desarrollo frontend con recarga en vivo (hot reload).

### Entorno 2: Staging (Nube de Pruebas)
*   **Infraestructura:** Instancia real de base de datos Cloudflare D1 (`midespensa-db-staging`) y subdominio de pruebas del Edge Worker (`staging.midespensa.workers.dev`).
*   **Propósito:** Validación funcional end-to-end con bases de datos distribuidas en la nube y ejecución de pruebas automatizadas de seguridad e integración previas al lanzamiento productivo.

### Entorno 3: Producción (Nube en Vivo)
*   **Infraestructura:** Base de datos Cloudflare D1 productiva (`midespensa-db-production`) y dominio principal expuesto al público general.
*   **Propósito:** Operación comercial real con monitoreo estricto de latencias y tasas de error.

---

## 2. Flujo de Control de Versiones y Branching

Se adopta una variante simplificada y segura de **GitHub Flow**:

1.  **Ramas de Feature:** Todo cambio de código o esquema se inicia en una rama independiente denominada bajo el patrón `feature/nombre-de-tarea` o `bugfix/nombre-de-error`.
2.  **Pull Requests (PR):** Al completar el desarrollo local, se genera un PR apuntando a la rama estable `main`.
3.  **CI Pre-Merge:** El pipeline de integración ejecuta de forma obligatoria las validaciones estáticas de sintaxis (Linter), pruebas unitarias locales en Vitest y validaciones de cobertura antes de permitir el merge.
4.  **Promoción Directa:** Al realizar el merge del Pull Request en la rama `main`, la suite de CI compila el bundle productivo y realiza la publicación automática en el entorno de Producción de Cloudflare.

---

## 3. Configuración del Archivo Wrangler (`wrangler.toml`)

La separación lógica de entornos se instrumenta de forma nativa en el archivo de configuración de Cloudflare Workers:

```toml
name = "midespensa-api"
main = "src/index.js"
compatibility_date = "2026-06-15"

# Binding por defecto para entorno local
[[d1_databases]]
binding = "DB"
database_name = "midespensa-db-local"
database_id = "local-sqlite-binding"

# Configuración del entorno de Staging
[env.staging]
name = "midespensa-api-staging"
[[env.staging.d1_databases]]
binding = "DB"
database_name = "midespensa-db-staging"
database_id = "6e5b4c3d-2a1f-4e0d-8c7b-6a5d4c3b2a1f"

# Configuración del entorno de Producción
[env.production]
name = "midespensa-api-production"
[[env.production.d1_databases]]
binding = "DB"
database_name = "midespensa-db-production"
database_id = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
```

---

## 4. Estrategia de Reversión Rápida (Rollback)

### Reversión Inmediata de Código (Zero Downtime)
*   Cloudflare Workers guarda un historial versionado e inmutable de los últimos deployments del script compilado del Worker.
*   Si se detecta un error de severidad crítica en producción tras un despliegue, el operador de TI no realiza un commit de reversión ni un pipeline en Git. Ejecuta el comando de restauración instantánea del panel de control de Cloudflare:
    ```bash
    wrangler rollback <version-id>
    ```
*   Este proceso se completa a nivel mundial en menos de 3 segundos, redirigiendo el 100% de las conexiones a la versión previa estable del código.

### Reversión de Base de Datos (D1)
*   **Principio Operativo:** Nunca se ejecutan sentencias de rollback de esquema automáticas en vivo (ej. `DROP TABLE`), ya que corren el riesgo de causar pérdida accidental de datos históricos de los hogares.
*   **Procedimiento de Contingencia:** En caso de fallas causadas por una migración incorrecta en la base de datos D1:
    1.  Desplegar de inmediato una versión del Worker modificada para omitir la lógica problemática de acceso a la nueva columna o tabla.
    2.  Restaurar el backup diario en caliente generado por Cloudflare en una base de datos clonada auxiliar.
    3.  Analizar y ejecutar un script manual corrector (data patch) para conciliar las transacciones pendientes que hayan ingresado durante la ventana de tiempo del incidente.
