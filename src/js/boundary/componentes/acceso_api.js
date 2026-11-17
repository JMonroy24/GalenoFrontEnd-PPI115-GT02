import { apiAuthService } from "../../control/api_auth_service.js";

export class AccesoApi extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.resolver = null;
        this.abrir = () => this.solicitar();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                dialog { width: min(26rem, calc(100vw - 3rem)); padding: 1.5rem;
                    border: 1px solid #64748b; border-radius: .75rem; color: #0f172a;
                    font-family: system-ui, sans-serif; }
                dialog::backdrop { background: rgb(15 23 42 / .45); }
                h2 { margin-top: 0; color: #1e3a8a; }
                form, label { display: flex; flex-direction: column; gap: .5rem; }
                form { gap: 1rem; }
                input, button { font: inherit; padding: .65rem; border-radius: .4rem; }
                input { border: 1px solid #64748b; }
                .acciones { display: flex; justify-content: flex-end; gap: .5rem; }
                button { cursor: pointer; border: 1px solid #64748b; }
                button[type=submit] { background: #1e3a8a; color: white; }
                #error { color: #b91c1c; margin: 0; }
            </style>
            <dialog aria-labelledby="titulo" aria-describedby="descripcion">
                <h2 id="titulo">Acceso a GalenoSV</h2>
                <p id="descripcion">Ingrese su cuenta del servidor para cargar los catálogos.
                    Después podrá seleccionar el documento del empleado.</p>
                <form>
                    <label>Usuario
                        <input name="usuario" autocomplete="username" required autofocus>
                    </label>
                    <label>Contraseña
                        <input name="password" type="password" autocomplete="current-password" required>
                    </label>
                    <p id="error" role="alert"></p>
                    <div class="acciones">
                        <button type="button" id="cancelar">Cancelar</button>
                        <button type="submit">Conectar</button>
                    </div>
                </form>
            </dialog>
        `;

        const dialog = this.shadowRoot.querySelector("dialog");
        const form = this.shadowRoot.querySelector("form");
        const password = form.elements.password;
        const conectar = form.querySelector("button[type=submit]");
        const cancelar = this.shadowRoot.querySelector("#cancelar");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (conectar.disabled) return;
            conectar.disabled = true;
            cancelar.disabled = true;
            this.shadowRoot.querySelector("#error").textContent = "";

            try {
                const autorizacion = await apiAuthService.autenticar(form.elements.usuario.value, password.value);
                this.terminar(autorizacion);
            } catch (error) {
                this.shadowRoot.querySelector("#error").textContent = error.message;
            } finally {
                password.value = "";
                conectar.disabled = false;
                cancelar.disabled = false;
            }
        });

        cancelar.addEventListener("click", () => this.terminar(null));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            if (!conectar.disabled) this.terminar(null);
        });
        apiAuthService.formulario = this.abrir;
    }

    solicitar() {
        return new Promise((resolve) => {
            this.resolver = resolve;
            this.shadowRoot.querySelector("#error").textContent = "";
            this.shadowRoot.querySelector("dialog").showModal();
        });
    }

    terminar(autorizacion) {
        this.shadowRoot.querySelector("dialog").close();
        this.shadowRoot.querySelector("form").reset();
        this.resolver?.(autorizacion);
        this.resolver = null;
    }

    disconnectedCallback() {
        if (apiAuthService.formulario === this.abrir) {
            apiAuthService.formulario = null;
        }
        this.resolver?.(null);
        this.resolver = null;
    }
}

customElements.define("acceso-api", AccesoApi);
