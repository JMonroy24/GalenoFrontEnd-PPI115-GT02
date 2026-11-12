import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class ProcedimientoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PROCEDIMIENTOS);
    }

    async obtenerArbolPasos(idProcedimiento) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(idProcedimiento)}/pasos`,
            { method: "GET" },
            "Error al obtener los pasos del procedimiento"
        );

        return response.json();
    }

    obtenerArbolPasosAtencion(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }

    obtenerArbol(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }

    obtenerArbolProcedimientos(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }
}

export default ProcedimientoService;
