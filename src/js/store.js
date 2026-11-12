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
        if (!token && !perfil) return null;
        return { token, perfil, roles };
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
            rolSeleccionado: sesion?.roles?.[0] ?? null,
            clinicaActiva: null,
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
