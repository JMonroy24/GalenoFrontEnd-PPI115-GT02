import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

export class OrdenExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ORDENES_EXAMEN);
    }

    /**
     * Registra en lote las órdenes de examen de una consulta.
     * Cada elemento puede ser un id de tipo de examen o un objeto de orden.
     * Se envían todas en paralelo y, si alguna falla, se lanza el primer error
     * después de haber intentado todas (no se aborta a mitad del lote).
     *
     * @param {string|number} idConsulta
     * @param {Array<string|number|object>} ordenes
     * @returns {Promise<Array<object>>} Órdenes creadas.
     */
    async crearOrdenes(idConsulta, ordenes = []) {
        const payloads = ordenes.map((orden) =>
            (orden !== null && typeof orden === "object")
                ? { ...orden, idConsulta }
                : { idTipoExamen: orden, idConsulta }
        );
        const resultados = await Promise.allSettled(
            payloads.map((payload) => this.create(payload))
        );
        const fallido = resultados.find((r) => r.status === "rejected");

        if (fallido) {
            throw fallido.reason;
        }

        return resultados.map((r) => r.value);
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

    asignarOrdenes(idConsulta, ordenes = []) {
        return this.crearOrdenes(idConsulta, ordenes);
    }

    asignarOrdenesAConsulta(idConsulta, ordenes = []) {
        return this.crearOrdenes(idConsulta, ordenes);
    }

    asignarOrdenesExamen(idConsulta, ordenes = []) {
        return this.crearOrdenes(idConsulta, ordenes);
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
