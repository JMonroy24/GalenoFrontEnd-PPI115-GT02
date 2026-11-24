import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";
import { estaActivo } from "../entity/rol_empleado.js";

const MAX_CATALOGOS = 200;
const CATEGORIA_POR_DEFECTO = "General";

function primero(origen, claves, valorPorDefecto = "") {
    for (const clave of claves) {
        const valor = origen?.[clave];

        if (valor !== undefined && valor !== null && valor !== "") {
            return valor;
        }
    }

    return valorPorDefecto;
}

function idDe(origen, claves) {
    for (const clave of claves) {
        const valor = origen?.[clave];

        if (valor !== undefined && valor !== null && valor !== "") {
            return typeof valor === "object" ? idDe(valor, claves) : valor;
        }
    }

    return null;
}

export class OrdenExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ORDENES_EXAMEN);
    }

    async listarExamenesPorPaso(idProcedimientoPaso) {
        if (idProcedimientoPaso == null || String(idProcedimientoPaso).trim() === '') return [];
        const examenes = [];
        const vistos = new Set();
        let first = 0;
        while (true) {
            const params = new URLSearchParams({ idProcedimientoPaso: String(idProcedimientoPaso),
                first: String(first), max: String(MAX_CATALOGOS) });
            const response = await this._request(`${ENDPOINTS.API_BASE}${ENDPOINTS.EXAMENES_ASIGNABLES}?${params}`,
                { method: 'GET' }, 'Error al listar los exámenes asignables');
            const payload = await response.json();
            const pagina = Array.isArray(payload) ? payload : payload?.items ?? [];
            let nuevos = 0;
            for (const examen of pagina) {
                const idExamen = examen.idExamen ?? examen.id;
                if (vistos.has(String(idExamen))) continue;
                vistos.add(String(idExamen));
                nuevos++;
                if (!estaActivo(examen) || String(examen.idProcedimientoPaso) !== String(idProcedimientoPaso)) continue;
                examenes.push({ idExamen, id: String(idExamen), nombre: examen.nombre ?? 'Examen sin nombre',
                    categoria: examen.nombreTipoExamen || CATEGORIA_POR_DEFECTO,
                    indicaciones: examen.indicaciones ?? '' });
            }
            first += pagina.length;
            if (!nuevos || first >= Number(payload?.total ?? first)) return examenes;
        }
    }

    _payloadOrden(idProcedimientoPaso, examen) {
        const esObjeto = examen !== null && typeof examen === "object";

        return {
            idExamen: esObjeto ? idDe(examen, ["idExamen", "id"]) : examen,
            idConsultaProcedimientoPaso: idProcedimientoPaso,
            indicaciones: esObjeto ? primero(examen, ["indicaciones", "indicacion"]) : ""
        };
    }

    async crearOrdenes(idConsultaProcedimientoPaso, examenes = []) {
        if (idConsultaProcedimientoPaso === null || idConsultaProcedimientoPaso === undefined
            || String(idConsultaProcedimientoPaso).trim() === "") {
            throw new Error("El paso no tiene un identificador válido para crear órdenes.");
        }

        const lista = Array.isArray(examenes) ? examenes : [examenes];

        if (lista.length === 0) {
            return [];
        }

        const payloads = lista.map((examen) =>
            this._payloadOrden(idConsultaProcedimientoPaso, examen));
        const resultados = await Promise.allSettled(
            payloads.map((payload) => this.create(payload))
        );
        const fallido = resultados.find((resultado) => resultado.status === "rejected");

        if (fallido) {
            throw fallido.reason;
        }

        return resultados.map((resultado) => resultado.value);
    }

    asignarAPaso(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.create(this._payloadOrden(idConsultaProcedimientoPaso, datosOrden));
    }

    asignarAConsulta(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrdenExamen(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrden(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrdenes(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    asignarOrdenesAConsulta(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    asignarOrdenesExamen(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    consultarPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, idConsulta);
    }

    consultarOrdenesPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.consultarPorConsulta(idConsulta, first, max);
    }
}

export const ordenExamenService = new OrdenExamenService();

export default OrdenExamenService;
