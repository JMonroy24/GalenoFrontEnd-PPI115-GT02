import { tipoDocumentoService } from "../../control/tipo_documento_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

export class BuscadorTipoDocumentos extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.items = [];
    }

    async connectedCallback() {
        this._renderEstructura();

        try {
            const respuesta = await tipoDocumentoService.findRange();
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
            GeneradorMensajes.crearMensaje(
                "Error al cargar tipos de documento",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _renderEstructura() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                }
                label {
                    display: block;
                    margin-bottom: 0.35rem;
                    font-weight: 600;
                }
            </style>
            <label for="tipo-documento">Tipo de documento</label>
            <select id="tipo-documento" class="form-control" aria-label="Tipo de documento"></select>
        `;

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
        });
    }

    _cargarOpciones() {
        const select = this.shadowRoot.querySelector("select");

        if (!select) {
            return;
        }

        select.replaceChildren();

        this.items.forEach((tipoDocumento) => {
            const opcion = document.createElement("option");
            opcion.value = String(this._valorItem(tipoDocumento));
            opcion.textContent = this._nombreItem(tipoDocumento);
            select.appendChild(opcion);
        });
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
