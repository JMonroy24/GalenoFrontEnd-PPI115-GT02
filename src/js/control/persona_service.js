import DefaultService from "./default_service.js";
import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";

export default class PersonaService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "personas";
    }

    buscarPorDui(dui) {
        return new Promise((resolve, reject) => {
            fetch(`${this._urlBase}/dui/${encodeURIComponent(dui)}`, { method: "GET" })
                .then(async (response) => {
                    if (response.status === 200) {
                        resolve(await response.json());
                    } else if (response.status === 404) {
                        resolve(null);
                    } else {
                        reject(new DefaultError("Error al buscar la persona", response));
                    }
                })
                .catch((err) => {
                    reject(new DefaultError("Error al buscar la persona", err));
                });
        });
    }

    crearPersona(personaDto) {
        return new Promise((resolve, reject) => {
            fetch(this._urlBase, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(personaDto)
            })
                .then(async (response) => {
                    if (response.status === 200 || response.status === 201) {
                        const texto = await response.text();
                        if (texto === null || texto.trim() === "") {
                            resolve(null);
                        } else {
                            resolve(JSON.parse(texto));
                        }
                    } else {
                        reject(new DefaultError("Error al crear la persona", response));
                    }
                })
                .catch((err) => {
                    reject(new DefaultError("Error al crear la persona", err));
                });
        });
    }
}
