import { crearPlantilla } from "../dom.js";
import { instalacionService } from '../../control/instalacion_service.js';
import { consultaService } from '../../control/consulta_service.js';
import { store } from '../../store.js';

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<style>
    :host { display: block; min-inline-size: 0; container: ticket / inline-size; inline-size: 100%; }
    .opciones { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
    button { flex: 1 1 15rem; white-space: normal; overflow-wrap: anywhere; }
    a { font-size: 0.8125rem; color: var(--color-link, #0284c7); overflow-wrap: anywhere; }
    p { font-size: 0.875rem; line-height: 1.5; margin-block: 0.75rem 0; }
    [hidden] { display: none; }
@container ticket (inline-size < 28rem) {
    button { flex-basis: 100%; }
}
</style>
<div class="opciones" aria-label="Opciones del ticket">
    <button id="instalar" class="btn btn-primario" type="button">Descargar aplicación para poder ver el ticket</button>
    <a id="ver-web" target="_blank" rel="noopener">ver ticket en la web</a>
    <button id="ver-ticket" class="btn btn-primario" type="button" hidden>Ver ticket</button>
</div>
<p id="aviso" role="status" aria-live="polite" hidden></p>
`);

export class OpcionesTicket extends HTMLElement {
    #eventos = new AbortController();
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
        this.shadowRoot.querySelector('#instalar').addEventListener('click', () => this._instalar(), { signal: this.#eventos.signal });
        this.shadowRoot.querySelector('#ver-web').addEventListener('click', evento => {
            evento.preventDefault();
            this._abrirTicket();
        }, { signal: this.#eventos.signal });
        this.shadowRoot.querySelector('#ver-ticket').addEventListener('click', () => this._abrirTicket(), { signal: this.#eventos.signal });
        this.addEventListener('click', this._detenerPropagacion, { signal: this.#eventos.signal });
        instalacionService.addEventListener('cambio', this._alCambio, { signal: this.#eventos.signal });
        this._actualizar();
    }

    disconnectedCallback() {
        this.#eventos.abort();

    }

    attributeChangedCallback() { if (this.isConnected) this._actualizar(); }
    _detenerPropagacion(evento) { evento.stopPropagation(); }

    _actualizar() {
        const id = this.getAttribute('id-consulta')?.trim();
        const enlace = this.shadowRoot.querySelector('#ver-web');
        if (id) enlace.href = consultaService.obtenerUrlTicket(id);
        else enlace.removeAttribute('href');
        enlace.setAttribute('aria-disabled', String(!id));
        const instalada = instalacionService.estaInstalada;
        const instalar = this.shadowRoot.querySelector('#instalar');
        const enfocado = this.shadowRoot.activeElement;
        instalar.hidden = instalada;
        instalar.disabled = !id || instalacionService.enCurso;
        instalar.setAttribute('aria-busy', String(instalacionService.enCurso));
        enlace.hidden = instalada;
        const verTicket = this.shadowRoot.querySelector('#ver-ticket');
        verTicket.hidden = !instalada;
        verTicket.disabled = !id;
        if (instalada) {
            this.shadowRoot.querySelector('#aviso').hidden = true;
            if (enfocado === instalar || enfocado === enlace) verTicket.focus();
        } else if (enfocado === verTicket) {
            instalar.focus();
        }
    }

    _abrirTicket() {
        if (!navigator.onLine || store.state.online === false) {
            this._avisar('Sin conexión. Conéctate a internet para ver el ticket.');
            return;
        }
        try {
            const url = consultaService.obtenerUrlTicket(this.getAttribute('id-consulta'));
            // Abrir en el propio clic, sin fetch ni esperas que pierdan la activación.
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            this._avisar(error.message);
        }
    }

    async _instalar() {
        const boton = this.shadowRoot.querySelector('#instalar');
        if (boton.disabled) return;
        try {
            const resultado = await instalacionService.solicitarInstalacion();
            if (instalacionService.estaInstalada) return;
            const mensajes = {
                'no-disponible': 'Instala GalenoSV desde la barra del navegador o su menú: Instalar aplicación / Añadir a pantalla de inicio.',
                cancelada: 'La instalación no se completó. Puedes instalar desde la barra del navegador o ver el ticket en la web.',
                'en-curso': 'La solicitud de instalación ya está en curso.'
            };
            if (this.isConnected) this._avisar(mensajes[resultado]);
        } catch {
            if (this.isConnected) this._avisar('No se pudo iniciar la instalación. Usa la barra o el menú del navegador; el ticket sigue disponible en la web.');
        }
    }

    _avisar(texto) {
        const aviso = this.shadowRoot.querySelector('#aviso');
        aviso.textContent = texto;
        aviso.hidden = false;
    }
}

customElements.define('opciones-ticket', OpcionesTicket);
