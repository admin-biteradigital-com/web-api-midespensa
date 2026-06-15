# BCMS Blueprint (ISO 22301) - Mi Despensa

Plan de continuidad de negocio y recuperación ante desastres adaptado a la arquitectura distribuida serverless de **Mi Despensa**.

---

## 1. Business Impact Analysis (BIA)

Identificación de los impactos ante la caída o indisponibilidad de la infraestructura del Edge:

| Proceso Crítico | Dependencia Técnica | Impacto Financiero | RTO | RPO |
| :--- | :--- | :--- | :--- | :--- |
| **Monitoreo de Stock en Hogar** | Cloudflare Workers & D1 | Bajo (Aplicación B2C gratuita) | 4 Horas | 24 Horas |
| **Sincronización Offline** | IndexedDB Local (Cliente) | Nulo (Opera de manera local) | 0 Horas | 0 Horas |
| **Autenticación (Magic Link)**| Proveedor SMTP/API e-mail | Bajo | 12 Horas| 1 Hora |

---

## 2. Estrategias de Recuperación y Resiliencia

### 2.1. Contingencia del Almacenamiento Local (PWA)
En caso de interrupción global de la API de Cloudflare, la PWA cliente cambia automáticamente a **Modo Degradado**. Los usuarios pueden seguir consultando la despensa con la última lectura de datos local y guardar consumos en IndexedDB. Al retornar el servicio de API, las operaciones se consolidan.

### 2.2. Respaldo de Base de Datos D1
Un worker cron automatizado extrae de forma diaria un volcado SQL de la base de datos D1 (`d1 export`) y lo almacena de manera cifrada en un bucket R2 redundante ubicado en una zona geográfica distinta a la base D1 principal.
