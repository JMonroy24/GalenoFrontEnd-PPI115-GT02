import "./instalador_app.js";
import { authService } from "../../control/auth_service.js";
import { store } from "../../store.js";

export default class EncabezadoApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.alContexto = () => this._actualizarSesion();
    }

    connectedCallback() {
        this.render();
        window.addEventListener("sesion-iniciada", this.alContexto);
        window.addEventListener("sesion-cerrada", this.alContexto);
        store.addEventListener("state-changed", this.alContexto);
    }

    disconnectedCallback() {
        window.removeEventListener("sesion-iniciada", this.alContexto);
        window.removeEventListener("sesion-cerrada", this.alContexto);
        store.removeEventListener("state-changed", this.alContexto);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    min-inline-size: 0;
                    container: encabezado / inline-size;
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
                    inline-size: 1.125rem;
                    height: 2px;
                    background-color: var(--color-texto);
                }

                .marca {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .logo {
                    inline-size: 2rem;
                    block-size: 2rem;
                    object-fit: contain;
                }

                .titulo {
                    font-size: 1.125rem;
                    font-weight: 700;
                }

                #textoContexto { min-inline-size: 0; overflow-wrap: anywhere; }
                .contexto {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-inline-start: auto;
                    min-inline-size: 0;
                    flex: 1 1 18rem;
                }

                [hidden] {
                    display: none !important;
                }

                @container encabezado (inline-size <= 50rem) {
                    #btnMenu {
                        display: inline-flex;
                    }
                }
            </style>
            <header class="barra">
                <button id="btnMenu" class="btn" type="button" aria-label="Alternar menú" aria-expanded="false">
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

        this._actualizarSesion();

        const btnMenu = this.shadowRoot.querySelector("#btnMenu");
        btnMenu.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("alternar-menu", {
                bubbles: true,
                composed: true
            }));
        });

        const navegar = (ruta) => {
            this.dispatchEvent(new CustomEvent("navegar", {
                detail: ruta,
                bubbles: true,
                composed: true
            }));
        };

        const btnCambiarRol = this.shadowRoot.querySelector("#btnCambiarRol");
        const btnCerrarSesion = this.shadowRoot.querySelector("#btnCerrarSesion");
        btnCambiarRol.addEventListener("click", () => navegar("dashboard"));
        btnCerrarSesion.addEventListener("click", () => {
            if (store.hasActiveSession()) {
                authService.logout();
            }
            navegar("login");
        });
    }

    _actualizarSesion() {
        const escribir = (nodo, texto) => {
            if (nodo.textContent !== texto) nodo.textContent = texto;
        };
        const estado = store.getState();
        let usuario = estado.usuario;
        let contexto = null;
        try {
            usuario ??= JSON.parse(sessionStorage.getItem("usuarioActivo") ?? "null");
            contexto = JSON.parse(sessionStorage.getItem("contexto") ?? "null");
        } catch {
            // El encabezado también debe funcionar sin almacenamiento disponible.
        }

        const textoContexto = this.shadowRoot.querySelector("#textoContexto");
        if (!textoContexto) return;
        const sesionActiva = store.hasActiveSession();
        this.shadowRoot.querySelector("#btnCambiarRol").hidden = !sesionActiva;
        escribir(this.shadowRoot.querySelector("#btnCerrarSesion"), sesionActiva
            ? "Cerrar sesión" : "Iniciar sesión");
        if (!usuario) {
            escribir(textoContexto, "Sin sesión");
            return;
        }

        const perfil = usuario.perfil ?? usuario.usuario ?? usuario.persona ?? usuario;
        const texto = (valor) => Array.isArray(valor) ? valor.filter(Boolean).join(" ") : String(valor ?? "").trim();
        const nombre = texto(perfil.nombreCompleto)
            || [texto(perfil.nombres ?? perfil.nombre), texto(perfil.apellidos ?? perfil.apellido)]
                .filter(Boolean).join(" ") || "Usuario";
        const clinica = estado.clinicaActiva;
        const rol = estado.rolSeleccionado?.rol
            ?? (typeof estado.rolSeleccionado?.idRol === "object"
                ? estado.rolSeleccionado.idRol : estado.rolSeleccionado);
        const nombreClinica = clinica?.nombre || clinica?.nombreClinica || contexto?.nombreClinica;
        const nombreRol = rol?.nombre || rol?.descripcion || rol?.nombreRol
            || estado.rolSeleccionado?.nombreRol || contexto?.nombreRol;
        escribir(textoContexto, [nombre, nombreClinica, nombreRol].filter(Boolean).join(" / "));
    }
}

customElements.define("encabezado-app", EncabezadoApp);
