import Cie10Service from "../../src/js/control/cie10_service.js";
import DefaultError from "../../src/js/entity/default_error.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import { store } from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Cie10Service (unitaria)", () => {
    let fetchStub;
    let servicio;

    const catalogo = [
        { idCie10: 1, codigo: "A00", nombre: "Cólera" },
        { idCie10: 2, codigo: "I10", nombre: "Hipertensión esencial (primaria)" },
        { idCie10: 3, codigo: "J00", nombre: "Resfriado común" }
    ];

    const ok = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
        status,
        headers: { "Content-Type": "application/json" }
    });

    setup(() => {
        store.state.online = true;
        servicio = new Cie10Service("/recursos/datos/cie10.json");
        servicio._catalogoLocal = catalogo;
    });

    teardown(() => {
        fetchStub?.restore();
        fetchStub = null;
        store.state.online = true;
    });

    test("buscarDiagnosticos consulta GET /cie10 con el parámetro q", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(ok({
            items: [catalogo[0]],
            total: 1,
            first: 0,
            max: 10
        }));

        const respuesta = await servicio.buscarDiagnosticos("A00");

        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.pathname).to.equal("/galenoSV/api/v1/cie10");
        expect(url.searchParams.get("q")).to.equal("A00");
        expect(url.searchParams.get("first")).to.equal("0");
        expect(url.searchParams.get("max")).to.equal("10");
        assert.instanceOf(respuesta, DefaultResponse);
        expect(respuesta.items).to.deep.equal([catalogo[0]]);
    });

    test("findRange delega en buscarDiagnosticos y mantiene el parámetro q", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(ok({
            items: [catalogo[2]],
            total: 1,
            first: 0,
            max: 20
        }));

        const respuesta = await servicio.findRange(0, 20, "resfriado");

        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("q")).to.equal("resfriado");
        expect(url.searchParams.get("max")).to.equal("20");
        expect(respuesta.items[0].codigo).to.equal("J00");
    });

    test("si el backend falla usa el catálogo local ignorando tildes y mayúsculas", async () => {
        fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("Failed to fetch"));

        const respuesta = await servicio.buscarDiagnosticos("HIPERTENSION");

        expect(fetchStub.calledOnce).to.be.true;
        expect(respuesta.items.map((item) => item.codigo)).to.deep.equal(["I10"]);
        expect(respuesta.total).to.equal(1);
        expect(respuesta.first).to.equal(0);
        expect(respuesta.max).to.equal(10);
    });

    test("en modo offline no llama al backend y devuelve coincidencias locales", async () => {
        fetchStub = sinon.stub(window, "fetch");
        store.state.online = false;

        const respuesta = await servicio.buscarDiagnosticos("A00");

        expect(fetchStub.called).to.be.false;
        expect(respuesta.items.map((item) => item.codigo)).to.deep.equal(["A00"]);
    });

    test("el respaldo local respeta first y max", async () => {
        fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("Failed to fetch"));

        const respuesta = await servicio.buscarDiagnosticos("", 1, 1);

        expect(respuesta.items.map((item) => item.codigo)).to.deep.equal(["I10"]);
        expect(respuesta.total).to.equal(3);
        expect(respuesta.first).to.equal(1);
        expect(respuesta.max).to.equal(1);
    });

    test("cachea el catálogo local y lo descarga una sola vez", async () => {
        servicio._catalogoLocal = null;
        let descargasLocales = 0;

        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const ruta = new URL(url, window.location.href).pathname;

            if (ruta.endsWith("/cie10")) {
                return ok({ message: "Backend no disponible" }, 500);
            }

            if (ruta.endsWith("/recursos/datos/cie10.json")) {
                descargasLocales += 1;
                return ok(catalogo);
            }

            throw new Error(`URL inesperada: ${ruta}`);
        });

        const primera = await servicio.buscarDiagnosticos("A00");
        const segunda = await servicio.buscarDiagnosticos("J00");

        expect(descargasLocales).to.equal(1);
        expect(servicio._catalogoLocal).to.deep.equal(catalogo);
        expect(primera.items[0].codigo).to.equal("A00");
        expect(segunda.items[0].codigo).to.equal("J00");
    });

    test("si falla el catálogo local propaga el error original del backend", async () => {
        servicio._catalogoLocal = null;

        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const ruta = new URL(url, window.location.href).pathname;

            if (ruta.endsWith("/cie10")) {
                throw new TypeError("Failed to fetch");
            }

            if (ruta.endsWith("/recursos/datos/cie10.json")) {
                return ok({ message: "Sin catálogo" }, 404);
            }

            throw new Error(`URL inesperada: ${ruta}`);
        });

        let error = null;
        try {
            await servicio.buscarDiagnosticos("A00");
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.error?.code).to.equal("NETWORK_ERROR");
    });

    test("una búsqueda cancelada no se respalda con el catálogo local", async () => {
        const abortado = Object.assign(new Error("Aborted"), { name: "AbortError" });
        fetchStub = sinon.stub(window, "fetch").rejects(abortado);

        let error = null;
        try {
            await servicio.buscarDiagnosticos("A00");
        } catch (e) {
            error = e;
        }

        expect(error).to.equal(abortado);
        expect(fetchStub.calledOnce).to.be.true;
    });
});
