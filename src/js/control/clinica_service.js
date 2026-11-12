import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class ClinicaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.CLINICAS);
    }
}

export const clinicaService = new ClinicaService();

export default ClinicaService;
