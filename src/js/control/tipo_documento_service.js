import DefaultService from "./default_service.js";

export default class TipoDocumentoService extends DefaultService {
    constructor() {
        super();
        this._urlBase += "tipos_documentos";
    }
}
