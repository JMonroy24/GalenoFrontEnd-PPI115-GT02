import { instalacionService } from '../../control/instalacion_service.js';

export default class InstaladorApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._alCambio = () => this._actualizar();
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <button id="btnInstalar" class="btn" type="button" hidden>Instalar aplicación</button>
            <span id="aviso" role="status" hidden></span>
        `;
        this.shadowRoot.querySelector('#btnInstalar').addEventListener('click', async () => {
            try {
                await instalacionService.solicitarInstalacion();
            } catch {
                const aviso = this.shadowRoot.querySelector('#aviso');
                aviso.textContent = 'Instala GalenoSV desde la barra o el menú del navegador.';
                aviso.hidden = false;
            }
        });
        instalacionService.addEventListener('cambio', this._alCambio);
        this._actualizar();
    }

    disconnectedCallback() { instalacionService.removeEventListener('cambio', this._alCambio); }

    _actualizar() {
        const boton = this.shadowRoot.querySelector('#btnInstalar');
        boton.hidden = !instalacionService.disponible;
        boton.disabled = instalacionService.enCurso;
    }
}

customElements.define('instalador-app', InstaladorApp);
