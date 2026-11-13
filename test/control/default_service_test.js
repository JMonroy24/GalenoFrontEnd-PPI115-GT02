import DefaultService from "../../src/js/control/default_service.js";
import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("DefaultService (unitaria)", () => {
    let fetchStub;
    let mensajeStub;
    const servicio = new DefaultService("/pruebas");
    const detalleOffline = "Operación no disponible sin conexión. Conéctese a internet para guardar los cambios";

    setup(() => {
        store.setState({ online: false });
        fetchStub = sinon.stub(window, "fetch");
        mensajeStub = sinon.stub(GeneradorMensajes, "crearMensaje");
    });

    teardown(() => {
        fetchStub?.restore();
        mensajeStub?.restore();
        store.setState({ online: true });
    });

    test("bloquea POST, PUT, PATCH y DELETE cuando no hay conexión", async () => {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            let error = null;

            try {
                await servicio._request("http://localhost/pruebas", { method });
            } catch (err) {
                error = err;
            }

            assert.instanceOf(error, DefaultError);
            expect(error.mensaje).to.equal(detalleOffline);
            expect(error.details.code).to.equal("OFFLINE");
        }

        expect(fetchStub.called).to.be.false;
        expect(mensajeStub.callCount).to.equal(4);
        expect(mensajeStub.firstCall.args).to.deep.equal([
            "Sin conexión",
            detalleOffline,
            "warning"
        ]);
    });

    test("el método create bloquea el POST sin conexión antes de llamar a fetch", async () => {
        let error = null;

        try {
            await servicio.create({ nombre: "Prueba" });
        } catch (err) {
            error = err;
        }

        assert.instanceOf(error, DefaultError);
        expect(fetchStub.called).to.be.false;
        expect(mensajeStub.calledOnce).to.be.true;
    });

    test("permite peticiones de lectura sin conexión", async () => {
        fetchStub.resolves({
            ok: true,
            status: 200,
            json: async () => ({ items: [] })
        });

        await servicio._request("http://localhost/pruebas", { method: "GET" });

        expect(fetchStub.calledOnce).to.be.true;
        expect(mensajeStub.called).to.be.false;
    });

    test("permite escrituras cuando la conexión está disponible", async () => {
        store.setState({ online: true });
        fetchStub.resolves({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ ok: true })
        });

        await servicio._request("http://localhost/pruebas", { method: "POST" });

        expect(fetchStub.calledOnce).to.be.true;
        expect(mensajeStub.called).to.be.false;
    });
});
