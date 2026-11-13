const MENU = {
    "Atención clínica": [
        { id: "buscar-citas", texto: "Consultas" }
    ],
    "Cambiar rol": [
        { id: "login", texto: "Cambiar rol" }
    ]
};

export default class MenuLateral extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.activo = null;
        this.alAlternarMenu = () => {
            this.toggleAttribute("abierto");
        };
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    height: 100%;
                }

                nav {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    height: 100%;
                    padding: 1rem 0.75rem;
                    overflow-y: auto;
                    background-color: var(--color-superficie);
                    border-right: 1px solid var(--color-borde);
                }

                h4 {
                    margin: 0.75rem 0 0.25rem;
                    color: var(--color-primario);
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }

                h4:first-child {
                    margin-top: 0;
                }

                button {
                    display: block;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: none;
                    border-radius: var(--radio);
                    background-color: var(--color-superficie);
                    color: var(--color-texto);
                    font: inherit;
                    text-align: left;
                    cursor: pointer;
                }

                button.activo {
                    background-color: var(--color-primario-claro);
                    color: var(--color-primario);
                    font-weight: 600;
                }

                @media (max-width: 800px) {
                    nav {
                        display: none;
                    }

                    :host([abierto]) nav {
                        display: flex;
                    }
                }
            </style>
        `;

        const nav = document.createElement("nav");
        this.shadowRoot.appendChild(nav);

        Object.entries(MENU).forEach(([grupo, items]) => {
            const titulo = document.createElement("h4");
            titulo.textContent = grupo;
            nav.appendChild(titulo);

            items.forEach((item) => {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.dataset.id = item.id;
                boton.textContent = item.texto;
                boton.addEventListener("click", () => {
                    this.marcarActivo(item.id);
                    this.dispatchEvent(new CustomEvent("navegar", {
                        detail: item.id,
                        bubbles: true,
                        composed: true
                    }));
                });
                nav.appendChild(boton);
            });
        });

        if (this.activo) {
            this.marcarActivo(this.activo);
        }

        window.addEventListener("alternar-menu", this.alAlternarMenu);
    }

    disconnectedCallback() {
        window.removeEventListener("alternar-menu", this.alAlternarMenu);
    }

    marcarActivo(id) {
        this.activo = id;
        const botones = this.shadowRoot.querySelectorAll("nav button");
        botones.forEach((boton) => {
            boton.classList.toggle("activo", boton.dataset.id === id);
        });
    }
}

customElements.define("menu-lateral", MenuLateral);
