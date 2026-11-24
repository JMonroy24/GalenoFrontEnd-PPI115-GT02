import { store } from "../../store.js";
import { consultaService, obtenerNombreClinicaConsulta } from "../../control/consulta_service.js";
import { consultaProcedimientoService } from "../../control/consulta_procedimiento_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";
import GestorFechas from "../../control/gestor_fechas.js";
import { navigate, parseRouteParams } from "../../router.js";
import "../../boundary/componentes/stepper_progreso.js";
import "../../boundary/componentes/autocomplete_cie10.js";
import "../../boundary/componentes/lista_examenes.js";

/** Límite de caracteres para Notas de la Consulta. */
const MAX_NOTAS = 2000;

/** Límite de caracteres para Plan de Tratamiento. */
const MAX_PLAN = 2000;

/**
 * Etapas del flujo clínico mostradas en el stepper.
 * Se usan únicamente cuando la consulta todavía no incluye su secuencia.
 */
const ETAPAS_FLUJO = Object.freeze(["Triaje", "Consulta Médica", "Tratamiento", "Cierre"]);

/** Estados de los pasos clínicos. */
const ESTADO_PENDIENTE = "PENDIENTE";
const ESTADO_EN_CURSO = "EN_CURSO";
const ESTADO_COMPLETADO = "COMPLETADO";

/** Textos de acción de la botonera. */
const TEXTO_SIGUIENTE = "Guardar y Avanzar >";
const TEXTO_FINALIZAR = "Finalizar Consulta";

/**
 * Vista de atención médica de una consulta.
 * Presenta el formulario clínico para registrar las notas y el plan de tratamiento.
 *
 * @element atencion-consulta-view
 *
 * @fires consulta-guardada - Se despacha cuando el formulario se envía con éxito.
 * @fires cancelar-atencion - Se despacha cuando el usuario cancela la atención.
 */
