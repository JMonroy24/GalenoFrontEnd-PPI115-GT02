import DefaultService from "../../src/js/control/default_service.js";
import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import "../../src/js/boundary/componentes/notificacion_emergente.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("DefaultService (unitaria)", () => {
    let fetchStub;
    let mensajeStub;
    const servicio = new DefaultService("/pruebas");
    const detalleOffline = "Operación no disponible sin conexión. Conéctese a internet para guardar, modificar o eliminar datos.";

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

    test("findRange lee items, total, first y max del cuerpo JSON", async () => {
        const payload = {
            items: [{ id: 21, nombre: "Prueba" }],
            total: 45,
            first: 20,
            max: 20
        };
        fetchStub.resolves({
            ok: true,
            status: 200,
            json: async () => payload
        });

        const respuesta = await servicio.findRange(20, 20, "consulta de prueba");

        assert.instanceOf(respuesta, DefaultResponse);
        expect(respuesta.items).to.deep.equal(payload.items);
        expect(respuesta.datos).to.equal(respuesta.items);
        expect(respuesta.total).to.equal(45);
        expect(respuesta.first).to.equal(20);
        expect(respuesta.max).to.equal(20);
        expect(fetchStub.calledOnce).to.be.true;
        expect(fetchStub.firstCall.args[0]).to.equal(
            "https://localhost:9443/galenoSV/api/v1/pruebas?first=20&max=20&q=consulta+de+prueba"
        );
        expect(fetchStub.firstCall.args[1].method).to.equal("GET");
    });

    test("findRange conserva una página vacía con total 0", async () => {
        const payload = { items: [], total: 0, first: 0, max: 20 };
        fetchStub.resolves({
            ok: true,
            status: 200,
            json: async () => payload
        });

        const respuesta = await servicio.findRange(0, 20);

        assert.instanceOf(respuesta, DefaultResponse);
        expect(respuesta.items).to.deep.equal([]);
        expect(respuesta.total).to.equal(0);
        expect(respuesta.first).to.equal(0);
        expect(respuesta.max).to.equal(20);
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

    test("informa errores de red, HTTPS o CORS sin confundirlos con respuestas HTTP", async () => {
        fetchStub.rejects(new TypeError("Failed to fetch"));

        let error;
        try {
            await servicio.findRange();
        } catch (err) {
            error = err;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.be.null;
        expect(error.error.code).to.equal("NETWORK_ERROR");
        expect(error.message).to.contain("https://localhost:9443");
        expect(error.message).to.contain("certificado HTTPS");
        expect(error.message).to.contain("CORS");
        expect(error.details.causa).to.equal("Failed to fetch");
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("conserva las cancelaciones de solicitudes", async () => {
        const cancelacion = new DOMException("Solicitud cancelada", "AbortError");
        fetchStub.rejects(cancelacion);

        let error;
        try {
            await servicio.findRange();
        } catch (err) {
            error = err;
        }

        expect(error).to.equal(cancelacion);
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

    for (const [metodo, ejecutar] of [
        ["POST", () => servicio.create({ nombre: "Prueba offline" })],
        ["PUT", () => servicio.update(1, { nombre: "Prueba offline" })],
        ["DELETE", () => servicio.delete(1)]
    ]) {
        test(`${metodo} muestra una advertencia visual si navigator está offline aunque el store siga online`, async () => {
            store.setState({ online: true });
            const conexion = sinon.stub(navigator, "onLine").value(false);
            mensajeStub.restore();
            mensajeStub = sinon.spy(GeneradorMensajes, "crearMensaje");
            const notificacion = document.createElement("notificacion-emergente");
            document.body.appendChild(notificacion);
            const escuchar = sinon.spy();
            window.addEventListener("notificacion", escuchar);

            try {
                let error;
                try { await ejecutar(); } catch (err) { error = err; }

                assert.instanceOf(error, DefaultError);
                expect(error.details).to.deep.equal({ code: "OFFLINE", method: metodo });
                expect(fetchStub.called).to.be.false;
                expect(escuchar.calledOnce).to.be.true;
                expect(escuchar.firstCall.args[0]).to.be.instanceOf(CustomEvent);
                expect(escuchar.firstCall.args[0].detail).to.deep.equal({
                    titulo: "Sin conexión", detalle: detalleOffline, tipo: "warning"
                });
                const aviso = notificacion.shadowRoot.querySelector(".banner.warning");
                expect(aviso).to.exist;
                expect(aviso.textContent).to.contain(detalleOffline);
                expect(getComputedStyle(aviso).display).to.equal("flex");
                expect(aviso.getBoundingClientRect().height).to.be.greaterThan(0);
            } finally {
                window.removeEventListener("notificacion", escuchar);
                notificacion.remove();
                conexion.restore();
            }
        });
    }
});
