# 58_domain_integrity_rules.md — Reglas de Integridad del Dominio

Este documento define las reglas de consistencia de negocio e invariantes lógicas del dominio de **Mi Despensa** que deben respetarse en el código de la aplicación. Establece las prohibiciones y restricciones que impiden que el modelo operativo se degrade o sufra acoplamiento innecesario durante la fase de codificación.

---

## 1. Invariantes del Dominio y Reglas de Consistencia Obligatorias

El código del dominio debe proteger activamente las siguientes invariantes en runtime:

1.  **Invariante de Inventario No Negativo (ID-01):**
    *   *Regla:* La cantidad actual de cualquier producto en la despensa jamás puede ser menor a cero (`cantidad_actual >= 0`).
    *   *Control:* La clase o agregado `InventarioAggregate` debe lanzar una excepción de negocio si un comando de decremento intenta reducir el stock por debajo de cero.
    *   *Prohibición:* Queda prohibido delegar esta regla a restricciones de base de datos (ej. check constraints de SQLite). Debe ser validada y rechazada en la capa de software de dominio antes de generar consultas de persistencia.

2.  **Inmutabilidad del Historial de Cambios (ID-02):**
    *   *Regla:* Los eventos registrados en el historial de stock son inmutables y de tipo append-only.
    *   *Control:* No deben existir endpoints o funciones de base de datos que permitan sentencias `UPDATE` o `DELETE` sobre la tabla de eventos de stock (`eventos_stock`).
    *   *Prohibición:* Cualquier corrección de inventario debe realizarse ingresando un nuevo evento compensatorio con valor positivo o negativo.

3.  **Aislamiento y Consistencia de Agregados (ID-03):**
    *   *Regla:* Las modificaciones de estado dentro de un agregado solo pueden realizarse invocando métodos públicos en su Raíz de Agregado (*Aggregate Root*).
    *   *Control:* No se permite que entidades internas de un agregado expongan métodos de escritura directa que omitan las validaciones de la raíz.

---

## 2. Límites de Acoplamiento y Prohibiciones de Modelado Incorrecto

Para garantizar una arquitectura evolutiva y limpia de acoplamientos innecesarios, se definen los siguientes límites estrictos:

```
[Contexto de Hogar] --------(Solo por ID)-------> [Contexto de Inventario]
* No importar clases de Hogar                     * No realizar JOINs SQL cruzados
* No compartir entidades lógicas                  * Eventos de integración asíncronos
```

*   **Prohibición de Referencias Cruzadas de Objetos:** Las entidades pertenecientes al contexto de *Inventario* no pueden contener referencias en memoria a objetos o clases del contexto de *Hogar* o *Usuarios*. Toda comunicación entre contextos se realiza exclusivamente a través de referencias por identificador (`hogar_id` como un Value Object de tipo String) o mediante eventos de integración.
*   **Prohibición de Consultas SQL Cruzadas (Cross-Context JOINs):** Queda estrictamente prohibido realizar JOINs SQL entre tablas de diferentes contextos acotados en una única consulta de base de datos. Si el servicio de inventario requiere información del hogar, debe resolverla mediante llamadas a la API de identidad o a través de un modelo de lectura proyectado e independiente.
*   **Encapsulación de Lógica de Negocio:** No se permite que los controladores del Worker (capa de infraestructura HTTP) contengan lógica de decisión sobre el inventario. La lógica debe residir al 100% dentro de las clases del modelo de dominio.
