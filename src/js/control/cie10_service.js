import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";

/**
 * Servicio para consultar el catálogo de diagnósticos médicos CIE-10.
 * Hereda de DefaultService y aprovecha el parámetro 'q' de findRange.
 */
export class Cie10Service extends DefaultService {
    constructor() {
        super(ENDPOINTS.CIE10);
    }

    /**
     * Consulta diagnósticos que coincidan por código o nombre mediante el parámetro 'q'.
     *
     * @param {string} query - Término de búsqueda (código o nombre).
     * @param {number} [first=0] - Desplazamiento inicial.
     * @param {number} [max=DEFAULT_PAGE_SIZE] - Cantidad máxima de registros.
     * @returns {Promise<import("../entity/default_response.js").default>}
     */
    async buscarDiagnosticos(query = "", first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, query);
    }
}

export const cie10Service = new Cie10Service();

export default Cie10Service;
