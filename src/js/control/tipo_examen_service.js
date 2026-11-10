import DefaultService from "./default_service.js";

export default class TipoExamenService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "tipos_examenes";
    }
}
