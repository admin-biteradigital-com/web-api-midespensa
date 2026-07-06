# Architecture Conformance Checklist (FSM & Session Module)

Este checklist establece las **reglas de conformidad objetivas** para certificar que el código del frontend de **Mi Despensa** cumple estrictamente con el contrato arquitectónico de la Phase 3. 

Toda modificación futura del sistema de autenticación, sesión o enrutamiento debe ser verificada contra estas reglas antes de aprobar e integrar cualquier Pull Request.

---

## 1. Reglas de Desacoplamiento y Dependencias (Aislamiento)

*   [ ] **1.1. No Importar FSM en el Dominio:** El archivo [session-manager.js](file:///d:/Desarrollos/web-api-midespensa/client/session/session-manager.js) (Módulo de Sesión) no debe realizar `import`, `require` ni contener referencias de ningún tipo a la máquina de estados de presentación (`auth-state.js`), a sus constantes (`AUTH_STATES`) o a sus funciones (`setAuthState`, `getAuthState`).
*   [ ] **1.2. No Escuchar FSM en el Dominio:** `SessionModule` no debe suscribirse al evento de presentación `FSM_STATE_CHANGED` ni a ningún otro evento visual. Su inicialización y comportamiento son guiados únicamente por llamadas directas de la capa de aplicación o red.
*   [ ] **1.3. Pureza de la Máquina de Estados:** El archivo [auth-state.js](file:///d:/Desarrollos/web-api-midespensa/client/auth-state.js) no debe importar módulos de persistencia de datos ni interactuar de forma directa con almacenamiento persistente (`localStorage`, `IndexedDB` o cookies).
*   [ ] **1.4. Inyección de Dependencias del Bus:** Todos los módulos cliente (`SessionModule`, `ApplicationOrchestrator`, `auth-state.js`) deben recibir el `EventBus` por inyección de dependencias (`initialize` o `setFSMEventBus`), manteniendo el código desacoplado de referencias globales.
*   [ ] **1.5. Límite del Almacenamiento (API Boundary):** Ningún módulo fuera del `SessionModule` puede realizar llamadas de lectura o escritura directa al almacenamiento persistente de sesión (como `localStorage.setItem` o `localStorage.removeItem`). Toda mutación física debe ser delegada a la interfaz pública del `SessionModule`.

---

## 2. Reglas del Flujo y Simetría de Eventos

*   [ ] **2.1. Simetría de Éxito de Autenticación:** La transición de presentación al estado `AUTH_SUCCESS` de la FSM debe ejecutarse simétricamente dentro del [app.js](file:///d:/Desarrollos/web-api-midespensa/client/app.js) (`ApplicationOrchestrator`) respondiendo únicamente a los eventos de dominio `UserAuthenticated` y `SessionRestored`.
*   [ ] **2.2. Pipeline Unificado de Login:** El flujo de Login por Magic Link debe seguir el pipeline estándar:
    `Acción (verifyToken) -> Dominio (SessionModule.initSession) -> Evento (UserAuthenticated) -> Orquestador -> FSM (AUTH_SUCCESS) -> UI`.
*   [ ] **2.3. Pipeline Unificado de Rehidratación:** El flujo de restauración de sesión al cargar la app debe seguir el pipeline estándar:
    `Acción (boot) -> Dominio (SessionModule.rehydrateSession) -> Evento (SessionRestored) -> Orquestador -> FSM (AUTH_SUCCESS) -> UI`.
*   [ ] **2.4. Sin Encadenamiento de Eventos de Dominio:** Ningún suscriptor a un evento del dominio en el `EventBus` (ej. en el `ApplicationOrchestrator`) debe emitir a su vez otro evento de dominio en caliente para evitar cascadas descontroladas en el bus.

---

## 3. Reglas de Emisores Autorizados de Ciclo de Vida

*   [ ] **3.1. Emisión de UserAuthenticated:** El evento de dominio `UserAuthenticated` solo puede ser emitido por `SessionModule.initSession` después de persistir con éxito el token y datos del usuario en el almacenamiento local.
*   [ ] **3.2. Emisión de SessionRestored:** El evento de dominio `SessionRestored` solo puede ser emitido por `SessionModule.rehydrateSession` después de verificar la validez e integridad física de las credenciales recuperadas.
*   [ ] **3.3. Emisión de SessionCleared:** El evento de dominio `SessionCleared` solo puede ser emitido por `SessionModule.clearSession` tras remover físicamente las credenciales del almacenamiento local.
*   [ ] **3.4. Emisión de SessionExpired:** El evento de dominio `SessionExpired` solo puede ser emitido por `SessionModule.expireSession` tras limpiar el almacenamiento debido a expiración o revocación.

---

## 4. Reglas de Manejo de Estado e Información

*   [ ] **4.1. Fuente de Verdad Única:** La validez de la sesión en caliente nunca se infiere leyendo el estado visual actual de la FSM (`getAuthState() === 'AUTH_SUCCESS'`). Se determina de forma exclusiva consultando las credenciales o estado del `SessionModule`.
*   [ ] **4.2. Aislamiento de Payloads de Transición:** El parámetro `data` enviado a `setAuthState()` y transmitido en `FSM_STATE_CHANGED` pertenece exclusivamente a la capa de presentación y solo puede contener metadatos para renderizar UI (ej. razones de timeout, e-mail para feedback visual). No debe transportar credenciales (`token`, `user`) con fines de procesamiento de negocio.
*   [ ] **4.3. Aislamiento de Errores Visuales:** Los estados terminales de error visual de la FSM (como `AUTH_FAIL`) no deben escribir, modificar o limpiar el almacenamiento de sesión directamente. Toda mutación física debe ser delegada a llamadas explícitas del dominio (`SessionModule`).
*   [ ] **4.4. Indepedencia de Expiración:** La lógica de red o infraestructura que intercepta llamadas no autorizadas (ej. HTTP 401) no debe inspeccionar el estado actual de la FSM para actuar; debe invocar directamente a `SessionModule.expireSession()`.
*   [ ] **4.5. Inmutabilidad de Payloads del Bus:** El `EventBus` debe clonar profundamente (deep clone) y congelar (freeze) todo objeto de payload despachado para evitar que los suscriptores muten los datos del dominio.
*   [ ] **4.6. Rol del Caché del Orquestador:** Las variables de sesión locales guardadas en el orquestador (`token`, `user`) deben tratarse únicamente como una caché de lectura de presentación. No representan la fuente de verdad para la validez de la sesión de negocio.

---

## 5. Verificación Automatizada (Fitness Functions)

Para evitar regresiones y garantizar que la conformidad arquitectónica no dependa únicamente de auditorías manuales, se cuenta con un script automatizado que realiza el análisis estático de dependencias e invariantes:

*   **Script:** [check-architecture.js](file:///d:/Desarrollos/web-api-midespensa/scripts/check-architecture.js)
*   **Comando de ejecución:**
    ```powershell
    node scripts/check-architecture.js
    ```
*   **Reglas validadas automáticamente:**
    1. Que ningún archivo cliente fuera de `session-manager.js` acceda directamente a `localStorage`.
    2. Que ningún archivo fuera de `session-manager.js` despache eventos de ciclo de vida de la sesión (`UserAuthenticated`, `SessionRestored`, `SessionCleared`, `SessionExpired`).
    3. Que `session-manager.js` no tenga acoplamiento estático con `auth-state.js` o referencias a la FSM.
    4. Que el orquestador (`ApplicationOrchestrator`) no realice encadenamiento de eventos de dominio (llamadas a `EventBus.dispatch`).

