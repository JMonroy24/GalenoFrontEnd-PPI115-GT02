import { TarjetaConsulta } from "../../src/js/boundary/componentes/tarjeta_consulta.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("TarjetaConsulta (unitaria HU3)", () => {
    let host;

    const consultaEjemplo = {
        idConsulta: 501,
        fecha: "2026-11-14",
        hora: "11:00",
        estado: "En Proceso",
        clinica: { idClinica: 3, nombre: "Clínica San Salvador" },
        procedimientos: [
            { nombre: "Evaluación Médica" },
            { nombre: "Electrocardiograma" }
        ],
        pasos: [
            {
                nombre: "Signos Vitales",
                profesionalResponsable: "Enf. Ramos",
                fechaHoraEjecucion: "2026-11-14T10:45:00",
                valor: "Presión arterial normal"
            }
        ]
    };

    setup(() => {
        host = document.createElement("tarjeta-consulta");
        document.body.appendChild(host);
    });

    teardown(() => {
        if (host?.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado en customElements con Shadow DOM open", () => {
        expect(customElements.get("tarjeta-consulta")).to.equal(TarjetaConsulta);
        assert.instanceOf(host, TarjetaConsulta);
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza los datos de la consulta correctamente al asignar la propiedad", () => {
        host.consulta = consultaEjemplo;
        const shadow = host.shadowRoot;

        expect(shadow.querySelector("#fecha").textContent).to.equal("2026-11-14");
        expect(shadow.querySelector("#hora").textContent).to.equal("11:00");
        expect(shadow.querySelector("#clinica").textContent).to.equal("Clínica San Salvador");
        expect(shadow.querySelector("#estado-texto").textContent).to.equal("En Proceso");

        const itemsProc = shadow.querySelectorAll("#lista-procedimientos li");
        expect(itemsProc).to.have.length(2);
        expect(itemsProc[0].textContent).to.equal("Evaluación Médica");
        expect(itemsProc[1].textContent).to.equal("Electrocardiograma");
    });

    test("embebe internamente el Web Component <historial-pasos> sincronizado con los pasos de la consulta", () => {
        host.consulta = consultaEjemplo;
        const shadow = host.shadowRoot;

        const historial = shadow.querySelector("historial-pasos");
        assert.isNotNull(historial, "Debe embeber <historial-pasos> dentro de la tarjeta");
        expect(historial.pasos).to.have.length(1);
        expect(historial.pasos[0].nombre).to.equal("Signos Vitales");
    });

    test("proyecta elementos hijos a través del slot 'acciones'", () => {
        host.consulta = consultaEjemplo;

        const botonAccion = document.createElement("button");
        botonAccion.slot = "acciones";
        botonAccion.textContent = "Acción Personalizada";
        host.appendChild(botonAccion);

        const slot = host.shadowRoot.querySelector('slot[name="acciones"]');
        assert.isNotNull(slot, "Debe existir slot con name='acciones'");
        const asignados = slot.assignedElements();
        expect(asignados).to.include(botonAccion);
        expect(asignados[0].textContent).to.equal("Acción Personalizada");
    });
});
