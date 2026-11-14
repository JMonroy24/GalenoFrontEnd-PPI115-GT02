import { HistorialPasos } from "../../src/js/boundary/componentes/historial_pasos.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("HistorialPasos (unitaria)", () => {
    let host;

    const pasosFicticios = [
        {
            nombre: "Triaje",
            profesionalResponsable: "Enf. Gómez",
            fechaHoraEjecucion: "2026-11-14T08:00:00",
            valor: "Temperatura: 36.5°C, Presión: 120/80"
        },
        {
            nombre: "Consulta Médica",
            profesionalResponsable: "Dr. Sánchez",
            fechaHoraEjecucion: "2026-11-14T08:30:00",
            valor: "Notas: Paciente estable. Plan: Reposo",
            subpasos: [
                {
                    nombre: "Toma de Muestra",
                    profesionalResponsable: "Tec. Alvarado",
                    fechaHoraEjecucion: "2026-11-14T08:45:00",
                    valor: "Muestra de sangre obtenida"
                }
            ]
        }
    ];

    setup(() => {
        host = document.createElement("historial-pasos");
        document.body.appendChild(host);
    });

    teardown(() => {
        if (host?.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado en customElements con Shadow DOM open", () => {
        expect(customElements.get("historial-pasos")).to.equal(HistorialPasos);
        assert.instanceOf(host, HistorialPasos);
        assert.isNotNull(host.shadowRoot);
    });

    test("muestra aviso de historial vacío cuando no hay pasos", () => {
        host.pasos = [];
        const shadow = host.shadowRoot;
        const vacio = shadow.querySelector("#historial-vacio");
        const lista = shadow.querySelector("#lista-pasos");

        expect(vacio.hidden).to.be.false;
        expect(vacio.textContent.trim()).to.contain("No hay pasos registrados");
        expect(lista.children.length).to.equal(0);
    });

    test("renderiza lista de pasos y jerarquía de subpasos con profesional y fecha", () => {
        host.pasos = pasosFicticios;
        const shadow = host.shadowRoot;

        const vacio = shadow.querySelector("#historial-vacio");
        expect(vacio.hidden).to.be.true;

        const pasosRenderizados = shadow.querySelectorAll(".paso");
        expect(pasosRenderizados.length).to.equal(3); // 2 principales + 1 subpaso

        const nombres = Array.from(shadow.querySelectorAll(".paso-nombre")).map((el) => el.textContent.trim());
        expect(nombres).to.include("Triaje");
        expect(nombres).to.include("Consulta Médica");
        expect(nombres).to.include("Toma de Muestra");

        const datosTexto = shadow.querySelector(".paso-datos").textContent;
        expect(datosTexto).to.contain("Enf. Gómez");
    });

    test("cada paso incluye botón 'Ver Registro' que abre el diálogo modal con el valor del paso", () => {
        host.pasos = pasosFicticios;
        const shadow = host.shadowRoot;

        const botonesRegistro = shadow.querySelectorAll(".paso .boton");
        expect(botonesRegistro.length).to.equal(3);
        expect(botonesRegistro[0].textContent.trim()).to.equal("Ver Registro");

        const dialogo = shadow.querySelector("#dialogo-registro");
        const titulo = shadow.querySelector("#titulo-registro");
        const detalle = shadow.querySelector("#detalle-registro");

        // Al hacer clic en Ver Registro del primer paso
        botonesRegistro[0].click();

        expect(titulo.textContent.trim()).to.equal("Triaje");
        expect(detalle.textContent).to.contain("Temperatura: 36.5°C");

        // Cerrar el diálogo
        const botonCerrar = shadow.querySelector("#cerrar-registro");
        botonCerrar.click();
    });
});

