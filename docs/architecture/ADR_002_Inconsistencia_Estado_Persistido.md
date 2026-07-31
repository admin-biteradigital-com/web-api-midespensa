# ADR-002: Inconsistencia de Estado Persistido durante Evolución del Cliente

## Estatus
Aceptado

## Contexto
Durante el Sprint 0.5 (certificación del First Time User Experience), se identificó que el cliente PWA se quedaba atrapado en la pantalla de "Configurar Hogar" (`view-setup-hogar`) incluso después de haber creado con éxito el hogar en el backend. 

Al auditar la persistencia física en tiempo de ejecución, descubrimos un estado inconsistente en `localStorage`:
*   `localStorage.getItem("token")` contenía un JWT firmado con el claim `hogarId` poblado correctamente.
*   `localStorage.getItem("user")` contenía el objeto serializado con `hogarId: null`.

Esta inconsistencia fue provocada porque el usuario ejecutó la creación del hogar bajo una versión del cliente con un bug de inmutabilidad (el cliente intentaba mutar una propiedad de un payload congelado por el `EventBus`, fallando silenciosamente y persistiendo el objeto original con el campo `null`). Tras desplegar la corrección, los intentos de crear el hogar fallaban con `400 Bad Request` en el servidor ("User already owns a household") y la UI no ejecutaba la actualización del almacenamiento, quedando la sesión local bloqueada de forma permanente.

## Implicaciones y Lecciones Aprendidas

1.  **El Almacenamiento Persistente es un Contrato:**
    El estado persistido localmente (`localStorage`, `IndexedDB`, cookies) debe ser tratado con el mismo rigor que un esquema de base de datos o un contrato de API. Evoluciones en el código del cliente que cambien el modelo de datos pueden corromper o desincronizar los estados persistidos de usuarios reales si no se maneja la compatibilidad hacia atrás.

2.  **Verificación Cruzada Obligatoria en Rehidratación:**
    No se debe asumir que el objeto `user` en disco es la fuente de verdad absoluta si convive con un token de sesión. El token firmado (JWT) contiene claims validados por criptografía y es más confiable que los objetos JSON planos guardados en local storage.

3.  **Mecanismos de Autocuración (Self-Healing):**
    El cliente debe ser capaz de recuperarse de inconsistencias locales. Si el servidor informa que un recurso "ya existe" (HTTP 400/409), el cliente debe interpretar esto como un éxito de sincronización y corregir el estado persistido local en lugar de limitarse a mostrar un error visual.

## Decisiones de Diseño Futuras

*   **Validación de Consistencia al Arrancar:**
    Durante la rehidratación en `SessionModule.rehydrateSession()`, se añadirá una verificación que compare los claims decodificados del JWT con el objeto `user`. Si el JWT tiene un `hogarId` válido pero el objeto `user` tiene `hogarId: null`, el módulo debe corregir el objeto local automáticamente usando la información del JWT.
*   **Gestión de Versiones de Caché y Persistencia:**
    Cualquier cambio estructural en el objeto de sesión requerirá incrementar la versión del caché local (ej. `mi-despensa-cache-v3`) o introducir un prefijo de versión en las claves de almacenamiento para forzar una re-autenticación limpia si se detecta un esquema obsoleto.
