export default class PieApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                }

                footer {
                    padding: 0.75rem 1rem;
                    background-color: var(--color-superficie);
                    border-top: 1px solid var(--color-borde);
                    color: var(--color-texto);
                    font-size: 0.75rem;
                    text-align: center;
                }
            </style>
            <footer></footer>
        `;

        const footer = this.shadowRoot.querySelector("footer");
        footer.textContent = `© GalenoSV v1.0 ${new Date().getFullYear()}`;
    }
}

customElements.define("pie-app", PieApp);
