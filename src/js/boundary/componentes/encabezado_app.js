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
        window.addEventListener("contexto-seleccionado", this.alContexto);
        window.addEventListener("sesion-iniciada", this.alContexto);
        window.addEventListener("sesion-cerrada", this.alContexto);
        store.addEventListener("state-changed", this.alContexto);
    }

    disconnectedCallback() {
        window.removeEventListener("contexto-seleccionado", this.alContexto);
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

        this._actualizarSesion();

        const btnMenu = this.shadowRoot.querySelector("#btnMenu");
        btnMenu.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("alternar-menu", {
                bubbles: true,
                composed: true
            }));
        });

        const navegarALogin = () => {
            sessionStorage.removeItem("contexto");
            this._actualizarSesion();
            this.dispatchEvent(new CustomEvent("navegar", {
                detail: "login",
                bubbles: true,
                composed: true
            }));
        };

        const btnCambiarRol = this.shadowRoot.querySelector("#btnCambiarRol");
        const btnCerrarSesion = this.shadowRoot.querySelector("#btnCerrarSesion");
        btnCambiarRol.addEventListener("click", navegarALogin);
        btnCerrarSesion.addEventListener("click", () => {
            authService.logout();
            navegarALogin();
        });
    }

    _actualizarSesion() {
        let usuario = null;
        let contexto = null;
        try {
            usuario = JSON.parse(sessionStorage.getItem("usuarioActivo") ?? "null");
            contexto = JSON.parse(sessionStorage.getItem("contexto") ?? "null");
        } catch {
            // El encabezado también debe funcionar sin almacenamiento disponible.
        }

        const textoContexto = this.shadowRoot.querySelector("#textoContexto");
        if (!textoContexto) return;
        if (!usuario) {
            textoContexto.textContent = "Sin sesión";
            return;
        }

        const perfil = usuario.perfil ?? usuario.usuario ?? usuario.persona ?? usuario;
        const texto = (valor) => Array.isArray(valor) ? valor.filter(Boolean).join(" ") : String(valor ?? "").trim();
        const nombre = texto(perfil.nombreCompleto)
            || [texto(perfil.nombres ?? perfil.nombre), texto(perfil.apellidos ?? perfil.apellido)]
                .filter(Boolean).join(" ") || "Usuario";
        const estado = store.getState();
        const clinica = estado.clinicaActiva;
        const rol = estado.rolSeleccionado?.rol
            ?? (typeof estado.rolSeleccionado?.idRol === "object"
                ? estado.rolSeleccionado.idRol : estado.rolSeleccionado);
        const nombreClinica = clinica?.nombre || clinica?.nombreClinica || contexto?.nombreClinica;
        const nombreRol = rol?.nombre || rol?.descripcion || rol?.nombreRol
            || estado.rolSeleccionado?.nombreRol || contexto?.nombreRol;
        textoContexto.textContent = [nombre, nombreClinica, nombreRol].filter(Boolean).join(" / ");
    }
}

customElements.define("encabezado-app", EncabezadoApp);
