import { consultaService } from '../../control/consulta_service.js';

export class TicketView extends HTMLElement {
    static get observedAttributes() { return ['data-route-id', 'id-consulta']; }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._url = null;
        this._solicitud = 0;
        this._cancelacion = null;
    }

    get idConsulta() { return this.getAttribute('id-consulta') ?? this.dataset.routeId ?? ''; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host { display: block; min-inline-size: 0; }
                section { padding: 1rem; border: 1px solid var(--color-border, #64748b); border-radius: 0.75rem; background: white; }
                h1 { color: var(--color-primary, #1e3a8a); margin-block-start: 0; }
                .acciones { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-block: 1rem; }
                object { display: block; inline-size: 100%; block-size: 75dvh; min-block-size: 20rem; border: 1px solid var(--color-border, #64748b); }
                [hidden] { display: none !important; }
            </style>
            <section aria-labelledby="titulo-ticket">
                <h1 id="titulo-ticket">Vista previa del ticket</h1>
                <p id="estado" role="status" aria-live="polite"></p>
                <div class="acciones">
                    <button class="btn btn-primario" id="descargar" type="button" disabled>Descargar PDF</button>
                    <a class="btn" id="abrir" target="_blank" rel="noopener noreferrer" hidden>Abrir en pestaña</a>
                    <a class="btn" id="cerrar" href="#buscar-citas">Volver / Cerrar vista previa</a>
                    <a id="consulta" hidden>Ver detalle de la consulta</a>
                </div>
                <div id="visor"></div>
                <button id="reintentar" class="btn" type="button" hidden>Reintentar</button>
            </section>
        `;
        this.shadowRoot.querySelector('#descargar').addEventListener('click', () => this._descargar());
        this.shadowRoot.querySelector('#cerrar').addEventListener('click', () => this._liberar());
        this.shadowRoot.querySelector('#reintentar').addEventListener('click', () => this.cargar());
        this.cargar();
    }

    disconnectedCallback() { this._liberar(); }
    attributeChangedCallback() { if (this.isConnected) this.cargar(); }

    async cargar() {
        this._liberar();
        const solicitud = this._solicitud;
        const id = this.idConsulta.trim();
        const estado = this.shadowRoot.querySelector('#estado');
        const reintentar = this.shadowRoot.querySelector('#reintentar');
        reintentar.hidden = true;
        const detalle = this.shadowRoot.querySelector('#consulta');
        detalle.hidden = !id;
        if (id) detalle.href = `#consulta/${encodeURIComponent(id)}`;
        if (!id) { estado.textContent = 'Falta el identificador de la consulta.'; return; }
        estado.textContent = 'Cargando ticket PDF…';
        this._cancelacion = new AbortController();
        try {
            const blob = await consultaService.obtenerTicketPdf(id, { signal: this._cancelacion.signal });
            if (!this.isConnected || solicitud !== this._solicitud) return;
            this._url = URL.createObjectURL(blob);
            const objeto = document.createElement('object');
            objeto.type = 'application/pdf';
            objeto.data = this._url;
            objeto.setAttribute('aria-label', 'Vista previa del ticket PDF');
            objeto.textContent = 'Si tu navegador no muestra PDF aquí, usa «Abrir en pestaña» o «Descargar PDF».';
            this.shadowRoot.querySelector('#visor').replaceChildren(objeto);
            this.shadowRoot.querySelector('#descargar').disabled = false;
            const abrir = this.shadowRoot.querySelector('#abrir');
            abrir.href = this._url;
            abrir.hidden = false;
            estado.textContent = 'El ticket está listo para consultar. La descarga es opcional mediante «Descargar PDF».';
        } catch (error) {
            if (!this.isConnected || solicitud !== this._solicitud) return;
            estado.textContent = error?.status === 404 ? 'No se encontró el ticket de esta consulta.'
                : navigator.onLine === false ? 'Sin conexión. Conéctate a internet para cargar el ticket PDF.'
                    : 'No se pudo cargar el ticket. Comprueba tu conexión y vuelve a intentarlo.';
            reintentar.hidden = false;
        }
    }

    _descargar() {
        if (!this._url) return;
        const enlace = document.createElement('a');
        enlace.href = this._url;
        enlace.download = `ticket-cita-${this.idConsulta}.pdf`;
        enlace.hidden = true;
        this.shadowRoot.append(enlace);
        enlace.click();
        enlace.remove();
    }

    _liberar() {
        this._solicitud++;
        this._cancelacion?.abort();
        this._cancelacion = null;
        this.shadowRoot.querySelector('#visor')?.replaceChildren();
        const boton = this.shadowRoot.querySelector('#descargar');
        if (boton) boton.disabled = true;
        const abrir = this.shadowRoot.querySelector('#abrir');
        if (abrir) { abrir.hidden = true; abrir.removeAttribute('href'); }
        if (this._url) { URL.revokeObjectURL(this._url); this._url = null; }
    }
}

customElements.define('ticket-view', TicketView);
