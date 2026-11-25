import { crearPlantilla } from "../dom.js";

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<style>
    :host {
        display: block;
    }

    footer {
        padding: 0.75rem 1rem;
        background-color: var(--color-superficie);
        border-block-start: 1px solid var(--color-borde);
        color: var(--color-texto);
        font-size: 0.75rem;
        text-align: center;
    }
</style>
<footer></footer>
`);

export default class PieApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        if (!this.shadowRoot.firstChild) {
            this.shadowRoot.adoptedStyleSheets = [estilos];
            this.shadowRoot.append(plantilla.content.cloneNode(true));
        }

        const footer = this.shadowRoot.querySelector("footer");
        footer.textContent = `© GalenoSV v1.0 ${new Date().getFullYear()}`;
    }
}

customElements.define("pie-app", PieApp);
