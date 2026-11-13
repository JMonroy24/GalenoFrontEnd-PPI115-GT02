import GeneradorMensajes from "./control/generador_mensajes.js";

const LEGACY_KEYS = Object.freeze({
    session: "token",
    activeClinic: "clinicaActiva",
    selectedRole: "rolSeleccionado",
    isOnline: "online",
    clinica: "clinicaActiva"
});

const SESSION_KEY = "galeno_session";

const CAMPOS_SESION = new Set([
    "token",
    "usuario",
    "perfil",
    "roles",
    "clinica",
    "clinicaActiva",
    "rolSeleccionado"
]);

function _leerSesionStorage() {
    try {
        if (typeof sessionStorage === "undefined") return null;
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const datos = JSON.parse(raw);
        const token = datos?.token ?? null;
        const perfil = datos?.perfil ?? datos?.usuario ?? null;
        const roles = Array.isArray(datos?.roles) ? datos.roles : [];
        const clinicaActiva = datos?.clinicaActiva ?? datos?.clinica ?? null;
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
            window.addEventListener("online", () => {
                this.setState({ online: true });
                GeneradorMensajes.crearMensaje(
                    "Conexión restablecida",
                    "La conexión a internet se ha restablecido.",
                    "success"
                );
            });
            window.addEventListener("offline", () => {
                this.setState({ online: false });
                GeneradorMensajes.crearMensaje(
                    "Sin conexión a internet",
                    "No hay conexión a internet. Verifique su red.",
                    "warning"
                );
            });
        }
    }

    setState(partialState, value) {
        let changes = null;

        if (typeof partialState === "string") {
            changes = { [LEGACY_KEYS[partialState] ?? partialState]: value };
        } else if (partialState && typeof partialState === "object") {
            changes = {};
            Object.entries(partialState).forEach(([clave, valor]) => {
                changes[LEGACY_KEYS[clave] ?? clave] = valor;
            });
        }

        if (changes) {
            Object.assign(this.state, changes);

            if (Object.keys(changes).some((clave) => CAMPOS_SESION.has(clave))) {
                this._persistirSesion();
            }
        }

        this.dispatchEvent(new CustomEvent("state-changed", { detail: this.state }));
    }

    isAuthenticated() {
        const autenticado = Boolean(
            this.state.usuario
            && (this.state.clinicaActiva ?? this.state.clinica)
        );

        this._persistirSesion();

        return autenticado;
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

            const { token, usuario, roles, clinicaActiva, rolSeleccionado } = this.state;
            const tieneSesion = token
                || usuario
                || clinicaActiva
                || rolSeleccionado
                || (Array.isArray(roles) && roles.length > 0);

            if (!tieneSesion) {
                sessionStorage.removeItem(SESSION_KEY);
                return;
            }

            sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                token: this.state.token,
                usuario: this.state.usuario,
                perfil: this.state.usuario,
                roles: this.state.roles,
                clinica: this.state.clinicaActiva,
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
            clinica: this.state.clinicaActiva,
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
