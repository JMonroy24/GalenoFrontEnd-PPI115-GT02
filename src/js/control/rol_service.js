import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class RolService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ROLES);
    }
}

export default RolService;
