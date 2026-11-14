import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

function normalizarContextoPaso(contexto) {
    if (contexto === null || contexto === undefined || contexto === "") {
        return {};
    }

    if (typeof contexto !== "object") {
        return { idPaso: contexto };
    }

    const idPaso = contexto.idPaso ?? contexto.idPasoClinico;

    return idPaso === null || idPaso === undefined || idPaso === ""
        ? {}
        : { idPaso };
}

export class OrdenExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ORDENES_EXAMEN);
    }

    /**
     * Registra en lote las órdenes de examen de una consulta.
     * Cada elemento puede ser un id de tipo de examen o un objeto de orden.
     * Si se recibe un paso, sus órdenes quedan vinculadas a `idPaso`.
     *
     * @param {string|number} idConsulta
     * @param {Array<string|number|object>} ordenes
     * @param {string|number|object} [contextoPaso]
     * @returns {Promise<Array<object>>} Órdenes creadas.
     */
    async crearOrdenes(idConsulta, ordenes = [], contextoPaso = null) {
        const contexto = normalizarContextoPaso(contextoPaso);
        const lista = Array.isArray(ordenes) ? ordenes : [ordenes];
        const payloads = lista.map((orden) =>
            (orden !== null && typeof orden === "object")
                ? { ...orden, ...contexto, idConsulta }
                : { idTipoExamen: orden, ...contexto, idConsulta }
        );
        const resultados = await Promise.allSettled(
            payloads.map((payload) => this.create(payload))
        );
        const fallido = resultados.find((resultado) => resultado.status === "rejected");

        if (fallido) {
            throw fallido.reason;
        }

        return resultados.map((resultado) => resultado.value);
    }

    asignarAConsulta(idConsulta, datosOrden = {}) {
        return this.create({ ...datosOrden, idConsulta });
    }

    asignarOrdenExamen(idConsulta, datosOrden = {}) {
        return this.asignarAConsulta(idConsulta, datosOrden);
    }

    asignarOrden(idConsulta, datosOrden = {}) {
        return this.asignarAConsulta(idConsulta, datosOrden);
    }

    asignarOrdenes(idConsulta, ordenes = [], contextoPaso = null) {
        return this.crearOrdenes(idConsulta, ordenes, contextoPaso);
    }

    asignarOrdenesAConsulta(idConsulta, ordenes = [], contextoPaso = null) {
        return this.crearOrdenes(idConsulta, ordenes, contextoPaso);
    }

    asignarOrdenesExamen(idConsulta, ordenes = [], contextoPaso = null) {
        return this.crearOrdenes(idConsulta, ordenes, contextoPaso);
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
