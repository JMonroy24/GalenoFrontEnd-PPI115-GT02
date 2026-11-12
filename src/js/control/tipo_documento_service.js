import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class TipoDocumentoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.tiposDocumento);
    }
}
