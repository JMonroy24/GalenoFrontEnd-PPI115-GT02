import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class TipoMedioContactoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.tiposMedioContacto);
    }
}
