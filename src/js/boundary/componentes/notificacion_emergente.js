export class NotificacionEmergente extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.temporizadores = new Set();
        this.escuchador = (evento) => this.mostrarMensaje(evento.detail);
    }

    connectedCallback() {
        if (!this.shadowRoot.querySelector("#contenedor")) {
            this._crearEstructura();
        }

        window.addEventListener("notificacion", this.escuchador);
    }

    disconnectedCallback() {
        window.removeEventListener("notificacion", this.escuchador);
        this.temporizadores.forEach((id) => clearTimeout(id));
        this.temporizadores.clear();
    }

    _crearEstructura() {
        const estilos = document.createElement("style");
        estilos.textContent = `
            :host([hidden]) { display: none; }
            #contenedor {
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                inline-size: min(22.5rem, calc(100% - 2rem));
                max-block-size: calc(100dvh - 2rem);
                overflow-y: auto;
                overscroll-behavior: contain;
            }
            .banner {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 0.875rem 1rem;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgb(15 23 42 / 0.2);
                color: #ffffff;
            }
            .texto {
                flex: 1;
                min-width: 0;
            }
            .texto strong {
                display: block;
                margin-bottom: 0.25rem;
                font-size: 0.95rem;
            }
            .texto span {
                display: block;
                font-size: 0.85rem;
                line-height: 1.4;
                overflow-wrap: anywhere;
            }
            .cerrar {
                flex: none;
                padding: 0.125rem 0.4rem;
                border: 1px solid rgb(255 255 255 / 0.6);
                border-radius: 4px;
                background: transparent;
                color: inherit;
                font: inherit;
                font-size: 0.75rem;
                cursor: pointer;
            }
            .cerrar:hover {
                background-color: rgb(255 255 255 / 0.15);
            }
            .success {
                background-color: #166534;
            }
            .warning {
                background-color: #854d0e;
            }
            .error {
                background-color: #b91c1c;
            }
            .info {
                background-color: #075985;
            }
        `;

        const contenedor = document.createElement("div");
        contenedor.id = "contenedor";

        this.shadowRoot.append(estilos, contenedor);
    }

    mostrarMensaje(mensaje = {}) {
        const tipo = this._normalizarTipo(mensaje.tipo);
        const contenedor = this.shadowRoot.querySelector("#contenedor");

        if (!contenedor) {
            return;
        }

        const banner = document.createElement("div");
        banner.className = `banner ${tipo}`;
        banner.setAttribute("role", tipo === "error" ? "alert" : "status");
        banner.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");

        const texto = document.createElement("div");
        texto.className = "texto";

        const titulo = document.createElement("strong");
        titulo.textContent = mensaje.titulo || "Notificación";
        texto.appendChild(titulo);

        const detalle = this._textoDetalle(mensaje.detalle);
        if (detalle) {
            const descripcion = document.createElement("span");
            descripcion.textContent = detalle;
            texto.appendChild(descripcion);
        }

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "cerrar";
        boton.textContent = "Cerrar";
        boton.setAttribute("aria-label", "Cerrar notificación");

        banner.append(texto, boton);
        contenedor.appendChild(banner);

        let id = null;
        const cerrar = () => {
            if (id !== null) {
                clearTimeout(id);
                this.temporizadores.delete(id);
                id = null;
            }
            banner.remove();
        };

        boton.addEventListener("click", cerrar);

        const duracion = this._normalizarDuracion(mensaje.duracion ?? mensaje.duration);
        if (duracion > 0) {
            id = setTimeout(cerrar, duracion);
            this.temporizadores.add(id);
        }
    }

    _normalizarDuracion(duracion) {
        if (duracion === null || duracion === undefined || duracion === "") {
            return 5000;
        }

        const numero = Number(duracion);

        return Number.isFinite(numero) && numero >= 0 ? numero : 5000;
    }

    _textoDetalle(detalle) {
        if (detalle === null || detalle === undefined || detalle === "") {
            return "";
        }

        if (typeof detalle === "object") {
            return detalle.message
                ?? detalle.mensaje
                ?? detalle.detail
                ?? detalle.detalle
                ?? JSON.stringify(detalle);
        }

        return String(detalle);
    }

    _normalizarTipo(tipo) {
        const valor = String(tipo || "info")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const tipos = {
            success: "success",
            exito: "success",
            warning: "warning",
            advertencia: "warning",
            error: "error",
            info: "info"
        };

        return tipos[valor] ?? "info";
    }
}

customElements.define("notificacion-emergente", NotificacionEmergente);
