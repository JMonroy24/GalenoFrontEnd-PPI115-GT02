import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

export class PersonaRolService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS_ROLES);
    }

    buscarRolesPorPersona(q, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, q);
    }

    buscarPacientes(q, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, q);
    }
}

export const personaRolService = new PersonaRolService();

export default PersonaRolService;
