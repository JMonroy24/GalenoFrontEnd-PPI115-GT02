import { TarjetaConsulta } from "../../src/js/boundary/componentes/tarjeta_consulta.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

// ─────────────────────────────────────────────────────────────────────────────
// Suite: TarjetaConsulta
//
// Cubre tres bloques funcionales del Custom Element <tarjeta-consulta>:
//   1. Creación e inicialización del elemento y su Shadow DOM.
//   2. Renderizado correcto de los datos de la cita/consulta.
//   3. Proyección de nodos externos mediante <slot name="acciones">.
//   4. Integración con el subcomponente <historial-pasos>.
// ─────────────────────────────────────────────────────────────────────────────
suite("TarjetaConsulta (unitaria)", () => {
    let host;

    // ── Datos de prueba ───────────────────────────────────────────────────────

    /** Pasos anidados: un paso raíz con un subpaso */
    const pasosFicticios = [
        {
            nombre: "Triage inicial",
            profesionalResponsable: "Enf. López",
            fechaHoraEjecucion: "2026-11-12T08:30:00",
            contenidoCompleto: "Paciente evaluado en triaje.",
            pasos: [
                {
                    nombre: "Signos vitales",
                    profesionalResponsable: "Enf. López",
                    fechaHoraEjecucion: "2026-11-12T08:35:00",
                    detalle: "TA 120/80, pulso 72 lpm."
                }
            ]
        }
    ];

    /**
     * Crea un objeto de consulta base con valores predecibles.
     * @param {object} extra - Propiedades adicionales a mezclar.
     */
    const crearConsulta = (extra = {}) => ({
        idConsulta: 101,
        fecha: "2026-11-12",
        hora: "09:00",
        estado: "Pendiente",
        clinica: "Clínica Central",
        procedimientos: [{ nombre: "Consulta General" }],
        ...extra
    });

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    setup(() => {
        host = document.createElement("tarjeta-consulta");
        document.body.appendChild(host);   // dispara connectedCallback → render()
    });

    teardown(() => {
        host?.remove();
    });

    // ── Bloque 1: Custom Element y Shadow DOM ─────────────────────────────────

    suite("1. Creación del Custom Element", () => {
        test("está registrado en customElements con la etiqueta correcta", () => {
            expect(customElements.get("tarjeta-consulta")).to.equal(TarjetaConsulta);
            assert.instanceOf(host, TarjetaConsulta);
        });

        test("inicializa el Shadow DOM con mode='open'", () => {
            assert.isNotNull(host.shadowRoot);
        });

        test("el Shadow DOM contiene el artículo raíz y el subcomponente historial", () => {
            expect(host.shadowRoot.querySelector("article.tarjeta")).to.exist;
            expect(host.shadowRoot.querySelector("historial-pasos")).to.exist;
        });

        test("la propiedad consulta comienza como null", () => {
            assert.isNull(host.consulta);
        });
    });

    // ── Bloque 2: Renderizado de datos de la cita ─────────────────────────────

    suite("2. Renderizado de datos de la cita", () => {
        test("muestra la fecha, hora, clínica y estado correctos", () => {
            host.consulta = crearConsulta();

            expect(host.shadowRoot.querySelector("#fecha").textContent).to.equal("2026-11-12");
            expect(host.shadowRoot.querySelector("#hora").textContent).to.equal("09:00");
            expect(host.shadowRoot.querySelector("#clinica").textContent).to.equal("Clínica Central");
            expect(host.shadowRoot.querySelector("#estado-texto").textContent).to.equal("Pendiente");
        });

        test("aplica la clase CSS de estado correcta (warning → Pendiente)", () => {
            host.consulta = crearConsulta({ estado: "Pendiente" });
            const estadoBadge = host.shadowRoot.querySelector("#estado");

            expect(estadoBadge.textContent).to.equal("Pendiente");
            expect(estadoBadge.classList.contains("estado--warning")).to.be.true;
        });

        test("aplica estado--success para 'Confirmada'", () => {
            host.consulta = crearConsulta({ estado: "Confirmada" });
            const estadoBadge = host.shadowRoot.querySelector("#estado");

            expect(estadoBadge.classList.contains("estado--success")).to.be.true;
        });

        test("aplica estado--error para 'Cancelada'", () => {
            host.consulta = crearConsulta({ estado: "Cancelada" });
            const estadoBadge = host.shadowRoot.querySelector("#estado");

            expect(estadoBadge.classList.contains("estado--error")).to.be.true;
        });

        test("renderiza la lista de procedimientos activos", () => {
            host.consulta = crearConsulta();

            const items = host.shadowRoot.querySelectorAll("#lista-procedimientos li");
            expect(items).to.have.length(1);
            expect(items[0].textContent).to.equal("Consulta General");
            expect(host.shadowRoot.querySelector("#procedimientos-vacio").hidden).to.be.true;
        });

        test("muestra el aviso de vacío cuando no hay procedimientos", () => {
            host.consulta = crearConsulta({ procedimientos: [] });

            expect(host.shadowRoot.querySelectorAll("#lista-procedimientos li")).to.have.length(0);
            expect(host.shadowRoot.querySelector("#procedimientos-vacio").hidden).to.be.false;
        });

        test("extrae la fecha desde fechaHora ISO-8601 cuando no hay campo 'fecha'", () => {
            host.consulta = { idConsulta: 1, fechaHora: "2026-11-12T09:00:00", estado: "Activa" };

            expect(host.shadowRoot.querySelector("#fecha").textContent).to.equal("2026-11-12");
            expect(host.shadowRoot.querySelector("#hora").textContent).to.equal("09:00");
        });

        test("re-renderiza al asignar una nueva consulta", () => {
            host.consulta = crearConsulta({ estado: "Pendiente" });
            expect(host.shadowRoot.querySelector("#estado-texto").textContent).to.equal("Pendiente");

            host.consulta = crearConsulta({ estado: "Atendida" });
            expect(host.shadowRoot.querySelector("#estado-texto").textContent).to.equal("Atendida");
        });
    });

    // ── Bloque 3: Proyección de acciones mediante <slot> ──────────────────────

    suite("3. Proyección de botones en <slot name='acciones'>", () => {
        test("el slot 'acciones' existe en el Shadow DOM", () => {
            const slot = host.shadowRoot.querySelector("slot[name='acciones']");

            assert.isNotNull(slot);
            expect(slot.name).to.equal("acciones");
        });

        test("un botón con slot='acciones' queda asignado al slot", () => {
            host.consulta = crearConsulta();

            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = "Descargar Ticket PDF";
            boton.slot = "acciones";
            host.appendChild(boton);

            const slot = host.shadowRoot.querySelector("slot[name='acciones']");
            const asignados = slot.assignedElements();

            expect(asignados).to.have.length(1);
            expect(asignados[0]).to.equal(boton);
            expect(asignados[0].textContent).to.equal("Descargar Ticket PDF");
        });

        test("múltiples elementos con slot='acciones' quedan todos asignados", () => {
            host.consulta = crearConsulta();

            ["Atender", "Cancelar", "Imprimir"].forEach((texto) => {
                const btn = document.createElement("button");
                btn.textContent = texto;
                btn.slot = "acciones";
                host.appendChild(btn);
            });

            const slot = host.shadowRoot.querySelector("slot[name='acciones']");
            expect(slot.assignedElements()).to.have.length(3);
        });
    });

    // ── Bloque 4: Integración con <historial-pasos> ───────────────────────────

    suite("4. Integración con <historial-pasos>", () => {
        test("pasa los pasos al subcomponente y muestra el contador", () => {
            host.consulta = crearConsulta({ pasos: pasosFicticios });

            const historial = host.shadowRoot.querySelector("historial-pasos");
            const desplegable = host.shadowRoot.querySelector("#historial-desplegable");
            const contador = host.shadowRoot.querySelector("#historial-contador");

            expect(historial.pasos).to.deep.equal(pasosFicticios);
            expect(desplegable.hidden).to.be.false;
            expect(contador.textContent).to.equal("(1)");
        });

        test("el subcomponente renderiza el profesional y fecha/hora del paso", () => {
            host.consulta = crearConsulta({ pasos: pasosFicticios });

            const historial = host.shadowRoot.querySelector("historial-pasos");

            expect(historial.shadowRoot.textContent).to.contain("Enf. López");
            expect(historial.shadowRoot.textContent).to.contain("2026-11-12 08:30");
        });

        test("el subcomponente expone el botón 'Ver Registro' y el diálogo modal", () => {
            host.consulta = crearConsulta({ pasos: pasosFicticios });

            const historial = host.shadowRoot.querySelector("historial-pasos");
            const boton = historial.shadowRoot.querySelector(".paso .boton");
            const dialogo = historial.shadowRoot.querySelector("dialog#dialogo-registro");

            expect(boton.textContent.trim()).to.equal("Ver Registro");
            expect(dialogo).to.exist;
        });

        test("oculta el desplegable y muestra aviso cuando no hay pasos", () => {
            host.consulta = crearConsulta();   // sin pasos

            const historial = host.shadowRoot.querySelector("historial-pasos");
            const desplegable = host.shadowRoot.querySelector("#historial-desplegable");
            const vacio = host.shadowRoot.querySelector("#historial-vacio");

            expect(historial.pasos).to.be.empty;
            expect(desplegable.hidden).to.be.true;
            expect(vacio.hidden).to.be.false;
            expect(vacio.textContent.trim()).to.equal("Sin pasos ejecutados.");
        });
    });
});
