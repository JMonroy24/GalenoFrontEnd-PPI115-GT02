import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

export class OrdenExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ORDENES_EXAMEN);
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
        return Promise.all(
            ordenes.map((orden) => this.asignarAConsulta(idConsulta, orden))
        );
    }

    asignarOrdenesAConsulta(idConsulta, ordenes = []) {
        return this.asignarOrdenes(idConsulta, ordenes);
    }

    asignarOrdenesExamen(idConsulta, ordenes = []) {
        return this.asignarOrdenes(idConsulta, ordenes);
    }

    consultarPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, idConsulta);
    }

    consultarOrdenesPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.consultarPorConsulta(idConsulta, first, max);
    }
}

export default OrdenExamenService;
