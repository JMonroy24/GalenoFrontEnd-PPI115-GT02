import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class TipoDocumentoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.TIPOS_DOCUMENTO);
    }
}

export const tipoDocumentoService = new TipoDocumentoService();

export default TipoDocumentoService;
