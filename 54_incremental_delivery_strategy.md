# 54_incremental_delivery_strategy.md — Estrategia de Entrega Incremental

Este documento define la metodología táctica para realizar releases y despliegues incrementales del software **Mi Despensa**. Detalla cómo se mitiga el riesgo de caídas de servicio o de desajustes funcionales mediante despliegues progresivos, feature flags lógicas y la estrategia de versionado del esquema de datos.

---

## 1. Plan de Versiones Progresivas (Releases)

```
[Desarrollo Local] 
       |
       v
[Release Alpha Técnico] ---> Usuarios: Administradores de TI (1-2 hogares)
       |                     Objetivo: Validar latencia, límites del plan gratis D1/Workers.
       v
[Release Beta Cerrado]  ---> Usuarios: Grupo de control (10 hogares)
       |                     Objetivo: Auditar usabilidad y resiliencia en redes inestables.
       v
[General Availability]  ---> Público general
```

### Fase A: Alpha Técnico (Interno)
*   **Alcance:** Base de datos D1 operativa en el Edge, autenticación passwordless funcionando y API de productos básica sin interfaz gráfica de usuario.
*   **Usuarios objetivo:** El equipo técnico de desarrollo y sus propios hogares personales (1-2 hogares en total).
*   **Métricas de paso:** Estabilidad del 100% en las pruebas unitarias de aislamiento multi-tenant y verificación de que el consumo de recursos se mantiene bajo los 5ms de ejecución de CPU de Cloudflare por petición.

### Fase B: Beta Cerrado (Controlado)
*   **Alcance:** PWA básica instalable en dispositivos móviles con IndexedDB activa para almacenamiento offline y sincronización simplificada.
*   **Usuarios objetivo:** Grupo selecto de prueba compuesto por familiares e invitados de confianza del equipo técnico (10 hogares, aprox. 30 usuarios activos).
*   **Métricas de paso:** Tasa de éxito del vaciado de la cola `outbox` al volver a recuperar conectividad en el cliente superior al 99.8%.

### Fase C: General Availability (GA)
*   **Alcance:** El MVP de Mi Despensa completo disponible públicamente con lista de compras dinámica operativa y el 100% de las políticas del RGPD / Ley 18.331 integradas.
*   **Monitoreo inicial:** Dashboard de incidentes en tiempo real para alarmas del 5xx de Cloudflare.

---

## 2. Gestión de Cambios en Base de Datos (Estrategia No-Breaking)

Para evitar la interrupción del servicio al desplegar cambios de base de datos sin ventanas de mantenimiento programadas, se prohíben las migraciones destructivas.

### Reglas de Migración en D1
*   **No alterar columnas existentes:** Modificar un tipo de columna en vivo rompe las instancias anteriores de la API que aún se ejecutan en las ubicaciones de Edge de Cloudflare antes de que se propague el código nuevo.
*   **Estrategia de Dos Fases para Renombrar Columnas:**
    1.  **Fase 1 (Aditiva):** Agregar la nueva columna manteniendo la anterior operativa en modo de escritura dual en el código de la API. Copiar los registros históricos de fondo.
    2.  **Fase 2 (Destructiva):** Una vez que el 100% del tráfico corre sobre el código de la API que consume la nueva columna, se despliega una migración de limpieza para eliminar la columna obsoleta.

---

## 3. Gobernanza de Feature Flags en el Edge

Para habilitar y deshabilitar funcionalidades puntuales de forma instantánea sin requerir un nuevo pipeline de construcción y despliegue del Worker, se utiliza el almacenamiento **Cloudflare Workers KV**.

### Arquitectura de Feature Flags
*   El Worker expone un endpoint interno de lectura rápida que consulta las configuraciones globales desde la memoria caché del Edge (KV).
*   Las banderas se estructuran bajo el patrón de nomenclatura de alcances específicos:

```json
{
  "flags": {
    "feature_lista_compras_automatica": true,
    "feature_auditoria_extendida": false,
    "limite_productos_por_hogar": 250
  }
}
```

*   **Rollback de Funcionalidades:** Si la generación automática de listas de compras causa sobrecargas de CPU imprevistas, cambiar el valor de la bandera `feature_lista_compras_automatica` a `false` en Cloudflare KV desactiva la lógica de manera global en menos de 10 segundos en todo el mundo sin desplegar código.
