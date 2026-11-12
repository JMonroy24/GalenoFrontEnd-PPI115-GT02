import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class PersonaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.personas);
    }

    async buscarPorDui(dui) {
        const respuesta = await this.findRange(0, 1, dui);
        return respuesta.items[0] ?? null;
    }

    async crearPersona(personaDto) {
        const response = await this._request(this._urlBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(personaDto)
        }, "Error al crear la persona");

        const texto = await response.text();
        return texto.trim() === "" ? null : JSON.parse(texto);
    }
}
