import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class ProcedimientoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.procedimientos);
    }

    async obtenerArbolPasos(idProcedimiento) {
        const response = await this._request(
            `${this._urlBase}/${idProcedimiento}/pasos`,
            { method: "GET" },
            "Error al obtener los pasos del procedimiento"
        );
        return response.json();
    }
}
