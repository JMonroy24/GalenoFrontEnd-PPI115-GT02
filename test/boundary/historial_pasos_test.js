import { HistorialPasos } from "../../src/js/boundary/componentes/historial_pasos.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

// ─────────────────────────────────────────────────────────────────────────────
// Suite: HistorialPasos
//
// Cubre tres bloques funcionales del Custom Element <historial-pasos>:
//   1. Creación del elemento y estado inicial (sin pasos).
//   2. Renderización jerárquica de pasos y subpasos (profesional, fecha/hora).
//   3. Apertura y cierre del diálogo modal <dialog> al pulsar "Ver Registro".
// ─────────────────────────────────────────────────────────────────────────────
suite("HistorialPasos (unitaria)", () => {
    let host;

    // ── Datos de prueba ───────────────────────────────────────────────────────

    /**
     * Datos de pasos con:
     *  - Paso raíz con profesional como objeto {nombres, apellidos[]}
     *  - Un subpaso con profesional como string
     *  - contenidoCompleto para el diálogo modal del paso raíz
     */
    const pasosFicticios = [
        {
            nombre: "Triaje inicial",
            profesionalResponsable: {
                nombres: "Carlos",
                apellidos: ["López"]
            },
            fechaHoraEjecucion: "2026-11-12T08:30:00",
            contenidoCompleto: "Paciente estable. Signos vitales dentro del rango normal.",
            pasos: [
                {
                    nombre: "Signos vitales",
                    profesionalResponsable: "Enf. Ana Pérez",
                    fechaHoraEjecucion: "2026-11-12T08:35:00",
                    detalle: "TA 120/80, temperatura 36.5 °C."
                }
            ]
        }
    ];

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    setup(() => {
        host = document.createElement("historial-pasos");
        document.body.appendChild(host);   // dispara connectedCallback → render()
    });

    teardown(() => {
        host?.remove();
    });

    // ── Bloque 1: Custom Element y estado inicial ─────────────────────────────

    suite("1. Creación del Custom Element", () => {
        test("está registrado en customElements con la etiqueta correcta", () => {
            expect(customElements.get("historial-pasos")).to.equal(HistorialPasos);
            assert.instanceOf(host, HistorialPasos);
        });

        test("inicializa el Shadow DOM con mode='open'", () => {
            assert.isNotNull(host.shadowRoot);
        });

        test("la propiedad pasos comienza como array vacío", () => {
            expect(host.pasos).to.deep.equal([]);
        });

        test("muestra el aviso de vacío cuando no hay pasos", () => {
            const vacio = host.shadowRoot.querySelector("#historial-vacio");

            expect(vacio).to.exist;
            expect(vacio.hidden).to.be.false;
            expect(vacio.textContent.trim()).to.equal("No hay pasos registrados.");
        });

        test("la lista de pasos está vacía inicialmente", () => {
            expect(host.shadowRoot.querySelectorAll("#lista-pasos > li.paso")).to.have.length(0);
        });

        test("el diálogo modal existe pero está cerrado", () => {
            const dialogo = host.shadowRoot.querySelector("dialog#dialogo-registro");
            expect(dialogo).to.exist;
            expect(dialogo.open).to.be.false;
        });
    });

    // ── Bloque 2: Renderización jerárquica de pasos ───────────────────────────

    suite("2. Renderización jerárquica de pasos y subpasos", () => {
        test("renderiza un paso raíz en la lista principal", () => {
            host.pasos = pasosFicticios;

            const lista = host.shadowRoot.querySelector("#lista-pasos");
            expect(lista.children).to.have.length(1);
        });

        test("el paso raíz muestra el nombre del paso", () => {
            host.pasos = pasosFicticios;

            const pasoRaiz = host.shadowRoot.querySelector("#lista-pasos > li.paso");
            const nombre = pasoRaiz.firstElementChild.querySelector(".paso-nombre");

            expect(nombre.textContent).to.equal("Triaje inicial");
        });

        test("el paso raíz muestra el nombre del profesional (objeto con nombres/apellidos)", () => {
            host.pasos = pasosFicticios;

            const pasoRaiz = host.shadowRoot.querySelector("#lista-pasos > li.paso");
            const datos = pasoRaiz.firstElementChild.querySelector(".paso-datos");

            expect(datos.textContent).to.contain("Profesional: Carlos López");
        });

        test("el paso raíz muestra la fecha y hora formateada", () => {
            host.pasos = pasosFicticios;

            const pasoRaiz = host.shadowRoot.querySelector("#lista-pasos > li.paso");
            const datos = pasoRaiz.firstElementChild.querySelector(".paso-datos");

            expect(datos.textContent).to.contain("Fecha y hora: 2026-11-12 08:30");
        });

        test("el paso raíz contiene una lista anidada (ul) con sus subpasos", () => {
            host.pasos = pasosFicticios;

            const pasoRaiz = host.shadowRoot.querySelector("#lista-pasos > li.paso");
            const listaHijos = pasoRaiz.querySelector("ul");

            assert.isNotNull(listaHijos, "debe existir una <ul> anidada con subpasos");
            expect(pasoRaiz.contains(listaHijos)).to.be.true;
            expect(listaHijos.querySelectorAll("li.paso")).to.have.length(1);
        });

        test("el subpaso muestra nombre, profesional (string) y fecha/hora", () => {
            host.pasos = pasosFicticios;

            const listaHijos = host.shadowRoot.querySelector("#lista-pasos > li.paso > ul");
            const pasoHijo = listaHijos.querySelector("li.paso");
            const contenidoHijo = pasoHijo.firstElementChild;

            expect(contenidoHijo.querySelector(".paso-nombre").textContent).to.equal("Signos vitales");
            expect(contenidoHijo.querySelector(".paso-datos").textContent).to.contain("Profesional: Enf. Ana Pérez");
            expect(contenidoHijo.querySelector(".paso-datos").textContent).to.contain("Fecha y hora: 2026-11-12 08:35");
        });

        test("se renderiza un botón 'Ver Registro' por cada paso/subpaso", () => {
            host.pasos = pasosFicticios;   // 1 raíz + 1 subpaso = 2 botones

            const botones = host.shadowRoot.querySelectorAll(".boton");
            expect(botones).to.have.length(2);
            botones.forEach((btn) => {
                expect(btn.textContent.trim()).to.equal("Ver Registro");
            });
        });

        test("oculta el aviso de vacío cuando hay pasos", () => {
            host.pasos = pasosFicticios;

            expect(host.shadowRoot.querySelector("#historial-vacio").hidden).to.be.true;
        });

        test("re-renderiza al asignar nuevos pasos", () => {
            host.pasos = pasosFicticios;
            expect(host.shadowRoot.querySelectorAll("#lista-pasos > li.paso")).to.have.length(1);

            host.pasos = [];
            expect(host.shadowRoot.querySelectorAll("#lista-pasos > li.paso")).to.have.length(0);
            expect(host.shadowRoot.querySelector("#historial-vacio").hidden).to.be.false;
        });

        test("acepta un paso sin subpasos y no crea lista anidada", () => {
            host.pasos = [{ nombre: "Solo paso", profesionalResponsable: "Dr. X", fechaHoraEjecucion: "2026-11-12T10:00:00" }];

            const pasoRaiz = host.shadowRoot.querySelector("#lista-pasos > li.paso");
            const listaHijos = pasoRaiz.querySelector("ul");

            assert.isNull(listaHijos, "no debe existir <ul> si no hay subpasos");
        });
    });

    // ── Bloque 3: Diálogo modal "Ver Registro" ────────────────────────────────

    suite("3. Diálogo modal <dialog> — apertura y cierre", () => {
        test("el diálogo comienza cerrado antes de hacer clic", () => {
            host.pasos = pasosFicticios;

            const dialogo = host.shadowRoot.querySelector("dialog#dialogo-registro");
            expect(dialogo.open).to.be.false;
        });

        test("pulsar 'Ver Registro' abre el diálogo modal", () => {
            host.pasos = pasosFicticios;

            const boton = host.shadowRoot.querySelector(".paso .boton");
            boton.click();

            const dialogo = host.shadowRoot.querySelector("dialog#dialogo-registro");
            expect(dialogo.open).to.be.true;
        });

        test("el diálogo muestra el nombre del paso como título", () => {
            host.pasos = pasosFicticios;

            host.shadowRoot.querySelector(".paso .boton").click();

            const titulo = host.shadowRoot.querySelector("#titulo-registro");
            expect(titulo.textContent).to.equal("Triaje inicial");
        });

        test("el diálogo muestra el contenido del registro del paso", () => {
            host.pasos = pasosFicticios;

            host.shadowRoot.querySelector(".paso .boton").click();

            const detalle = host.shadowRoot.querySelector("#detalle-registro");
            expect(detalle.textContent).to.contain("Paciente estable");
            expect(detalle.textContent).to.contain("Signos vitales dentro del rango normal.");
        });

        test("pulsar 'Cerrar' cierra el diálogo modal", () => {
            host.pasos = pasosFicticios;

            host.shadowRoot.querySelector(".paso .boton").click();
            host.shadowRoot.querySelector("#cerrar-registro").click();

            const dialogo = host.shadowRoot.querySelector("dialog#dialogo-registro");
            expect(dialogo.open).to.be.false;
        });

        test("el ciclo completo apertura → cierre funciona correctamente", () => {
            host.pasos = pasosFicticios;

            const dialogo = host.shadowRoot.querySelector("dialog#dialogo-registro");
            const botonVer = host.shadowRoot.querySelector(".paso .boton");
            const botonCerrar = host.shadowRoot.querySelector("#cerrar-registro");

            // Estado inicial: cerrado
            expect(dialogo.open).to.be.false;

            // Apertura
            botonVer.click();
            expect(dialogo.open).to.be.true;
            expect(host.shadowRoot.querySelector("#titulo-registro").textContent).to.equal("Triaje inicial");

            // Cierre
            botonCerrar.click();
            expect(dialogo.open).to.be.false;
        });
    });
});
