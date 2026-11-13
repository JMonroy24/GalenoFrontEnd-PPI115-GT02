import { store } from "../../store.js";
import { consultaService } from "../../control/consulta_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";
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
 * Índice 1 corresponde a "Consulta Médica", que es el paso activo en esta vista.
 */
const ETAPAS_FLUJO = Object.freeze(["Triaje", "Consulta Médica", "Tratamiento", "Cierre"]);

/** Índice del paso activo en esta vista dentro de ETAPAS_FLUJO. */
const PASO_ACTIVO = 1;

/** Estados de los pasos clínicos. */
const ESTADO_PENDIENTE = "PENDIENTE";
const ESTADO_EN_CURSO = "EN_CURSO";
const ESTADO_COMPLETADO = "COMPLETADO";

/** Textos de acción de la botonera. */
const TEXTO_SIGUIENTE = "Guardar y Avanzar al Siguiente Paso >";
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

        /** @type {Array<object|string>} Diagnósticos CIE-10 seleccionados. */
        this._diagnosticos = [];

        /** @type {number} Paso activo en el stepper (0-based). */
        this._pasoActivo = PASO_ACTIVO;

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

            if (consultaDelStore && consultaDelStore !== this._consulta) {
                this._consulta = consultaDelStore;
                this._sincronizarPasoActivo();
                this.render();
                this._cargarDatosPasoActivo();
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
            this._cargarConsultaPorId(params.id);
        }

        this._sincronizarPasoActivo();
        this.render();
        this._cargarDatosPasoActivo();
        store.addEventListener("state-changed", this._alCambioStore);
    }

    disconnectedCallback() {
        store.removeEventListener("state-changed", this._alCambioStore);
    }

    /**
     * Carga la consulta desde el servicio usando el id extraído del hash.
     * Si el store ya tiene la misma consulta no realiza la petición.
     *
     * @param {string} id - Identificador de la consulta extraído de la ruta dinámica.
     */
    async _cargarConsultaPorId(id) {
        // Si el store ya contiene la consulta con ese id, no duplicamos la carga.
        const idActual =
            this._consulta?.idConsulta ??
            this._consulta?.id ??
            null;

        if (idActual !== null && String(idActual) === String(id)) {
            return;
        }

        try {
            const consulta = await consultaService.obtenerConsulta(id);

            if (!consulta) {
                return;
            }

            this._consulta = consulta;
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
            GeneradorMensajes.crearMensaje(
                "Error al cargar la consulta",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    // ─── API pública ──────────────────────────────────────────────────────────

    /**
     * Devuelve un objeto limpio con los valores actuales de los campos del formulario,
     * incluyendo los diagnósticos CIE-10 seleccionados.
     *
     * @returns {{ notasConsulta: string, planTratamiento: string, diagnosticos: Array<object|string> }}
     */
    obtenerDatosFormulario() {
        const notas = this.shadowRoot?.querySelector("#notas-consulta");
        const plan = this.shadowRoot?.querySelector("#plan-tratamiento");
        const cie10 = this.shadowRoot?.querySelector("#cie10-busqueda");

        return {
            notasConsulta: (notas?.value ?? "").trim(),
            planTratamiento: (plan?.value ?? "").trim(),
            diagnosticos: cie10?.obtenerSeleccionados() ?? [...this._diagnosticos]
        };
    }

    /**
     * Rellena los campos del formulario con datos existentes (útil para edición).
     *
     * @param {{ notasConsulta?: string, planTratamiento?: string }} datos
     */
    cargarDatosFormulario(datos = {}) {
        const notas = this.shadowRoot?.querySelector("#notas-consulta");
        const plan = this.shadowRoot?.querySelector("#plan-tratamiento");

        if (notas && datos.notasConsulta !== undefined) {
            notas.value = datos.notasConsulta;
            this._actualizarContador("contador-notas", notas.value.length, MAX_NOTAS);
            this._ajustarAltura(notas);
        }

        if (plan && datos.planTratamiento !== undefined) {
            plan.value = datos.planTratamiento;
            this._actualizarContador("contador-plan", plan.value.length, MAX_PLAN);
            this._ajustarAltura(plan);
        }
    }

    // ─── Sincronización de pasos clínicos ────────────────────────────────────

    /**
     * Detecta el paso activo real de la secuencia clínica y lo sincroniza con
     * el stepper. Prioriza el paso en estado EN_CURSO y, si no existe, el
     * primer paso pendiente.
     */
    _sincronizarPasoActivo() {
        const pasos = this._obtenerListaPasos(this._consulta);
        const detectado = this._detectarPasoActivo(this._consulta);

        this._pasoActivo = detectado.indice;
        this._pasoDetectado = detectado.paso;
        this._pasosFlujo = pasos.length > 0
            ? pasos
            : this._crearPasosFlujoPorDefecto(detectado.indice);

        this._sincronizarStepper();
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

        stepper.etapas = [...ETAPAS_FLUJO];
        stepper.pasoActivo = this._pasoActivo;
    }

    _esPrimerPaso() {
        return this._pasoActivo <= 0;
    }

    _esUltimoPaso() {
        return this._pasoActivo >= ETAPAS_FLUJO.length - 1;
    }

    _detectarPasoActivo(consulta) {
        const pasos = this._obtenerListaPasos(consulta);
        let enCurso = null;
        let primerPendiente = null;

        pasos.forEach((paso) => {
            const indice = this._indiceEtapa(this._obtenerNombrePaso(paso));

            if (indice < 0) {
                return;
            }

            const estado = this._obtenerEstadoPaso(paso);

            if (this._esEstadoEnCurso(estado) && (!enCurso || indice < enCurso.indice)) {
                enCurso = { indice, paso };
            }

            if (this._esEstadoPendiente(estado) && (!primerPendiente || indice < primerPendiente.indice)) {
                primerPendiente = { indice, paso };
            }
        });

        if (enCurso) {
            return enCurso;
        }

        if (primerPendiente) {
            return primerPendiente;
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
            indice: PASO_ACTIVO,
            paso: this._buscarPasoPorIndice(pasos, PASO_ACTIVO)
        };
    }

    _obtenerListaPasos(consulta) {
        if (!consulta || typeof consulta !== "object") {
            return [];
        }

        const candidatos = [
            consulta.pasosClinicos,
            consulta.pasos_clinicos,
            consulta.pasos,
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
                return lista;
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
            return Number.isFinite(valor) && valor >= 0 && valor < ETAPAS_FLUJO.length
                ? Math.floor(valor)
                : -1;
        }

        const texto = String(valor).trim();

        if (/^\d+$/.test(texto)) {
            const numero = Number(texto);
            return numero >= 0 && numero < ETAPAS_FLUJO.length ? numero : -1;
        }

        return this._indiceEtapa(texto);
    }

    _buscarPasoPorIndice(pasos, indice) {
        const pasoPorNombre = pasos.find(
            (paso) => this._indiceEtapa(this._obtenerNombrePaso(paso)) === indice
        );

        return pasoPorNombre ?? pasos[indice] ?? null;
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
        const datos = {};
        const paso = this._pasoDetectado;
        const consulta = this._consulta;
        const fuentes = [
            paso?.datos,
            paso?.formulario,
            paso?.contenido,
            paso?.detalle,
            paso?.registro,
            paso?.atencion,
            paso,
            consulta?.atencion,
            consulta?.datos,
            consulta?.consulta,
            consulta
        ];

        fuentes.forEach((fuente) => this._acumularDatosFormulario(datos, fuente));

        return datos;
    }

    _acumularDatosFormulario(destino, fuente) {
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
                if (texto !== "") {
                    destino[clave] = texto;
                    return;
                }
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

        if (destino.diagnosticos === undefined) {
            const diagnosticos = fuente.diagnosticos
                ?? fuente.diagnostico
                ?? fuente.cie10
                ?? fuente.codigosCie10
                ?? fuente.codigosCIE10
                ?? fuente.diagnosticosCie10;

            if (diagnosticos !== undefined && diagnosticos !== null && diagnosticos !== "") {
                if (Array.isArray(diagnosticos)) {
                    if (diagnosticos.length > 0) {
                        destino.diagnosticos = diagnosticos;
                    }
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
                    padding: var(--space-6, 1.5rem);
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
                    overflow-y: hidden; /* se mostrará cuando se alcance el max-height */
                    overflow-x: hidden;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }

                .textarea::placeholder {
                    color: var(--color-text-muted, #475569);
                    opacity: 1;
                }

                .textarea:focus {
                    outline: none;
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
                @media (max-width: 640px) {
                    .tarjeta {
                        padding: var(--space-4, 1rem);
                    }

                    .cabecera {
                        padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    }

                    .acciones {
                        flex-direction: column-reverse;
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

                <div class="tarjeta">
                    <h2 class="tarjeta-titulo" id="titulo-vista">Registro de Atención Médica</h2>

                    ${this._consulta
                        ? this._htmlFormulario()
                        : this._htmlSinConsulta()}
                </div>
            </section>
        `;

        this._conectarEventos();
    }

    // ─── Fragmentos HTML ──────────────────────────────────────────────────────

    _htmlCabecera() {
        const consulta = this._consulta;
        const idConsulta = consulta?.idConsulta ?? consulta?.id ?? "—";
        const fecha = this._formatearFecha(consulta?.fecha ?? consulta?.cita?.fecha ?? "");
        const hora = consulta?.hora ?? consulta?.cita?.hora ?? "";
        const paciente = this._nombrePaciente(consulta);
        const clinica = consulta?.clinica ?? consulta?.cita?.clinica ?? "";

        return `
            <header class="cabecera">
                <div>
                    <h1 class="cabecera-titulo">Atención de Consulta</h1>
                    <ul class="cabecera-meta" aria-label="Datos de la consulta">
                        ${idConsulta !== "—" ? `<li>Consulta #${this._escapar(String(idConsulta))}</li>` : ""}
                        ${paciente ? `<li>Paciente: ${this._escapar(paciente)}</li>` : ""}
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
                <!-- ── Campo: Notas de la Consulta ── -->
                <div class="campo" id="grupo-notas">
                    <div class="campo-cabecera">
                        <label class="etiqueta" for="notas-consulta">
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
                        id="notas-consulta"
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
                        <label class="etiqueta" for="plan-tratamiento">
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
                        id="plan-tratamiento"
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
                    <span class="etiqueta" id="etiqueta-cie10">
                        Diagnósticos CIE-10
                        <span class="campo-cie10-descripcion">
                            Busque y seleccione uno o varios códigos de diagnóstico.
                        </span>
                    </span>
                    <auto-complete-cie10
                        id="cie10-busqueda"
                        aria-labelledby="etiqueta-cie10"
                    ></auto-complete-cie10>
                </div>

                <!-- ── Órdenes de Exámenes ── -->
                <div class="campo" id="grupo-examenes">
                    <lista-examenes-asignables
                        id="lista-examenes"
                        id-consulta="${this._escapar(String(this._idConsulta() ?? ""))}"
                    ></lista-examenes-asignables>
                </div>

                <hr class="divisor" aria-hidden="true">

                <!-- ── Acciones ── -->
                <div class="acciones">
                    <button type="button" class="btn btn-cancelar" id="btn-cancelar">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        class="btn btn-anterior"
                        id="btn-anterior"
                        ${this._esPrimerPaso() ? "disabled" : ""}
                    >
                        &lt; Anterior
                    </button>
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
            </form>
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
        const btnCancelar = this.shadowRoot.querySelector("#btn-cancelar");
        const btnAnterior = this.shadowRoot.querySelector("#btn-anterior");
        const textareaNotas = this.shadowRoot.querySelector("#notas-consulta");
        const textareaPlan = this.shadowRoot.querySelector("#plan-tratamiento");

        // ── Stepper: sincronizar etapas y escuchar clics de paso ──
        const stepper = this.shadowRoot.querySelector("#stepper-flujo");
        if (stepper) {
            stepper.etapas = [...ETAPAS_FLUJO];
            stepper.pasoActivo = this._pasoActivo;
            stepper.addEventListener("paso-click", (evento) => {
                this._pasoActivo = evento.detail.indice;
                stepper.setPaso(this._pasoActivo);
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

        btnVolver?.addEventListener("click", () => this._volverAlDashboard());
        btnCancelar?.addEventListener("click", () => this._cancelar());
        btnAnterior?.addEventListener("click", () => this._retrocederPaso());

        if (textareaNotas) {
            textareaNotas.addEventListener("input", () => {
                this._actualizarContador("contador-notas", textareaNotas.value.length, MAX_NOTAS);
                this._ajustarAltura(textareaNotas);
                this._limpiarErrorCampo("notas");
            });
        }

        if (textareaPlan) {
            textareaPlan.addEventListener("input", () => {
                this._actualizarContador("contador-plan", textareaPlan.value.length, MAX_PLAN);
                this._ajustarAltura(textareaPlan);
                this._limpiarErrorCampo("plan");
            });
        }

        form?.addEventListener("submit", (evento) => {
            evento.preventDefault();
            this._alEnviarFormulario();
        });
    }

    // ─── Lógica de negocio ────────────────────────────────────────────────────

    _idConsulta() {
        return this._consulta?.idConsulta ?? this._consulta?.id ?? null;
    }

    _datosAtencion(datos = {}) {
        const diagnosticos = Array.isArray(datos.diagnosticos)
            ? datos.diagnosticos
            : [];

        return {
            notasConsulta: datos.notasConsulta || null,
            planTratamiento: datos.planTratamiento || null,
            diagnosticos: diagnosticos.length > 0 ? diagnosticos : null
        };
    }

    _crearPayloadPaso(indice, estado, datos = {}, extra = {}) {
        const nombre = ETAPAS_FLUJO[indice] ?? "";
        const pasoLocal = this._buscarPasoPorIndice(this._pasosFlujo, indice);
        const idPaso = pasoLocal?.idPaso
            ?? pasoLocal?.idPasoClinico
            ?? pasoLocal?.id
            ?? null;
        const payload = {};

        if (datos && Object.keys(datos).length > 0) {
            Object.assign(payload, this._datosAtencion(datos), {
                consulta_procedimiento_paso: {
                    valor: consultaService.serializarValorPaso(datos)
                }
            });
        }

        Object.assign(payload, {
            paso: { idPaso, indice, nombre, estado },
            idPaso,
            indicePaso: indice,
            nombrePaso: nombre,
            etapa: nombre,
            estado,
            estadoPaso: estado,
            ...extra
        });

        return payload;
    }

    async _persistirPaso(indice, estado, datos = {}, extra = {}) {
        const idConsulta = this._idConsulta();

        if (!idConsulta) {
            return null;
        }

        return consultaService.guardarPaso(
            idConsulta,
            this._crearPayloadPaso(indice, estado, datos, extra)
        );
    }

    _actualizarEstadoPasoLocal(indice, estado, datos = null) {
        let paso = this._buscarPasoPorIndice(this._pasosFlujo, indice);

        if (!paso) {
            paso = { nombre: ETAPAS_FLUJO[indice] ?? "", estado };
            this._pasosFlujo[indice] = paso;
        }

        paso.estado = estado;
        paso.estadoPaso = estado;

        if (estado === ESTADO_COMPLETADO) {
            paso.fechaHoraEjecucion =
                paso.fechaHoraEjecucion ?? new Date().toISOString();

            if (datos) {
                paso.datos = { ...(paso.datos ?? {}), ...datos };
            }
        }

        return paso;
    }

    _irAPaso(indice) {
        this._pasoActivo = indice;
        this._pasoDetectado = this._buscarPasoPorIndice(this._pasosFlujo, indice);
        this._diagnosticos = [];
        this.render();
        this._cargarDatosPasoActivo();
    }

    _obtenerDatosValidados() {
        const datos = this.obtenerDatosFormulario();
        const hayDatos =
            datos.notasConsulta.length > 0 ||
            datos.planTratamiento.length > 0;

        if (!hayDatos) {
            this._marcarError(
                "notas",
                "Complete al menos uno de los campos antes de guardar."
            );
            this.shadowRoot.querySelector("#notas-consulta")?.focus();
            return null;
        }

        return datos;
    }

    _alEnviarFormulario() {
        if (this._esUltimoPaso()) {
            return this._finalizarConsulta();
        }

        return this._avanzarPaso();
    }

    async _retrocederPaso() {
        if (this._enviando || this._esPrimerPaso()) {
            return;
        }

        const pasoActual = this._pasoActivo;
        const pasoAnterior = pasoActual - 1;

        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoAnterior, ESTADO_EN_CURSO);

            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_PENDIENTE);
            this._actualizarEstadoPasoLocal(pasoAnterior, ESTADO_EN_CURSO);
            this._irAPaso(pasoAnterior);
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "Error al retroceder",
                error?.mensaje ?? error?.message ?? "No se pudo actualizar el paso anterior.",
                "error"
            );
        } finally {
            this._establecerEnviando(false);
        }
    }

    async _avanzarPaso() {
        if (this._enviando || this._esUltimoPaso()) {
            return;
        }

        const datos = this._obtenerDatosValidados();

        if (!datos) {
            return;
        }

        const pasoActual = this._pasoActivo;
        const pasoSiguiente = pasoActual + 1;
        const nombreSiguiente = ETAPAS_FLUJO[pasoSiguiente] ?? "";

        this._establecerEnviando(true);

        try {
            await this._persistirPaso(pasoActual, ESTADO_COMPLETADO, datos, {
                siguientePaso: {
                    indice: pasoSiguiente,
                    nombre: nombreSiguiente,
                    estado: ESTADO_EN_CURSO
                }
            });

            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_COMPLETADO, datos);
            this._actualizarEstadoPasoLocal(pasoSiguiente, ESTADO_EN_CURSO);
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
            GeneradorMensajes.crearMensaje(
                "Error al guardar",
                error?.mensaje ?? error?.message ?? "No se pudo guardar el paso.",
                "error"
            );
        } finally {
            this._establecerEnviando(false);
        }
    }

    async _finalizarConsulta() {
        if (this._enviando || !this._esUltimoPaso()) {
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
            await this._persistirPaso(pasoActual, ESTADO_COMPLETADO, datos, {
                fechaFin,
                fechaHoraFin: fechaFin,
                finalizada: true,
                estadoConsulta: "FINALIZADA"
            });

            this._actualizarEstadoPasoLocal(pasoActual, ESTADO_COMPLETADO, datos);

            if (this._consulta) {
                this._consulta.fechaFin = fechaFin;
                this._consulta.fechaHoraFin = fechaFin;
                this._consulta.estado = "FINALIZADA";
            }

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

            this._volverAlDashboard();
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "Error al finalizar",
                error?.mensaje ?? error?.message ?? "No se pudo finalizar la consulta.",
                "error"
            );
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
     * Auto-ajusta la altura del textarea a su contenido evitando scroll interno.
     * @param {HTMLTextAreaElement} textarea
     */
    _ajustarAltura(textarea) {
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    /**
     * Muestra un mensaje de error bajo el campo indicado.
     * @param {"notas"|"plan"} campo
     * @param {string} mensaje
     */
    _marcarError(campo, mensaje) {
        const idSpan = campo === "notas" ? "error-notas" : "error-plan";
        const idTextarea = campo === "notas" ? "notas-consulta" : "plan-tratamiento";
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
        const idTextarea = campo === "notas" ? "notas-consulta" : "plan-tratamiento";
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
        const btn = this.shadowRoot?.querySelector("#btn-siguiente, #btn-finalizar");
        const btnAnterior = this.shadowRoot?.querySelector("#btn-anterior");
        const btnCancelar = this.shadowRoot?.querySelector("#btn-cancelar");
        const textareaNotas = this.shadowRoot?.querySelector("#notas-consulta");
        const textareaPlan = this.shadowRoot?.querySelector("#plan-tratamiento");

        if (btn) {
            btn.disabled = enviando;
            btn.setAttribute("aria-busy", String(enviando));
            btn.classList.toggle("enviando", enviando);
            const textoBtn = btn.querySelector(".btn-guardar-texto");
            if (textoBtn) {
                const textoOriginal = btn.id === "btn-finalizar"
                    ? TEXTO_FINALIZAR
                    : TEXTO_SIGUIENTE;

                textoBtn.textContent = enviando ? "Guardando…" : textoOriginal;
            }
        }

        if (btnAnterior) {
            btnAnterior.disabled = enviando || this._esPrimerPaso();
        }
        if (btnCancelar) btnCancelar.disabled = enviando;
        if (textareaNotas) textareaNotas.disabled = enviando;
        if (textareaPlan) textareaPlan.disabled = enviando;
    }

    /**
     * Actualiza solo el bloque de cabecera del Shadow DOM cuando cambia la consulta,
     * sin re-renderizar el formulario completo (preserva los valores escritos).
     */
    _actualizarResumenConsulta() {
        const cabecera = this.shadowRoot?.querySelector(".cabecera");
        if (cabecera) {
            cabecera.outerHTML = this._htmlCabecera();
            const btnVolver = this.shadowRoot?.querySelector("#btn-volver");
            btnVolver?.addEventListener("click", () => this._volverAlDashboard());
        }

        // La lista de exámenes debe apuntar siempre a la consulta vigente.
        this.shadowRoot?.querySelector("#lista-examenes")
            ?.setAttribute("id-consulta", String(this._idConsulta() ?? ""));
    }

    // ─── Ayudantes de datos ───────────────────────────────────────────────────

    _idConsulta() {
        return (
            this._consulta?.idConsulta ??
            this._consulta?.id ??
            this._consulta?.cita?.idConsulta ??
            null
        );
    }

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
        if (!fecha) return "";
        try {
            const [anio, mes, dia] = String(fecha).split("-");
            if (!anio || !mes || !dia) return String(fecha);
            return `${dia}/${mes}/${anio}`;
        } catch {
            return String(fecha);
        }
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
