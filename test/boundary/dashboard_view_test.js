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
                { idRol: 10, nombre: "Médico General", idClinica: 1 },
                { idRol: 20, nombre: "Especialista", idClinica: 1 },
                { idRol: 10, nombre: "Médico General", idClinica: 2 },
                { idRol: 20, nombre: "Especialista", idClinica: 2 }
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

    test("renderiza la estructura básica: selector de contexto, filtros y grilla de citas", () => {
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
        const inputFechaDesde = shadow.querySelector("#fechaDesde");
        const inputFechaHasta = shadow.querySelector("#fechaHasta");
        const inputBusqueda = shadow.querySelector("#busqueda-citas");
        assert.isNotNull(selectPeriodo, "Debe tener select de periodo");
        assert.isNotNull(inputFechaDesde, "Debe tener input de fecha desde");
        assert.isNotNull(inputFechaHasta, "Debe tener input de fecha hasta");
        assert.isNotNull(inputBusqueda, "Debe tener input de búsqueda");
        expect(selectPeriodo.querySelector('option[value="hoy"]')).to.exist;
        expect(selectPeriodo.querySelector('option[value="pasado"]')).to.exist;
        expect(selectPeriodo.querySelector('option[value="futuro"]')).to.exist;
        expect(inputFechaDesde.type).to.equal("date");
        expect(inputFechaHasta.type).to.equal("date");
        expect(inputFechaDesde.value).to.not.equal("");
        expect(inputFechaHasta.value).to.not.equal("");

        // 3. Grilla de citas
        const contenedorCitas = shadow.querySelector("#citas");
        assert.isNotNull(contenedorCitas, "Debe existir el contenedor de la grilla de citas");
        assert.isNull(
            shadow.querySelector("historial-pasos"),
            "El historial no debe renderizarse fuera de las tarjetas"
        );
    });

    test("muestra nombres anidados y descripciones, conservando UUID solo en value", () => {
        const clinicaId = "fe837c00-0000-4000-8000-000000000001";
        const otraClinicaId = "fe837c00-0000-4000-8000-000000000002";
        const rolId = "ab837c00-0000-4000-8000-000000000001";
        const rolPlanoId = "ab837c00-0000-4000-8000-000000000002";
        const asignaciones = [
            { id: "asignacion-1", clinica: { id: clinicaId, descripcion: "Clínica Central" },
                rol: { id: rolId, nombre: "Médico General" } },
            { id: "asignacion-2", clinica: { id: otraClinicaId, nombre: "Clínica Norte" },
                rol: { id: rolId, nombre: "Médico General" } },
            { idRol: rolPlanoId, descripcion: "Personal de apoyo" }
        ];
        store.setState({ clinicas: [clinicaId], roles: asignaciones,
            clinicaActiva: { idClinica: clinicaId }, rolSeleccionado: asignaciones[0] });

        const clinicas = [...host.shadowRoot.querySelector("#clinica-activa").options];
        const roles = [...host.shadowRoot.querySelector("#rol-activo").options];
        expect(clinicas.map((opcion) => [opcion.value, opcion.textContent])).to.deep.equal([
            [clinicaId, "Clínica Central"], [otraClinicaId, "Clínica Norte"]
        ]);
        expect(roles.map((opcion) => [opcion.value, opcion.textContent])).to.deep.equal([
            [rolId, "Médico General"]
        ]);
        expect(host.shadowRoot.querySelector("#clinica-activa").value).to.equal(clinicaId);
        expect(host.shadowRoot.querySelector("#rol-activo").value).to.equal(rolId);
    });

    test("carga citas al conectar y renderiza <tarjeta-consulta> para cada cita", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        expect(tarjetas.length).to.equal(2);
        expect(tarjetas[0].consulta.idConsulta).to.equal(101);
        expect(tarjetas[1].consulta.idConsulta).to.equal(102);

        const historialPrimera = tarjetas[0].shadowRoot.querySelector("historial-pasos");
        const historialSegunda = tarjetas[1].shadowRoot.querySelector("historial-pasos");

        expect(historialPrimera.pasos).to.have.length(1);
        expect(historialPrimera.pasos[0].nombre).to.equal("Triage inicial");
        expect(historialSegunda.pasos).to.have.length(1);
        expect(historialSegunda.pasos[0].nombre).to.equal("Limpieza bucal");
    });

    test("inicia desde el primer día del mes hasta hoy sin el filtro restrictivo de Hoy", () => {
        const hoy = new Date();
        const desde = host._formatearFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        const hasta = host._formatearFechaISO(hoy);
        expect(host.shadowRoot.querySelector("#periodo-citas").value).to.equal("mes");
        expect(host.shadowRoot.querySelector("#fechaDesde").value).to.equal(desde);
        expect(host.shadowRoot.querySelector("#fechaHasta").value).to.equal(hasta);
        expect(buscarCitasStub.firstCall.args[0]).to.include({ fechaDesde: desde, fechaHasta: hasta, clinicaId: "1" });
        expect(buscarCitasStub.firstCall.args[0]).not.to.have.property("periodo");
        expect(host._calcularRangoPeriodo("mes", new Date(2026, 0, 1)))
            .to.deep.equal({ desde: "2026-01-01", hasta: "2026-01-01" });
    });

    test("fetch de consultas lleva el rango del mes y la clínica activa también después de cambiar el combo", async () => {
        buscarCitasStub.restore();
        buscarCitasStub = null;
        const fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: citasFicticias, total: 2 })
        });
        await host._cargarCitas();
        let url = new URL(fetchStub.firstCall.args[0]);
        expect(url.pathname).to.match(/\/consultas$/);
        expect(url.searchParams.get("clinicaId")).to.equal("1");
        expect(url.searchParams.get("fechaDesde")).to.equal(host.fechaDesde);
        expect(url.searchParams.get("fechaHasta")).to.equal(host.fechaHasta);
        expect(url.searchParams.has("periodo")).to.be.false;

        const selectClinica = host.shadowRoot.querySelector("#clinica-activa");
        selectClinica.value = "2";
        selectClinica.dispatchEvent(new Event("change"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        url = new URL(fetchStub.lastCall.args[0]);
        expect(url.searchParams.get("clinicaId")).to.equal("2");
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(2);
    });

    test("limita roles por clínica y recarga tarjetas con un contexto válido al cambiar selectores", async () => {
        const clinicaA = { idClinica: "clinica-a", nombre: "Central" };
        const clinicaB = { idClinica: "clinica-b", nombre: "Norte" };
        const asignaciones = [
            { idPersonaRol: "a-medico", clinica: clinicaA, rol: { idRol: "medico", nombre: "Médico" } },
            { idPersonaRol: "b-enfermero", clinica: clinicaB, rol: { idRol: "enfermero", nombre: "Enfermero" } },
            { idPersonaRol: "b-apoyo", clinica: clinicaB, rol: { idRol: "apoyo", nombre: "Apoyo" } },
            { idPersonaRol: "paciente", clinica: { idClinica: "clinica-paciente" },
                rol: { idRol: "paciente", nombre: "Paciente" } }
        ];
        store.setState({ roles: asignaciones, clinicaActiva: clinicaA, rolSeleccionado: asignaciones[0] });
        await Promise.resolve();
        const selectClinica = host.shadowRoot.querySelector("#clinica-activa");
        const selectRol = host.shadowRoot.querySelector("#rol-activo");
        expect([...selectClinica.options].map((opcion) => opcion.value)).to.deep.equal(["clinica-a", "clinica-b"]);
        expect([...selectRol.options].map((opcion) => opcion.value)).to.deep.equal(["medico"]);
        buscarCitasStub.resetHistory();

        selectClinica.value = "clinica-b";
        selectClinica.dispatchEvent(new Event("change"));
        await Promise.resolve();
        expect([...selectRol.options].map((opcion) => opcion.value)).to.deep.equal(["enfermero", "apoyo"]);
        expect(selectRol.value).to.equal("enfermero");
        expect(store.state.rolSeleccionado.idPersonaRol).to.equal("b-enfermero");
        expect(buscarCitasStub.callCount).to.equal(1);
        expect(buscarCitasStub.lastCall.args[0]).to.include({ clinicaId: "clinica-b", idRol: "enfermero" });
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(2);

        selectRol.value = "apoyo";
        selectRol.dispatchEvent(new Event("change"));
        await Promise.resolve();
        expect(buscarCitasStub.callCount).to.equal(2);
        expect(buscarCitasStub.lastCall.args[0]).to.include({ clinicaId: "clinica-b", idRol: "apoyo" });
        const sesion = JSON.parse(sessionStorage.getItem("galeno_session"));
        expect(sesion.rolSeleccionado.idPersonaRol).to.equal("b-apoyo");
        expect(sesion.roles).to.have.length(4);
    });

    test("normaliza un contexto restaurado inválido antes de la primera petición", async () => {
        host.remove();
        const asignacion = { idPersonaRol: "asignacion-b", idClinica: "b",
            rol: { idRol: "rol-b", nombre: "Médico" } };
        store.setState({ roles: [asignacion], clinicaActiva: { idClinica: "a" },
            rolSeleccionado: { idRol: "rol-a", nombre: "Otro" } });
        buscarCitasStub.resetHistory();
        host = document.createElement("dashboard-view");
        document.body.appendChild(host);
        await Promise.resolve();
        expect(buscarCitasStub.calledOnce).to.be.true;
        expect(buscarCitasStub.firstCall.args[0]).to.include({ clinicaId: "b", idRol: "rol-b" });
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(2);
    });

    test("actualiza la asignación al cambiar entre clínicas que comparten el mismo rol", () => {
        const roles = ["a", "b"].map((idClinica) => ({
            idPersonaRol: `asignacion-${idClinica}`, idClinica,
            rol: { idRol: "medico", nombre: "Médico" }
        }));
        store.setState({ roles, clinicaActiva: { idClinica: "a" }, rolSeleccionado: roles[0] });
        const selectClinica = host.shadowRoot.querySelector("#clinica-activa");
        selectClinica.value = "b";
        selectClinica.dispatchEvent(new Event("change"));
        expect(store.state.rolSeleccionado.idPersonaRol).to.equal("asignacion-b");
        expect(buscarCitasStub.lastCall.args[0]).to.include({ clinicaId: "b", idRol: "medico" });
    });

    test("conserva UUIDs en la raíz y nombres anidados sin repetir la normalización", () => {
        const asignacion = { idPersonaRol: "asignacion", idClinica: "clinica-uuid", idRol: "rol-uuid",
            clinica: { nombreClinica: "Central" }, rol: { descripcion: "Médico" } };
        buscarCitasStub.resetHistory();
        store.setState({ roles: [asignacion], clinicaActiva: { idClinica: "clinica-uuid" },
            rolSeleccionado: asignacion });
        expect(buscarCitasStub.calledOnce).to.be.true;
        expect(buscarCitasStub.firstCall.args[0]).to.include({ clinicaId: "clinica-uuid", idRol: "rol-uuid" });
        expect(host.shadowRoot.querySelector("#clinica-activa").selectedOptions[0].textContent).to.equal("Central");
        expect(host.shadowRoot.querySelector("#rol-activo").selectedOptions[0].textContent).to.equal("Médico");
        expect(host._normalizarContexto(store.getState())).to.be.false;
    });

    test("no consulta todas las clínicas cuando la sesión carece de asignaciones de empleado", () => {
        buscarCitasStub.resetHistory();
        store.setState({ roles: [{ idClinica: "a", rol: { idRol: "paciente", nombre: "Paciente" } }] });
        expect(buscarCitasStub.called).to.be.false;
        expect(host.shadowRoot.querySelector("#clinica-activa").options).to.have.length(0);
        expect(host.shadowRoot.querySelector("#rol-activo").options).to.have.length(0);
        expect(host.shadowRoot.querySelector("#estado-citas").textContent).to.contain("No tiene roles de empleado");
    });

    test("cada tarjeta conserva su propio historial al interactuar con ella", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const tarjetas = shadow.querySelectorAll("tarjeta-consulta");
        const historialPrimera = tarjetas[0].shadowRoot.querySelector("historial-pasos");
        const historialSegunda = tarjetas[1].shadowRoot.querySelector("historial-pasos");

        tarjetas[1].click();

        expect(historialPrimera.pasos[0].nombre).to.equal("Triage inicial");
        expect(historialSegunda.pasos[0].nombre).to.equal("Limpieza bucal");
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

    test("al hacer clic en 'Atender Consulta', guarda la consulta y navega a '#atencion/<id>'", async () => {
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
        // Verifica que navegó a #atencion con el id de la consulta
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
        expect(argsUltimaLlamada.clinicaId).to.equal("2");
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

    test("sincroniza Desde y Hasta al cambiar el periodo temporal", () => {
        const fechaLocalISO = (fecha) => {
            const anio = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, "0");
            const dia = String(fecha.getDate()).padStart(2, "0");
            return `${anio}-${mes}-${dia}`;
        };
        const hoy = fechaLocalISO(new Date());
        const shadow = host.shadowRoot;
        const selectPeriodo = shadow.querySelector("#periodo-citas");
        const inputDesde = shadow.querySelector("#fechaDesde");
        const inputHasta = shadow.querySelector("#fechaHasta");

        selectPeriodo.value = "hoy";
        selectPeriodo.dispatchEvent(new Event("change"));
        expect(inputDesde.value).to.equal(hoy);
        expect(inputHasta.value).to.equal(hoy);

        selectPeriodo.value = "pasado";
        selectPeriodo.dispatchEvent(new Event("change"));
        expect(inputDesde.value < hoy).to.be.true;
        expect(inputHasta.value < hoy).to.be.true;
        expect(inputDesde.value < inputHasta.value).to.be.true;

        selectPeriodo.value = "futuro";
        selectPeriodo.dispatchEvent(new Event("change"));
        expect(inputDesde.value > hoy).to.be.true;
        expect(inputHasta.value > hoy).to.be.true;
        expect(inputDesde.value < inputHasta.value).to.be.true;
    });

    test("al modificar manualmente las fechas consulta con fechaDesde, fechaHasta y clinicaId", async () => {
        await new Promise((r) => setTimeout(r, 50));

        const shadow = host.shadowRoot;
        const inputDesde = shadow.querySelector("#fechaDesde");
        const inputHasta = shadow.querySelector("#fechaHasta");

        inputDesde.value = "2026-01-01";
        inputHasta.value = "2026-01-31";
        inputHasta.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 50));

        expect(buscarCitasStub.callCount).to.equal(2);
        const filtros = buscarCitasStub.secondCall.args[0];
        expect(filtros.fechaDesde).to.equal("2026-01-01");
        expect(filtros.fechaHasta).to.equal("2026-01-31");
        expect(filtros.clinicaId).to.equal("1");
        expect(filtros).not.to.have.property("periodo");
        expect(shadow.querySelector("#periodo-citas").value).to.equal("personalizado");
    });

    test("un rango invertido no consulta al backend y se puede corregir", async () => {
        await new Promise((r) => setTimeout(r, 20));
        const desde = host.shadowRoot.querySelector("#fechaDesde");
        const hasta = host.shadowRoot.querySelector("#fechaHasta");
        desde.value = "2026-11-20";
        hasta.value = "2026-11-10";
        hasta.dispatchEvent(new Event("change"));
        expect(buscarCitasStub.callCount).to.equal(1);
        expect(host.shadowRoot.querySelector("#error-fechas").hidden).to.be.false;
        expect(hasta.getAttribute("aria-invalid")).to.equal("true");
        hasta.value = "2026-11-20";
        hasta.dispatchEvent(new Event("change"));
        await new Promise((r) => setTimeout(r, 20));
        expect(buscarCitasStub.callCount).to.equal(2);
        expect(host.shadowRoot.querySelector("#error-fechas").hidden).to.be.true;
    });

    test("la búsqueda agrupa la escritura y conserva el contexto de clínica, rol y fechas", async () => {
        await new Promise((r) => setTimeout(r, 20));
        const input = host.shadowRoot.querySelector("#busqueda-citas");
        let evento;
        host.addEventListener("filtros-actualizados", (e) => { evento = e; });
        input.value = "012";
        input.dispatchEvent(new Event("input"));
        input.value = " 01234567-8 ";
        input.dispatchEvent(new Event("input"));
        await new Promise((r) => setTimeout(r, 350));
        expect(buscarCitasStub.callCount).to.equal(2);
        expect(buscarCitasStub.secondCall.args[0]).to.include({ q: "01234567-8", clinicaId: "1", idRol: "10" });
        expect(evento.detail.filtros.fechaDesde).to.equal(host.fechaDesde);
        expect(evento.bubbles && evento.composed).to.be.true;
    });

    test("descarta una respuesta anterior mientras espera el debounce del nuevo texto", async () => {
        await new Promise((r) => setTimeout(r, 20));
        let resolver;
        buscarCitasStub.onSecondCall().returns(new Promise((r) => { resolver = r; }));
        const cargaAnterior = host._cargarCitas();
        const input = host.shadowRoot.querySelector("#busqueda-citas");
        input.value = "Otro paciente";
        input.dispatchEvent(new Event("input"));
        resolver({ items: citasFicticias });
        await cargaAnterior;
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(0);
    });

    test("cada modal muestra únicamente el valor de su consulta y emite su contexto", async () => {
        buscarCitasStub.resolves({ items: [101, 102].map((idConsulta) => ({
            idConsulta,
            paciente: { nombres: `Paciente ${idConsulta}`, numeroDocumento: String(idConsulta) },
            pasosClinicos: [{ idPaso: idConsulta, nombre: "Evaluación", estado: "COMPLETADO",
                valor: { notas: `Registro ${idConsulta}`, diagnostico: ["J00"], plan: "Reposo" } }]
        })) });
        await host._cargarCitas();
        const tarjetas = [...host.shadowRoot.querySelectorAll("tarjeta-consulta")];
        let evento;
        host.addEventListener("registro-consulta-abierto", (e) => { evento = e; });
        const historial1 = tarjetas[0].shadowRoot.querySelector("historial-pasos");
        const historial2 = tarjetas[1].shadowRoot.querySelector("historial-pasos");
        historial1.shadowRoot.querySelector(".boton").click();
        expect(historial1.shadowRoot.querySelector("#detalle-registro").textContent).to.include("Registro 101");
        expect(historial2.shadowRoot.querySelector("dialog").open).to.be.false;
        expect(evento.detail.consulta.idConsulta).to.equal(101);
        expect(evento.detail.paso.idPaso).to.equal(101);
        expect(host.consultaSeleccionada).to.be.null;
        expect(navigateStub.called).to.be.false;
    });

    test("una respuesta recibida después de desconectar la vista no renderiza tarjetas", async () => {
        await new Promise((r) => setTimeout(r, 20));
        let resolver;
        buscarCitasStub.onSecondCall().returns(new Promise((r) => { resolver = r; }));
        const carga = host._cargarCitas();
        host.remove();
        resolver({ items: citasFicticias });
        await carga;
        expect(host.shadowRoot.querySelectorAll("tarjeta-consulta")).to.have.length(0);
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
        expect(shadow.querySelector("tarjeta-consulta")).to.be.null;
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
