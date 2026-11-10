import DefaultService from "./defaultService.js";

export default class ExamenResultadoService extends DefaultService {
    constructor() {
        super("/resources/v1/examenes-resultados");
    }

    async guardarResultado(datos, id = null) {
        return this.guardar(datos, id);
    }

    async registrarResultado(datos, id = null) {
        return this.guardar(datos, id);
    }
}
