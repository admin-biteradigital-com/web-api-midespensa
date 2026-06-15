# Software Requirements Specification (SRS) - Mi Despensa

## 1. Clasificación MoSCoW de Requerimientos

### 1.1. Must Have (Crítico para el MVP)
*   **RF-01 (Multi-Tenancy Familiar):** Los usuarios deben poder unirse o crear un "Hogar" mediante un código de invitación único. Los datos deben estar estrictamente aislados por Hogar.
*   **RF-02 (Gestión de Stock Básica):** Incrementar, decrementar, editar y eliminar productos del inventario del Hogar de forma colaborativa y en tiempo real.
*   **RF-03 (Almacenamiento Local Offline):** La PWA debe permitir registrar consumos o adiciones en local (IndexedDB) sin conexión a internet, sincronizándose en background cuando retorne la red.
*   **RF-04 (Lista de Compras Colaborativa):** Generación automática de ítems faltantes basada en umbrales de stock mínimo configurables por producto.
*   **RF-05 (Autenticación Segura):** Autenticación mediante Passwordless (Magic Links) o Proveedores OAuth (Google/Apple) para evitar almacenamiento complejo de contraseñas y simplificar la experiencia de usuario.

### 1.2. Should Have (Importancia Alta)
*   **RF-06 (Escáner de Código de Barras):** Uso de la cámara del dispositivo móvil mediante API de lectura de código de barras nativa de la PWA para identificar y autocompletar productos.
*   **RF-07 (Control de Fechas de Vencimiento):** Notificaciones y alertas visuales dentro de la aplicación ordenadas por proximidad de caducidad.
*   **RF-08 (Registro de Precios e Historial):** Capturar el precio de compra unitario para mostrar estadísticas históricas de fluctuación de costos de cada artículo.

### 1.3. Could Have (Deseable)
*   **RF-09 (Asociación de Fotografías):** Permitir tomar una foto del producto y almacenarla en almacenamiento de objetos (Cloudflare R2) para validación visual rápida.
*   **RF-10 (Reportes de Consumo Semanales):** Gráficos interactivos de tendencias de gasto y rotación de insumos alimenticios.

### 1.4. Won't Have (Futuras Fases)
*   **RF-11 (OCR de Tickets Completo):** Digitalización de facturas de supermercado mediante IA.
*   **RF-12 (Integración Transaccional con Supermercados):** Pasarelas para efectuar la compra directamente desde la app.

---

## 2. Historias de Usuario (User Stories)

### US-01: Registro Colaborativo de Consumo (RF-02)
> **Como** miembro de la familia,
> **Quiero** disminuir en una unidad la leche desde la pantalla principal de la app con un solo tap,
> **Para que** todos en mi casa sepan que queda una unidad menos y se actualice la lista de compras inmediatamente si corresponde.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Disminución de stock exitosa en tiempo real
  Dado que el usuario Martín está autenticado en el Hogar "Familia Gómez"
  Y el producto "Leche Entera Conaprole 1L" tiene un stock de 2 unidades
  Cuando Martín presiona el botón de decremento rápido (-1)
  Entonces el stock de "Leche Entera Conaprole 1L" se actualiza a 1 unidad en la base de datos
  Y la pantalla de Sofía (otro miembro activo en el mismo Hogar) se actualiza visualmente a 1 unidad sin recargar la página.
```

### US-02: Funcionamiento Offline en Alacena sin Señal (RF-03)
> **Como** usuario que tiene la alacena en un sótano o rincón sin cobertura celular,
> **Quiero** poder registrar que saqué un paquete de pasta del inventario,
> **Para que** el cambio quede guardado localmente y no pierda la información del inventario.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Registro de consumo sin conexión a internet
  Dado que la aplicación se encuentra en modo Offline (sin conectividad a internet)
  Cuando el usuario registra la baja de 1 unidad de "Fideos Adria 500g"
  Entonces la aplicación guarda la transacción localmente en IndexedDB
  Y muestra un indicador visual de "Cambio pendiente de sincronización"
  Y cuando la conexión a internet retorna, la aplicación sube automáticamente la transacción al servidor, actualizando el stock global.
```

---

## 3. Reglas de Negocio (Business Rules)
*   **RN-01 (Umbral de Alerta de Vencimiento):** Un producto entra en estado de "Próximo a Vencer" cuando su fecha de caducidad está a menos de 3 días de la fecha actual para productos frescos, y a menos de 10 días para productos no perecederos.
*   **RN-02 (Cálculo Automático de Lista de Compras):** Si $Stock\_Actual \le Stock\_Minimo$, el sistema agregará el producto a la Lista de Compras con estado "Pendiente" e indicará la cantidad a comprar calculada como $Stock\_Deseado - Stock\_Actual$.
*   **RN-03 (Acceso a Datos Familiar):** Los integrantes de un Hogar tienen permisos de lectura y escritura completos sobre el inventario. Solo el "Creador" del Hogar (Rol Administrador) puede eliminar el Hogar o revocar accesos a miembros.
