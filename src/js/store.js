import GeneradorMensajes from "./control/generador_mensajes.js";
import { esRolEmpleado } from "./entity/rol_empleado.js";

const LEGACY_KEYS = Object.freeze({
    session: "token",
    activeClinic: "clinicaActiva",
    selectedRole: "rolSeleccionado",
    isOnline: "online",
    clinica: "clinicaActiva"
});

const SESSION_KEY = "galeno_session";
export const APP_INSTALADA_KEY = "galenosv_app_instalada";

export function estaEnModoInstalado() {
    return globalThis.navigator?.standalone === true
        || ["standalone", "window-controls-overlay"].some(modo =>
            globalThis.window?.matchMedia?.(`(display-mode: ${modo})`).matches === true);
}

function leerAppInstalada() {
    if (estaEnModoInstalado()) return true;
    try { return localStorage.getItem(APP_INSTALADA_KEY) === "1"; }
    catch { return false; }
}

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
        const roles = Array.isArray(datos?.roles) ? datos.roles.filter(esRolEmpleado) : [];
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
            clinica: sesion?.clinicaActiva ?? null,
            online: globalThis.navigator?.onLine ?? true,
            appInstalada: leerAppInstalada()
        };
        this._persistirAppInstalada(this.state.appInstalada);

        if (typeof window !== "undefined") {
            window.addEventListener("storage", evento => {
                if (evento.key === APP_INSTALADA_KEY) {
                    this.setState({ appInstalada: estaEnModoInstalado() || evento.newValue === "1" });
                }
            });
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

        if (changes && Object.hasOwn(changes, "appInstalada")) {
            changes.appInstalada = changes.appInstalada === true;
            this._persistirAppInstalada(changes.appInstalada);
        }

        if (!changes || !Object.entries(changes).some(
            ([clave, valor]) => !Object.is(this.state[clave], valor)
        )) {
            return;
        }

        Object.assign(this.state, changes);

        if ("clinica" in changes || "clinicaActiva" in changes) {
            const clinica = "clinicaActiva" in changes
                ? changes.clinicaActiva
                : changes.clinica;
            this.state.clinicaActiva = clinica ?? null;
            this.state.clinica = clinica ?? null;
        }

        if (Object.keys(changes).some((clave) => CAMPOS_SESION.has(clave))) {
            this._persistirSesion();
        }

        this.dispatchEvent(new CustomEvent("state-changed", { detail: this.state }));
    }

    hasActiveSession() {
        return Boolean(
            this.state.usuario && (this.state.clinica || this.state.clinicaActiva)
        );
    }

    isAuthenticated() {
        const autenticado = this.hasActiveSession();

        this._persistirSesion();

        return autenticado;
    }

    setContextoTrabajo(clinicaActiva, rolSeleccionado) {
        this.setState({ clinicaActiva, rolSeleccionado });
    }

    _persistirAppInstalada(instalada) {
        try {
            if (instalada) localStorage.setItem(APP_INSTALADA_KEY, "1");
            else localStorage.removeItem(APP_INSTALADA_KEY);
        } catch {
            // La UI conserva el estado de esta ejecución si el almacenamiento está restringido.
        }
    }

    _persistirSesion() {
        try {
            if (typeof sessionStorage === "undefined") return;

            const guardar = (clave, valor) => {
                if (sessionStorage.getItem(clave) !== valor) sessionStorage.setItem(clave, valor);
            };
            const { token, usuario, roles, rolSeleccionado } = this.state;
            const clinica = this.state.clinica ?? this.state.clinicaActiva ?? null;
            const tieneSesion = token
                || usuario
                || clinica
                || rolSeleccionado
                || (Array.isArray(roles) && roles.length > 0);

            if (!tieneSesion) {
                sessionStorage.removeItem(SESSION_KEY);
                sessionStorage.removeItem("usuarioActivo");
                return;
            }

            if (this.hasActiveSession()) {
                guardar("usuarioActivo", JSON.stringify(usuario));
            } else {
                sessionStorage.removeItem("usuarioActivo");
            }

            guardar(SESSION_KEY, JSON.stringify({
                token: this.state.token,
                usuario: this.state.usuario,
                perfil: this.state.usuario,
                roles: this.state.roles,
                clinica,
                clinicaActiva: clinica,
                rolSeleccionado: this.state.rolSeleccionado
            }));
        } catch {
        }
    }

    getState() {
        return {
            ...this.state,
            session: this.state.token,
            activeClinic: this.state.clinicaActiva ?? this.state.clinica,
            clinica: this.state.clinica ?? this.state.clinicaActiva,
            selectedRole: this.state.rolSeleccionado,
            isOnline: this.state.online
        };
    }

    subscribe(callback, options = {}) {
        this.addEventListener("state-changed", callback, options);
        return () => this.removeEventListener("state-changed", callback);
    }
}

export const store = new Store();

export default store;
