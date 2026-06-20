# 70_backup_and_recovery_strategy.md — Estrategia de Backup y Recuperación de Desastres

Este documento establece la estrategia formal de contingencia, respaldo de datos y recuperación de desastres (**Disaster Recovery**) para la persistencia del sistema **Mi Despensa**, propiedad de **Bitera Digital SAS**.

---

## 1. Objetivos de Recuperación (RTO y RPO)

| Métrica | Objetivo de Diseño | Justificación / Mitigación |
| :--- | :--- | :--- |
| **RTO (Recovery Time Objective)** | **< 4 horas** | Tiempo máximo tolerado para restaurar la API en el Edge y la base de datos D1 desde una falla catastrófica de Cloudflare. |
| **RPO (Recovery Point Objective)** | **< 24 horas** (Servidor) / **< 1 hora** (Efectivo) | Respaldo diario de base de datos. Gracias a la cola local de IndexedDB en la PWA del cliente, los eventos locales no sincronizados pueden re-transmitirse al restablecer el servicio, reduciendo la pérdida efectiva de datos para hogares activos. |

---

## 2. Estrategia de Respaldo (Backup Scheme)

Para cumplir con la restricción de **Costo Operativo = USD 0**, no se utilizarán herramientas comerciales de backup. Se implementa un flujo automatizado de bajo consumo a nivel de Control Plane:

### 2.1. Exportación Diaria de D1 (D1 Daily Export)
*   **Mecanismo:** Un flujo de GitHub Actions ejecutándose periódicamente mediante un cron job diario (`cron: "0 4 * * *"`) que realiza las siguientes operaciones a nivel de Control Plane:
    1.  Ejecuta el CLI de Wrangler para generar un volcado SQL de la base de datos de producción:
        ```bash
        npx wrangler d1 export midespensa-db --remote --output ./backup.sql
        ```
    2.  Comprime el archivo generado usando compresión Gzip.
    3.  Almacena el backup comprimido en un repositorio privado de GitHub dedicado exclusivamente a históricos de base de datos (`biteradigital-midespensa-backups`).
*   **Política de Retención:** Los volcados se conservan durante **30 días** en el repositorio privado de backups. Transcurrido ese plazo, un script del pipeline depura los archivos más antiguos de forma automática.

---

## 3. Estrategia de Recuperación (Disaster Recovery Plan)

Ante una corrupción de base de datos o fallo catastrófico en la infraestructura del Edge:

### 3.1. Proceso de Restauración Completa (Restore)
1.  **Aprovisionamiento de Instancia D1:** Si la base de datos D1 original es irrecuperable, el administrador del Control Plane (`admin@biteradigital.com`) creará una nueva instancia de D1 a través de Wrangler.
2.  **Aplicación de Esquema DDL:** Se ejecuta el esquema base oficial desde el archivo de Control Plane:
    ```bash
    npx wrangler d1 execute midespensa-db --remote --file=./schema/d1-schema.sql
    ```
3.  **Importación del Último Volcado Válido:** Se descomprime el archivo de backup del repositorio de respaldo y se ejecuta contra D1:
    ```bash
    npx wrangler d1 execute midespensa-db --remote --file=./backup.sql
    ```

### 3.2. Reconstrucción de Vista Materializada (`inventario`) desde Log de Eventos (`events_stock`)
Si se detecta un "Drift" de consistencia o corrupción exclusiva en la tabla `inventario` (Materialized View), pero la tabla `events_stock` (Source of Truth) se mantiene intacta:

*   **Razón de Reconstrucción:** Al ser `events_stock` un log append-only inmutable de Event Sourcing, el estado consolidado de la alacena puede recalcularse íntegramente a partir del histórico de deltas.
*   **Procedimiento SQL de Reparación:**
    El administrador del Control Plane ejecutará la siguiente consulta transaccional para limpiar y reconstruir la vista materializada:
    ```sql
    -- 1. Limpieza de proyección corrupta
    DELETE FROM inventario;

    -- 2. Regeneración basada en la sumatoria histórica de deltas agrupados por hogar y producto
    INSERT INTO inventario (id, hogar_id, product_name, quantity, updated_at)
    SELECT 
      product_id AS id,
      hogar_id,
      -- Se recupera el último nombre registrado en el flujo (se asume consistencia por ID)
      (SELECT product_name FROM (
         SELECT p.product_name 
         FROM inventario_aux_names p 
         WHERE p.id = product_id 
         LIMIT 1
      )) AS product_name,
      SUM(quantity_delta) AS quantity,
      MAX(timestamp) AS updated_at
    FROM events_stock
    GROUP BY hogar_id, product_id
    HAVING SUM(quantity_delta) > 0;
    ```
    *Nota:* Para facilitar esta reconstrucción en caliente sin tablas auxiliares, el Worker implementará una rutina interna en el módulo administrativo `/api/v1/admin/rebuild-inventory` (restringida a identidades del Control Plane) que lee el log ordenadamente y reconstruye los registros de inventario en memoria antes de realizar un volcado masivo atómico en D1.

---

## 4. Pruebas de Recuperación (Simulacros)

Para garantizar el cumplimiento de la norma ISO 22301 (BCMS), se realizará un simulacro de recuperación semestral:
1.  Creación de una base de datos D1 de prueba: `midespensa-db-test`.
2.  Ejecución del pipeline de restauración utilizando el backup del día anterior.
3.  Ejecución del test de reconstrucción del inventario.
4.  Ejecución de las pruebas de humo (`worker/src/tests/smoke.test.ts`) sobre la base recuperada para verificar integridad.
