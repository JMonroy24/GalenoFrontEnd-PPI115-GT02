import ClinicaService from "../control/clinica_service.js";
import RolService from "../control/rol_service.js";
import GeneradorMensajes from "../control/generador_mensajes.js";

export default class LoginModel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.clinicaService = new ClinicaService();
        this.rolService = new RolService();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <select id="selClinica" class="form-control"></select>
            <select id="selRol" class="form-control"></select>
            <button id="btnEntrar">Entrar</button>
        `;

        const selClinica = this.shadowRoot.querySelector("#selClinica");
        const selRol = this.shadowRoot.querySelector("#selRol");
        const btnEntrar = this.shadowRoot.querySelector("#btnEntrar");

        this.clinicaService.findRange(0, 100)
            .then((respuesta) => {
                respuesta.items.forEach((clinica) => {
                    const opcion = document.createElement("option");
                    opcion.value = clinica.idClinica ?? clinica.id;
                    opcion.textContent = clinica.nombre;
                    selClinica.appendChild(opcion);
                });
            })
            .catch((err) => {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar clínicas",
                    err.mensaje,
                    "error"
                );
            });

        this.rolService.findRange(0, 100)
            .then((respuesta) => {
                respuesta.items.forEach((rol) => {
                    const opcion = document.createElement("option");
                    opcion.value = rol.idRol ?? rol.id;
                    opcion.textContent = rol.nombre;
                    selRol.appendChild(opcion);
                });
            })
            .catch((err) => {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar roles",
                    err.mensaje,
                    "error"
                );
            });

        btnEntrar.addEventListener("click", () => {
            // Los nombres de campos id/nombre y la clave "contexto" son suposiciones.
            const contexto = {
                idClinica: selClinica.value,
                nombreClinica: selClinica.options[selClinica.selectedIndex]?.text ?? "",
                idRol: selRol.value,
                nombreRol: selRol.options[selRol.selectedIndex]?.text ?? ""
            };

            try {
                sessionStorage.setItem("contexto", JSON.stringify(contexto));
            } catch (err) {
                GeneradorMensajes.crearMensaje(
                    "Error al guardar el contexto",
                    err.mensaje,
                    "error"
                );
                return;
            }

            this.dispatchEvent(new CustomEvent("contexto-seleccionado", {
                detail: contexto,
                bubbles: true,
                composed: true
            }));
        });
    }
}

customElements.define("login-model", LoginModel);
