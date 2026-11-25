import { HistorialPasos } from "../../src/js/boundary/componentes/historial_pasos.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");
suite("HistorialPasos: registros inline", () => {
    let host, sandbox;
    const paso = { nombre: "Recepción", estado: "COMPLETADO",
        responsable: { persona: { nombres: "Ana", apellidos: "López" } },
        rolResponsable: { nombre: "Atención al cliente" }, fechaFin: "2026-11-24T10:30:00-06:00",
        valor: JSON.stringify({ notas: "Paciente estable <script>", diagnostico: "Cefalea", plan: "Control" }),
        ordenesExamen: [{ examen: { nombre: "Signos vitales" }, indicaciones: "Registrar pulso" }] };
    const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
    const registro = () => host.shadowRoot.querySelector("details.registro-inline");
    const toggle = async () => { registro().querySelector("summary").click(); await esperar(); };
    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(window, "fetch").rejects(new Error("El historial no carga catálogos ni datos remotos"));
        host = document.body.appendChild(document.createElement("historial-pasos"));
    });
    teardown(() => { host.remove(); sandbox.restore(); });

    test("es un Web Component nativo, con Shadow DOM abierto y estado vacío", () => {
        expect(host).to.be.instanceOf(HistorialPasos);
        expect(host.shadowRoot).not.to.be.null;
        expect(host.cantidadRegistros).to.equal(0);
        expect(host.shadowRoot.querySelector("#historial-vacio").hidden).to.be.false;
        expect(host.shadowRoot.querySelector("dialog, [popover]")).to.be.null;
    });
    test("normaliza respuestas envueltas y restablece el aviso al recibir null", () => {
        host.pasos = { items: [paso] };
        expect(host.cantidadRegistros).to.equal(1);
        host.pasos = null;
        expect(host.pasos).to.deep.equal([]);
        expect(host.cantidadRegistros).to.equal(0);
    });
    test("Ver Registro abre y Ocultar Registro cierra el contenido dentro del mismo paso", async () => {
        host.pasos = [paso];
        const panel = registro();
        const boton = panel.querySelector("summary");
        expect(panel.firstElementChild).to.equal(boton);
        expect(panel.open).to.be.false;
        boton.focus(); await toggle();
        expect(panel.open).to.be.true;
        expect(boton.textContent).to.equal("Ocultar Registro");
        expect(panel.closest("li.paso")).not.to.be.null;
        expect(getComputedStyle(panel).position).to.equal("static");
        expect(host.shadowRoot.querySelector("dialog, [popover], [aria-modal]")).to.be.null;
        await toggle();
        expect(panel.open).to.be.false;
        expect(boton.textContent).to.equal("Ver Registro");
        expect(host.shadowRoot.activeElement).to.equal(boton);
    });
    test("el panel conserva título, profesional, rol, fecha, hora y todo el registro clínico", async () => {
        host.pasos = [paso]; await toggle();
        const contenido = registro().querySelector(".registro-contenido");
        for (const texto of ["Recepción", "Ana López", "Atención al cliente", "24/11/2026", "10:30 AM",
            "Notas clínicas", "Paciente estable <script>", "Diagnósticos", "Cefalea", "Plan de tratamiento",
            "Control", "Exámenes administrados", "Signos vitales", "Registrar pulso"]) {
            expect(contenido.textContent).to.include(texto);
        }
        expect(contenido.querySelector("script, input, textarea")).to.be.null;
        expect(contenido.textContent).not.to.match(/\d{4}-\d{2}-\d{2}/);
    });
    test("emite una apertura y un cierre con el registro original y eventos compuestos", async () => {
        host.pasos = [paso];
        const eventos = [];
        host.addEventListener("registro-abierto", e => eventos.push(e));
        host.addEventListener("registro-cerrado", e => eventos.push(e));
        await toggle(); await toggle();
        expect(eventos.map(e => e.type)).to.deep.equal(["registro-abierto", "registro-cerrado"]);
        for (const evento of eventos) {
            expect(evento.detail.paso).to.equal(paso);
            expect(evento.bubbles && evento.composed).to.be.true;
        }
    });
    test("permite consultar varios registros sin cerrar otros ni duplicar IDs", async () => {
        host.pasos = [paso, { ...paso, nombre: "Evaluación inicial" }];
        for (const boton of host.shadowRoot.querySelectorAll("summary")) boton.click();
        await esperar();
        expect(host.shadowRoot.querySelectorAll("details[open]")).to.have.length(2);
        const ids = [...host.shadowRoot.querySelectorAll("[id]")].map(n => n.id);
        expect(new Set(ids).size).to.equal(ids.length);
        expect(window.fetch.called).to.be.false;
    });
    test("un diagnóstico vacío no oculta la lista histórica guardada", async () => {
        host.pasos = [{ ...paso, valor: { diagnostico: "", codigosCie10: [{ codigo: "J00", nombre: "Resfriado" }] } }];
        await toggle();
        expect(registro().querySelector(".detalle-registro").textContent).to.include("J00 — Resfriado");
    });
    test("desmontar o reemplazar los datos cierra los registros y notifica una sola vez", async () => {
        host.pasos = [paso]; await toggle();
        const cerrado = sandbox.spy(); host.addEventListener("registro-cerrado", cerrado);
        host.remove(); await esperar();
        expect(registro().open).to.be.false;
        expect(cerrado.calledOnce).to.be.true;
        document.body.append(host); host.pasos = [paso]; await toggle();
        host.pasos = []; await esperar();
        expect(cerrado.callCount).to.equal(2);
    });
    test("agrupa pasos ejecutados, conserva los subpasos y excluye pendientes y futuros", () => {
        host.pasos = [{ nombre: "Procedimiento", esGrupoHistorial: true, pasos: [paso,
            { nombre: "Pendiente", estado: "PENDIENTE" }, { nombre: "Futuro", estado: "FUTURO" }] }];
        expect(host.cantidadRegistros).to.equal(1);
        expect(host.shadowRoot.querySelectorAll("#lista-pasos > li > ul li")).to.have.length(1);
        expect(host.shadowRoot.textContent).not.to.include("Pendiente").and.not.to.include("Futuro");
    });
    test("los subpasos abren sus propios metadatos y registros", async () => {
        host.pasos = [{ nombre: "Procedimiento", esGrupoHistorial: true, pasos: [paso] }];
        await toggle();
        expect(registro().querySelector(".titulo-registro").textContent).to.equal("Recepción");
        expect(registro().querySelector(".detalle-registro").textContent).to.include("Cefalea");
    });
    test("evita ciclos sin modificar el objeto original", () => {
        const circular = { ...paso, pasos: [] }; circular.pasos.push(circular);
        host.pasos = [circular];
        expect(host.cantidadRegistros).to.equal(1);
        expect(circular.pasos[0]).to.equal(circular);
    });
    test("mantiene los diagnósticos históricos estructurados sin cargar CIE-10", async () => {
        host.pasos = [{ ...paso, valor: { diagnostico: [{ codigo: "J00", nombre: "Resfriado" }],
            notas: "Registro anterior", observaciones: "Seguimiento" } }];
        await toggle();
        expect(registro().textContent).to.include("J00 — Resfriado").and.include("Seguimiento");
        expect(window.fetch.called).to.be.false;
    });
    for (const [datos, esperado] of [
        [{ fechaHoraEjecucion: "2026-11-12T08:30:00" }, "12/11/2026 08:30"],
        [{ fecha: "2026-11-12", hora: "08:30" }, "12/11/2026 08:30"],
        [{ fechaHora: { fecha: "2026-11-12", hora: "08:30" } }, "12/11/2026 08:30"],
        [{ fechaHora: new Date("2026-11-12T14:30:00Z") }, "12/11/2026 08:30 AM"],
        [{ fecha: "sin fecha" }, "Sin fecha"], [{}, "Sin fecha"]
    ]) test(`normaliza la fecha visible: ${esperado}`, () => expect(host._fechaHoraPaso(datos)).to.equal(esperado));
});
