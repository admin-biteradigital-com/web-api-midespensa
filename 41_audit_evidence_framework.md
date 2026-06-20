# Audit Evidence Framework - Mi Despensa

> [!WARNING]
> **ESTADO DE REFERENCIA:** Este documento ha sido auditado y contiene especificaciones de infraestructura obsoletas (como el uso obligatorio de Cloudflare Logpush en el MVP). El sistema de logs se rige por la abstracción **Audit Evidence Provider** utilizando la base de datos D1 (`D1 Audit Trail` en tabla `auditoria_legal`) y se detalla en [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md).

Especificación de los registros, logs y evidencias técnicas inalterables requeridas para auditorías de cumplimiento ISO 27001, 27701 e inspecciones de protección de datos personales.

---

## 1. Evidencias de Seguridad y Auditoría

La recolección de evidencias sigue el principio de **no repudiación** y se registra de forma automatizada en el Edge.

| Tipo de Evidencia | Origen del Log | Destino del Registro | Retención Obligatoria |
| :--- | :--- | :--- | :--- |
| **Acceso a Datos L4 (Sensibles)** | Worker Access logs | Cloudflare Logpush (Cifrado) | 180 días |
| **Aceptación de Términos y Privacidad**| Endpoint de Registro | D1 (Tabla `auditoria_legal`) | Vida activa del Hogar + 2 años |
| **Peticiones de Eliminación (ARCO)** | Worker de Borrado | D1 (Tabla `auditoria_legal`) | 5 años (Registro de purga) |
| **Historial de Modificación de Esquema**| D1 Migration CLI | Archivo `migrations` Git | Indefinido |

---

## 2. Inmutabilidad de los Logs de Acceso
Los logs de acceso del WAF de Cloudflare y llamadas a la API de Workers se envían a través de **Cloudflare Logpush** hacia un bucket R2 con políticas de solo apéndice (*append-only*) y bloqueo de borrado de objetos durante el periodo de retención obligatorio, impidiendo la manipulación de pistas de auditoría por usuarios o administradores del sistema.
