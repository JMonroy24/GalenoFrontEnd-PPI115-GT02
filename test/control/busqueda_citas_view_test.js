import { BusquedaCitasView } from "../../src/js/boundary/vistas/busqueda_citas_view.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import store from "../../src/js/store.js";
import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("BusquedaCitasView (unitaria)", () => {
    let host;
    let fetchStub;
    let citasRespuesta;
    let mensajeSpy;

    const esperar = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

    const citaFicticia = {
        idConsulta: 101,
        fecha: "2026-11-12",
        hora: "09:30",
        estado: "PENDIENTE",
        clinica: { idClinica: 3, nombre: "Clínica Norte" },
        paciente: {
            idPersona: 7,
            numeroDocumento: "01234567-8",
            nombres: "Ana",
            apellidos: "López"
        },
        procedimientos: [{ nombre: "Control General" }],
        pasos: []
    };

    const responder = (payload) => ({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload)
    });

    const obtenerAsistente = () => host.shadowRoot.querySelector("asistente-busqueda");

    const seleccionarTipo = (valor = "1") => {
        const buscador = obtenerAsistente().shadowRoot.querySelector("buscador-tipo-documentos");
        const select = buscador.shadowRoot.querySelector("select");
        select.value = valor;
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    };

    const ingresarDocumento = (documento = "01234567-8") => {
        const input = obtenerAsistente().shadowRoot.querySelector("#numeroDocumento");
        input.value = documento;
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
        return input;
    };

    const prepararBusqueda = async () => {
        seleccionarTipo();
        ingresarDocumento();
        await esperar();
    };

    setup(async () => {
        citasRespuesta = [citaFicticia];
        store.setState({ online: true });
        mensajeSpy = sinon.spy(GeneradorMensajes, "crearMensaje");

        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const recurso = String(url);

            if (recurso.includes("/tipos-documento?")) {
                return responder({
                    items: [
                        {
                            idTipoDocumento: 1,
                            codigo: "DUI",
                            nombre: "DUI",
                            activo: true
                        }
                    ]
                });
            }

            if (recurso.includes("/personas?")) {
                return responder({
                    items: [
                        {
                            idPersona: 7,
                            numeroDocumento: "01234567-8",
                            nombres: "Ana",
                            apellidos: ["López"],
                            clinicas: [{ idClinica: 3, nombre: "Clínica Norte" }]
                        }
                    ]
                });
            }

            if (recurso.includes("/consultas?")) {
                return responder({
                    items: citasRespuesta,
                    total: citasRespuesta.length,
                    first: 0,
                    max: 10
                });
            }

            return responder({ items: [] });
        });

        host = document.createElement("busqueda-citas-view");
        document.body.appendChild(host);
        await esperar();
    });

    teardown(() => {
        host?.remove();
        fetchStub?.restore();
        mensajeSpy?.restore();
        store.setState({ online: true });
    });

    test("registra el componente y renderiza el asistente con estados de resultados ocultos", () => {
        expect(customElements.get("busqueda-citas-view")).to.equal(BusquedaCitasView);
        assert.instanceOf(host, BusquedaCitasView);
        assert.isNotNull(host.shadowRoot);
        assert.isNotNull(obtenerAsistente());

        expect(host.shadowRoot.querySelector("#estado").hidden).to.be.true;
        expect(host.shadowRoot.querySelector("#resultados").hidden).to.be.true;
    });

    test("muestra los datos de las relaciones de una cita con identificadores planos", async () => {
        citasRespuesta = [{ id: "cita-1", inicio: "2026-09-17T20:28:00", idPaciente: "paciente-1", activo: true }];
        const relaciones = {
            "/personas-roles/paciente-1": { id: "paciente-1", idPersona: "persona-1", idClinica: "clinica-1" },
            "/personas/persona-1": { id: "persona-1", nombres: "Ana", apellidos: "López", numeroDocumento: "12312378-0" },
            "/clinicas/clinica-1": { id: "clinica-1", nombre: "Clínica Central de Santa Ana" }
        };
        for (const [ruta, datos] of Object.entries(relaciones)) {
            fetchStub.withArgs(sinon.match((url) => new URL(url).pathname.endsWith(ruta))).resolves(responder(datos));
        }
        await host.buscar({ fechaDesde: "2026-09-17", fechaHasta: "2026-10-29" });
        const tarjeta = host.shadowRoot.querySelector("tarjeta-consulta").shadowRoot;
        expect(tarjeta.querySelector("#paciente").textContent).to.equal("Ana López");
        expect(tarjeta.querySelector("#documento-paciente").textContent).to.equal("12312378-0");
        expect(tarjeta.querySelector("#clinica").textContent).to.equal("Clínica Central de Santa Ana");
        expect(tarjeta.querySelector("#estado").textContent).to.equal("Activa");
    });

    test("el rango de las capturas oculta las citas de septiembre 1 y octubre 30", async () => {
        citasRespuesta = [
            { idConsulta: 1, inicio: "2026-09-01T20:28:00" },
            { idConsulta: 2, inicio: "2026-10-30T20:26:00" }
        ];
        await host.buscar({ fechaDesde: "2026-09-17", fechaHasta: "2026-10-29" });
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(0);
        expect(host.shadowRoot.querySelector("#estado").textContent).to.equal("No se encontraron citas.");
        expect(host.shadowRoot.querySelector("#paginacion").hidden).to.be.true;
    });

    test("renderiza las consultas de items con asociaciones anidadas del backend Java", async () => {
        citasRespuesta = [{
            idConsulta: 501,
            fechaConsulta: "2026-11-16T09:30:00",
            clinica: { idClinica: 3, nombre: "Clínica Norte" },
            paciente: { persona: { idPersona: 42, nombres: "Ana", apellidos: "López", numeroDocumento: "01234567-8" } },
            estado: { nombre: "Pendiente" },
            consultaProcedimientos: [{ idConsultaProcedimiento: 71,
                procedimiento: { idProcedimiento: 9, nombre: "Control General" } }]
        }];

        await host.buscar({ idClinica: 3 });

        const tarjeta = host.shadowRoot.querySelector("tarjeta-consulta");
        expect(tarjeta).to.exist;
        expect(tarjeta.shadowRoot.querySelector("#fecha").textContent).to.equal("16/11/2026");
        expect(tarjeta.shadowRoot.querySelector("#hora").textContent).to.equal("09:30");
        expect(tarjeta.shadowRoot.querySelector("#clinica").textContent).to.equal("Clínica Norte");
        expect(tarjeta.shadowRoot.querySelector("#paciente").textContent).to.equal("Ana López");
        expect(tarjeta.shadowRoot.querySelector("#documento-paciente").textContent).to.equal("01234567-8");
        expect(tarjeta.shadowRoot.querySelector("#lista-procedimientos li").textContent).to.equal("Control General");
        expect(tarjeta.shadowRoot.querySelector("#estado").textContent).to.equal("Pendiente");
        expect(host.shadowRoot.querySelector("#resultados").hidden).to.be.false;
    });

    test("mantiene número de documento y clínica deshabilitados hasta elegir un tipo", () => {
        const asistente = obtenerAsistente();
        const numeroDocumento = asistente.shadowRoot.querySelector("#numeroDocumento");
        const clinica = asistente.shadowRoot.querySelector("#clinica");

        expect(numeroDocumento.disabled).to.be.true;
        expect(clinica.disabled).to.be.true;
        const buscador = asistente.shadowRoot.querySelector("buscador-tipo-documentos");
        expect(buscador.value).to.equal("");

        seleccionarTipo();

        expect(numeroDocumento.disabled).to.be.false;
        expect(asistente.shadowRoot.activeElement).to.equal(numeroDocumento);
        expect(clinica.disabled).to.be.true;
    });

    test("habilita las clínicas del paciente luego de validar el documento", async () => {
        seleccionarTipo();
        ingresarDocumento();
        await esperar();

        const asistente = obtenerAsistente();
        const clinica = asistente.shadowRoot.querySelector("#clinica");
        const ayuda = asistente.shadowRoot.querySelector("#clinica-ayuda");
        const llamadaPersonas = fetchStub.getCalls().find((llamada) => (
            String(llamada.args[0]).includes("/personas?")
        ));

        assert.isDefined(llamadaPersonas);
        const url = new URL(llamadaPersonas.args[0]);
        expect(url.searchParams.get("valor")).to.equal("01234567-8");
        expect(url.searchParams.get("tipoDocumentoId")).to.equal("1");
        expect(url.searchParams.has("q")).to.be.false;
        expect(clinica.disabled).to.be.false;
        expect(clinica.querySelectorAll("option")).to.have.length(1);
        expect(clinica.value).to.equal("3");
        expect(ayuda.textContent).to.contain("1 clínica asociada");
    });

    test("dispara la búsqueda al enviar el asistente y renderiza las tarjetas", async () => {
        await prepararBusqueda();

        const asistente = obtenerAsistente();
        const form = asistente.shadowRoot.querySelector("form");
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await esperar();

        const estado = host.shadowRoot.querySelector("#estado");
        const resultados = host.shadowRoot.querySelector("#resultados");
        const tarjetas = resultados.querySelectorAll("tarjeta-consulta");
        const llamadaConsultas = fetchStub.getCalls().find((llamada) => (
            String(llamada.args[0]).includes("/consultas?")
        ));

        assert.isDefined(llamadaConsultas);
        expect(estado.hidden).to.be.true;
        expect(resultados.hidden).to.be.false;
        expect(tarjetas).to.have.length(1);
        expect(tarjetas[0].consulta).to.deep.equal(citaFicticia);

        const url = new URL(llamadaConsultas.args[0]);
        expect(url.searchParams.has("tipoDocumento")).to.be.false;
        expect(url.searchParams.has("numeroDocumento")).to.be.false;
        expect(url.searchParams.get("idClinica")).to.equal("3");
    });

    test("escucha el evento buscar-citas y consulta con los filtros recibidos", async () => {
        const detalle = {
            tipoDocumento: "1",
            numeroDocumento: "01234567-8",
            idClinica: 3,
            fechaDesde: "2026-11-01",
            fechaHasta: "2026-11-30"
        };
        let recibido = null;
        host.addEventListener("buscar-citas", (evento) => { recibido = evento.detail; });

        host.dispatchEvent(new CustomEvent("buscar-citas", {
            bubbles: true,
            composed: true,
            detail: detalle
        }));
        await esperar();

        const llamada = fetchStub.getCalls().find((item) => (
            String(item.args[0]).includes("/consultas?")
        ));
        assert.isDefined(llamada);

        const url = new URL(llamada.args[0]);
        expect(url.searchParams.has("tipoDocumento")).to.be.false;
        expect(url.searchParams.has("numeroDocumento")).to.be.false;
        expect(url.searchParams.get("idClinica")).to.equal("3");
        expect(url.searchParams.get("desde")).to.equal("2026-11-01");
        expect(url.searchParams.get("hasta")).to.equal("2026-11-30");
        expect(recibido).to.equal(detalle);
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(1);
    });

    test("muestra un estado vacío cuando la búsqueda no devuelve citas", async () => {
        citasRespuesta = [];
        await prepararBusqueda();

        const asistente = obtenerAsistente();
        const form = asistente.shadowRoot.querySelector("form");
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await esperar();

        const estado = host.shadowRoot.querySelector("#estado");
        const resultados = host.shadowRoot.querySelector("#resultados");

        expect(estado.hidden).to.be.false;
        expect(estado.textContent).to.equal("No se encontraron citas.");
        expect(resultados.hidden).to.be.true;
        expect(resultados.querySelectorAll("tarjeta-consulta")).to.have.length(0);
    });

    test("el botón de cada tarjeta descarga su consulta y bloquea clics repetidos", async () => {
        let resolver;
        const descargar = sinon.stub(consultaService, "descargarTicketPdf").returns(
            new Promise((resolve) => { resolver = resolve; })
        );
        try {
            await host.buscar({});
            const tarjeta = host.shadowRoot.querySelector("tarjeta-consulta");
            const boton = tarjeta.querySelector('button[slot="acciones"]');
            expect(tarjeta.shadowRoot.querySelector('slot[name="acciones"]').assignedElements()).to.include(boton);
            boton.click();
            boton.click();
            expect(descargar.calledOnceWithExactly(101)).to.be.true;
            expect(boton.disabled).to.be.true;
            resolver();
            await esperar();
            expect(boton.disabled).to.be.false;
            expect(boton.textContent).to.equal("Descargar Ticket PDF");
        } finally {
            descargar.restore();
        }
    });

    test("restaura el botón y muestra el error si falla la descarga", async () => {
        const descargar = sinon.stub(consultaService, "descargarTicketPdf").rejects(new Error("Ticket no disponible"));
        try {
            await host.buscar({});
            const boton = host.shadowRoot.querySelector("tarjeta-consulta button");
            boton.click();
            await esperar();
            expect(boton.disabled).to.be.false;
            expect(boton.hasAttribute("aria-busy")).to.be.false;
            expect(mensajeSpy.calledOnceWithExactly("Error al descargar el ticket", "Ticket no disponible", "error")).to.be.true;
        } finally {
            descargar.restore();
        }
    });

    test("muestra carga y descarta las tarjetas anteriores mientras espera la nueva búsqueda", async () => {
        await host.buscar({});
        let resolver;
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/consultas?")))
            .returns(new Promise((resolve) => { resolver = resolve; }));
        const pendiente = host.buscar({ numeroDocumento: "09876543-2" });

        expect(host.shadowRoot.querySelector("#estado").textContent).to.equal("Cargando citas...");
        expect(host.shadowRoot.querySelector("#estado").hidden).to.be.false;
        expect(host.shadowRoot.querySelector("#resultados").hidden).to.be.true;
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(0);

        resolver(responder({ items: [{ ...citaFicticia, idConsulta: 202 }] }));
        await pendiente;
        expect(host.shadowRoot.querySelector("tarjeta-consulta").consulta.idConsulta).to.equal(202);
        expect(host.shadowRoot.querySelector("#estado").hidden).to.be.true;
    });

    test("un error HTTP muestra el estado y la notificación sin conservar resultados anteriores", async () => {
        await host.buscar({});
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/consultas?")))
            .resolves({ ...responder({ message: "Consultas no disponibles" }), ok: false, status: 500 });

        await host.buscar({});

        expect(host.shadowRoot.querySelector("#estado").textContent).to.equal("No se pudieron cargar las citas.");
        expect(host.shadowRoot.querySelector("#estado").hidden).to.be.false;
        expect(host.shadowRoot.querySelector("#resultados").hidden).to.be.true;
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(0);
        expect(mensajeSpy.calledOnceWithExactly("Error al buscar citas", "HTTP 500: Consultas no disponibles", "error")).to.be.true;
    });

    for (const fallaAnterior of [false, true]) {
        test(`ignora la ${fallaAnterior ? "falla" : "respuesta"} tardía de una búsqueda anterior`, async () => {
            let resolverAnterior;
            let rechazarAnterior;
            const consultas = fetchStub.withArgs(sinon.match((url) => String(url).includes("/consultas?")));
            consultas.onFirstCall().returns(new Promise((resolve, reject) => {
                resolverAnterior = resolve;
                rechazarAnterior = reject;
            }));
            consultas.onSecondCall().resolves(responder({ items: [{ ...citaFicticia, idConsulta: 202 }] }));
            const anterior = host.buscar({ numeroDocumento: "01234567-8" });
            await host.buscar({ numeroDocumento: "09876543-2" });

            if (fallaAnterior) rechazarAnterior(new Error("Búsqueda anterior fallida"));
            else resolverAnterior(responder({ items: [citaFicticia] }));
            await anterior;

            const tarjetas = host.shadowRoot.querySelectorAll("tarjeta-consulta");
            expect(tarjetas).to.have.length(1);
            expect(tarjetas[0].consulta.idConsulta).to.equal(202);
            expect(host.shadowRoot.querySelector("#estado").hidden).to.be.true;
            expect(mensajeSpy.called).to.be.false;
        });
    }

    test("cada tarjeta descarga su idConsulta y deshabilita el ticket si falta el identificador", async () => {
        citasRespuesta = [
            { ...citaFicticia, idConsulta: 101, id: 999 },
            { ...citaFicticia, idConsulta: 202 },
            { ...citaFicticia, idConsulta: null }
        ];
        const descargar = sinon.stub(consultaService, "descargarTicketPdf").resolves();
        try {
            await host.buscar({});
            const botones = [...host.shadowRoot.querySelectorAll('tarjeta-consulta button[slot="acciones"]')];
            botones.forEach((boton) => boton.click());
            expect(botones[2].disabled).to.be.true;
            expect(descargar.getCalls().map((llamada) => llamada.args[0])).to.deep.equal([101, 202]);
            await Promise.resolve();
        } finally {
            descargar.restore();
        }
    });

    test("el botón completa el flujo HTTP del ticket como blob sin navegar fuera del runner", async () => {
        const pdf = new Blob(["%PDF-1.4\nTicket\n%%EOF"], { type: "application/pdf" });
        const leerBlob = sinon.stub().resolves(pdf);
        fetchStub.withArgs(sinon.match((url) => String(url).endsWith("/consultas/101/ticket")))
            .resolves({ ok: true, status: 200, blob: leerBlob });
        const crearUrl = sinon.stub(URL, "createObjectURL").returns("blob:ticket-unitario");
        const revocarUrl = sinon.stub(URL, "revokeObjectURL");
        const clickEnlace = sinon.stub(HTMLAnchorElement.prototype, "click");
        let reloj;
        try {
            await host.buscar({});
            reloj = sinon.useFakeTimers();
            const boton = host.shadowRoot.querySelector("tarjeta-consulta button");
            boton.click();
            await reloj.tickAsync(1000);

            const solicitud = fetchStub.getCalls().find((llamada) => String(llamada.args[0]).endsWith("/ticket"));
            expect(solicitud.args[1].method).to.equal("GET");
            expect(solicitud.args[1].headers.get("Accept")).to.equal("application/pdf");
            expect(leerBlob.calledOnce).to.be.true;
            expect(crearUrl.calledOnceWithExactly(pdf)).to.be.true;
            expect(clickEnlace.calledOnce).to.be.true;
            expect(clickEnlace.firstCall.thisValue.download).to.equal("ticket-cita-101.pdf");
            expect(revocarUrl.calledOnceWithExactly("blob:ticket-unitario")).to.be.true;
            expect(boton.disabled).to.be.false;
        } finally {
            reloj?.restore();
            crearUrl.restore();
            revocarUrl.restore();
            clickEnlace.restore();
        }
    });
});