export class AtencionConsultaView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        /** @type {object|null} Consulta activa leída del store. */
        this._consulta = null;

        /** @type {boolean} Indica si hay una petición en curso. */
        this._enviando = false;
        this._cargandoConsulta = false;
        this._solicitudConsulta = 0;

        /** @type {Array<object|string>} Diagnósticos CIE-10 seleccionados. */
        this._diagnosticos = [];

        /** @type {number} Paso activo en el stepper (0-based). */
        this._pasoActivo = 0;
        this._indicePasoTrabajo = 0;
        this._soloLectura = false;
        this._etapasFlujo = [...ETAPAS_FLUJO];
        this._borradores = new Map();
        this._conectado = this._enLinea();

        /** @type {object|null} Paso detectado en la secuencia clínica. */
        this._pasoDetectado = null;

        /** @type {Array<object>} Pasos normalizados de la secuencia clínica. */
        this._pasosFlujo = [];

        this._alCambioStore = (evento) => {
            const estado = evento?.detail ?? store.getState();
            const consultaDelStore =
                estado?.consultaActiva ??
                estado?.consultaSeleccionada ??
                estado?.consulta ??
                null;
            const conectado = this._enLinea();
            const cambioConexion = conectado !== this._conectado;
            this._conectado = conectado;

            if (consultaDelStore !== this._consulta) {
                this._consulta = consultaDelStore;
                this._borradores.clear();
                this._diagnosticos = [];
                this._sincronizarPasoActivo();
                this.render();
                this._cargarDatosPasoActivo();
                return;
            }

            if (cambioConexion) {
                this._sincronizarListaExamenes();
                this._actualizarBotonera();
                this._establecerEnviando(this._enviando);
            }
        };
    }

    connectedCallback() {
        // Lee la consulta activa del store al montar
        const estado = store.getState();
        this._consulta =
            estado?.consultaActiva ??
            estado?.consultaSeleccionada ??
            estado?.consulta ??
            null;

        // Si el hash incluye un id (#atencion/<id>), intenta cargar la consulta
        // directamente desde el servicio para soportar acceso directo por URL.
        const { params } = parseRouteParams(window.location.hash);
        if (params.id) {
            if (String(this._idConsulta()) !== String(params.id)) this._consulta = null;
            this._cargarConsultaPorId(params.id);
        }

        this._conectado = this._enLinea();
        this._sincronizarPasoActivo();
        this.render();
        this._cargarDatosPasoActivo();
        store.addEventListener("state-changed", this._alCambioStore);
    }

    disconnectedCallback() {
        this._solicitudConsulta++;
        this._cargandoConsulta = false;
        store.removeEventListener("state-changed", this._alCambioStore);
    }

    /**
     * Carga la consulta desde el servicio usando el id extraído del hash.
     * Refresca también las consultas del store para recuperar su secuencia real.
     *
     * @param {string} id - Identificador de la consulta extraído de la ruta dinámica.
     */
    async _cargarConsultaPorId(id) {
        this._cargandoConsulta = true;
        const solicitud = ++this._solicitudConsulta;
        try {
            const consulta = await consultaService.findById(id);

            if (!consulta || solicitud !== this._solicitudConsulta || !this.isConnected) {
                return;
            }

            this._consulta = consulta;
            this._borradores.clear();
            this._diagnosticos = [];
            this._sincronizarPasoActivo();

            store.setState({
                consultaActiva: consulta,
                consultaSeleccionada: consulta,
                consulta
            });

            // Actualiza la vista con la consulta cargada
            this.render();
            this._cargarDatosPasoActivo();
        } catch (error) {
            if (solicitud !== this._solicitudConsulta || !this.isConnected) return;
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al cargar la consulta",
                    error?.mensaje ?? error?.message ?? "",
                    "error"
                );
            }
        } finally {
            if (solicitud === this._solicitudConsulta) {
                this._cargandoConsulta = false;
                this._establecerEnviando(false);
            }
        }
    }

    // ─── API pública ──────────────────────────────────────────────────────────

    /**
     * Devuelve un objeto limpio con los valores actuales de los campos del formulario,
     * incluyendo los diagnósticos CIE-10 seleccionados.
     *
     * @returns {{ notasConsulta: string, planTratamiento: string, diagnostico: string|Array<object|string>, diagnosticos: Array<object|string> }}
     */
    obtenerDatosFormulario() {
        const notas = this.shadowRoot?.querySelector("#notas");
        const plan = this.shadowRoot?.querySelector("#plan");
        const cie10 = this.shadowRoot?.querySelector("#cie10-busqueda");
        const diagnostico = (this.shadowRoot?.querySelector("#diagnostico")?.value ?? "").trim();
        const diagnosticos = cie10?.obtenerSeleccionados() ?? [...this._diagnosticos];

        return {
            notasConsulta: (notas?.value ?? "").trim(),
            planTratamiento: (plan?.value ?? "").trim(),
            diagnostico: diagnostico || diagnosticos,
            diagnosticos
        };
    }

    /**
     * Rellena los campos del formulario con datos existentes (útil para edición).
     *
     * @param {{ notasConsulta?: string, planTratamiento?: string }} datos
     */
    cargarDatosFormulario(datos = {}) {
        const notas = this.shadowRoot?.querySelector("#notas");
        const plan = this.shadowRoot?.querySelector("#plan");
        const diagnostico = this.shadowRoot?.querySelector("#diagnostico");

        if (diagnostico && typeof datos.diagnostico === "string") {
            diagnostico.value = datos.diagnostico;
        }

        if (notas && datos.notasConsulta !== undefined) {
            notas.value = datos.notasConsulta;
            this._actualizarContador("contador-notas", notas.value.length, MAX_NOTAS);
        }

        if (plan && datos.planTratamiento !== undefined) {
            plan.value = datos.planTratamiento;
            this._actualizarContador("contador-plan", plan.value.length, MAX_PLAN);
        }
    }

    // ─── Sincronización de pasos clínicos ────────────────────────────────────

    /**
     * Detecta el paso activo real de la secuencia clínica y lo sincroniza con
     * el stepper. Usa el primer paso PENDIENTE o EN_CURSO de la secuencia.
     */
    _sincronizarPasoActivo() {
        const pasos = this._obtenerListaPasos(this._consulta);
        this._etapasFlujo = pasos.length > 0
            ? pasos.map((paso, indice) => this._obtenerNombrePaso(paso) || `Paso ${indice + 1}`)
            : [...ETAPAS_FLUJO];
        const detectado = this._detectarPasoActivo(this._consulta);

        this._pasoActivo = detectado.indice;
        this._indicePasoTrabajo = detectado.indice;
        this._soloLectura = false;
        this._pasoDetectado = detectado.paso;
        this._pasosFlujo = pasos.length > 0
            ? pasos
            : this._crearPasosFlujoPorDefecto(detectado.indice);

        this._sincronizarStepper();
        this._sincronizarListaExamenes();
        return detectado;
    }

    _crearPasosFlujoPorDefecto(indiceActivo) {
        return ETAPAS_FLUJO.map((nombre, indice) => ({
            nombre,
            estado: indice < indiceActivo
                ? ESTADO_COMPLETADO
                : indice === indiceActivo
                    ? ESTADO_EN_CURSO
                    : ESTADO_PENDIENTE
        }));
    }

    _sincronizarStepper() {
        const stepper = this.shadowRoot?.querySelector("#stepper-flujo");

        if (!stepper) {
            return;
        }

        stepper.actualizar({
            etapas: this._etapasFlujo,
            estados: this._etapasFlujo.map((_, indice) => (
                this._obtenerEstadoPaso(this._buscarPasoPorIndice(this._pasosFlujo, indice))
            )),
            pasoActivo: this._pasoActivo
        });
    }

    _esPrimerPaso() {
        return this._pasoActivo <= 0;
    }

    _esUltimoPaso() {
        return this._pasoActivo >= this._etapasFlujo.length - 1;
    }

    _detectarPasoActivo(consulta) {
        const pasos = this._obtenerListaPasos(consulta);
        const indiceActivo = pasos.findIndex((paso) => {
            const estado = this._obtenerEstadoPaso(paso);
            return this._esEstadoEnCurso(estado) || this._esEstadoPendiente(estado);
        });

        if (indiceActivo >= 0) {
            return { indice: indiceActivo, paso: pasos[indiceActivo] };
        }

        const explicito =
            consulta?.pasoActivo ??
            consulta?.pasoActual ??
            consulta?.etapaActiva ??
            consulta?.etapaActual ??
            consulta?.indicePasoActivo ??
            null;
        const indiceExplicito = this._resolverIndicePaso(explicito);

        if (indiceExplicito >= 0) {
            return {
                indice: indiceExplicito,
                paso: this._buscarPasoPorIndice(pasos, indiceExplicito)
            };
        }

        return {
            indice: pasos.length > 0 ? pasos.length - 1 : 0,
            paso: pasos.at(-1) ?? null
        };
    }

    _obtenerListaPasos(consulta) {
        if (!consulta || typeof consulta !== "object") {
            return [];
        }

        const candidatos = [
            consulta.pasos,
            consulta.pasosClinicos,
            consulta.consulta_procedimiento_paso,
            consulta.consultaProcedimientoPasos,
            consulta.consultaProcedimientoPasoList,
            consulta.pasos_clinicos,
            consulta.etapas,
            consulta.flujo,
            consulta.historialPasos,
            consulta.historial,
            consulta.atencion?.pasos,
            consulta.consulta?.pasos
        ];

        for (const candidato of candidatos) {
            const lista = this._normalizarListaPasos(candidato);

            if (lista.length > 0) {
                return lista.toSorted((a, b) => (
                    (a.orden ?? a.idProcedimientoPaso?.orden ?? 0)
                    - (b.orden ?? b.idProcedimientoPaso?.orden ?? 0)
                ));
            }
        }

        return [];
    }

    _normalizarListaPasos(valor) {
        if (Array.isArray(valor)) {
            return valor;
        }

        if (!valor || typeof valor !== "object") {
            return [];
        }

        const lista = valor.items
            ?? valor.pasos
            ?? valor.datos
            ?? valor.resultado
            ?? valor.etapas;

        if (Array.isArray(lista)) {
            return lista;
        }

        return lista && typeof lista === "object"
            ? this._normalizarListaPasos(lista)
            : [];
    }

    _obtenerNombrePaso(paso) {
        if (typeof paso === "string") {
            return paso;
        }

        if (!paso || typeof paso !== "object") {
            return "";
        }

        return String(
            paso.nombrePaso
            ?? paso.idProcedimientoPaso?.nombre
            ?? paso.procedimientoPaso?.nombre
            ?? paso.nombre
            ?? paso.etapa
            ?? paso.titulo
            ?? paso.procedimiento?.nombre
            ?? paso.idProcedimiento?.nombre
            ?? ""
        ).trim();
    }

    _obtenerEstadoPaso(paso) {
        if (!paso || typeof paso !== "object") {
            return "";
        }

        const estado = paso.estadoPaso
            ?? paso.estado
            ?? paso.status
            ?? paso.estadoActual
            ?? paso.situacion
            ?? "";

        if (estado && typeof estado === "object") {
            return this._normalizarTexto(
                estado.nombre
                ?? estado.descripcion
                ?? estado.codigo
                ?? estado.estado
                ?? estado.valor
                ?? ""
            );
        }

        return this._normalizarTexto(estado);
    }

    _esEstadoEnCurso(estado) {
        return [
            "EN CURSO",
            "EN PROCESO",
            "ACTIVO",
            "ACTIVA",
            "INICIADO",
            "INICIADA",
            "EN ATENCION"
        ].includes(estado);
    }

    _esEstadoPendiente(estado) {
        return [
            "PENDIENTE",
            "POR INICIAR",
            "NO INICIADO",
            "NO INICIADA",
            "SIN INICIAR",
            "PROGRAMADO",
            "PROGRAMADA"
        ].includes(estado);
    }

    _indiceEtapa(nombre) {
        const texto = this._normalizarTexto(nombre);

        if (texto === "") {
            return -1;
        }

        const indiceReal = this._etapasFlujo.findIndex(
            (etapa) => this._normalizarTexto(etapa) === texto
        );
        if (indiceReal >= 0) return indiceReal;

        if (texto.includes("TRIAGE") || texto.includes("TRIAJE")) {
            return 0;
        }

        if (texto.includes("TRATAMIENTO")) {
            return 2;
        }

        if (texto.includes("CIERRE") || texto.includes("ALTA")) {
            return 3;
        }

        if (
            texto.includes("CONSULTA")
            || texto.includes("ATENCION")
            || texto.includes("EVALUACION")
        ) {
            return 1;
        }

        return -1;
    }

    _resolverIndicePaso(valor) {
        if (valor === undefined || valor === null || valor === "") {
            return -1;
        }

        if (typeof valor === "object") {
            const indicePorNombre = this._indiceEtapa(this._obtenerNombrePaso(valor));

            if (indicePorNombre >= 0) {
                return indicePorNombre;
            }

            return this._resolverIndicePaso(
                valor.indice
                ?? valor.paso
                ?? valor.posicion
                ?? valor.orden
            );
        }

        if (typeof valor === "number") {
            return Number.isFinite(valor) && valor >= 0 && valor < this._etapasFlujo.length
                ? Math.floor(valor)
                : -1;
        }

        const texto = String(valor).trim();

        if (/^\d+$/.test(texto)) {
            const numero = Number(texto);
            return numero >= 0 && numero < this._etapasFlujo.length ? numero : -1;
        }

        return this._indiceEtapa(texto);
    }

    _buscarPasoPorIndice(pasos, indice) {
        return pasos[indice] ?? null;
    }

    _normalizarTexto(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    /**
     * Recupera los datos guardados previamente en el paso activo y los aplica
     * al formulario clínico.
     */
    _cargarDatosPasoActivo() {
        const datos = this._obtenerDatosPasoActivo();

        if (!datos || Object.keys(datos).length === 0) {
            return;
        }

        this.cargarDatosFormulario(datos);

        if (datos.diagnosticos !== undefined) {
            this._diagnosticos = Array.isArray(datos.diagnosticos)
                ? [...datos.diagnosticos]
                : [datos.diagnosticos];

            const cie10 = this.shadowRoot?.querySelector("#cie10-busqueda");
            if (cie10) {
                cie10.seleccionados = [...this._diagnosticos];
            }
        }
    }

    _obtenerDatosPasoActivo() {
        if (this._borradores.has(this._pasoActivo)) {
            return this._borradores.get(this._pasoActivo);
        }
        const datos = {};
        const paso = this._pasoDetectado;
        const consulta = this._consulta;
        const fuentes = [
            paso?.consulta_procedimiento_paso?.valor,
            paso?.valor,
            paso?.datos,
            paso?.formulario,
            paso?.contenido,
            paso?.detalle,
            paso?.registro,
            paso?.atencion,
            paso,
            ...(!paso ? [consulta?.atencion, consulta?.datos, consulta?.consulta, consulta] : [])
        ];

        fuentes.forEach((fuente) => this._acumularDatosFormulario(datos, fuente));

        return datos;
    }

    _acumularDatosFormulario(destino, fuente) {
        if (typeof fuente === "string") {
            try {
                fuente = JSON.parse(fuente);
            } catch (_) {
                return;
            }
        }
        if (!fuente || typeof fuente !== "object" || Array.isArray(fuente)) {
            return;
        }

        const asignarTexto = (clave, valores) => {
            if (destino[clave] !== undefined) {
                return;
            }

            for (const valor of valores) {
                if (valor === undefined || valor === null) {
                    continue;
                }

                const texto = String(valor).trim();
                destino[clave] = texto;
                return;
            }
        };

        asignarTexto("notasConsulta", [
            fuente.notasConsulta,
            fuente.notas,
            fuente.notaConsulta,
            fuente.observaciones,
            fuente.anamnesis,
            fuente.notasMedicas,
            fuente.notas_clinicas
        ]);

        asignarTexto("planTratamiento", [
            fuente.planTratamiento,
            fuente.plan,
            fuente.tratamiento,
            fuente.planManejo,
            fuente.indicaciones,
            fuente.planTerapeutico,
            fuente.plan_manejo
        ]);

        if (typeof fuente.diagnostico === "string" && destino.diagnostico === undefined) {
            destino.diagnostico = fuente.diagnostico;
        }

        if (destino.diagnosticos === undefined) {
            const diagnosticos = fuente.diagnosticos
                ?? (typeof fuente.diagnostico === "string" ? undefined : fuente.diagnostico)
                ?? fuente.cie10
                ?? fuente.codigosCie10
                ?? fuente.codigosCIE10
                ?? fuente.diagnosticosCie10;

            if (diagnosticos !== undefined && diagnosticos !== null && diagnosticos !== "") {
                if (Array.isArray(diagnosticos)) {
                    destino.diagnosticos = diagnosticos;
                } else if (typeof diagnosticos === "string") {
                    const lista = diagnosticos
                        .split(",")
                        .map((item) => item.trim())
                        .filter((item) => item !== "");

                    if (lista.length > 0) {
                        destino.diagnosticos = lista;
                    }
                } else {
                    destino.diagnosticos = [diagnosticos];
                }
            }
        }
    }

    // ─── Renderizado ──────────────────────────────────────────────────────────

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    min-inline-size: 0;
                    container: atencion / inline-size;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
                }

                *, *::before, *::after {
                    box-sizing: border-box;
                }

                /* ── Contenedor principal ── */
                .vista {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6, 1.5rem);
                    max-width: 56rem;
                    margin: 0 auto;
                }

                /* ── Encabezado con resumen de la consulta ── */
                .cabecera {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--space-4, 1rem);
                    padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-primary-soft, #dbeafe);
                }

                .cabecera-titulo {
                    margin: 0 0 var(--space-1, 0.25rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-lg, 1.125rem);
                    font-weight: 700;
                }

                .cabecera > div {
                    min-inline-size: 0;
                    flex: 1 1 16rem;
                }

                .cabecera-meta li {
                    min-inline-size: 0;
                    max-inline-size: 100%;
                    overflow-wrap: anywhere;
                }

                .cabecera-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-1, 0.25rem) var(--space-4, 1rem);
                    margin: 0;
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-sm, 0.875rem);
                    list-style: none;
                    padding: 0;
                }

                .btn-volver {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-1, 0.25rem);
                    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius, 0.5rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text, #0f172a);
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    cursor: pointer;
                    white-space: nowrap;
                }

                .btn-volver:hover {
                    background-color: var(--color-surface-alt, #e2e8f0);
                }

                .btn-volver:focus-visible {
                    outline: var(--focus-width, 3px) solid var(--color-focus, var(--color-primary, #1e3a8a));
                    outline-offset: var(--focus-offset, 3px);
                }

                /* ── Tarjeta de formulario ── */
                .tarjeta {
                    padding: clamp(0.75rem, 3cqi, 1.5rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }

                .tarjeta-titulo {
                    margin: 0 0 var(--space-6, 1.5rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-xl, 1.25rem);
                    font-weight: 700;
                }

                /* ── Formulario ── */
                .form-clinico {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6, 1.5rem);
                }

                /* ── Grupo de campo ── */
                .campo {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2, 0.5rem);
                }

                .campo-cabecera {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: var(--space-2, 0.5rem);
                    flex-wrap: wrap;
                }

                /* ── Etiqueta ── */
                .etiqueta {
                    color: var(--color-text, #0f172a);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                }

                .etiqueta-descripcion {
                    display: block;
                    margin-top: var(--space-1, 0.25rem);
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 400;
                }

                /* ── Contador de caracteres ── */
                .contador {
                    font-size: var(--text-xs, 0.75rem);
                    color: var(--color-text-muted, #475569);
                    text-align: right;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .contador[data-sobrepasado="true"] {
                    color: var(--color-error, #b91c1c);
                    font-weight: 600;
                }

                /* ── Textarea ── */
                .textarea {
                    width: 100%;
                    min-height: 8rem;
                    padding: var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius, 0.5rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text, #0f172a);
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    line-height: 1.6;
                    resize: vertical;
                    field-sizing: content;
                    block-size: auto;
                    min-block-size: 6lh;
                    max-block-size: min(24lh, 60dvh);
                    overflow-y: auto;
                    overflow-x: hidden;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }

                .textarea::placeholder {
                    color: var(--color-text-muted, #475569);
                    opacity: 1;
                }

                input.textarea {
                    min-height: 2.75rem;
                    min-block-size: 2.75rem;
                    field-sizing: fixed;
                    resize: none;
                }

                .textarea:focus-visible {
                    outline: var(--focus-width) solid var(--color-focus);
                    outline-offset: var(--focus-offset);
                    border-color: var(--color-primary, #1e3a8a);
                    box-shadow: 0 0 0 3px var(--color-primary-soft, #dbeafe);
                }

                .textarea[aria-invalid="true"] {
                    border-color: var(--color-error, #b91c1c);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error, #b91c1c) 15%, transparent);
                }

                /* ── Mensaje de error en campo ── */
                .error-campo {
                    min-height: 1rem;
                    color: var(--color-error, #b91c1c);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 500;
                }

                /* ── Divisor entre secciones ── */
                .divisor {
                    height: 1px;
                    border: none;
                    background-color: var(--color-surface-alt, #e2e8f0);
                    margin: 0;
                }

                /* ── Acciones del formulario ── */
                .acciones {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: var(--space-3, 0.75rem);
                    padding-top: var(--space-4, 1rem);
                    border-top: var(--border-width, 1px) solid var(--color-surface-alt, #e2e8f0);
                }

                .aviso-offline {
                    flex-basis: 100%;
                    margin: 0;
                    padding: var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) solid var(--color-warning, #b45309);
                    border-radius: var(--radius, 0.5rem);
                    background-color: var(--color-warning-soft, #fef3c7);
                    color: var(--color-text, #0f172a);
                    font-size: var(--text-sm, 0.875rem);
                }

                .btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-2, 0.5rem);
                    min-height: 2.75rem;
                    padding: var(--space-2, 0.5rem) var(--space-5, 1.25rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius, 0.5rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text, #0f172a);
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.15s ease, border-color 0.15s ease;
                }

                .btn:hover {
                    background-color: var(--color-surface-alt, #e2e8f0);
                }

                .btn:focus-visible {
                    outline: var(--focus-width, 3px) solid var(--color-focus, var(--color-primary, #1e3a8a));
                    outline-offset: var(--focus-offset, 3px);
                }

                .btn:disabled {
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .btn-cancelar {
                    border-color: var(--color-border, #64748b);
                }

                .btn-guardar {
                    border-color: var(--color-primary, #1e3a8a);
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                }

                .btn-guardar:hover:not(:disabled) {
                    border-color: var(--color-primary-hover, #172554);
                    background-color: var(--color-primary-hover, #172554);
                }

                .btn-guardar-notas {
                    border-color: var(--color-secondary, #0369a1);
                    background-color: var(--color-secondary, #0369a1);
                    color: #ffffff;
                }

                .btn-guardar-notas:hover:not(:disabled) {
                    border-color: var(--color-secondary-hover, #075985);
                    background-color: var(--color-secondary-hover, #075985);
                }

                /* ── Spinner de carga ── */
                .spinner {
                    display: none;
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid currentColor;
                    border-right-color: transparent;
                    border-radius: 9999px;
                    animation: girar 0.75s linear infinite;
                    flex-shrink: 0;
                }

                .btn-guardar.enviando .spinner {
                    display: inline-block;
                }

                @keyframes girar {
                    to { transform: rotate(360deg); }
                }

                /* ── Aviso sin consulta activa ── */
                .aviso-sin-consulta {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--space-4, 1rem);
                    padding: var(--space-8, 2rem) var(--space-4, 1rem);
                    text-align: center;
                    color: var(--color-text-muted, #475569);
                }

                .aviso-sin-consulta p {
                    margin: 0;
                    font-size: var(--text-sm, 0.875rem);
                }

                /* ── Responsivo ── */
                @container atencion (inline-size < 40rem) {
                    .tarjeta {
                        padding: var(--space-4, 1rem);
                    }

                    .cabecera {
                        padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    }

                    .acciones {
                        flex-direction: column;
                    }

                    .btn {
                        width: 100%;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .spinner {
                        animation-duration: 0.01ms;
                    }
                    .textarea,
                    .btn {
                        transition: none;
                    }
                }

                /* ── Stepper ── */
                .stepper-contenedor {
                    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }

                /* ── Campo CIE-10 ── */
                .campo-cie10-descripcion {
                    display: block;
                    margin-top: var(--space-1, 0.25rem);
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 400;
                }
            </style>

            <section class="vista" aria-labelledby="titulo-vista">
                ${this._htmlCabecera()}

                <div class="stepper-contenedor">
                    <stepper-progreso
                        id="stepper-flujo"
                        paso-activo="${this._pasoActivo}"
                    ></stepper-progreso>
                </div>

                <div class="tarjeta" role="main">
                    <h2 class="tarjeta-titulo" id="titulo-vista">Registro de Atención Médica</h2>

                    ${this._consulta
                        ? this._htmlFormulario()
                        : this._htmlSinConsulta()}
                </div>
            </section>
        `;

        this._conectarEventos();
        this._aplicarValidacionesPaso(this._pasoActivo);
        this._establecerEnviando(this._enviando);
    }

    // ─── Fragmentos HTML ──────────────────────────────────────────────────────

    /**
     * Calcula la edad en años a partir de una fecha de nacimiento (string ISO "YYYY-MM-DD" o Date).
     * Devuelve null si la fecha no es válida.
     * @param {string|Date|null|undefined} fechaNacimiento
     * @returns {number|null}
     */
    _calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return null;
        try {
            const iso = GestorFechas.extraerFechaCalendario(fechaNacimiento);
            if (!iso) return null;
            const [anio, mes, dia] = iso.split("-").map(Number);
            const hoy = new Date();
            let edad = hoy.getFullYear() - anio;
            const cumplioMes = hoy.getMonth() + 1 > mes
                || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
            if (!cumplioMes) edad--;
            return edad >= 0 ? edad : null;
        } catch {
            return null;
        }
    }

    /**
     * Extrae el número de documento del paciente de múltiples estructuras posibles.
     * @param {object|null} consulta
     * @returns {string}
     */
    _documentoPaciente(consulta) {
        if (!consulta) return "";
        const p = consulta.paciente ?? consulta.persona ?? consulta.cita?.paciente ?? null;
        if (!p) return "";
        return String(
            p.numeroDocumento ?? p.documento ?? p.dui ?? p.identificacion
            ?? p.persona?.numeroDocumento ?? p.persona?.documento ?? ""
        ).trim();
    }

    /**
     * Extrae la fecha de nacimiento del paciente de múltiples estructuras posibles.
     * @param {object|null} consulta
     * @returns {string}
     */
    _fechaNacimientoPaciente(consulta) {
        if (!consulta) return "";
        const p = consulta.paciente ?? consulta.persona ?? consulta.cita?.paciente ?? null;
        if (!p) return "";
        return String(
            p.fechaNacimiento ?? p.birthDate ?? p.birth_date ?? p.fecha_nacimiento
            ?? p.persona?.fechaNacimiento ?? p.persona?.birthDate ?? ""
        ).trim();
    }

    _htmlCabecera() {
        const consulta = this._consulta;
        const idConsulta = consulta?.idConsulta ?? consulta?.id ?? "—";
        const fuentes = [consulta, consulta?.consulta, consulta?.cita, consulta?.consulta?.cita].filter(Boolean);
        const fechaOriginal = fuentes.flatMap((datos) => [
            datos.inicio, datos.fecha, datos.fechaConsulta, datos.fechaCita, datos.fechaHora, datos.fechaInicio
        ]).find((valor) => GestorFechas.extraerFechaCalendario(valor));
        const fecha = this._formatearFecha(fechaOriginal);
        const hora = consulta?.hora ?? consulta?.cita?.hora ?? "";
        const paciente = this._nombrePaciente(consulta);
        const clinica = obtenerNombreClinicaConsulta(consulta);
        const documento = this._documentoPaciente(consulta);
        const fechaNac = this._fechaNacimientoPaciente(consulta);
        const edad = this._calcularEdad(fechaNac);

        return `
            <header class="cabecera">
                <div>
                    <h1 class="cabecera-titulo">Atención de Consulta</h1>
                    <ul class="cabecera-meta" aria-label="Datos del paciente y la consulta">
                        ${idConsulta !== "—" ? `<li>Consulta #${this._escapar(String(idConsulta))}</li>` : ""}
                        ${paciente ? `<li><strong>${this._escapar(paciente)}</strong>${edad !== null ? ` · ${edad} años` : ""}</li>` : ""}
                        ${documento ? `<li>Doc: ${this._escapar(documento)}</li>` : ""}
                        ${fecha ? `<li>Fecha: ${this._escapar(fecha)}${hora ? ` · ${this._escapar(hora)}` : ""}</li>` : ""}
                        ${clinica ? `<li>Clínica: ${this._escapar(String(clinica))}</li>` : ""}
                        ${!consulta ? `<li>Sin consulta activa</li>` : ""}
                    </ul>
                </div>
                <button
                    type="button"
                    class="btn-volver"
                    id="btn-volver"
                    aria-label="Volver al panel de citas"
                >
                    ← Volver
                </button>
            </header>
        `;
    }

    _htmlFormulario() {
        return `
            <form
                class="form-clinico"
                id="form-clinico"
                novalidate
                aria-label="Formulario de registro médico"
            >
                <p id="aviso-lectura" role="status" hidden>Está consultando un paso completado en modo lectura.</p>
                <!-- ── Campo: Notas de la Consulta ── -->
                <div class="campo" id="grupo-notas">
                    <div class="campo-cabecera">
                        <label class="etiqueta" for="notas">
                            Notas de la Consulta
                            <span class="etiqueta-descripcion">
                                Anamnesis, hallazgos relevantes y observaciones del médico.
                            </span>
                        </label>
                        <span
                            class="contador"
                            id="contador-notas"
                            aria-live="polite"
                            aria-atomic="true"
                            aria-label="Caracteres utilizados en Notas de la Consulta"
                        >0 / ${MAX_NOTAS}</span>
                    </div>
                    <textarea
                        class="textarea"
                        id="notas"
                        name="notasConsulta"
                        rows="6"
                        maxlength="${MAX_NOTAS}"
                        aria-describedby="contador-notas error-notas"
                        aria-required="false"
                        aria-invalid="false"
                        placeholder="Describa los síntomas reportados por el paciente, los hallazgos de la exploración física y cualquier observación clínica relevante…"
                        spellcheck="true"
                        autocomplete="off"
                    ></textarea>
                    <span
                        class="error-campo"
                        id="error-notas"
                        role="alert"
                        aria-live="assertive"
                    ></span>
                </div>

                <hr class="divisor" aria-hidden="true">

                <!-- ── Campo: Plan de Tratamiento ── -->
                <div class="campo" id="grupo-plan">
                    <div class="campo-cabecera">
                        <label class="etiqueta" for="plan">
                            Plan de Tratamiento
                            <span class="etiqueta-descripcion">
                                Diagnóstico, medicación prescrita, indicaciones y seguimiento.
                            </span>
                        </label>
                        <span
                            class="contador"
                            id="contador-plan"
                            aria-live="polite"
                            aria-atomic="true"
                            aria-label="Caracteres utilizados en Plan de Tratamiento"
                        >0 / ${MAX_PLAN}</span>
                    </div>
                    <textarea
                        class="textarea"
                        id="plan"
                        name="planTratamiento"
                        rows="6"
                        maxlength="${MAX_PLAN}"
                        aria-describedby="contador-plan error-plan"
                        aria-required="false"
                        aria-invalid="false"
                        placeholder="Especifique el diagnóstico, los medicamentos recetados (nombre, dosis, frecuencia), procedimientos indicados y las instrucciones de seguimiento para el paciente…"
                        spellcheck="true"
                        autocomplete="off"
                    ></textarea>
                    <span
                        class="error-campo"
                        id="error-plan"
                        role="alert"
                        aria-live="assertive"
                    ></span>
                </div>

                <!-- ── Campo: Diagnósticos CIE-10 ── -->
                <div class="campo" id="grupo-cie10">
                    <label class="etiqueta" for="diagnostico">
                        Diagnóstico
                    </label>
                    <input id="diagnostico" name="diagnostico" type="text" class="textarea"
                        autocomplete="off" placeholder="Registre el diagnóstico clínico">
                    <label class="etiqueta">
                        Códigos CIE-10
                        <span class="campo-cie10-descripcion">
                            Busque y seleccione uno o varios códigos de diagnóstico.
                        </span>
                    </label>
                    <auto-complete-cie10
                        id="cie10-busqueda"
                        aria-label="Buscador de diagnósticos CIE-10"
                    ></auto-complete-cie10>
                </div>

                <!-- ── Órdenes de Exámenes ── -->
                <div class="campo" id="grupo-examenes">
                    <lista-examenes-asignables
                        id="lista-examenes"
                        id-consulta="${this._escapar(String(this._idConsulta() ?? ""))}"
                        id-paso="${this._escapar(String(this._idPasoActivo() ?? ""))}"
                    ></lista-examenes-asignables>
                </div>

                <hr class="divisor" aria-hidden="true">

                ${this._htmlAcciones()}
            </form>
        `;
    }

    _htmlAcciones() {
        return `
                <!-- ── Acciones ── -->
                <div class="acciones">
                    ${this._sinConexion() ? `
                    <p id="aviso-offline" class="aviso-offline" role="status" aria-live="polite">
                        Sin conexión: guardar, avanzar, cambiar de paso y asignar exámenes están deshabilitados.
                        Lo escrito se conserva y las acciones se reactivarán al volver la red.
                    </p>` : ""}
                    <button type="button" class="btn btn-cancelar" id="btn-cancelar">
                        Cancelar
                    </button>
                    ${this._soloLectura ? '<button type="button" class="btn" id="btn-retomar">Volver al paso activo</button>' : ''}
                    <button
                        type="button"
                        class="btn btn-anterior"
                        id="btn-anterior"
                        ${this._esPrimerPaso() ? "disabled" : ""}
                    >
                        &lt; Anterior
                    </button>
                    ${!this._soloLectura ? `
                    <button type="button" class="btn btn-guardar-notas" id="btn-guardar-notas" aria-busy="false">
                        <span class="spinner" aria-hidden="true"></span>
                        <span class="btn-guardar-notas-texto">Guardar Notas</span>
                    </button>` : ''}
                    ${this._esUltimoPaso()
                        ? `
                    <button type="submit" class="btn btn-guardar btn-finalizar" id="btn-finalizar" aria-busy="false">
                        <span class="spinner" aria-hidden="true"></span>
                        <span class="btn-guardar-texto">${TEXTO_FINALIZAR}</span>
                    </button>`
                        : `
                    <button type="submit" class="btn btn-guardar" id="btn-siguiente" aria-busy="false">
                        <span class="spinner" aria-hidden="true"></span>
                        <span class="btn-guardar-texto">${TEXTO_SIGUIENTE}</span>
                    </button>`}
                </div>
        `;
    }

    _htmlSinConsulta() {
        return `
            <div class="aviso-sin-consulta" role="status">
                <p>No hay una consulta activa seleccionada.</p>
                <p>Regrese al panel de citas y seleccione una consulta para atender.</p>
            </div>
        `;
    }

    // ─── Eventos ──────────────────────────────────────────────────────────────

    _conectarEventos() {
        const form = this.shadowRoot.querySelector("#form-clinico");
        const btnVolver = this.shadowRoot.querySelector("#btn-volver");
        const textareaNotas = this.shadowRoot.querySelector("#notas");
        const textareaPlan = this.shadowRoot.querySelector("#plan");

        // ── Stepper: sincronizar estados y escuchar clics de paso ──
        const stepper = this.shadowRoot.querySelector("#stepper-flujo");
        if (stepper) {
            this._sincronizarStepper();
            stepper.addEventListener("paso-click", (evento) => {
                const indice = evento.detail?.indice;
                const estado = this._obtenerEstadoPaso(this._pasosFlujo[indice]);
                if (indice === this._indicePasoTrabajo
                    || (indice < this._indicePasoTrabajo && estado === ESTADO_COMPLETADO)) {
                    this._seleccionarPaso(indice);
                }
            });
        }

        // ── Auto-complete CIE-10: restaurar selección previa y escuchar cambios ──
        const cie10 = this.shadowRoot.querySelector("#cie10-busqueda");
        if (cie10) {
            if (this._diagnosticos.length > 0) {
                cie10.seleccionados = [...this._diagnosticos];
            }
            cie10.addEventListener("cie10-change", (evento) => {
                this._diagnosticos = evento.detail?.seleccionados ?? [];
            });
        }

        // ── Órdenes de exámenes: vincular siempre al paso activo ──
        const listaExamenes = this.shadowRoot.querySelector("#lista-examenes");
        if (listaExamenes) {
            this._sincronizarListaExamenes();
            listaExamenes.addEventListener("ordenes-asignadas", (evento) => {
                this._alAsignarOrdenesExamen(evento.detail);
            });
        }

        btnVolver?.addEventListener("click", () => this._volverAlDashboard());
        this._conectarEventosAcciones();

        if (textareaNotas) {
            textareaNotas.addEventListener("input", () => {
                this._actualizarContador("contador-notas", textareaNotas.value.length, MAX_NOTAS);
                this._limpiarErrorCampo("notas");
            });
        }

        if (textareaPlan) {
            textareaPlan.addEventListener("input", () => {
                this._actualizarContador("contador-plan", textareaPlan.value.length, MAX_PLAN);
                this._limpiarErrorCampo("plan");
            });
        }

        form?.addEventListener("submit", (evento) => {
            evento.preventDefault();
            this._alEnviarFormulario();
        });
    }

    _conectarEventosAcciones() {
        const btnCancelar = this.shadowRoot.querySelector("#btn-cancelar");
        const btnAnterior = this.shadowRoot.querySelector("#btn-anterior");

        btnCancelar?.addEventListener("click", () => this._cancelar());
        btnAnterior?.addEventListener("click", () => this._retrocederPaso());
        this.shadowRoot.querySelector("#btn-retomar")?.addEventListener("click", () => {
            this._seleccionarPaso(this._indicePasoTrabajo);
        });
        this.shadowRoot.querySelector("#btn-guardar-notas")?.addEventListener("click", () => {
            this._guardarNotas();
        });
    }

    // ─── Lógica de negocio ────────────────────────────────────────────────────

    _enLinea() {
        return store.getState()?.online !== false && globalThis.navigator?.onLine !== false;
    }

    _sinConexion() {
        return !this._enLinea();
    }

    _idConsulta() {
        return this._consulta?.idConsulta ?? this._consulta?.id ?? null;
    }

    _idPasoActivo() {
        const pasoLocal = this._buscarPasoPorIndice(this._pasosFlujo, this._pasoActivo);
        return this._idPaso(pasoLocal ?? this._pasoDetectado);
    }

    _idPaso(paso) {
        return paso?.idConsultaProcedimientoPaso
            ?? paso?.consulta_procedimiento_paso?.idConsultaProcedimientoPaso
            ?? paso?.idPaso
            ?? paso?.idPasoClinico
            ?? paso?.id
            ?? null;
    }

    _sincronizarListaExamenes() {
        const lista = this.shadowRoot?.querySelector("#lista-examenes");

        if (!lista) {
            return;
        }

        const idConsulta = this._idConsulta();
        const idPaso = this._idPasoActivo();

        if (idConsulta === null || idConsulta === undefined || idConsulta === "") {
            lista.removeAttribute("id-consulta");
        } else {
            lista.setAttribute("id-consulta", String(idConsulta));
        }

        lista.removeAttribute("id-paso-clinico");

        if (idPaso === null || idPaso === undefined || idPaso === "") {
            lista.removeAttribute("id-paso");
        } else {
            lista.setAttribute("id-paso", String(idPaso));
        }

        lista.toggleAttribute("sin-conexion", this._sinConexion());
    }

    _alAsignarOrdenesExamen(detalle) {
        if (!detalle) {
            return;
        }

        if (String(detalle.idConsulta) !== String(this._idConsulta())) return;
        const paso = detalle.idPaso != null
            ? this._pasosFlujo.find((item) => String(this._idPaso(item)) === String(detalle.idPaso))
            : this._pasoDetectado;

        if (paso) {
            paso.ordenesExamen = [
                ...(Array.isArray(paso.ordenesExamen) ? paso.ordenesExamen : []),
                ...(Array.isArray(detalle.ordenes) ? detalle.ordenes : [])
            ];
        }

        this.dispatchEvent(new CustomEvent("ordenes-examen-asignadas", {
            bubbles: true,
            composed: true,
            detail: detalle
        }));
    }

    _crearPayloadPaso(indice, estado, datos = {}) {
        const pasoLocal = this._buscarPasoPorIndice(this._pasosFlujo, indice);
        const datosPaso = datos && Object.keys(datos).length > 0
            ? datos
            : this._datosGuardadosPaso(pasoLocal);

        return {
            estadoPaso: estado,
            valor: consultaProcedimientoService.serializarValorPaso(datosPaso)
        };
    }

    _datosGuardadosPaso(paso) {
        if (!paso || typeof paso !== "object") {
            return {};
        }

        const datos = {};
        const fuentes = [
            paso.consulta_procedimiento_paso?.valor,
            paso.valor,
            paso.datos
        ];

        fuentes.forEach((fuente) => this._acumularDatosFormulario(datos, fuente));
        return datos;
    }

    async _persistirPaso(indice, estado, datos = {}) {
        if (!this._consulta) {
            throw new Error("No hay una consulta activa para guardar el paso.");
        }

        const pasoLocal = this._buscarPasoPorIndice(this._pasosFlujo, indice);
        const idPaso = this._idPaso(pasoLocal ?? this._pasoDetectado);

        if (!idPaso) {
            throw new Error("El paso activo no tiene un identificador válido para guardar.");
        }

        const respuesta = await consultaProcedimientoService.guardarPaso(
            idPaso,
            this._crearPayloadPaso(indice, estado, datos)
        );
        const pasoGuardado = respuesta?.paso ?? respuesta?.consulta_procedimiento_paso
            ?? (respuesta?.idConsultaProcedimientoPaso != null || respuesta?.idPaso != null ? respuesta : null);
        if (pasoLocal && pasoGuardado && typeof pasoGuardado === "object") {
            Object.assign(pasoLocal, pasoGuardado);
        }
        return respuesta;
    }

    _actualizarEstadoPasoLocal(indice, estado, datos = null) {
        let paso = this._buscarPasoPorIndice(this._pasosFlujo, indice);

        if (!paso) {
            paso = { nombre: this._etapasFlujo[indice] ?? "", estado };
            this._pasosFlujo[indice] = paso;
        }

        paso.estado = estado;
        paso.estadoPaso = estado;

        if (estado === ESTADO_COMPLETADO) {
            paso.fechaHoraEjecucion =
                paso.fechaHoraEjecucion ?? new Date().toISOString();
        }

        if (datos) {
            paso.datos = { ...(paso.datos ?? {}), ...datos };
            paso.valor = consultaProcedimientoService.serializarValorPaso(datos);
            if (paso.consulta_procedimiento_paso) {
                paso.consulta_procedimiento_paso.valor = paso.valor;
            }
            this._borradores.delete(indice);
        }

        return paso;
    }

    _seleccionarPaso(indice) {
        if (this._enviando || this._cargandoConsulta) {
            return null;
        }

        const indicePaso = this._resolverIndicePaso(indice);

        if (indicePaso < 0 || indicePaso >= this._etapasFlujo.length) {
            return null;
        }

        if (!this._soloLectura) {
            this._borradores.set(this._pasoActivo, this.obtenerDatosFormulario());
        }
        this._pasoActivo = indicePaso;
        this._pasoDetectado = this._buscarPasoPorIndice(this._pasosFlujo, indicePaso);
        this._soloLectura = indicePaso < this._indicePasoTrabajo
            && this._obtenerEstadoPaso(this._pasoDetectado) === ESTADO_COMPLETADO;
        if (this._soloLectura) this._borradores.delete(indicePaso);

        this._limpiarFormularioPaso();
        this._cargarDatosPasoActivo();
        this._aplicarValidacionesPaso(indicePaso);
        this._sincronizarStepper();
        this._sincronizarListaExamenes();
        this._actualizarBotonera();
        this._establecerEnviando(this._enviando);

        return this._pasoDetectado;
    }

    _limpiarFormularioPaso() {
        const notas = this.shadowRoot?.querySelector("#notas");
        const plan = this.shadowRoot?.querySelector("#plan");
        const cie10 = this.shadowRoot?.querySelector("#cie10-busqueda");
        const diagnostico = this.shadowRoot?.querySelector("#diagnostico");
        if (diagnostico) diagnostico.value = "";

        if (notas) {
            notas.value = "";
            this._actualizarContador("contador-notas", 0, MAX_NOTAS);
        }

        if (plan) {
            plan.value = "";
            this._actualizarContador("contador-plan", 0, MAX_PLAN);
        }

        if (cie10) {
            cie10.seleccionados = [];
        }

        this._diagnosticos = [];
    }

    _aplicarValidacionesPaso(indicePaso) {
        const paso = this._buscarPasoPorIndice(this._pasosFlujo, indicePaso);
        const estado = this._obtenerEstadoPaso(paso);

        this._limpiarErrorCampo("notas");
        this._limpiarErrorCampo("plan");

        const formulario = this.shadowRoot?.querySelector("#form-clinico");
        if (formulario) {
            formulario.dataset.paso = String(indicePaso);
            formulario.dataset.estadoPaso = estado.replace(/ /g, "_") || ESTADO_PENDIENTE;
        }
    }

    _actualizarBotonera() {
        const acciones = this.shadowRoot?.querySelector(".acciones");

        if (!acciones) {
            return;
        }

        acciones.outerHTML = this._htmlAcciones();
        this._conectarEventosAcciones();
    }

    _irAPaso(indice) {
        this._pasoActivo = indice;
        this._indicePasoTrabajo = indice;
        this._soloLectura = false;
        this._pasoDetectado = this._buscarPasoPorIndice(this._pasosFlujo, indice);
        this._diagnosticos = [];
        this.render();
        this._sincronizarListaExamenes();
        this._cargarDatosPasoActivo();
        this._publicarConsulta();
    }

    _publicarConsulta() {
        if (!this._consulta) return;
        this._consulta = {
            ...this._consulta,
            pasos: this._pasosFlujo,
            pasosClinicos: this._pasosFlujo,
            pasoActivo: this._pasoActivo
        };
        store.setState({
            consultaActiva: this._consulta,
            consultaSeleccionada: this._consulta,
            consulta: this._consulta
        });
    }

    _obtenerDatosValidados() {
        const datos = this.obtenerDatosFormulario();
        const hayDatos =
            datos.notasConsulta.length > 0 ||
            datos.planTratamiento.length > 0 || datos.diagnosticos.length > 0
            || (typeof datos.diagnostico === "string" && datos.diagnostico.length > 0);

        if (!hayDatos) {
            this._marcarError(
                "notas",
                "Complete al menos uno de los campos antes de guardar."
            );
            this.shadowRoot.querySelector("#notas")?.focus();
            return null;
        }

        if (datos.notasConsulta.length > MAX_NOTAS || datos.planTratamiento.length > MAX_PLAN) {
            this._marcarError("notas", "Las notas y el plan admiten hasta 2000 caracteres cada uno.");
            return null;
        }

        return datos;
    }

    _alEnviarFormulario() {
        if (this._cargandoConsulta || this._soloLectura || this._sinConexion()) return;
        if (this._esUltimoPaso()) {
            return this._finalizarConsulta();
        }

        return this._avanzarPaso();
    }

    /**
     * Guarda las notas y datos del paso actual sin avanzar ni retroceder.
     * Corresponde al botón "Guardar Notas" de la HU4.
     */
    async _guardarNotas() {
        if (this._enviando || this._cargandoConsulta || this._soloLectura || this._sinConexion()) {
            return;
        }

        const datos = this._obtenerDatosValidados();

        if (!datos) {
            return;
        }

        const pasoActual = this._pasoActivo;
        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoActual, ESTADO_EN_CURSO, datos);
            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_EN_CURSO, datos);
            this._borradores.set(pasoActual, datos);

            GeneradorMensajes.crearMensaje(
                "Notas guardadas",
                "Los datos del paso actual han sido guardados correctamente.",
                "success"
            );

            this.dispatchEvent(new CustomEvent("consulta-guardada", {
                bubbles: true,
                composed: true,
                detail: {
                    datos,
                    consulta: this._consulta,
                    pasoActivo: pasoActual,
                    soloNotas: true
                }
            }));
        } catch (error) {
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al guardar",
                    error?.mensaje ?? error?.message ?? "No se pudieron guardar las notas.",
                    "error"
                );
            }
        } finally {
            this._establecerEnviando(false);
        }
    }

    async _retrocederPaso() {
        if (this._enviando || this._cargandoConsulta || this._soloLectura || this._esPrimerPaso() || this._sinConexion()) {
            return;
        }

        const pasoActual = this._pasoActivo;
        const pasoAnterior = pasoActual - 1;
        const datos = this.obtenerDatosFormulario();

        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoActual, ESTADO_PENDIENTE, datos);
            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_PENDIENTE, datos);
            await this._activarPaso(pasoAnterior);
            this._irAPaso(pasoAnterior);
        } catch (error) {
            this._sincronizarStepper();
            this._aplicarValidacionesPaso(this._pasoActivo);
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al retroceder",
                    error?.mensaje ?? error?.message ?? "No se pudo actualizar el paso anterior.",
                    "error"
                );
            }
        } finally {
            this._establecerEnviando(false);
        }
    }

    async _avanzarPaso() {
        if (this._enviando || this._cargandoConsulta || this._soloLectura || this._esUltimoPaso() || this._sinConexion()) {
            return;
        }

        const datos = this._obtenerDatosValidados();

        if (!datos) {
            return;
        }

        const pasoActual = this._pasoActivo;
        const pasoSiguiente = pasoActual + 1;
        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoActual, ESTADO_COMPLETADO, datos);
            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_COMPLETADO, datos);
            await this._activarPaso(pasoSiguiente);
            this._irAPaso(pasoSiguiente);

            GeneradorMensajes.crearMensaje(
                "Paso guardado",
                "Puede continuar con el siguiente paso de la atención.",
                "success"
            );

            this.dispatchEvent(new CustomEvent("consulta-guardada", {
                bubbles: true,
                composed: true,
                detail: {
                    datos,
                    consulta: this._consulta,
                    pasoActivo: pasoSiguiente
                }
            }));
        } catch (error) {
            this._sincronizarStepper();
            this._aplicarValidacionesPaso(this._pasoActivo);
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al guardar",
                    error?.mensaje ?? error?.message ?? "No se pudo guardar el paso.",
                    "error"
                );
            }
        } finally {
            this._establecerEnviando(false);
        }
    }

    async _activarPaso(indice) {
        for (let i = 0; i < this._pasosFlujo.length; i++) {
            if (i !== indice && this._esEstadoEnCurso(this._obtenerEstadoPaso(this._pasosFlujo[i]))) {
                await this._persistirPaso(i, ESTADO_PENDIENTE);
                this._actualizarEstadoPasoLocal(i, ESTADO_PENDIENTE);
            }
        }
        await this._persistirPaso(indice, ESTADO_EN_CURSO);
        this._actualizarEstadoPasoLocal(indice, ESTADO_EN_CURSO);
    }

    async _finalizarConsulta() {
        if (this._enviando || this._cargandoConsulta || this._soloLectura || !this._esUltimoPaso() || this._sinConexion()) {
            return;
        }

        const datos = this._obtenerDatosValidados();

        if (!datos) {
            return;
        }

        const pasoActual = this._pasoActivo;
        const fechaFin = new Date().toISOString();

        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoActual, ESTADO_COMPLETADO, datos);

            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_COMPLETADO, datos);

            if (this._consulta) {
                this._consulta.fechaFin = fechaFin;
                this._consulta.fechaHoraFin = fechaFin;
                this._consulta.estado = "FINALIZADA";
            }
            this._publicarConsulta();

            GeneradorMensajes.crearMensaje(
                "Consulta finalizada",
                "La atención médica se registró y cerró correctamente.",
                "success"
            );

            this.dispatchEvent(new CustomEvent("consulta-guardada", {
                bubbles: true,
                composed: true,
                detail: {
                    datos,
                    consulta: this._consulta,
                    pasoActivo: pasoActual,
                    fechaFin,
                    finalizada: true
                }
            }));

            window.location.hash = "#dashboard";
        } catch (error) {
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al finalizar",
                    error?.mensaje ?? error?.message ?? "No se pudo finalizar la consulta.",
                    "error"
                );
            }
        } finally {
            this._establecerEnviando(false);
        }
    }

    _cancelar() {
        this.dispatchEvent(new CustomEvent("cancelar-atencion", {
            bubbles: true,
            composed: true,
            detail: { consulta: this._consulta }
        }));
        this._volverAlDashboard();
    }

    _volverAlDashboard() {
        navigate("#dashboard");
    }

    // ─── Ayudantes de UI ──────────────────────────────────────────────────────

    /**
     * Actualiza el texto del contador de caracteres y su estado visual.
     * @param {string} idContador
     * @param {number} actual
     * @param {number} maximo
     */
    _actualizarContador(idContador, actual, maximo) {
        const contador = this.shadowRoot?.querySelector(`#${idContador}`);
        if (!contador) return;

        contador.textContent = `${actual} / ${maximo}`;
        const sobrepasado = actual >= maximo;
        contador.dataset.sobrepasado = String(sobrepasado);
        contador.setAttribute("aria-label",
            `${actual} de ${maximo} caracteres utilizados${sobrepasado ? " — límite alcanzado" : ""}`
        );
    }

    /**
     * Muestra un mensaje de error bajo el campo indicado.
     * @param {"notas"|"plan"} campo
     * @param {string} mensaje
     */
    _marcarError(campo, mensaje) {
        const idSpan = campo === "notas" ? "error-notas" : "error-plan";
        const idTextarea = campo === "notas" ? "notas" : "plan";
        const span = this.shadowRoot?.querySelector(`#${idSpan}`);
        const textarea = this.shadowRoot?.querySelector(`#${idTextarea}`);

        if (span) {
            span.textContent = mensaje;
        }
        if (textarea) {
            textarea.setAttribute("aria-invalid", "true");
        }
    }

    /**
     * Limpia el mensaje de error bajo el campo indicado.
     * @param {"notas"|"plan"} campo
     */
    _limpiarErrorCampo(campo) {
        const idSpan = campo === "notas" ? "error-notas" : "error-plan";
        const idTextarea = campo === "notas" ? "notas" : "plan";
        const span = this.shadowRoot?.querySelector(`#${idSpan}`);
        const textarea = this.shadowRoot?.querySelector(`#${idTextarea}`);

        if (span) span.textContent = "";
        if (textarea) textarea.setAttribute("aria-invalid", "false");
    }

    /**
     * Habilita o deshabilita el estado de envío del formulario.
     * @param {boolean} enviando
     */
    _establecerEnviando(enviando) {
        this._enviando = enviando;
        enviando = enviando || this._cargandoConsulta;
        const sinConexion = this._sinConexion();
        const btn = this.shadowRoot?.querySelector("#btn-siguiente, #btn-finalizar");
        const btnAnterior = this.shadowRoot?.querySelector("#btn-anterior");
        const btnCancelar = this.shadowRoot?.querySelector("#btn-cancelar");
        const textareaNotas = this.shadowRoot?.querySelector("#notas");
        const textareaPlan = this.shadowRoot?.querySelector("#plan");
        const diagnostico = this.shadowRoot?.querySelector("#diagnostico");
        const avisoLectura = this.shadowRoot?.querySelector("#aviso-lectura");
        if (avisoLectura) avisoLectura.hidden = !this._soloLectura;

        for (const selector of ["#stepper-flujo", "#cie10-busqueda", "#lista-examenes"]) {
            const bloqueado = enviando
                || (sinConexion && selector === "#stepper-flujo")
                || (selector !== "#stepper-flujo" && this._soloLectura);
            this.shadowRoot?.querySelector(selector)?.toggleAttribute("inert", bloqueado);
        }

        if (btn) {
            btn.disabled = enviando || this._soloLectura || sinConexion;
            btn.setAttribute("aria-busy", String(enviando));
            btn.classList.toggle("enviando", enviando);
            const textoBtn = btn.querySelector(".btn-guardar-texto");
            if (textoBtn) {
                const textoOriginal = btn.id === "btn-finalizar"
                    ? TEXTO_FINALIZAR
                    : TEXTO_SIGUIENTE;

                textoBtn.textContent = this._cargandoConsulta ? "Cargando…" : enviando ? "Guardando…" : textoOriginal;
            }
        }

        const btnGuardarNotas = this.shadowRoot?.querySelector("#btn-guardar-notas");
        if (btnGuardarNotas) {
            btnGuardarNotas.disabled = enviando || this._soloLectura || sinConexion;
            btnGuardarNotas.setAttribute("aria-busy", String(enviando));
            btnGuardarNotas.classList.toggle("enviando", enviando);
            const textoNotasBtn = btnGuardarNotas.querySelector(".btn-guardar-notas-texto");
            if (textoNotasBtn) {
                textoNotasBtn.textContent = enviando ? "Guardando…" : "Guardar Notas";
            }
        }

        if (btnAnterior) {
            btnAnterior.disabled = enviando || this._soloLectura || this._esPrimerPaso() || sinConexion;
        }
        if (btnCancelar) btnCancelar.disabled = enviando;
        if (textareaNotas) textareaNotas.disabled = enviando;
        if (textareaPlan) textareaPlan.disabled = enviando;
        for (const campo of [textareaNotas, textareaPlan, diagnostico]) {
            if (campo) {
                campo.readOnly = this._soloLectura;
                campo.disabled = enviando;
            }
        }
    }

    // ─── Ayudantes de datos ───────────────────────────────────────────────────

    _nombrePaciente(consulta) {
        if (!consulta) return "";
        const p =
            consulta.paciente ??
            consulta.persona ??
            consulta.cita?.paciente ??
            null;
        if (!p) return "";

        const nombres = p.nombres ?? p.nombre ?? p.name ?? "";
        const apellidos = p.apellidos ?? p.apellido ?? p.lastName ?? "";
        const nombreCompleto = `${nombres} ${apellidos}`.trim();
        return nombreCompleto || "";
    }

    _formatearFecha(fecha) {
        return GestorFechas.formatearFechaCalendario(fecha);
    }

    /**
     * Escapa caracteres HTML especiales para evitar inyecciones en la plantilla.
     * @param {string} texto
     * @returns {string}
     */
    _escapar(texto) {
        if (!texto) return "";
        return String(texto)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}

export default AtencionConsultaView;

if (!customElements.get("atencion-consulta-view")) {
    customElements.define("atencion-consulta-view", AtencionConsultaView);
}
