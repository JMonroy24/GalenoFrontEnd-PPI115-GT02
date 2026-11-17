import { store } from "../../store.js";
import { consultaService } from "../../control/consulta_service.js";
import "../componentes/tarjeta_consulta.js";
import { navigate } from "../../router.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

const DEBOUNCE_BUSQUEDA_MS = 300;
const DIAS_RANGO_PERIODO = 30;

export class DashboardView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        this.clinicas = [];
        this.roles = [];
        this.periodo = "hoy";
        this.busqueda = "";
        this.consultaSeleccionada = null;
        this.temporizadorBusqueda = null;
        this.solicitudActual = 0;
        this.contextoPrevio = "";

        const rangoInicial = this._calcularRangoPeriodo(this.periodo);
        this.fechaDesde = rangoInicial.desde;
        this.fechaHasta = rangoInicial.hasta;

        this.actualizarDesdeStore = (evento) => {
            if (!this.isConnected) {
                return;
            }

            const estado = evento?.detail ?? store.getState();
            const contexto = this._claveContexto(estado);

            if (contexto === this.contextoPrevio) {
                return;
            }

            this.contextoPrevio = contexto;
            this._cancelarDebounce();
            this._sincronizarContexto(estado);
            this._cargarCitas();
        };
    }

    connectedCallback() {
        const estado = store.getState();
        this.contextoPrevio = this._claveContexto(estado);
        this.render();
        store.addEventListener("state-changed", this.actualizarDesdeStore);
        this._cargarCitas();
    }

    disconnectedCallback() {
        store.removeEventListener("state-changed", this.actualizarDesdeStore);
        this._cancelarDebounce();
        this.solicitudActual++;
    }

    render() {
        const estado = store.getState();
        this.clinicas = this._obtenerClinicas(estado);
        this.roles = this._obtenerRoles(estado);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, sans-serif);
                }
                .dashboard {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                }
                .cabecera {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: var(--space-4, 1rem);
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }
                h2 {
                    margin: 0;
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-xl, 1.25rem);
                }
                .selectores,
                .selector-contexto {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-3, 0.75rem);
                }
                .campo {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-xs, 0.25rem);
                    min-width: 12rem;
                }
                label {
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .filtros,
                .barra-filtros {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-end;
                    gap: var(--space-3, 0.75rem);
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }
                .campo-busqueda {
                    flex: 1 1 18rem;
                }
                .panel-principal {
                    display: block;
                }
                .seccion-citas {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                    min-width: 0;
                }
                .citas,
                .grilla-citas {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
                    gap: var(--space-4, 1rem);
                }
                .citas[hidden],
                .estado[hidden] {
                    display: none;
                }
                .estado {
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text-muted, #475569);
                    text-align: center;
                }
                .btn-atender {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
                    border: 0;
                    border-radius: var(--radius-md, 0.5rem);
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }
                .btn-atender:hover {
                    background-color: var(--color-primary-hover, #172554);
                }
                .btn-atender:focus-visible {
                    outline: 2px solid var(--color-secondary, #0284c7);
                    outline-offset: 2px;
                }
            </style>
            <section class="dashboard">
                <header class="cabecera">
                    <h2>Dashboard</h2>
                    <div class="selectores selector-contexto">
                        <div class="campo">
                            <label for="clinica-activa">Clínica Activa</label>
                            <select
                                id="clinica-activa"
                                name="clinicaActiva"
                                class="form-control"
                                aria-label="Clínica Activa"
                            ></select>
                        </div>
                        <div class="campo">
                            <label for="rol-activo">Rol Activo</label>
                            <select
                                id="rol-activo"
                                name="rolActivo"
                                class="form-control"
                                aria-label="Rol Activo"
                            ></select>
                        </div>
                    </div>
                </header>
                <div class="filtros barra-filtros">
                    <div class="campo">
                        <label for="periodo-citas">Periodo</label>
                        <select
                            id="periodo-citas"
                            name="periodo"
                            class="form-control"
                            aria-label="Periodo de las citas"
                        >
                            <option value="hoy">Hoy</option>
                            <option value="pasado">Pasado (30 días)</option>
                            <option value="futuro">Futuro (30 días)</option>
                            <option value="personalizado">Rango personalizado</option>
                        </select>
                    </div>
                    <div class="campo">
                        <label for="fechaDesde">Desde</label>
                        <input
                            id="fechaDesde"
                            name="fechaDesde"
                            type="date"
                            class="form-control"
                            aria-label="Fecha desde"
                            aria-describedby="error-fechas"
                        >
                    </div>
                    <div class="campo">
                        <label for="fechaHasta">Hasta</label>
                        <input
                            id="fechaHasta"
                            name="fechaHasta"
                            type="date"
                            class="form-control"
                            aria-label="Fecha hasta"
                            aria-describedby="error-fechas"
                        >
                    </div>
                    <div class="campo campo-busqueda">
                        <label for="busqueda-citas">Buscar paciente</label>
                        <input
                            id="busqueda-citas"
                            name="busqueda"
                            type="search"
                            class="form-control"
                            placeholder="Nombre o número de documento"
                            aria-label="Buscar por nombre o número de documento del paciente"
                        >
                    </div>
                </div>
                <p id="error-fechas" role="alert" hidden></p>
                <div class="panel-principal">
                    <section class="seccion-citas" aria-label="Listado de Citas">
                        <div
                            id="estado-citas"
                            class="estado"
                            role="status"
                            aria-live="polite"
                            hidden
                        ></div>
                        <div id="citas" class="citas grilla-citas" role="list" hidden></div>
                    </section>
                </div>
            </section>
        `;

        const selectClinica = this.shadowRoot.querySelector("#clinica-activa");
        const selectRol = this.shadowRoot.querySelector("#rol-activo");
        const selectPeriodo = this.shadowRoot.querySelector("#periodo-citas");
        const inputFechaDesde = this.shadowRoot.querySelector("#fechaDesde");
        const inputFechaHasta = this.shadowRoot.querySelector("#fechaHasta");
        const inputBusqueda = this.shadowRoot.querySelector("#busqueda-citas");

        this._cargarOpciones(selectClinica, this.clinicas, (clinica) => this._idClinica(clinica), (clinica) => this._nombreClinica(clinica));
        this._cargarOpciones(selectRol, this.roles, (rol) => this._idRol(rol), (rol) => this._nombreRol(rol));

        selectPeriodo.value = this.periodo;
        inputFechaDesde.value = this.fechaDesde;
        inputFechaHasta.value = this.fechaHasta;
        inputBusqueda.value = this.busqueda;

        selectPeriodo.addEventListener("change", () => {
            this.periodo = selectPeriodo.value || "hoy";
            if (this.periodo !== "personalizado") this._sincronizarFechasConPeriodo(this.periodo);
            this._cancelarDebounce();
            this._cargarCitas();
        });

        const manejarCambioFechas = () => {
            this.fechaDesde = inputFechaDesde.value;
            this.fechaHasta = inputFechaHasta.value;
            this.periodo = "personalizado";
            selectPeriodo.value = this.periodo;
            this._cancelarDebounce();
            this._cargarCitas();
        };

        inputFechaDesde.addEventListener("change", manejarCambioFechas);
        inputFechaHasta.addEventListener("change", manejarCambioFechas);

        inputBusqueda.addEventListener("input", () => {
            this.busqueda = inputBusqueda.value;
            this._programarBusqueda();
        });

        inputBusqueda.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                this._cancelarDebounce();
                this._cargarCitas();
            }
        });

        const clinicaActual = this._idClinica(estado?.clinicaActiva ?? estado?.activeClinic);
        const rolActual = this._idRol(estado?.rolSeleccionado ?? estado?.selectedRole ?? estado?.rolActivo);

        if (clinicaActual !== "") {
            selectClinica.value = String(clinicaActual);
        }

        if (rolActual !== "") {
            selectRol.value = String(rolActual);
        }

        selectClinica.addEventListener("change", () => {
            const idSeleccionado = selectClinica.value;
            const clinica = this.clinicas.find(
                (item) => String(this._idClinica(item)) === idSeleccionado
            ) ?? (idSeleccionado ? { idClinica: idSeleccionado } : null);

            const rolActualVal = store.state?.rolSeleccionado ?? store.state?.selectedRole ?? null;
            if (typeof store.setContextoTrabajo === "function") {
                store.setContextoTrabajo(clinica, rolActualVal);
            } else {
                store.setState({ clinicaActiva: clinica });
            }
            this._emitirContextoActualizado();
        });

        selectRol.addEventListener("change", () => {
            const idSeleccionado = selectRol.value;
            const rol = this.roles.find(
                (item) => String(this._idRol(item)) === idSeleccionado
            ) ?? (idSeleccionado ? { idRol: idSeleccionado } : null);

            const clinicaActualVal = store.state?.clinicaActiva ?? store.state?.activeClinic ?? null;
            if (typeof store.setContextoTrabajo === "function") {
                store.setContextoTrabajo(clinicaActualVal, rol);
            } else {
                store.setState({ rolSeleccionado: rol });
            }
            this._emitirContextoActualizado();
        });
    }

    _sincronizarContexto(estado) {
        this.clinicas = this._obtenerClinicas(estado);
        this.roles = this._obtenerRoles(estado);

        const selectClinica = this.shadowRoot?.querySelector("#clinica-activa");
        const selectRol = this.shadowRoot?.querySelector("#rol-activo");

        const clinicaActual = this._idClinica(estado?.clinicaActiva ?? estado?.activeClinic);
        const rolActual = this._idRol(estado?.rolSeleccionado ?? estado?.selectedRole ?? estado?.rolActivo);

        if (selectClinica) {
            this._cargarOpciones(selectClinica, this.clinicas, (c) => this._idClinica(c), (c) => this._nombreClinica(c));
            if (clinicaActual !== "") {
                selectClinica.value = String(clinicaActual);
            }
        }

        if (selectRol) {
            this._cargarOpciones(selectRol, this.roles, (r) => this._idRol(r), (r) => this._nombreRol(r));
            if (rolActual !== "") {
                selectRol.value = String(rolActual);
            }
        }
    }

    _claveContexto(estado) {
        const clinica = estado?.clinicaActiva ?? estado?.activeClinic;
        const rol = estado?.rolSeleccionado ?? estado?.selectedRole ?? estado?.rolActivo;
        return `${this._idClinica(clinica)}|${this._idRol(rol)}`;
    }

    _programarBusqueda() {
        this._cancelarDebounce();
        // Descarta respuestas del filtro anterior incluso durante el debounce.
        this.solicitudActual++;
        this.temporizadorBusqueda = setTimeout(() => {
            this.temporizadorBusqueda = null;
            this._cargarCitas();
        }, DEBOUNCE_BUSQUEDA_MS);
    }

    _cancelarDebounce() {
        if (this.temporizadorBusqueda !== null) {
            clearTimeout(this.temporizadorBusqueda);
            this.temporizadorBusqueda = null;
        }
    }

    _formatearFechaISO(fecha) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");
        return `${anio}-${mes}-${dia}`;
    }

    _desplazarDias(fecha, dias) {
        const copia = new Date(
            fecha.getFullYear(),
            fecha.getMonth(),
            fecha.getDate()
        );
        copia.setDate(copia.getDate() + dias);
        return copia;
    }

    _calcularRangoPeriodo(periodo, referencia = new Date()) {
        if (periodo === "pasado") {
            return {
                desde: this._formatearFechaISO(
                    this._desplazarDias(referencia, -DIAS_RANGO_PERIODO)
                ),
                hasta: this._formatearFechaISO(
                    this._desplazarDias(referencia, -1)
                )
            };
        }

        if (periodo === "futuro") {
            return {
                desde: this._formatearFechaISO(
                    this._desplazarDias(referencia, 1)
                ),
                hasta: this._formatearFechaISO(
                    this._desplazarDias(referencia, DIAS_RANGO_PERIODO)
                )
            };
        }

        const hoy = this._formatearFechaISO(referencia);
        return { desde: hoy, hasta: hoy };
    }

    _sincronizarFechasConPeriodo(periodo) {
        const rango = this._calcularRangoPeriodo(periodo);
        this.fechaDesde = rango.desde;
        this.fechaHasta = rango.hasta;

        const inputDesde = this.shadowRoot?.querySelector("#fechaDesde");
        const inputHasta = this.shadowRoot?.querySelector("#fechaHasta");

        if (inputDesde) {
            inputDesde.value = this.fechaDesde;
        }

        if (inputHasta) {
            inputHasta.value = this.fechaHasta;
        }
    }

    _construirFiltros() {
        const estado = store.getState();
        const filtros = {};
        if (["hoy", "pasado", "futuro"].includes(this.periodo)) filtros.periodo = this.periodo;
        const idClinica = this._idClinica(estado?.clinicaActiva ?? estado?.activeClinic);
        const rolId = this._idRol(estado?.rolSeleccionado ?? estado?.selectedRole ?? estado?.rolActivo);
        const busqueda = (this.busqueda ?? "").trim();
        const fechaDesde = String(this.fechaDesde ?? "").trim();
        const fechaHasta = String(this.fechaHasta ?? "").trim();

        if (idClinica !== "") {
            filtros.idClinica = idClinica;
        }

        if (rolId !== "") {
            filtros.idRol = rolId;
        }

        if (busqueda !== "") {
            filtros.q = busqueda;
        }

        if (fechaDesde !== "") {
            filtros.fechaDesde = fechaDesde;
        }

        if (fechaHasta !== "") {
            filtros.fechaHasta = fechaHasta;
        }

        return filtros;
    }

    _validarFechas() {
        const desde = this.shadowRoot.querySelector("#fechaDesde");
        const hasta = this.shadowRoot.querySelector("#fechaHasta");
        const error = this.shadowRoot.querySelector("#error-fechas");
        const rangoInvertido = this.fechaDesde && this.fechaHasta && this.fechaDesde > this.fechaHasta;
        const mensaje = !desde.validity.valid || !hasta.validity.valid
            ? "Ingrese fechas válidas."
            : rangoInvertido ? "La fecha Desde debe ser anterior o igual a la fecha Hasta." : "";
        error.textContent = mensaje;
        error.hidden = !mensaje;
        desde.setAttribute("aria-invalid", String(Boolean(mensaje)));
        hasta.setAttribute("aria-invalid", String(Boolean(mensaje)));
        return !mensaje;
    }

    async _cargarCitas() {
        const estadoCitas = this.shadowRoot?.querySelector("#estado-citas");
        const contenedor = this.shadowRoot?.querySelector("#citas");

        if (!estadoCitas || !contenedor) {
            return;
        }

        const solicitud = ++this.solicitudActual;
        contenedor.replaceChildren();
        contenedor.hidden = true;
        if (!this._validarFechas()) {
            estadoCitas.hidden = true;
            return;
        }
        const filtros = this._construirFiltros();
        this.dispatchEvent(new CustomEvent("filtros-actualizados", {
            bubbles: true,
            composed: true,
            detail: { filtros: { ...filtros } }
        }));
        this._mostrarEstadoCitas("Cargando citas...");

        try {
            const respuesta = await consultaService.buscarCitas(filtros);

            if (solicitud !== this.solicitudActual || !this.isConnected) {
                return;
            }

            const citas = Array.isArray(respuesta?.items)
                ? respuesta.items
                : Array.isArray(respuesta?.datos)
                    ? respuesta.datos
                    : Array.isArray(respuesta)
                        ? respuesta
                        : [];

            if (citas.length === 0) {
                this._mostrarEstadoCitas("No se encontraron citas.");
                return;
            }

            estadoCitas.hidden = true;
            contenedor.hidden = false;

            citas.forEach((cita) => {
                const tarjeta = this._crearTarjetaConsulta(cita);
                contenedor.appendChild(tarjeta);
            });
        } catch (error) {
            if (solicitud !== this.solicitudActual || !this.isConnected) {
                return;
            }

            this._mostrarEstadoCitas("No se pudieron cargar las citas.");
            GeneradorMensajes.crearMensaje(
                "Error al cargar citas",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _crearTarjetaConsulta(cita) {
        const tarjeta = document.createElement("tarjeta-consulta");
        tarjeta.setAttribute("role", "listitem");
        tarjeta.consulta = cita;

        const botonAtender = document.createElement("button");
        botonAtender.type = "button";
        botonAtender.slot = "acciones";
        botonAtender.className = "btn btn-primario btn-atender";
        botonAtender.textContent = "Atender Consulta";
        botonAtender.addEventListener("click", (evento) => {
            evento.stopPropagation();
            this._atenderConsulta(cita);
        });

        tarjeta.appendChild(botonAtender);

        tarjeta.addEventListener("click", () => {
            this._seleccionarConsulta(cita);
        });

        return tarjeta;
    }

    _seleccionarConsulta(cita) {
        this.consultaSeleccionada = cita;
    }

    _atenderConsulta(cita) {
        this._seleccionarConsulta(cita);

        store.setState({
            consultaSeleccionada: cita,
            consultaActiva: cita,
            consulta: cita
        });

        try {
            if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem("consultaSeleccionada", JSON.stringify(cita));
                sessionStorage.setItem("consulta", JSON.stringify(cita));
            }
        } catch {
        }

        this.dispatchEvent(new CustomEvent("consulta-seleccionada", {
            bubbles: true,
            composed: true,
            detail: { consulta: cita }
        }));

        const idConsulta = cita?.idConsulta ?? cita?.id ?? null;
        navigate(idConsulta ? `#atencion/${idConsulta}` : "#atencion");
    }

    _mostrarEstadoCitas(mensaje) {
        const estadoCitas = this.shadowRoot?.querySelector("#estado-citas");

        if (!estadoCitas) {
            return;
        }

        estadoCitas.textContent = mensaje;
        estadoCitas.hidden = false;
    }

    _cargarOpciones(select, items, obtenerId, obtenerNombre) {
        select.replaceChildren();

        items.forEach((item) => {
            const opcion = document.createElement("option");
            opcion.value = String(obtenerId(item));
            opcion.textContent = obtenerNombre(item);
            select.appendChild(opcion);
        });
    }

    _emitirContextoActualizado() {
        const estado = store.getState();

        this.dispatchEvent(new CustomEvent("contexto-actualizado", {
            bubbles: true,
            composed: true,
            detail: {
                clinicaActiva: estado.clinicaActiva,
                rolSeleccionado: estado.rolSeleccionado
            }
        }));
    }

    _obtenerClinicas(estado) {
        const directas = estado?.clinicas
            ?? estado?.clinicasAsignadas
            ?? estado?.usuario?.clinicas
            ?? estado?.usuario?.clinicasAsignadas
            ?? estado?.usuario?.clinica
            ?? [];

        const lista = Array.isArray(directas) ? [...directas] : (directas ? [directas] : []);

        if (estado?.clinicaActiva) {
            lista.push(estado.clinicaActiva);
        }

        // Conservar todas las asignaciones: un mismo rol puede tener varias clínicas.
        const asignaciones = estado?.roles ?? estado?.usuario?.roles ?? [];
        [...asignaciones, estado?.rolSeleccionado].forEach((rol) => {
            const clinica = rol?.clinica
                ?? rol?.clinicaActiva
                ?? rol?.rol?.clinica
                ?? rol?.idClinica
                ?? rol?.idClinicaEmpleado;

            if (clinica === undefined || clinica === null) {
                return;
            }

            if (typeof clinica !== "object" && (rol?.nombreClinica || rol?.clinicaNombre)) {
                lista.push({
                    idClinica: clinica,
                    nombre: rol.nombreClinica ?? rol.clinicaNombre
                });
                return;
            }

            lista.push(clinica);
        });

        const unicas = new Map();

        lista.forEach((clinica) => {
            if (clinica === undefined || clinica === null || clinica === "") {
                return;
            }

            const id = String(this._idClinica(clinica));
            if (id !== "" && (!unicas.has(id)
                || this._nombreClinica(unicas.get(id)) === "Clínica sin nombre")) {
                unicas.set(id, clinica);
            }
        });

        return Array.from(unicas.values());
    }

    _obtenerRoles(estado) {
        const roles = Array.isArray(estado?.roles)
            ? [...estado.roles]
            : Array.isArray(estado?.usuario?.roles)
                ? [...estado.usuario.roles]
                : [];

        if (estado?.rolSeleccionado) {
            roles.push(estado.rolSeleccionado);
        }

        const unicos = new Map();

        roles.forEach((rol) => {
            if (rol === undefined || rol === null || rol === "") {
                return;
            }

            const id = String(this._idRol(rol));
            if (id !== "" && (!unicos.has(id)
                || this._nombreRol(unicos.get(id)) === "Rol sin nombre")) {
                unicos.set(id, rol);
            }
        });

        return Array.from(unicos.values());
    }

    _idClinica(clinica) {
        if (clinica === undefined || clinica === null || clinica === "") {
            return "";
        }

        if (typeof clinica === "object") {
            const id = clinica.idClinica ?? clinica.id ?? clinica.codigo ?? "";
            return id !== "" && id !== null && id !== undefined ? String(id) : "";
        }

        return String(clinica);
    }

    _nombreClinica(clinica) {
        return [clinica?.nombre, clinica?.name, clinica?.nombreClinica, clinica?.descripcion]
            .find((nombre) => typeof nombre === "string" && nombre.trim() !== "")
            ?? "Clínica sin nombre";
    }

    _idRol(rol) {
        if (rol === undefined || rol === null || rol === "") {
            return "";
        }

        const entidad = rol.rol ?? rol.idRol ?? rol;

        if (entidad && typeof entidad === "object") {
            const id = entidad.idRol ?? entidad.id ?? entidad.codigo ?? rol.idPersonaRol ?? rol.id ?? "";
            return id !== "" && id !== null && id !== undefined ? String(id) : "";
        }

        const id = entidad ?? rol.idPersonaRol ?? rol.id ?? "";
        return id !== "" && id !== null && id !== undefined ? String(id) : "";
    }

    _nombreRol(rol) {
        const entidad = rol?.rol ?? rol?.idRol;
        return [entidad?.nombre, entidad?.name, entidad?.descripcion,
            rol?.nombreRol, rol?.nombre, rol?.name, rol?.descripcion]
            .find((nombre) => typeof nombre === "string" && nombre.trim() !== "")
            ?? "Rol sin nombre";
    }
}

export default DashboardView;

if (!customElements.get("dashboard-view")) {
    customElements.define("dashboard-view", DashboardView);
}
