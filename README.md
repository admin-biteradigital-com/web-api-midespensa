# Mi Despensa — Sprint 0

Plataforma colaborativa doméstica para la gestión del inventario y consumo familiar en tiempo real, operando en la red Edge de Cloudflare (Workers, D1, KV).

## Estructura del Repositorio

* `worker/`: Código fuente del backend serverless en TypeScript, middleware de seguridad (TEL), cifrado PII y enrutamiento.
* `schema/`: Definición de esquemas D1 SQLite.
* `client/`: Frontend Progressive Web App (PWA) offline-first en Vanilla HTML/CSS/JS con caché en IndexedDB.
* `shared/`: Tipos TypeScript y constantes compartidas.
* `docs/`: Documentación de arquitectura y enmiendas del Sprint 0.

## Requisitos Previos

* Node.js v18+ e npm.
* Cuenta de Cloudflare (opcional, para deploys).

## Configuración y Desarrollo Local

### 1. Preparar el Backend (Worker)

Entra en la carpeta del worker e instala dependencias:
```bash
cd worker
npm install
```

### 2. Inicializar la Base de Datos Local D1

Crea la base de datos local y aplica el esquema SQLite inicial:
```bash
npx wrangler d1 execute local-db --local --file=../schema/d1-schema.sql
```

### 3. Iniciar el Servidor de Desarrollo

Levanta la API del Worker localmente:
```bash
npm run dev
```
La API estará disponible en `http://localhost:8787`.

### 4. Abrir la Aplicación Cliente (PWA)

Abre el archivo `client/index.html` directamente en tu navegador, o sírvelo mediante un servidor local simple (ej. `npx serve ../client` o Live Server).

## Flujo de Validación E2E del Sprint 0

1. **Autenticación Magic Link:**
   * Abre la PWA en el navegador.
   * Ingresa tu correo y haz clic en "Obtener Magic Link".
   * El Worker simulará el envío, logueará el token en la terminal y devolverá el token en la UI.
   * Haz clic en "Iniciar Sesión" (el token se rellenará automáticamente).

2. **Creación de Hogar:**
   * Si es tu primera sesión, se te redirigirá a la vista de "Configurar Hogar".
   * Ingresa un nombre para tu despensa y haz clic en "Crear Hogar".
   * El sistema creará el hogar, actualizará tus claims JWT con el `hogarId` y te redirigirá al Dashboard.

3. **Ingreso y Consumo de Productos:**
   * Ingresa el nombre de un artículo (ej. "Leche") y presiona `+`.
   * Verás el producto en el listado y un evento del tipo `ALTA` en el log inferior.
   * Ajusta la cantidad con los botones `+` y `-`. Cada cambio actualizará atómicamente la tabla `inventario` y generará un evento inmutable en `events_stock`.

4. **Simulación Offline:**
   * En las herramientas de desarrollador del navegador (DevTools), activa la simulación "Modo Avión" o deshabilita la conexión de red en la pestaña Network.
   * Ajusta el stock de un producto. Verás que la cantidad cambia de forma instantánea en pantalla (Optimistic UI) y la insignia superior muestra "Offline (Sin Conexión)".
   * Desactiva el Modo Avión. El sistema detectará la red y sincronizará automáticamente los eventos encolados en IndexedDB con la base de datos D1 del servidor.
