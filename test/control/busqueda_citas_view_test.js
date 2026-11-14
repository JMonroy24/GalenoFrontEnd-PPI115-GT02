import { BusquedaCitasView } from "../../src/js/boundary/vistas/busqueda_citas_view.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("BusquedaCitasView (unitaria)", () => {
    let host;
    let fetchStub;
    let citasRespuesta;

    const esperar = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

    const citaFicticia = {
        idConsulta: 101,
        fecha: "2026-11-12",
        hora: "09:30",
        estado: "PENDIENTE",
        clinica: "Clínica Norte",
        paciente: {
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
        fetchStub?.restore();
        host?.remove();
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

    test("mantiene número de documento y clínica deshabilitados hasta elegir un tipo", () => {
        const asistente = obtenerAsistente();
        const numeroDocumento = asistente.shadowRoot.querySelector("#numeroDocumento");
        const clinica = asistente.shadowRoot.querySelector("#clinica");

        expect(numeroDocumento.disabled).to.be.true;
        expect(clinica.disabled).to.be.true;

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
        expect(url.searchParams.get("tipoDocumento")).to.equal("1");
        expect(url.searchParams.get("numeroDocumento")).to.equal("01234567-8");
        expect(url.searchParams.get("idClinica")).to.equal("3");
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
});
