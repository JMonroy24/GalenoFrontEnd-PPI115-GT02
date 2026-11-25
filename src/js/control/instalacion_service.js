/** Coordina la única solicitud de instalación disponible entre los componentes. */
export class InstalacionService extends EventTarget {
    constructor() {
        super();
        this.eventoPendiente = null;
        this.instalada = false;
        this.enCurso = false;
        window.addEventListener('beforeinstallprompt', evento => {
            evento.preventDefault();
            this.eventoPendiente = evento;
            this._notificar();
        });
        window.addEventListener('appinstalled', () => {
            this.instalada = true;
            this.eventoPendiente = null;
            this._notificar();
        });
    }

    get estaInstalada() {
        return this.instalada || navigator.standalone === true
            || window.matchMedia('(display-mode: standalone)').matches;
    }

    get disponible() {
        return !this.estaInstalada && !this.enCurso
            && (this.eventoPendiente !== null || typeof navigator.install === 'function');
    }

    async solicitarInstalacion() {
        if (this.estaInstalada) return 'instalada';
        if (this.enCurso) return 'en-curso';
        const evento = this.eventoPendiente;
        if (!evento && typeof navigator.install !== 'function') return 'no-disponible';
        this.eventoPendiente = null;
        this.enCurso = true;
        this._notificar();
        try {
            // La llamada ocurre durante el clic: conservar la activación del usuario.
            if (typeof navigator.install === 'function') {
                await navigator.install();
                this.instalada = true;
                return 'aceptada';
            }
            await evento.prompt();
            return (await evento.userChoice).outcome === 'accepted' ? 'aceptada' : 'cancelada';
        } catch (error) {
            if (error?.name === 'AbortError') return 'cancelada';
            throw error;
        } finally {
            this.enCurso = false;
            this._notificar();
        }
    }

    _notificar() { this.dispatchEvent(new Event('cambio')); }
}

export const instalacionService = new InstalacionService();
