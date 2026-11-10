import PersonaService from "../../control/persona_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

export default class BuscadorPersona extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.personaService = new PersonaService();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <section class="tarjeta">
                <h2>Buscar citas</h2>
                <p class="subtitulo">Buscar por DUI</p>
                <div class="campo">
                    <input type="text" id="dui" placeholder="Ingrese el numero de dui incluyendo guion">
                </div>
                <div class="acciones">
                    <button id="btnBuscar" type="button">Buscar</button>
                    <button id="btnCancelar" type="button">Cancelar</button>
                </div>
            </section>
        `;

        const inputDui = this.shadowRoot.querySelector("#dui");
        const btnBuscar = this.shadowRoot.querySelector("#btnBuscar");
        const btnCancelar = this.shadowRoot.querySelector("#btnCancelar");

        btnBuscar.addEventListener("click", () => {
            const dui = inputDui.value.trim();
            this.personaService.buscarPorDui(dui)
                .then((persona) => {
                    if (persona) {
                        this.dispatchEvent(new CustomEvent("persona-encontrada", {
                            detail: persona,
                            bubbles: true,
                            composed: true
                        }));
                    } else {
                        this.dispatchEvent(GeneradorMensajes.crearMensaje(
                            "No se encontró ninguna persona con ese DUI",
                            "",
                            "INFO",
                            "buscador_persona"
                        ));
                    }
                })
                .catch((err) => {
                    this.dispatchEvent(GeneradorMensajes.crearMensaje(
                        "Error al buscar persona",
                        err.mensaje,
                        "ERROR",
                        "buscador_persona"
                    ));
                });
        });

        btnCancelar.addEventListener("click", () => {
            inputDui.value = "";
            this.dispatchEvent(new CustomEvent("busqueda-cancelada", {
                bubbles: true,
                composed: true
            }));
        });
    }
}

customElements.define("buscador-persona", BuscadorPersona);
