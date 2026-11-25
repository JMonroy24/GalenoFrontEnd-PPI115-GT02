import { crearPlantilla } from "../dom.js";
import { instalacionService } from '../../control/instalacion_service.js';

const { contenido: plantilla, estilos } = crearPlantilla(`
<link rel="stylesheet" href="recursos/estilos/principal.css">
<button id="btnInstalar" class="btn" type="button" hidden>Instalar aplicación</button>
<span id="aviso" role="status" hidden></span>
`);

export default class InstaladorApp extends HTMLElement {
    #eventos = new AbortController();
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
        this.shadowRoot.querySelector('#btnInstalar').addEventListener('click', async () => {
            try {
                await instalacionService.solicitarInstalacion();
            } catch {
                const aviso = this.shadowRoot.querySelector('#aviso');
                aviso.textContent = 'Instala GalenoSV desde la barra o el menú del navegador.';
                aviso.hidden = false;
            }
        }, { signal: this.#eventos.signal });
        instalacionService.addEventListener('cambio', this._alCambio, { signal: this.#eventos.signal });
        this._actualizar();
    }

    disconnectedCallback() {
        this.#eventos.abort();
    }

    _actualizar() {
        const boton = this.shadowRoot.querySelector('#btnInstalar');
        boton.hidden = !instalacionService.disponible;
        boton.disabled = instalacionService.enCurso;
    }
}

customElements.define('instalador-app', InstaladorApp);
