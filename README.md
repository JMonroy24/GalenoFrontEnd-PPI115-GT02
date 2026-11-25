# GalenoSV — Frontend

Para iniciar **esta copia** del proyecto desde PowerShell, ejecute `./iniciar.ps1` y abra `http://localhost:3000/src/`. El script fija la carpeta del servidor explícitamente. Si el puerto 3000 ya está ocupado por otra copia, cierre ese servidor con Ctrl+C antes de ejecutar el script.

PWA médica para la gestión de consultas y atención clínica, construida íntegramente con **Vanilla JS + Web Components** (sin frameworks) siguiendo el patrón ECB (Entity–Control–Boundary).

---

## Tabla de contenido

1. [Requisitos](#requisitos)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Código fuente (`src/`)](#código-fuente-src)
4. [Arquitectura de pruebas](#arquitectura-de-pruebas)
5. [Pruebas unitarias (`test/`)](#pruebas-unitarias-test)
   - [Librerías de soporte (`test/lib/`)](#librerías-de-soporte-testlib)
6. [Ejecución de las pruebas](#ejecución-de-las-pruebas)
7. [Convenciones de código](#convenciones-de-código)

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
    ├── runner.html             # Runner principal (TDD + integración BDD al final)
    ├── runner_it.html          # Runner aislado de integración BDD
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

## Arquitectura de pruebas

Toda la infraestructura de QA vive en `test/` y se ejecuta directamente en el navegador: `src/` no importa suites ni librerías de pruebas.

| Runner | Interfaz | Red | Propósito |
|---|---|---|---|
| `test/runner.html` | TDD (`suite`/`test`) y BDD (`describe`/`it`) importado al final | `sinon.stub(window, "fetch")` en unitarias; `fetch` real en integración | Ejecuta todas las suites juntas |
| `test/runner_it.html` | BDD (`describe`/`it`) | `fetch` real contra Open Liberty | Ejecuta sólo la integración de forma aislada |

- `test/control/` y `test/boundary/`: suites TDD de servicios, vistas y Web Components. Los archivos de `control/` para componentes son delegados de `boundary/` y el runner importa una sola ruta para evitar duplicados.
- `test/integration/`: suites BDD sin stubs que validan contrato de endpoints, códigos de estado y CORS reales.
- `test/lib/`: **únicamente herramientas de testing usadas en desarrollo** (Mocha, Chai y Sinon), servidas como archivos estáticos y cargadas por los runners. **No se importan, empaquetan ni despliegan junto a `src/`.**

> [!IMPORTANT]
> El código de producción en `src/` está construido al **100% en Vanilla JS / Web Components nativos** (ES Modules, Custom Elements, Shadow DOM, `<slot>` y Service Worker) con CSS estándar: **cero librerías, frameworks o dependencias externas en runtime**. Mocha, Chai y Sinon existen sólo dentro de `test/lib/` como herramientas de desarrollo ejecutadas a través de `test/runner.html` (y opcionalmente `test/runner_it.html`).

---

## Pruebas unitarias (`test/`)

Las pruebas unitarias están escritas con la interfaz **TDD** de Mocha (`suite` / `test`) y las aserciones de **Chai** (`expect` / `assert`). Se ejecutan directamente en el navegador cargando `test/runner.html`, que también importa la suite BDD de integración al final; no existe un paso de compilación ni transpilación.

### Librerías de soporte (`test/lib/`)

> [!IMPORTANT]
> El directorio `test/lib/` contiene **únicamente herramientas de prueba estáticas: Mocha, Chai y Sinon**. Se cargan localmente desde los runners, sin CDN ni instalación de paquetes. **No forma parte del código fuente de producción** ubicado en `src/`: ningún archivo de este directorio se importa desde la aplicación. El código de producción mantiene **cero librerías de terceros**, usando Vanilla JS, Web Components y CSS estándar.

| Archivo | Librería | Versión | Propósito |
|---|---|---|---|
| `test/lib/mocha/mocha.js` | [Mocha](https://mochajs.org) | 12.0.3 | Runner de pruebas, interfaz `suite`/`test` |
| `test/lib/mocha/mocha.css` | Mocha | 12.0.3 | Estilos del reporte HTML del runner |
| `test/lib/chai/index.js` | [Chai](https://www.chaijs.com) | — | Librería de aserciones (`expect`, `assert`) |
| `test/lib/sinon/sinon.js` | [Sinon.JS](https://sinonjs.org) | 22.1.0 | Espías, stubs y mocks para pruebas de servicios |

Estas herramientas se distribuyen como **archivos estáticos copiados al repositorio**: Mocha y Sinon como scripts para navegador y Chai como módulo ES. El runner funciona sin herramientas de empaquetado. **No deben ser importadas desde `src/`** ni incluidas en el despliegue de producción.

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
   - **Pruebas de integración:** `http://localhost:8080/test/runner.html` (junto al resto) o `http://localhost:8080/test/runner_it.html` (sólo BDD)

El reporte Mocha se muestra directamente en la página con el recuento de tests pasados, fallidos y pendientes.

### Cobertura de vistas y componentes

El runner importa todas las suites desde un único módulo antes de llamar a `mocha.run()`. Las suites unitarias usan Mocha TDD (`suite`/`test`), Chai y `sinon.stub(window, "fetch")` para simular respuestas HTTP, por lo que no requieren backend. La suite de integración usa Mocha BDD (`describe`/`it`) con `fetch` real contra Open Liberty, sin stubs, y se importa al final del mismo runner.

| Suite canónica | Comportamientos cubiertos |
|---|---|
| `test/control/login_view_test.js` | Renderizado, validación y corrección de campos, carga, bloqueo de envíos duplicados, sesión y navegación, persona inexistente, roles inactivos y errores HTTP |
| `test/control/busqueda_citas_view_test.js` | Asistente secuencial, filtros, resultados y estados vacíos, carga y errores, respuestas fuera de orden, ticket PDF por consulta y recuperación del botón |
| `test/boundary/tarjeta_consulta_test.js` | Paciente y documento, fecha y estado, procedimientos activos, acciones por slot, texto seguro, historial y propagación de eventos |
| `test/boundary/historial_pasos_test.js` | Jerarquía y registros ejecutados, estado vacío, normalización, contenido seguro, apertura/cierre del diálogo, foco, desmontaje y ciclos en los datos |

Los archivos `test/control/tarjeta_consulta_test.js`, `test/control/historial_pasos_test.js` y `test/control/atencion_consulta_view_test.js` son accesos de compatibilidad a las suites de `boundary/`; el runner importa esas rutas de `control/` para evitar duplicados. `test/runner_it.html` permite ejecutar sólo las pruebas BDD (`describe`/`it`) sobre HTTP real; requiere Open Liberty y CORS habilitado según `src/js/config.js`.

---

## Convenciones de código

- **Módulos ES nativos** — se usan `import`/`export` sin transpilación.
- **Custom Elements v1** — cada componente registra su etiqueta con `customElements.define(...)` al final del módulo.
- **Sin dependencias de producción** — `src/` no tiene `node_modules` ni gestor de paquetes; todas las dependencias externas de producción son cero.
- **Nomenclatura de archivos** — `snake_case` para todos los archivos `.js` y de test.
- **Interfaces de pruebas** — TDD (`suite()` / `test()` / `setup()` / `teardown()`) para unitarias y BDD (`describe()` / `it()`) para integración; en `test/runner.html` la suite BDD se importa al final, después de registrar todas las TDD.
---
# GalenoSV — Cliente Frontend (GalenoFE)

Cliente web frontend para el sistema de gestión clínica **GalenoSV**, desarrollado para la asignatura *Programación para Internet (PPI115, Ciclo II-2026, FMOcc-UES)*.

La aplicación opera como una **Progressive Web Application (PWA)** y **Single Page Application (SPA)** construida exclusivamente con **ECMAScript (ES6+) nativo** y **Web Components de autoría propia** (Custom Elements con Shadow DOM y `<slot>`), sin frameworks (React, Angular, Vue), librerías auxiliares ni hojas de estilo externas.

---

## 🏛️ Arquitectura: Boundary-Control-Entity (BCE)

El proyecto mantiene un desacoplamiento estricto bajo el patrón BCE:

- **Boundary (`src/js/boundary/`)**:
  - **Vistas**: `busqueda_citas_view.js` (#buscar-citas), `login_view.js` (#login), `dashboard_view.js` (#dashboard), `atencion_consulta_view.js` (#atencion/<id>).
  - **Componentes**: `stepper_progreso.js`, `lista_examenes.js`, `historial_pasos.js`, `tarjeta_consulta.js`, `asistente_busqueda.js`, `estado_red.js`, `notificacion_emergente.js`, `encabezado_app.js`, `menu_lateral.js`, `pie_app.js`.
- **Control (`src/js/control/`)**:
  - `default_service.js`: Cliente HTTP base asíncrono (`async/await`) con interceptores para errores HTTP (401, 403, 412, 422, 428), inyección automática de tokens Bearer y control de timeout.
  - Servicios especializados: `consulta_service.js`, `auth_service.js`, `persona_service.js`, `orden_examen_service.js`, `clinica_service.js`, etc.
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
3. **Backend Jakarta EE**: Open Liberty en ejecución en `http://localhost:9080/galenoSV/api/v1` (respaldado por PostgreSQL).

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

La estrategia separa las interfaces TDD (unitarias, con stubs) y BDD (integración con HTTP real). Ambas se ejecutan juntas en `test/runner.html`; la suite BDD también puede ejecutarse de forma aislada en `test/runner_it.html`.

### 1. Pruebas Unitarias TDD (`test/runner.html`)
Cubren con aislamiento total (`sinon.stub`) la capa de servicios y los Web Components:

- **URL en navegador**: `http://localhost:3000/test/runner.html`
- **Suites incluidas**:
  - `control/default_service_test.js`: Métodos HTTP base, stubs de códigos 200, 401, 403, 412, 422, 428, 500, inyección de token y `DefaultResponse`/`DefaultError`.
  - `control/persona_service_test.js`: Búsqueda por DUI.
  - `control/consulta_service_test.js`: Paginación, token bearer, errores 401, 422 y 500.
  - `control/auth_service_test.js`: Login, gestión de roles de empleado, sessionStorage y logout.
  - `control/orden_examen_service_test.js`: Creación en lote de órdenes de examen.
  - `boundary/*_test.js`: Web Components (`dashboard_view`, `atencion_consulta_view`, `stepper_progreso`, `asistente_busqueda`, `lista_examenes`, `estado_red`).

### 2. Pruebas de Integración BDD (`test/runner.html` y `test/runner_it.html`)
Verifican la conectividad contra los endpoints de Open Liberty en `http://localhost:9080/galenoSV/api/v1`:

- **URL en navegador**: `http://localhost:3000/test/runner.html` (junto al resto de suites) o `http://localhost:3000/test/runner_it.html` (sólo integración)
- **Suites incluidas**:
  - `integration/consulta_service_it.js`: petición `fetch` real, verificación de status/CORS y estructuración de DTOs (`items`, `total`, `first`, `max`).

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
2. Complete las notas, el diagnóstico clínico libre y el plan; asigne órdenes en `<lista-examenes-asignables>`. Los registros se consultan inline, sin ventanas flotantes, y las fechas visibles usan `DD/MM/YYYY`.
3. Utilice los controles de la máquina de estados: *Anterior*, *Guardar y Avanzar al Siguiente Paso*, o *Finalizar Consulta*.

---

## 📱 Modo Offline y PWA

- **Instalación PWA**: El archivo `manifest.json` cuenta con `id`, `scope`, `display: standalone`, íconos en 192x192 y 512x512 (con soporte `maskable`) y capturas de pantalla (`screenshots`).
- **Service Worker (`src/sw.js`)**: Realiza precaché del App Shell en el evento `install` y aplica estrategia **Network-First con Fallback a Cache** para la API REST.
- **Aviso de Estado de Red**: El componente `<estado-red>` monitorea la conectividad del navegador e informa al usuario cuando la conexión se pierde o se restablece.
