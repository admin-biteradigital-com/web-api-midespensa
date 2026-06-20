# 62_organizational_context_deployment.md — Contexto Organizacional y de Despliegue

> [!WARNING]
> **ESTADO DE REFERENCIA:** Este documento ha sido auditado y alineado con el contexto de la nueva organización. La versión canónica y oficial de la arquitectura se detalla en [67_final_architecture_canonical_model.md](file:///d:/Desarrollos/web-api-midespensa/67_final_architecture_canonical_model.md).

Este documento establece la capa formal de identidad corporativa, gobernanza organizacional e implicaciones de direccionamiento de red para la plataforma **Mi Despensa**, propiedad de **Bitera Digital SAS**.

---

## 1. Identidad de la Organización y Clasificación

*   **Organización Propietaria:** **Bitera Digital SAS**
*   **Sitio Web Corporativo:** [biteradigital.com](https://biteradigital.com)
*   **Dominio de Despliegue del Sistema:** [midespensa.biteradigital.com](https://midespensa.biteradigital.com)
*   **Clasificación del Producto:** Producto corporativo en fase de implementación (pre-producción controlada).

---

## 2. Implicaciones Arquitectónicas Obligatorias

El alineamiento con la identidad corporativa de Bitera Digital introduce las siguientes restricciones técnicas de obligado cumplimiento en el código de la aplicación y la infraestructura del Edge:

### A. Identity & Branding Scope (Autenticación e Identidad)
1.  **Firma de Sesión (Issuer de JWT):**
    *   *Regla:* El campo `iss` (Issuer) en la carga útil de todos los tokens JWT generados por la API en el Edge Worker debe configurarse obligatoriamente con el valor exacto `https://midespensa.biteradigital.com`.
    *   *Control:* Los servicios de verificación de tokens en el middleware rechazarán cualquier JWT que contenga un emisor diferente.
2.  **Identidad de Emails (Magic Links):**
    *   *Regla:* Todos los correos de registro y login passwordless deben enviarse desde cuentas del dominio corporativo (ej. `no-reply@biteradigital.com` o `auth-midespensa@biteradigital.com`).
    *   *Enrutamiento:* Las URLs de redirección para completar el inicio de sesión (*callback*) deben construirse bajo el host canónico `https://midespensa.biteradigital.com/api/v1/auth/callback`.

### B. Deployment Boundary (Límites del Despliegue en Cloudflare)
1.  **Configuración de Rutas en Cloudflare (Routes):**
    *   Los entornos productivos del Worker se enrutan directamente a través de las DNS administradas por Bitera Digital en Cloudflare.
    *   *Configuración de Entornos:*
        *   *Producción:* `midespensa.biteradigital.com/*`
        *   *Staging:* `staging.midespensa.biteradigital.com/*`
2.  **Caché y Redirecciones:**
    *   Toda cabecera `Link` de preload o recursos de Service Worker en la PWA deben apuntar de forma relativa o explícitamente a subdominios de `biteradigital.com`.

### C. Security Scope (Cookies, CORS y CSP)
1.  **Alcance de Cookies de Sesión:**
    *   *Regla:* Las cookies de sesión HTTP-Only emitidas por la API deben restringir su alcance al subdominio del producto (`Domain=midespensa.biteradigital.com`) para evitar fugas de cookies hacia otros subdominios de la corporación.
    *   *Atributos de Cookie:* `Secure; HttpOnly; SameSite=Strict; Path=/; Domain=midespensa.biteradigital.com`.
2.  **Política de Intercambio de Recursos (CORS):**
    *   *Regla:* Los encabezados de respuesta `Access-Control-Allow-Origin` de la API solo permitirán peticiones provenientes de `https://midespensa.biteradigital.com` o subdominios internos de desarrollo autorizados en la configuración.
3.  **Política de Seguridad de Contenido (CSP):**
    *   *Regla:* La directiva `connect-src` de la PWA debe limitarse exclusivamente a la API del producto y a dominios autorizados de telemetría corporativa:
        ```http
        Content-Security-Policy: default-src 'self'; connect-src 'self' https://midespensa.biteradigital.com https://staging.midespensa.biteradigital.com;
        ```
