import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class PersonaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PERSONAS);
    }

    async buscarPorDui(dui) {
        const respuesta = await this.findRange(0, 1, dui);
        return respuesta.items[0] ?? null;
    }
}

export default PersonaService;
