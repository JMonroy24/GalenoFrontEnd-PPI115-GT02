import { aISO, formatearFecha, textoCorto } from "../util/fechas.js";

export default class ExamenResultado {
    constructor(datos = {}) {
        this.id = datos.id ?? datos.idExamenResultado ?? null;
        this.fechaCreacion = aISO(datos.fechaCreacion);
        this.resultado = datos.resultado ?? "";
        this.interpretacion = datos.interpretacion ?? "";
        this.rutaAtestado = datos.rutaAtestado ?? "";
        this.idOrdenExamen = datos.idOrdenExamen ?? null;
        this.ordenIndicaciones = datos.ordenIndicaciones ?? "";
    }

    static fromJSON(json) {
        return new ExamenResultado(json || {});
    }

    toJSON() {
        return {
            id: this.id,
            fechaCreacion: this.fechaCreacion,
            resultado: this.resultado || null,
            interpretacion: this.interpretacion || null,
            rutaAtestado: this.rutaAtestado || null,
            idOrdenExamen: this.idOrdenExamen || null
        };
    }

    get creadoEn() {
        return formatearFecha(this.fechaCreacion);
    }

    get resultadoVisible() {
        return this.resultado || "Resultado pendiente";
    }

    get interpretacionVisible() {
        return this.interpretacion || "Sin interpretación";
    }

    get tieneAtestado() {
        return Boolean(this.rutaAtestado);
    }

    get ordenVisible() {
        return this.idOrdenExamen ? `Orden ${textoCorto(this.idOrdenExamen)}` : "Sin orden asociada";
    }
}
