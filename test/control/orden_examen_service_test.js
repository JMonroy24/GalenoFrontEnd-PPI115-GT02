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

    teardown(() => fetchStub.restore());

    test("usa el endpoint /ordenes-examen del backend", () => {
        fetchStub = sinon.stub(window, "fetch");
        expect(servicio._urlBase).to.match(/\/ordenes-examen$/);
    });

    test("crearOrdenes envía un POST por cada id de tipo de examen con idConsulta", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({ idOrdenExamen: 1 }));

        const creadas = await servicio.crearOrdenes("c-9", ["1", "3"]);

        expect(fetchStub.callCount).to.equal(2);
        expect(fetchStub.firstCall.args[1].method).to.equal("POST");
        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({ idTipoExamen: "1", idConsulta: "c-9" });
        expect(cuerpoEnviado(fetchStub.secondCall)).to.deep.equal({ idTipoExamen: "3", idConsulta: "c-9" });
        expect(creadas).to.have.length(2);
    });

    test("crearOrdenes acepta objetos de orden y les agrega idConsulta", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({ idOrdenExamen: 1 }));

        await servicio.crearOrdenes("c-9", [{ idTipoExamen: "7", observaciones: "ayuno" }]);

        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({
            idTipoExamen: "7",
            observaciones: "ayuno",
            idConsulta: "c-9"
        });
    });

    test("crearOrdenes con lista vacía no hace peticiones y devuelve []", async () => {
        fetchStub = sinon.stub(window, "fetch");

        const creadas = await servicio.crearOrdenes("c-9", []);

        expect(fetchStub.called).to.be.false;
        expect(creadas).to.deep.equal([]);
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
            await servicio.crearOrdenes("c-9", ["1", "2", "3"]);
        } catch (e) {
            error = e;
        }

        expect(fetchStub.callCount).to.equal(3);
        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(422);
        expect(error.mensaje).to.equal("Orden inválida");
    });

    test("un error de red se propaga sin ser tragado", async () => {
        fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("Failed to fetch"));

        let error = null;
        try {
            await servicio.crearOrdenes("c-9", ["1"]);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, TypeError);
    });

    test("asignarOrdenes delega en crearOrdenes", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({}));

        await servicio.asignarOrdenes("c-1", ["5"]);

        expect(cuerpoEnviado(fetchStub.firstCall)).to.deep.equal({ idTipoExamen: "5", idConsulta: "c-1" });
    });
});
