# GalenoSV — Frontend

PWA médica para la gestión de consultas y atención clínica, construida íntegramente con **Vanilla JS + Web Components** (sin frameworks) siguiendo el patrón ECB (Entity–Control–Boundary).

---

## Tabla de contenido

1. [Requisitos](#requisitos)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Código fuente (`src/`)](#código-fuente-src)
4. [Pruebas unitarias (`test/`)](#pruebas-unitarias-test)
   - [Librerías de soporte (`test/lib/`)](#librerías-de-soporte-testlib)
5. [Ejecución de las pruebas](#ejecución-de-las-pruebas)
6. [Convenciones de código](#convenciones-de-código)

---

## Requisitos

- Navegador moderno con soporte para **ES Modules**, **Custom Elements v1** y **Shadow DOM** (Chrome 80+, Firefox 75+, Edge 80+).
- Servidor HTTP local para servir los archivos estáticos (p. ej. la extensión *Live Server* de VS Code o `python3 -m http.server`).
- No se requiere Node.js para producción; sí se recomienda para tareas de desarrollo auxiliares.

---

## Estructura del proyecto

```
GalenoFrontEnd/
├── src/                        # ✅ Código fuente de producción
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                   # Service Worker (PWA)
│   └── js/
│       ├── app.js
│       ├── router.js
│       ├── routes.js
│       ├── store.js
│       ├── config.js
│       ├── entity/             # Entidades del dominio
│       ├── control/            # Servicios y lógica de negocio
│       └── boundary/           # Vistas y Web Components
│           ├── componentes/    # Custom Elements reutilizables
│           └── vistas/         # Páginas/vistas de la aplicación
│
└── test/                       # 🧪 Infraestructura de pruebas (solo desarrollo)
    ├── runner.html             # Runner de pruebas unitarias (TDD – Mocha)
    ├── runner_it.html          # Runner de pruebas de integración
    ├── lib/                    # ⚠️ Librerías de soporte — ver nota abajo
    │   ├── mocha/              #    Mocha 12.0.3 (mocha.js + mocha.css)
    │   ├── chai/               #    Chai (index.js)
    │   └── sinon/              #    Sinon.JS 22.1.0 (sinon.js)
    ├── boundary/               # Suites de prueba — capa Boundary
    ├── control/                # Suites de prueba — capa Control
    └── integration/            # Pruebas de integración
```

---

## Código fuente (`src/`)

Todo el código que se despliega a producción vive exclusivamente dentro de `src/`. La arquitectura sigue el patrón **ECB**:

| Capa | Directorio | Responsabilidad |
|---|---|---|
| **Entity** | `src/js/entity/` | Modelos de datos y errores del dominio |
| **Control** | `src/js/control/` | Servicios, lógica de negocio, gestión de estado |
| **Boundary** | `src/js/boundary/` | Componentes visuales (Custom Elements) y vistas |

Los Web Components se definen como clases ES que extienden `HTMLElement` y utilizan Shadow DOM. Cada componente es un módulo ES independiente importable desde las vistas.

---

## Pruebas unitarias (`test/`)

Las pruebas están escritas con la interfaz **TDD** de Mocha (`suite` / `test`) y las aserciones de **Chai** (`expect` / `assert`). Se ejecutan directamente en el navegador cargando `test/runner.html`; no existe un paso de compilación ni transpilación.

### Librerías de soporte (`test/lib/`)

> [!IMPORTANT]
> El directorio `test/lib/` **no forma parte del código fuente de producción** ubicado en `src/`. Contiene únicamente las librerías de terceros necesarias para ejecutar las pruebas unitarias en el navegador. Ningún archivo de este directorio se sirve ni se referencia desde la aplicación en producción.

| Archivo | Librería | Versión | Propósito |
|---|---|---|---|
| `test/lib/mocha/mocha.js` | [Mocha](https://mochajs.org) | 12.0.3 | Runner de pruebas, interfaz `suite`/`test` |
| `test/lib/mocha/mocha.css` | Mocha | 12.0.3 | Estilos del reporte HTML del runner |
| `test/lib/chai/index.js` | [Chai](https://www.chaijs.com) | — | Librería de aserciones (`expect`, `assert`) |
| `test/lib/sinon/sinon.js` | [Sinon.JS](https://sinonjs.org) | 22.1.0 | Espías, stubs y mocks para pruebas de servicios |

Estas librerías se distribuyen como **bundles UMD/IIFE vendorizados** (copiados manualmente al repositorio) para que el runner HTML funcione sin herramientas de empaquetado. **No deben ser importadas desde `src/`** ni incluidas en ningún proceso de despliegue o auditoría de dependencias de producción.

> [!NOTE]
> Si en algún momento se migra a un pipeline con `npm`, estas librerías pasarían a listarse en `devDependencies` del `package.json` y el directorio `test/lib/` podría eliminarse del repositorio.

---

## Ejecución de las pruebas

1. Levanta un servidor HTTP en la raíz del proyecto:
   ```bash
   python3 -m http.server 8080
   # o con la extensión Live Server de VS Code (clic derecho → "Open with Live Server")
   ```
2. Abre en el navegador:
   - **Pruebas unitarias:** `http://localhost:8080/test/runner.html`
   - **Pruebas de integración:** `http://localhost:8080/test/runner_it.html`

El reporte Mocha se muestra directamente en la página con el recuento de tests pasados, fallidos y pendientes.

---

## Convenciones de código

- **Módulos ES nativos** — se usan `import`/`export` sin transpilación.
- **Custom Elements v1** — cada componente registra su etiqueta con `customElements.define(...)` al final del módulo.
- **Sin dependencias de producción** — `src/` no tiene `node_modules` ni gestor de paquetes; todas las dependencias externas de producción son cero.
- **Nomenclatura de archivos** — `snake_case` para todos los archivos `.js` y de test.
- **Interfaz de pruebas TDD** — `suite()` / `test()` / `setup()` / `teardown()` (Mocha TDD); no mezclar con la interfaz BDD (`describe`/`it`) en el mismo runner.
=======
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
