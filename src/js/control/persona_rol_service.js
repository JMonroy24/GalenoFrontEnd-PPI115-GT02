import DefaultService from "./default_service.js";
import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";

export default class PersonaRolService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "personas_roles";
    }

    buscarPacientes(filtro, idClinica, max) {
        return new Promise((resolve, reject) => {
            fetch(`${this._urlBase}/pacientes?filtro=${encodeURIComponent(filtro)}&idClinica=${idClinica}&max=${max}`, { method: "GET" })
                .then(async (response) => {
                    if (response.status === 200) {
                        const totalRegistros = parseInt(response.headers.get("total-registros"), 10);
                        const total = Number.isNaN(totalRegistros) ? -1 : totalRegistros;
                        resolve(new DefaultResponse(await response.json(), total));
                    } else {
                        reject(new DefaultError("Error al buscar pacientes", response));
                    }
                })
                .catch((err) => {
                    reject(new DefaultError("Error al buscar pacientes", err));
                });
        });
    }
}
