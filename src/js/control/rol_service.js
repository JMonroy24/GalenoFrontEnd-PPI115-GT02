import DefaultService from "./default_service.js";

export default class RolService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "roles";
    }
}
