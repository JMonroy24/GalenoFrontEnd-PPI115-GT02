import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("ConsultaService (unitaria)", () => {
    let fetchStub;
    const servicio = new ConsultaService();

    teardown(() => fetchStub?.restore());

    test("findRange lee la respuesta estructurada y envía paginación y filtro", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({
                items: [{ idConsulta: 1 }],
                total: 1,
                first: 0,
                max: 10
            })
        });

        const resp = await servicio.findRange(0, 10, "consulta de prueba");

        assert.instanceOf(resp, DefaultResponse);
        expect(resp.total).to.equal(1);
        expect(resp.datos).to.have.length(1);
        expect(resp.items).to.equal(resp.datos);
        expect(resp.first).to.equal(0);
        expect(resp.max).to.equal(10);
        expect(fetchStub.firstCall.args[0].toString()).to.contain(
            "consultas?first=0&max=10&q=consulta+de+prueba"
        );
    });

    test("findRange conserva el total 0 del payload", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0, first: 0, max: 10 })
        });

        const resp = await servicio.findRange(0, 10);

        expect(resp.total).to.equal(0);
    });

    test("findRange rechaza con DefaultError cuando response.ok es false", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: false,
            status: 500
        });

        let error;
        try {
            await servicio.findRange(0, 10);
        } catch (err) {
            error = err;
        }

        assert.instanceOf(error, DefaultError);
    });

    test("inyecta el token y cierra la sesión al recibir 401", async () => {
        store.setState("session", { token: "test-token" });
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: false,
            status: 401,
            clone: () => ({
                json: async () => ({ message: "Token expirado", reason: "expired" })
            })
        });

        let error;
        try {
            await servicio.findRange(0, 10);
        } catch (err) {
            error = err;
        } finally {
            store.setState("session", null);
        }

        assert.instanceOf(error, DefaultError);
        expect(fetchStub.firstCall.args[1].headers.get("Authorization")).to.equal("Bearer test-token");
        expect(store.getState().session).to.equal(null);
        expect(error.status).to.equal(401);
        expect(error.message).to.equal("Token expirado");
        expect(error.details.reason).to.equal("expired");
    });

    test("rechaza con DefaultError 422 cuando el servidor indica entidad no procesable", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: false,
            status: 422,
            clone: () => ({
                json: async () => ({ message: "Datos de consulta inválidos" })
            })
        });

        let error;
        try {
            await servicio.findRange(0, 10);
        } catch (err) {
            error = err;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(422);
        expect(error.mensaje).to.equal("Datos de consulta inválidos");
    });

    test("buscarPorPacienteYFechas envía idClinica en los query params", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0, first: 0, max: 10 })
        });

        await servicio.buscarPorPacienteYFechas({
            tipoDocumento: "DUI",
            numeroDocumento: "01234567-8",
            idClinica: "uuid-clinica-123",
            fechaDesde: "2024-01-01",
            fechaHasta: "2024-12-31"
        });

        const url = fetchStub.firstCall.args[0].toString();
        expect(url).to.contain("idClinica=uuid-clinica-123");
        expect(url).to.contain("tipoDocumento=DUI");
        expect(url).to.contain("numeroDocumento=01234567-8");
        expect(url).to.contain("fechaDesde=2024-01-01");
        expect(url).to.contain("fechaHasta=2024-12-31");
    });
});
