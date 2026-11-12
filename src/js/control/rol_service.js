import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../config.js";

export default class RolService extends DefaultService {
    constructor() {
        super(ENDPOINTS.roles);
    }
}
