# Business Capabilities - Mi Despensa

Este documento identifica y mapea las capacidades de negocio (qué hace la plataforma para generar valor) organizadas por su nivel de madurez y sus dependencias técnicas y operativas.

---

## 1. Mapa de Capacidades de Negocio

```mermaid
graph TD
    subgraph Nivel 1: Transaccional (Actual)
        C_Inv[Gestión de Inventario]
        C_Colab[Colaboración Familiar]
        C_Lista[Planificación de Compras]
    end
    
    subgraph Nivel 2: Analítico (Corto Plazo)
        C_Fin[Historial Financiero de Precios]
        C_Venc[Gestión Inteligente de Vencimientos]
    end
    
    subgraph Nivel 3: Predictivo (Medio / Largo Plazo)
        C_Pred[Predicciones de Agotamiento]
        C_Int[Integración con Supermercados B2B]
    end

    C_Inv --> C_Lista
    C_Colab --> C_Inv
    C_Inv --> C_Venc
    C_Inv --> C_Fin
    C_Fin --> C_Pred
    C_Venc --> C_Pred
    C_Lista --> C_Int
```

---

## 2. Descripción de Capacidades

### 2.1. Gestión de Inventario (Nivel 1 - Core)
*   **Definición:** Capacidad de registrar, dar de baja, clasificar y auditar el stock físico de insumos alimenticios y de limpieza del hogar.
*   **Dependencia:** Identificación unívoca del Hogar (Multi-Tenancy).

### 2.2. Colaboración Familiar (Nivel 1 - Supporting)
*   **Definición:** Capacidad de compartir el estado del inventario y notificar cambios de manera instantánea entre múltiples usuarios concurrentes pertenecientes a un mismo hogar.
*   **Dependencia:** WebSocket / Canales de Sincronización Distribuidos.

### 2.3. Planificación de Compras (Nivel 1 - Supporting)
*   **Definición:** Capacidad de autogenerar una lista dinámica de ítems necesarios basada en las reglas de stock mínimo del inventario activo.
*   **Dependencia:** Gestión de Inventario.

### 2.4. Historial Financiero de Precios (Nivel 2 - Supporting)
*   **Definición:** Rastrear y consolidar la variación de costos de adquisición de los productos a lo largo del tiempo, clasificados por marca y comercio.
*   **Dependencia:** Registro de Compras.

### 2.5. Predicciones de Agotamiento (Nivel 3 - Core)
*   **Definición:** Capacidad analítica de predecir de forma autónoma cuándo un producto llegará a cero unidades basándose en la velocidad histórica de consumo familiar.
*   **Dependencia:** Historial Financiero de Precios + Gestión de Inventario.

---

## 3. Matriz de Dependencias Operativas

| Capacidad Requerida | Capacidad Bloqueante | Tipo de Bloqueo | Impacto en MVP |
| :--- | :--- | :--- | :--- |
| **Planificación de Compras** | Gestión de Inventario | Técnico / Funcional | Crítico (Ambas deben ir en MVP) |
| **Predicciones de Agotamiento**| Historial de Consumo | Datos (Requiere $>30$ días de datos) | Futuro (No bloquea MVP) |
| **Integración con Supermercados**| Planificación de Compras| API Externa | Futuro (No bloquea MVP) |
