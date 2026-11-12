import { tipoExamenService } from "../../control/tipo_examen_service.js";
import { ordenExamenService } from "../../control/orden_examen_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

const CATEGORIA_POR_DEFECTO = "General";
const TODAS = "__todas__";
const MAX_EXAMENES = 200;

const escapar = (texto) => String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * <lista-examenes-asignables id-consulta="...">
 * Panel de exámenes asignables con filtro por categoría, casillas de selección
 * y botón "Asignar Exámenes Seleccionados".
 *
 * Eventos (bubbles + composed):
 *  - "ordenes-asignadas": detail { idConsulta, ordenes, examenes }
 *
 * Los servicios pueden inyectarse (propiedades tipoExamenService y
 * ordenExamenService) para facilitar las pruebas unitarias.
 */
export class ListaExamenesAsignables extends HTMLElement {
    static get observedAttributes() {
        return ["id-consulta"];
    }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.tipoExamenService = tipoExamenService;
        this.ordenExamenService = ordenExamenService;
        this._idConsulta = null;
        this._examenes = [];
        this._seleccion = new Set();
        this._categoria = TODAS;
        this._enviando = false;
        this._cargado = false;
    }

    get idConsulta() {
        return this._idConsulta ?? this.getAttribute("id-consulta");
    }

    set idConsulta(valor) {
        this._idConsulta = valor;
        this._actualizarBoton();
    }

    attributeChangedCallback() {
        this._actualizarBoton();
    }

    async connectedCallback() {
        this._renderEstructura();
        await this.cargarExamenes();
    }

    /** Devuelve los ids de los exámenes marcados. */
    obtenerSeleccionados() {
        return [...this._seleccion];
    }

    async cargarExamenes() {
        this._estado("Cargando exámenes…");

        try {
            const respuesta = await this.tipoExamenService.findRange(0, MAX_EXAMENES);
            const items = Array.isArray(respuesta?.items)
                ? respuesta.items
                : Array.isArray(respuesta) ? respuesta : [];

            this._examenes = items
                .filter((e) => e?.activo !== false)
                .map((e) => this._normalizar(e));
            this._cargado = true;
            this._estado("");
            this._pintarCategorias();
            this._pintarLista();
        } catch (error) {
            this._estado("No se pudieron cargar los exámenes.");
            GeneradorMensajes.crearMensaje(
                "Error al cargar exámenes",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _normalizar(examen) {
        const categoria = examen.categoria?.nombre
            ?? examen.categoria
            ?? examen.categoriaExamen?.nombre
            ?? examen.tipoCategoria
            ?? CATEGORIA_POR_DEFECTO;

        return {
            id: String(examen.idTipoExamen ?? examen.id ?? ""),
            nombre: examen.nombre ?? examen.descripcion ?? "Examen sin nombre",
            categoria: String(categoria || CATEGORIA_POR_DEFECTO)
        };
    }

    _visibles() {
        return this._categoria === TODAS
            ? this._examenes
            : this._examenes.filter((e) => e.categoria === this._categoria);
    }

    _estado(texto) {
        const nodo = this.shadowRoot.querySelector("#estado");

        if (nodo) {
            nodo.textContent = texto;
        }
    }

    _pintarCategorias() {
        const select = this.shadowRoot.querySelector("#filtro-categoria");
        const categorias = [...new Set(this._examenes.map((e) => e.categoria))].sort();

        select.innerHTML = [
            `<option value="${TODAS}">Todas las categorías</option>`,
            ...categorias.map((c) => `<option value="${escapar(c)}">${escapar(c)}</option>`)
        ].join("");
        select.value = this._categoria;
    }

    _pintarLista() {
        const contenedor = this.shadowRoot.querySelector("#lista");
        const visibles = this._visibles();

        if (this._cargado && visibles.length === 0) {
            contenedor.innerHTML = `<p class="vacio">No hay exámenes en esta categoría.</p>`;
            this._actualizarBoton();
            return;
        }

        contenedor.innerHTML = visibles.map((e) => `
            <label class="examen">
                <input type="checkbox" value="${escapar(e.id)}"
                    ${this._seleccion.has(e.id) ? "checked" : ""}>
                <span class="examen-nombre">${escapar(e.nombre)}</span>
                <span class="examen-cat">${escapar(e.categoria)}</span>
            </label>
        `).join("");
        this._actualizarBoton();
    }

    _actualizarBoton() {
        const boton = this.shadowRoot?.querySelector("#btn-asignar");

        if (!boton) {
            return;
        }

        const cantidad = this._seleccion.size;

        boton.disabled = this._enviando || cantidad === 0 || !this.idConsulta;
        boton.setAttribute("aria-busy", String(this._enviando));
        this.shadowRoot.querySelector("#contador").textContent =
            cantidad === 1 ? "1 examen seleccionado" : `${cantidad} exámenes seleccionados`;
    }

    _onCambioCheckbox(evento) {
        const input = evento.target;

        if (input.type !== "checkbox") {
            return;
        }

        if (input.checked) {
            this._seleccion.add(input.value);
        } else {
            this._seleccion.delete(input.value);
        }

        this._actualizarBoton();
    }

    async asignarSeleccionados() {
        if (this._enviando || this._seleccion.size === 0 || !this.idConsulta) {
            return;
        }

        const ids = this.obtenerSeleccionados();

        this._enviando = true;
        this._actualizarBoton();

        try {
            const ordenes = await this.ordenExamenService.crearOrdenes(this.idConsulta, ids);

            GeneradorMensajes.crearMensaje(
                "Exámenes asignados",
                `Se registraron ${ids.length} orden(es) de examen.`,
                "success"
            );
            this._estado(`${ids.length} orden(es) registradas correctamente.`);
            this.dispatchEvent(new CustomEvent("ordenes-asignadas", {
                bubbles: true,
                composed: true,
                detail: { idConsulta: this.idConsulta, ordenes, examenes: ids }
            }));
            this._seleccion.clear();
            this._pintarLista();
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "No se pudieron asignar los exámenes",
                error?.mensaje ?? error?.message ?? "Intente nuevamente.",
                "error"
            );
            this._estado("No se pudieron asignar los exámenes.");
        } finally {
            this._enviando = false;
            this._actualizarBoton();
        }
    }

    _renderEstructura() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host { display: block; }
                .panel {
                    background: var(--color-surface);
                    border: var(--border);
                    border-radius: var(--radius);
                    padding: var(--space-4);
                    display: grid;
                    gap: var(--space-3);
                }
                h3 { margin: 0; font-size: var(--text-lg); color: var(--color-primary); }
                label.filtro { display: grid; gap: var(--space-1); font-size: var(--text-sm); font-weight: 600; }
                select {
                    font: inherit; padding: var(--space-2);
                    border: var(--border); border-radius: var(--radius-sm);
                    background: var(--color-surface); color: var(--color-text);
                }
                fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
                legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
                #lista {
                    display: grid; gap: var(--space-2);
                    max-height: 18rem; overflow-y: auto;
                    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
                }
                .examen {
                    display: flex; align-items: center; gap: var(--space-2);
                    padding: var(--space-2) var(--space-3);
                    border: var(--border); border-radius: var(--radius-sm);
                    cursor: pointer; background: var(--color-bg);
                }
                .examen:has(input:checked) { background: var(--color-primary-soft); }
                .examen:focus-within { outline: var(--focus-width) solid var(--color-focus); outline-offset: 2px; }
                .examen input { inline-size: 1.15rem; block-size: 1.15rem; flex: none; }
                .examen-nombre { flex: 1; font-size: var(--text-sm); }
                .examen-cat { font-size: var(--text-xs); color: var(--color-text-muted); }
                .vacio, #estado { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
                .pie { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; }
                #contador { font-size: var(--text-sm); color: var(--color-text-muted); }
                button {
                    font: inherit; font-weight: 600; cursor: pointer;
                    padding: var(--space-2) var(--space-4);
                    border: 0; border-radius: var(--radius-sm);
                    background: var(--color-primary); color: #fff;
                }
                button:hover:not(:disabled) { background: var(--color-primary-hover); }
                button:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: 2px; }
                button:disabled { background: var(--color-surface-alt); color: var(--color-text-muted); cursor: not-allowed; }
                @media (max-width: 640px) { .pie button { inline-size: 100%; } }
            </style>
            <section class="panel" aria-labelledby="titulo">
                <h3 id="titulo">Exámenes médicos</h3>
                <label class="filtro">
                    Filtrar por categoría
                    <select id="filtro-categoria"></select>
                </label>
                <fieldset>
                    <legend>Exámenes disponibles</legend>
                    <div id="lista"></div>
                </fieldset>
                <p id="estado" role="status" aria-live="polite"></p>
                <div class="pie">
                    <span id="contador" aria-live="polite">0 exámenes seleccionados</span>
                    <button type="button" id="btn-asignar" disabled aria-busy="false">
                        Asignar Exámenes Seleccionados
                    </button>
                </div>
            </section>
        `;

        this.shadowRoot.querySelector("#filtro-categoria").addEventListener("change", (e) => {
            this._categoria = e.target.value;
            this._pintarLista();
        });
        this.shadowRoot.querySelector("#lista").addEventListener("change", (e) => this._onCambioCheckbox(e));
        this.shadowRoot.querySelector("#btn-asignar").addEventListener("click", () => this.asignarSeleccionados());
    }
}

if (!customElements.get("lista-examenes-asignables")) {
    customElements.define("lista-examenes-asignables", ListaExamenesAsignables);
}

export default ListaExamenesAsignables;
