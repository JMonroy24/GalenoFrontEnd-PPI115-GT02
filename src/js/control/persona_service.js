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

        return personas.find((persona) => (
            this._normalizarDocumento(this._numeroDocumento(persona)) === documentoBuscado
        )) ?? personas[0] ?? null;
    }

    async buscarClinicasPaciente(tipoDocumento, numeroDocumento) {
        const persona = await this.buscarPorDocumento(tipoDocumento, numeroDocumento);

        if (!persona) {
            return [];
        }

        const clinicas = this._extraerClinicas(persona);

        if (clinicas.length > 0) {
            return clinicas;
        }

        const idPersona = persona.idPersona
            ?? persona.id
            ?? persona.persona?.idPersona
            ?? persona.paciente?.idPersona;

        if (!idPersona) {
            return [];
        }

        try {
            const response = await this._request(
                `${this._urlBase}/${encodeURIComponent(idPersona)}/clinicas`,
                { method: "GET" },
                "Error al obtener las clínicas del paciente"
            );
            const payload = await this._parseBody(response);

            return this._normalizarClinicas(payload);
        } catch {
            return [];
        }
    }

    _extraerClinicas(persona) {
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
            const clinicas = this._normalizarClinicas(fuente);

            if (clinicas.length > 0) {
                return clinicas;
            }
        }

        const roles = persona.personasRoles
            ?? persona.roles
            ?? persona.paciente?.personasRoles
            ?? persona.paciente?.roles;

        if (!Array.isArray(roles)) {
            return [];
        }

        return this._normalizarClinicas(
            roles.filter((rol) => this._esRolPaciente(rol))
        );
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
            if (!item) {
                return;
            }

            const fuente = item.clinica ?? item.idClinica ?? item;
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
        const rol = item?.rol ?? item?.tipoRol ?? item?.nombreRol ?? item?.rolNombre;
        const nombre = typeof rol === "object"
            ? rol.nombre ?? rol.name ?? rol.codigo ?? rol.descripcion
            : rol;

        return String(nombre ?? "").toUpperCase().includes("PACIENTE");
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
