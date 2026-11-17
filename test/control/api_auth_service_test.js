import { ApiAuthService, apiAuthService } from "../../src/js/control/api_auth_service.js";
import DefaultService from "../../src/js/control/default_service.js";
import { API_BASE } from "../../src/js/config.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Autenticación BASIC de la API", () => {
    let fetchStub;

    teardown(() => {
        fetchStub?.restore();
        apiAuthService.logout();
        apiAuthService.formulario = null;
    });

    test("valida la cuenta por HTTPS y conserva BASIC sólo en memoria", async () => {
        const servicio = new ApiAuthService();
        const antes = sessionStorage.getItem("galeno_session");
        fetchStub = sinon.stub(window, "fetch").resolves({ ok: true });

        const autorizacion = await servicio.autenticar("clinico", "clave-de-prueba");

        expect(autorizacion).to.equal(`Basic ${btoa("clinico:clave-de-prueba")}`);
        expect(fetchStub.firstCall.args[0]).to.equal(`${API_BASE}/tipos-documento?first=0&max=1`);
        expect(fetchStub.firstCall.args[1].credentials).to.equal("omit");
        expect(sessionStorage.getItem("galeno_session")).to.equal(antes);
        servicio.logout();
        expect(servicio.autorizacion).to.be.null;
    });

    test("rechaza credenciales incorrectas sin crear autorización", async () => {
        const servicio = new ApiAuthService();
        fetchStub = sinon.stub(window, "fetch").resolves({ ok: false, status: 401 });

        let error;
        try { await servicio.autenticar("clinico", "incorrecta"); } catch (err) { error = err; }

        expect(error?.status).to.equal(401);
        expect(servicio.autorizacion).to.be.null;
    });

    test("comparte una sola solicitud de credenciales entre peticiones concurrentes", async () => {
        const servicio = new ApiAuthService();
        let resolver;
        const formulario = sinon.stub().returns(new Promise((resolve) => { resolver = resolve; }));
        servicio.formulario = formulario;
        const primera = servicio.solicitarCredenciales();
        const segunda = servicio.solicitarCredenciales();
        await Promise.resolve();
        resolver("Basic prueba");

        expect(primera).to.equal(segunda);
        expect(await primera).to.equal("Basic prueba");
        expect(formulario.calledOnce).to.be.true;
    });

    test("reintenta el catálogo protegido después de autenticar, conservando la URL", async () => {
        const servicio = new DefaultService("/tipos-documento");
        fetchStub = sinon.stub(window, "fetch");
        fetchStub.onFirstCall().resolves({ ok: false, status: 401 });
        fetchStub.onSecondCall().resolves({ ok: true, json: async () => ({ items: [{ nombre: "DUI" }] }) });
        apiAuthService.formulario = async () => {
            apiAuthService.autorizacion = "Basic credencial-de-prueba";
            return apiAuthService.autorizacion;
        };

        const respuesta = await servicio.findRange();

        expect(respuesta.items[0].nombre).to.equal("DUI");
        expect(fetchStub.callCount).to.equal(2);
        expect(fetchStub.firstCall.args[0]).to.equal(fetchStub.secondCall.args[0]);
        expect(fetchStub.secondCall.args[1].headers.get("Authorization")).to.equal("Basic credencial-de-prueba");
    });

    test("no envía la credencial BASIC a otro servidor", async () => {
        apiAuthService.autorizacion = "Basic credencial-de-prueba";
        fetchStub = sinon.stub(window, "fetch").resolves({ ok: true });

        await new DefaultService("/tipos-documento")._request("https://otro-servidor.invalid/recurso");

        expect(fetchStub.firstCall.args[1].headers.get("Authorization")).not.to.equal(apiAuthService.autorizacion);
    });
});
