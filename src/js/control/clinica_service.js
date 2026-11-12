import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class ClinicaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.clinicas);
    }
}
