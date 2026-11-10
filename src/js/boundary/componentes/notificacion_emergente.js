export default class NotificacionEmergente extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.temporizadores = new Set();
        this.escuchador = (e) => this.mostrarMensaje(e.detail);
    }

    connectedCallback() {
        if (!this.shadowRoot.querySelector("#contenedor")) {
            const enlace = document.createElement("link");
            enlace.rel = "stylesheet";
            enlace.href = "recursos/estilos/principal.css";

            const estilos = document.createElement("style");
            estilos.textContent = `
                #contenedor {
                    position: fixed;
                    top: 1rem;
                    right: 1rem;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .alerta {
                    min-width: 240px;
                    max-width: 360px;
                    padding: 0.75rem 1rem;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
                    color: #ffffff;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                    cursor: pointer;
                }
                .alerta strong {
                    display: block;
                    margin-bottom: 0.25rem;
                }
                .alerta span {
                    display: block;
                    font-size: 0.9rem;
                }
                .alerta.error {
                    background-color: #dc3545;
                }
                .alerta.exito {
                    background-color: #28a745;
                }
                .alerta.info {
                    background-color: #0d6efd;
                }
            `;

            const contenedor = document.createElement("div");
            contenedor.id = "contenedor";

            this.shadowRoot.append(enlace, estilos, contenedor);
        }

        window.addEventListener("notificacion", this.escuchador);
    }

    disconnectedCallback() {
        window.removeEventListener("notificacion", this.escuchador);
        this.temporizadores.forEach((id) => clearTimeout(id));
        this.temporizadores.clear();
    }

    mostrarMensaje(mensaje) {
        const tipo = this._normalizarTipo(mensaje ? mensaje.tipo : null);
        const contenedor = this.shadowRoot.querySelector("#contenedor");
        if (!contenedor) {
            return;
        }

        const alerta = document.createElement("div");
        alerta.className = `alerta ${tipo}`;

        const titulo = document.createElement("strong");
        titulo.textContent = mensaje && mensaje.titulo ? mensaje.titulo : "Notificación";
        alerta.appendChild(titulo);

        const detalle = mensaje ? mensaje.detalle : null;
        if (detalle !== null && detalle !== undefined && detalle !== "") {
            const span = document.createElement("span");
            span.textContent = detalle;
            alerta.appendChild(span);
        }

        contenedor.appendChild(alerta);

        let id = null;
        const cerrar = () => {
            if (id !== null) {
                clearTimeout(id);
                this.temporizadores.delete(id);
                id = null;
            }
            alerta.remove();
        };

        id = setTimeout(cerrar, 4000);
        this.temporizadores.add(id);
        alerta.addEventListener("click", cerrar);
    }

    _normalizarTipo(tipo) {
        const valor = (tipo || "info")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        return valor === "error" || valor === "exito" || valor === "info" ? valor : "info";
    }
}

customElements.define("notificacion-emergente", NotificacionEmergente);
