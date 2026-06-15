# Product Vision, Scope & Context - Mi Despensa

## 1. Product Vision Statement
Para los hogares que buscan optimizar su presupuesto y reducir el desperdicio de alimentos, **Mi Despensa** es una plataforma colaborativa de gestión de inventario doméstico en tiempo real. A diferencia de las hojas de cálculo manuales o aplicaciones individuales no compartidas, nuestro producto permite a todos los miembros de la familia registrar compras, consumos y vencimientos de forma instantánea, automatizando la lista de compras mediante analítica predictiva del consumo, con costos operativos mínimos de infraestructura.

---

## 2. Business Context
El desperdicio de alimentos en los hogares representa una pérdida financiera directa de aproximadamente el 15-25% de la compra mensual, sumado al impacto ecológico y ético. La falta de comunicación entre miembros del hogar genera compras duplicadas o el olvido de productos que terminan venciendo en el fondo de las alacenas. 

**Mi Despensa** ataca esta problemática introduciendo una bitácora digital colectiva. Aunque el modelo inicial es B2C y gratuito, la arquitectura de datos y el modelo multi-tenant se diseñan pensando en futuras monetizaciones (B2B2C):
*   Suscripciones Premium familiares (mayor almacenamiento de fotos, predicciones avanzadas con LLMs ligeros en el Edge).
*   Canales de integración con supermercados para compra directa con un solo clic.
*   Datos agregados y anonimizados de consumo para marcas de consumo masivo (*FMCG*).

---

## 3. Product Scope

### 3.1. Alcance Inicial (MVP)
*   **Gestión Multi-Usuario por Hogar:** Creación de un "Hogar" (Tenant) e invitación a miembros de la familia con sincronización en tiempo real.
*   **Inventario Compartido:** Alta, baja y modificación de productos (nombre, categoría, cantidad actual, stock mínimo, fecha de vencimiento).
*   **Escáner de Código de Barras Móvil:** Identificación rápida utilizando la cámara del dispositivo móvil para buscar en un catálogo interno pre-cargado.
*   **Lista de Compras Automática:** Generación dinámica de la lista de reposición cuando el stock actual cae por debajo del stock mínimo.
*   **Registro Básico de Precios:** Introducción del costo de adquisición por producto para rastrear el gasto de la compra.

### 3.2. Alcance Futuro (Evolución Estratégica)
*   **Inteligencia y Predicción de Consumo:** Algoritmos en el Edge que estiman el tiempo medio de consumo de un producto (ej. "la leche se agotará en 3 días") y sugieren compras preventivas.
*   **Integración B2B con Supermercados:** Sincronización de la lista de compras directamente con el carrito de e-commerce de supermercados locales para delivery automatizado.
*   **OCR de Tickets de Compra:** Escaneo de la factura física del supermercado para cargar automáticamente decenas de productos al inventario mediante visión por computadora en el cliente o Edge.

---

## 4. User Personas

### Persona 1: Sofía - La Gestora Organizada (Responsable de Compras)
*   **Rol:** Administradora del hogar.
*   **Necesidad:** Minimizar el gasto mensual en comida y planificar los menús semanales de sus 4 integrantes familiares sin tener que revisar físicamente el refrigerador cada vez.
*   **Frustración:** Comprar productos que ya estaban en la despensa o tirar comida vencida porque quedó oculta en los estantes.

### Persona 2: Martín - El Consumidor Familiar (Miembro del Hogar)
*   **Rol:** Consumidor / Hijo o Pareja.
*   **Necesidad:** Informar rápidamente cuando consume el último paquete de un producto para que se añada a la lista de compras de forma transparente.
*   **Frustración:** Tener que escribir un mensaje de texto a Sofía cada vez que se termina algo, u olvidar avisar por completo.

---

## 5. Casos de Uso Principales

```mermaid
usecaseDiagram
    actor "Miembro del Hogar" as User
    actor "Administrador Familiar" as Admin
    
    usecase "Crear Hogar e Invitar Miembros" as UC1
    usecase "Registrar Producto (Escaneo/Manual)" as UC2
    usecase "Actualizar Consumo (Restar Stock)" as UC3
    usecase "Consultar Lista de Compras Dinámica" as UC4
    usecase "Registrar Alerta de Vencimiento" as UC5
    
    User --> UC2
    User --> UC3
    User --> UC4
    
    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
```

### UC-01: Registro y Sincronización de Consumo
*   **Actor:** Miembro del Hogar.
*   **Flujo Principal:** El usuario consume un cartón de leche. Abre la PWA en su celular, escanea el código de barras del envase o presiona el botón rápido de restar `-1` en el dashboard del inventario. El sistema reduce el stock en la base de datos distribuida y propaga instantáneamente el cambio a las pantallas de los demás miembros de la familia que estén visualizando la app en ese momento.

### UC-02: Generación Automatizada de Lista de Compras
*   **Actor:** Responsable de Compras.
*   **Flujo Principal:** Al reducirse el stock del cartón de leche a 0 (por debajo de su stock mínimo de 2 unidades), el sistema inserta el ítem de forma autónoma en la lista de compras del Hogar, detallando el precio promedio histórico registrado del producto para estimar el costo de reposición.
