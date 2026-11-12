const LEGACY_KEYS = Object.freeze({
    session: "token",
    activeClinic: "clinicaActiva",
    selectedRole: "rolSeleccionado",
    isOnline: "online"
});

const SESSION_KEY = "galeno_session";

function _leerSesionStorage() {
    try {
        if (typeof sessionStorage === "undefined") return null;
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const datos = JSON.parse(raw);
        const token = datos?.token ?? null;
        const perfil = datos?.perfil ?? datos?.usuario ?? null;
        const roles = Array.isArray(datos?.roles) ? datos.roles : [];
        const clinicaActiva = datos?.clinicaActiva ?? null;
        const rolSeleccionado = datos?.rolSeleccionado ?? roles[0] ?? null;
        if (!token && !perfil && !clinicaActiva && !rolSeleccionado) return null;
        return { token, perfil, roles, clinicaActiva, rolSeleccionado };
    } catch {
        return null;
    }
}

export class Store extends EventTarget {
    constructor() {
        super();

        // Hidratación desde sessionStorage para mantener la sesión ante recargas (F5)
        const sesion = _leerSesionStorage();

        this.state = {
            token: sesion?.token ?? null,
            usuario: sesion?.perfil ?? null,
            roles: sesion?.roles ?? [],
            rolSeleccionado: sesion?.rolSeleccionado ?? sesion?.roles?.[0] ?? null,
            clinicaActiva: sesion?.clinicaActiva ?? null,
            online: globalThis.navigator?.onLine ?? true
        };

        if (typeof window !== "undefined") {
            window.addEventListener("online", () => this.setState({ online: true }));
            window.addEventListener("offline", () => this.setState({ online: false }));
        }
    }

    setState(partialState, value) {
        const changes = typeof partialState === "string"
            ? { [LEGACY_KEYS[partialState] ?? partialState]: value }
            : partialState;

        if (changes && typeof changes === "object") {
            Object.assign(this.state, changes);
        }

        this.dispatchEvent(new CustomEvent("state-changed", { detail: this.state }));
    }

    setContextoTrabajo(clinicaActiva, rolSeleccionado) {
        this.state.clinicaActiva = clinicaActiva;
        this.state.rolSeleccionado = rolSeleccionado;
        this._persistirSesion();
        this.dispatchEvent(new CustomEvent("state-changed", { detail: this.state }));
    }

    setClinicaActiva(clinicaActiva) {
        this.setContextoTrabajo(clinicaActiva, this.state.rolSeleccionado);
    }

    setRolActivo(rolSeleccionado) {
        this.setContextoTrabajo(this.state.clinicaActiva, rolSeleccionado);
    }

    _persistirSesion() {
        try {
            if (typeof sessionStorage === "undefined") return;
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                token: this.state.token,
                perfil: this.state.usuario,
                roles: this.state.roles,
                clinicaActiva: this.state.clinicaActiva,
                rolSeleccionado: this.state.rolSeleccionado
            }));
        } catch {
        }
    }

    getState() {
        return {
            ...this.state,
            session: this.state.token,
            activeClinic: this.state.clinicaActiva,
            selectedRole: this.state.rolSeleccionado,
            isOnline: this.state.online
        };
    }

    subscribe(callback) {
        this.addEventListener("state-changed", callback);
        return () => this.removeEventListener("state-changed", callback);
    }
}

export const store = new Store();

export default store;
