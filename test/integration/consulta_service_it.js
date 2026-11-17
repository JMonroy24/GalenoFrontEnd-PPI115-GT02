import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import { API_BASE } from "../../src/js/config.js";
import { ENDPOINTS } from "../../src/js/routes.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("bdd");

// Se usa function() (no arrow) porque this.timeout depende del contexto que Mocha asigna al callback.
describe("ConsultaService (integración con Open Liberty)", function () {
    this.timeout(5000);

    it("responde 200 por HTTP, sin errores de CORS", async function () {
        this.timeout(20000);
        const servicio = new ConsultaService();
        const response = await servicio._request(`${API_BASE}${ENDPOINTS.CONSULTAS}?first=0&max=10`);
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

    it("expone el contrato JSON de consultas con una petición fetch real", async function () {
        this.timeout(20000);

        const response = await fetch(
            `${API_BASE}${ENDPOINTS.CONSULTAS}?first=0&max=5`,
            { headers: { Accept: "application/json" } }
        );

        expect(response.status).to.equal(200);
        expect(response.ok).to.be.true;

        const payload = await response.json();
        expect(payload).to.have.property("items").that.is.an("array");
        expect(payload).to.have.property("total").that.is.a("number");
        expect(payload).to.have.property("first").that.is.a("number");
        expect(payload).to.have.property("max").that.is.a("number");
    });
});
