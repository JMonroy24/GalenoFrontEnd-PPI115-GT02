import "../../src/js/boundary/vistas/dashboard_view.js";
import "../../src/js/boundary/vistas/busqueda_citas_view.js";
import "../../src/js/boundary/vistas/atencion_consulta_view.js";
import "../../src/js/boundary/vistas/login_view.js";
import "../../src/js/boundary/componentes/encabezado_app.js";
import "../../src/js/boundary/componentes/menu_lateral.js";
import { store } from "../../src/js/store.js";
import { Router } from "../../src/js/router.js";
import DefaultService from "../../src/js/control/default_service.js";
import { AuthService } from "../../src/js/control/auth_service.js";
import { Cie10Service } from "../../src/js/control/cie10_service.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import { tipoDocumentoService } from "../../src/js/control/tipo_documento_service.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Modernización: regresiones de interacción y responsividad", () => {
    let estadoAnterior;
    let rutaAnterior;
    let fixture;
    let fetchStub;
    let hoja;
    const cssUrl = new URL("../../src/recursos/estilos/principal.css", import.meta.url).href;
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
    const montar = (tag) => fixture.appendChild(document.createElement(tag));
    const diagnostico = { codigo: "A00", nombre: "Resultado anterior" };

    const cargarEstilos = async (host) => {
        const roots = [host.shadowRoot];
        for (let i = 0; i < roots.length; i++) {
            for (const elemento of roots[i].querySelectorAll("*")) {
                if (elemento.shadowRoot) roots.push(elemento.shadowRoot);
            }
        }
        await Promise.all(roots.flatMap((root) => [...root.querySelectorAll('link[rel="stylesheet"]')])
            .map((link) => new Promise((resolve, reject) => {
                if (link.href === cssUrl && link.sheet) { resolve(); return; }
                link.addEventListener("load", resolve, { once: true });
                link.addEventListener("error", () => reject(new Error("No se cargó el CSS de la prueba")), { once: true });
                link.href = cssUrl;
            })));
    };

    suiteSetup(async () => {
        hoja = document.createElement("link");
        hoja.rel = "stylesheet";
        hoja.href = cssUrl;
        const cargada = new Promise((resolve, reject) => {
            hoja.onload = resolve;
            hoja.onerror = reject;
        });
        document.head.appendChild(hoja);
        await cargada;
    });
    suiteTeardown(() => hoja.remove());

    setup(() => {
        estadoAnterior = store.getState();
        rutaAnterior = location.hash;
        history.replaceState(null, "", "#buscar-citas");
        store.setState({ online: true, usuario: null, token: null, roles: [],
            clinicaActiva: null, rolSeleccionado: null, consultaActiva: null,
            consultaSeleccionada: null, consulta: null });
        fixture = document.createElement("div");
        document.body.appendChild(fixture);
        fetchStub = sinon.stub(window, "fetch").callsFake(async () => new Response(
            JSON.stringify({ items: [], total: 0 }), { headers: { "Content-Type": "application/json" } }
        ));
    });
    teardown(() => {
        fixture.remove();
        sinon.restore();
        store.setState(estadoAnterior);
        history.replaceState(null, "", location.pathname + location.search + rutaAnterior);
    });

    test("borrar el texto invalida la petición CIE-10 aunque el stub ignore AbortSignal", async () => {
        const host = montar("auto-complete-cie10");
        const pendiente = Promise.withResolvers();
        host.servicio = { findRange: () => pendiente.promise };
        const busqueda = host._ejecutarBusqueda("anterior");
        const input = host.shadowRoot.querySelector("input");
        input.value = "";
        input.dispatchEvent(new Event("input"));
        pendiente.resolve({ items: [diagnostico] });
        await busqueda;
        expect(host.shadowRoot.querySelector("#lista-resultados").hidden).to.be.true;
        expect(input.getAttribute("aria-busy")).to.equal("false");
    });

    test("una nueva entrada invalida respuestas durante el debounce", async () => {
        const clock = sinon.useFakeTimers();
        const host = montar("auto-complete-cie10");
        const pendiente = Promise.withResolvers();
        host.servicio = { findRange: () => pendiente.promise };
        const busqueda = host._ejecutarBusqueda("anterior");
        const input = host.shadowRoot.querySelector("input");
        input.value = "nuevo";
        input.dispatchEvent(new Event("input"));
        pendiente.resolve({ items: [diagnostico] });
        await busqueda;
        expect(host.shadowRoot.querySelector("#lista-resultados").textContent).not.to.contain("Resultado anterior");
        host.remove();
        clock.restore();
    });

    test("desmontar y reconectar no permite que una búsqueda antigua reabra sugerencias", async () => {
        const host = montar("auto-complete-cie10");
        const pendiente = Promise.withResolvers();
        host.servicio = { findRange: () => pendiente.promise };
        const busqueda = host._ejecutarBusqueda("anterior");
        host.remove();
        fixture.appendChild(host);
        pendiente.resolve({ items: [diagnostico] });
        await busqueda;
        expect(host.shadowRoot.querySelector("#lista-resultados").hidden).to.be.true;
    });

    test("Enter durante composición IME no selecciona un diagnóstico", () => {
        const host = montar("auto-complete-cie10");
        host._resultados = [diagnostico];
        host._indiceActivo = 0;
        host._renderizarResultados([diagnostico], "A");
        host.shadowRoot.querySelector("input").dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true })
        );
        expect(host.seleccionados).to.deep.equal([]);
    });

    test("una búsqueda de citas pendiente no repuebla una vista reconectada", async () => {
        const pendiente = Promise.withResolvers();
        sinon.stub(consultaService, "buscarCitas").returns(pendiente.promise);
        const host = montar("busqueda-citas-view");
        const busqueda = host.buscar({});
        host.remove();
        fixture.appendChild(host);
        pendiente.resolve({ items: [{ idConsulta: 1 }], total: 1 });
        await busqueda;
        expect(host.shadowRoot.querySelector("#resultados").children.length).to.equal(0);
        expect(host.cargando).to.be.false;
    });

    test("los tipos de documento de una conexión anterior no sustituyen los actuales", async () => {
        const viejo = Promise.withResolvers();
        const nuevo = Promise.withResolvers();
        const listar = sinon.stub(tipoDocumentoService, "findRange");
        listar.onFirstCall().returns(viejo.promise);
        listar.onSecondCall().returns(nuevo.promise);
        const host = montar("buscador-tipo-documentos");
        host.remove();
        fixture.appendChild(host);
        nuevo.resolve({ items: [{ id: 2, nombre: "Actual" }] });
        await flush();
        viejo.resolve({ items: [{ id: 1, nombre: "Obsoleto" }] });
        await flush();
        expect(host.shadowRoot.querySelector("select").textContent).to.contain("Actual");
        expect(host.shadowRoot.querySelector("select").textContent).not.to.contain("Obsoleto");
    });

    test("el stepper mantiene el botón y el foco al actualizar los estados", () => {
        const host = montar("stepper-progreso");
        host.etapas = ["Recepción", "Evaluación", "Atención", "Finalización"];
        const boton = host.shadowRoot.querySelector("button");
        boton.focus();
        host.actualizar({ estados: ["COMPLETADO", "EN_CURSO", "PENDIENTE", "PENDIENTE"], pasoActivo: 1 });
        expect(host.shadowRoot.querySelector("button")).to.equal(boton);
        expect(host.shadowRoot.activeElement).to.equal(boton);
        expect(host.shadowRoot.querySelector('[aria-current="step"]').dataset.indice).to.equal("1");
    });

    test("asignar el mismo ID con otro tipo no pierde la selección de exámenes", async () => {
        const host = document.createElement("lista-examenes-asignables");
        host.ordenExamenService = { listarExamenesPorPaso: async () => [{ idExamen: 1, nombre: "Examen" }] };
        host.idConsulta = 1;
        host.idPaso = 2;
        host.setAttribute("id-procedimiento-paso", "def-2");
        fixture.appendChild(host);
        await flush();
        const input = host.shadowRoot.querySelector('input[type="checkbox"]');
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        host.idPaso = "2";
        host.idConsulta = "1";
        expect(host.obtenerSeleccionados()).to.deep.equal(["1"]);
        expect(input.checked).to.be.true;
    });

    test("los exámenes anteriores quedan bloqueados mientras carga un paso nuevo", async () => {
        const host = document.createElement("lista-examenes-asignables");
        const pendiente = Promise.withResolvers();
        const listar = sinon.stub();
        listar.onFirstCall().resolves([{ idExamen: 1, nombre: "Anterior" }]);
        listar.onSecondCall().returns(pendiente.promise);
        host.ordenExamenService = { listarExamenesPorPaso: listar };
        host.idConsulta = "consulta";
        host.idPaso = "primero";
        host.setAttribute("id-procedimiento-paso", "def-primero");
        fixture.appendChild(host);
        await flush();
        host.idPaso = "segundo";
        host.setAttribute("id-procedimiento-paso", "def-segundo");
        const input = host.shadowRoot.querySelector("input");
        expect(input.disabled).to.be.true;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(host.obtenerSeleccionados()).to.deep.equal([]);
        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;
        pendiente.resolve([{ idExamen: 2, nombre: "Vigente" }]);
        await flush();
        expect(host.shadowRoot.querySelector('input[value="2"]').disabled).to.be.false;
    });

    test("cancelar una petición en curso propaga el motivo a través de la señal compuesta", async () => {
        fetchStub.callsFake((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }));
        const controller = new AbortController();
        const motivo = new DOMException("Nueva búsqueda", "AbortError");
        const pendiente = new DefaultService("/consultas")._request(
            "http://localhost/consultas", { signal: controller.signal }
        );
        controller.abort(motivo);
        let error;
        try { await pendiente; } catch (recibido) { error = recibido; }
        expect(error).to.equal(motivo);
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("el Store no notifica asignaciones que no cambian ningún valor", () => {
        const cambios = sinon.spy();
        store.addEventListener("state-changed", cambios);
        try {
            store.setState({});
            store.setState({ online: store.state.online });
            expect(cambios.called).to.be.false;
            store.setState({ online: false });
            expect(cambios.calledOnce).to.be.true;
        } finally {
            store.removeEventListener("state-changed", cambios);
        }
    });

    test("el router monta la nueva consulta al cambiar el ID de la misma ruta", () => {
        store.setState({ usuario: { id: 1 }, clinicaActiva: { id: 1 } });
        const contenedor = document.createElement("main");
        fixture.appendChild(contenedor);
        const router = new Router({ container: contenedor, routes: { atencion: "section" } });
        router.navigate("#atencion/1");
        const anterior = contenedor.firstElementChild;
        router.navigate("#atencion/2");
        expect(contenedor.firstElementChild).not.to.equal(anterior);
        expect(contenedor.firstElementChild.dataset.routeId).to.equal("2");
    });

    test("una señal cancelada impide iniciar fetch y conserva su motivo", async () => {
        const controller = new AbortController();
        const motivo = new DOMException("Cancelada por el usuario", "AbortError");
        controller.abort(motivo);
        let recibido;
        try {
            await new DefaultService("/consultas")._request("http://localhost/consultas", { signal: controller.signal });
        } catch (error) { recibido = error; }
        expect(recibido).to.equal(motivo);
        expect(fetchStub.called).to.be.false;
    });

    test("cancelar un login pendiente no crea una sesión ni cambia la ruta", async () => {
        const respuesta = Promise.withResolvers();
        fetchStub.returns(respuesta.promise);
        const servicio = new AuthService();
        const controller = new AbortController();
        const pendiente = servicio.login(1, "01234567-8", { signal: controller.signal });
        controller.abort();
        respuesta.resolve(new Response(JSON.stringify({ items: [{
            idPersona: 1, nombres: "Empleado", clinicas: [{ id: 1 }]
        }] }), { headers: { "Content-Type": "application/json" } }));
        let error;
        try { await pendiente; } catch (recibido) { error = recibido; }
        expect(error.name).to.equal("AbortError");
        expect(servicio.sesion).to.be.null;
        expect(store.state.usuario).to.be.null;
        expect(location.hash).to.equal("#buscar-citas");
    });

    test("reconectar un stepper conserva el paso elegido por propiedad", () => {
        const host = document.createElement("stepper-progreso");
        host.etapas = ["Recepción", "Evaluación", "Atención"];
        host.setAttribute("paso-activo", "0");
        fixture.appendChild(host);
        host.pasoActivo = 2;
        host.remove();
        fixture.appendChild(host);
        expect(host.pasoActivo).to.equal(2);
        expect(host.shadowRoot.querySelector('[aria-current="step"]').dataset.indice).to.equal("2");
    });

    test("cancelar CIE-10 no dispara el respaldo offline", async () => {
        const controller = new AbortController();
        controller.abort();
        const servicio = new Cie10Service();
        const respaldo = sinon.spy(servicio, "_obtenerCatalogoLocal");
        let error;
        try { await servicio.findRange(0, 10, "A", { signal: controller.signal }); }
        catch (recibido) { error = recibido; }
        expect(error.name).to.equal("AbortError");
        expect(respaldo.called).to.be.false;
    });

    test("hidden oculta realmente el botón de instalación", async () => {
        const host = montar("instalador-app");
        await cargarEstilos(host);
        const boton = host.shadowRoot.querySelector("button");
        expect(boton.hidden).to.be.true;
        expect(boton.getClientRects().length).to.equal(0);
    });

    test("componentes con contenido se adaptan a contenedores estrechos", async function () {
        this.timeout(10000);
        const consulta = { idConsulta: 1, inicio: "2026-11-24T09:00:00",
            paciente: { nombres: "NombreMuyLargoSinEspacios".repeat(4), numeroDocumento: "01234567-8" },
            clinica: { idClinica: 1, nombre: "Central" }, estado: "PENDIENTE", procedimientos: [], pasos: [] };
        for (const ancho of [220, 280, 320, 768]) {
            for (const tag of ["busqueda-citas-view", "dashboard-view", "lista-examenes-asignables",
                "asistente-busqueda", "stepper-progreso", "tarjeta-consulta", "auto-complete-cie10",
                "atencion-consulta-view", "login-view", "encabezado-app", "menu-lateral", "historial-pasos"]) {
                const wrapper = document.createElement("div");
                wrapper.style.inlineSize = ancho + "px";
                fixture.appendChild(wrapper);
                if (tag === "atencion-consulta-view") store.setState({ consultaActiva: consulta });
                const host = document.createElement(tag);
                if (tag === "tarjeta-consulta") host.consulta = consulta;
                if (tag === "lista-examenes-asignables") {
                    host.idPaso = "paso";
                    host.idConsulta = "consulta";
                    host.ordenExamenService = { listarExamenesPorPaso: async () => [
                        { idExamen: 1, nombre: "ExamenSinEspacios".repeat(5), categoria: "General" }
                    ] };
                }
                wrapper.appendChild(host);
                await flush();
                if (tag === "busqueda-citas-view" || tag === "dashboard-view") {
                    const grid = host.shadowRoot.querySelector("#resultados, #citas");
                    grid.hidden = false;
                    const tarjeta = document.createElement("tarjeta-consulta");
                    tarjeta.consulta = consulta;
                    grid.appendChild(tarjeta);
                }
                if (tag === "auto-complete-cie10") host.seleccionados = [diagnostico];
                if (tag === "historial-pasos") host.pasos = [{
                    nombre: "PasoSinEspacios".repeat(6), estado: "COMPLETADO", valor: "Registro"
                }];
                await cargarEstilos(host);
                expect(host.scrollWidth, tag + " a " + ancho + "px").to.be.at.most(host.clientWidth + 1);
                if (tag === "lista-examenes-asignables") {
                    expect(getComputedStyle(host.shadowRoot.querySelector(".pie")).gridArea).to.equal("auto");
                    const lista = host.shadowRoot.querySelector("#lista");
                    expect(lista.scrollWidth).to.be.at.most(lista.clientWidth + 1);
                }
                wrapper.remove();
            }
        }
    });
});
