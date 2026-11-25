import { crearPlantilla } from "../dom.js";
import { tipoDocumentoService } from "../../control/tipo_documento_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<style>
    :host {
        display: block;
    }
    label {
        display: block;
        margin-block-end: 0.35rem;
        font-weight: 600;
    }
</style>
<label for="tipo-documento">Tipo de documento</label>
<select id="tipo-documento" class="form-control" aria-label="Tipo de documento" aria-busy="true" disabled>
    <option value="">Cargando tipos de documento…</option>
</select>
`);

export class BuscadorTipoDocumentos extends HTMLElement {
    #eventos = new AbortController();
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.items = [];
        this._solicitudActual = 0;
    }

    async connectedCallback() {
        this._renderEstructura();
        const solicitud = ++this._solicitudActual;

        try {
            const respuesta = await tipoDocumentoService.findRange();
            if (solicitud !== this._solicitudActual || !this.isConnected) return;
            const items = Array.isArray(respuesta?.items)
                ? respuesta.items
                : Array.isArray(respuesta?.datos)
                    ? respuesta.datos
                    : Array.isArray(respuesta)
                        ? respuesta
                        : [];

            this.items = items.filter((tipoDocumento) => tipoDocumento?.activo !== false);
            this._cargarOpciones();
        } catch (error) {
            if (solicitud !== this._solicitudActual || !this.isConnected) return;
            const select = this.shadowRoot.querySelector("select");
            select.setAttribute("aria-busy", "false");
            select.options[0].textContent = "No se pudieron cargar los tipos de documento";
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar tipos de documento",
                    error?.mensaje ?? error?.message ?? "",
                    "error"
                );
            }
        }
    }

    disconnectedCallback() {
        this.#eventos.abort();

        this._solicitudActual++;
    }

    _renderEstructura() {
        this.#eventos.abort();
        this.#eventos = new AbortController();
        if (!this.shadowRoot.firstChild) {
            this.shadowRoot.adoptedStyleSheets = [estilos];
            this.shadowRoot.append(plantilla.content.cloneNode(true));
        }

        const select = this.shadowRoot.querySelector("select");

        select.addEventListener("change", () => {
            const value = select.value;
            const item = this.items.find(
                (tipoDocumento) => String(this._valorItem(tipoDocumento)) === value
            ) ?? null;

            this.dispatchEvent(new CustomEvent("tipo-documento-change", {
                bubbles: true,
                composed: true,
                detail: { value, item }
            }));
        }, { signal: this.#eventos.signal });
    }

    _cargarOpciones() {
        const select = this.shadowRoot.querySelector("select");

        if (!select) {
            return;
        }

        const seleccionado = select.value;
        select.replaceChildren();
        select.setAttribute("aria-busy", "false");
        select.disabled = this.items.length === 0;

        if (this.items.length === 0) {
            const opcion = document.createElement("option");
            opcion.value = "";
            opcion.textContent = "No hay tipos de documento disponibles";
            select.appendChild(opcion);
            return;
        }

        if (this.hasAttribute("seleccion-explicita")) {
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Seleccione un tipo de documento";
            select.appendChild(placeholder);
        }

        this.items.forEach((tipoDocumento) => {
            const opcion = document.createElement("option");
            opcion.value = String(this._valorItem(tipoDocumento));
            opcion.textContent = this._nombreItem(tipoDocumento);
            select.appendChild(opcion);
        });
        if ([...select.options].some(opcion => opcion.value === seleccionado)) {
            select.value = seleccionado;
        }
    }

    _valorItem(tipoDocumento) {
        return tipoDocumento?.id
            ?? tipoDocumento?.idTipoDocumento
            ?? tipoDocumento?.codigo
            ?? tipoDocumento?.code
            ?? "";
    }

    _nombreItem(tipoDocumento) {
        return tipoDocumento?.nombre
            ?? tipoDocumento?.name
            ?? tipoDocumento?.descripcion
            ?? "";
    }

    get value() {
        const select = this.shadowRoot.querySelector("select");
        return select ? select.value : "";
    }
}

export default BuscadorTipoDocumentos;

customElements.define("buscador-tipo-documentos", BuscadorTipoDocumentos);
