# Accessibility Framework - Mi Despensa

Especificación del diseño de accesibilidad para asegurar que **Mi Despensa** sea usable por cualquier persona, bajo el estándar internacional **WCAG 2.2 Nivel AA**.

---

## 1. Directrices Obligatorias de Accesibilidad

Para evitar barreras de uso en dispositivos móviles, se estructuran los siguientes lineamientos de diseño de interfaz (UI):

*   **Navegación por Teclado Completa:** Todos los elementos interactivos de la PWA (botones de stock, campos de formulario) deben poseer un estado visual de foco perceptible (`:focus-visible`) y ser operables mediante el uso de la tecla `Tab` y la barra espaciadora o `Enter`.
*   **Contraste de Color:** El contraste de los textos y botones con respecto al fondo debe respetar una relación de contraste mínima de **4.5:1** para texto normal y **3:1** para texto grande, alineado con las pautas de WCAG AA.
*   **Compatibilidad con Lectores de Pantalla:** Uso estricto de elementos HTML5 semánticos (ej. `<main>`, `<nav>`, `<button>`). Todos los botones de decremento rápido (`-1`) deben poseer etiquetas descriptivas `aria-label` dinámicas (ej. `aria-label="Restar una unidad de Leche Conaprole"`).
*   **Target de Área Táctil:** En pantallas táctiles móviles, los elementos de interacción rápida deben poseer un tamaño mínimo de **$48 \times 48\text{ px}$** para evitar errores de pulsación y facilitar el uso a personas con temblores o capacidades reducidas.
