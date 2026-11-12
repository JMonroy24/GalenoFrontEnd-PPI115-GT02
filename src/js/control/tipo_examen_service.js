import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class TipoExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.TIPOS_EXAMEN);
    }
}

export default TipoExamenService;
