import DefaultService from "./default_service.js";

export default class ConsultaService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "consultas";
    }
}
