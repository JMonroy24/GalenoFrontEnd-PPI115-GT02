import { crearPlantilla } from "../dom.js";
import { instalacionService } from '../../control/instalacion_service.js';
import { consultaService } from '../../control/consulta_service.js';
import { store } from '../../store.js';

/** IDs de los elementos del componente. */
const ID_BANNER = 'banner-pdf';
const ID_BTN_DESCARGAR = 'btn-descargar-pdf';
const ID_MODAL = 'modal-pdf';
const ID_TITULO_MODAL = 'modal-pdf-titulo';
const ID_BTN_INSTALAR_DESCARGAR = 'btn-instalar-descargar';
const ID_BTN_SOLO_VER = 'btn-solo-ver';
const ID_BTN_CERRAR_MODAL = 'btn-cerrar-modal';
const ID_AVISO = 'aviso';

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<style>
    :host {
        display: block;
        min-inline-size: 0;
        container: ticket / inline-size;
        inline-size: 100%;
    }

    [hidden] { display: none !important; }

    /* ── Banner de descarga ── */
    .banner-pdf {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 1rem;
        background-color: var(--color-info-bg, #f0f9ff);
        border: 1px solid var(--color-secondary, #0284c7);
        border-radius: var(--radius, 0.5rem);
        font-size: var(--text-sm, 0.875rem);
        color: var(--color-info, #075985);
    }

    /* ── Modal (dialog nativo) ── */
    dialog {
        padding: 0;
        border: none;
        border-radius: var(--radius-lg, 0.75rem);
        box-shadow: var(--shadow, 0 4px 12px rgb(15 23 42 / 0.12));
        inline-size: min(28rem, 92vw);
        background-color: var(--color-surface, #ffffff);
        color: var(--color-text, #0f172a);
    }

    dialog::backdrop {
        background-color: rgb(15 23 42 / 0.5);
    }

    .modal-contenido {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        padding: 1.5rem;
    }

    .modal-encabezado {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .modal-titulo {
        margin: 0;
        font-size: var(--text-lg, 1.125rem);
        font-weight: 700;
        color: var(--color-primary, #1e3a8a);
    }

    .modal-acciones {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .btn-cerrar-modal {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border: none;
        border-radius: var(--radius-sm, 0.25rem);
        background: transparent;
        cursor: pointer;
        color: var(--color-text-muted, #475569);
        font-size: 1.25rem;
        line-height: 1;
        flex-shrink: 0;
    }

    .btn-cerrar-modal:hover {
        background-color: var(--color-surface-alt, #e2e8f0);
        color: var(--color-text, #0f172a);
    }

    p { font-size: 0.875rem; line-height: 1.5; margin: 0; }

    #${ID_AVISO} {
        margin-block-start: 0.5rem;
        font-size: var(--text-sm, 0.875rem);
        line-height: 1.5;
        color: var(--color-text-muted, #475569);
    }

    @container ticket (inline-size < 28rem) {
        .modal-acciones .btn { inline-size: 100%; }
    }
</style>

<!-- Banner discreto con único botón de acción -->
<div id="${ID_BANNER}" class="banner-pdf">
    <button id="${ID_BTN_DESCARGAR}" class="btn btn-primario" type="button">
        Descargar PDF
    </button>
</div>

<!-- Modal nativo <dialog> -->
<dialog id="${ID_MODAL}" aria-labelledby="${ID_TITULO_MODAL}" aria-modal="true">
    <div class="modal-contenido">
        <div class="modal-encabezado">
            <h2 id="${ID_TITULO_MODAL}" class="modal-titulo">Opciones del PDF</h2>
            <button
                id="${ID_BTN_CERRAR_MODAL}"
                class="btn-cerrar-modal"
                type="button"
                aria-label="Cerrar"
            >&#x2715;</button>
        </div>
        <div class="modal-acciones">
            <button id="${ID_BTN_INSTALAR_DESCARGAR}" class="btn btn-primario" type="button">
                Instalar y descargar
            </button>
            <button id="${ID_BTN_SOLO_VER}" class="btn" type="button">
                Solo ver
            </button>
        </div>
        <p id="${ID_AVISO}" role="status" aria-live="polite" hidden></p>
    </div>
</dialog>
`);

export class OpcionesTicket extends HTMLElement {
    #eventos = new AbortController();
    /** @type {HTMLDialogElement|null} */
    #modal = null;
    /** @type {HTMLButtonElement|null} Botón que disparó la apertura del modal. */
    #disparador = null;

    static get observedAttributes() { return ['id-consulta']; }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._alCambio = () => this._actualizar();
    }

    connectedCallback() {
        this.#eventos.abort();
        this.#eventos = new AbortController();
        if (!this.shadowRoot.firstChild) {
            this.shadowRoot.adoptedStyleSheets = [estilos];
            this.shadowRoot.append(plantilla.content.cloneNode(true));
        }

        this.#modal = this.shadowRoot.querySelector(`#${ID_MODAL}`);

        // Botón del banner → abre el modal
        this.shadowRoot.querySelector(`#${ID_BTN_DESCARGAR}`).addEventListener(
            'click', () => this._abrirModal(), { signal: this.#eventos.signal }
        );

        // Botón "Instalar y descargar"
        this.shadowRoot.querySelector(`#${ID_BTN_INSTALAR_DESCARGAR}`).addEventListener(
            'click', () => this._instalarYDescargar(), { signal: this.#eventos.signal }
        );

        // Botón "Solo ver"
        this.shadowRoot.querySelector(`#${ID_BTN_SOLO_VER}`).addEventListener(
            'click', () => { this._cerrarModal(); this._abrirPdf(); },
            { signal: this.#eventos.signal }
        );

        // Botón ✕ del modal
        this.shadowRoot.querySelector(`#${ID_BTN_CERRAR_MODAL}`).addEventListener(
            'click', () => this._cerrarModal(), { signal: this.#eventos.signal }
        );

        // Clic fuera del contenido del modal (en el backdrop)
        this.#modal.addEventListener('click', (evento) => {
            if (evento.target === this.#modal) this._cerrarModal();
        }, { signal: this.#eventos.signal });

        // La tecla Escape ya la gestiona el <dialog> nativo; sólo necesitamos
        // devolver el foco al disparador tras el cierre.
        this.#modal.addEventListener('close', () => this._alCierreModal(), { signal: this.#eventos.signal });

        instalacionService.addEventListener('cambio', this._alCambio, { signal: this.#eventos.signal });
        this._actualizar();
    }

    disconnectedCallback() {
        this.#eventos.abort();
    }

    attributeChangedCallback() { if (this.isConnected) this._actualizar(); }

    // ─── Estado del banner y modal ────────────────────────────────────────────

    _actualizar() {
        const id = this.getAttribute('id-consulta')?.trim();
        const btnDescargar = this.shadowRoot.querySelector(`#${ID_BTN_DESCARGAR}`);
        // Deshabilitar si no hay id aún
        btnDescargar.disabled = !id;

        // Actualizar textos y estado de los botones del modal
        const instalada = instalacionService.estaInstalada;
        const btnInstalar = this.shadowRoot.querySelector(`#${ID_BTN_INSTALAR_DESCARGAR}`);

        if (instalada || !instalacionService.disponible) {
            // Cambiar la etiqueta del botón principal: sin prompt disponible, solo descarga
            btnInstalar.textContent = 'Descargar';
        } else {
            btnInstalar.textContent = 'Instalar y descargar';
        }
        btnInstalar.disabled = !id || instalacionService.enCurso;
        btnInstalar.setAttribute('aria-busy', String(instalacionService.enCurso));

        const btnSoloVer = this.shadowRoot.querySelector(`#${ID_BTN_SOLO_VER}`);
        btnSoloVer.disabled = !id;

        // Ocultar banner entero si no hay consulta disponible
        const banner = this.shadowRoot.querySelector(`#${ID_BANNER}`);
        banner.hidden = !id;
    }

    // ─── Gestión del modal ────────────────────────────────────────────────────

    _abrirModal() {
        this.#disparador = this.shadowRoot.querySelector(`#${ID_BTN_DESCARGAR}`);
        this._ocultarAviso();
        this.#modal.showModal();
        // Enfocar el primer botón de acción
        this.shadowRoot.querySelector(`#${ID_BTN_INSTALAR_DESCARGAR}`).focus();
    }

    _cerrarModal() {
        if (this.#modal.open) this.#modal.close();
    }

    _alCierreModal() {
        this.#disparador?.focus();
        this.#disparador = null;
    }

    // ─── Acciones de los botones del modal ────────────────────────────────────

    /**
     * "Instalar y descargar": solicita la instalación PWA si está disponible,
     * luego abre el PDF. Si la app ya está instalada o el prompt no está
     * disponible, solo abre el PDF.
     */
    async _instalarYDescargar() {
        const btnInstalar = this.shadowRoot.querySelector(`#${ID_BTN_INSTALAR_DESCARGAR}`);
        if (btnInstalar.disabled) return;

        const intentarInstalar = instalacionService.disponible && !instalacionService.estaInstalada;

        if (intentarInstalar) {
            try {
                await instalacionService.solicitarInstalacion();
            } catch {
                // La instalación falló o fue cancelada; continuamos con la descarga.
            }
        }

        this._cerrarModal();
        this._abrirPdf();
    }

    /**
     * Abre el PDF/ticket en una pestaña nueva.
     * Si no hay conexión, muestra un aviso en el modal sin cerrarlo.
     */
    _abrirPdf() {
        if (!navigator.onLine || store.state.online === false) {
            this._mostrarAviso('Sin conexión. Conéctate a internet para ver el PDF.');
            if (!this.#modal.open) this._abrirModal();
            return;
        }
        try {
            const url = consultaService.obtenerUrlTicket(this.getAttribute('id-consulta'));
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            this._mostrarAviso(error.message);
            if (!this.#modal.open) this._abrirModal();
        }
    }

    // ─── Avisos en el modal ───────────────────────────────────────────────────

    _mostrarAviso(mensaje) {
        const aviso = this.shadowRoot.querySelector(`#${ID_AVISO}`);
        aviso.textContent = mensaje;
        aviso.hidden = false;
    }

    _ocultarAviso() {
        const aviso = this.shadowRoot.querySelector(`#${ID_AVISO}`);
        aviso.textContent = '';
        aviso.hidden = true;
    }
}

customElements.define('opciones-ticket', OpcionesTicket);
