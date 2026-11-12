import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class PersonaRolService extends DefaultService {
    constructor() {
        super(ENDPOINTS.personasRoles);
    }

    buscarPacientes(q, first = 0, max = 10) {
        return this.findRange(first, max, q);
    }
}
