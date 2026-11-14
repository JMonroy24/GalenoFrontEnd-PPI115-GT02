# GalenoSV — Cliente Frontend (GalenoFE)

Cliente web frontend para el sistema de gestión clínica **GalenoSV**, desarrollado para la asignatura *Programación para Internet (PPI115, Ciclo II-2026, FMOcc-UES)*.

La aplicación opera como una **Progressive Web Application (PWA)** y **Single Page Application (SPA)** construida exclusivamente con **ECMAScript (ES6+) nativo** y **Web Components de autoría propia** (Custom Elements con Shadow DOM y `<slot>`), sin frameworks (React, Angular, Vue), librerías auxiliares ni hojas de estilo externas.

---

## 🏛️ Arquitectura: Boundary-Control-Entity (BCE)

El proyecto mantiene un desacoplamiento estricto bajo el patrón BCE:

- **Boundary (`src/js/boundary/`)**:
  - **Vistas**: `busqueda_citas_view.js` (#buscar-citas), `login_view.js` (#login), `dashboard_view.js` (#dashboard), `atencion_consulta_view.js` (#atencion/<id>).
  - **Componentes**: `stepper_progreso.js`, `autocomplete_cie10.js`, `lista_examenes.js`, `historial_pasos.js`, `tarjeta_consulta.js`, `asistente_busqueda.js`, `estado_red.js`, `notificacion_emergente.js`, `encabezado_app.js`, `menu_lateral.js`, `pie_app.js`.
- **Control (`src/js/control/`)**:
  - `default_service.js`: Cliente HTTP base asíncrono (`async/await`) con interceptores para errores HTTP (401, 403, 412, 422, 428), inyección automática de tokens Bearer y control de timeout.
  - Servicios especializados: `consulta_service.js`, `auth_service.js`, `persona_service.js`, `orden_examen_service.js`, `clinica_service.js`, `cie10_service.js`, etc.
  - `router.js`: Enrutador SPA nativo por hash con guardias de sesión activas.
  - `store.js`: Almacén de estado reactivo global desacoplado basado en `EventTarget`.
- **Entity (`src/js/entity/`)**:
  - `default_response.js`: Estructura unificada para respuestas paginadas (`items`, `total`, `first`, `max`).
  - `default_error.js`: Excepción tipada para fallos HTTP con metadatos de status y detalles del servidor.

### 🛡️ Criterio de Cero Librerías de Terceros en Producción

El código fuente de producción contenido íntegramente en el directorio `src/` está implementado al **100% con JavaScript nativo (ES6+), Web Components nativos (Custom Elements y Shadow DOM) y CSS estándar**, sin dependencia de librerías ni frameworks de terceros (cero React, Vue, Angular, Bootstrap, Tailwind o Axios).

Las herramientas ubicadas en el directorio `test/lib/` (**Mocha**, **Chai**, **Sinon**) corresponden **exclusivamente a utilidades de prueba en navegador para la ejecución de la suite de pruebas unitarias TDD e integración BDD** en los runners de prueba (`test/runner.html` y `test/runner_it.html`). **Bajo ninguna circunstancia forman parte ni se empaquetan en el código fuente de producción en `src/`**, cumpliendo a cabalidad con el criterio evaluativo de *Cero librerías de terceros en código de producción*.

---

## 📋 Requisitos Previos

1. **Navegador web moderno**: Google Chrome, Brave, Microsoft Edge o Mozilla Firefox.
2. **Servidor web estático local**: `browser-sync`, `python3` o la extensión *Live Server* de Visual Studio Code.
3. **Backend Jakarta EE**: Open Liberty en ejecución en `http://localhost:9080/galenoSV/resources/v1` (respaldado por PostgreSQL).

---

## 🚀 Puesta en Marcha

### 1. Iniciar el servidor estático

Desde la raíz del repositorio (`GalenoFrontEnd-PPI115-GT02`):

#### Opción A — Browser-Sync (Recomendada):
```bash
# Servir la aplicación cliente
browser-sync start --server src --files "src/**/*" --port 3000 --no-open

# O para habilitar tanto la app como las pruebas:
browser-sync start --server . --files "**/*" --port 3000 --no-open
```

#### Opción B — Python 3:
```bash
# Servir la aplicación cliente (src)
cd src && python3 -m http.server 3000

# O servir desde la raíz para acceder también a los tests:
python3 -m http.server 3000
```

### 2. Acceder a la aplicación

Abra el navegador en:
```text
http://localhost:3000/
```

---

## 🧪 Ejecución de la Suite de Pruebas Automáticas

La estrategia de pruebas sigue una separación estricta entre TDD (unitarias) y BDD (integración sobre HTTP real):

### 1. Pruebas Unitarias TDD (`test/runner.html`)
Cubren con aislamiento total (`sinon.stub`) la capa de servicios, el store reactivo, el router y los Web Components:

- **URL en navegador**: `http://localhost:3000/test/runner.html`
- **Suites incluidas**:
  - `control/default_service_test.js`: Métodos HTTP base, stubs de códigos 200, 401, 403, 412, 422, 428, 500, inyección de token y `DefaultResponse`/`DefaultError`.
  - `control/persona_service_test.js`: Búsqueda por DUI.
  - `control/consulta_service_test.js`: Paginación, token bearer, errores 401, 422 y 500.
  - `control/auth_service_test.js`: Login, gestión de roles de empleado, sessionStorage y logout.
  - `control/orden_examen_service_test.js`: Creación en lote de órdenes de examen.
  - `control/store_test.js`: Reactividad del estado global (`EventTarget`).
  - `control/router_test.js`: Navegación por hash y guardias de sesión.
  - `control/login_view_test.js`: Pruebas unitarias de HU2 (renderizado de login, validaciones y navegación).
  - `control/busqueda_citas_view_test.js`: Pruebas unitarias de HU1 (búsqueda reactiva, tarjetas y descarga de ticket).
  - `control/tarjeta_consulta_test.js`: Pruebas de proyección de slots, datos clínicos e historial embebido.
  - `control/historial_pasos_test.js`: Pruebas de lista jerárquica de pasos y modal de registros.
  - `boundary/*_test.js`: Web Components (`dashboard_view`, `atencion_consulta_view`, `stepper_progreso`, `autocomplete_cie10`, `asistente_busqueda`, `lista_examenes`, `estado_red`).

### 2. Pruebas de Integración BDD (`test/runner_it.html`)
Verifican la conectividad contra los endpoints de Open Liberty en `http://localhost:9080`:

- **URL en navegador**: `http://localhost:3000/test/runner_it.html`
- **Suites incluidas**:
  - `integration/consulta_service_it.js`: Conexión real, verificación CORS y estructuración de DTOs.

---

## 🔍 Guía de Verificación de Historias de Usuario (HU1 a HU4)

### HU1: Asistente de Búsqueda de Citas (Público)
1. Ingrese a `http://localhost:3000/#buscar-citas`.
2. Seleccione el Tipo de Documento, ingrese el Número de Documento, seleccione la Clínica y el rango de fechas.
3. Presione **Buscar Citas**: se visualizarán las tarjetas `<tarjeta-consulta>` con los procedimientos.
4. Presione **Descargar Ticket PDF** en una cita para obtener el comprobante descargable.

### HU2: Portal de Autenticación de Empleados
1. Ingrese a `http://localhost:3000/#login`.
2. Seleccione el Tipo de Documento e ingrese las credenciales de un empleado con rol activo.
3. Al autenticar exitosamente, se persiste la sesión y se redirige automáticamente al `#dashboard`.

### HU3: Dashboard del Empleado y Árbol Jerárquico
1. Ingrese a `http://localhost:3000/#dashboard`.
2. Configure la Clínica y el Rol activo mediante el selector de contexto.
3. Se despliegan las citas del día con filtros temporales y el árbol de `<historial-pasos>`.
4. Al hacer clic en **Atender Consulta** sobre una cita activa, se navega a `#atencion/<id>`.

### HU4: Atención de Consulta Médica y Máquina de Estados
1. En la vista `#atencion/<id>`, observe el `<stepper-progreso>` con las etapas clínicas.
2. Complete las notas clínicas, busque diagnósticos en `<auto-complete-cie10>` y asigne órdenes en `<lista-examenes-asignables>`.
3. Utilice los controles de la máquina de estados: *Anterior*, *Guardar y Avanzar al Siguiente Paso*, o *Finalizar Consulta*.

---

## 📱 Modo Offline y PWA

- **Instalación PWA**: El archivo `manifest.json` cuenta con `id`, `scope`, `display: standalone`, íconos en 192x192 y 512x512 (con soporte `maskable`) y capturas de pantalla (`screenshots`).
- **Service Worker (`src/sw.js`)**: Realiza precaché del App Shell en el evento `install` y aplica estrategia **Network-First con Fallback a Cache** para la API REST.
- **Aviso de Estado de Red**: El componente `<estado-red>` monitorea la conectividad del navegador e informa al usuario cuando la conexión se pierde o se restablece.

