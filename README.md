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
