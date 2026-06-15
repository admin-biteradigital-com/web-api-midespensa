# Canonical System Architecture Summary (Sprint 0)

This document presents a unified, coherent, and simplified summary of the system architecture for **Mi Despensa** as established for the Sprint 0 MVP.

## 1. Topología del Sistema (Edge-First)

El sistema reemplaza servidores tradicionales y bases de datos centralizadas por una infraestructura distribuida de baja latencia operando en la red Edge de Cloudflare:

```
[Cliente PWA] <---(HTTP / JSON)---> [Cloudflare Worker API] <---> [Cloudflare D1 (SQLite)]
     |                                                                   |
     +---(Offline-First Cache) ---> [IndexedDB Local Store] <------------+
```

## 2. Componentes e Infraestructura

* **Cloudflare Workers:** Enrutamiento principal, ejecución de reglas de negocio, cifrado de datos sensibles en tránsito y autenticación.
* **Cloudflare D1 (SQLite):** Persistencia relacional de base de datos.
* **IndexedDB (Cliente):** Almacén no volátil en el navegador móvil para stock local y cola de transacciones offline.
* **PWA Frontend:** Interfaz de usuario Single Page Application (SPA) responsiva con un Service Worker que cachea los assets estáticos.

## 3. Modelo de Sincronización (Event Sourcing Híbrido)

* **Source of Truth:** El log inmutable y append-only en la tabla `events_stock` que registra cada cambio individual (+X, -X) y su contexto.
* **Materialized View:** La tabla `inventario` almacena el stock consolidado para lecturas ultra rápidas en el dashboard.
* **Sincronización:** Eventual a través de llamadas HTTP push/pull. Si ocurre un cambio offline, este se encola localmente en IndexedDB y se sincroniza al recuperar la conexión mediante el algoritmo Last-Write-Wins (LWW) basado en marcas de tiempo.

## 4. Límites de Seguridad & Privacidad (TEL & PII)

* **TEL (Query Gate):** Aislamiento de hogares implementado mediante validación en runtime. Toda sentencia SQL a D1 debe pasar a través del Query Gate inyectando obligatoriamente `hogar_id` (fail-closed).
* **PII Protection:** El correo electrónico real se almacena cifrado con AES-GCM en `email_encrypted`. La búsqueda única de usuarios se realiza mediante el hash SHA-256 almacenado en `email` (Identity Key), desacoplando la identidad directa del resto de datos del dominio en D1.
