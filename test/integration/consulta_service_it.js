import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import { ENDPOINTS } from "../../src/js/routes.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("bdd");

// Se usa function() (no arrow) porque this.timeout depende del contexto que Mocha asigna al callback.
describe("ConsultaService (integración con Open Liberty)", function () {
    this.timeout(5000);

    it("responde 200 sin errores de CORS", async () => {
        const response = await fetch(`${ENDPOINTS.API_BASE}${ENDPOINTS.CONSULTAS}?first=0&max=10`);
        expect(response.status).to.equal(200);
    });

    it("findRange devuelve items del payload estructurado", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(resp).to.be.instanceOf(DefaultResponse);
        expect(resp.items).to.be.an("array");
    });

    it("lee el total del payload estructurado", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(resp.total).to.be.a("number");
    });
});
