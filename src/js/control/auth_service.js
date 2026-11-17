import DefaultService from "./default_service.js";
import { API_BASE, DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";
import GeneradorMensajes from "./generador_mensajes.js";
import DefaultError from "../entity/default_error.js";
import { store } from "../store.js";
import { apiAuthService } from "./api_auth_service.js";

export const SESSION_STORAGE_KEY = "galeno_session";

const ESTADOS_INACTIVOS = new Set([
    "inactivo",
    "inactiva",
    "cancelado",
    "cancelada",
    "eliminado",
    "eliminada",
    "deshabilitado",
    "deshabilitada",
    "suspendido",
    "suspendida",
    "baja",
    "false",
    "0"
]);

export class AuthService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS);
        this.sesion = null;
        this.restaurarSesion();
    }

    async login(tipoDocumentoId, numeroDocumento) {
        const idTipoDocumento = String(tipoDocumentoId ?? "").trim();
        const documento = String(numeroDocumento ?? "").trim();

        if (!idTipoDocumento || !documento) {
            throw new DefaultError("Seleccione el tipo e ingrese el número de documento.", {
                status: 422
            });
        }

        const params = new URLSearchParams();
        params.set("tipoDocumentoId", idTipoDocumento);
        params.set("valor", documento);
        const url = `${this._urlBase}?${params.toString()}`;

        try {
            console.log("Petición Persona URL:", url);
            const response = await this._request(
                url,
                { method: "GET" },
                "Error al autenticar al empleado"
            );
            const payload = await this._parseBody(response);
            console.log("Respuesta Backend Persona:", payload);
            const perfil = this._extraerPerfil(payload, idTipoDocumento, documento);

            if (!perfil) {
                const mensaje = "No se encontró la persona indicada.";
                GeneradorMensajes.crearMensaje("Usuario no encontrado", mensaje, "error");
                throw new DefaultError(mensaje, {
                    status: 404,
                    message: mensaje
                });
            }

            const idPersona = this._obtenerIdPersona(perfil);

            if (idPersona === undefined || idPersona === null || idPersona === "") {
                throw new DefaultError("La persona no tiene un identificador válido.", { status: 422 });
            }

            const roles = await this._obtenerRoles(idPersona);
            const rolesEmpleado = roles.filter((personaRol) => (
                this._perteneceAPersona(personaRol, idPersona)
            ));

            if (rolesEmpleado.length === 0) {
                const mensaje = "Acceso denegado: la persona no tiene roles asignados.";
                GeneradorMensajes.crearMensaje("Acceso denegado", mensaje, "error");
                throw new DefaultError(mensaje, {
                    status: 403,
                    message: mensaje
                });
            }

            const rolSeleccionado = rolesEmpleado.find((personaRol) => (
                this._obtenerClinica(null, [], personaRol)
            )) ?? rolesEmpleado[0];
            const clinicaActiva = this._obtenerClinica(perfil, [], rolSeleccionado);

            if (!clinicaActiva) {
                throw new DefaultError("El empleado no tiene una clínica activa asignada.", {
                    status: 403
                });
            }

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
            this.sesion = sesion;
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
        apiAuthService.logout();
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
        const params = new URLSearchParams({ first: "0", max: String(DEFAULT_PAGE_SIZE), personaId: String(idPersona) });
        const url = `${API_BASE.replace(/\/+$/, "")}${ENDPOINTS.PERSONAS_ROLES}?${params.toString()}`;

        console.log("Petición Roles URL:", url);
        const response = await this._request(url, { method: "GET" }, "Error al obtener los roles de la persona");
        const respuesta = await this._parseBody(response);
        console.log("Respuesta Backend Roles:", respuesta);
        const roles = Array.isArray(respuesta?.items)
            ? respuesta.items
            : Array.isArray(respuesta) ? respuesta : [];

        // El backend decide qué asignaciones son válidas; no inferir permisos
        // a partir del nombre de registro.rol ni de un atributo esEmpleado.
        return roles.filter((registro) => registro !== null
            && typeof registro === "object" && !Array.isArray(registro));
    }

    _perteneceAPersona(personaRol, idPersona) {
        const persona = personaRol?.persona ?? personaRol?.idPersona;
        const id = typeof persona === "object" ? this._obtenerIdPersona(persona) : persona;

        return id === undefined || id === null || String(id) === String(idPersona);
    }

    _obtenerClinica(perfil, roles = [], rolSeleccionado = null) {
        const fuentes = [
            rolSeleccionado,
            rolSeleccionado?.rol,
            perfil,
            ...roles,
            ...roles.map((personaRol) => personaRol?.rol)
        ];

        for (const fuente of fuentes) {
            if (!fuente) {
                continue;
            }

            const clinicas = fuente.clinicas ?? fuente.clinicasAsignadas;

            if (Array.isArray(clinicas)) {
                const clinica = clinicas.find((item) => this._esClinicaValida(item));

                if (clinica) {
                    return clinica;
                }
            }

            const clinica = fuente.clinicaActiva ?? fuente.clinica;

            if (this._esClinicaValida(clinica)) {
                return clinica;
            }

            const idClinica = fuente.idClinica ?? fuente.idClinicaEmpleado;

            if (!this._esClinicaValida(idClinica)) {
                continue;
            }

            if (typeof idClinica === "object") {
                return idClinica;
            }

            const nombre = fuente.nombreClinica ?? fuente.clinicaNombre;
            return nombre ? { idClinica, nombre } : { idClinica };
        }

        return null;
    }

    _esClinicaValida(clinica) {
        return clinica !== undefined
            && clinica !== null
            && clinica !== ""
            && !(typeof clinica === "object" && Object.keys(clinica).length === 0)
            && this._estaActivo(clinica);
    }

    _extraerPerfil(payload, tipoDocumento, numeroDocumento) {
        const perfil = payload?.perfil
            ?? payload?.persona
            ?? payload?.usuario;
        const personas = Array.isArray(payload)
            ? payload
            : payload?.items ?? payload?.datos ?? (perfil ? [perfil] : [payload]);

        if (!Array.isArray(personas)) {
            return null;
        }

        return personas.find((persona) => {
            if (!persona || typeof persona !== "object" || !this._estaActivo(persona)) {
                return false;
            }

            const documento = persona.valor ?? persona.numeroDocumento ?? persona.documento ?? persona.dui;
            const tipo = persona.idTipoDocumento ?? persona.tipoDocumentoId ?? persona.tipoDocumento;
            const idTipo = typeof tipo === "object" ? tipo?.idTipoDocumento ?? tipo?.id : tipo;

            return this._obtenerIdPersona(persona) != null
                && documento != null
                && this._normalizarTexto(documento) === this._normalizarTexto(numeroDocumento)
                && (idTipo == null || String(idTipo) === String(tipoDocumento));
        }) ?? null;
    }

    _obtenerIdPersona(perfil) {
        return [perfil?.id, perfil?.idPersona, perfil?.persona?.id, perfil?.persona?.idPersona]
            .map((id) => typeof id === "string" ? id.trim() : id)
            .find((id) => (typeof id === "string" && id !== "")
                || (typeof id === "number" && Number.isFinite(id)));
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

    _estaActivo(personaRol) {
        const indicadores = [personaRol?.activo, personaRol?.activa];

        if (indicadores.some((valor) => valor != null && ESTADOS_INACTIVOS.has(
            String(valor).trim().toLowerCase()
        ))) {
            return false;
        }

        const estado = personaRol?.estado ?? personaRol?.estadoPersonaRol;
        const nombreEstado = typeof estado === "object" ? estado?.nombre : estado;

        return !ESTADOS_INACTIVOS.has(String(nombreEstado ?? "").trim().toLowerCase());
    }

    _normalizarTexto(valor) {
        return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    }
}

export const authService = new AuthService();

export default AuthService;
