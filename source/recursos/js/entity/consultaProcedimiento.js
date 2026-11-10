import { aISO, formatearPeriodo, textoCorto } from "../util/fechas.js";

export default class ConsultaProcedimiento {
    constructor(datos = {}) {
        this.id = datos.id ?? datos.idConsultaProcedimiento ?? null;
        this.fechaInicio = aISO(datos.fechaInicio);
        this.fechaFin = aISO(datos.fechaFin);
        this.observaciones = datos.observaciones ?? "";
        this.idConsulta = datos.idConsulta ?? null;
        this.idProcedimiento = datos.idProcedimiento ?? null;
        this.procedimientoNombre = datos.procedimientoNombre ?? datos.procedimiento ?? "";
    }

    static fromJSON(json) {
        return new ConsultaProcedimiento(json || {});
    }

    toJSON() {
        return {
            id: this.id,
            fechaInicio: this.fechaInicio,
            fechaFin: this.fechaFin,
            observaciones: this.observaciones || null,
            idConsulta: this.idConsulta || null,
            idProcedimiento: this.idProcedimiento || null
        };
    }

    get nombreProcedimiento() {
        return this.procedimientoNombre || `Procedimiento ${textoCorto(this.idProcedimiento)}`;
    }

    get periodo() {
        return formatearPeriodo(this.fechaInicio, this.fechaFin);
    }

    get observacionesVisibles() {
        return this.observaciones || "Sin observaciones";
    }
}
