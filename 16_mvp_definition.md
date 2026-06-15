# MVP Definition - Mi Despensa

Este documento define el alcance estricto del Mínimo Producto Viable (MVP) para **Mi Despensa**, determinando el alcance necesario para validar la propuesta de valor con familias reales.

---

## 1. El MVP Mínimo que Genera Valor Real para una Familia

El valor mínimo para una familia no es la predicción inteligente de datos ni el escaneo de tickets. Es la **sincronización simple y fluida del inventario doméstico básico**.

> **Definición del MVP:** Una PWA compartida donde cualquier miembro de la familia pueda ver qué hay en la alacena y presionar un botón para registrar que se consumió un producto, actualizando la lista de compras del hogar de forma automática y en tiempo real.

---

## 2. Funcionalidades Obligatorias (Dentro del MVP)

*   **Autenticación Passwordless (Magic Link):** Para evitar la fricción de recordar contraseñas en pantallas móviles.
*   **Gestión de Inventario Colaborativo en Tiempo Real:** Base de datos D1 + Durable Objects para actualización instantánea multijugador.
*   **Lista de Compras Automatizada:** Lógica relacional reactiva: cuando el stock actual cae por debajo del mínimo configurado, el ítem se agrega a la lista de compras del Hogar de forma autónoma.
*   **Capacidad de Operación Offline Básica:** Resiliencia ante caídas de conexión a internet o sótanos mediante IndexedDB local.

---

## 3. Funcionalidades Excluidas (Fuera del MVP)

*   **Escáner de código de barras nativo:** Reemplazado en el MVP por un autocompletado inteligente y búsqueda por texto.
*   **Carga de imágenes a Cloudflare R2:** Reemplazada en el MVP por el uso de emojis o iconos por categoría para minimizar el consumo de almacenamiento y agilizar el desarrollo.
*   **Predicciones con Inteligencia Artificial:** Reemplazada por lógica heurística simple basada en umbrales de stock estáticos y fechas explícitas de vencimiento.

---

## 4. Riesgos de Exclusión

*   **Riesgo de Fricción de Datos:** Al no contar con escáner de código de barras en la primera versión, el usuario debe escribir los nombres de los productos manualmente. Esto puede generar fatiga de carga inicial.
*   **Mitigación:** Proveer un catálogo inicial pre-cargado con los 50 productos más comunes del hogar (leche, huevos, arroz, etc.) para que agregarlos sea un asunto de un solo tap.
