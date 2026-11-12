import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class ConsultaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.consultas);
    }
}
