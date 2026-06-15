# Performance Validation Framework - Mi Despensa

Límites y metas cuantitativas para certificar la velocidad de la Progressive Web App y la API en el Edge.

---

## 1. Core Web Vitals (Métricas Objetivo)

El sistema de validación controlará que la plataforma cumpla con los siguientes límites en condiciones de red móvil simulada (Fast 3G / Moto G4 equivalente):

| Métrica | Definición | Target Excelente | Límite Máximo Aceptable |
| :--- | :--- | :--- | :--- |
| **TTFB** (Time to First Byte) | Tiempo en recibir la primera respuesta del servidor Edge. | $<50\text{ms}$ | $100\text{ms}$ |
| **LCP** (Largest Contentful Paint) | Carga visual de la pantalla principal de inventario. | $<1.5\text{s}$ | $2.5\text{s}$ |
| **INP** (Interaction to Next Paint) | Latencia percibida al presionar el botón de stock (`-1`). | $<50\text{ms}$ | $100\text{ms}$ |
| **CLS** (Cumulative Layout Shift) | Estabilidad visual (evita que los botones salten en carga). | $<0.05$ | $0.1$ |

---

## 2. Métricas de Sincronización
*   **Time to Sync (Offline -> Online):** Sincronización del lote acumulado de transacciones locales menor a **$1.5\text{ segundos}$** en conexiones con ancho de banda de red limitado ($256\text{ Kbps}$ de subida).
