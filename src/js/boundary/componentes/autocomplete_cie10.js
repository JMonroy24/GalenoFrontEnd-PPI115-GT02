import { cie10Service, Cie10Service } from "../../control/cie10_service.js";

/** Tiempo de debounce para la búsqueda de diagnósticos en milisegundos. */
const DEBOUNCE_MS = 300;

/**
 * Escapa caracteres HTML especiales para evitar inyecciones.
 * @param {unknown} texto
 * @returns {string}
 */
function escaparHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Extrae una clave normalizada única para un diagnóstico CIE-10
 * para garantizar la prevención de duplicados.
 * @param {object|string} diag
 * @returns {string}
 */
function extraerClave(diag) {
    if (!diag) return "";
    if (typeof diag === "string") return diag.trim().toLowerCase();
    const codigo = diag.codigo ?? diag.code ?? "";
    if (codigo) return String(codigo).trim().toLowerCase();
    const id = diag.idCie10 ?? diag.id ?? "";
    if (id) return `id-${id}`;
    const nombre = diag.nombre ?? diag.descripcion ?? diag.description ?? "";
    return String(nombre).trim().toLowerCase();
}

/**
 * Extrae el código representativo de un diagnóstico.
 * @param {object|string} diag
 * @returns {string}
 */
function extraerCodigo(diag) {
    if (!diag) return "";
    if (typeof diag === "string") return "";
    return String(diag.codigo ?? diag.code ?? "").trim();
}

/**
 * Extrae la descripción o nombre de un diagnóstico.
 * @param {object|string} diag
 * @returns {string}
 */
function extraerNombre(diag) {
    if (!diag) return "";
    if (typeof diag === "string") return diag.trim();
    return String(
        diag.nombre ??
        diag.descripcion ??
        diag.description ??
        diag.label ??
        diag.codigo ??
        ""
    ).trim();
}

/**
 * Web Component nativo `<auto-complete-cie10>` con Shadow DOM.
 * Proporciona un buscador accesible con debounce para diagnósticos CIE-10
 * y gestión de etiquetas/chips seleccionadas.
 *
 * @element auto-complete-cie10
 * @fires cie10-change - Emitido al agregar o eliminar diagnósticos seleccionados.
 */
