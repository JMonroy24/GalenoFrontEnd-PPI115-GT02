import "../../src/js/boundary/componentes/lista_examenes.js";
import "../../src/js/boundary/componentes/tarjeta_consulta.js";
import "../../src/js/boundary/vistas/atencion_consulta_view.js";
import GestorFechas from "../../src/js/control/gestor_fechas.js";
import { obtenerNombreClinicaConsulta } from "../../src/js/control/consulta_service.js";
import { ordenExamenService } from "../../src/js/control/orden_examen_service.js";
import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import store from "../../src/js/store.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Carga de atención: ciclo de vida y DTO del backend", () => {
    let fixture;
    let estadoAnterior;
    let rutaAnterior;
    let listar;
    const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));
    const examen = { idExamen: "e-1", nombre: "Hemograma", categoria: "Laboratorio" };

    setup(() => {
        estadoAnterior = store.getState();
        rutaAnterior = location.hash;
        if (location.hash !== "#buscar-citas") history.replaceState(null, "", "#buscar-citas");
        store.setState({ online: true, token: null, consultaActiva: null,
            consultaSeleccionada: null, consulta: null });
        fixture = document.createElement("div");
        document.body.append(fixture);
        listar = sinon.stub(ordenExamenService, "listarExamenesPorPaso").resolves([examen]);
    });

    teardown(() => {
        fixture.remove();
        sinon.restore();
        store.setState(estadoAnterior);
        if (location.hash !== rutaAnterior) {
            history.replaceState(null, "", location.pathname + location.search + rutaAnterior);
        }
    });

    test("innerHTML en un padre conectado admite atributos antes del Shadow DOM y carga una vez", async () => {
        const errores = [];
        const alError = (evento) => errores.push(evento.error);
        window.addEventListener("error", alError);
        try {
            fixture.innerHTML = '<lista-examenes-asignables id-consulta="c-1" id-paso-clinico="p-1" sin-conexion></lista-examenes-asignables>';
            await esperar();
            expect(errores).to.deep.equal([]);
            expect(listar.calledOnceWithExactly("p-1")).to.be.true;
            expect(fixture.firstElementChild.shadowRoot.querySelector("#lista").textContent).to.include("Hemograma");
        } finally {
            window.removeEventListener("error", alError);
        }
    });

    test("los cambios síncronos de atributos consultan solo el paso final", async () => {
        const host = document.createElement("lista-examenes-asignables");
        fixture.append(host);
        host.setAttribute("id-consulta", "c-1");
        host.setAttribute("id-paso-clinico", "p-anterior");
        host.idPaso = "p-final";
        host.sinConexion = true;
        await esperar();
        expect(listar.calledOnceWithExactly("p-final")).to.be.true;
        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;
    });

    test("cargar y pintar antes de conectar no toca el DOM ni consulta servicios", async () => {
        const host = document.createElement("lista-examenes-asignables");
        host.idConsulta = "c-1";
        host.idPaso = "p-1";
        host._actualizarContexto(true);
        host._pintarCategorias();
        await host.cargarExamenes();
        expect(host.shadowRoot.children.length).to.equal(0);
        expect(listar.called).to.be.false;
    });

    test("desconectar antes de la carga agrupada cancela esa carga", async () => {
        const host = document.createElement("lista-examenes-asignables");
        host.idPaso = "p-1";
        fixture.append(host);
        host.remove();
        await esperar();
        expect(listar.called).to.be.false;
    });

    test("una respuesta anterior no modifica el componente reconectado", async () => {
        const anterior = Promise.withResolvers();
        listar.onFirstCall().returns(anterior.promise);
        const host = document.createElement("lista-examenes-asignables");
        host.idPaso = "p-anterior";
        fixture.append(host);
        await esperar();
        host.remove();
        host.idPaso = "p-actual";
        fixture.append(host);
        await esperar();
        anterior.resolve([{ id: "viejo", nombre: "Resultado obsoleto" }]);
        await esperar();
        expect(listar.callCount).to.equal(2);
        expect(host.shadowRoot.querySelector("#lista").textContent).to.include("Hemograma").and.not.include("Resultado obsoleto");
    });

    test("un contenedor ausente durante un desmontaje no causa TypeError", async () => {
        const host = document.createElement("lista-examenes-asignables");
        fixture.append(host);
        await esperar();
        host.shadowRoot.replaceChildren();
        expect(() => { host._pintarCategorias(); host._pintarLista(); host._actualizarBoton(); }).not.to.throw();
    });

    test("las fechas JSON-B con [UTC] se muestran en es-SV conservando el día programado", () => {
        expect(GestorFechas.formatearFechaCalendario("2026-11-11T05:15:00Z[UTC]")).to.equal("11/11/2026");
        expect(GestorFechas.formatearFechaCalendario("2026-11-11")).to.equal("11/11/2026");
        expect(GestorFechas.formatearFechaCalendario("2026-11-11T23:15:00-06:00[America/El_Salvador]")).to.equal("11/11/2026");
    });

    test("el formateador de instantes también acepta la anotación sin cambiar su contrato horario", () => {
        expect(GestorFechas.formatearFechaISO("2026-11-12T14:05:00-06:00[America/El_Salvador]")).to.equal("12/11/2026 02:05 PM");
        expect(GestorFechas.formatearFechaISO("2026-11-11T05:15:00Z[UTC]")).to.equal("10/11/2026 11:15 PM");
    });

    test("fechas inexistentes o vacías no se normalizan a otro día", () => {
        for (const valor of [null, undefined, "", "sin fecha", "2026-02-29", "2026-02-30T05:15:00Z[UTC]", "2026-13-11"]) {
            expect(GestorFechas.formatearFechaCalendario(valor)).to.equal("");
        }
        expect(GestorFechas.formatearFechaCalendario("2024-02-29")).to.equal("29/02/2024");
    });

    test("la clínica admite asociaciones, nombres alternativos y strings sin mostrar objetos o IDs", () => {
        for (const consulta of [{ clinica: { nombre: "Central" } }, { clinica: { nombreClinica: "Central" } },
            { clinica: " Central " }, { clinica: {}, cita: { idClinica: { nombre: "Central" } } }]) {
            expect(obtenerNombreClinicaConsulta(consulta)).to.equal("Central");
        }
        for (const consulta of [null, {}, { clinica: {} }, { clinica: " " }, { idClinica: "123" }]) {
            expect(obtenerNombreClinicaConsulta(consulta)).to.equal("Sin clínica");
        }
    });

    test("la cabecera acepta fechaInicio JSON-B y escapa el nombre de clínica", () => {
        const host = document.createElement("atencion-consulta-view");
        host._consulta = { id: "c-1", fechaInicio: "2026-11-11T05:15:00Z[UTC]", clinica: { nombre: "Central <script>" } };
        const cabecera = host._htmlCabecera();
        expect(cabecera).to.include("Fecha: 11/11/2026").and.include("Clínica: Central &lt;script&gt;");
        expect(cabecera).not.to.include("[object Object]").and.not.to.include("[UTC]");
    });

    test("las tarjetas comparten la clínica defensiva y conservan la fecha ISO del calendario", () => {
        const host = document.createElement("tarjeta-consulta");
        const consulta = { fechaInicio: "2026-11-11T05:15:00Z[UTC]", clinica: { nombreClinica: "Central" } };
        expect(host._obtenerFecha(consulta)).to.equal("2026-11-11");
        expect(host._obtenerClinica(consulta)).to.equal("Central");
    });

    test("el historial elimina la anotación de zona de las fechas JSON-B", () => {
        const host = document.createElement("historial-pasos");
        expect(host._fechaHoraPaso({ fechaHora: "2026-11-11T05:15:00Z[UTC]" })).not.to.include("[UTC]");
    });

    test("abrir #atencion solicita el detalle una vez por GET y conserva el error HTTP 409", async () => {
        store.setState({ usuario: { idPersona: "empleado" }, clinicaActiva: { id: "central" },
            consultaActiva: { idConsulta: "c-409", fechaInicio: "2026-11-11T05:15:00Z[UTC]",
            clinica: { nombre: "Central" } } });
        history.replaceState(null, "", "#atencion/c-409");
        const fetchStub = sinon.stub(window, "fetch").resolves(new Response(JSON.stringify({
            error_code: "CONFLICT", message: "Conflicto confirmado por el servidor", status_code: 409, details: {}
        }), { status: 409, headers: { "Content-Type": "application/json" } }));
        const mensaje = sinon.spy(GeneradorMensajes, "crearMensaje");
        const host = document.createElement("atencion-consulta-view");
        expect(location.hash).to.equal("#atencion/c-409");
        fixture.append(host);
        for (let i = 0; i < 30 && host._cargandoConsulta; i++) await esperar();
        expect(host._cargandoConsulta).to.be.false;
        expect(fetchStub.callCount, JSON.stringify(fetchStub.getCalls().map((call) => [String(call.args[0]), call.args[1]?.method]))).to.equal(1);
        const [url, opciones] = fetchStub.firstCall.args;
        expect(String(url)).to.match(/\/consultas\/c-409$/);
        expect(opciones.method).to.equal("GET");
        expect(opciones.body).to.be.undefined;
        expect(mensaje.calledOnce).to.be.true;
        expect(mensaje.firstCall.args[1]).to.include("HTTP 409").and.include("Conflicto confirmado por el servidor");
        expect(host.shadowRoot.querySelector(".cabecera-meta").textContent).to.include("11/11/2026").and.include("Central");
    });
});
