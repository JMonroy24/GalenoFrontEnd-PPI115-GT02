import { instalacionService } from '../../control/instalacion_service.js';

export class OpcionesTicket extends HTMLElement {
    static get observedAttributes() { return ['id-consulta']; }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._alCambio = () => this._actualizar();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host { display: block; min-inline-size: 0; inline-size: 100%; }
                .opciones { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
                button { flex: 1 1 15rem; white-space: normal; overflow-wrap: anywhere; }
                .principal { background: var(--color-primary, #1e3a8a); color: white; }
                a { font-size: 0.8125rem; color: var(--color-link, #0284c7); overflow-wrap: anywhere; }
                p { font-size: 0.875rem; line-height: 1.5; margin-block: 0.75rem 0; }
                [hidden] { display: none; }
            </style>
            <div class="opciones" aria-label="Opciones del ticket">
                <button id="instalar" class="btn principal" type="button">Descargar aplicación para poder ver el ticket</button>
                <a id="ver-web">ver ticket en la web</a>
            </div>
            <p id="aviso" role="status" aria-live="polite" hidden></p>
        `;
        this.shadowRoot.querySelector('#instalar').addEventListener('click', () => this._instalar());
        this.addEventListener('click', this._detenerPropagacion);
        instalacionService.addEventListener('cambio', this._alCambio);
        this._actualizar();
    }

    disconnectedCallback() {
        instalacionService.removeEventListener('cambio', this._alCambio);
        this.removeEventListener('click', this._detenerPropagacion);
    }

    attributeChangedCallback() { if (this.isConnected) this._actualizar(); }
    _detenerPropagacion(evento) { evento.stopPropagation(); }

    _actualizar() {
        const id = this.getAttribute('id-consulta')?.trim();
        const enlace = this.shadowRoot.querySelector('#ver-web');
        if (id) enlace.href = `#ticket/${encodeURIComponent(id)}`;
        else enlace.removeAttribute('href');
        enlace.setAttribute('aria-disabled', String(!id));
        this.shadowRoot.querySelector('#instalar').disabled = !id || instalacionService.enCurso;
        if (instalacionService.estaInstalada) {
            this._avisar('Ya estás usando la aplicación instalada. Puedes abrir el ticket con «ver ticket en la web».');
        }
    }

    async _instalar() {
        const boton = this.shadowRoot.querySelector('#instalar');
        if (boton.disabled) return;
        try {
            const resultado = await instalacionService.solicitarInstalacion();
            const mensajes = {
                instalada: 'Ya estás usando la aplicación instalada. Puedes abrir el ticket con «ver ticket en la web».',
                'no-disponible': 'Para instalar GalenoSV, usa el icono de instalación de la barra del navegador o su menú: Instalar aplicación / Añadir a pantalla de inicio. También puedes ver el ticket en la web.',
                aceptada: 'Solicitud de instalación aceptada. Cuando termine, abre GalenoSV desde su icono. También puedes ver el ticket en la web.',
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
