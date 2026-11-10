export default class InstaladorApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.deferredPrompt = null;
        this.alPrompt = (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.mostrarBoton();
        };
        this.alInstalada = () => {
            this.deferredPrompt = null;
            this.ocultarBoton();
        };
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <button id="btnInstalar" class="btn" hidden>Instalar aplicación</button>
        `;

        const boton = this.shadowRoot.querySelector("#btnInstalar");
        boton.addEventListener("click", async () => {
            if (!this.deferredPrompt) {
                return;
            }
            this.deferredPrompt.prompt();
            await this.deferredPrompt.userChoice;
            this.deferredPrompt = null;
            this.ocultarBoton();
        });

        if (window.matchMedia("(display-mode: standalone)").matches) {
            return;
        }

        // beforeinstallprompt solo existe en navegadores Chromium; el componente debe cargarse temprano para no perder el evento.
        window.addEventListener("beforeinstallprompt", this.alPrompt);
        window.addEventListener("appinstalled", this.alInstalada);
    }

    disconnectedCallback() {
        window.removeEventListener("beforeinstallprompt", this.alPrompt);
        window.removeEventListener("appinstalled", this.alInstalada);
    }

    mostrarBoton() {
        const boton = this.shadowRoot.querySelector("#btnInstalar");
        if (boton) {
            boton.removeAttribute("hidden");
        }
    }

    ocultarBoton() {
        const boton = this.shadowRoot.querySelector("#btnInstalar");
        if (boton) {
            boton.setAttribute("hidden", "");
        }
    }
}

customElements.define("instalador-app", InstaladorApp);
