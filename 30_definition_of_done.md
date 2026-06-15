# Definition of Done (DoD) - Mi Despensa

Los criterios mínimos obligatorios que debe cumplir cualquier cambio funcional o historia de usuario antes de ser marcada como completada y promovida a la rama principal de producción (`main`).

---

## 1. Lista de Chequeo Obligatoria (DoD Checklist)

### 1.1. Calidad y Código
- [ ] El código pasa el análisis estático de linter sin advertencias ni errores.
- [ ] No se introducen dependencias redundantes; respeta el principio `Simplicity First`.

### 1.2. Pruebas Automáticas (Testing)
- [ ] Cobertura de pruebas unitarias superior al **85%** en la lógica de negocio modificada.
- [ ] Pruebas de integración añadidas para verificar que no ocurren fugas lógicas entre diferentes `hogar_id` (aislamiento multi-tenant).

### 1.3. Seguridad y Privacidad
- [ ] El cambio cumple con la política de mínimo privilegio (no expone endpoints sin validación JWT).
- [ ] No se registran datos personales sensibles de forma abierta en los logs de la aplicación.

### 1.4. Observabilidad y Auditoría
- [ ] Las operaciones de alteración de stock emiten el evento de dominio correspondiente al bus de eventos.
- [ ] Se añaden logs funcionales que registran el éxito o fracaso de la transacción en la API de Cloudflare Workers.

### 1.5. Documentación
- [ ] Cualquier alteración de tablas en base de datos D1 viene acompañada de su respectivo script de migración SQL documentado.
- [ ] Si la decisión de diseño cambia, se actualizan los ADR correspondientes.
