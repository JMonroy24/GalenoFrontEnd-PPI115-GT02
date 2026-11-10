import "./instalador_app.js";

export default class EncabezadoApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.alContexto = () => this.render();
    }

    connectedCallback() {
        this.render();
        window.addEventListener("contexto-seleccionado", this.alContexto);
    }

    disconnectedCallback() {
        window.removeEventListener("contexto-seleccionado", this.alContexto);
    }

    render() {
        let contexto = null;
        try {
            const guardado = sessionStorage.getItem("contexto");
            contexto = guardado ? JSON.parse(guardado) : null;
        } catch (err) {
            contexto = null;
        }

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                }

                .barra {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background-color: var(--color-superficie);
                    border-bottom: 1px solid var(--color-borde);
                    color: var(--color-texto);
                }

                #btnMenu {
                    display: none;
                    flex-direction: column;
                    gap: 3px;
                    padding: 0.5rem;
                }

                #btnMenu .linea {
                    display: block;
                    width: 18px;
                    height: 2px;
                    background-color: var(--color-texto);
                }

                .marca {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .logo {
                    width: 32px;
                    height: 32px;
                    object-fit: contain;
                }

                .titulo {
                    font-size: 1.125rem;
                    font-weight: 700;
                }

                .contexto {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-left: auto;
                }

                @media (max-width: 800px) {
                    #btnMenu {
                        display: inline-flex;
                    }
                }
            </style>
            <header class="barra">
                <button id="btnMenu" class="btn" type="button" aria-label="Alternar menú">
                    <span class="linea"></span>
                    <span class="linea"></span>
                    <span class="linea"></span>
                </button>
                <div class="marca">
                    <img class="logo" src="recursos/imagenes/galenosv-logo.png" alt="GalenoSV">
                    <span class="titulo">GalenoSV</span>
                </div>
                <div class="contexto">
                    <span id="textoContexto"></span>
                    <button id="btnCambiarRol" class="btn" type="button">Cambiar rol</button>
                    <button id="btnCerrarSesion" class="btn" type="button">Cerrar sesión</button>
                </div>
                <instalador-app></instalador-app>
            </header>
        `;

        const textoContexto = this.shadowRoot.querySelector("#textoContexto");
        if (contexto) {
            const nombreClinica = contexto.nombreClinica ?? "";
            const nombreRol = contexto.nombreRol ?? "";
            textoContexto.textContent = `${nombreClinica} / ${nombreRol}`;
        } else {
            textoContexto.textContent = "Sin sesión";
        }

        const btnMenu = this.shadowRoot.querySelector("#btnMenu");
        btnMenu.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("alternar-menu", {
                bubbles: true,
                composed: true
            }));
        });

        const navegarALogin = () => {
            sessionStorage.removeItem("contexto");
            this.dispatchEvent(new CustomEvent("navegar", {
                detail: "login",
                bubbles: true,
                composed: true
            }));
        };

        const btnCambiarRol = this.shadowRoot.querySelector("#btnCambiarRol");
        const btnCerrarSesion = this.shadowRoot.querySelector("#btnCerrarSesion");
        btnCambiarRol.addEventListener("click", navegarALogin);
        btnCerrarSesion.addEventListener("click", navegarALogin);
    }
}

customElements.define("encabezado-app", EncabezadoApp);
