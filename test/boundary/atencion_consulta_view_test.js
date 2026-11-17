import { AtencionConsultaView } from "../../src/js/boundary/vistas/atencion_consulta_view.js";
import store from "../../src/js/store.js";
import * as routerModule from "../../src/js/router.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import { tipoExamenService } from "../../src/js/control/tipo_examen_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AtencionConsultaView (unitaria)", () => {
    let host;
    let navigateStub;
    let registrarAtencionStub;
    let tipoExamenStub;
    let estadoOriginal;

    const seleccionarPaso = (indice) => host.shadowRoot.querySelector("stepper-progreso")
        .shadowRoot.querySelector(`[data-indice="${indice}"] button`).click();

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
        procedimientos: [{ nombre: "Control General" }]
    };

    setup(() => {
        estadoOriginal = { ...store.getState() };
        navigateStub = sinon.stub(routerModule.router, "navigate");

        registrarAtencionStub = sinon
            .stub(consultaService, "registrarAtencion")
            .resolves({ ok: true });

        tipoExamenStub = sinon
            .stub(tipoExamenService, "findRange")
            .resolves({ items: [] });

        store.setState({
            token: "fake-jwt",
            consultaActiva: structuredClone(consultaFicticia)
        });

        host = document.createElement("atencion-consulta-view");
        document.body.appendChild(host);
    });

    teardown(() => {
        host?.remove();
        navigateStub?.restore();
        registrarAtencionStub?.restore();
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

    test("renderiza textarea#notas-consulta con name='notasConsulta'", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas-consulta");
        assert.isNotNull(ta, "Debe existir textarea#notas-consulta");
        expect(ta.name).to.equal("notasConsulta");
    });

    test("textarea de Notas tiene un <label> enlazado mediante for/id", () => {
        const label = host.shadowRoot.querySelector("label[for='notas-consulta']");
        assert.isNotNull(label, "Debe existir label[for='notas-consulta']");
        expect(label.textContent.trim()).to.match(/Notas de la Consulta/i);
    });

    test("textarea de Notas tiene un placeholder descriptivo no vacío", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas-consulta");
        expect(ta.placeholder).to.have.length.greaterThan(10);
    });

    test("textarea de Notas tiene aria-describedby apuntando al contador y al span de error", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas-consulta");
        expect(ta.getAttribute("aria-describedby")).to.include("contador-notas");
        expect(ta.getAttribute("aria-describedby")).to.include("error-notas");
    });

    test("el contador de Notas inicia en '0 / 2000'", () => {
        const contador = host.shadowRoot.querySelector("#contador-notas");
        assert.isNotNull(contador);
        expect(contador.textContent.trim()).to.equal("0 / 2000");
    });

    test("el contador de Notas se actualiza al escribir en el textarea", () => {
        const ta = host.shadowRoot.querySelector("textarea#notas-consulta");
        ta.value = "Texto de prueba";
        ta.dispatchEvent(new Event("input", { bubbles: true }));

        const contador = host.shadowRoot.querySelector("#contador-notas");
        expect(contador.textContent.trim()).to.equal("15 / 2000");
    });

    // ── Campo: Plan de Tratamiento ───────────────────────────────────────────

    test("renderiza textarea#plan-tratamiento con name='planTratamiento'", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan-tratamiento");
        assert.isNotNull(ta, "Debe existir textarea#plan-tratamiento");
        expect(ta.name).to.equal("planTratamiento");
    });

    test("textarea de Plan tiene un <label> enlazado mediante for/id", () => {
        const label = host.shadowRoot.querySelector("label[for='plan-tratamiento']");
        assert.isNotNull(label, "Debe existir label[for='plan-tratamiento']");
        expect(label.textContent.trim()).to.match(/Plan de Tratamiento/i);
    });

    test("textarea de Plan tiene un placeholder descriptivo no vacío", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan-tratamiento");
        expect(ta.placeholder).to.have.length.greaterThan(10);
    });

    test("el contador de Plan inicia en '0 / 2000'", () => {
        const contador = host.shadowRoot.querySelector("#contador-plan");
        assert.isNotNull(contador);
        expect(contador.textContent.trim()).to.equal("0 / 2000");
    });

    test("el contador de Plan se actualiza al escribir en el textarea", () => {
        const ta = host.shadowRoot.querySelector("textarea#plan-tratamiento");
        ta.value = "ABC";
        ta.dispatchEvent(new Event("input", { bubbles: true }));

        const contador = host.shadowRoot.querySelector("#contador-plan");
        expect(contador.textContent.trim()).to.equal("3 / 2000");
    });

    // ── obtenerDatosFormulario ────────────────────────────────────────────────

    test("obtenerDatosFormulario() devuelve objeto con notasConsulta y planTratamiento vacíos por defecto", () => {
        const datos = host.obtenerDatosFormulario();
        expect(datos).to.have.keys(["notasConsulta", "planTratamiento", "diagnosticos"]);
        expect(datos.notasConsulta).to.equal("");
        expect(datos.planTratamiento).to.equal("");
    });

    test("obtenerDatosFormulario() devuelve los valores actuales de los campos recortados", () => {
        const taNotas = host.shadowRoot.querySelector("#notas-consulta");
        const taPlan = host.shadowRoot.querySelector("#plan-tratamiento");

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
        expect(btnSiguiente.textContent).to.include("Guardar y Avanzar al Siguiente Paso");
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
        expect(registrarAtencionStub.called).to.be.true;
    });

    test("en paso intermedio guarda y avanza al siguiente paso sin salir al dashboard", async () => {
        seleccionarPaso(1); // paso 1 de 4 (intermedio)
        host.shadowRoot.querySelector("#notas-consulta").value = "Notas paso intermedio";

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

        expect(registrarAtencionStub.called).to.be.true;
        expect(host._pasoActivo).to.equal(2);
        expect(navigateStub.calledWith("#dashboard")).to.be.false;
    });

    test("en el último paso muestra botón Finalizar Consulta y al enviar redirige a #dashboard", async () => {
        seleccionarPaso(3); // paso 3 de 4 (último paso)

        const btnFinalizar = host.shadowRoot.querySelector("#btn-finalizar");
        assert.isNotNull(btnFinalizar, "Debe existir botón Finalizar en el último paso");
        expect(btnFinalizar.textContent).to.contain("Finalizar Consulta");

        host.shadowRoot.querySelector("#notas-consulta").value = "Notas de cierre";

        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 60));

        expect(registrarAtencionStub.called).to.be.true;
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
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

    test("enviar el formulario sin datos muestra error y no llama a registrarAtencion", async () => {
        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 50));

        expect(registrarAtencionStub.called).to.be.false;
        const errorNotas = host.shadowRoot.querySelector("#error-notas");
        expect(errorNotas.textContent.trim()).to.have.length.greaterThan(0);
    });

    test("enviar el formulario con datos llama a registrarAtencion y despacha 'consulta-guardada'", async () => {
        let eventoGuardado = null;
        host.addEventListener("consulta-guardada", (e) => { eventoGuardado = e.detail; });

        host.shadowRoot.querySelector("#notas-consulta").value = "Fiebre 38°C, tos seca";
        host.shadowRoot.querySelector("#plan-tratamiento").value = "Reposo y paracetamol";

        host.shadowRoot.querySelector("form#form-clinico").dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
        );

        await new Promise((r) => setTimeout(r, 100));

        expect(registrarAtencionStub.callCount).to.equal(2);
        expect(registrarAtencionStub.firstCall.args[0]).to.equal(55);
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
                    { nombre: "Triaje", estado: "COMPLETADO" },
                    { nombre: "Consulta Médica", estado: "COMPLETADO" },
                    { nombre: "Tratamiento", estado: "EN_CURSO" },
                    { nombre: "Cierre", estado: "PENDIENTE" }
                ]
            }
        });

        host.shadowRoot.querySelector("#btn-anterior").click();
        await new Promise((r) => setTimeout(r, 50));

        expect(registrarAtencionStub.callCount).to.equal(2);
        expect(registrarAtencionStub.firstCall.args[1].paso.indice).to.equal(2);
        expect(registrarAtencionStub.firstCall.args[1].estadoPaso).to.equal("PENDIENTE");
        expect(registrarAtencionStub.secondCall.args[1].paso.indice).to.equal(1);
        expect(registrarAtencionStub.secondCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(1);
    });

    test("Guardar y Avanzar completa el paso actual, activa el siguiente y permanece en la vista", async () => {
        const cie10 = host.shadowRoot.querySelector("#cie10-busqueda");
        cie10.seleccionados = ["J00"];
        host.shadowRoot.querySelector("#notas-consulta").value = "Paciente estable";
        host.shadowRoot.querySelector("#plan-tratamiento").value = "Reposo";
        host.shadowRoot.querySelector("#btn-siguiente").click();

        await new Promise((r) => setTimeout(r, 50));

        const payload = registrarAtencionStub.firstCall.args[1];
        expect(registrarAtencionStub.callCount).to.equal(2);
        expect(payload.paso.indice).to.equal(1);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(registrarAtencionStub.secondCall.args[1].estadoPaso).to.equal("EN_CURSO");
        expect(registrarAtencionStub.secondCall.args[1].indicePaso).to.equal(2);
        expect(payload.consulta_procedimiento_paso.valor).to.deep.equal({
            notas: "Paciente estable",
            diagnostico: ["J00"],
            plan: "Reposo"
        });
        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(2);
        expect(navigateStub.called).to.be.false;
    });

    test("el último paso muestra Finalizar Consulta y navega al dashboard con fecha de fin", async () => {
        store.setState({
            consultaActiva: {
                ...consultaFicticia,
                pasos: [
                    { nombre: "Triaje", estado: "COMPLETADO" },
                    { nombre: "Consulta Médica", estado: "COMPLETADO" },
                    { nombre: "Tratamiento", estado: "COMPLETADO" },
                    { nombre: "Cierre", estado: "EN_CURSO" }
                ]
            }
        });

        expect(host.shadowRoot.querySelector("#btn-siguiente")).to.be.null;
        const btnFinalizar = host.shadowRoot.querySelector("#btn-finalizar");
        assert.isNotNull(btnFinalizar, "Debe existir #btn-finalizar en el último paso");

        host.shadowRoot.querySelector("#notas-consulta").value = "Alta indicada";
        btnFinalizar.click();

        await new Promise((r) => setTimeout(r, 50));

        const payload = registrarAtencionStub.firstCall.args[1];
        expect(registrarAtencionStub.calledOnce).to.be.true;
        expect(payload.paso.indice).to.equal(3);
        expect(payload.estadoPaso).to.equal("COMPLETADO");
        expect(payload.consulta_procedimiento_paso.valor).to.deep.equal({
            notas: "Alta indicada",
            diagnostico: [],
            plan: ""
        });
        expect(payload.fechaFin).to.be.a("string");
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
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
                { idConsultaProcedimientoPaso: 92, nombre: "Indicaciones", orden: 2, estado: "PENDIENTE" },
                { idConsultaProcedimientoPaso: 91, nombre: "Exploración", orden: 1, estado: "EN_CURSO" }
            ]
        } });
        expect(host.shadowRoot.querySelector("stepper-progreso").etapas)
            .to.deep.equal(["Exploración", "Indicaciones"]);
        host.cargarDatosFormulario({ notasConsulta: "Estable" });
        await host._avanzarPaso();
        expect(registrarAtencionStub.firstCall.args[1].idPaso).to.equal(91);
        expect(registrarAtencionStub.secondCall.args[1].idPaso).to.equal(92);
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
            notasConsulta: "Control", diagnosticos: [diagnostico], planTratamiento: "Reposo"
        });
        host.shadowRoot.querySelector("stepper-progreso").shadowRoot
            .querySelector('[data-indice="1"] button').click();
        expect(host.obtenerDatosFormulario()).to.deep.equal({
            notasConsulta: "", diagnosticos: [], planTratamiento: ""
        });
        expect(host.shadowRoot.querySelector("#form-clinico").dataset.estadoPaso).to.equal("PENDIENTE");
        expect(registrarAtencionStub.called).to.be.false;
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
        registrarAtencionStub.rejects(new Error("Sin conexión"));
        host.cargarDatosFormulario({ notasConsulta: "No perder" });
        await host._avanzarPaso();
        expect(registrarAtencionStub.calledOnce).to.be.true;
        expect(host._pasoActivo).to.equal(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("No perder");
        expect(navigateStub.called).to.be.false;
        expect(host.shadowRoot.querySelector("#btn-siguiente").disabled).to.be.false;
    });

    test("si falla la activación muestra el paso ya guardado y permite reintentar", async () => {
        registrarAtencionStub.onSecondCall().rejects(new Error("No se pudo activar"));
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
        expect(registrarAtencionStub.firstCall.args[1].consulta_procedimiento_paso.valor)
            .to.deep.equal({ notas: "Evolución", diagnostico: [], plan: "Reposo" });
        host._seleccionarPaso(1);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal("Evolución");
    });

    test("permite guardar un paso que solamente contiene diagnóstico CIE-10", async () => {
        host.shadowRoot.querySelector("#cie10-busqueda").seleccionados = ["J00"];
        await host._avanzarPaso();
        expect(registrarAtencionStub.callCount).to.equal(2);
        expect(registrarAtencionStub.firstCall.args[1].consulta_procedimiento_paso.valor.diagnostico)
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
        registrarAtencionStub.rejects(new Error("Error de servidor"));
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

        const notas = host.shadowRoot.querySelector("#notas-consulta");
        const plan = host.shadowRoot.querySelector("#plan-tratamiento");

        expect(host.shadowRoot.querySelector("stepper-progreso").pasoActivo).to.equal(2);
        expect(notas.value).to.equal("Evolución favorable");
        expect(plan.value).to.equal("Continuar tratamiento");
    });
});
