import ConsultaService from "../../src/js/control/consulta_service.js";
import { consultaProcedimientoService } from "../../src/js/control/consulta_procedimiento_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("ConsultaService (unitaria)", () => {
    let fetchStub;
    const servicio = new ConsultaService();

    teardown(() => fetchStub?.restore());

    test("completa los DTO de consulta con asignaciones paginadas y comparte los nombres del catálogo", async () => {
        const consultas = [{ id: "cita-1" }, { id: "cita-2" }, { id: "sin-procedimiento" }];
        const asignaciones = [
            { id: "asignacion-ajena", idConsulta: "otra-cita", idProcedimiento: "otro" },
            { id: "asignacion-1", idConsulta: "cita-1", idProcedimiento: "triage" },
            { id: "asignacion-2", idConsulta: "cita-2", idProcedimiento: "triage" }
        ];
        const original = structuredClone(asignaciones);
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const { pathname, searchParams } = new URL(url);
            if (pathname.endsWith("/consultas")) {
                return { ok: true, json: async () => ({ items: consultas, total: 3 }) };
            }
            if (pathname.endsWith("/consultas-procedimientos")) {
                const first = Number(searchParams.get("first"));
                return { ok: true, json: async () => ({ items: asignaciones.slice(first, first + 1), total: 3 }) };
            }
            expect(pathname).to.equal("/galenoSV/api/v1/procedimientos/triage");
            return { ok: true, json: async () => ({ id: "triage", nombre: "Triage emergencias", activo: true }) };
        });

        const respuesta = await servicio.buscarCitas();
        expect(respuesta.items.slice(0, 2).map((consulta) => consulta.procedimientos[0].procedimiento.nombre))
            .to.deep.equal(["Triage emergencias", "Triage emergencias"]);
        expect(respuesta.items[0].procedimientos[0].idConsulta).to.equal("cita-1");
        expect(respuesta.items[1].procedimientos[0].idConsulta).to.equal("cita-2");
        expect(respuesta.items[2].procedimientos).to.deep.equal([]);
        expect(fetchStub.callCount).to.equal(5);
        expect(asignaciones).to.deep.equal(original);
    });

    test("propaga el error al cargar asignaciones para no informar una lista vacía falsa", async () => {
        fetchStub = sinon.stub(window, "fetch");
        fetchStub.onFirstCall().resolves({ ok: true, json: async () => ({ items: [{ id: "cita-1" }] }) });
        fetchStub.onSecondCall().resolves({ ok: false, status: 500 });
        let error;
        try { await servicio.buscarCitas(); } catch (err) { error = err; }
        expect(error).to.be.instanceOf(DefaultError);
        expect(error.status).to.equal(500);
    });

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

        const respuesta = await servicio.buscarCitas({}, 5, 5);

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

    test("completa paciente y clínica referenciados por el rol y reutiliza las lecturas", async () => {
        const consulta = { id: "cita-1", inicio: "2026-09-17T20:28:00", idPaciente: "asignacion-1", activo: true };
        const original = structuredClone(consulta);
        const respuestas = {
            "/consultas-procedimientos": { items: [], total: 0 },
            "/consultas": { items: [consulta, { ...consulta, id: "cita-2" }], total: 2 },
            "/personas-roles/asignacion-1": { id: "asignacion-1", idPersona: "persona-1", idClinica: "clinica-1" },
            "/personas/persona-1": { id: "persona-1", nombres: ["Ana"], apellidos: ["López"], numeroDocumento: "12312378-0" },
            "/clinicas/clinica-1": { id: "clinica-1", nombre: "Clínica Central de Santa Ana" }
        };
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const ruta = new URL(url).pathname.replace("/galenoSV/api/v1", "");
            expect(respuestas, ruta).to.have.property(ruta);
            return { ok: true, json: async () => respuestas[ruta] };
        });
        const respuesta = await servicio.buscarCitas();
        expect(respuesta.items[0].paciente).to.deep.equal(respuestas["/personas/persona-1"]);
        expect(respuesta.items[0].clinica.nombre).to.equal("Clínica Central de Santa Ana");
        expect(respuesta.items[0].estado).to.equal("Activa");
        expect(fetchStub.callCount).to.equal(5);
        expect(consulta).to.deep.equal(original);
    });

    test("recupera el documento del filtro solo tras verificar la identidad del paciente", async () => {
        const respuestas = {
            "/consultas-procedimientos": { items: [], total: 0 },
            "/consultas": { items: [
                { id: 1, idPersona: "persona-1" }, { id: 2, idPersona: "persona-2" }
            ] },
            "/personas": { items: [{ id: "persona-1", nombres: "Ana" }] },
            "/personas/persona-1": { id: "persona-1", nombres: "Ana" },
            "/personas/persona-2": { id: "persona-2", nombres: "Luis" }
        };
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const ruta = new URL(url).pathname.replace("/galenoSV/api/v1", "");
            expect(respuestas, ruta).to.have.property(ruta);
            return { ok: true, json: async () => respuestas[ruta] };
        });
        const respuesta = await servicio.buscarCitas({ tipoDocumento: "tipo-1", numeroDocumento: "12312378-0" });
        expect(respuesta.items[0].paciente.numeroDocumento).to.equal("12312378-0");
        expect(respuesta.items).to.have.length(1);
        expect(respuesta.total).to.equal(1);
        expect(fetchStub.callCount).to.equal(5);
    });

    test("filtra por documento, tipo y clínica antes de paginar aunque el backend ignore los filtros", async () => {
        const cita = (id, documento, clinica = 3, tipo = 1) => ({
            idConsulta: id, inicio: "2026-11-05T09:00:00",
            paciente: { nombres: "Paciente", numeroDocumento: documento, idTipoDocumento: tipo },
            clinica: { idClinica: clinica, nombre: "Clínica" }
        });
        const citas = [
            cita(1, "OTRO123"), cita(2, "PR24039", 9), cita(3, "PR24039", 3, 2),
            cita(4, "PR24039"), cita(5, "PR24039")
        ];
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const params = new URL(url).searchParams;
            const first = Number(params.get("first"));
            const max = Number(params.get("max"));
            return { ok: true, json: async () => ({ items: citas.slice(first, first + max), total: citas.length }) };
        });
        const respuesta = await servicio.buscarCitas({
            tipoDocumento: "1", numeroDocumento: "PR24039", idClinica: 3
        }, 1, 1);
        expect(respuesta.items.map((item) => item.idConsulta)).to.deep.equal([5]);
        expect(respuesta).to.include({ first: 1, max: 1, total: 2 });
        expect(fetchStub.callCount).to.equal(6);
    });

    test("excluye citas sin identidad verificable en la búsqueda pública", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [{ idConsulta: 1, paciente: { nombres: "Sin documento" } }], total: 1 })
        });
        const respuesta = await servicio.buscarCitas({ tipoDocumento: "1", numeroDocumento: "PR24039" });
        expect(respuesta.items).to.have.length(0);
        expect(respuesta.total).to.equal(0);
    });

    const citasFechas = [
        { idConsulta: 1, inicio: "2026-09-01T20:28:00" },
        { idConsulta: 2, inicio: "2026-09-17T00:00:00-06:00" },
        { idConsulta: 3, inicio: "2026-10-29T23:59:59-06:00" },
        { idConsulta: 4, inicio: "2026-10-30T20:26:00" }
    ];

    test("excluye las dos citas de las capturas aunque el backend ignore las fechas", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [citasFechas[0], citasFechas[3]], total: 2 })
        });
        const respuesta = await servicio.buscarCitas({ fechaDesde: "2026-09-17", fechaHasta: "2026-10-29" });
        expect(respuesta.items).to.deep.equal([]);
        expect(respuesta.total).to.equal(0);
    });

    for (const [filtros, ids] of [
        [{ fechaDesde: "2026-09-17", fechaHasta: "2026-10-29" }, [2, 3]],
        [{ fechaDesde: "2026-09-17" }, [2, 3, 4]],
        [{ fechaHasta: "2026-10-29" }, [1, 2, 3]],
        [{ fechaDesde: "2026-10-29", fechaHasta: "2026-10-29" }, [3]]
    ]) {
        test(`aplica límites inclusivos sin cambiar el día del timestamp: ${JSON.stringify(filtros)}`, async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true, json: async () => ({ items: citasFechas, total: citasFechas.length })
            });
            const respuesta = await servicio.buscarCitas(filtros);
            expect(respuesta.items.map((item) => item.idConsulta)).to.deep.equal(ids);
            expect(respuesta.total).to.equal(ids.length);
        });
    }

    test("busca coincidencias en páginas posteriores y pagina el total filtrado", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const params = new URL(url).searchParams;
            const first = Number(params.get("first"));
            const max = Number(params.get("max"));
            return { ok: true, json: async () => ({
                items: citasFechas.slice(first, first + max), total: 4, first, max
            }) };
        });
        const respuesta = await servicio.buscarCitas({ fechaDesde: "2026-09-17", fechaHasta: "2026-10-29" }, 1, 1);
        expect(respuesta.items.map((item) => item.idConsulta)).to.deep.equal([3]);
        expect(respuesta).to.include({ total: 2, first: 1, max: 1 });
        expect(fetchStub.callCount).to.equal(5);
    });

    test("termina la búsqueda si el backend repite una página ignorando first", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [citasFechas[1]], total: 40 })
        });
        const respuesta = await servicio.buscarCitas({ fechaDesde: "2026-09-17" });
        expect(respuesta.total).to.equal(1);
        expect(fetchStub.callCount).to.equal(3);
    });

    test("envía idClinica oficial con la clínica del Dashboard y conserva el rol", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [{ idConsulta: 101, pasos: [{ estado: "EN_CURSO", idRol: "rol-uuid", idProcedimientoPaso: "def-1", indicaFin: true }], idClinica: "clinica-uuid",
                clinica: { id: "clinica-uuid", nombre: "Central" } }], total: 1 })
        });
        const respuesta = await servicio.buscarCitas({ clinicaId: "clinica-uuid", idRol: "rol-uuid" });
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("idClinica")).to.equal("clinica-uuid");
        expect(url.searchParams.get("idClinica")).to.equal("clinica-uuid");
        expect(url.searchParams.get("idRol")).to.equal("rol-uuid");
        expect(respuesta.items[0].idConsulta).to.equal(101);
    });

    test("aísla clínicas antes de paginar aunque el servidor ignore el filtro y resuelve el rol del DTO", async () => {
        const consultas = [
            { id: "ajena", clinica: { id: "otra", nombre: "Otra" } },
            { id: "propia-1", idPersonaRol: "rol-paciente" },
            { id: "sin-clinica" },
            { id: "solo-nombre", clinica: "Central" },
            { id: "propia-2", clinica: { id: "activa", nombre: "Central" } }
        ];
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const { pathname, searchParams } = new URL(url);
            if (pathname.endsWith("/consultas")) {
                expect(searchParams.get("idClinica")).to.equal("activa");
                expect(searchParams.get("idClinica")).to.equal("activa");
                const first = Number(searchParams.get("first"));
                return { ok: true, json: async () => ({ items: consultas.slice(first, first + 1), total: 5 }) };
            }
            const respuestas = {
                "/galenoSV/api/v1/personas-roles/rol-paciente": { id: "rol-paciente", idClinica: "activa" },
                "/galenoSV/api/v1/clinicas/activa": { id: "activa", nombre: "Central" },
                "/galenoSV/api/v1/consultas-procedimientos": { items: [], total: 0 }
            };
            expect(respuestas).to.have.property(pathname);
            return { ok: true, json: async () => respuestas[pathname] };
        });

        const respuesta = await servicio.buscarCitas({ clinicaId: "activa", idClinica: "obsoleta" }, 1, 1);
        expect(respuesta.items.map((consulta) => consulta.idConsulta)).to.deep.equal(["propia-2"]);
        expect(respuesta).to.include({ total: 2, first: 1, max: 1 });
        expect(fetchStub.getCalls().filter((call) => new URL(call.args[0]).pathname.endsWith("/consultas")))
            .to.have.length(5);
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

    test("obtenerUrlTicket apunta al PDF público y codifica el ID y el origen del QR", () => {
        fetchStub = sinon.stub(window, 'fetch');
        const crearUrl = sinon.spy(URL, 'createObjectURL');
        const click = sinon.stub(HTMLAnchorElement.prototype, 'click');
        try {
            const url = new URL(servicio.obtenerUrlTicket('cita/101'));
            expect(url.pathname).to.equal('/galenoSV/api/v1/consultas/cita%2F101/ticket');
            expect(url.searchParams.get('frontendUrl')).to.equal(location.origin);
            expect(fetchStub.called).to.be.false;
            expect(crearUrl.called).to.be.false;
            expect(click.called).to.be.false;
        } finally { crearUrl.restore(); click.restore(); }
    });

    test("obtenerUrlTicket rechaza identificadores vacíos sin solicitudes de red", () => {
        fetchStub = sinon.stub(window, 'fetch');
        for (const id of [undefined, null, '', ' ']) {
            expect(() => servicio.obtenerUrlTicket(id)).to.throw('identificador válido');
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

    const idPaso = "a0b1c2d3-e4f5-4678-9abc-0123456789ab";
    const rutaPaso = `/galenoSV/api/v1/consultas-procedimientos-pasos/${idPaso}`;
    const respuestaGet = (etag) => ({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: etag }),
        text: async () => "{}"
    });
    const respuestaPatch = () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ idPaso })
    });
    const respuesta412 = () => ({
        ok: false,
        status: 412,
        clone: () => ({ json: async () => ({ message: "Conflicto de versión" }) })
    });

    test("construirPayloadPaso devuelve únicamente estadoPaso y valor", () => {
        const payload = servicio.construirPayloadPaso({
            notasConsulta: "Dolor abdominal",
            diagnosticos: ["R10"],
            planTratamiento: "Observación",
            estadoPaso: "COMPLETADO",
            paso: { indice: 1, estado: "COMPLETADO" },
            idPaso
        });

        expect(payload).to.have.all.keys(["estadoPaso", "valor"]);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(JSON.parse(payload.valor)).to.deep.equal({
            notas: "Dolor abdominal",
            diagnostico: ["R10"],
            plan: "Observación"
        });
    });

    test("guardarPaso lee el ETag con GET y envía PATCH con If-Match", async () => {
        fetchStub = sinon.stub(window, "fetch");
        fetchStub.onCall(0).resolves(respuestaGet('"v-1"'));
        fetchStub.onCall(1).resolves(respuestaPatch());

        const resultado = await servicio.guardarPaso(idPaso, {
            notas: "Control",
            diagnostico: ["J00"],
            plan: "Reposo",
            estadoPaso: "COMPLETADO"
        });

        expect(fetchStub.callCount).to.equal(2);
        expect(new URL(fetchStub.firstCall.args[0]).pathname).to.equal(rutaPaso);
        expect(fetchStub.firstCall.args[1].method).to.equal("GET");
        expect(new URL(fetchStub.secondCall.args[0]).pathname).to.equal(rutaPaso);
        expect(fetchStub.secondCall.args[1].method).to.equal("PATCH");
        expect(fetchStub.secondCall.args[1].headers.get("If-Match")).to.equal('"v-1"');
        expect(JSON.parse(fetchStub.secondCall.args[1].body)).to.deep.equal({
            estadoPaso: "COMPLETADO",
            valor: JSON.stringify({ notas: "Control", diagnostico: ["J00"], plan: "Reposo" })
        });
        expect(resultado).to.deep.equal({ idPaso });
    });

    test("guardarPaso vuelve a hacer GET y reintenta una vez tras un 412", async () => {
        fetchStub = sinon.stub(window, "fetch");
        fetchStub.onCall(0).resolves(respuestaGet('"v-1"'));
        fetchStub.onCall(1).resolves(respuesta412());
        fetchStub.onCall(2).resolves(respuestaGet('"v-2"'));
        fetchStub.onCall(3).resolves(respuestaPatch());

        await servicio.guardarPaso(idPaso, { notas: "Control", estadoPaso: "EN_CURSO" });

        expect(fetchStub.callCount).to.equal(4);
        expect(fetchStub.getCall(1).args[1].headers.get("If-Match")).to.equal('"v-1"');
        expect(fetchStub.getCall(2).args[1].method).to.equal("GET");
        expect(fetchStub.getCall(3).args[1].headers.get("If-Match")).to.equal('"v-2"');
    });

    test("guardarPaso no reintenta más de una vez", async () => {
        fetchStub = sinon.stub(window, "fetch");
        fetchStub.onCall(0).resolves(respuestaGet('"v-1"'));
        fetchStub.onCall(1).resolves(respuesta412());
        fetchStub.onCall(2).resolves(respuestaGet('"v-2"'));
        fetchStub.onCall(3).resolves(respuesta412());

        let error;
        try {
            await servicio.guardarPaso(idPaso, { estadoPaso: "PENDIENTE" });
        } catch (err) {
            error = err;
        }

        expect(error?.status).to.equal(412);
        expect(fetchStub.callCount).to.equal(4);
    });

    test("guardarPaso exige que el GET devuelva el ETag", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            headers: new Headers(),
            text: async () => "{}"
        });

        let error;
        try {
            await servicio.guardarPaso(idPaso, { estadoPaso: "COMPLETADO" });
        } catch (err) {
            error = err;
        }

        expect(error?.message).to.include("ETag");
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("consultaProcedimientoService.guardarPaso aplica el mismo bloqueo optimista", async () => {
        const solicitudes = [];
        const peticion = sinon.stub(consultaProcedimientoService, "_request")
            .callsFake(async (url, options) => {
                solicitudes.push({ url, options });
                return options.method === "GET"
                    ? { headers: new Headers({ ETag: '"paso-9"' }), text: async () => "{}" }
                    : { text: async () => JSON.stringify({ ok: true }) };
            });

        try {
            expect(await consultaProcedimientoService.guardarPaso(idPaso, {
                notas: "Nota",
                estadoPaso: "PENDIENTE"
            })).to.deep.equal({ ok: true });
            expect(solicitudes.map((s) => s.options.method)).to.deep.equal(["GET", "PATCH"]);
            expect(new URL(solicitudes[0].url).pathname).to.equal(rutaPaso);
            expect(new Headers(solicitudes[1].options.headers).get("If-Match")).to.equal('"paso-9"');
            expect(JSON.parse(solicitudes[1].options.body)).to.have.all.keys(["estadoPaso", "valor"]);
        } finally {
            peticion.restore();
        }
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
        expect(url).not.to.contain("tipoDocumento=");
        expect(url).not.to.contain("numeroDocumento=");
        expect(url).to.contain("desde=2024-01-01");
        expect(url).to.contain("hasta=2024-12-31");
    });
});
