import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class TipoExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.tiposExamen);
    }
}
