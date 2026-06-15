# Registers & Decisions - Mi Despensa

Este documento actúa como la fuente única de verdad para el gobierno técnico y la gestión de riesgos de **Mi Despensa**.

---

## 1. Decision Log (Architecture Decision Records - ADR)

### ADR-01: Selección de Cloudflare Workers y D1 Database
*   **Estado:** Aprobado.
*   **Contexto:** Se requiere costo operativo inicial de cero dólares y latencia mínima para usuarios distribuidos.
*   **Decisión:** Utilizar Cloudflare Workers como runtime del backend, D1 como motor SQL transaccional SQLite, y Durable Objects para la capa en tiempo real.
*   **Consecuencias:**
    *   *Positivas:* Cumple con la restricción económica (Free Tier generoso), distribución global automática en más de 300 ciudades, inicio frío casi inexistente.
    *   *Negativas:* SQLite tiene limitaciones de concurrencia de escritura pesada en comparación con motores tradicionales (PostgreSQL), aunque es suficiente para la escala doméstica. Se introduce vendor lock-in relativo a Cloudflare, mitigado por el uso de estándares SQL y JS.

### ADR-02: Autenticación Passwordless mediante Magic Links
*   **Estado:** Aprobado.
*   **Contexto:** Los usuarios domésticos requieren registro rápido sin contraseñas difíciles de recordar. Además, almacenar hashes de contraseñas de forma segura añade complejidad y riesgo de brechas.
*   **Decisión:** Implementar autenticación passwordless enviando un token firmado de un solo uso vía e-mail.
*   **Consecuencias:**
    *   *Positivas:* Mayor seguridad (no hay contraseñas que robar), flujo de registro rápido.
    *   *Negativas:* Dependencia de un servicio de envío de correos electrónico externo (ej. Resend, Mailgun) que debe operarse bajo el Free Tier o bajo costo.

---

## 2. Risk Register (Matriz de Riesgos)

| ID | Riesgo | Probabilidad | Impacto | Nivel | Mitigación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Consumo de cuota del Free Tier:** El uso abusivo o escala rápida supera los límites gratuitos de Cloudflare (100k req/día). | Media | Media | **Medio** | Implementación de caché local (Cache API) y Service Workers para evitar llamadas repetidas de lectura a la API. |
| **R-02** | **Conflictos de Sincronización Offline:** Sobrescritura de datos al subir transacciones asíncronas concurrentes desde dos dispositivos desconectados. | Media | Alta | **Alto** | Algoritmo de resolución de conflictos basado en marcas de tiempo con lógica LWW (Last-Write-Wins) a nivel de fila y Durable Objects para secuenciación. |
| **R-03** | **Fuga de datos entre Hogares:** Acceso de un usuario a productos o información de un hogar al que no pertenece por fallos en API. | Baja | Crítica | **Alto** | Pruebas de integración automatizadas que verifiquen el aislamiento estricto de consultas SQL a nivel de base de datos D1. |

---

## 3. Assumptions Register (Registro de Supuestos)
*   **AS-01:** Se asume que el volumen de datos de inventario generado por una familia promedio no excederá los 100 MB por año en base de datos D1.
*   **AS-02:** Se asume que los dispositivos móviles de los usuarios cuentan con navegadores web modernos compatibles con Progressive Web Apps (PWA), Service Workers e IndexedDB (dispositivos fabricados en los últimos 7-8 años).
*   **AS-03:** Se asume que para el escaneo de códigos de barra el hardware de la cámara del dispositivo móvil tiene capacidades de autoenfoque básico para permitir la lectura correcta de imágenes.

---

## 4. Open Questions Register (Preguntas Abiertas)
*   **Q-01:** ¿Cómo se gestionará el catálogo inicial de códigos de barra de productos de consumo (EAN/UPC)? ¿Se integrará una API externa de catálogos abierta (ej. Open Food Facts) o se construirá una base colaborativa propia donde el primer usuario en escanear un producto nuevo debe ingresar el nombre?
*   **Q-02:** ¿Cuál es la estrategia recomendada para el proveedor de correos del servicio Magic Link en fase inicial para mantener el costo en cero (ej. plan gratuito de Resend con 3,000 envíos mensuales)?
