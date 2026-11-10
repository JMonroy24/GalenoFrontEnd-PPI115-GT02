import { aISO, formatearFecha, textoCorto } from "../util/fechas.js";

export default class OrdenExamen {
    constructor(datos = {}) {
        this.id = datos.id ?? datos.idOrdenExamen ?? null;
        this.fechaCreacion = aISO(datos.fechaCreacion);
        this.indicaciones = datos.indicaciones ?? "";
        this.idConsultaProcedimientoPaso = datos.idConsultaProcedimientoPaso ?? null;
        this.examenNombre = datos.examenNombre ?? datos.examen ?? "";
        this.pasoNombre = datos.pasoNombre ?? "";
        this.pacienteNombre = datos.pacienteNombre ?? "";
    }

    static fromJSON(json) {
        return new OrdenExamen(json || {});
    }

    toJSON() {
        return {
            id: this.id,
            fechaCreacion: this.fechaCreacion,
            indicaciones: this.indicaciones || null,
            idConsultaProcedimientoPaso: this.idConsultaProcedimientoPaso || null
        };
    }

    get creadaEn() {
        return formatearFecha(this.fechaCreacion);
    }

    get indicacionesVisibles() {
        return this.indicaciones || "Sin indicaciones";
    }

    get pasoVisible() {
        if (this.pasoNombre) {
            return this.pasoNombre;
        }
        return this.idConsultaProcedimientoPaso
            ? `Paso ${textoCorto(this.idConsultaProcedimientoPaso)}`
            : "Sin paso asociado";
    }

    get examenVisible() {
        return this.examenNombre || "Examen de laboratorio";
    }
}
