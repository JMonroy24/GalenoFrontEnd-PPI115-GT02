import OrdenExamenService from "../../src/js/control/orden_examen_service.js";
import DefaultError from "../../src/js/entity/default_error.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("OrdenExamenService (unitaria)", () => {
    let fetchStub;
    const servicio = new OrdenExamenService();

    const ok = (cuerpo, status = 201) =>
        new Response(JSON.stringify(cuerpo), {
            status,
            headers: { "Content-Type": "application/json" }
        });

    const cuerpoEnviado = (llamada) => JSON.parse(llamada.args[1].body);

    teardown(() => fetchStub?.restore());

    test("usa el endpoint /ordenes-examen del backend", () => {
        fetchStub = sinon.stub(window, "fetch");
        expect(servicio._urlBase).to.match(/\/ordenes-examen$/);
    });

    test("listarExamenesPorPaso filtra por idProcedimientoPaso y resuelve los exámenes en /examenes", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const ruta = new URL(url).pathname;

            if (ruta.endsWith("/procedimientos-pasos-examenes")) {
                return ok([
                    { idProcedimientoPaso: "p-9", idExamen: 1, indicaciones: "Ayuno" },
                    { idProcedimientoPaso: "p-9", idExamen: 2, indicaciones: "" }
                ]);
            }
            if (ruta.endsWith("/examenes/1")) {
                return ok({ idExamen: 1, nombre: "Hemograma", activo: true });
            }
            if (ruta.endsWith("/examenes/2")) {
                return ok({ idExamen: 2, nombre: "Glucosa", activo: true });
            }
            if (ruta.endsWith("/examenes-tipos-examen")) {
                return ok([{ idExamen: 1, idTipoExamen: 7 }]);
            }
            if (ruta.endsWith("/tipos-examen")) {
                return ok([{ idTipoExamen: 7, nombre: "Laboratorio" }]);
            }

            throw new Error(`URL inesperada: ${ruta}`);
        });

        const examenes = await servicio.listarExamenesPorPaso("p-9");
        const rutas = fetchStub.getCalls().map((llamada) => new URL(llamada.args[0]));
        const llamadaPasos = rutas.find((ruta) => ruta.pathname.endsWith("/procedimientos-pasos-examenes"));

        expect(llamadaPasos.searchParams.get("idProcedimientoPaso")).to.equal("p-9");
        expect(rutas.filter((ruta) => /\/examenes\/\d+$/.test(ruta.pathname))
            .map((ruta) => ruta.pathname)).to.deep.equal([
            "/galenoSV/api/v1/examenes/1",
            "/galenoSV/api/v1/examenes/2"
        ]);
        expect(examenes).to.deep.equal([
            {
                idExamen: 1,
                id: "1",
                nombre: "Hemograma",
                categoria: "Laboratorio",
                indicaciones: "Ayuno"
            },
            {
                idExamen: 2,
                id: "2",
                nombre: "Glucosa",
                categoria: "General",
                indicaciones: ""
            }
        ]);
    });

    test("listarExamenesPorPaso sin identificador no hace peticiones", async () => {
        fetchStub = sinon.stub(window, "fetch");

        expect(await servicio.listarExamenesPorPaso("")).to.deep.equal([]);
        expect(fetchStub.called).to.be.false;
    });

    test("crearOrdenes envía un POST por examen con el DTO del backend", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({ idOrdenExamen: 1 }));

        const creadas = await servicio.crearOrdenes("p-9", [
            { idExamen: "1", indicaciones: "Ayuno" },
            { idExamen: "3", indicaciones: "" }
        ]);

        expect(fetchStub.callCount).to.equal(2);
        expect(fetchStub.firstCall.args[1].method).to.equal("POST");
        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({
            idExamen: "1",
            idConsultaProcedimientoPaso: "p-9",
            indicaciones: "Ayuno"
        });
        expect(cuerpoEnviado(fetchStub.secondCall)).to.deep.equal({
            idExamen: "3",
            idConsultaProcedimientoPaso: "p-9",
            indicaciones: ""
        });
        expect(creadas).to.have.length(2);
    });

    test("crearOrdenes acepta ids simples y deja indicaciones vacías", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({ idOrdenExamen: 1 }));

        await servicio.crearOrdenes("p-9", ["1", "3"]);

        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({
            idExamen: "1",
            idConsultaProcedimientoPaso: "p-9",
            indicaciones: ""
        });
        expect(cuerpoEnviado(fetchStub.secondCall)).to.deep.equal({
            idExamen: "3",
            idConsultaProcedimientoPaso: "p-9",
            indicaciones: ""
        });
    });

    test("crearOrdenes con lista vacía no hace peticiones y devuelve []", async () => {
        fetchStub = sinon.stub(window, "fetch");

        const creadas = await servicio.crearOrdenes("p-9", []);

        expect(fetchStub.called).to.be.false;
        expect(creadas).to.deep.equal([]);
    });

    test("crearOrdenes exige el identificador del paso", async () => {
        fetchStub = sinon.stub(window, "fetch");

        let error = null;
        try {
            await servicio.crearOrdenes("", ["1"]);
        } catch (e) {
            error = e;
        }

        expect(error?.message).to.contain("identificador");
        expect(fetchStub.called).to.be.false;
    });

    test("si una orden falla intenta todas y lanza el DefaultError del fallo", async () => {
        let n = 0;
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => {
            n += 1;
            return n === 2
                ? ok({ message: "Orden inválida" }, 422)
                : ok({ idOrdenExamen: n });
        });

        let error = null;
        try {
            await servicio.crearOrdenes("p-9", ["1", "2", "3"]);
        } catch (e) {
            error = e;
        }

        expect(fetchStub.callCount).to.equal(3);
        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(422);
        expect(error.mensaje).to.equal("HTTP 422: Orden inválida");
    });

    test("un error de red se propaga sin ser tragado", async () => {
        fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("Failed to fetch"));

        let error = null;
        try {
            await servicio.crearOrdenes("p-9", ["1"]);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.error.code).to.equal("NETWORK_ERROR");
        expect(error.details.causa).to.equal("Failed to fetch");
    });

    test("asignarOrdenes delega en crearOrdenes", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({}));

        await servicio.asignarOrdenes("p-1", ["5"]);

        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({
            idExamen: "5",
            idConsultaProcedimientoPaso: "p-1",
            indicaciones: ""
        });
    });

    test("cada POST del lote usa el endpoint /ordenes-examen", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({}));

        await servicio.crearOrdenes("p-9", ["5", "7"]);

        expect(fetchStub.callCount).to.equal(2);
        fetchStub.getCalls().forEach((llamada) => {
            expect(llamada.args[0]).to.match(/\/ordenes-examen$/);
            expect(cuerpoEnviado(llamada).idConsultaProcedimientoPaso).to.equal("p-9");
        });
    });
});
