import ConsultaService from "../control/consulta_service.js";
import GeneradorMensajes from "../control/generador_mensajes.js";
import "./componentes/tarjeta_consulta.js";

export default class BusquedaConsultaModel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        this.consultaService = new ConsultaService();

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <div id="main"></div>
        `;

        this.cargar();
    }

    cargar() {
        const main = this.shadowRoot.querySelector("#main");
        if (!main) {
            return;
        }

        main.replaceChildren();

        this.consultaService.findRange(0, 10)
            .then((resp) => {
                resp.datos.forEach((consulta) => {
                    const tarjeta = document.createElement("tarjeta-consulta");
                    tarjeta.consulta = consulta;
                    main.appendChild(tarjeta);
                });
            })
            .catch((err) => {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar consultas",
                    err.mensaje,
                    "error"
                );
            });
    }
}

customElements.define("busqueda-consulta-model", BusquedaConsultaModel);
