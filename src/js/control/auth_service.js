import DefaultService from "./default_service.js";
import { API_BASE, DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";
import GeneradorMensajes from "./generador_mensajes.js";
import DefaultError from "../entity/default_error.js";
import { store } from "../store.js";
import { esRolEmpleado } from "../entity/rol_empleado.js";

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
            console.log("Personas encontradas:", payload?.items);
            const perfil = Array.isArray(payload?.items) && payload.items.length > 0
                ? payload.items[0]
                : null;
            console.log("Persona seleccionada:", perfil);

            if (!perfil) {
                const mensaje = "Usuario no encontrado";
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

            const roles = await this._completarNombresRelaciones(await this._obtenerRoles(idPersona));
            const rolesEmpleado = roles.filter((personaRol) => (
                this._perteneceAPersona(personaRol, idPersona) && esRolEmpleado(personaRol)
            ));

            if (rolesEmpleado.length === 0) {
                this.logout();
                const mensaje = "Acceso denegado: usuario no es empleado";
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
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("sesion-iniciada", {
                    detail: { usuario: sesion.usuario }
                }));
                window.location.hash = "#dashboard";
            }

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
            const roles = Array.isArray(datos?.roles) ? datos.roles.filter(esRolEmpleado) : [];
            if (roles.length === 0) {
                this.logout();
                return null;
            }
            const clinicaActiva = datos?.clinicaActiva ?? datos?.clinica ?? null;
            const rolSeleccionado = esRolEmpleado(datos?.rolSeleccionado)
                ? datos.rolSeleccionado : roles[0];
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
            void this._actualizarNombresSesion(sesion);

            return sesion;
        } catch {
            try {
                almacen.removeItem(SESSION_STORAGE_KEY);
                almacen.removeItem("usuarioActivo");
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
                almacen.removeItem("usuarioActivo");
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
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sesion-cerrada"));
        }
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

        // Conservar las relaciones anidadas para validar el empleado y su contexto.
        return roles.filter((registro) => registro !== null
            && typeof registro === "object" && !Array.isArray(registro));
    }

    async _completarNombresRelaciones(asignaciones) {
        // El DTO actual contiene UUIDs; otras versiones incluyen las entidades anidadas.
        const solicitudes = new Map();
        const resolver = async (registro, relacion, campoId, endpoint) => {
            const referencia = registro[relacion] ?? registro[campoId];
            const entidad = referencia && typeof referencia === "object" ? referencia : {};
            const nombre = entidad.nombre || entidad.nombreClinica || entidad.nombreRol
                || entidad.descripcion || entidad.name;
            const nombrePlano = relacion === "clinica"
                ? registro.nombreClinica || registro.clinicaNombre
                : registro.nombreRol;
            const id = entidad[campoId] ?? entidad.id ?? entidad.codigo
                ?? (typeof registro[campoId] !== "object" ? registro[campoId] : null)
                ?? (typeof referencia !== "object" ? referencia : null);
            if (nombre || nombrePlano || id == null || id === "") {
                if (id != null && id !== "" && entidad[campoId] == null
                    && entidad.id == null && entidad.codigo == null && (nombre || nombrePlano)) {
                    return { ...entidad, [campoId]: id, nombre: nombre || nombrePlano };
                }
                return nombrePlano && !nombre ? { ...entidad, [campoId]: id, nombre: nombrePlano } : referencia;
            }
            const url = `${API_BASE.replace(/\/+$/, "")}${endpoint}/${encodeURIComponent(id)}`;
            if (!solicitudes.has(url)) {
                solicitudes.set(url, (async () => {
                    try {
                        const response = await this._request(url, { method: "GET" }, "Error al obtener el nombre de la relación");
                        const datos = await this._parseBody(response);
                        // No reemplazar el identificador de la asignación con otro del catálogo.
                        if (String(datos?.[campoId] ?? datos?.id) === String(id)) {
                            return { ...entidad, ...datos, [campoId]: id };
                        }
                    } catch {
                        // Una etiqueta no disponible no debe invalidar la sesión.
                    }
                    return { ...entidad, [campoId]: id };
                })());
            }
            return solicitudes.get(url);
        };
        return Promise.all(asignaciones.map(async (registro) => {
            const [clinica, rol] = await Promise.all([
                resolver(registro, "clinica", "idClinica", ENDPOINTS.CLINICAS),
                resolver(registro, "rol", "idRol", "/roles")
            ]);
            const cambios = {};
            if (clinica !== undefined) cambios.clinica = clinica;
            if (rol !== undefined) cambios.rol = rol;
            return Object.keys(cambios).every((campo) => registro[campo] === cambios[campo])
                ? registro : { ...registro, ...cambios };
        }));
    }

    async _actualizarNombresSesion(sesion) {
        const roles = (await this._completarNombresRelaciones(sesion.roles)).filter(esRolEmpleado);
        if (this.sesion !== sesion) return;
        if (roles.length === 0) {
            this.logout();
            return;
        }
        const indiceSeleccionado = sesion.roles.indexOf(sesion.rolSeleccionado);
        const rolSeleccionado = roles[indiceSeleccionado >= 0 ? indiceSeleccionado : 0]
            ?? sesion.rolSeleccionado;
        const idClinicaActiva = sesion.clinicaActiva?.idClinica ?? sesion.clinicaActiva?.id
            ?? sesion.clinicaActiva;
        const clinicaActiva = roles.map((registro) => this._obtenerClinica(null, [], registro))
            .find((clinica) => String(clinica?.idClinica ?? clinica?.id) === String(idClinicaActiva))
            ?? sesion.clinicaActiva;
        // Conservar el contexto que el usuario pudo cambiar mientras se consultaban nombres.
        const estado = store.getState();
        const seleccion = estado.rolSeleccionado;
        const idSeleccion = seleccion?.idPersonaRol ?? seleccion?.id;
        const rolActual = roles.find((registro) => idSeleccion != null
            && String(registro.idPersonaRol ?? registro.id) === String(idSeleccion)) ?? seleccion ?? rolSeleccionado;
        const clinicaActualId = estado.clinicaActiva?.idClinica ?? estado.clinicaActiva?.id ?? estado.clinicaActiva;
        const clinicaActual = roles.map((registro) => this._obtenerClinica(null, [], registro))
            .find((clinica) => String(clinica?.idClinica ?? clinica?.id) === String(clinicaActualId))
            ?? estado.clinicaActiva ?? clinicaActiva;
        Object.assign(sesion, { roles, rolSeleccionado: rolActual, clinica: clinicaActual, clinicaActiva: clinicaActual });
        this._guardarSesion(sesion);
        this._sincronizarStore(sesion);
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
}

export const authService = new AuthService();

export default AuthService;
