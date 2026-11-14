import DefaultService from "./default_service.js";
import { personaRolService } from "./persona_rol_service.js";
import { ENDPOINTS } from "../routes.js";
import GeneradorMensajes from "./generador_mensajes.js";
import DefaultError from "../entity/default_error.js";
import { store } from "../store.js";

export const SESSION_STORAGE_KEY = "galeno_session";

const ESTADOS_INACTIVOS = new Set([
    "inactivo",
    "inactiva",
    "cancelado",
    "cancelada",
    "eliminado",
    "eliminada",
    "deshabilitado",
    "deshabilitada"
]);

export class AuthService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS);
        this.sesion = null;
        this.restaurarSesion();
    }

    async login(tipoDocumentoId, numeroDocumento) {
        const idTipoDocumento = tipoDocumentoId;
        const params = new URLSearchParams();
        params.set("tipoDocumentoId", String(idTipoDocumento ?? ""));
        params.set("idTipoDocumento", String(idTipoDocumento ?? ""));
        params.set("numeroDocumento", String(numeroDocumento ?? ""));

        try {
            const response = await this._request(
                `${this._urlBase}?${params.toString()}`,
                { method: "GET" },
                "Error al autenticar al empleado"
            );
            const payload = await this._parseBody(response);
            const perfil = this._extraerPerfil(payload);

            if (!perfil) {
                const mensaje = "No se encontró la persona indicada.";
                GeneradorMensajes.crearMensaje("Usuario no encontrado", mensaje, "error");
                throw new DefaultError(mensaje, {
                    status: 404,
                    message: mensaje
                });
            }

            const idPersona = this._obtenerIdPersona(perfil, numeroDocumento);
            const roles = await this._obtenerRoles(idPersona);
            const rolesEmpleado = roles.filter((personaRol) => this._esRolEmpleado(personaRol));

            if (rolesEmpleado.length === 0) {
                const mensaje = "Acceso denegado: la persona no tiene roles de empleado activos.";
                GeneradorMensajes.crearMensaje("Acceso denegado", mensaje, "error");
                throw new DefaultError(mensaje, {
                    status: 403,
                    message: mensaje
                });
            }

            const rolSeleccionado = rolesEmpleado[0] ?? null;
            const clinicaActiva = this._obtenerClinica(perfil, rolesEmpleado, rolSeleccionado);
            const sesion = {
                perfil,
                usuario: perfil,
                token: this._obtenerToken(payload, perfil, response),
                roles: rolesEmpleado,
                clinica: clinicaActiva,
                clinicaActiva,
                rolSeleccionado
            };

            this._guardarSesion(sesion);
            this._sincronizarStore(sesion, { clinicaActiva, rolSeleccionado });

            return sesion;
        } catch (error) {
            if (error instanceof DefaultError) {
                throw error;
            }

            const mensaje = error?.mensaje ?? error?.message ?? "Error al autenticar al empleado";
            GeneradorMensajes.crearMensaje("Error al autenticar", mensaje, "error");
            throw new DefaultError(mensaje, error);
        }
    }

    restaurarSesion() {
        const almacen = this._obtenerAlmacen();

        if (!almacen) {
            return null;
        }

        try {
            const serializada = almacen.getItem(SESSION_STORAGE_KEY);

            if (!serializada) {
                return null;
            }

            const datos = JSON.parse(serializada);
            const perfil = datos?.perfil ?? datos?.usuario ?? null;
            const roles = Array.isArray(datos?.roles) ? datos.roles : [];
            const clinicaActiva = datos?.clinicaActiva ?? datos?.clinica ?? null;
            const rolSeleccionado = datos?.rolSeleccionado ?? roles[0] ?? null;
            const sesion = {
                perfil,
                usuario: perfil,
                token: datos?.token ?? null,
                roles,
                clinica: clinicaActiva,
                clinicaActiva,
                rolSeleccionado
            };

            if (!sesion.perfil && !sesion.token && !sesion.clinicaActiva) {
                return null;
            }

            this.sesion = sesion;
            this._sincronizarStore(sesion, { clinicaActiva, rolSeleccionado });

            return sesion;
        } catch {
            try {
                almacen.removeItem(SESSION_STORAGE_KEY);
            } catch {
            }

            return null;
        }
    }

    logout() {
        const almacen = this._obtenerAlmacen();

        if (almacen) {
            try {
                almacen.removeItem(SESSION_STORAGE_KEY);
            } catch {
            }
        }

        this.sesion = null;
        store.setState({
            token: null,
            usuario: null,
            roles: [],
            rolSeleccionado: null,
            clinicaActiva: null
        });
    }

    _guardarSesion(sesion) {
        const almacen = this._obtenerAlmacen();

        if (!almacen) {
            return;
        }

        try {
            almacen.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                perfil: sesion.perfil,
                usuario: sesion.usuario ?? sesion.perfil,
                token: sesion.token ?? null,
                roles: Array.isArray(sesion.roles) ? sesion.roles : [],
                clinica: sesion.clinicaActiva ?? sesion.clinica ?? null,
                clinicaActiva: sesion.clinicaActiva ?? sesion.clinica ?? null,
                rolSeleccionado: sesion.rolSeleccionado ?? sesion.roles?.[0] ?? null
            }));
        } catch {
        }
    }

    _sincronizarStore(sesion, contexto = null) {
        const roles = Array.isArray(sesion?.roles) ? sesion.roles : [];
        const clinicaActiva = contexto?.clinicaActiva
            ?? sesion?.clinicaActiva
            ?? sesion?.clinica
            ?? null;
        const rolSeleccionado = contexto?.rolSeleccionado
            ?? sesion?.rolSeleccionado
            ?? roles[0]
            ?? null;

        store.setState({
            token: sesion?.token ?? null,
            usuario: sesion?.perfil ?? sesion?.usuario ?? null,
            roles,
            clinica: clinicaActiva,
            clinicaActiva,
            rolSeleccionado
        });
    }

    _obtenerAlmacen() {
        try {
            return typeof sessionStorage !== "undefined" ? sessionStorage : null;
        } catch {
            return null;
        }
    }

    async _obtenerRoles(idPersona) {
        const respuesta = await personaRolService.buscarRolesPorPersona(idPersona);

        if (Array.isArray(respuesta?.items)) {
            return respuesta.items;
        }

        if (Array.isArray(respuesta?.datos)) {
            return respuesta.datos;
        }

        return Array.isArray(respuesta) ? respuesta : [];
    }

    _obtenerClinica(perfil, roles = [], rolSeleccionado = null) {
        const fuentes = [
            perfil,
            rolSeleccionado,
            ...roles,
            ...roles.map((personaRol) => personaRol?.rol)
        ];

        for (const fuente of fuentes) {
            if (!fuente) {
                continue;
            }

            const clinicas = fuente.clinicas ?? fuente.clinicasAsignadas;

            if (Array.isArray(clinicas) && clinicas.length > 0) {
                return clinicas[0];
            }

            const clinica = fuente.clinicaActiva ?? fuente.clinica;

            if (this._esClinicaValida(clinica)) {
                return clinica;
            }
        }

        for (const fuente of fuentes) {
            if (!fuente) {
                continue;
            }

            const clinica = fuente.idClinica ?? fuente.idClinicaEmpleado;

            if (!this._esClinicaValida(clinica)) {
                continue;
            }

            if (typeof clinica === "object") {
                return clinica;
            }

            const nombre = fuente.nombreClinica ?? fuente.clinicaNombre;
            return nombre ? { idClinica: clinica, nombre } : { idClinica: clinica };
        }

        return null;
    }

    _esClinicaValida(clinica) {
        return clinica !== undefined
            && clinica !== null
            && clinica !== ""
            && !(typeof clinica === "object" && Object.keys(clinica).length === 0);
    }

    _extraerPerfil(payload) {
        if (Array.isArray(payload)) {
            return payload[0] ?? null;
        }

        const perfil = payload?.perfil
            ?? payload?.persona
            ?? payload?.usuario
            ?? payload?.items?.[0];

        if (perfil) {
            return perfil;
        }

        if (payload && typeof payload === "object") {
            const tieneDatosPersona = payload.idPersona !== undefined
                || payload.id !== undefined
                || payload.numeroDocumento !== undefined
                || payload.nombres !== undefined
                || payload.dui !== undefined;

            if (tieneDatosPersona) {
                return payload;
            }
        }

        return null;
    }

    _obtenerIdPersona(perfil, numeroDocumento) {
        return perfil?.idPersona
            ?? perfil?.id
            ?? perfil?.persona?.idPersona
            ?? perfil?.persona?.id
            ?? numeroDocumento;
    }

    _obtenerToken(payload, perfil, response) {
        const autorizacion = response?.headers?.get?.("Authorization")
            ?? response?.headers?.get?.("authorization");
        const tokenCabecera = typeof autorizacion === "string"
            ? autorizacion.replace(/^Bearer\s+/i, "").trim()
            : null;

        return payload?.token
            ?? payload?.accessToken
            ?? payload?.access_token
            ?? payload?.sesion?.token
            ?? perfil?.token
            ?? perfil?.sesion?.token
            ?? (tokenCabecera || null);
    }

    _esRolEmpleado(personaRol) {
        if (!this._estaActivo(personaRol)) {
            return false;
        }

        const rol = personaRol?.rol ?? personaRol?.idRol ?? null;

        if (rol?.esEmpleado === true || personaRol?.esEmpleado === true) {
            return true;
        }

        if (rol?.esEmpleado === false || personaRol?.esEmpleado === false) {
            return false;
        }

        const nombre = String(
            rol?.nombre
            ?? rol?.name
            ?? rol?.descripcion
            ?? personaRol?.nombreRol
            ?? personaRol?.rolNombre
            ?? (typeof rol === "string" ? rol : "")
            ?? ""
        ).toUpperCase();

        const tipo = String(
            rol?.tipo
            ?? rol?.tipoRol
            ?? personaRol?.tipoRol
            ?? ""
        ).toUpperCase();

        if (nombre.includes("PACIENTE")) {
            return false;
        }

        if (nombre.includes("EMPLEADO") || nombre.includes("EMPLEADA")) {
            return true;
        }

        if (tipo.includes("EMPLEADO")) {
            return true;
        }

        return true;
    }

    _estaActivo(personaRol) {
        if (personaRol?.activo === false || personaRol?.activa === false) {
            return false;
        }

        const estado = personaRol?.estado ?? personaRol?.estadoPersonaRol;
        const nombreEstado = typeof estado === "object" ? estado?.nombre : estado;

        return !ESTADOS_INACTIVOS.has(String(nombreEstado ?? "").toLowerCase());
    }
}

export const authService = new AuthService();

export default AuthService;
