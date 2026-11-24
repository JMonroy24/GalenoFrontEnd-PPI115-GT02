import { ClinicaService } from "../../src/js/control/clinica_service.js";
import { ConsultaProcedimientoService, construirPayloadPaso, serializarValorPaso } from "../../src/js/control/consulta_procedimiento_service.js";
import { ExamenResultadoService } from "../../src/js/control/examen_resultado_service.js";
import GestorFechas from "../../src/js/control/gestor_fechas.js";
import { OrdenExamenService } from "../../src/js/control/orden_examen_service.js";
import { PersonaRolService } from "../../src/js/control/persona_rol_service.js";
import { ProcedimientoService } from "../../src/js/control/procedimiento_service.js";
import { RolService } from "../../src/js/control/rol_service.js";
import { TipoDocumentoService } from "../../src/js/control/tipo_documento_service.js";
import { TipoExamenService } from "../../src/js/control/tipo_examen_service.js";
import { TipoMedioContactoService } from "../../src/js/control/tipo_medio_contacto_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Servicios adicionales (unitaria)", () => {
    let fetchStub;

    const ok = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
        status,
        headers: { "Content-Type": "application/json" }
    });

    teardown(() => fetchStub?.restore());

    test("los servicios delgados apuntan a sus endpoints del backend", () => {
        expect(new ClinicaService()._urlBase).to.match(/\/clinicas$/);
        expect(new RolService()._urlBase).to.match(/\/roles$/);
        expect(new TipoDocumentoService()._urlBase).to.match(/\/tipos-documento$/);
        expect(new TipoExamenService()._urlBase).to.match(/\/tipos-examen$/);
        expect(new TipoMedioContactoService()._urlBase).to.match(/\/tipos-medio-contacto$/);
        expect(new PersonaRolService()._urlBase).to.match(/\/personas-roles$/);
    });

    test("PersonaRolService busca roles y pacientes por q con paginación", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => ok({ items: [], total: 0 }));
        const servicio = new PersonaRolService();

        await servicio.buscarRolesPorPersona("Ana", 5, 15);
        await servicio.buscarPacientes("Juan", 0, 7);

        const urls = fetchStub.getCalls().map((llamada) => new URL(llamada.args[0]));
        expect(urls[0].searchParams.get("q")).to.equal("Ana");
        expect(urls[0].searchParams.get("first")).to.equal("5");
        expect(urls[0].searchParams.get("max")).to.equal("15");
        expect(urls[1].searchParams.get("q")).to.equal("Juan");
        expect(urls[1].searchParams.get("max")).to.equal("7");
    });

    test("ProcedimientoService obtiene el árbol de pasos y sus alias delegan", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => ok({ items:
            new URL(url).pathname.endsWith('/procedimientos-pasos-secuencias') ? [] :
                [{ id: 'paso-1', idProcedimiento: 'p-1', nombre: 'Paso único', indicaFin: true }], total: 1 }));
        const servicio = new ProcedimientoService();

        const pasos = await servicio.obtenerArbolPasos("p-1");
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.pathname).to.equal("/galenoSV/api/v1/procedimientos-pasos");
        expect(pasos).to.deep.equal([{ id: 'paso-1', idProcedimiento: 'p-1', nombre: 'Paso único', indicaFin: true, orden: 0 }]);

        const delegado = sinon.stub(servicio, "obtenerArbolPasos").resolves("arbol");
        expect(await servicio.obtenerArbolPasosAtencion("p-2")).to.equal("arbol");
        expect(await servicio.obtenerArbol("p-2")).to.equal("arbol");
        expect(await servicio.obtenerArbolProcedimientos("p-2")).to.equal("arbol");
        expect(delegado.callCount).to.equal(3);
    });

    test("ExamenResultadoService crea, actualiza, consulta y filtra por orden", async () => {
        const servicio = new ExamenResultadoService();
        const crear = sinon.stub(servicio, "create").resolves({ id: 1 });
        const actualizar = sinon.stub(servicio, "update").resolves({ id: 2 });
        const listar = sinon.stub(servicio, "findRange").resolves({ items: [] });

        await servicio.guardarResultado({ valor: "x" });
        await servicio.registrarResultado({ valor: "y" }, 2);
        await servicio.consultarResultados("glucosa", 1, 4);
        await servicio.buscarPorOrden("o-9", 0, 5);
        await servicio.consultarResultadosPorOrden("o-10", 2, 6);

        expect(crear.calledOnceWith({ valor: "x" })).to.be.true;
        expect(actualizar.calledOnceWith(2, { valor: "y" })).to.be.true;
        expect(listar.firstCall.args).to.deep.equal([1, 4, "glucosa"]);
        expect(listar.secondCall.args).to.deep.equal([0, 5, "o-9"]);
        expect(listar.thirdCall.args).to.deep.equal([2, 6, "o-10"]);
    });

    test("GestorFechas formatea ISO de El Salvador y rechaza fechas inválidas", () => {
        expect(GestorFechas.formatearFechaISO(null)).to.equal("");
        expect(GestorFechas.formatearFechaISO("")).to.equal("");
        expect(GestorFechas.formatearFechaISO("no-es-fecha")).to.equal("");
        expect(GestorFechas.formatearFechaISO("2026-11-12T14:05:00-06:00"))
            .to.equal("12/11/2026 02:05 PM");
    });

    test("serializarValorPaso acepta alias de notas, diagnóstico y plan", () => {
        const valor = serializarValorPaso({
            notasConsulta: "Notas",
            diagnosticos: "A00",
            planTratamiento: "Plan"
        });
        expect(JSON.parse(valor)).to.deep.equal({
            notas: "Notas",
            diagnostico: ["A00"],
            plan: "Plan"
        });
        expect(JSON.parse(serializarValorPaso()).diagnostico).to.deep.equal([]);
    });

    test("construirPayloadPaso valida el estado y conserva un valor serializado", () => {
        expect(construirPayloadPaso({ estado: "EN_CURSO", valor: '{"ok":true}' })).to.deep.equal({
            estadoPaso: "EN_CURSO",
            valor: '{"ok":true}'
        });
        expect(() => construirPayloadPaso({ estadoPaso: "INVALIDO" }))
            .to.throw("Estado de paso no válido: INVALIDO");
    });

    test("ConsultaProcedimientoService valida idPaso y expone alias de guardarPaso", async () => {
        const servicio = new ConsultaProcedimientoService();

        let error = null;
        try {
            await servicio.actualizarPaso("", { estadoPaso: "PENDIENTE" });
        } catch (e) {
            error = e;
        }
        expect(error?.message).to.contain("identificador válido");

        const delegado = sinon.stub(servicio, "actualizarPaso").resolves({ ok: true });
        await servicio.guardarPaso("p-1", { estadoPaso: "PENDIENTE" });
        await servicio.guardarConsultaProcedimientoPaso("p-2", { estadoPaso: "PENDIENTE" });
        await servicio.registrarPaso("p-3", { estadoPaso: "PENDIENTE" });
        expect(delegado.callCount).to.equal(3);
    });

    test("OrdenExamenService expone alias de asignación y consulta por consulta", async () => {
        const servicio = new OrdenExamenService();
        const crear = sinon.stub(servicio, "create").resolves({ idOrdenExamen: 1 });
        const crearOrdenes = sinon.stub(servicio, "crearOrdenes").resolves([{ idOrdenExamen: 2 }]);
        const listar = sinon.stub(servicio, "findRange").resolves({ items: [] });

        await servicio.asignarAPaso("p-1", { idExamen: 4, indicaciones: "Ayuno" });
        await servicio.asignarAConsulta("p-2", { idExamen: 5 });
        await servicio.asignarOrdenExamen("p-3", { idExamen: 6 });
        await servicio.asignarOrden("p-4", { idExamen: 7 });
        expect(crear.callCount).to.equal(4);
        expect(crear.firstCall.args[0]).to.deep.equal({
            idExamen: 4,
            idConsultaProcedimientoPaso: "p-1",
            indicaciones: "Ayuno"
        });

        await servicio.asignarOrdenes("p-5", ["1"]);
        await servicio.asignarOrdenesAConsulta("p-6", ["2"]);
        await servicio.asignarOrdenesExamen("p-7", ["3"]);
        expect(crearOrdenes.callCount).to.equal(3);

        await servicio.consultarPorConsulta("c-1", 0, 3);
        await servicio.consultarOrdenesPorConsulta("c-2", 1, 4);
        expect(listar.firstCall.args).to.deep.equal([0, 3, "c-1"]);
        expect(listar.secondCall.args).to.deep.equal([1, 4, "c-2"]);
        assert.instanceOf(servicio, OrdenExamenService);
    });
});
