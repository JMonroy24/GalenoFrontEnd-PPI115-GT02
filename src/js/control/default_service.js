import config from "../config.js";
import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";

export default class DefaultService {
    constructor() {
        this._urlBase = config.API_BASE;
    }

    findRange(first, max) {
        return new Promise((resolve, reject) => {
            fetch(`${this._urlBase}?first=${first}&max=${max}`, { method: "GET" })
                .then((response) => {
                    if (response.status === 200) {
                        const totalRegistros = parseInt(response.headers.get("total-registros"), 10);
                        const total = Number.isNaN(totalRegistros) ? -1 : totalRegistros;
                        return response.json().then((datos) => {
                            resolve(new DefaultResponse(datos, total));
                        });
                    }
                    reject(new DefaultError("Error al acceder al repositorio", response));
                })
                .catch((err) => {
                    reject(new DefaultError("Error al acceder al repositorio", err));
                });
        });
    }

    buscarActivos() {
        const urlBase = this._urlBase.replace(/\/+$/, "");
        return new Promise((resolve, reject) => {
            fetch(`${urlBase}/activos`, { method: "GET" })
                .then((response) => {
                    if (response.status === 200) {
                        const totalRegistros = parseInt(response.headers.get("total-registros"), 10);
                        const total = Number.isNaN(totalRegistros) ? -1 : totalRegistros;
                        return response.json().then((datos) => {
                            resolve(new DefaultResponse(datos, total));
                        });
                    }
                    reject(new DefaultError("Error al acceder al repositorio", response));
                })
                .catch((err) => {
                    reject(new DefaultError("Error al acceder al repositorio", err));
                });
        });
    }
}
