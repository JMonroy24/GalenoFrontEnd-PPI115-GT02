import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

export class ExamenResultadoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.EXAMENES_RESULTADOS);
    }

    guardarResultado(datos, id = null) {
        return id === null || id === undefined || id === ""
            ? this.create(datos)
            : this.update(id, datos);
    }

    registrarResultado(datos, id = null) {
        return this.guardarResultado(datos, id);
    }

    consultarResultados(q = "", first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, q);
    }

    buscarPorOrden(idOrdenExamen, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, idOrdenExamen);
    }

    consultarResultadosPorOrden(idOrdenExamen, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.buscarPorOrden(idOrdenExamen, first, max);
    }
}

export default ExamenResultadoService;
