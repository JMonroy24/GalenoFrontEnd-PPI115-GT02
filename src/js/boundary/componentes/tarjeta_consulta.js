import "./tarjeta_simple.js";

export default class TarjetaConsulta extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._consulta = null;
    }

    get consulta() {
        return this._consulta;
    }

    set consulta(valor) {
        this._consulta = valor;
        if (this.isConnected) {
            this.render();
        }
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.replaceChildren();

        if (!this._consulta) {
            return;
        }

        const consulta = this._consulta;

        const enlace = document.createElement("link");
        enlace.rel = "stylesheet";
        enlace.href = "recursos/estilos/principal.css";

        const tarjeta = document.createElement("tarjeta-simple");

        const titulo = document.createElement("h3");
        titulo.slot = "titulo";
        titulo.textContent = `Consulta #${consulta.idConsulta}`;

        const contenido = document.createElement("p");
        contenido.slot = "contenido";
        contenido.textContent = `Paciente: ${consulta.idPersonaRol?.idPersona?.nombres ?? "Sin dato"}`;

        const pie = document.createElement("div");
        pie.slot = "pie";

        const boton = document.createElement("button");
        boton.id = "btnVerDetalle";
        boton.textContent = "Ver Detalle";

        boton.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("ver-detalle", {
                detail: this._consulta,
                bubbles: true,
                composed: true
            }));
        });

        pie.appendChild(boton);
        tarjeta.appendChild(titulo);
        tarjeta.appendChild(contenido);
        tarjeta.appendChild(pie);

        this.shadowRoot.appendChild(enlace);
        this.shadowRoot.appendChild(tarjeta);
    }
}

customElements.define("tarjeta-consulta", TarjetaConsulta);
