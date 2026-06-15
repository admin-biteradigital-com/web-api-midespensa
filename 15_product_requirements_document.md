# Product Requirements Document (PRD) - Mi Despensa

Este documento consolida la definición del producto, problemas a resolver y las restricciones estratégicas de la plataforma **Mi Despensa**.

---

## 1. Objetivo del Producto
Construir una plataforma móvil/web colaborativa que sirva como la fuente única de verdad sobre el inventario, consumo y fluctuaciones de precios en la gestión del hogar, permitiendo reducir el desperdicio y optimizar el gasto de compras familiares.

## 2. Propuesta de Valor
*   **Visibilidad colectiva inmediata:** Todo miembro del hogar conoce lo disponible al instante, eliminando llamadas de consulta o compras redundantes.
*   **Gestión proactiva:** Alertas inteligentes de caducidad y sugerencia de reposición dinámica basada en datos reales históricos.
*   **Optimización del bolsillo:** Tracking histórico de precios por producto, permitiendo identificar variaciones y elegir el mejor punto de compra.

## 3. Personas y Problemas a Resolver
*   **Responsable de Compras (Sofía):** Pierde entre un 15% y 25% de presupuesto mensual debido a alimentos vencidos en la alacena y compras duplicadas por falta de comunicación.
*   **Consumidor Familiar (Martín):** Consume insumos clave y olvida registrarlos o avisar a la familia, rompiendo la cadena de reabastecimiento y causando desabastecimiento de insumos básicos.

## 4. Casos de Uso Prioritarios para el MVP
*   **UC-01:** Creación de perfil de Hogar y envío de enlace de invitación seguro.
*   **UC-02:** Alta, edición y decremento rápido (`-1`) de stock de productos desde un dashboard central.
*   **UC-03:** Generación automática de lista de compras en base al umbral de stock mínimo.

## 5. Restricciones
*   **Infraestructura:** Límite operativo inicial de presupuesto cero (operación estricta dentro del Free Tier de Cloudflare).
*   **Tecnológica:** Desarrollo basado en PWA (Progressive Web Application) para evitar los costos y tiempos de publicación en App Store y Google Play.
