export default class TarjetaSimple extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.renderizado = false;
    }

    connectedCallback() {
        if (this.renderizado) {
            return;
        }

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    border: 1px solid #dddddd;
                    border-radius: 8px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
                }
                .header,
                .body,
                .footer {
                    padding: 0.75rem 1rem;
                }
            </style>
            <div class="header"><slot name="titulo">Agregar Encabezado</slot></div>
            <div class="body"><slot name="contenido">Agregar Contenido</slot></div>
            <div class="footer"><slot name="pie">Agregar Pie</slot></div>
        `;

        this.renderizado = true;
    }
}

customElements.define("tarjeta-simple", TarjetaSimple);
