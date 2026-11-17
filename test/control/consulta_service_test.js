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

    test("buscarCitas mapea items con asociaciones Java y conserva los metadatos", async () => {
        const clinica = { idClinica: 3, nombre: "Clínica Norte" };
        const persona = { idPersona: 42, nombres: "Ana", numeroDocumento: "01234567-8" };
        const procedimientos = [{ idConsultaProcedimiento: 71,
            procedimiento: { idProcedimiento: 9, nombre: "Control General" } }];
        const consulta = {
            id: 101, fechaConsulta: "2026-11-16T09:30:00", clinica, persona,
            consultaProcedimientoList: procedimientos,
            pasosClinicos: [{ nombre: "Evaluación", estado: "COMPLETADO" }]
        };
        const original = structuredClone(consulta);
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, status: 200,
            json: async () => ({ items: [consulta], total: 12, first: 5, max: 5 })
        });

        const respuesta = await servicio.buscarCitas({ idClinica: 3 }, 5, 5);

        expect(respuesta).to.be.instanceOf(DefaultResponse);
        expect(respuesta.items).to.have.length(1);
        expect(respuesta.items[0]).to.include({ idConsulta: 101, fecha: "2026-11-16T09:30:00" });
        expect(respuesta.items[0].clinica).to.equal(clinica);
        expect(respuesta.items[0].paciente).to.equal(persona);
        expect(respuesta.items[0].procedimientos).to.deep.equal(procedimientos);
        expect(respuesta.items[0].pasosClinicos).to.deep.equal(consulta.pasosClinicos);
        expect(respuesta.total).to.equal(12);
        expect(respuesta.first).to.equal(5);
        expect(respuesta.max).to.equal(5);
        expect(consulta).to.deep.equal(original);
    });

    test("buscarCitas conserva los campos canónicos fecha, clínica y procedimientos", async () => {
        const consulta = {
            idConsulta: 101, fecha: "2026-11-16", hora: "10:00", estado: "PENDIENTE",
            paciente: { nombres: "Ana" }, clinica: { idClinica: 3, nombre: "Central" },
            procedimientos: [{ procedimiento: { nombre: "Consulta" } }]
        };
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [consulta], total: 1 })
        });

        const respuesta = await servicio.buscarCitas();

        expect(respuesta.items).to.deep.equal([consulta]);
    });

    test("envía el clinicaId del dashboard y su rol al backend al buscar citas", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [{ idConsulta: 101 }], total: 1 })
        });
        const respuesta = await servicio.buscarCitas({ clinicaId: "clinica-uuid", idRol: "rol-uuid" });
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("clinicaId")).to.equal("clinica-uuid");
        expect(url.searchParams.get("idRol")).to.equal("rol-uuid");
        expect(respuesta.items[0].idConsulta).to.equal(101);
    });

    test("buscarCitas usa exclusivamente items sin confundir el envoltorio con una consulta", async () => {
        const consulta = { idConsulta: 101 };
        const payloads = [[consulta], { datos: [consulta] }, { items: [], datos: [consulta] }, { items: null }, null];
        fetchStub = sinon.stub(window, "fetch");
        payloads.forEach((payload, indice) => fetchStub.onCall(indice)
            .resolves({ ok: true, json: async () => payload }));

        for (const payload of payloads) {
            expect((await servicio.buscarCitas()).items, JSON.stringify(payload)).to.deep.equal([]);
        }
    });

    test("buscarCitas tolera asociaciones nulas y descarta entradas que no son consultas", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [null, [], 101, {
                idConsulta: 101, paciente: null, clinica: null, procedimientos: null
            }] })
        });

        const respuesta = await servicio.buscarCitas();

        expect(respuesta.items).to.have.length(1);
        expect(respuesta.items[0].idConsulta).to.equal(101);
        expect(respuesta.items[0].procedimientos).to.deep.equal([]);
    });

    test("descargarTicketPdf solicita PDF, descarga el blob y libera su URL después", async () => {
        const blob = new Blob(["%PDF-1.4\nTicket de cita"], { type: "application/pdf" });
        const leerBlob = sinon.stub().resolves(blob);
        fetchStub = sinon.stub(window, "fetch").resolves({ ok: true, blob: leerBlob });
        const crearUrl = sinon.stub(URL, "createObjectURL").returns("blob:ticket-prueba");
        const revocarUrl = sinon.stub(URL, "revokeObjectURL");
        let enlace;
        const click = sinon.stub(HTMLAnchorElement.prototype, "click").callsFake(function () {
            enlace = this;
            expect(this.isConnected).to.be.true;
        });
        const reloj = sinon.useFakeTimers();

        try {
            expect(await servicio.descargarTicketPdf("cita/101")).to.equal(blob);
            expect(fetchStub.firstCall.args[0]).to.contain("/consultas/cita%2F101/ticket");
            expect(fetchStub.firstCall.args[1].headers.get("Accept")).to.equal("application/pdf");
            expect(leerBlob.calledOnce).to.be.true;
            expect(crearUrl.calledOnceWithExactly(blob)).to.be.true;
            expect(enlace.download).to.equal("ticket-cita-cita/101.pdf");
            expect(enlace.isConnected).to.be.false;
            expect(revocarUrl.called).to.be.false;
            reloj.tick(1000);
            expect(revocarUrl.calledOnceWithExactly("blob:ticket-prueba")).to.be.true;
        } finally {
            reloj.restore();
            click.restore();
            crearUrl.restore();
            revocarUrl.restore();
        }
    });

    test("descargarTicketPdf rechaza errores HTTP sin iniciar una descarga", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({ ok: false, status: 500 });
        const crearUrl = sinon.spy(URL, "createObjectURL");
        try {
            let error;
            try { await servicio.descargarTicketPdf(101); } catch (err) { error = err; }
            expect(error).to.be.instanceOf(DefaultError);
            expect(crearUrl.called).to.be.false;
        } finally {
            crearUrl.restore();
        }
    });

    test("descargarTicketPdf rechaza consultas sin identificador antes de llamar a fetch", async () => {
        fetchStub = sinon.stub(window, "fetch");
        for (const id of [undefined, null, "", " "]) {
            let error;
            try { await servicio.descargarTicketPdf(id); } catch (err) { error = err; }
            expect(error).to.be.instanceOf(Error);
        }
        expect(fetchStub.called).to.be.false;
    });

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

    test("construirPayloadPaso serializa los campos clínicos en consulta_procedimiento_paso.valor", () => {
        const payload = servicio.construirPayloadPaso({
            notasConsulta: "Dolor abdominal",
            diagnosticos: ["R10"],
            planTratamiento: "Observación",
            paso: { indice: 1, estado: "COMPLETADO" }
        });

        expect(JSON.parse(payload.consulta_procedimiento_paso.valor)).to.deep.equal({
            notas: "Dolor abdominal",
            diagnostico: ["R10"],
            plan: "Observación"
        });
        expect(payload.paso.indice).to.equal(1);
    });

    test("guardarPaso envía el valor serializado al endpoint de atención", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ ok: true })
        });

        await servicio.guardarPaso(55, {
            notas: "Control",
            diagnostico: ["J00"],
            plan: "Reposo",
            estadoPaso: "COMPLETADO"
        });

        const cuerpo = JSON.parse(fetchStub.firstCall.args[1].body);

        expect(fetchStub.firstCall.args[1].method).to.equal("PATCH");
        expect(cuerpo.valor).to.be.a("string");
        expect(cuerpo.valor).to.equal(cuerpo.consulta_procedimiento_paso.valor);
        expect(fetchStub.firstCall.args[0].toString()).to.contain(
            "consultas/55/atencion"
        );
        expect(JSON.parse(cuerpo.consulta_procedimiento_paso.valor)).to.deep.equal({
            notas: "Control",
            diagnostico: ["J00"],
            plan: "Reposo"
        });
        expect(cuerpo.estadoPaso).to.equal("COMPLETADO");
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
        expect(error.message).to.equal("HTTP 401: Token expirado");
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
        expect(error.mensaje).to.equal("HTTP 422: Datos de consulta inválidos");
    });

    test("buscarPorPacienteYFechas envía pacienteId e idClinica en los query params", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0, first: 0, max: 10 })
        });

        await servicio.buscarPorPacienteYFechas({
            pacienteId: "a0b1c2d3-e4f5-4678-9abc-0123456789ab",
            tipoDocumento: "DUI",
            numeroDocumento: "01234567-8",
            idClinica: "uuid-clinica-123",
            fechaDesde: "2024-01-01",
            fechaHasta: "2024-12-31"
        });

        const url = fetchStub.firstCall.args[0].toString();
        expect(new URL(url).searchParams.get("pacienteId")).to.equal("a0b1c2d3-e4f5-4678-9abc-0123456789ab");
        expect(new URL(url).searchParams.has("q")).to.be.false;
        expect(url).to.contain("idClinica=uuid-clinica-123");
        expect(url).to.contain("tipoDocumento=DUI");
        expect(url).to.contain("numeroDocumento=01234567-8");
        expect(url).to.contain("fechaDesde=2024-01-01");
        expect(url).to.contain("fechaHasta=2024-12-31");
    });
});
