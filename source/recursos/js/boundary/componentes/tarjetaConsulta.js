export default class TarjetaConsulta extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    font-family: Arial, sans-serif;
                    color: #1f2937;
                }

                .tarjeta {
                    background: #ffffff;
                    border: 1px solid #dfe7ef;
                    border-radius: 12px;
                    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
                    overflow: hidden;
                }

                .cabecera {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    background: linear-gradient(135deg, #eff6ff, #f8fafc);
                    border-bottom: 1px solid #e5e7eb;
                }

                .titulo {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0;
                }

                .estado {
                    padding: 0.35rem 0.7rem;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    background: #dbeafe;
                    color: #1d4ed8;
                }

                .cuerpo {
                    padding: 1rem 1.25rem;
                }

                .pie {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 0 1.25rem 1rem;
                }

                ::slotted(*) {
                    box-sizing: border-box;
                }
            </style>

            <article class="tarjeta">
                <header class="cabecera">
                    <slot name="cabecera"></slot>
                    <span class="estado"><slot name="estado"></slot></span>
                </header>

                <div class="cuerpo">
                    <slot name="contenido"></slot>
                </div>

                <footer class="pie">
                    <slot name="footer"></slot>
                </footer>
            </article>
        `;
    }
}

if (!customElements.get("tarjeta-consulta")) {
    customElements.define("tarjeta-consulta", TarjetaConsulta);
}
