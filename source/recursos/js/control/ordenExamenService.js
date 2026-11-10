import DefaultService from "./defaultService.js";

export default class OrdenExamenService extends DefaultService {
    constructor() {
        super("/resources/v1/ordenes-examen");
    }
}
