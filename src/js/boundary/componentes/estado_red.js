import { store } from "../../store.js";

const MSG_OFFLINE =
    "Sin conexión. Se muestran los datos guardados y algunas acciones no estarán disponibles.";
const MSG_ONLINE = "Conexión restablecida.";

/**
 * <estado-red>
 * Aviso visible del estado de la red. Se alimenta del Store global (EventTarget):
 *  - Sin conexión: banner de advertencia permanente.
 *  - Al reconectar: banner de éxito que se oculta solo.
 * Usa role="status" + aria-live="polite" para anunciarse a lectores de pantalla.
 */
export class EstadoRed extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.duracionMensajeMs = 4000;
        this._online = true;
        this._timer = null;
        this._desuscribir = null;
    }

    connectedCallback() {
        this._renderEstructura();
        this._online = store.state?.online !== false;
        this._mostrar(this._online ? null : "offline");
        this._desuscribir = store.subscribe((evento) => {
            this._cambio(evento.detail?.online !== false);
        });
    }

    disconnectedCallback() {
        this._desuscribir?.();
        this._desuscribir = null;
        clearTimeout(this._timer);
    }

    _cambio(online) {
        if (online === this._online) {
            return;
        }

        this._online = online;
        clearTimeout(this._timer);

        if (!online) {
            this._mostrar("offline");
            return;
        }

        this._mostrar("online");
        this._timer = setTimeout(() => this._mostrar(null), this.duracionMensajeMs);
    }

    _mostrar(modo) {
        const banner = this.shadowRoot.querySelector("#banner");
        const texto = this.shadowRoot.querySelector("#texto");

        banner.hidden = modo === null;
        banner.dataset.modo = modo ?? "";
        texto.textContent = modo === "offline"
            ? MSG_OFFLINE
            : modo === "online" ? MSG_ONLINE : "";
    }

    _renderEstructura() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                #banner {
                    display: flex;
                    align-items: center;
                    gap: var(--espacio-2, 0.5rem);
                    padding: var(--espacio-2, 0.5rem) var(--espacio-4, 1rem);
                    font-family: var(--fuente-cuerpo, system-ui, sans-serif);
                    font-size: var(--tamano-sm, 0.9rem);
                    font-weight: 600;
                    border-bottom: 2px solid currentColor;
                }
                #banner[hidden] { display: none; }
                #banner[data-modo="offline"] {
                    background: var(--color-advertencia-fondo, #fffbeb);
                    color: var(--color-advertencia, #854d0e);
                }
                #banner[data-modo="online"] {
                    background: var(--color-exito-fondo, #f0fdf4);
                    color: var(--color-exito, #166534);
                }
                .punto {
                    inline-size: 0.6rem;
                    block-size: 0.6rem;
                    border-radius: 50%;
                    background: currentColor;
                    flex: none;
                }
            </style>
            <div id="banner" role="status" aria-live="polite" hidden>
                <span class="punto" aria-hidden="true"></span>
                <span id="texto"></span>
            </div>
        `;
    }
}

if (!customElements.get("estado-red")) {
    customElements.define("estado-red", EstadoRed);
}

export default EstadoRed;
