import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import config from "../../src/js/config.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("bdd");

// Se usa function() (no arrow) porque this.timeout depende del contexto que Mocha asigna al callback.
describe("ConsultaService (integración con Open Liberty)", function () {
    this.timeout(5000);

    it("responde 200 sin errores de CORS", async () => {
        const response = await fetch(`${config.API_BASE}consultas?first=0&max=10`);
        expect(response.status).to.equal(200);
    });

    it("findRange devuelve un DefaultResponse con arreglo de datos", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(resp).to.be.instanceOf(DefaultResponse);
        expect(resp.datos).to.be.an("array");
    });

    it("expone total-registros vía CORS", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(
            resp.total,
            "Si falla, el backend no envía Access-Control-Expose-Headers: total-registros"
        ).to.be.at.least(0);
    });
});
