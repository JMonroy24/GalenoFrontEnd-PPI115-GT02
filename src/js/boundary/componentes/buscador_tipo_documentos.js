import TipoDocumentoService from "../../control/tipo_documento_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

export default class BuscadorTipoDocumentos extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.tipoDocumentoService = new TipoDocumentoService();
    }

    connectedCallback() {
        this.tipoDocumentoService.findRange(0, 50)
            .then((respuesta) => {
                this.shadowRoot.innerHTML = `
                    <link rel="stylesheet" href="recursos/estilos/principal.css">
                    <select class="form-control"></select>
                `;

                const select = this.shadowRoot.querySelector("select");

                respuesta.datos.forEach((tipoDocumento) => {
                    const opcion = document.createElement("option");
                    opcion.value = tipoDocumento.id;
                    opcion.textContent = tipoDocumento.nombre;
                    select.appendChild(opcion);
                });

                select.addEventListener("change", (evento) => {
                    this.dispatchEvent(new CustomEvent("tipo-documento-cambiado", {
                        detail: evento.target.value,
                        bubbles: true,
                        composed: true
                    }));
                });
            })
            .catch((err) => {
                this.dispatchEvent(GeneradorMensajes.crearMensaje(
                    "Error al cargar tipos de documento",
                    err.mensaje,
                    "ERROR",
                    "buscador_tipo_documentos"
                ));
            });
    }

    get value() {
        const select = this.shadowRoot.querySelector("select");
        return select ? select.value : "";
    }
}

customElements.define("buscador-tipo-documentos", BuscadorTipoDocumentos);
