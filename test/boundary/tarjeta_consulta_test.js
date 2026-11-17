import { TarjetaConsulta } from "../../src/js/boundary/componentes/tarjeta_consulta.js";
import ConsultaService from "../../src/js/control/consulta_service.js";
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
    let fetchStub;

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
        fetchStub = sinon.stub(window, "fetch").rejects(new Error("La tarjeta debe renderizar sin peticiones HTTP"));
        host = document.createElement("tarjeta-consulta");
        document.body.appendChild(host);   // dispara connectedCallback → render()
    });

    teardown(() => {
        host?.remove();
        fetchStub?.restore();
    });

    test("muestra paciente y documento sin realizar peticiones HTTP", () => {
        host.consulta = crearConsulta({ paciente: {
            nombres: "Ana", apellidos: ["López", "Pérez"], numeroDocumento: "01234567-8"
        } });
        expect(host.shadowRoot.querySelector("#paciente").textContent).to.equal("Ana López Pérez");
        expect(host.shadowRoot.querySelector("#documento-paciente").textContent).to.equal("01234567-8");
        expect(fetchStub.called).to.be.false;
    });

    const variantesBackend = [
        {
            nombre: "inicio, persona y descripción de clínica con campos vacíos",
            consulta: { fecha: "", inicio: "2026-11-17T09:35:00", hora: "", paciente: {},
                persona: { nombres: ["Ana", "María"], apellidos: ["López"], documento: { valor: "01234567-8" } },
                clinica: { nombre: "", descripcion: "Clínica Central" } },
            esperado: ["2026-11-17", "09:35", "Ana María López", "01234567-8", "Clínica Central"]
        },
        {
            nombre: "fechaCreacion y datos de paciente planos",
            consulta: { fechaCreacion: "2026-11-16 10:45:00", nombresPaciente: ["Luis", "Alberto"],
                apellidosPaciente: "Pérez", documentoPaciente: "ABC-123", nombreClinica: "Clínica Norte" },
            esperado: ["2026-11-16", "10:45", "Luis Alberto Pérez", "ABC-123", "Clínica Norte"]
        },
        {
            nombre: "nombrePaciente completo y horaInicio",
            consulta: { fecha: "2026-11-15", horaInicio: "14:20", nombrePaciente: "Sofía Ruiz",
                numeroDocumentoPaciente: "PAS-123", idClinica: { nombreClinica: "Clínica Sur" } },
            esperado: ["2026-11-15", "14:20", "Sofía Ruiz", "PAS-123", "Clínica Sur"]
        },
        {
            nombre: "cita anidada con asociaciones vacías en la raíz",
            consulta: { fecha: "", paciente: null, clinica: {}, cita: {
                inicio: "2026-11-14T11:05:00-06:00", paciente: { persona: {
                    nombres: "Carlos", apellidos: "Paz", numeroDocumento: "DOC-14"
                } }, clinica: { nombre: "Clínica Este" }
            } },
            esperado: ["2026-11-14", "11:05", "Carlos Paz", "DOC-14", "Clínica Este"]
        },
        {
            nombre: "consulta e idPaciente.idPersona anidados",
            consulta: { consulta: { fechaCreacion: "2026-11-13T08:15:00", idPaciente: { idPersona: {
                nombreCompleto: "Marta Sol", documento: { numero: "DOC-13" }
            } }, idClinica: { descripcion: "Clínica Oeste" } } },
            esperado: ["2026-11-13", "08:15", "Marta Sol", "DOC-13", "Clínica Oeste"]
        },
        {
            nombre: "nombre y documento en asociaciones separadas",
            consulta: { fechaInicio: "2026-11-12T07:40:00", paciente: { documento: "DOC-12" },
                persona: { nombres: "Pedro", apellido: "Luna" }, clinica: "", idClinica: { nombre: "Clínica Centro" } },
            esperado: ["2026-11-12", "07:40", "Pedro Luna", "DOC-12", "Clínica Centro"]
        },
        {
            nombre: "fecha ISO canónica sin hora separada",
            consulta: { fecha: "2026-11-11T12:30:00", paciente: { nombre: "Lucía", dui: "DOC-11" },
                clinica: { nombreClinica: "Clínica Principal" } },
            esperado: ["2026-11-11", "12:30", "Lucía", "DOC-11", "Clínica Principal"]
        }
    ];

    for (const { nombre, consulta, esperado } of variantesBackend) {
        for (const mapear of [false, true]) {
            test(`renderiza ${nombre}, ${mapear ? "tras pasar por el servicio" : "directamente"}`, () => {
                const original = structuredClone(consulta);
                host.consulta = mapear ? new ConsultaService()._mapearConsulta(consulta) : consulta;
                const valores = ["#fecha", "#hora", "#paciente", "#documento-paciente", "#clinica"]
                    .map((selector) => host.shadowRoot.querySelector(selector).textContent);
                expect(valores).to.deep.equal(esperado);
                expect(consulta).to.deep.equal(original);
                expect(fetchStub.called).to.be.false;
            });
        }
    }

    test("una consulta vacía muestra datos alternativos y limpia el historial anterior", () => {
        host.consulta = crearConsulta({ pasos: pasosFicticios });
        host.consulta = null;
        for (const [selector, texto] of [
            ["#fecha", "Sin fecha"], ["#hora", "Sin hora"], ["#paciente", "Sin paciente"],
            ["#documento-paciente", "Sin documento"], ["#clinica", "Sin clínica"], ["#estado", "Sin estado"]
        ]) {
            expect(host.shadowRoot.querySelector(selector).textContent).to.equal(texto);
        }
        expect(host.shadowRoot.querySelector("historial-pasos").cantidadRegistros).to.equal(0);
        expect(host.shadowRoot.querySelector("#historial-desplegable").hidden).to.be.true;
    });

    test("excluye procedimientos inactivos, cancelados o eliminados", () => {
        host.consulta = crearConsulta({ procedimientos: [
            { nombre: "Control", activo: true },
            { nombre: "No activo", activo: false },
            { nombre: "Baja", estado: "INACTIVO" },
            { nombre: "Cancelación", estado: "CANCELADO" },
            { nombre: "Eliminación", estado: "ELIMINADO" }
        ] });
        const nombres = [...host.shadowRoot.querySelectorAll("#lista-procedimientos li")].map((item) => item.textContent);
        expect(nombres).to.deep.equal(["Control"]);
    });

    test("muestra los datos recibidos como texto sin insertar HTML", () => {
        const texto = '<img src=x onerror="alert(1)">';
        host.consulta = crearConsulta({ paciente: texto, clinica: texto, procedimientos: [{ nombre: texto }] });
        expect(host.shadowRoot.querySelector("#paciente").textContent).to.equal(texto);
        expect(host.shadowRoot.querySelector("#clinica").textContent).to.equal(texto);
        expect(host.shadowRoot.querySelector("#lista-procedimientos li").textContent).to.equal(texto);
        expect(host.shadowRoot.querySelector("img, script")).to.be.null;
        expect(fetchStub.called).to.be.false;
    });

    test("conserva las acciones y sus escuchadores al cambiar la consulta", () => {
        const boton = document.createElement("button");
        boton.slot = "acciones";
        const click = sinon.spy();
        boton.addEventListener("click", click);
        host.appendChild(boton);
        host.consulta = crearConsulta();
        host.consulta = crearConsulta({ idConsulta: 202 });

        expect(host.shadowRoot.querySelector('slot[name="acciones"]').assignedElements()).to.deep.equal([boton]);
        boton.click();
        expect(click.calledOnce).to.be.true;
    });

    test("propaga la apertura y cierre del registro con su consulta y paso", async () => {
        const consulta = crearConsulta({ pasos: pasosFicticios });
        host.consulta = consulta;
        const eventos = [];
        host.addEventListener("registro-consulta-abierto", (evento) => eventos.push(evento));
        host.addEventListener("registro-consulta-cerrado", (evento) => eventos.push(evento));
        const historial = host.shadowRoot.querySelector("historial-pasos");
        historial.shadowRoot.querySelector(".boton").click();
        const dialogo = historial.shadowRoot.querySelector("dialog");
        const cierre = new Promise((resolve) => dialogo.addEventListener("close", resolve, { once: true }));
        historial.shadowRoot.querySelector("#cerrar-registro").click();
        await cierre;

        expect(eventos.map((evento) => evento.type)).to.deep.equal([
            "registro-consulta-abierto", "registro-consulta-cerrado"
        ]);
        eventos.forEach((evento) => {
            expect(evento.detail.consulta).to.equal(consulta);
            expect(evento.detail.paso.nombre).to.equal("Triage inicial");
            expect(evento.bubbles && evento.composed).to.be.true;
        });
        expect(fetchStub.called).to.be.false;
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

    test("agrupa los pasos ejecutados por procedimiento y cuenta también los descendientes", () => {
        host.consulta = crearConsulta({ procedimientos: [
            { nombre: "Consulta General", activo: false, pasos: [
                { nombre: "Exploración", estado: "COMPLETADO", pasos: [
                    { nombre: "Medición", estado: "COMPLETADO", valor: { notas: "Normal" } }
                ] },
                { nombre: "Pendiente", estado: "PENDIENTE" }
            ] },
            { nombre: "Laboratorio", pasos: [
                { nombre: "Hemograma", estado: "COMPLETADO", valor: { notas: "Normal" } }
            ] }
        ] });
        const historial = host.shadowRoot.querySelector("historial-pasos");
        expect(historial.shadowRoot.querySelectorAll("#lista-pasos > li")).to.have.length(2);
        expect(historial.shadowRoot.querySelectorAll(".boton")).to.have.length(3);
        expect(host.shadowRoot.querySelector("#historial-contador").textContent).to.equal("(3)");
    });

    test("una consulta con pasos solamente pendientes muestra el historial vacío", () => {
        host.consulta = crearConsulta({ pasosClinicos: [{ nombre: "Triaje", estado: "PENDIENTE" }] });
        expect(host.shadowRoot.querySelector("#historial-desplegable").hidden).to.be.true;
        expect(host.shadowRoot.querySelector("#historial-vacio").hidden).to.be.false;
    });

    test("prioriza los pasos actuales de HU4 sobre el historial anterior de la cita", () => {
        host.consulta = crearConsulta({
            pasosClinicos: [{ nombre: "Nuevo", estado: "COMPLETADO", valor: { notas: "Actualizado" } }],
            cita: { pasosClinicos: [{ nombre: "Anterior", estado: "COMPLETADO" }] }
        });
        const historial = host.shadowRoot.querySelector("historial-pasos");
        expect(historial.shadowRoot.querySelector(".paso-nombre").textContent).to.equal("Nuevo");
        historial.shadowRoot.querySelector(".boton").click();
        expect(historial.shadowRoot.querySelector("#detalle-registro").textContent).to.include("Actualizado");
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
            expect(contador.textContent).to.equal("(2)");
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
