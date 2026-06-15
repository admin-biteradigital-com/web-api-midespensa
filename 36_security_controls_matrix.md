# Security Controls Matrix - Mi Despensa

Mapeo de los controles técnicos y lógicos que resuelven las amenazas de seguridad, vinculados a los estándares de cumplimiento internacional.

---

## 1. Matriz de Controles Técnicos

| ID Control | Amenaza Mitigada | Descripción del Control Técnico | Norma / Requisito Asociado |
| :--- | :--- | :--- | :--- |
| **CS-01** | Spoofing / Suplantación | Magic Link firmado con validez de 10 min y un solo uso enlazado a la sesión IP. | ISO 27001 (A.8.5) / GDPR Art 32 |
| **CS-02** | Tampering / Inyecciones | Sentencias preparadas SQLite obligatorias y esquema Zod de tipos en el Worker. | OWASP ASVS V5 (SQL Injection) |
| **CS-03** | Information Disclosure | Inyección forzosa de `hogar_id` en WHERE SQL en el Worker desde JWT verificado. | ISO 27001 (A.8.2) / Ley 18.331 Art 9 |
| **CS-04** | Denial of Service (DoS) | Cloudflare Rate Limiting (máx 60 req/min por IP) y Cloudflare WAF. | ISO 27001 (A.8.20) / ISO 22301 |
| **CS-05** | Compromiso de Ficheros | URLs prefirmadas de R2 de solo escritura limitadas en tamaño ($<1\text{MB}$) y sin permisos de ejecución. | ISO 27001 (A.8.12) / OWASP ASVS |

---

## 2. Trazabilidad con Marcos de Cumplimiento

*   **GDPR (Art 25 - Privacy by Design):** Soportado mediante la pseudonimización del identificador de usuario `user_id` respecto de su e-mail directo en las tablas de bitácoras e inventario.
*   **Ley 18.331 Uruguay (Art 9 - Principio de Seguridad):** Cumplido por el cifrado AES-256 en reposo nativo de la infraestructura de base de datos Cloudflare D1.
