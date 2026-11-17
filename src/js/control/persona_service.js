import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class PersonaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS);
    }

    async buscarPorDui(dui) {
        const respuesta = await this.findRange(0, 1, dui);
        return respuesta.items[0] ?? null;
    }

    async buscarPorDocumento(tipoDocumento, numeroDocumento) {
        const numero = String(numeroDocumento ?? "").trim();

        if (numero === "") {
            return null;
        }

        const respuesta = await this.findRange(0, 20, numero);
        const personas = Array.isArray(respuesta?.items) ? respuesta.items : [];
        const documentoBuscado = this._normalizarDocumento(numero);

        return personas.find((persona) => {
            const tipo = persona?.idTipoDocumento ?? persona?.tipoDocumentoId
                ?? persona?.tipoDocumento ?? persona?.persona?.idTipoDocumento;
            const idTipo = typeof tipo === "object"
                ? tipo?.idTipoDocumento ?? tipo?.id ?? tipo?.codigo
                : tipo;

            return this._estaActivo(persona)
                && this._normalizarDocumento(this._numeroDocumento(persona)) === documentoBuscado
                && (idTipo == null || String(idTipo) === String(tipoDocumento));
        }) ?? null;
    }

    async buscarClinicasPaciente(tipoDocumento, numeroDocumento) {
        const persona = await this.buscarPorDocumento(tipoDocumento, numeroDocumento);

        if (!persona) {
            return [];
        }

        const clinicas = this._extraerClinicas(persona);

        // Una lista vacía embebida también es una respuesta definitiva.
        if (clinicas !== null) {
            return clinicas;
        }

        const idPersona = persona.idPersona
            ?? persona.id
            ?? persona.persona?.idPersona
            ?? persona.paciente?.idPersona;

        if (!idPersona) {
            return [];
        }

        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(idPersona)}/clinicas`,
            { method: "GET" },
            "Error al obtener las clínicas del paciente"
        );
        const payload = await this._parseBody(response);

        return this._normalizarClinicas(payload);
    }

    _extraerClinicas(persona) {
        const roles = persona.personasRoles
            ?? persona.roles
            ?? persona.paciente?.personasRoles
            ?? persona.paciente?.roles;

        // Los roles definen en qué clínicas la persona es paciente activo.
        if (Array.isArray(roles)) {
            return this._normalizarClinicas(
                roles.filter((rol) => this._esRolPaciente(rol))
            );
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
