import { store, estaEnModoInstalado } from '../store.js';

/** Comparte el único prompt disponible y publica la instalación en el Store. */
export class InstalacionService extends EventTarget {
    #revision = 0;

    constructor() {
        super();
        this.eventoPendiente = null;
        this.enCurso = false;
        let instaladaAnterior = this.estaInstalada;
        store.addEventListener('state-changed', () => {
            if (instaladaAnterior === this.estaInstalada) return;
            instaladaAnterior = this.estaInstalada;
            this._notificar();
        });
        window.addEventListener('beforeinstallprompt', evento => {
            evento.preventDefault();
            this.#revision++;
            this.eventoPendiente = evento;
            this.enCurso = false;
            // Un nuevo prompt indica que el navegador vuelve a permitir instalarla.
            store.setState({ appInstalada: false });
            this._notificar();
        });
        window.addEventListener('appinstalled', () => {
            this.#revision++;
            this.eventoPendiente = null;
            this.enCurso = false;
            store.setState({ appInstalada: true });
            this._notificar();
        });
        for (const modo of ['standalone', 'window-controls-overlay']) {
            window.matchMedia(`(display-mode: ${modo})`).addEventListener('change', () => this.sincronizarEstado());
        }
        this.sincronizarEstado();
    }

    get estaInstalada() { return store.state.appInstalada === true; }
    get disponible() { return !this.estaInstalada && !this.enCurso && this.eventoPendiente !== null; }

    sincronizarEstado() {
        if (estaEnModoInstalado()) store.setState({ appInstalada: true });
    }

    async solicitarInstalacion() {
        if (this.estaInstalada) return 'instalada';
        if (this.enCurso) return 'en-curso';
        const evento = this.eventoPendiente;
        if (!evento) return 'no-disponible';
        const revision = ++this.#revision;
        this.eventoPendiente = null;
        this.enCurso = true;
        this._notificar();
        try {
            // Invocar antes del primer await mantiene la activación del clic.
            await evento.prompt();
            const { outcome } = await evento.userChoice;
            if (revision !== this.#revision) return this.estaInstalada ? 'instalada' : 'no-disponible';
            if (outcome === 'accepted') {
                store.setState({ appInstalada: true });
                return 'aceptada';
            }
            return 'cancelada';
        } catch (error) {
            if (error?.name === 'AbortError') return 'cancelada';
            throw error;
        } finally {
            if (revision === this.#revision) {
                this.enCurso = false;
                this._notificar();
            }
        }
    }

    _notificar() { this.dispatchEvent(new Event('cambio')); }
}

export const instalacionService = new InstalacionService();
