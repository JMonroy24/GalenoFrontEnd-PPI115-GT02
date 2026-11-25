import { crearPlantilla, escaparHtml as escapar } from "../dom.js";
import { ordenExamenService } from "../../control/orden_examen_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

const CATEGORIA_POR_DEFECTO = "General";
const TODAS = "__todas__";

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<style>
    :host { display: block;
        min-inline-size: 0;
        container: examenes / inline-size; }
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
    fieldset { border: 0; margin: 0; padding: 0; min-inline-size: 0; }
    legend { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
    #lista {
        display: grid; gap: var(--space-2);
        max-block-size: min(24rem, 60dvh); overflow-y: auto;
        overscroll-behavior: contain; scrollbar-gutter: stable;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
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
    .examen-nombre { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; font-size: var(--text-sm); }
    .examen-cat { min-inline-size: 0; overflow-wrap: anywhere; font-size: var(--text-xs); color: var(--color-text-muted); }
    .vacio, #estado { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
    .aviso-offline {
        margin: 0;
        padding: var(--space-2, 0.5rem);
        border: 1px solid var(--color-warning, #b45309);
        border-radius: var(--radius-sm, 0.375rem);
        background: var(--color-warning-soft, #fef3c7);
        font-size: var(--text-sm, 0.875rem);
    }
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
    @container examenes (inline-size < 36rem) { .pie button { inline-size: 100%; } }
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
    <p id="aviso-offline" class="aviso-offline" role="status" aria-live="polite" hidden>
        Sin conexión: la asignación de exámenes está deshabilitada. La selección se conserva.
    </p>
    <div class="pie">
        <span id="contador" aria-live="polite">0 exámenes seleccionados</span>
        <button type="button" id="btn-asignar" disabled aria-busy="false">
            Asignar Exámenes Seleccionados
        </button>
    </div>
</section>
`);

/**
 * <lista-examenes-asignables id-consulta="..." id-paso="...">
 * Panel de exámenes asignables con filtro por categoría, casillas de selección
 * y botón "Asignar Exámenes Seleccionados". Las órdenes se registran de forma
 * asíncrona contra el paso activo de la consulta.
 *
 * Eventos (bubbles + composed):
 *  - "ordenes-asignadas": detail { idConsulta, idPaso, ordenes, examenes }
 *
 * El servicio puede inyectarse (propiedad ordenExamenService) para facilitar
 * las pruebas unitarias.
 */
export class ListaExamenesAsignables extends HTMLElement {
    #eventos = new AbortController();
    static get observedAttributes() {
        return ["id-consulta", "id-paso", "id-paso-clinico", "id-procedimiento-paso", "solo-lectura", "sin-conexion"];
    }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.ordenExamenService = ordenExamenService;
        this._paso = null;
        this._reflejandoPaso = false;
        this._examenes = [];
        this._seleccion = new Set();
        this._categoria = TODAS;
        this._enviando = false;
        this._cargado = false;
        this._cargaActual = 0;
        this._estructuraLista = false;
        this._conexionActual = 0;
        this._cargaProgramada = null;
    }

    get idConsulta() {
        return this.getAttribute("id-consulta");
    }

    set idConsulta(valor) {
        if (valor == null || valor === "") this.removeAttribute("id-consulta");
        else this.setAttribute("id-consulta", String(valor));
    }

    get idPaso() {
        return this.getAttribute("id-paso-clinico") ?? this.getAttribute("id-paso");
    }

    set idPaso(valor) {
        const anterior = this.idPaso;
        this._reflejandoPaso = true;
        try {
            this.removeAttribute("id-paso-clinico");
            if (valor == null || valor === "") this.removeAttribute("id-paso");
            else this.setAttribute("id-paso", String(valor));
        } finally {
            this._reflejandoPaso = false;
        }
        if (anterior !== this.idPaso) this._actualizarContexto(true);
    }

    get sinConexion() {
        return this.hasAttribute("sin-conexion");
    }

    get idProcedimientoPaso() {
        return this.getAttribute('id-procedimiento-paso');
    }

    get soloLectura() { return this.hasAttribute('solo-lectura'); }

    set soloLectura(valor) { this.toggleAttribute('solo-lectura', Boolean(valor)); }

    set sinConexion(valor) {
        this.toggleAttribute("sin-conexion", Boolean(valor));
    }

    get paso() {
        return this._paso;
    }

    set paso(valor) {
        this._paso = valor ?? null;
        const idDefinicion = valor?.idProcedimientoPaso?.id ?? valor?.idProcedimientoPaso;
        if (idDefinicion != null) this.setAttribute('id-procedimiento-paso', String(idDefinicion));
        else this.removeAttribute('id-procedimiento-paso');
        this.idPaso = valor?.idConsultaProcedimientoPaso
            ?? valor?.idPaso
            ?? valor?.idPasoClinico
            ?? valor?.id
            ?? null;
    }

    attributeChangedCallback(nombre, valorViejo, valorNuevo) {
        if (valorViejo === valorNuevo || this._reflejandoPaso) return;
        if (!this._estaListo()) return;

        if (nombre === "sin-conexion" || nombre === 'solo-lectura') {
            if (this.soloLectura) this._limpiarSeleccion();
            this._actualizarBoton();
            return;
        }

        const cambioPaso = nombre === "id-paso" || nombre === "id-paso-clinico" || nombre === 'id-procedimiento-paso';

        this._actualizarContexto(cambioPaso);
    }

    _actualizarContexto(cambioPaso) {
        this._seleccion.clear();
        if (!this._estaListo()) return;
        if (cambioPaso) {
            this.cargarExamenes();
        } else {
            this._limpiarSeleccion();
            this._actualizarBoton();
        }
    }

    disconnectedCallback() {
        this.#eventos.abort();

        this._cargaActual += 1;
        this._conexionActual += 1;
        this._estructuraLista = false;
        this._cargaProgramada = null;
    }

    _limpiarSeleccion() {
        this._seleccion.clear();
        if (!this._estaListo()) return;
        this.shadowRoot?.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.checked = false;
        });
    }

    async connectedCallback() {
        this._conexionActual += 1;
        this._renderEstructura();
        await this.cargarExamenes();
    }

    _estaListo() {
        return this.isConnected && this._estructuraLista;
    }

    /** Devuelve los ids de los exámenes marcados. */
    obtenerSeleccionados() {
        return [...this._seleccion];
    }

    cargarExamenes() {
        if (!this._estaListo()) return Promise.resolve();
        // Invalida la respuesta anterior antes de agrupar las mutaciones de atributos.
        this._cargaActual += 1;
        this._limpiarSeleccion();
        this._cargado = false;
        this._actualizarBoton();
        if (!this._cargaProgramada) {
            const conexion = this._conexionActual;
            const pendiente = Promise.resolve().then(() => {
                if (this._cargaProgramada === pendiente) this._cargaProgramada = null;
                if (conexion !== this._conexionActual || !this._estaListo()) return;
                return this._cargarExamenesActuales();
            });
            this._cargaProgramada = pendiente;
        }
        return this._cargaProgramada;
    }

    async _cargarExamenesActuales() {
        if (!this._estaListo()) return;
        const idPaso = this.idProcedimientoPaso;
        const carga = ++this._cargaActual;

        this._limpiarSeleccion();

        if (idPaso === null || idPaso === undefined || idPaso === "") {
            this._examenes = [];
            this._cargado = true;
            this._estado("Seleccione un paso para ver los exámenes.");
            this._pintarCategorias();
            this._pintarLista();
            return;
        }

        this._cargado = false;
        this._actualizarBoton();
        this._estado("Cargando exámenes…");

        try {
            const respuesta = await this.ordenExamenService.listarExamenesPorPaso(idPaso);

            if (carga !== this._cargaActual || !this._estaListo()) {
                return;
            }

            this._limpiarSeleccion();
            const items = Array.isArray(respuesta)
                ? respuesta
                : Array.isArray(respuesta?.items) ? respuesta.items : [];

            this._examenes = items
                .filter((e) => e?.activo !== false)
                .map((e) => this._normalizar(e));
            this._cargado = true;
            this._estado("");
            this._pintarCategorias();
            this._pintarLista();
        } catch (error) {
            if (carga !== this._cargaActual || !this._estaListo()) {
                return;
            }

            this._examenes = [];
            this._cargado = true;
            this._estado("No se pudieron cargar los exámenes.");
            this._pintarCategorias();
            this._pintarLista();
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar exámenes",
                    error?.mensaje ?? error?.message ?? "",
                    "error"
                );
            }
        }
    }

    _normalizar(examen) {
        return {
            id: String(examen?.idExamen ?? examen?.id ?? ""),
            idExamen: examen?.idExamen ?? examen?.id,
            nombre: examen?.nombre ?? examen?.descripcion ?? "Examen sin nombre",
            categoria: String(examen?.categoria || CATEGORIA_POR_DEFECTO),
            indicaciones: examen?.indicaciones ?? ""
        };
    }

    _visibles() {
        const examenes = Array.isArray(this._examenes) ? this._examenes : [];
        return this._categoria === TODAS
            ? examenes
            : examenes.filter((e) => e && e.categoria === this._categoria);
    }

    _contextoPaso() {
        const idPaso = this.idPaso;

        if (idPaso === null || idPaso === undefined || idPaso === "") {
            return null;
        }

        return { idPaso, idConsultaProcedimientoPaso: idPaso, idProcedimientoPaso: this.idProcedimientoPaso };
    }

    _estado(texto) {
        if (!this._estaListo()) return;
        const nodo = this.shadowRoot.querySelector("#estado");

        if (nodo) {
            nodo.textContent = texto;
        }
    }

    _pintarCategorias() {
        const select = this.shadowRoot.querySelector("#filtro-categoria");
        if (!this._estaListo() || !select) return;
        const examenes = Array.isArray(this._examenes) ? this._examenes : [];
        const categorias = [...new Set(examenes.map((e) => e?.categoria).filter(Boolean))].sort();

        if (this._categoria !== TODAS && !categorias.includes(this._categoria)) this._categoria = TODAS;
        select.innerHTML = [
            `<option value="${TODAS}">Todas las categorías</option>`,
            ...categorias.map((c) => `<option value="${escapar(c)}">${escapar(c)}</option>`)
        ].join("");
        select.value = this._categoria;
    }

    _pintarLista() {
        const contenedor = this.shadowRoot.querySelector("#lista");
        if (!this._estaListo() || !contenedor) return;
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
        const contador = this.shadowRoot?.querySelector("#contador");

        if (!this._estaListo() || !boton || !contador) {
            return;
        }

        const cantidad = this._seleccion.size;
        const aviso = this.shadowRoot?.querySelector("#aviso-offline");

        if (aviso) aviso.hidden = !this.sinConexion;
        boton.disabled = this.sinConexion || this.soloLectura || !this.idProcedimientoPaso
            || !this._cargado
            || this._enviando
            || cantidad === 0
            || !this.idConsulta
            || !this.idPaso;
        boton.setAttribute("aria-busy", String(this._enviando));
        this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.disabled = this.soloLectura || this.sinConexion || this._enviando || !this._cargado;
        });
        contador.textContent =
            cantidad === 1 ? "1 examen seleccionado" : `${cantidad} exámenes seleccionados`;
    }

    _onCambioCheckbox(evento) {
        const input = evento.target;

        if (input.type !== "checkbox" || this.soloLectura || this.sinConexion || this._enviando || !this._cargado) {
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
        const contexto = this._contextoPaso();

        if (this.soloLectura || this.sinConexion || this._enviando || this._seleccion.size === 0
            || !this.idConsulta || !this.idProcedimientoPaso || !contexto) {
            return;
        }

        const ids = this.obtenerSeleccionados();
        const seleccionados = ids.map((id) => this._examenes.find((examen) => examen.id === id));
        if (seleccionados.some((examen) => !examen)) return;
        const idConsulta = this.idConsulta;

        this._enviando = true;
        this._actualizarBoton();

        try {
            const servicio = this.ordenExamenService;
            const idPaso = contexto.idConsultaProcedimientoPaso;
            const ordenes = typeof servicio.crearOrdenes === "function"
                ? await servicio.crearOrdenes(idPaso, seleccionados)
                : await servicio.asignarOrdenes(idPaso, seleccionados);

            GeneradorMensajes.crearMensaje(
                "Exámenes asignados",
                `Se registraron ${ids.length} orden(es) de examen.`,
                "success"
            );
            this._estado(`${ids.length} orden(es) registradas correctamente.`);
            this.dispatchEvent(new CustomEvent("ordenes-asignadas", {
                bubbles: true,
                composed: true,
                detail: {
                    idConsulta,
                    ...contexto,
                    ordenes,
                    examenes: ids
                }
            }));
            if (String(this.idConsulta) === String(idConsulta)
                && String(this.idPaso ?? "") === String(contexto.idPaso ?? "")) {
                ids.forEach((id) => this._seleccion.delete(id));
                this._pintarLista();
            }
        } catch (error) {
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "No se pudieron asignar los exámenes",
                    error?.mensaje ?? error?.message ?? "Intente nuevamente.",
                    "error"
                );
            }
            this._estado("No se pudieron asignar los exámenes.");
        } finally {
            this._enviando = false;
            this._actualizarBoton();
        }
    }

    _renderEstructura() {
        this.#eventos.abort();
        this.#eventos = new AbortController();
        this._estructuraLista = false;
        if (!this.shadowRoot.firstChild) {
            this.shadowRoot.adoptedStyleSheets = [estilos];
            this.shadowRoot.append(plantilla.content.cloneNode(true));
        }

        this.shadowRoot.querySelector("#filtro-categoria").addEventListener("change", (e) => {
            this._categoria = e.target.value;
            this._pintarLista();
        }, { signal: this.#eventos.signal });
        this.shadowRoot.querySelector("#lista").addEventListener("change", (e) => this._onCambioCheckbox(e), { signal: this.#eventos.signal });
        this.shadowRoot.querySelector("#btn-asignar").addEventListener("click", () => this.asignarSeleccionados(), { signal: this.#eventos.signal });
        this._estructuraLista = true;
    }
}

if (!customElements.get("lista-examenes-asignables")) {
    customElements.define("lista-examenes-asignables", ListaExamenesAsignables);
}

export default ListaExamenesAsignables;
