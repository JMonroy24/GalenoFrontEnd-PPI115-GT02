import { BusquedaCitasView } from "../../src/js/boundary/vistas/busqueda_citas_view.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("BusquedaCitasView (unitaria HU1)", () => {
    let host;
    let buscarCitasStub;
    let descargarTicketStub;

    const citasFicticias = [
        {
            idConsulta: 201,
            fecha: "2026-11-14",
            hora: "08:30",
            estado: "Pendiente",
            clinica: "Clínica Escalón",
            procedimientos: [{ nombre: "Consulta General" }]
        },
        {
            idConsulta: 202,
            fecha: "2026-11-14",
            hora: "09:30",
            estado: "Completada",
            clinica: "Clínica Escalón",
            procedimientos: [{ nombre: "Chequeo Preventivo" }]
        }
    ];

    setup(() => {
        buscarCitasStub = sinon.stub(consultaService, "buscarCitas").resolves({
            items: citasFicticias,
            total: 2
        });

        descargarTicketStub = sinon.stub(consultaService, "descargarTicketPdf").resolves(new Blob());

        host = document.createElement("busqueda-citas-view");
        document.body.appendChild(host);
    });

    teardown(() => {
        buscarCitasStub?.restore();
        descargarTicketStub?.restore();
        if (host?.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado como customElement con Shadow DOM open", () => {
        expect(customElements.get("busqueda-citas-view")).to.equal(BusquedaCitasView);
        assert.instanceOf(host, BusquedaCitasView);
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza el asistente de búsqueda y los contenedores de estado y resultados", () => {
        const shadow = host.shadowRoot;
        const asistente = shadow.querySelector("asistente-busqueda");
        const estado = shadow.querySelector("#estado");
        const resultados = shadow.querySelector("#resultados");

        assert.isNotNull(asistente, "Debe contener <asistente-busqueda>");
        assert.isNotNull(estado, "Debe contener #estado");
        assert.isNotNull(resultados, "Debe contener #resultados");
        expect(resultados.getAttribute("role")).to.equal("list");
    });

    test("responde al evento 'buscar-citas' llamando a consultaService.buscarCitas y renderiza tarjetas", async () => {
        const shadow = host.shadowRoot;
        const filtros = {
            tipoDocumento: "1",
            numeroDocumento: "01234567-8",
            clinicaId: "1"
        };

        host.dispatchEvent(new CustomEvent("buscar-citas", {
            bubbles: true,
            composed: true,
            detail: filtros
        }));

        await new Promise((r) => setTimeout(r, 60));

        expect(buscarCitasStub.calledOnce).to.be.true;
        expect(buscarCitasStub.firstCall.args[0]).to.deep.equal(filtros);

        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        expect(tarjetas.length).to.equal(2);
        expect(tarjetas[0].consulta.idConsulta).to.equal(201);
        expect(tarjetas[1].consulta.idConsulta).to.equal(202);
    });

    test("cada tarjeta inyecta botón 'Descargar Ticket PDF' en slot='acciones'", async () => {
        const shadow = host.shadowRoot;
        await host.buscar({});

        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        expect(tarjetas.length).to.equal(2);

        const boton = tarjetas[0].querySelector('button[slot="acciones"]');
        assert.isNotNull(boton, "Debe existir botón de ticket en slot='acciones'");
        expect(boton.textContent.trim()).to.equal("Descargar Ticket PDF");

        boton.click();
        expect(descargarTicketStub.calledOnce).to.be.true;
        expect(descargarTicketStub.firstCall.args[0]).to.equal(201);
    });

    test("muestra mensaje 'No se encontraron citas.' si el servicio devuelve lista vacía", async () => {
        buscarCitasStub.resolves({ items: [], total: 0 });
        const shadow = host.shadowRoot;

        await host.buscar({});

        const estado = shadow.querySelector("#estado");
        expect(estado.hidden).to.be.false;
        expect(estado.textContent).to.contain("No se encontraron citas");
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        expect(tarjetas.length).to.equal(0);
    });

    test("muestra mensaje de error si la búsqueda falla", async () => {
        buscarCitasStub.rejects(new Error("Error de conexión"));
        const shadow = host.shadowRoot;

        await host.buscar({});

        const estado = shadow.querySelector("#estado");
        expect(estado.hidden).to.be.false;
        expect(estado.textContent).to.contain("No se pudieron cargar las citas");
    });
});