export class AutoCompleteCie10 extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        /** @type {Cie10Service} */
        this._servicio = cie10Service;

        /** @type {Array<object|string>} Lista de diagnósticos seleccionados. */
        this._seleccionados = [];

        /** @type {Array<object>} Resultados devueltos por la búsqueda actual. */
        this._resultados = [];

        /** @type {number} Índice de la opción activa para navegación por teclado (-1 si ninguna). */
        this._indiceActivo = -1;

        /** @type {number|null} Identificador del temporizador de debounce. */
        this._timerDebounce = null;

        /** @type {number} Contador secuencial para evitar condiciones de carrera en búsquedas. */
        this._contadorSolicitudes = 0;

        /** @type {boolean} Indica si hay una búsqueda en progreso. */
        this._cargando = false;

        this._manejadorClickFuera = (evento) => {
            const dentro = typeof evento.composedPath === "function"
                ? evento.composedPath().includes(this)
                : this.contains(evento.target);
            if (!dentro) {
                this._ocultarResultados();
            }
        };
    }

    connectedCallback() {
        this.render();
        document.addEventListener("click", this._manejadorClickFuera);
    }

    disconnectedCallback() {
        clearTimeout(this._timerDebounce);
        this._timerDebounce = null;
        document.removeEventListener("click", this._manejadorClickFuera);
    }

    // ─── Propiedades públicas ─────────────────────────────────────────────────

    /**
     * Servicio de consulta CIE-10. Permite inyectar stubs o servicios personalizados.
     */
    get servicio() {
        return this._servicio;
    }

    set servicio(instancia) {
        this._servicio = instancia;
    }

    /**
     * Lista de diagnósticos actualmente seleccionados.
     * @returns {Array<object|string>}
     */
    get seleccionados() {
        return [...this._seleccionados];
    }

    /**
     * Reemplaza la lista de diagnósticos seleccionados.
     * @param {Array<object|string>} lista
     */
    set seleccionados(lista) {
        this._seleccionados = Array.isArray(lista) ? [...lista] : [];
        this._renderizarChips();
    }

    /**
     * Devuelve una copia de los diagnósticos seleccionados.
     * @returns {Array<object|string>}
     */
    obtenerSeleccionados() {
        return [...this._seleccionados];
    }

    /**
     * Limpia las selecciones actuales, resultados flotantes y el campo de búsqueda.
     */
    limpiar() {
        this._seleccionados = [];
        this._resultados = [];
        this._indiceActivo = -1;
        const input = this.shadowRoot?.querySelector("#input-busqueda");
        if (input) input.value = "";
        this._ocultarResultados();
        this._renderizarChips();
        this._emitirCambio();
    }

    /**
     * Agrega un diagnóstico a la selección si no existe previamente.
     * @param {object|string} diag
     * @returns {boolean} True si fue agregado, false si era duplicado.
     */
    seleccionarDiagnostico(diag) {
        if (!diag) return false;

        const claveNueva = extraerClave(diag);
        const yaExiste = this._seleccionados.some(
            (item) => extraerClave(item) === claveNueva
        );

        if (yaExiste) {
            this._ocultarResultados();
            const input = this.shadowRoot?.querySelector("#input-busqueda");
            if (input) input.value = "";
            return false;
        }

        this._seleccionados.push(diag);
        this._renderizarChips();
        this._ocultarResultados();

        const input = this.shadowRoot?.querySelector("#input-busqueda");
        if (input) {
            input.value = "";
            input.focus();
        }

        this._emitirCambio();
        return true;
    }

    /**
     * Elimina un diagnóstico de la lista de seleccionados por su índice o referencia.
     * @param {number|object|string} itemOIndice
     */
    eliminarDiagnostico(itemOIndice) {
        let indice = -1;
        if (typeof itemOIndice === "number") {
            indice = itemOIndice;
        } else {
            const claveBuscada = extraerClave(itemOIndice);
            indice = this._seleccionados.findIndex(
                (item) => extraerClave(item) === claveBuscada
            );
        }

        if (indice >= 0 && indice < this._seleccionados.length) {
            this._seleccionados.splice(indice, 1);
            this._renderizarChips();
            this._emitirCambio();
        }
    }

    // ─── Renderizado principal ────────────────────────────────────────────────

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
                }

                *, *::before, *::after {
                    box-sizing: inherit;
                }

                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border-width: 0;
                }

                .autocomplete-contenedor {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 0.75rem);
                    width: 100%;
                    position: relative;
                }

                /* ── Campo de búsqueda y envoltura ── */
                .campo-wrapper {
                    position: relative;
                    width: 100%;
                }

                .input-search {
                    width: 100%;
                    min-height: 2.75rem;
                    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                    padding-right: 2.5rem;
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius, 0.5rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text, #0f172a);
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }

                .input-search::placeholder {
                    color: var(--color-text-muted, #475569);
                    opacity: 1;
                }

                .input-search:focus {
                    outline: none;
                    border-color: var(--color-primary, #1e3a8a);
                    box-shadow: 0 0 0 3px var(--color-primary-soft, #dbeafe);
                }

                /* ── Spinner indicador de búsqueda ── */
                .spinner-busqueda {
                    display: none;
                    position: absolute;
                    right: 0.875rem;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid var(--color-border, #64748b);
                    border-right-color: var(--color-primary, #1e3a8a);
                    border-radius: 9999px;
                    animation: girar 0.7s linear infinite;
                    pointer-events: none;
                }

                .spinner-busqueda.activo {
                    display: block;
                }

                @keyframes girar {
                    to { transform: translateY(-50%) rotate(360deg); }
                }

                /* ── Lista flotante de resultados (dropdown) ── */
                .lista-resultados {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    z-index: 1050;
                    max-height: 18rem;
                    overflow-y: auto;
                    margin: 0;
                    padding: 0.25rem 0;
                    list-style: none;
                    background-color: var(--color-surface, #ffffff);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius, 0.5rem);
                    box-shadow: var(--shadow, 0 4px 12px rgb(15 23 42 / 0.15));
                }

                .lista-resultados[hidden] {
                    display: none;
                }

                .resultado-item {
                    display: flex;
                    align-items: baseline;
                    gap: var(--space-2, 0.5rem);
                    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                    cursor: pointer;
                    font-size: var(--text-sm, 0.875rem);
                    color: var(--color-text, #0f172a);
                    transition: background-color 0.1s ease;
                }

                .resultado-item:hover,
                .resultado-item.activo,
                .resultado-item[aria-selected="true"] {
                    background-color: var(--color-primary-soft, #dbeafe);
                    color: var(--color-primary, #1e3a8a);
                }

                .resultado-codigo {
                    display: inline-block;
                    font-weight: 700;
                    font-size: var(--text-xs, 0.75rem);
                    padding: 0.125rem 0.375rem;
                    background-color: var(--color-surface-alt, #e2e8f0);
                    color: var(--color-text, #0f172a);
                    border-radius: var(--radius-sm, 0.25rem);
                    flex-shrink: 0;
                }

                .resultado-item.activo .resultado-codigo,
                .resultado-item[aria-selected="true"] .resultado-codigo {
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                }

                .resultado-nombre {
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .resultado-vacio,
                .resultado-estado {
                    padding: var(--space-3, 0.75rem);
                    font-size: var(--text-sm, 0.875rem);
                    color: var(--color-text-muted, #475569);
                    text-align: center;
                }

                /* ── Lista de etiquetas/chips seleccionadas ── */
                .chips-contenedor {
                    width: 100%;
                }

                .chips-lista {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2, 0.5rem);
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .chip {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-2, 0.5rem);
                    max-width: 100%;
                    padding: 0.25rem 0.5rem 0.25rem 0.625rem;
                    background-color: var(--color-primary-soft, #dbeafe);
                    color: var(--color-primary, #1e3a8a);
                    border: 1px solid var(--color-primary, #1e3a8a);
                    border-radius: var(--radius-full, 9999px);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 500;
                    line-height: 1.3;
                    transition: background-color 0.15s ease;
                }

                .chip-codigo {
                    display: inline-block;
                    font-weight: 700;
                    font-size: var(--text-xs, 0.75rem);
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                    padding: 0.1rem 0.35rem;
                    border-radius: var(--radius-sm, 0.25rem);
                    flex-shrink: 0;
                }

                .chip-nombre {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 22rem;
                }

                .btn-eliminar-chip {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 1.25rem;
                    height: 1.25rem;
                    margin-left: 0.125rem;
                    padding: 0;
                    border: none;
                    background: transparent;
                    color: var(--color-primary, #1e3a8a);
                    font-size: 1.125rem;
                    font-weight: 700;
                    line-height: 1;
                    border-radius: 9999px;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: background-color 0.15s ease, color 0.15s ease;
                }

                .btn-eliminar-chip:hover {
                    background-color: color-mix(in srgb, var(--color-primary, #1e3a8a) 20%, transparent);
                    color: var(--color-primary-hover, #172554);
                }

                .btn-eliminar-chip:focus-visible {
                    outline: 2px solid var(--color-primary, #1e3a8a);
                    outline-offset: 1px;
                }

                @media (max-width: 640px) {
                    .chip-nombre {
                        max-width: 12rem;
                    }
                }
            </style>

            <div class="autocomplete-contenedor">
                <!-- Envoltura del input con sugerencias flotantes -->
                <div class="campo-wrapper">
                    <input
                        type="search"
                        id="input-busqueda"
                        class="input-search"
                        placeholder="Buscar diagnóstico CIE-10 por código (ej. A09) o nombre..."
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded="false"
                        aria-controls="lista-resultados"
                        aria-label="Buscar diagnósticos CIE-10"
                    />
                    <span class="spinner-busqueda" id="spinner" aria-hidden="true"></span>

                    <!-- Lista flotante accesible (role="listbox") -->
                    <ul
                        id="lista-resultados"
                        class="lista-resultados"
                        role="listbox"
                        aria-label="Resultados de búsqueda CIE-10"
                        hidden
                    ></ul>
                </div>

                <!-- Lista de chips/etiquetas seleccionadas -->
                <div class="chips-contenedor" id="contenedor-chips">
                    <ul
                        class="chips-lista"
                        id="chips-lista"
                        role="list"
                        aria-label="Diagnósticos seleccionados"
                    ></ul>
                </div>
            </div>
        `;

        this._conectarEventos();
        this._renderizarChips();
    }

    // ─── Conexión de eventos ───

    _conectarEventos() {
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (!input) return;

        input.addEventListener("input", () => {
            const query = input.value.trim();
            clearTimeout(this._timerDebounce);
            this._timerDebounce = null;

            if (query.length === 0) {
                this._ocultarResultados();
                return;
            }

            // Debounce de 300 ms requerido
            this._timerDebounce = setTimeout(() => {
                this._ejecutarBusqueda(query);
            }, DEBOUNCE_MS);
        });

        input.addEventListener("keydown", (evento) => {
            this._manejarTeclado(evento);
        });
    }

    // ─── Búsqueda y consulta de servicio ───

    async _ejecutarBusqueda(query) {
        const solicitud = ++this._contadorSolicitudes;
        this._mostrarCargando(true);

        try {
            let resultado;
            if (typeof this._servicio?.findRange === "function") {
                resultado = await this._servicio.findRange(0, 20, query);
            } else if (typeof this._servicio?.buscarDiagnosticos === "function") {
                resultado = await this._servicio.buscarDiagnosticos(query);
            } else if (typeof this.buscar === "function") {
                resultado = await this.buscar(query);
            } else {
                resultado = [];
            }

            if (solicitud !== this._contadorSolicitudes) {
                return; // Petición obsoleta descartada
            }

            const items = Array.isArray(resultado)
                ? resultado
                : resultado?.items ?? resultado?.datos ?? [];

            this._resultados = items;
            this._indiceActivo = -1;
            this._renderizarResultados(items, query);
        } catch (_) {
            if (solicitud === this._contadorSolicitudes) {
                this._resultados = [];
                this._mostrarMensajeLista("Error al consultar diagnósticos.");
            }
        } finally {
            if (solicitud === this._contadorSolicitudes) {
                this._mostrarCargando(false);
            }
        }
    }

    // ─── Renderizado de resultados flotantes ───

    _renderizarResultados(items, query) {
        const lista = this.shadowRoot.querySelector("#lista-resultados");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (!lista) return;

        lista.replaceChildren();

        if (items.length === 0) {
            const vacio = document.createElement("li");
            vacio.className = "resultado-vacio";
            vacio.textContent = `No se encontraron diagnósticos para "${query}".`;
            vacio.setAttribute("role", "status");
            lista.appendChild(vacio);
        } else {
            items.forEach((item, indice) => {
                const codigo = extraerCodigo(item);
                const nombre = extraerNombre(item);

                const li = document.createElement("li");
                li.id = `cie10-opcion-${indice}`;
                li.className = "resultado-item";
                li.setAttribute("role", "option");
                li.setAttribute("aria-selected", "false");

                li.innerHTML = `
                    ${codigo ? `<span class="resultado-codigo">${escaparHtml(codigo)}</span>` : ""}
                    <span class="resultado-nombre">${escaparHtml(nombre)}</span>
                `;

                li.addEventListener("click", () => {
                    this.seleccionarDiagnostico(item);
                });

                lista.appendChild(li);
            });
        }

        lista.hidden = false;
        if (input) {
            input.setAttribute("aria-expanded", "true");
        }
    }

    _mostrarMensajeLista(mensaje) {
        const lista = this.shadowRoot.querySelector("#lista-resultados");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (!lista) return;

        lista.replaceChildren();
        const li = document.createElement("li");
        li.className = "resultado-estado";
        li.textContent = mensaje;
        li.setAttribute("role", "status");
        lista.appendChild(li);
        lista.hidden = false;
        if (input) input.setAttribute("aria-expanded", "true");
    }

    _ocultarResultados() {
        const lista = this.shadowRoot.querySelector("#lista-resultados");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (lista) {
            lista.hidden = true;
            lista.replaceChildren();
        }
        if (input) {
            input.setAttribute("aria-expanded", "false");
            input.removeAttribute("aria-activedescendant");
        }
        this._resultados = [];
        this._indiceActivo = -1;
    }

    _mostrarCargando(activo) {
        this._cargando = activo;
        const spinner = this.shadowRoot.querySelector("#spinner");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (spinner) {
            spinner.classList.toggle("activo", activo);
        }
        if (input) {
            input.setAttribute("aria-busy", String(activo));
        }
    }

    // ─── Manejo de teclado en el combobox ───

    _manejarTeclado(evento) {
        const lista = this.shadowRoot.querySelector("#lista-resultados");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (!lista || lista.hidden || this._resultados.length === 0) {
            if (evento.key === "Escape") {
                this._ocultarResultados();
            }
            return;
        }

        const total = this._resultados.length;

        switch (evento.key) {
            case "ArrowDown":
                evento.preventDefault();
                this._indiceActivo = (this._indiceActivo + 1) % total;
                this._actualizarOpcionActiva();
                break;

            case "ArrowUp":
                evento.preventDefault();
                this._indiceActivo = this._indiceActivo <= 0 ? total - 1 : this._indiceActivo - 1;
                this._actualizarOpcionActiva();
                break;

            case "Enter":
                evento.preventDefault();
                if (this._indiceActivo >= 0 && this._indiceActivo < total) {
                    this.seleccionarDiagnostico(this._resultados[this._indiceActivo]);
                }
                break;

            case "Escape":
                evento.preventDefault();
                this._ocultarResultados();
                break;
        }
    }

    _actualizarOpcionActiva() {
        const lista = this.shadowRoot.querySelector("#lista-resultados");
        const input = this.shadowRoot.querySelector("#input-busqueda");
        if (!lista) return;

        const opciones = lista.querySelectorAll(".resultado-item");
        opciones.forEach((opc, idx) => {
            const esActivo = idx === this._indiceActivo;
            opc.classList.toggle("activo", esActivo);
            opc.setAttribute("aria-selected", String(esActivo));
            if (esActivo) {
                opc.scrollIntoView({ block: "nearest" });
                if (input) {
                    input.setAttribute("aria-activedescendant", opc.id);
                }
            }
        });
    }

    // ─── Renderizado de etiquetas/chips ───

    _renderizarChips() {
        const listaChips = this.shadowRoot?.querySelector("#chips-lista");
        if (!listaChips) return;

        listaChips.replaceChildren();

        this._seleccionados.forEach((diag, indice) => {
            const codigo = extraerCodigo(diag);
            const nombre = extraerNombre(diag);

            const li = document.createElement("li");
            li.className = "chip";
            li.setAttribute("role", "listitem");

            li.innerHTML = `
                ${codigo ? `<span class="chip-codigo">${escaparHtml(codigo)}</span>` : ""}
                <span class="chip-nombre" title="${escaparHtml(nombre)}">${escaparHtml(nombre)}</span>
                <button
                    type="button"
                    class="btn-eliminar-chip"
                    aria-label="Quitar diagnóstico ${escaparHtml(codigo || nombre)}"
                >×</button>
            `;

            const btnEliminar = li.querySelector(".btn-eliminar-chip");
            btnEliminar?.addEventListener("click", () => {
                this.eliminarDiagnostico(indice);
            });

            listaChips.appendChild(li);
        });
    }

    // ─── Emisión del evento ───

    _emitirCambio() {
        this.dispatchEvent(new CustomEvent("cie10-change", {
            bubbles: true,
            composed: true,
            detail: {
                seleccionados: [...this._seleccionados]
            }
        }));
    }
}

if (!customElements.get("auto-complete-cie10")) {
    customElements.define("auto-complete-cie10", AutoCompleteCie10);
}

export default AutoCompleteCie10;
