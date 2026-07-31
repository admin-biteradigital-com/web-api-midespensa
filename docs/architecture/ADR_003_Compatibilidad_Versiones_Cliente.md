# ADR-003: Compatibilidad entre Versiones del Cliente y Estrategias de Migración

## Estatus
Aceptado

## Contexto
A medida que la aplicación evoluciona, las estructuras de los objetos almacenados localmente en `localStorage` o `IndexedDB` (por ejemplo, el objeto `user` o el esquema de las colecciones de base de datos locales) sufrirán modificaciones.

Cuando se despliega una nueva versión del cliente, esta se ejecuta sobre el estado persistido por la versión anterior. Si los datos antiguos no son compatibles o se encuentran desincronizados, se producen fallos de consistencia en tiempo de ejecución (como el del Sprint 0.5 donde el token tenía `hogarId` pero `user.hogarId` era `null`), dejando la sesión bloqueada y requiriendo soporte manual (ej. vaciar el caché o almacenamiento del navegador de forma manual).

## Decisión
Queda establecido que **toda modificación estructural al modelo persistido o al flujo de sesión debe ir acompañada de una estrategia explícita de compatibilidad**. Está prohibido confiar en que el usuario limpiará manualmente el almacenamiento de su navegador para solucionar problemas de estado obsoleto.

Se utilizarán las siguientes estrategias combinadas:

1.  **Mecanismo de Autocuración (Self-Healing Session):**
    El módulo de sesión (`SessionModule`) debe comparar la integridad del token contra los datos del usuario en cada arranque (`rehydrateSession`). Si los claims criptográficos del JWT (`hogarId`) difieren de las propiedades del objeto `user`, el sistema debe iniciar un proceso de auto-recuperación (re-sincronizando el objeto `user` con la base de datos o infiriendo los campos correctos desde el JWT).
    
2.  **Versionado del Esquema de Persistencia:**
    Se implementará un identificador de versión del esquema en `localStorage` (ej. `schema_version = "v1"`). Si el cliente detecta una discrepancia o versión de esquema obsoleta al arrancar, ejecutará un script de migración estructurado o forzará un vaciado controlado de sesión (`clearSession`) para forzar un re-login limpio y evitar estados corruptos.
    
3.  **Invalidación de Caché en Actualización de Service Worker:**
    Se diseñará una política agresiva de actualización del Service Worker que asegure la invalidación inmediata de los scripts antiguos (`app.js`, `session-manager.js`) para evitar que código desactualizado opere sobre esquemas nuevos.
