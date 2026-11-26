import { crearEstilos } from "../dom.js";
import { parseRouteParams } from "../../router.js";
import { store } from "../../store.js";
import { authService } from "../../control/auth_service.js";

const MENU = {
    "Atención clínica": [
        { id: "buscar-citas", texto: "Buscar Citas" },
        { id: "dashboard", texto: "Dashboard de Consultas" },
        { id: "atencion", texto: "Atención Médica" }
    ],
    "Sesión": [
        { id: "login", texto: "Iniciar sesión" }
    ]
};

const estilos = crearEstilos(`
:host {
    display: block;
    min-inline-size: 0;
    inline-size: 100%;
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
`);

export class MenuLateral extends HTMLElement {
    #eventos = new AbortController();
    #conexion = new AbortController();
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.alCambiarRuta = () => this._actualizarRutaActiva();
        this.alCambiarSesion = () => this._actualizarSesion();
    }

    connectedCallback() {
        this.#conexion.abort();
        this.#conexion = new AbortController();
        this.render();
        window.addEventListener("hashchange", this.alCambiarRuta, { signal: this.#conexion.signal });
        store.addEventListener("state-changed", this.alCambiarSesion, { signal: this.#conexion.signal });
    }

    disconnectedCallback() {
        this.#eventos.abort();
        this.#conexion.abort();

    }

    _actualizarSesion() {
        const enlace = this.shadowRoot.querySelector('a[href="#login"]');
        if (enlace) {
            enlace.textContent = store.hasActiveSession() ? "Cerrar sesión" : "Iniciar sesión";
        }
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
        this.#eventos.abort();
        this.#eventos = new AbortController();
        this.shadowRoot.adoptedStyleSheets = [estilos];
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <nav id="menu-lateral-nav" aria-label="Menú principal">
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
        this.shadowRoot.querySelector('a[href="#login"]').addEventListener("click", (evento) => {
            evento.preventDefault();
            if (store.hasActiveSession()) {
                authService.logout();
            }
            this.dispatchEvent(new CustomEvent("navegar", {
                detail: "login",
                bubbles: true,
                composed: true
            }));
        }, { signal: this.#eventos.signal });
        // Cerrar el menú al hacer clic en cualquier enlace (en móvil)
        this.shadowRoot.querySelector('nav').addEventListener("click", (evento) => {
            if (evento.target.closest('a')) {
                this.dispatchEvent(new CustomEvent("cerrar-menu", {
                    bubbles: true,
                    composed: true
                }));
            }
        }, { signal: this.#eventos.signal });
        this._actualizarSesion();
        this._actualizarRutaActiva();
    }
}

customElements.define("menu-lateral", MenuLateral);
