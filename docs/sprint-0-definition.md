# Sprint 0 Definition and Success Criteria

Este documento especifica los objetivos, alcances, y criterios de aceptación definitivos para validar la construcción e integridad del **Sprint 0** de la plataforma **Mi Despensa**.

## 1. Objetivos del Sprint 0

* Validar que el flujo transaccional completo (End-to-End) desde la interfaz cliente PWA hasta la persistencia relacional en el Edge funciona bajo condiciones de red variables.
* Comprobar la viabilidad operativa y de seguridad del cifrado de correo en el Worker (PII) y el Query Gate (TEL).
* Ejecutar el sistema completo en el **Free Tier de Cloudflare** (Presupuesto Cero).

## 2. Criterios de Aceptación (DoD)

1. **Flujo de Autenticación Passwordless:**
   * El usuario ingresa su correo en la PWA y solicita Magic Link.
   * El sistema genera un token JWT temporal y expone el link de inicio.
   * Al verificar el token, se crea un `user_id` único, se encripta el correo (AES-GCM), se almacena su hash SHA-256 en D1, y se devuelve un token de sesión de 7 días.

2. **Aislamiento de Hogar (TEL):**
   * El usuario puede crear un hogar desde la PWA. El sistema actualiza el token con el claim de `hogarId`.
   * Cualquier consulta de stock o eventos inyecta el `hogar_id` y bloquea cualquier fuga de datos cross-tenant.

3. **Gestión de Stock & Auditoría (Event Sourcing Híbrido):**
   * Al agregar o remover unidades de un producto, se actualiza la tabla `inventario` y se inserta un registro correspondiente en `events_stock` de forma atómica (transacción batch en D1).
   * No existen operaciones de modificación o borrado permitidas sobre `events_stock` (inmutabilidad).

4. **Sincronización Offline (IndexedDB + SW):**
   * Con la red desactivada (modo avión), la PWA permite agregar/reducir unidades, actualiza optimistamente la vista local, y encola el evento en el outbox de IndexedDB.
   * Al recuperar la conexión, el sync engine vacía el outbox de forma secuencial hacia el Worker, actualiza la base D1, y descarga el estado consistente consolidado en el cliente.
