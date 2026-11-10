import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import DefaultError from "../../src/js/entity/default_error.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("ConsultaService (unitaria)", () => {
    let fetchStub;
    const servicio = new ConsultaService();

    teardown(() => fetchStub.restore());

    test("findRange devuelve DefaultResponse y usa el header total-registros", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            status: 200,
            json: async () => [{ idConsulta: 1 }],
            headers: new Map([["total-registros", "1"]])
        });

        const resp = await servicio.findRange(0, 10);

        assert.instanceOf(resp, DefaultResponse);
        expect(resp.total).to.equal(1);
        expect(resp.datos).to.have.length(1);
        expect(fetchStub.firstCall.args[0]).to.contain("consultas?first=0&max=10");
    });

    test("findRange conserva total 0 cuando el header es 0", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            status: 200,
            json: async () => [],
            headers: new Map([["total-registros", "0"]])
        });

        const resp = await servicio.findRange(0, 10);

        expect(resp.total).to.equal(0);
    });

    test("findRange rechaza con DefaultError cuando el status no es 200", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            status: 500,
            headers: new Map()
        });

        let error;
        try {
            await servicio.findRange(0, 10);
        } catch (err) {
            error = err;
        }

        assert.instanceOf(error, DefaultError);
    });
});
