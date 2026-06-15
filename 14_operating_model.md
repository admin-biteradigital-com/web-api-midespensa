# Operating Model & Data Lifecycle - Mi Despensa

Este documento define la dinámica operativa diaria de **Mi Despensa**, determinando las fuentes de verdad y la taxonomía del ciclo de vida de los datos de consumo e inventario.

---

## 1. Fuentes de Verdad del Sistema (Source of Truth)

Para evitar inconsistencias y diseñar un sistema robusto, clasificamos las fuentes y sistemas bajo la terminología de arquitectura enterprise:

*   **Source of Truth (Fuente de Verdad de Origen):** Los **Eventos Históricos de Modificación** (`StockDecrementado`, `CompraCompletada`). El estado del stock actual es una proyección matemática calculada a partir de la suma de estos eventos agregados.
*   **System of Record (Sistema de Registro):** **Cloudflare D1**. La base relacional que persiste la bitácora inmutable de transacciones e históricos del Hogar.
*   **Systems of Engagement (Sistemas de Interacción):** La **PWA móvil** e interfaces cliente, sincronizadas a través del canal en tiempo real de **Durable Objects**.
*   **Systems of Insight (Sistemas de Inteligencia):** El motor asíncrono analítico (proyectado a ejecutarse en Workers AI / Batch Jobs) que analiza el comportamiento y proyecta las compras futuras basándose en los datos históricos del System of Record.

---

## 2. Taxonomía y Ciclo de Vida de los Datos

| Categoría de Datos | Ejemplo | Destino de Persistencia | Ciclo de Vida / Retención | ¿Se puede reconstruir? |
| :--- | :--- | :--- | :--- | :--- |
| **Datos Transaccionales** | `Stock actual = 2` | Durable Objects (RAM) / D1 | Efímero / Variable. | **Sí**, sumando ingresos y restando consumos históricos. |
| **Datos Históricos (Activo)** | `Martín consumió 1 leche a las 08:00` | D1 (Tablas de bitácora Append-Only) | **Para siempre** (o hasta que el Hogar ejerza Derecho al Olvido). | **No**, su pérdida es irreparable para el modelo predictivo. |
| **Datos Analíticos / Derivados** | `Promedio de consumo: 2.1 lts/semana` | D1 cache tables / LocalStorage | Temporal (Recalculado mensualmente). | **Sí**, procesando el histórico de consumo. |
| **Assets Binarios** | Foto del producto | Cloudflare R2 | Hasta la baja del producto del catálogo. | **No**, requiere re-carga física por el usuario. |

---

## 3. Flujos Operativos Principales y Excepcionales

```mermaid
graph TD
    subgraph Flujo Diario (Online)
        Step1[Usuario consume producto] --> Step2[API Worker recibe comando]
        Step2 --> Step3[Registrar Evento Histórico en D1]
        Step3 --> Step4[Emitir evento WebSocket vía Durable Object]
        Step4 --> Step5[Pantallas del Hogar actualizadas]
    end
```

### 3.1. Flujo Excepcional: Resolución de Conflictos Offline
1.  **Contexto:** El usuario A (offline) consume un chocolate. El usuario B (offline) consume el mismo chocolate a la misma hora en otra habitación.
2.  **Conflicto:** Dos bajas registradas concurrentemente sobre la misma unidad en IndexedDB local.
3.  **Resolución (Event Sourcing / LWW):** Al recuperar la conexión, el cliente envía dos comandos individuales: `RegistrarConsumo(id: A, timestamp: t1)` y `RegistrarConsumo(id: B, timestamp: t2)`. La base de datos D1 procesa ambos eventos secuencialmente en orden de llegada, reduciendo el stock en $2$ unidades acumuladas de manera correcta. Esto demuestra que **guardar los eventos históricos individuales en lugar del estado final evita la pérdida de consistencia**.

---

## 4. Evaluación Formal del Uso de Event Sourcing

*   **Beneficios:**
    *   Preserva el activo principal (Conocimiento histórico familiar inalterado).
    *   Auditoría completa de comportamientos del hogar para análisis predictivo avanzado.
    *   Sincronización offline natural y libre de conflictos complejos.
*   **Costos y Complejidad:**
    *   Requiere mayor capacidad de almacenamiento en base de datos D1 (SQLite) al guardar cada transacción individual.
    *   Obliga a computar proyecciones para mostrar el "Stock Actual" en pantalla, lo que puede elevar las lecturas en D1 si no se almacena en caché un estado consolidado.
*   **Compatibilidad con Cloudflare y Presupuesto Cero:**
    *   **Altamente compatible.** El almacenamiento de D1 de 5 GB es suficiente para albergar millones de eventos de texto plano para miles de hogares. Se puede diseñar un esquema híbrido: el estado consolidado se guarda en D1 para lecturas rápidas (`DashboardInventarioView`), y los eventos históricos se registran concurrentemente en tablas anexas de auditoría inmutable.
