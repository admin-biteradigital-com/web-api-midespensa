# Security Architecture - Mi Despensa

Especificación de los dominios de seguridad, límites de confianza y superficie de ataque del sistema.

---

## 1. Zonas de Seguridad y Límites de Confianza

Definimos tres zonas de seguridad principales basadas en el nivel de confianza y control de la infraestructura:

```mermaid
graph TD
    subgraph Zona 1: Cliente Insegura
        UI[Navegador/PWA Cliente]
    end
    
    subgraph Zona 2: Edge Intermedia (Cloudflare Edge)
        WAF[Cloudflare WAF / Rate Limiter]
        Worker[Workers API Router & Auth]
    end
    
    subgraph Zona 3: Datos de Alta Seguridad
        D1[(Cloudflare D1: SQLite)]
        R2[Cloudflare R2: Assets]
    end

    UI -->|Límite de Confianza A: API REST HTTP/JWT| WAF
    WAF --> Worker
    Worker -->|Límite de Confianza B: SQL RLS / API Interna| D1
    Worker -->|Límite de Confianza C: Credenciales S3 firmadas| R2
```

### 1.1. Límite de Confianza A (Client-to-Edge)
*   **Protocolo:** HTTPS obligando a TLS 1.3.
*   **Autenticación:** Token JWT firmado criptográficamente, portado en las cabeceras HTTP `Authorization: Bearer <JWT>`.

### 1.2. Límite de Confianza B (Worker-to-D1)
*   **Seguridad:** Aislamiento de base de datos relacional serverless. No se permite conectividad directa del cliente a D1. Toda sentencia SQL inyecta obligatoriamente el contexto de `hogar_id` extraído del JWT de la Zona 2.

---

## 2. Superficie de Ataque y Puntos de Entrada (Entry Points)
1.  **Endpoints Públicos de la API (REST):** `/api/v1/auth/login`, `/api/v1/auth/verify`. Puntos de entrada para intentos de denegación de servicio (DoS) y fuerza bruta.
2.  **Endpoints Protegidos de la API:** `/api/v1/hogar`, `/api/v1/inventario`. Vulnerables a escalada de privilegios horizontales (IDOR) si falla el control del token.
3.  **Carga de Imágenes (R2 Storage):** Entrada de archivos maliciosos. Mitigado mediante la no ejecución de scripts en R2 y la subida directa a través de URLs prefirmadas y limitadas en tamaño en la API del Worker.
