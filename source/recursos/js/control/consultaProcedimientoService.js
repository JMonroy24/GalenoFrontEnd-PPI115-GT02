import DefaultService from "./defaultService.js";

export default class ConsultaProcedimientoService extends DefaultService {
    constructor() {
        super("/resources/v1/consultas/procedimientos");
    }
}
