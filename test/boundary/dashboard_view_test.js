import { DashboardView } from "../../src/js/boundary/vistas/dashboard_view.js";
import store from "../../src/js/store.js";
import { consultaService } from "../../src/js/control/consulta_service.js";
import * as routerModule from "../../src/js/router.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("DashboardView (unitaria)", () => {
    let host;
    let buscarCitasStub;
    let navigateStub;

    const citasFicticias = [
        {
            idConsulta: 101,
            fecha: "2026-11-12",
            hora: "09:00",
            estado: "Pendiente",
            clinica: "Clínica Central",
            procedimientos: [{ nombre: "Consulta General" }],
            pasos: [
                {
                    nombre: "Triage inicial",
                    profesionalResponsable: "Enf. López",
                    fechaHoraEjecucion: "2026-11-12T08:30:00"
                }
            ]
        },
        {
            idConsulta: 102,
            fecha: "2026-11-12",
            hora: "10:30",
            estado: "Confirmada",
            clinica: "Clínica Central",
            procedimientos: [{ nombre: "Control Dental" }],
            pasos: [
                {
                    nombre: "Limpieza bucal",
                    profesionalResponsable: "Dra. Martínez",
                    fechaHoraEjecucion: "2026-11-12T10:00:00"
                }
            ]
        }
    ];

    setup(() => {
        buscarCitasStub = sinon.stub(consultaService, "buscarCitas").resolves({
            items: citasFicticias,
            total: 2,
            first: 0,
            max: 10
        });

        navigateStub = sinon.stub(routerModule.router, "navigate");

        store.setState({
            token: "fake-jwt",
            clinicas: [
                { idClinica: 1, nombre: "Clínica Central" },
                { idClinica: 2, nombre: "Clínica Norte" }
            ],
            roles: [
                { idRol: 10, nombre: "Médico General" },
                { idRol: 20, nombre: "Especialista" }
            ],
            clinicaActiva: { idClinica: 1, nombre: "Clínica Central" },
            rolSeleccionado: { idRol: 10, nombre: "Médico General" }
        });

        host = document.createElement("dashboard-view");
        document.body.appendChild(host);
    });

    teardown(() => {
        if (host && host.parentNode) {
            host.parentNode.removeChild(host);
        }
        buscarCitasStub?.restore();
        navigateStub?.restore();
        sinon.restore();
    });

    test("está registrado en customElements con la etiqueta 'dashboard-view'", () => {
        const elemento = customElements.get("dashboard-view");
        assert.isDefined(elemento);
        assert.equal(elemento, DashboardView);
    });

    test("posee Shadow DOM en modo 'open'", () => {
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza la estructura básica: selector de contexto, filtros, grilla de citas y panel historial", () => {
        const shadow = host.shadowRoot;

        // 1. Selector de contexto
        const selectClinica = shadow.querySelector("#clinica-activa");
        const selectRol = shadow.querySelector("#rol-activo");
        assert.isNotNull(selectClinica, "Debe tener select de clínica activa");
        assert.isNotNull(selectRol, "Debe tener select de rol activo");
        expect(selectClinica.value).to.equal("1");
        expect(selectRol.value).to.equal("10");

        // 2. Barra de filtros
        const selectPeriodo = shadow.querySelector("#periodo-citas");
        const inputBusqueda = shadow.querySelector("#busqueda-citas");
        assert.isNotNull(selectPeriodo, "Debe tener select de periodo");
        assert.isNotNull(inputBusqueda, "Debe tener input de búsqueda");
        expect(selectPeriodo.querySelector('option[value="hoy"]')).to.exist;
        expect(selectPeriodo.querySelector('option[value="pasado"]')).to.exist;
        expect(selectPeriodo.querySelector('option[value="futuro"]')).to.exist;

        // 3. Grilla de citas
        const contenedorCitas = shadow.querySelector("#citas");
        assert.isNotNull(contenedorCitas, "Debe existir el contenedor de la grilla de citas");

        // 4. Panel con historial-pasos
        const historialPasos = shadow.querySelector("historial-pasos");
        assert.isNotNull(historialPasos, "Debe existir el componente <historial-pasos>");
    });

    test("carga citas al conectar y renderiza <tarjeta-consulta> para cada cita", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        expect(tarjetas.length).to.equal(2);
        expect(tarjetas[0].consulta.idConsulta).to.equal(101);
        expect(tarjetas[1].consulta.idConsulta).to.equal(102);

        // Historial de pasos se inicializa con los pasos de la primera cita
        const historial = shadow.querySelector("historial-pasos");
        expect(historial.pasos).to.have.length(1);
        expect(historial.pasos[0].nombre).to.equal("Triage inicial");
    });

    test("al hacer clic en una tarjeta de consulta, actualiza <historial-pasos>", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        const historial = shadow.querySelector("historial-pasos");

        // Clic en la segunda tarjeta
        tarjetas[1].click();

        expect(historial.pasos).to.have.length(1);
        expect(historial.pasos[0].nombre).to.equal("Limpieza bucal");
    });

    test("inyecta botón 'Atender Consulta' en slot='acciones' de cada <tarjeta-consulta>", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");

        tarjetas.forEach((tarjeta) => {
            const boton = tarjeta.querySelector('button[slot="acciones"]');
            assert.isNotNull(boton, "La tarjeta debe tener un botón en slot='acciones'");
            expect(boton.textContent.trim()).to.equal("Atender Consulta");
        });
    });

    test("al hacer clic en 'Atender Consulta', guarda la consulta y navega a '#atencion'", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjeta1 = shadow.querySelector("tarjeta-consulta");
        const botonAtender = tarjeta1.querySelector('button[slot="acciones"]');

        let eventoDisparado = false;
        host.addEventListener("consulta-seleccionada", (ev) => {
            eventoDisparado = true;
            expect(ev.detail.consulta.idConsulta).to.equal(101);
        });

        botonAtender.click();

        // Verifica que se guardó en el store
        expect(store.getState().consultaSeleccionada).to.deep.equal(citasFicticias[0]);
        // Verifica que se guardó en la instancia
        expect(host.consultaSeleccionada).to.deep.equal(citasFicticias[0]);
        // Verifica que navegó a #atencion/<id>
        expect(navigateStub.calledOnce).to.be.true;
        expect(navigateStub.firstCall.args[0]).to.equal("#atencion/101");
        assert.isTrue(eventoDisparado);
    });

    test("recarga automáticamente las citas al cambiar la clínica en el store", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        // Cambiamos la clínica activa en el store
        store.setState({
            clinicaActiva: { idClinica: 2, nombre: "Clínica Norte" }
        });

        await new Promise((r) => setTimeout(r, 50));

        // Debe haberse recargado
        expect(buscarCitasStub.callCount).to.equal(2);
        const argsUltimaLlamada = buscarCitasStub.secondCall.args[0];
        expect(argsUltimaLlamada.idClinica).to.equal("2");
    });

    test("recarga automáticamente las citas al cambiar el rol activo en el store", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        // Cambiamos el rol seleccionado en el store
        store.setState({
            rolSeleccionado: { idRol: 20, nombre: "Especialista" }
        });

        await new Promise((r) => setTimeout(r, 50));

        // Debe haberse recargado
        expect(buscarCitasStub.callCount).to.equal(2);
        const argsUltimaLlamada = buscarCitasStub.secondCall.args[0];
        expect(argsUltimaLlamada.idRol).to.equal("20");
    });

    test("al cambiar clínica en el select del usuario, actualiza el store y emite 'contexto-actualizado'", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const selectClinica = shadow.querySelector("#clinica-activa");

        let eventoContexto = null;
        host.addEventListener("contexto-actualizado", (ev) => {
            eventoContexto = ev.detail;
        });

        selectClinica.value = "2";
        selectClinica.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 50));

        expect(store.getState().clinicaActiva.idClinica).to.equal(2);
        assert.isNotNull(eventoContexto);
    });

    test("al cambiar periodo de filtro, recarga citas con el nuevo periodo", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        const shadow = host.shadowRoot;
        const selectPeriodo = shadow.querySelector("#periodo-citas");

        selectPeriodo.value = "futuro";
        selectPeriodo.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 50));

        expect(buscarCitasStub.callCount).to.equal(2);
        expect(buscarCitasStub.secondCall.args[0].periodo).to.equal("futuro");
    });

    test("al presionar Enter en búsqueda, recarga citas con filtro q", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        const shadow = host.shadowRoot;
        const inputBusqueda = shadow.querySelector("#busqueda-citas");

        inputBusqueda.value = "Juan Pérez";
        inputBusqueda.dispatchEvent(new Event("input"));
        inputBusqueda.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        await new Promise((r) => setTimeout(r, 50));

        expect(buscarCitasStub.callCount).to.equal(2);
        expect(buscarCitasStub.secondCall.args[0].q).to.equal("Juan Pérez");
    });

    test("muestra mensaje de no encontradas cuando buscarCitas devuelve arreglo vacío", async () => {
        buscarCitasStub.resolves({ items: [], total: 0 });

        // Forzamos recarga
        store.setState({ clinicaActiva: { idClinica: 2 } });
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const estadoCitas = shadow.querySelector("#estado-citas");
        expect(estadoCitas.hidden).to.be.false;
        expect(estadoCitas.textContent).to.contain("No se encontraron citas");

        const historial = shadow.querySelector("historial-pasos");
        expect(historial.pasos).to.be.empty;
    });

    test("no recarga citas si el cambio en store no afecta clínica ni rol", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        // Cambiamos otra propiedad no relacionada
        store.setState({
            online: false
        });

        await new Promise((r) => setTimeout(r, 50));

        // No debe haberse llamado de nuevo
        expect(buscarCitasStub.callCount).to.equal(1);
    });

    test("desuscribe el listener del store al desconectarse del DOM", async () => {
        await new Promise((r) => setTimeout(r, 50));
        expect(buscarCitasStub.callCount).to.equal(1);

        // Desconectamos el componente
        host.remove();

        // Mutamos el store
        store.setState({
            clinicaActiva: { idClinica: 99, nombre: "Otra Clínica" }
        });

        await new Promise((r) => setTimeout(r, 50));

        // No debe llamarse a buscarCitas porque fue desuscrito
        expect(buscarCitasStub.callCount).to.equal(1);
    });
});
