import { aISO, estaVencida, estaVigente, formatearPeriodo, textoCorto } from "../util/fechas.js";

export default class Consulta {
    constructor(datos = {}) {
        this.id = datos.id ?? datos.idConsulta ?? null;
        this.fechaInicio = aISO(datos.fechaInicio);
        this.fechaFin = aISO(datos.fechaFin);
        this.referenciaExterna = datos.referenciaExterna ?? "";
        this.observaciones = datos.observaciones ?? "";
        this.idPersonaRol = datos.idPersonaRol ?? null;
        this.pacienteNombre = datos.pacienteNombre ?? datos.paciente ?? "";
        this.documento = datos.documento ?? "";
        this.estado = datos.estado ?? "";
    }

    static fromJSON(json) {
        return new Consulta(json || {});
    }

    toJSON() {
        return {
            id: this.id,
            fechaInicio: this.fechaInicio,
            fechaFin: this.fechaFin,
            referenciaExterna: this.referenciaExterna || null,
            observaciones: this.observaciones || null,
            idPersonaRol: this.idPersonaRol || null
        };
    }

    get nombrePaciente() {
        return this.pacienteNombre || "Paciente sin asignar";
    }

    get documentoVisible() {
        if (this.documento) {
            return this.documento;
        }
        return this.idPersonaRol ? `Rol ${textoCorto(this.idPersonaRol)}` : "Sin documento";
    }

    get periodo() {
        return formatearPeriodo(this.fechaInicio, this.fechaFin);
    }

    get estadoEtiqueta() {
        if (this.estado) {
            return this.estado;
        }
        if (estaVencida(this.fechaFin)) {
            return "Finalizada";
        }
        return estaVigente(this.fechaInicio, this.fechaFin) ? "En curso" : "Programada";
    }

    get activa() {
        return !estaVencida(this.fechaFin);
    }

    get referenciaVisible() {
        return this.referenciaExterna || "Sin referencia externa";
    }
}
