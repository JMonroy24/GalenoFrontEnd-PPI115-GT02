import DefaultService from "./default_service.js";

export default class ClinicaService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "clinicas";
    }
}
