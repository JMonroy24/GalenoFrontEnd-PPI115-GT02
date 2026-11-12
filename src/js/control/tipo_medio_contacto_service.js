import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class TipoMedioContactoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.TIPOS_MEDIO_CONTACTO);
    }
}

export default TipoMedioContactoService;
