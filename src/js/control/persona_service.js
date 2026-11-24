import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";
import { API_BASE, DEFAULT_PAGE_SIZE } from "../config.js";

export class PersonaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS);
    }

    async buscarPorDocumento(tipoDocumento, numeroDocumento) {
        const numero = String(numeroDocumento ?? "").trim();

        if (numero === "") {
            return null;
        }

        const params = new URLSearchParams({
            first: "0", max: "20", tipoDocumentoId: String(tipoDocumento ?? "").trim(), valor: numero
        });
        const response = await this._request(
            `${this._urlBase}?${params.toString()}`,
            { method: "GET" },
            "Error al buscar al paciente por documento"
        );
        const respuesta = await this._parseBody(response);
        const personas = Array.isArray(respuesta?.items) ? respuesta.items : [];
        const documentoBuscado = this._normalizarDocumento(numero);

        return personas.find((persona) => {
            const tipo = persona?.idTipoDocumento ?? persona?.tipoDocumentoId
                ?? persona?.tipoDocumento ?? persona?.persona?.idTipoDocumento;
            const idTipo = typeof tipo === "object"
                ? tipo?.idTipoDocumento ?? tipo?.id ?? tipo?.codigo
                : tipo;

            const documento = this._numeroDocumento(persona);

            // El DTO de /personas puede omitir el documento que el servidor ya filtró.
            return this._estaActivo(persona)
                && (!documento || this._normalizarDocumento(documento) === documentoBuscado)
                && (idTipo == null || String(idTipo) === String(tipoDocumento));
        }) ?? null;
    }

    async buscarClinicasPaciente(tipoDocumento, numeroDocumento) {
        const persona = await this.buscarPorDocumento(tipoDocumento, numeroDocumento);

        if (!persona) {
            return [];
        }

        const clinicas = await this._extraerClinicas(persona);

        // Una lista vacía embebida también es una respuesta definitiva.
        if (clinicas !== null) {
            return clinicas;
        }

        const idPersona = persona.idPersona
            ?? persona.id
            ?? persona.persona?.idPersona
            ?? persona.paciente?.idPersona;

        if (idPersona == null || idPersona === "") {
            return [];
        }

        const asignaciones = [];
        let first = 0;
        let total;

        do {
            const params = new URLSearchParams({
                personaId: String(idPersona), first: String(first), max: String(DEFAULT_PAGE_SIZE)
            });
            const response = await this._request(
                `${API_BASE}${ENDPOINTS.PERSONAS_ROLES}?${params}`,
                { method: "GET" },
                "Error al obtener las clínicas del paciente"
            );
            const payload = await this._parseBody(response);
            const items = Array.isArray(payload?.items) ? payload.items
                : Array.isArray(payload) ? payload : [];
            total = Number(payload?.total ?? items.length);
            if (items.length === 0) break;
            asignaciones.push(...items);
            first += items.length;
        } while (first < total);

        const propias = asignaciones.filter((item) => {
            if (!item || typeof item !== "object") return false;
            const personaRol = item?.persona ?? item?.idPersona;
            const id = typeof personaRol === "object"
                ? personaRol?.idPersona ?? personaRol?.id : personaRol;
            return this._estaActivo(item) && (id == null || String(id) === String(idPersona));
        });
        return this._resolverClinicasPaciente(propias);
    }

    async _resolverClinicasPaciente(asignaciones) {
        const solicitudes = new Map();
        const resolver = async (referencia, campoId, endpoint, nombrePlano) => {
            const entidad = referencia && typeof referencia === "object" ? referencia : {};
            const id = entidad[campoId] ?? entidad.id ?? entidad.codigo
                ?? (typeof referencia !== "object" ? referencia : null);
            const nombre = entidad.nombre ?? entidad.name ?? entidad.descripcion ?? nombrePlano;

            if (nombre || id == null || !this._estaActivo(entidad)) {
                return nombre ? { ...entidad, [campoId]: id, nombre } : entidad;
            }
            const url = `${API_BASE}${endpoint}/${encodeURIComponent(id)}`;
            if (!solicitudes.has(url)) {
                solicitudes.set(url, (async () => {
                    const response = await this._request(url, { method: "GET" }, "Error al obtener la relación del paciente");
                    const datos = await this._parseBody(response);
                    return { ...datos, [campoId]: id };
                })());
            }
            return solicitudes.get(url);
        };

        const clinicas = await Promise.all(asignaciones.map(async (item) => {
            const referenciaRol = item.rol ?? item.idRol ?? item.tipoRol;
            const nombreRol = item.nombreRol ?? item.rolNombre
                ?? (typeof item.rol === "string" && /^[a-záéíóúñ _]+$/i.test(item.rol) ? item.rol : null);
            const rol = await resolver(referenciaRol, "idRol", ENDPOINTS.ROLES, nombreRol);
            if (!this._esRolPaciente({ ...item, rol })) return null;

            const clinica = await resolver(item.clinica ?? item.idClinica,
                "idClinica", ENDPOINTS.CLINICAS, item.nombreClinica ?? item.clinicaNombre);
            return { ...item, rol, clinica };
        }));
        return this._normalizarClinicas(clinicas);
    }

    _extraerClinicas(persona) {
        const roles = persona.personasRoles
            ?? persona.roles
            ?? persona.paciente?.personasRoles
            ?? persona.paciente?.roles;

        // Los roles definen en qué clínicas la persona es paciente activo.
        if (Array.isArray(roles)) {
            return this._resolverClinicasPaciente(roles.filter((rol) => rol && this._estaActivo(rol)));
        }

        const fuentes = [
            persona.clinicas,
            persona.clinicasPaciente,
            persona.clinicasAsociadas,
            persona.clinicasRegistradas,
            persona.pacienteClinicas,
            persona.personaClinicas,
            persona.paciente?.clinicas,
            persona.persona?.clinicas
        ];

        for (const fuente of fuentes) {
            if (fuente != null) {
                return this._normalizarClinicas(fuente);
            }
        }

        return null;
    }

    _normalizarClinicas(valor) {
        let lista = valor;

        if (!Array.isArray(lista)) {
            if (!lista || typeof lista !== "object") {
                return [];
            }

            lista = lista.clinicas
                ?? lista.items
                ?? lista.datos
                ?? lista.resultado
                ?? [];
        }

        if (!Array.isArray(lista)) {
            return [];
        }

        const clinicas = new Map();

        lista.forEach((item) => {
            if (!item || !this._estaActivo(item)) {
                return;
            }

            const fuente = item.clinica ?? item.idClinica ?? item;
            const rol = item.rol ?? item.idRol ?? item.tipoRol ?? item.nombreRol ?? item.rolNombre;

            if (!this._estaActivo(fuente)
                || (rol != null && !this._esRolPaciente(item))) {
                return;
            }

            const id = typeof fuente === "object"
                ? fuente.idClinica ?? fuente.id ?? fuente.codigo
                : fuente;
            const nombre = typeof fuente === "object"
                ? fuente.nombre ?? fuente.name ?? fuente.descripcion
                : item.nombreClinica ?? item.nombre;

            if (id === undefined || id === null || String(id).trim() === "") {
                return;
            }

            const clave = String(id);

            if (!clinicas.has(clave)) {
                clinicas.set(clave, {
                    idClinica: id,
                    nombre: nombre ?? item.nombreClinica ?? item.nombre ?? clave
                });
            }
        });

        return Array.from(clinicas.values());
    }

    _esRolPaciente(item) {
        const rol = item?.rol ?? item?.idRol ?? item?.tipoRol ?? item?.nombreRol ?? item?.rolNombre;
        const nombre = typeof rol === "object"
            ? rol?.nombre ?? rol?.name ?? rol?.codigo ?? rol?.descripcion
            : rol;

        return this._estaActivo(item) && this._estaActivo(rol)
            && String(nombre ?? "").trim().toUpperCase() === "PACIENTE";
    }

    _estaActivo(item) {
        const estado = item?.estado ?? item?.estadoPersonaRol;
        const indicadores = [item?.activo, item?.activa,
            typeof estado === "object" ? estado?.nombre : estado];
        return !indicadores.some((valor) => /^(false|0|inactiv[oa]|cancelad[oa]|eliminad[oa]|deshabilitad[oa]|suspendid[oa]|baja)$/i
            .test(String(valor ?? "").trim()));
    }

    _numeroDocumento(persona) {
        return persona?.numeroDocumento
            ?? persona?.documento
            ?? persona?.dui
            ?? persona?.persona?.numeroDocumento
            ?? persona?.persona?.documento
            ?? persona?.persona?.dui
            ?? "";
    }

    _normalizarDocumento(valor) {
        return String(valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
}

export const personaService = new PersonaService();

export default PersonaService;
