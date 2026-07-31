# Incident Postmortem: PM-001-FTUE-State-Inconsistency

* **Fecha del incidente:** 2026-07-06
* **Fecha del reporte:** 2026-07-08
* **Autor:** Lead Debugging Engineer
* **Estado:** Resuelto

---

## 1. ¿Qué ocurrió? (Summary)
Tras el primer inicio de sesión y la creación de un nuevo hogar en la aplicación, el frontend se quedaba permanentemente estancado en la pantalla de "Configurar Hogar" (`view-setup-hogar`) sin redirigir al usuario al Dashboard. Los refrescos de pantalla y reintentos no solucionaban el problema, mostrando un error de "El usuario ya posee un hogar" sin autocurar la sesión local.

## 2. ¿Por qué ocurrió? (Root Cause)
La causa raíz fue un estado inconsistente en `localStorage` provocado por una carrera de versiones y una mutación silenciosa fallida:
1. Durante la creación del hogar en la versión inicial del código, el frontend intentaba mutar directamente un objeto congelado (`user.hogarId = data.hogar.id`). En modo no estricto, esta asignación falló de forma silenciosa, manteniendo `user.hogarId = null`.
2. Esta sesión desincronizada (token con `hogarId` correcto, pero objeto `user` con `hogarId: null`) fue escrita en `localStorage`.
3. Al refrescar, la rehidratación cargaba el usuario inconsistente, redirigiendo a la pantalla de configuración del hogar.
4. Cualquier intento posterior de crear el hogar fallaba con un error HTTP 400 del backend porque el hogar ya existía en la base de datos, impidiendo que el cliente llamara a `initSession` con el nuevo token y usuario.

## 3. ¿Por qué no lo detectamos antes? (Detection Gaps)
1. **Ausencia de Verificación de Consistencia:** Los tests de integración y la lógica de rehidratación asumen que el estado de `localStorage` es correcto por definición, sin contrastar el objeto `user` contra los claims firmados del JWT.
2. **Entornos Limpios de Pruebas:** Los tests automáticos de CI/CD siempre se ejecutan en entornos limpios donde las sesiones se crean e invalidan de forma atómica en el mismo ciclo, por lo que nunca se simulan actualizaciones de versión del cliente sobre estados persistidos viejos.

## 4. ¿Qué cambiaremos para que nunca vuelva a ocurrir? (Prevention Plan)
1. **Estrategia de Autocuración (Self-Healing Session):** Implementar en el arranque un chequeo cruzado: si el JWT decodificado tiene un `hogarId` que difiere del guardado en el objeto `user`, el cliente debe regenerar el objeto `user` local con el valor del JWT y persistir la corrección.
2. **Estrategia de Actualización del Service Worker:** Modificar el ciclo de vida del Service Worker para forzar la toma de control inmediata de los clientes activos al detectar una nueva versión, reduciendo la ventana de ejecución de código obsoleto.
3. **Invalidación Activa en Colisiones de Dominio (400/409):** Si el servidor informa que el hogar ya existe, el cliente debe interpretar esto como un éxito de creación persistida y sanear su almacenamiento local actualizándolo con los claims del token en lugar de quedarse bloqueado.
