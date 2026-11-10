import DefaultService from "./default_service.js";
import DefaultError from "../entity/default_error.js";

export default class ProcedimientoService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "procedimientos";
    }

    obtenerArbolPasos(idProcedimiento) {
        return new Promise((resolve, reject) => {
            fetch(`${this._urlBase}/${idProcedimiento}/pasos`, { method: "GET" })
                .then(async (response) => {
                    if (response.status === 200) {
                        resolve(await response.json());
                    } else {
                        reject(new DefaultError("Error al obtener los pasos del procedimiento", response));
                    }
                })
                .catch((err) => {
                    reject(new DefaultError("Error al obtener los pasos del procedimiento", err));
                });
        });
    }
}
