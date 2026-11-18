import { AtencionConsultaView } from "../../src/js/boundary/vistas/atencion_consulta_view.js";
import store from "../../src/js/store.js";
import * as routerModule from "../../src/js/router.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import { consultaProcedimientoService } from "../../src/js/control/consulta_procedimiento_service.js";
import { tipoExamenService } from "../../src/js/control/tipo_examen_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AtencionConsultaView (unitaria)", () => {
    let host;
    let navigateStub;
    let guardarPasoStub;
    let tipoExamenStub;
    let estadoOriginal;
    let rutaAnterior;

    const IDS_PASOS = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444"
    ];
    const NOMBRES_PASOS = ["Triaje", "Consulta Médica", "Tratamiento", "Cierre"];
    const crearPasos = (indiceActivo = 1) => NOMBRES_PASOS.map((nombre, i) => ({
        idPaso: IDS_PASOS[i],
        nombre,
        estado: i < indiceActivo ? "COMPLETADO" : i === indiceActivo ? "EN_CURSO" : "PENDIENTE"
    }));

    const seleccionarPaso = (indice) => store.setState({ consultaActiva: {
        ...structuredClone(consultaFicticia),
        pasoActivo: indice,
        pasos: crearPasos(indice)
    } });

    const consultaFicticia = {
        idConsulta: 55,
        pasoActivo: 1,
        fecha: "2026-11-12",
        hora: "10:00",
        clinica: "Clínica Central",
        paciente: {
            nombres: "Ana",
            apellidos: "García"
        },
        procedimientos: [{ nombre: "Control General" }],
        pasos: crearPasos(1)
    };

    setup(() => {
        rutaAnterior = window.location.hash;
        estadoOriginal = { ...store.getState() };
        navigateStub = sinon.stub(routerModule.router, "navigate");

        guardarPasoStub = sinon
            .stub(consultaProcedimientoService, "guardarPaso")
            .resolves({ ok: true });

        tipoExamenStub = sinon
            .stub(tipoExamenService, "findRange")
            .resolves({ items: [] });

        store.setState({
            online: true,
            token: "fake-jwt",
            consultaActiva: structuredClone(consultaFicticia)
        });

        host = document.createElement("atencion-consulta-view");
        document.body.appendChild(host);
    });

    teardown(() => {
        host?.remove();
        window.history.replaceState(null, "", window.location.pathname + window.location.search + rutaAnterior);
        navigateStub?.restore();
        guardarPasoStub?.restore();
        tipoExamenStub?.restore();
        store.setState({ ...estadoOriginal, consultaActiva: null,
            consultaSeleccionada: null, consulta: null });
    });

    // ── Registro del componente ──────────────────────────────────────────────

    test("está registrado en customElements con la etiqueta 'atencion-consulta-view'", () => {
        expect(customElements.get("atencion-consulta-view")).to.equal(AtencionConsultaView);
        assert.instanceOf(host, AtencionConsultaView);
        assert.isNotNull(host.shadowRoot);
    });

    test("posee Shadow DOM en modo 'open'", () => {
        expect(host.shadowRoot).to.not.be.null;
    });

    // ── Estructura accesible ──────────────────────────────────────────────────

    test("renderiza un <form> con aria-label para el formulario clínico", () => {
        const form = host.shadowRoot.querySelector("form#form-clinico");
        assert.isNotNull(form, "Debe existir form#form-clinico");
        expect(form.getAttribute("aria-label")).to.equal("Formulario de registro médico");
        expect(form.hasAttribute("novalidate")).to.be.true;
    });

    test("renderiza un <section> contenedor con aria-labelledby", () => {
        const section = host.shadowRoot.querySelector("section.vista");
        assert.isNotNull(section);
        expect(section.getAttribute("aria-labelledby")).to.equal("titulo-vista");
    });

    test("incluye un <h2> con id='titulo-vista' para anclar la referencia aria-labelledby", () => {
        const titulo = host.shadowRoot.querySelector("h2#titulo-vista");
        assert.isNotNull(titulo);
        expect(titulo.textContent.trim()).to.include("Registro de Atención Médica");
    });

    // ── Campo: Notas de la Consulta ──────────────────────────────────────────

    test("renderiza textarea#notas con name='notasConsulta'", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas");
        assert.isNotNull(ta, "Debe existir textarea#notas");
        expect(ta.name).to.equal("notasConsulta");
    });

    test("textarea de Notas tiene un <label> enlazado mediante for/id", () => {
        const label = host.shadowRoot.querySelector("label[for='notas']");
        assert.isNotNull(label, "Debe existir label[for='notas']");
        expect(label.textContent.trim()).to.match(/Notas de la Consulta/i);
    });

    test("textarea de Notas tiene un placeholder descriptivo no vacío", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas");
        expect(ta.placeholder).to.have.length.greaterThan(10);
    });

    test("textarea de Notas tiene aria-describedby apuntando al contador y al span de error", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas");
        expect(ta.getAttribute("aria-describedby")).to.include("contador-notas");
        expect(ta.getAttribute("aria-describedby")).to.include("error-notas");
    });

    test("el contador de Notas inicia en '0 / 2000'", () => {
        const contador = host.shadowRoot.querySelector("#contador-notas");
        assert.isNotNull(contador);
        expect(contador.textContent.trim()).to.equal("0 / 2000");
    });

    test("el contador de Notas se actualiza al escribir en el textarea", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas");
        ta.value = "Texto de prueba";
        ta.dispatchEvent(new Event("input", { bubbles: true }));

        const contador = host.shadowRoot.querySelector("#contador-notas");
        expect(contador.textContent.trim()).to.equal("15 / 2000");
    });

    // ── Campo: Plan de Tratamiento ───────────────────────────────────────────

    test("renderiza textarea#plan con name='planTratamiento'", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan");
        assert.isNotNull(ta, "Debe existir textarea#plan");
        expect(ta.name).to.equal("planTratamiento");
    });

    test("textarea de Plan tiene un <label> enlazado mediante for/id", () => {
        const label = host.shadowRoot.querySelector("label[for='plan']");
        assert.isNotNull(label, "Debe existir label[for='plan']");
        expect(label.textContent.trim()).to.match(/Plan de Tratamiento/i);
    });

    test("textarea de Plan tiene un placeholder descriptivo no vacío", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan");
        expect(ta.placeholder).to.have.length.greaterThan(10);
    });

    test("el contador de Plan inicia en '0 / 2000'", () => {
        const contador = host.shadowRoot.querySelector("#contador-plan");
        assert.isNotNull(contador);
        expect(contador.textContent.trim()).to.equal("0 / 2000");
    });

    test("el contador de Plan se actualiza al escribir en el textarea", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan");
        ta.value = "ABC";
        ta.dispatchEvent(new Event("input", { bubbles: true }));

        const contador = host.shadowRoot.querySelector("#contador-plan");
        expect(contador.textContent.trim()).to.equal("3 / 2000");
    });

    // ── obtenerDatosFormulario ────────────────────────────────────────────────

    test("obtenerDatosFormulario() devuelve objeto con notasConsulta y planTratamiento vacíos por defecto", () => {
        const datos = host.obtenerDatosFormulario();
        expect(datos).to.have.keys(["notasConsulta", "planTratamiento", "diagnostico", "diagnosticos"]);
        expect(datos.notasConsulta).to.equal("");
        expect(datos.planTratamiento).to.equal("");
    });

    test("obtenerDatosFormulario() devuelve los valores actuales de los campos recortados", () => {
        const taNotas = host.shadowRoot.querySelector("#notas");
        const taPlan = host.shadowRoot.querySelector("#plan");

        taNotas.value = "  Paciente con cefalea  ";
        taPlan.value = "  Paracetamol 500mg  ";

        const datos = host.obtenerDatosFormulario();
        expect(datos.notasConsulta).to.equal("Paciente con cefalea");
        expect(datos.planTratamiento).to.equal("Paracetamol 500mg");
    });

    test("obtenerDatosFormulario() es un método público expuesto en la instancia", () => {
        expect(typeof host.obtenerDatosFormulario).to.equal("function");
    });

    // ── cargarDatosFormulario ────────────────────────────────────────────────

    test("cargarDatosFormulario() rellena los campos con los datos proporcionados", () => {
        host.cargarDatosFormulario({
            notasConsulta: "Dolor de cabeza moderado",
            planTratamiento: "Ibuprofeno 400mg c/8h"
        });

        const datos = host.obtenerDatosFormulario();
        expect(datos.notasConsulta).to.equal("Dolor de cabeza moderado");
        expect(datos.planTratamiento).to.equal("Ibuprofeno 400mg c/8h");
    });

    test("cargarDatosFormulario() actualiza los contadores tras cargar datos", () => {
        host.cargarDatosFormulario({ notasConsulta: "Hola" });

        const contador = host.shadowRoot.querySelector("#contador-notas");
        expect(contador.textContent.trim()).to.equal("4 / 2000");
    });

    // ── Botones de acción ────────────────────────────────────────────────────

    test("renderiza la botonera con Cancelar, Anterior y Guardar y Avanzar", () => {
        const btnCancelar = host.shadowRoot.querySelector("#btn-cancelar");
        const btnAnterior = host.shadowRoot.querySelector("#btn-anterior");
        const btnSiguiente = host.shadowRoot.querySelector("#btn-siguiente");

        assert.isNotNull(btnCancelar, "Debe existir #btn-cancelar");
        assert.isNotNull(btnAnterior, "Debe existir #btn-anterior");
        assert.isNotNull(btnSiguiente, "Debe existir #btn-siguiente");

        expect(btnCancelar.type).to.equal("button");
        expect(btnAnterior.type).to.equal("button");
        expect(btnSiguiente.type).to.equal("submit");
        expect(btnSiguiente.textContent).to.include("Guardar y Avanzar");
        expect(host.shadowRoot.querySelector("#btn-finalizar")).to.be.null;
    });

    test("botón #btn-anterior está deshabilitado en el paso 0 y habilitado en pasos posteriores", () => {
        const btnAnterior = host.shadowRoot.querySelector("#btn-anterior");
        assert.isNotNull(btnAnterior, "Debe existir #btn-anterior");

        // En setup _pasoActivo inicia en 1, así que debe estar habilitado
        expect(btnAnterior.disabled).to.be.false;

        // Cambiar al paso 0
        seleccionarPaso(0);
        expect(host.shadowRoot.querySelector("#btn-anterior").disabled).to.be.true;

        // Retroceder al paso 1
        seleccionarPaso(1);
        expect(host.shadowRoot.querySelector("#btn-anterior").disabled).to.be.false;
    });

    test("botón #btn-anterior retrocede al paso anterior al hacer clic", async () => {
        seleccionarPaso(2);
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(2);

        const retroceder = sinon.spy(host, "_retrocederPaso");
        try {
            host.shadowRoot.querySelector("#btn-anterior").click();
            expect(retroceder.calledOnce).to.be.true;
            await retroceder.firstCall.returnValue;
        } finally {
            retroceder.restore();
        }
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(1);
        expect(guardarPasoStub.called).to.be.true;
    });

    test("en paso intermedio guarda y avanza al siguiente paso sin salir al dashboard", async () => {
        seleccionarPaso(1); // paso 1 de 4 (intermedio)
        host.shadowRoot.querySelector("#notas").value = "Notas paso intermedio";

        const btnGuardar = host.shadowRoot.querySelector("#btn-siguiente");
        expect(btnGuardar.textContent).to.contain("Guardar y Avanzar");

        const enviar = sinon.spy(host, "_alEnviarFormulario");
        try {
            host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
            );
            expect(enviar.calledOnce).to.be.true;
            await enviar.firstCall.returnValue;
        } finally {
            enviar.restore();
        }

        expect(guardarPasoStub.called).to.be.true;
        expect(host._pasoActivo).to.equal(2);
        expect(navigateStub.calledWith("#dashboard")).to.be.false;
    });

    test("en el último paso muestra botón Finalizar Consulta y al enviar redirige a #dashboard", async () => {
        seleccionarPaso(3); // paso 3 de 4 (último paso)

        const btnFinalizar = host.shadowRoot.querySelector("#btn-finalizar");
        assert.isNotNull(btnFinalizar, "Debe existir botón Finalizar en el último paso");
        expect(btnFinalizar.textContent).to.contain("Finalizar Consulta");

        host.shadowRoot.querySelector("#notas").value = "Notas de cierre";

        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 60));

        expect(guardarPasoStub.called).to.be.true;
        expect(window.location.hash).to.equal("#dashboard");
    });

    test("el botón 'Volver' navega al dashboard al hacer clic", () => {
        const btnVolver = host.shadowRoot.querySelector("#btn-volver");
        btnVolver.click();
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
    });

    test("el botón 'Cancelar' despacha el evento 'cancelar-atencion' y navega al dashboard", () => {
        let eventoRecibido = null;
        host.addEventListener("cancelar-atencion", (e) => { eventoRecibido = e.detail; });

        host.shadowRoot.querySelector("#btn-cancelar").click();

        assert.isNotNull(eventoRecibido, "Debe despachar 'cancelar-atencion'");
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
    });

    // ── Envío del formulario ──────────────────────────────────────────────────

    test("enviar el formulario sin datos muestra error y no llama a guardarPaso", async () => {
        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 50));

        expect(guardarPasoStub.called).to.be.false;
        const errorNotas = host.shadowRoot.querySelector("#error-notas");
        expect(errorNotas.textContent.trim()).to.have.length.greaterThan(0);
    });

    test("enviar el formulario con datos llama a guardarPaso y despacha 'consulta-guardada'", async () => {
        let eventoGuardado = null;
        host.addEventListener("consulta-guardada", (e) => { eventoGuardado = e.detail; });

        host.shadowRoot.querySelector("#notas").value = "Fiebre 38°C, tos seca";
        host.shadowRoot.querySelector("#plan").value = "Reposo y paracetamol";

        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 100));

        expect(guardarPasoStub.callCount).to.equal(2);
        expect(guardarPasoStub.firstCall.args[0]).to.equal(IDS_PASOS[1]);
        assert.isNotNull(eventoGuardado, "Debe despachar 'consulta-guardada'");
        expect(eventoGuardado.datos.notasConsulta).to.equal("Fiebre 38°C, tos seca");
        expect(eventoGuardado.datos.planTratamiento).to.equal("Reposo y paracetamol");
    });

    // ── Máquina de estados de la botonera ─────────────────────────────────────

    test("el botón Anterior está deshabilitado en el primer paso", () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { nombre: "Triaje", estado: "EN_CURSO" },
                    { nombre: "Consulta Médica", estado: "PENDIENTE" },
                    { nombre: "Tratamiento", estado: "PENDIENTE" },
                    { nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        const btnAnterior = host.shadowRoot.querySelector("#btn-anterior");
        expect(btnAnterior.disabled).to.be.true;
    });

    test("el botón Anterior retrocede, marca el paso previo EN_CURSO y sincroniza el stepper", async () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { idPaso: IDS_PASOS[0], nombre: "Triaje", estado: "COMPLETADO" },
                    { idPaso: IDS_PASOS[1], nombre: "Consulta Médica", estado: "COMPLETADO" },
                    { idPaso: IDS_PASOS[2], nombre: "Tratamiento", estado: "EN_CURSO" },
                    { idPaso: IDS_PASOS[3], nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        host.shadowRoot.querySelector("#btn-anterior").click();
        await new Promise((r) => setTimeout(r, 50));

        expect(guardarPasoStub.callCount).to.equal(2);
        expect(guardarPasoStub.firstCall.args[0]).to.equal(IDS_PASOS[2]);
        expect(guardarPasoStub.firstCall.args[1].estadoPaso).to.equal("PENDIENTE");
        expect(guardarPasoStub.secondCall.args[0]).to.equal(IDS_PASOS[1]);
        expect(guardarPasoStub.secondCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(1);
    });

    test("Guardar y Avanzar completa el paso actual, activa el siguiente y permanece en la vista", async () => {
        const cie10 = host.shadowRoot.querySelector("#cie10-busqueda");
        cie10.seleccionados = ["J00"];
        host.shadowRoot.querySelector("#notas").value = "Paciente estable";
        host.shadowRoot.querySelector("#plan").value = "Reposo";
        host.shadowRoot.querySelector("#btn-siguiente").click();

        await new Promise((r) => setTimeout(r, 50));

        const payload = guardarPasoStub.firstCall.args[1];
        expect(guardarPasoStub.callCount).to.equal(2);
        expect(guardarPasoStub.firstCall.args[0]).to.equal(IDS_PASOS[1]);
        expect(payload).to.have.all.keys(["estadoPaso", "valor"]);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(guardarPasoStub.secondCall.args[0]).to.equal(IDS_PASOS[2]);
        expect(guardarPasoStub.secondCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(JSON.parse(payload.valor)).to.deep.equal({
            notas: "Paciente estable",
            diagnostico: ["J00"],
            plan: "Reposo"
        });
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(2);
        expect(navigateStub.called).to.be.false;
    });

    test("_crearPayloadPaso sólo incluye estadoPaso y valor", () => {
        const payload = host._crearPayloadPaso(1, "COMPLETADO", {
            notasConsulta: "Notas",
            diagnostico: "Dx",
            planTratamiento: "Plan"
        });

        expect(payload).to.have.all.keys(["estadoPaso", "valor"]);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(JSON.parse(payload.valor)).to.deep.equal({
            notas: "Notas",
            diagnostico: "Dx",
            plan: "Plan"
        });
    });

    test("el último paso muestra Finalizar Consulta y navega al dashboard con fecha de fin", async () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { idPaso: IDS_PASOS[0], nombre: "Triaje", estado: "COMPLETADO" },
                    { idPaso: IDS_PASOS[1], nombre: "Consulta Médica", estado: "COMPLETADO" },
                    { idPaso: IDS_PASOS[2], nombre: "Tratamiento", estado: "COMPLETADO" },
                    { idPaso: IDS_PASOS[3], nombre: "Cierre", estado: "EN_CURSO" }
                ]
            }
        });

        expect(host.shadowRoot.querySelector("#btn-siguiente")).to.be.null;
        const btnFinalizar = host.shadowRoot.querySelector("#btn-finalizar");
        assert.isNotNull(btnFinalizar, "Debe existir #btn-finalizar en el último paso");

        host.shadowRoot.querySelector("#notas").value = "Alta indicada";
        btnFinalizar.click();

        await new Promise((r) => setTimeout(r, 50));

        const payload = guardarPasoStub.firstCall.args[1];
        expect(guardarPasoStub.calledOnce).to.be.true;
        expect(guardarPasoStub.firstCall.args[0]).to.equal(IDS_PASOS[3]);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(JSON.parse(payload.valor)).to.deep.equal({
            notas: "Alta indicada",
            diagnostico: [],
            plan: ""
        });
        expect(host._consulta.fechaFin).to.be.a("string");
        expect(window.location.hash).to.equal("#dashboard");
    });

    test("inicia en el primer paso cuando el backend no indica uno activo", () => {
        store.setState({ consultaActiva: { idConsulta: 55 } });
        expect(host._pasoActivo).to.equal(0);
        expect(host.shadowRoot.querySelector("#btn-anterior").disabled).to.be.true;
    });

    test("usa la secuencia y los identificadores del backend aunque sus nombres sean distintos", async () => {
        store.setState({ consultaActiva: {
            idConsulta: 55,
            consultaProcedimientoPasos: [
                { idPaso: "00000000-0000-4000-8000-000000000092", nombre: "Indicaciones", orden: 2, estado: "PENDIENTE" },
                { idPaso: "00000000-0000-4000-8000-000000000091", nombre: "Exploración", orden: 1, estado: "EN_CURSO" }
            ]
        } });
        expect(host.shadowRoot.querySelector("stepper-progreso").etapas)
            .to.deep.equal(["Exploración", "Indicaciones"]);
        host.cargarDatosFormulario({ notasConsulta: "Estable" });
        await host._avanzarPaso();
        expect(guardarPasoStub.firstCall.args[0]).to.equal("00000000-0000-4000-8000-000000000091");
        expect(guardarPasoStub.secondCall.args[0]).to.equal("00000000-0000-4000-8000-000000000092");
        expect(host.shadowRoot.querySelector("#btn-finalizar")).not.to.be.null;
        expect(store.getState().consultaActiva.pasoActivo).to.equal(1);
    });

    test("seleccionar un paso recupera valor JSON sin copiar los datos de otro paso", () => {
        const diagnostico = { codigo: "J00", nombre: "Rinofaringitis" };
        store.setState({ consultaActiva: {
            idConsulta: 55,
            notasConsulta: "Estas notas globales no pertenecen al paso vacío",
            pasos: [
                { idPaso: 10, nombre: "Evaluación", estado: "EN_CURSO",
                    consulta_procedimiento_paso: { valor: JSON.stringify({ notas: "Control", diagnostico: [diagnostico], plan: "Reposo" }) } },
                { idPaso: 11, nombre: "Indicaciones", estado: "PENDIENTE" }
            ]
        } });
        expect(host.obtenerDatosFormulario()).to.deep.equal({
            notasConsulta: "Control", diagnostico: [diagnostico], diagnosticos: [diagnostico], planTratamiento: "Reposo"
        });
        host._seleccionarPaso(1);
        expect(host.obtenerDatosFormulario()).to.deep.equal({
            notasConsulta: "", diagnostico: [], diagnosticos: [], planTratamiento: ""
        });
        expect(host.shadowRoot.querySelector("#form-clinico").dataset.estadoPaso).to.equal("PENDIENTE");
        expect(guardarPasoStub.called).to.be.false;
        host._seleccionarPaso(0);
        expect(host.obtenerDatosFormulario().diagnosticos).to.deep.equal([diagnostico]);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Control");
    });

    test("conserva los borradores y las eliminaciones al cambiar de paso", () => {
        host.cargarDatosFormulario({ notasConsulta: "Borrador", planTratamiento: "" });
        host.shadowRoot.querySelector("#cie10-busqueda").seleccionados = ["J00"];
        host._seleccionarPaso(2);
        host._seleccionarPaso(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Borrador");
        expect(host.obtenerDatosFormulario().diagnosticos).to.deep.equal(["J00"]);
        host.shadowRoot.querySelector("#cie10-busqueda").seleccionados = [];
        host.cargarDatosFormulario({ notasConsulta: "" });
        host._seleccionarPaso(2);
        host._seleccionarPaso(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("");
        expect(host.obtenerDatosFormulario().diagnosticos).to.deep.equal([]);
    });

    test("un fallo de guardado conserva las notas y no activa el siguiente paso", async () => {
        guardarPasoStub.rejects(new Error("Sin conexión"));
        host.cargarDatosFormulario({ notasConsulta: "No perder" });
        await host._avanzarPaso();
        expect(guardarPasoStub.calledOnce).to.be.true;
        expect(host._pasoActivo).to.equal(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("No perder");
        expect(navigateStub.called).to.be.false;
        expect(host.shadowRoot.querySelector("#btn-siguiente").disabled).to.be.false;
    });

    test("si falla la activación muestra el paso ya guardado y permite reintentar", async () => {
        guardarPasoStub.onSecondCall().rejects(new Error("No se pudo activar"));
        host.cargarDatosFormulario({ notasConsulta: "Guardado" });
        await host._avanzarPaso();
        expect(host._pasoActivo).to.equal(1);
        expect(host.shadowRoot.querySelector("stepper-progreso").estados[1]).to.equal("COMPLETADO");
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Guardado");
        expect(navigateStub.called).to.be.false;
    });

    test("retroceder persiste también las notas del paso que se abandona", async () => {
        host.cargarDatosFormulario({ notasConsulta: "Evolución", planTratamiento: "Reposo" });
        await host._retrocederPaso();
        expect(JSON.parse(guardarPasoStub.firstCall.args[1].valor))
            .to.deep.equal({ notas: "Evolución", diagnostico: [], plan: "Reposo" });
        host._seleccionarPaso(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Evolución");
    });

    test("permite guardar un paso que solamente contiene diagnóstico CIE-10", async () => {
        host.shadowRoot.querySelector("#cie10-busqueda").seleccionados = ["J00"];
        await host._avanzarPaso();
        expect(guardarPasoStub.callCount).to.equal(2);
        expect(JSON.parse(guardarPasoStub.firstCall.args[1].valor).diagnostico)
            .to.deep.equal(["J00"]);
    });

    test("refresca la consulta del backend aunque ya exista en el store", async () => {
        const obtener = sinon.stub(consultaService, "findById").resolves({
            idConsulta: 55,
            pasos: [{ idPaso: 100, nombre: "Revisión final", estado: "EN_CURSO", valor: { notas: "Desde backend" } }]
        });
        try {
            await host._cargarConsultaPorId("55");
            expect(obtener.calledOnceWith("55")).to.be.true;
            expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Desde backend");
            expect(host.shadowRoot.querySelector("#lista-examenes").getAttribute("id-paso")).to.equal("100");
        } finally {
            obtener.restore();
        }
    });

    test("no cierra ni redirige si falla el guardado del último paso", async () => {
        store.setState({ consultaActiva: { idConsulta: 55, pasos: [
            { idPaso: 100, nombre: "Cierre", estado: "EN_CURSO" }
        ] } });
        guardarPasoStub.rejects(new Error("Error de servidor"));
        host.cargarDatosFormulario({ notasConsulta: "Alta pendiente" });
        await host._finalizarConsulta();
        expect(host._consulta.fechaFin).to.be.undefined;
        expect(navigateStub.called).to.be.false;
    });

    // ── Aviso sin consulta activa ────────────────────────────────────────────

    test("muestra aviso accesible cuando no hay consulta activa en el store", () => {
        store.setState({ consultaActiva: null, consultaSeleccionada: null, consulta: null });

        const sinConsulta = document.createElement("atencion-consulta-view");
        document.body.appendChild(sinConsulta);

        const aviso = sinConsulta.shadowRoot.querySelector(".aviso-sin-consulta");
        assert.isNotNull(aviso, "Debe renderizar .aviso-sin-consulta");
        expect(aviso.getAttribute("role")).to.equal("status");

        sinConsulta.parentNode.removeChild(sinConsulta);
    });

    // ── Sincronización con el paso activo del backend ─────────────────────────

    test("elige el primer PENDIENTE aunque exista un EN_CURSO posterior", () => {
        store.setState({ consultaActiva: { idConsulta: 55, pasos: [
            { idPaso: 1, nombre: "Evaluación", estado: "PENDIENTE" },
            { idPaso: 2, nombre: "Cierre", estado: "EN_CURSO" }
        ] } });
        expect(host._pasoActivo).to.equal(0);
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(0);
    });

    test("consulta.pasos tiene prioridad sobre listas alternativas desactualizadas", () => {
        store.setState({ consultaActiva: { idConsulta: 55,
            pasos: [{ nombre: "Paso vigente", estado: "PENDIENTE" }],
            pasosClinicos: [{ nombre: "Paso antiguo", estado: "EN_CURSO" }]
        } });
        expect(host.shadowRoot.querySelector("stepper-progreso").etapas).to.deep.equal(["Paso vigente"]);
    });

    test("renderiza los tres campos y guarda el diagnóstico escrito dentro del JSON valor", async () => {
        expect(host.shadowRoot.querySelector("textarea#notas")).not.to.be.null;
        expect(host.shadowRoot.querySelector("textarea#plan")).not.to.be.null;
        const diagnostico = host.shadowRoot.querySelector("input#diagnostico");
        expect(diagnostico).not.to.be.null;
        host.cargarDatosFormulario({ notasConsulta: "Control", diagnostico: "Cefalea", planTratamiento: "Seguimiento" });
        await host._avanzarPaso();
        const payload = guardarPasoStub.firstCall.args[1];
        expect(payload.valor).to.be.a("string");
        expect(JSON.parse(payload.valor)).to.deep.equal({ notas: "Control", diagnostico: "Cefalea", plan: "Seguimiento" });
    });

    test("los pasos completados se consultan en lectura y se puede retomar el borrador activo", async () => {
        store.setState({ consultaActiva: { idConsulta: 55, pasos: [
            { idPaso: 1, nombre: "Triaje", estado: "COMPLETADO",
                valor: JSON.stringify({ notas: "Signos registrados", diagnostico: "Control previo", plan: "Evaluar" }) },
            { idPaso: 2, nombre: "Atención", estado: "EN_CURSO" },
            { idPaso: 3, nombre: "Cierre", estado: "PENDIENTE" }
        ] } });
        host.cargarDatosFormulario({ notasConsulta: "Borrador actual", diagnostico: "En evaluación" });
        host.shadowRoot.querySelector("stepper-progreso").shadowRoot
            .querySelector('[data-indice="0"] button').click();
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Signos registrados");
        expect(host.obtenerDatosFormulario().diagnostico).to.equal("Control previo");
        for (const selector of ["#notas", "#diagnostico", "#plan"]) {
            expect(host.shadowRoot.querySelector(selector).readOnly).to.be.true;
        }
        expect(host.shadowRoot.querySelector("#cie10-busqueda").hasAttribute("inert")).to.be.true;
        expect(host.shadowRoot.querySelector("#lista-examenes").hasAttribute("inert")).to.be.true;
        expect(host.shadowRoot.querySelector("#btn-siguiente").disabled).to.be.true;
        await host._avanzarPaso();
        await host._retrocederPaso();
        expect(guardarPasoStub.called).to.be.false;
        expect(host._consulta.pasos[0].estado).to.equal("COMPLETADO");
        host.shadowRoot.querySelector("#btn-retomar").click();
        expect(host._pasoActivo).to.equal(1);
        expect(host.shadowRoot.querySelector("#notas").readOnly).to.be.false;
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Borrador actual");
        expect(host.obtenerDatosFormulario().diagnostico).to.equal("En evaluación");
    });

    test("el stepper impide saltar a pasos pendientes posteriores", () => {
        host.shadowRoot.querySelector("stepper-progreso").shadowRoot
            .querySelector('[data-indice="3"] button').click();
        expect(host._pasoActivo).to.equal(1);
        expect(host.shadowRoot.querySelector("#btn-finalizar")).to.be.null;
        expect(guardarPasoStub.called).to.be.false;
    });

    test("avanzar envía GET y PATCH con valor JSON para cada paso", async () => {
        guardarPasoStub.restore();
        const listaExamenes = host.shadowRoot.querySelector("#lista-examenes");
        const listarExamenesStub = sinon.stub(listaExamenes.ordenExamenService, "listarExamenesPorPaso").resolves([]);
        const fetchStub = sinon.stub(window, "fetch").callsFake(async (url, options) => {
            if (options.method === "GET") {
                return {
                    ok: true,
                    status: 200,
                    headers: new Headers({ ETag: '"v-1"' }),
                    text: async () => "{}"
                };
            }
            return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
        });
        try {
            host.cargarDatosFormulario({ notasConsulta: "Evolución", diagnostico: "Control", planTratamiento: "Reposo" });
            await host._avanzarPaso();
            expect(fetchStub.callCount).to.equal(4);
            const solicitudes = fetchStub.getCalls().map((llamada) => llamada.args[1]);
            expect(solicitudes.map((s) => s.method)).to.deep.equal(["GET", "PATCH", "GET", "PATCH"]);
            expect(solicitudes[1].headers.get("If-Match")).to.equal('"v-1"');
            const primero = JSON.parse(solicitudes[1].body);
            expect(primero).to.have.all.keys(["estadoPaso", "valor"]);
            expect(primero.estadoPaso).to.equal("COMPLETADO");
            expect(JSON.parse(primero.valor)).to.deep.equal({
                notas: "Evolución", diagnostico: "Control", plan: "Reposo"
            });
            const segundo = JSON.parse(solicitudes[3].body);
            expect(segundo.estadoPaso).to.equal("EN_CURSO");
            expect(segundo.valor).to.be.a("string");
            expect(host._pasoActivo).to.equal(2);
            expect(navigateStub.called).to.be.false;
        } finally {
            fetchStub.restore();
            listarExamenesStub.restore();
            guardarPasoStub = sinon.stub(consultaProcedimientoService, "guardarPaso").resolves({ ok: true });
        }
    });

    test("detecta el paso EN_CURSO y sincroniza el stepper", () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { nombre: "Triaje", estado: "COMPLETADO" },
                    { nombre: "Consulta Médica", estado: "EN_CURSO" },
                    { nombre: "Tratamiento", estado: "PENDIENTE" },
                    { nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        const stepper = host.shadowRoot.querySelector("stepper-progreso");
        expect(stepper.pasoActivo).to.equal(1);
    });

    test("detecta el primer paso pendiente cuando no hay ninguno EN_CURSO", () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { nombre: "Triaje", estado: { nombre: "Completado" } },
                    { nombre: "Consulta Médica", estado: "COMPLETADO" },
                    { nombre: "Tratamiento", estado: "PENDIENTE" },
                    { nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        const stepper = host.shadowRoot.querySelector("stepper-progreso");
        expect(stepper.pasoActivo).to.equal(2);
    });

    test("carga en el formulario los datos guardados en el paso activo", () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { nombre: "Triaje", estado: "COMPLETADO" },
                    { nombre: "Consulta Médica", estado: "COMPLETADO" },
                    {
                        nombre: "Tratamiento",
                        estado: "EN_CURSO",
                        datos: {
                            notasConsulta: "Evolución favorable",
                            planTratamiento: "Continuar tratamiento",
                            diagnosticos: ["J00"]
                        }
                    },
                    { nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        const notas = host.shadowRoot.querySelector("#notas");
        const plan = host.shadowRoot.querySelector("#plan");

        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(2);
        expect(notas.value).to.equal("Evolución favorable");
        expect(plan.value).to.equal("Continuar tratamiento");
    });

    // ── HU4: Encabezado con nombre, edad y documento del paciente ─────────────

    test("el encabezado muestra el nombre del paciente cuando está disponible", () => {
        store.setState({ consultaActiva: {
            idConsulta: 55,
            paciente: { nombres: "María", apellidos: "López", fechaNacimiento: "1990-06-15" }
        } });
        const cabecera = host.shadowRoot.querySelector(".cabecera");
        expect(cabecera.textContent).to.include("María");
        expect(cabecera.textContent).to.include("López");
    });

    test("el encabezado muestra la edad calculada desde fechaNacimiento", () => {
        // Usar una fecha fija para verificar el cálculo
        const hoy = new Date();
        const anioNac = hoy.getFullYear() - 30;
        const mesNac = String(hoy.getMonth() + 1).padStart(2, "0");
        const diaNac = String(hoy.getDate()).padStart(2, "0");
        const fechaNacimiento = `${anioNac}-${mesNac}-${diaNac}`;

        store.setState({ consultaActiva: {
            idConsulta: 55,
            paciente: { nombres: "Carlos", apellidos: "Pérez", fechaNacimiento }
        } });
        const cabecera = host.shadowRoot.querySelector(".cabecera");
        expect(cabecera.textContent).to.include("30 años");
    });

    test("_calcularEdad devuelve null para fechas inválidas", () => {
        expect(host._calcularEdad(null)).to.be.null;
        expect(host._calcularEdad("")).to.be.null;
        expect(host._calcularEdad("no-es-fecha")).to.be.null;
    });

    test("_calcularEdad calcula correctamente la edad en años", () => {
        const hoy = new Date();
        const anio = hoy.getFullYear() - 25;
        const mes = String(hoy.getMonth() + 1).padStart(2, "0");
        const dia = String(hoy.getDate()).padStart(2, "0");
        expect(host._calcularEdad(`${anio}-${mes}-${dia}`)).to.equal(25);
    });

    test("el encabezado muestra el documento del paciente", () => {
        store.setState({ consultaActiva: {
            idConsulta: 55,
            paciente: {
                nombres: "Ana",
                apellidos: "García",
                fechaNacimiento: "1985-03-20",
                numeroDocumento: "12345678"
            }
        } });
        const cabecera = host.shadowRoot.querySelector(".cabecera");
        expect(cabecera.textContent).to.include("12345678");
    });

    test("_documentoPaciente extrae el documento desde múltiples estructuras", () => {
        expect(host._documentoPaciente({ paciente: { numeroDocumento: "ABC123" } })).to.equal("ABC123");
        expect(host._documentoPaciente({ paciente: { documento: "DOC456" } })).to.equal("DOC456");
        expect(host._documentoPaciente({ paciente: { dui: "DUI789" } })).to.equal("DUI789");
        expect(host._documentoPaciente(null)).to.equal("");
        expect(host._documentoPaciente({ paciente: {} })).to.equal("");
    });

    test("_fechaNacimientoPaciente extrae fecha desde múltiples estructuras", () => {
        expect(host._fechaNacimientoPaciente({ paciente: { fechaNacimiento: "1990-01-01" } })).to.equal("1990-01-01");
        expect(host._fechaNacimientoPaciente({ paciente: { birthDate: "1990-01-01" } })).to.equal("1990-01-01");
        expect(host._fechaNacimientoPaciente(null)).to.equal("");
    });

    // ── HU4: Botón "Guardar Notas" ────────────────────────────────────────────

    test("renderiza el botón #btn-guardar-notas en pasos no completados", () => {
        const btn = host.shadowRoot.querySelector("#btn-guardar-notas");
        assert.isNotNull(btn, "Debe existir #btn-guardar-notas");
        expect(btn.type).to.equal("button");
        expect(btn.textContent).to.include("Guardar Notas");
    });

    test("#btn-guardar-notas no existe en modo solo lectura (paso completado)", () => {
        store.setState({ consultaActiva: { idConsulta: 55, pasos: [
            { idPaso: IDS_PASOS[0], nombre: "Triaje", estado: "COMPLETADO",
                valor: JSON.stringify({ notas: "Triaje OK", diagnostico: [], plan: "" }) },
            { idPaso: IDS_PASOS[1], nombre: "Consulta Médica", estado: "EN_CURSO" }
        ] } });
        // Navegar al paso completado (modo lectura)
        host._seleccionarPaso(0);
        expect(host.shadowRoot.querySelector("#btn-guardar-notas")).to.be.null;
    });

    test("#btn-guardar-notas llama a guardarPaso con EN_CURSO sin cambiar de paso", async () => {
        host.shadowRoot.querySelector("#notas").value = "Notas de seguimiento";
        host.shadowRoot.querySelector("#plan").value = "Paracetamol";

        host.shadowRoot.querySelector("#btn-guardar-notas").click();
        await new Promise((r) => setTimeout(r, 60));

        expect(guardarPasoStub.calledOnce).to.be.true;
        expect(guardarPasoStub.firstCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(host._pasoActivo).to.equal(1); // No avanzó
    });

    test("#btn-guardar-notas despacha 'consulta-guardada' con soloNotas: true", async () => {
        let eventoRecibido = null;
        host.addEventListener("consulta-guardada", (e) => { eventoRecibido = e.detail; });

        host.shadowRoot.querySelector("#notas").value = "Solo guardar esto";
        host.shadowRoot.querySelector("#btn-guardar-notas").click();
        await new Promise((r) => setTimeout(r, 60));

        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.soloNotas).to.be.true;
        expect(eventoRecibido.pasoActivo).to.equal(1);
    });

    test("#btn-guardar-notas está deshabilitado mientras guarda", async () => {
        let resolvePaso;
        guardarPasoStub.callsFake(() => new Promise((res) => { resolvePaso = res; }));

        host.shadowRoot.querySelector("#notas").value = "Guardando...";
        host.shadowRoot.querySelector("#btn-guardar-notas").click();

        await new Promise((r) => setTimeout(r, 10));
        expect(host.shadowRoot.querySelector("#btn-guardar-notas").disabled).to.be.true;

        resolvePaso({ ok: true });
        await new Promise((r) => setTimeout(r, 30));
        expect(host.shadowRoot.querySelector("#btn-guardar-notas").disabled).to.be.false;
    });

    test("#btn-guardar-notas sin datos muestra error y no llama a guardarPaso", async () => {
        host.shadowRoot.querySelector("#btn-guardar-notas").click();
        await new Promise((r) => setTimeout(r, 50));

        expect(guardarPasoStub.called).to.be.false;
        const errorNotas = host.shadowRoot.querySelector("#error-notas");
        expect(errorNotas.textContent.trim()).to.have.length.greaterThan(0);
    });

    test("_guardarNotas conserva el paso activo y guarda como EN_CURSO", async () => {
        host.cargarDatosFormulario({ notasConsulta: "Seguimiento", planTratamiento: "Ibuprofeno" });
        await host._guardarNotas();

        expect(guardarPasoStub.calledOnce).to.be.true;
        expect(guardarPasoStub.firstCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(host._pasoActivo).to.equal(1);
        expect(navigateStub.called).to.be.false;
    });

    test("_guardarNotas no actúa en modo solo lectura", async () => {
        store.setState({ consultaActiva: { idConsulta: 55, pasos: [
            { idPaso: IDS_PASOS[0], nombre: "Triaje", estado: "COMPLETADO",
                valor: JSON.stringify({ notas: "Registrado", diagnostico: [], plan: "" }) },
            { idPaso: IDS_PASOS[1], nombre: "Consulta Médica", estado: "EN_CURSO" }
        ] } });
        host._seleccionarPaso(0);
        expect(host._soloLectura).to.be.true;

        await host._guardarNotas();
        expect(guardarPasoStub.called).to.be.false;
    });

    test("sin conexión deshabilita guardar, avanzar y asignar con aviso y conserva lo escrito", () => {
        const notas = host.shadowRoot.querySelector("#notas");
        notas.value = "Borrador sin guardar";
        notas.dispatchEvent(new Event("input", { bubbles: true }));

        store.setState({ online: false });

        const aviso = host.shadowRoot.querySelector("#aviso-offline");
        assert.isNotNull(aviso);
        expect(aviso.hidden).to.be.false;
        expect(aviso.textContent).to.contain("Sin conexión");
        expect(host.shadowRoot.querySelector("#btn-guardar-notas").disabled).to.be.true;
        expect(host.shadowRoot.querySelector("#btn-siguiente").disabled).to.be.true;
        expect(host.shadowRoot.querySelector("#btn-anterior").disabled).to.be.true;
        expect(host.shadowRoot.querySelector("#stepper-flujo").hasAttribute("inert")).to.be.true;
        expect(host.shadowRoot.querySelector("#cie10-busqueda").hasAttribute("inert")).to.be.false;

        const lista = host.shadowRoot.querySelector("#lista-examenes");
        expect(lista.hasAttribute("sin-conexion")).to.be.true;
        expect(lista.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;
        expect(notas.value).to.equal("Borrador sin guardar");
    });

    test("al volver la red se reactivan las acciones sin borrar lo escrito", () => {
        const notas = host.shadowRoot.querySelector("#notas");
        notas.value = "Borrador pendiente";

        store.setState({ online: false });
        store.setState({ online: true });

        expect(host.shadowRoot.querySelector("#aviso-offline")).to.be.null;
        expect(host.shadowRoot.querySelector("#btn-guardar-notas").disabled).to.be.false;
        expect(host.shadowRoot.querySelector("#btn-siguiente").disabled).to.be.false;
        expect(host.shadowRoot.querySelector("#stepper-flujo").hasAttribute("inert")).to.be.false;
        expect(host.shadowRoot.querySelector("#lista-examenes").hasAttribute("sin-conexion")).to.be.false;
        expect(notas.value).to.equal("Borrador pendiente");
    });

    test("sin conexión no se persiste aunque se invoquen las acciones directamente", async () => {
        const notas = host.shadowRoot.querySelector("#notas");
        notas.value = "No enviar";
        store.setState({ online: false });

        host._alEnviarFormulario();
        await host._guardarNotas();
        await host._avanzarPaso();
        await host._retrocederPaso();
        await host._finalizarConsulta();

        expect(guardarPasoStub.called).to.be.false;
        expect(notas.value).to.equal("No enviar");
    });
});
