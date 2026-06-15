# Security Validation Framework - Mi Despensa

Estructura de validación e inspección automatizada y manual de la seguridad física y lógica del código.

---

## 1. Niveles de Inspección de Seguridad

La validación se alinea con el estándar **OWASP ASVS (Application Security Verification Standard) Nivel 1** (aplicable a aplicaciones de consumo masivo):

```mermaid
graph TD
    Code[Código Fuente] -->|Inspección Estática SAST| SAST[Análisis de Vulnerabilidades]
    Code -->|Dependency Audit| Dependencies[Revisión de CVEs y Licencias]
    Despliegue[Build en Staging] -->|Inspección Dinámica DAST| DAST[Pruebas de Penetración de APIs]
    Despliegue -->|Secret Detection| Secrets[Escaneo de Keys expuestas]
```

### 1.1. Análisis Estático (SAST)
*   **Foco:** Escanear el código JavaScript/TypeScript de la API de Workers en busca de patrones vulnerables, inyecciones de parámetros y malas prácticas de tipado.

### 1.2. Detección de Secretos (Secret Detection)
*   **Foco:** Evitar la confirmación accidental de claves de Cloudflare, tokens de API de Resend o secretos de bases de datos en los repositorios Git.

### 1.3. Auditoría de Dependencias (Dependency Audit)
*   **Foco:** Inspeccionar que ningún paquete de npm importado contenga vulnerabilidades críticas (CVEs de severidad Alta o Crítica).
