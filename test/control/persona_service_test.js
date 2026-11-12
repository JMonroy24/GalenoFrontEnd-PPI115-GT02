import PersonaService from "../../src/js/control/persona_service.js";
import DefaultError from "../../src/js/entity/default_error.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("PersonaService (unitaria)", () => {
    let fetchStub;
    const servicio = new PersonaService();

    const jsonOk = (body, status = 200) => ({
        ok: true,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: function () { return this; }
    });

    const jsonError = (status, body = {}) => ({
        ok: false,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: function () { return this; }
    });

    teardown(() => fetchStub?.restore());

    test("usa el endpoint /personas del backend", () => {
        fetchStub = sinon.stub(window, "fetch");
        expect(servicio._urlBase).to.match(/\/personas$/);
    });

    test("buscarPorDui devuelve la primera persona encontrada", async () => {
        const persona = { idPersona: 1, nombres: "Ana", apellidos: "Martínez", numeroDocumento: "01234567-8" };
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [persona], total: 1, first: 0, max: 1 })
        );

        const resultado = await servicio.buscarPorDui("01234567-8");

        expect(resultado).to.deep.equal(persona);
        const url = fetchStub.firstCall.args[0];
        expect(url).to.contain("q=01234567-8");
        expect(url).to.contain("max=1");
    });

    test("buscarPorDui devuelve null si no encuentra la persona", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [], total: 0, first: 0, max: 1 })
        );

        const resultado = await servicio.buscarPorDui("99999999-9");

        expect(resultado).to.be.null;
    });

    test("buscarPorDui propaga DefaultError si el servidor responde con error", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(500, { message: "Error interno" })
        );

        let error = null;
        try {
            await servicio.buscarPorDui("01234567-8");
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(500);
    });
});

