import "../componentes/buscador_tipo_doc.js";
import { authService } from "../../control/auth_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";
import { navigate } from "../../router.js";

export class LoginView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.cargando = false;
        this.sesion = null;
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, sans-serif);
                }
                .contenedor {
                    display: grid;
                    min-height: 100%;
                    padding: var(--space-6, 1.5rem);
                    place-items: center;
                }
                .tarjeta {
                    width: min(100%, 28rem);
                    padding: var(--space-6, 1.5rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow, 0 4px 12px rgb(15 23 42 / 0.12));
                }
                h2 {
                    margin: 0 0 var(--space-6, 1.5rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-2xl, 1.5rem);
                    text-align: center;
                }
                form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                }
                .campo {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-xs, 0.25rem);
                }
                label {
                    font-weight: 600;
                }
                .error {
                    min-height: 1rem;
                    color: var(--color-error, #b91c1c);
                    font-size: var(--text-xs, 0.75rem);
                }
                .form-control.invalido {
                    border-color: var(--color-error, #b91c1c);
                    outline-color: var(--color-error, #b91c1c);
                }
                .btn-primario {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-2, 0.5rem);
                }
                .btn-primario:disabled {
                    cursor: wait;
                    opacity: 0.75;
                }
                .spinner {
                    display: none;
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid currentColor;
                    border-right-color: transparent;
                    border-radius: var(--radius-full, 9999px);
                    animation: girar 0.8s linear infinite;
                }
                .btn-primario.cargando .spinner {
                    display: inline-block;
                }
                @keyframes girar {
                    to {
                        transform: rotate(360deg);
                    }
                }
            </style>
            <div class="contenedor">
                <section class="tarjeta">
                    <h2>Iniciar Sesión</h2>
                    <form novalidate>
                        <div class="campo">
                            <buscador-tipo-documentos id="tipo-documento"></buscador-tipo-documentos>
                            <span id="tipo-documento-error" class="error" role="alert"></span>
                        </div>

                        <div class="campo">
                            <label for="numero-documento">Número de Documento</label>
                            <input
                                id="numero-documento"
                                name="numeroDocumento"
                                type="text"
                                class="form-control"
                                required
                                aria-required="true"
                                aria-describedby="numero-documento-error"
                                autocomplete="off"
                            >
                            <span id="numero-documento-error" class="error" role="alert"></span>
                        </div>

                        <button id="btn-iniciar-sesion" type="submit" class="btn btn-primario">
                            <span class="spinner" aria-hidden="true"></span>
                            <span>Iniciar Sesión</span>
                        </button>
                    </form>
                </section>
            </div>
        `;

        this._conectarEventos();
    }

    _conectarEventos() {
        const form = this.shadowRoot.querySelector("form");
        const buscador = this.shadowRoot.querySelector("buscador-tipo-documentos");
        const numeroDocumento = this.shadowRoot.querySelector("#numero-documento");

        buscador.addEventListener("tipo-documento-change", () => {
            this._marcarError("tipo-documento-error", false);
        });

        numeroDocumento.addEventListener("input", () => {
            this._marcarError("numero-documento-error", false);
            numeroDocumento.classList.remove("invalido");
            numeroDocumento.setAttribute("aria-invalid", "false");
        });

        form.addEventListener("submit", (evento) => {
            evento.preventDefault();
            this._iniciarSesion();
        });
    }

    async _iniciarSesion() {
        if (this.cargando) {
            return;
        }

        const buscador = this.shadowRoot.querySelector("buscador-tipo-documentos");
        const numeroDocumento = this.shadowRoot.querySelector("#numero-documento");
        const tipoDocumento = buscador.value;
        const numero = numeroDocumento.value.trim();
        const tipoValido = tipoDocumento !== "";
        const numeroValido = numero !== "";

        this._marcarError("tipo-documento-error", !tipoValido);
        this._marcarError("numero-documento-error", !numeroValido);
        numeroDocumento.classList.toggle("invalido", !numeroValido);
        numeroDocumento.setAttribute("aria-invalid", String(!numeroValido));

        if (!tipoValido || !numeroValido) {
            return;
        }

        this._establecerCargando(true);

        try {
            this.sesion = await authService.login(tipoDocumento, numero);
            navigate("#dashboard");
            this._mostrarBienvenida();
            this._resetearFormulario();
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "Error al iniciar sesión",
                error?.mensaje ?? error?.message ?? "No se pudo iniciar sesión.",
                "error"
            );
        } finally {
            this._establecerCargando(false);
        }
    }

    _mostrarBienvenida() {
        const perfil = this.sesion?.perfil ?? {};
        const nombre = perfil.nombres
            ?? perfil.nombre
            ?? perfil.name
            ?? "";
        const detalle = nombre
            ? `Bienvenido, ${nombre}.`
            : "Ha iniciado sesión correctamente.";

        GeneradorMensajes.crearMensaje("Bienvenido", detalle, "success");
    }

    _resetearFormulario() {
        const form = this.shadowRoot.querySelector("form");
        const buscador = this.shadowRoot.querySelector("buscador-tipo-documentos");
        const numeroDocumento = this.shadowRoot.querySelector("#numero-documento");

        form?.reset();

        if (numeroDocumento) {
            numeroDocumento.value = "";
            numeroDocumento.classList.remove("invalido");
            numeroDocumento.setAttribute("aria-invalid", "false");
        }

        const select = buscador?.shadowRoot?.querySelector("select");
        if (select) {
            select.value = "";
        }

        this._marcarError("tipo-documento-error", false);
        this._marcarError("numero-documento-error", false);
    }

    _marcarError(id, mostrar) {
        const error = this.shadowRoot.querySelector(`#${id}`);

        if (error) {
            error.textContent = mostrar
                ? id === "tipo-documento-error"
                    ? "Seleccione un tipo de documento."
                    : "Ingrese el número de documento."
                : "";
        }
    }

    _establecerCargando(cargando) {
        this.cargando = cargando;
        const boton = this.shadowRoot.querySelector("#btn-iniciar-sesion");

        if (!boton) {
            return;
        }

        boton.disabled = cargando;
        boton.classList.toggle("cargando", cargando);
        boton.setAttribute("aria-busy", String(cargando));
    }
}

export default LoginView;

customElements.define("login-view", LoginView);
