import { parseRouteParams } from "../../router.js";

const MENU = {
    "Atención clínica": [
        { id: "buscar-citas", texto: "Buscar Citas" },
        { id: "dashboard", texto: "Dashboard de Consultas" },
        { id: "atencion", texto: "Atención Médica" }
    ],
    "Sesión": [
        { id: "login", texto: "Iniciar Sesión / Cambiar Rol" }
    ]
};

export class MenuLateral extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.alCambiarRuta = () => this._actualizarRutaActiva();
    }

    connectedCallback() {
        this.render();
        window.addEventListener("hashchange", this.alCambiarRuta);
    }

    disconnectedCallback() {
        window.removeEventListener("hashchange", this.alCambiarRuta);
    }

    _actualizarRutaActiva() {
        const { route } = parseRouteParams(window.location.hash);
        const rutaActual = route || "buscar-citas";
        this.shadowRoot.querySelectorAll("a").forEach((enlace) => {
            const activo = enlace.hash === `#${rutaActual}`;
            enlace.classList.toggle("activo", activo);
            if (activo) {
                enlace.setAttribute("aria-current", "page");
            } else {
                enlace.removeAttribute("aria-current");
            }
        });
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    width: 100%;
                }
                nav {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                }
                .seccion-titulo {
                    margin: 0;
                    padding: 0 var(--space-3, 0.75rem);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted, #475569);
                }
                ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1, 0.25rem);
                }
                a {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3, 0.75rem);
                    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                    border-radius: var(--radius-md, 0.5rem);
                    color: var(--color-text, #0f172a);
                    text-decoration: none;
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 500;
                    transition: background-color var(--transition-fast, 150ms ease),
                                color var(--transition-fast, 150ms ease);
                }
                a:hover {
                    background-color: var(--color-surface-alt, #e2e8f0);
                    color: var(--color-primary, #1e3a8a);
                }
                a.activo {
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                }
            </style>
            <nav aria-label="Menú principal">
                ${Object.entries(MENU).map(([seccion, items]) => `
                    <section>
                        <h3 class="seccion-titulo">${seccion}</h3>
                        <ul>
                            ${items.map((item) => `
                                <li>
                                    <a
                                        href="#${item.id}"
                                    >
                                        ${item.texto}
                                    </a>
                                </li>
                            `).join("")}
                        </ul>
                    </section>
                `).join("")}
            </nav>
        `;
        this._actualizarRutaActiva();
    }
}

customElements.define("menu-lateral", MenuLateral);
