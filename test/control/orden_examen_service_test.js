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

    test("listarExamenesPorPaso usa asignables y rechaza exámenes de otro paso o inactivos", async () => {
        fetchStub = sinon.stub(window, 'fetch').callsFake(async () => ok({ items: [
            { idExamen: 1, idProcedimientoPaso: 'p-9', nombre: 'Hemograma', activo: true, nombreTipoExamen: 'Laboratorio', indicaciones: 'Ayuno' },
            { idExamen: 2, idProcedimientoPaso: 'p-9', nombre: 'Glucosa', activo: true },
            { idExamen: 3, idProcedimientoPaso: 'otro-paso', nombre: 'Otro', activo: true },
            { idExamen: 4, idProcedimientoPaso: 'p-9', nombre: 'Retirado', activo: false }
        ], total: 4 }));
        const examenes = await servicio.listarExamenesPorPaso('p-9');
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.pathname).to.equal('/galenoSV/api/v1/procedimientos-pasos-examenes/asignables');
        expect(url.searchParams.get('idProcedimientoPaso')).to.equal('p-9');
        expect(fetchStub.calledOnce).to.be.true;
        expect(examenes).to.deep.equal([
            { idExamen: 1, id: '1', nombre: 'Hemograma', categoria: 'Laboratorio', indicaciones: 'Ayuno' },
            { idExamen: 2, id: '2', nombre: 'Glucosa', categoria: 'General', indicaciones: '' }
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
