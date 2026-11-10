import DefaultService from "./default_service.js";

export default class TipoMedioContactoService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "tipos_medios_contactos";
    }
}
