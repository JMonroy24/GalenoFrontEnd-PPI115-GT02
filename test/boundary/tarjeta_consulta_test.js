import { TarjetaConsulta } from "../../src/js/boundary/componentes/tarjeta_consulta.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("TarjetaConsulta (unitaria)", () => {
    let host;

    const pasosFicticios = [
        {
            nombre: "Triage inicial",
            profesionalResponsable: "Enf. López",
            fechaHoraEjecucion: "2026-11-12T08:30:00",
            pasos: [
                {
                    nombre: "Signos vitales",
                    profesionalResponsable: "Enf. López",
                    fechaHoraEjecucion: "2026-11-12T08:35:00"
                }
            ]
        }
    ];

    const crearConsulta = (extra = {}) => ({
        idConsulta: 101,
        fecha: "2026-11-12",
        hora: "09:00",
        estado: "Pendiente",
        clinica: "Clínica Central",
        procedimientos: [{ nombre: "Consulta General" }],
        ...extra
    });

    setup(() => {
        host = document.createElement("tarjeta-consulta");
        document.body.appendChild(host);
    });

    teardown(() => {
        host?.remove();
    });

    test("está registrada y renderiza el historial dentro de la tarjeta", () => {
        expect(customElements.get("tarjeta-consulta")).to.equal(TarjetaConsulta);
        assert.isNotNull(host.shadowRoot);
        expect(host.shadowRoot.querySelector("historial-pasos")).to.exist;
    });

    test("pasa los pasos de la consulta a <historial-pasos>", () => {
        host.consulta = crearConsulta({ pasos: pasosFicticios });

        const historial = host.shadowRoot.querySelector("historial-pasos");
        const desplegable = host.shadowRoot.querySelector("#historial-desplegable");
        const contador = host.shadowRoot.querySelector("#historial-contador");

        expect(historial.pasos).to.deep.equal(pasosFicticios);
        expect(desplegable.hidden).to.be.false;
        expect(contador.textContent).to.equal("(1)");
    });

    test("el historial embebido conserva profesional, fecha/hora, botón y modal", () => {
        host.consulta = crearConsulta({ pasos: pasosFicticios });

        const historial = host.shadowRoot.querySelector("historial-pasos");
        const boton = historial.shadowRoot.querySelector(".paso .boton");
        const dialogo = historial.shadowRoot.querySelector("dialog#dialogo-registro");

        expect(boton.textContent.trim()).to.equal("Ver Registro");
        expect(dialogo).to.exist;
        expect(historial.shadowRoot.textContent).to.contain("Enf. López");
        expect(historial.shadowRoot.textContent).to.contain("2026-11-12 08:30");
    });

    test("muestra un indicador neutro cuando la consulta no tiene pasos", () => {
        host.consulta = crearConsulta();

        const historial = host.shadowRoot.querySelector("historial-pasos");
        const desplegable = host.shadowRoot.querySelector("#historial-desplegable");
        const vacio = host.shadowRoot.querySelector("#historial-vacio");

        expect(historial.pasos).to.be.empty;
        expect(desplegable.hidden).to.be.true;
        expect(vacio.hidden).to.be.false;
        expect(vacio.textContent.trim()).to.equal("Sin pasos ejecutados.");
    });
});
