import DefaultService from "./defaultService.js";

export default class ConsultaService extends DefaultService {
    constructor() {
        super("/resources/v1/consultas");
    }
}
