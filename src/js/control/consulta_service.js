import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import DefaultResponse from "../entity/default_response.js";
import { ENDPOINTS } from "../routes.js";
import { personaService } from "./persona_service.js";
import { procedimientoService, leerCatalogo } from './procedimiento_service.js';
import { idEntidad, idRolPaso, indicePasoVigente, estadoPaso } from '../entity/flujo_consulta.js';
import {
    construirPayloadPaso,
    consultaProcedimientoService,
    serializarValorPaso
} from "./consulta_procedimiento_service.js";

function fuentesConsulta(consulta) {
    return [consulta, consulta?.consulta, consulta?.cita, consulta?.consulta?.cita].filter(Boolean);
}

function idRelacion(valor, campo) {
    return valor && typeof valor === "object" ? valor[campo] ?? valor.id : valor;
}

function tieneNombre(valor) {
    return Boolean(valor && typeof valor === "object"
        && (textoDato(valor.nombreCompleto) || textoDato(valor.nombres) || textoDato(valor.nombre)
            || textoDato(valor.nombreClinica) || textoDato(valor.descripcion)));
}

function esIdentificador(valor) {
    return typeof valor === "number" || (typeof valor === "string"
        && /^(?:\d+|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(valor));
}

function candidatosPaciente(consulta) {
    return fuentesConsulta(consulta).flatMap((datos) => [
        datos?.paciente?.persona, datos?.paciente?.idPersona, datos?.paciente,
        datos?.persona?.persona, datos?.persona, datos?.idPersona,
        datos?.idPaciente?.persona, datos?.idPaciente?.idPersona, datos?.idPaciente,
        ...(textoDato(datos?.nombrePaciente) || textoDato(datos?.nombresPaciente) ? [{
            nombreCompleto: datos?.nombrePaciente, nombres: datos?.nombresPaciente,
            apellidos: datos?.apellidosPaciente
        }] : [])
    ]);
}

function textoDato(valor) {
    if (Array.isArray(valor)) return valor.map(textoDato).filter(Boolean).join(" ");
    return typeof valor === "string" || typeof valor === "number" ? String(valor).trim() : "";
}

function documentoPaciente(paciente) {
    return [paciente?.numeroDocumento, paciente?.documento, paciente?.dui, paciente?.identificacion]
        .map((documento) => textoDato(documento?.numeroDocumento) || textoDato(documento?.numero)
            || textoDato(documento?.valor) || textoDato(documento)).find(Boolean) || "";
}

export function obtenerDocumentoConsulta(consulta = {}) {
    return candidatosPaciente(consulta).map(documentoPaciente).find(Boolean)
        || fuentesConsulta(consulta).flatMap((datos) => [
            { documento: datos?.documentoPaciente }, { documento: datos?.numeroDocumentoPaciente }, datos
        ]).map(documentoPaciente).find(Boolean) || "";
}

export function obtenerPacienteConsulta(consulta = {}) {
    const candidatos = candidatosPaciente(consulta);
    // Una asociación vacía o un ID no debe ocultar otra que sí tenga el nombre.
    const paciente = candidatos.find((paciente) => paciente && typeof paciente === "object"
        && (textoDato(paciente.nombreCompleto) || textoDato(paciente.nombres) || textoDato(paciente.nombre)))
        ?? candidatos.find((paciente) => typeof paciente === "string" && paciente.trim())
        ?? candidatos.find((paciente) => paciente != null && Object.keys(Object(paciente)).length > 0);
    const documento = obtenerDocumentoConsulta(consulta);
    // El nombre y el documento pueden llegar en asociaciones diferentes.
    if (paciente && typeof paciente === "object" && !documentoPaciente(paciente) && documento) {
        return { ...paciente, numeroDocumento: documento };
    }
    return paciente;
}

export function obtenerNombreClinicaConsulta(consulta = {}) {
    const texto = (valor) => typeof valor === "string" ? valor.trim() : "";
    const fuentes = fuentesConsulta(consulta);
    const relaciones = fuentes.flatMap((datos) => [datos?.clinica, datos?.idClinica]);
    return fuentes.flatMap((datos) => [datos?.nombreClinica, datos?.clinicaNombre]).map(texto).find(Boolean)
        || relaciones.flatMap((clinica) => [clinica?.nombre, clinica?.nombreClinica,
            clinica?.descripcion, clinica?.name]).map(texto).find(Boolean)
        || relaciones.map(texto).find((nombre) => nombre && !esIdentificador(nombre))
        || "Sin clínica";
}

export class ConsultaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.CONSULTAS);
    }

    async _solicitarCitas(filtros, first, max) {
        const params = new URLSearchParams();
        params.set("first", first);
        params.set("max", max);

        // Nombres oficiales del OpenAPI. Los alias pertenecen solo a la API de la vista.
        const parametros = {
            idClinica: filtros.idClinica ?? filtros.clinicaId,
            idRol: filtros.idRol,
            pacienteId: filtros.pacienteId ?? filtros.idPaciente,
            desde: filtros.desde ?? filtros.fechaDesde,
            hasta: filtros.hasta ?? filtros.fechaHasta,
            q: filtros.q
        };
        Object.entries(parametros).forEach(([clave, valor]) => {
            if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
                params.set(clave, valor);
            }
        });

        const url = `${this._urlBase}?${params.toString()}`;
        const response = await this._request(
            url,
            { method: "GET" },
            "Error al consultar las citas"
        );
        return response.json();
    }

    async _buscarCitas(filtros, first, max) {
        const desde = filtros.desde ?? filtros.fechaDesde;
        const hasta = filtros.hasta ?? filtros.fechaHasta;
        const conFechas = Boolean(desde || hasta);
        const conRol = filtros.idRol != null && String(filtros.idRol).trim() !== '';
        const calendarioCola = conRol && conFechas ? new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit'
        }) : null;
        const conPaciente = Boolean(filtros.tipoDocumento && filtros.numeroDocumento);
        const conClinica = filtros.idClinica != null && String(filtros.idClinica).trim() !== "";
        const filtrarAntesDePaginar = conFechas || conPaciente || conClinica || conRol;
        const solicitudes = new Map();
        const mapearItems = (payload) => (Array.isArray(payload?.items) ? payload.items : [])
            .filter((consulta) => consulta !== null && typeof consulta === "object" && !Array.isArray(consulta))
            .map((consulta) => this._mapearConsulta(consulta));
        const payload = await this._solicitarCitas(filtros, filtrarAntesDePaginar ? 0 : first, max);
        let items = mapearItems(payload);

        if (filtrarAntesDePaginar) {
            // Filtrar antes de paginar: una página vacía no significa que no haya
            // coincidencias si el backend omite el paciente, la clínica o el rango.
            let offset = Array.isArray(payload?.items) ? payload.items.length : 0;
            const total = Number(payload?.total ?? offset);
            const vistos = new Set(items.map((item) => item.idConsulta).filter((id) => id != null));
            while (offset > 0 && offset < total) {
                const pagina = await this._solicitarCitas(filtros, offset, max);
                const cantidad = Array.isArray(pagina?.items) ? pagina.items.length : 0;
                if (cantidad === 0) break;
                const siguientes = mapearItems(pagina).filter((item) => {
                    if (item.idConsulta == null) return true;
                    if (vistos.has(item.idConsulta)) return false;
                    vistos.add(item.idConsulta);
                    return true;
                });
                // Evitar repetir indefinidamente una página si el servidor ignora first.
                if (siguientes.length === 0) break;
                items.push(...siguientes);
                offset += cantidad;
            }
            items = items.filter((consulta) => {
                if (!conFechas) return true;
                const texto = String(consulta.fecha ?? '').replace(/\[.*\]$/u, '');
                const instante = calendarioCola && /[T ].*(?:Z|[+-]\d{2}:?\d{2})$/u.test(texto)
                    ? new Date(texto) : null;
                const fecha = instante && !Number.isNaN(instante.getTime()) ? calendarioCola.format(instante)
                    : texto.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/)?.[1];
                return fecha && (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
            });
            if (conPaciente || conClinica || conRol) {
                items = (await Promise.all(items.map((consulta) =>
                    this._completarConsulta(consulta, solicitudes, filtros)
                ))).filter((consulta) => (!conPaciente || this._coincidePacienteYClinica(consulta, filtros))
                    && (!conClinica || this._coincideClinica(consulta, filtros.idClinica)));
            }
            if (conRol) {
                // La cola depende del paso vigente: resolverla en todas las páginas
                // antes de contar y paginar evita ocultar coincidencias posteriores.
                items = (await Promise.all(items.map((consulta) =>
                    this.cargarFlujoConsulta(consulta, solicitudes, filtros.idRol)
                ))).filter((consulta) => {
                    const vigente = indicePasoVigente(consulta.pasos);
                    return vigente >= 0 && String(idRolPaso(consulta.pasos[vigente])) === String(filtros.idRol);
                });
                return new DefaultResponse(items.slice(first, first + max), items.length, first, max);
            }
            const totalFiltrado = items.length;
            const pagina = items.slice(first, first + max);
            const completas = conPaciente || conClinica ? pagina
                : await Promise.all(pagina.map((consulta) => this._completarConsulta(consulta, solicitudes, filtros)));
            return new DefaultResponse(
                await this._completarProcedimientos(completas, solicitudes),
                totalFiltrado, first, max
            );
        }

        return new DefaultResponse(
            await this._completarProcedimientos(
                await Promise.all(items.map((consulta) => this._completarConsulta(consulta, solicitudes, filtros))),
                solicitudes
            ),
            payload?.total ?? 0,
            payload?.first ?? 0,
            payload?.max ?? 0
        );
    }

    _coincidePacienteYClinica(consulta, filtros) {
        const normalizarDocumento = (valor) => String(valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const documento = normalizarDocumento(obtenerDocumentoConsulta(consulta));
        if (!documento || documento !== normalizarDocumento(filtros.numeroDocumento)) return false;

        const paciente = obtenerPacienteConsulta(consulta);
        const tipo = paciente?.idTipoDocumento ?? paciente?.tipoDocumentoId ?? paciente?.tipoDocumento;
        const idTipo = idRelacion(tipo, "idTipoDocumento");
        if (idTipo != null && String(idTipo) !== String(filtros.tipoDocumento)) return false;

        return filtros.idClinica == null || this._coincideClinica(consulta, filtros.idClinica);
    }

    _coincideClinica(consulta, idClinicaActiva) {
        const datos = { ...consulta.consulta?.cita, ...consulta.consulta, ...consulta.cita, ...consulta };
        const idClinica = idRelacion(datos.idClinica ?? datos.clinicaId, "idClinica")
            ?? idRelacion(datos.clinica, "idClinica");
        // Una clínica ausente o solo un nombre no demuestra pertenencia.
        return idClinica != null && String(idClinica) === String(idClinicaActiva).trim();
    }

    async _completarProcedimientos(consultas, solicitudes) {
        // ConsultaDTO contiene IDs, no las relaciones que sí consulta el ticket.
        // Leer las asignaciones una sola vez por búsqueda y unirlas por idConsulta.
        const faltantes = consultas.some((consulta) => consulta.idConsulta != null
            && consulta.procedimientos.length === 0);
        let asignaciones = [];
        if (faltantes) {
            const urlBase = `${ENDPOINTS.API_BASE}${ENDPOINTS.CONSULTAS_PROCEDIMIENTOS}`;
            if (!solicitudes.has(urlBase)) {
                solicitudes.set(urlBase, (async () => {
                    const registros = [];
                    const vistos = new Set();
                    let first = 0;
                    while (true) {
                        const response = await this._request(`${urlBase}?first=${first}&max=100`,
                            { method: "GET" }, "Error al consultar los procedimientos de las citas");
                        const pagina = await response.json();
                        const items = Array.isArray(pagina?.items) ? pagina.items : [];
                        const nuevos = items.filter((item) => {
                            if (!item || item.idConsulta == null
                                || (item.idProcedimiento == null && item.procedimiento == null)) return false;
                            const id = item.id ?? item.idConsultaProcedimiento;
                            if (id != null && vistos.has(String(id))) return false;
                            if (id != null) vistos.add(String(id));
                            return true;
                        });
                        registros.push(...nuevos);
                        first += items.length;
                        if (nuevos.length === 0 || first >= Number(pagina?.total ?? first)) break;
                    }
                    return registros;
                })());
            }
            asignaciones = await solicitudes.get(urlBase);
        }

        return Promise.all(consultas.map(async (consulta) => {
            const lista = consulta.procedimientos.length > 0 ? consulta.procedimientos
                : asignaciones.filter((item) => String(idRelacion(item.idConsulta, "idConsulta"))
                    === String(consulta.idConsulta));
            const procedimientos = await Promise.all(lista.map(async (asignacion) => {
                if (!asignacion || typeof asignacion !== "object") return asignacion;
                if (asignacion.procedimiento?.nombre || asignacion.nombre
                    || asignacion.idProcedimiento?.nombre) return asignacion;
                const id = idRelacion(asignacion.idProcedimiento ?? asignacion.procedimiento, "idProcedimiento");
                if (id == null || id === "") return asignacion;
                const url = `${ENDPOINTS.API_BASE}${ENDPOINTS.PROCEDIMIENTOS}/${encodeURIComponent(id)}`;
                if (!solicitudes.has(url)) {
                    solicitudes.set(url, (async () => {
                        const response = await this._request(url, { method: "GET" },
                            "Error al consultar el nombre del procedimiento");
                        return response.json();
                    })());
                }
                return { ...asignacion, procedimiento: await solicitudes.get(url) };
            }));
            return { ...consulta, procedimientos };
        }));
    }

    async _completarConsulta(consulta, solicitudes, filtros) {
        const datos = { ...consulta.consulta?.cita, ...consulta.consulta, ...consulta.cita, ...consulta };
        const resolver = async (referencia, campo, endpoint, completa) => {
            const id = idRelacion(referencia, campo);
            if (id == null || id === "" || completa(referencia)) return referencia;
            const url = `${ENDPOINTS.API_BASE}${endpoint}/${encodeURIComponent(id)}`;
            if (!solicitudes.has(url)) {
                solicitudes.set(url, (async () => {
                    try {
                        const response = await this._request(url, { method: "GET" }, "Error al completar los datos de la cita");
                        const entidad = await this._parseBody(response);
                        return entidad && typeof entidad === "object" && !Array.isArray(entidad)
                            && !Object.hasOwn(entidad, "items")
                            ? { ...(typeof referencia === "object" ? referencia : {}), ...entidad } : referencia;
                    } catch (error) {
                        if (error?.status === 404) return referencia;
                        throw error;
                    }
                })());
            }
            return solicitudes.get(url);
        };

        const referenciaPaciente = datos.personaRolPaciente ?? datos.idPersonaRolPaciente
            ?? datos.personaRol ?? datos.idPersonaRol ?? datos.idPaciente ?? datos.pacienteId
            ?? (esIdentificador(datos.paciente) || typeof datos.paciente === "object" ? datos.paciente : null);
        const asignacion = referenciaPaciente == null || tieneNombre(referenciaPaciente) ? referenciaPaciente
            : await resolver(referenciaPaciente, "idPersonaRol", ENDPOINTS.PERSONAS_ROLES,
                (valor) => valor && typeof valor === "object" && (valor.persona != null || valor.idPersona != null));
        const referenciaPersona = tieneNombre(asignacion) ? asignacion
            : asignacion?.persona ?? asignacion?.idPersona ?? datos.persona ?? datos.idPersona;
        let persona = referenciaPersona == null ? null
            : await resolver(referenciaPersona, "idPersona", ENDPOINTS.PERSONAS, tieneNombre);
        if (persona && idRelacion(persona, "idPersona") != null && !documentoPaciente(persona)
            && filtros.numeroDocumento && filtros.tipoDocumento) {
            const clave = `documento:${filtros.tipoDocumento}:${filtros.numeroDocumento}`;
            if (!solicitudes.has(clave)) {
                solicitudes.set(clave, personaService.buscarPorDocumento(filtros.tipoDocumento, filtros.numeroDocumento));
            }
            const buscada = await solicitudes.get(clave);
            const idPersona = idRelacion(persona, "idPersona");
            if (idPersona != null && String(idPersona) === String(idRelacion(buscada, "idPersona"))) {
                persona = { ...persona, numeroDocumento: filtros.numeroDocumento };
            }
        }
        const referenciaClinica = [datos.clinica, datos.idClinica, datos.clinicaId,
            asignacion?.clinica, asignacion?.idClinica]
            .find((valor) => tieneNombre(valor) || idRelacion(valor, "idClinica") != null);
        const clinica = referenciaClinica == null ? null
            : await resolver(referenciaClinica, "idClinica", ENDPOINTS.CLINICAS,
                (valor) => tieneNombre(valor) || (typeof valor === "string" && !esIdentificador(valor)
                    && !datos.idClinica && !datos.clinicaId && !asignacion?.idClinica));

        return { ...consulta, ...(persona ? { paciente: persona } : {}), ...(clinica ? { clinica } : {}) };
    }

    _mapearConsulta(consulta) {
        const datos = { ...consulta.consulta?.cita, ...consulta.consulta, ...consulta.cita, ...consulta };
        const paciente = obtenerPacienteConsulta(datos);
        const procedimientos = datos.procedimientos
            ?? datos.consultaProcedimientos
            ?? datos.consultaProcedimientoList
            ?? datos.procedimientosActivos
            ?? datos.detalles ?? datos.detallesConsulta ?? datos.detalleConsulta;

        // Conservar el JSON original (incluidos rol, clínica y pasos anidados)
        // y exponer los nombres que comparten las vistas de búsqueda y dashboard.
        const estado = datos.estado ?? datos.estadoConsulta ?? datos.estadoCita
            ?? (typeof datos.activo === "boolean" ? (datos.activo ? "Activa" : "Inactiva") : undefined);
        return {
            ...consulta,
            ...(estado != null ? { estado } : {}),
            idConsulta: consulta.idConsulta ?? consulta.id ?? datos.idConsulta ?? datos.id,
            fecha: datos.inicio || datos.fecha || datos.fechaConsulta || datos.fechaCita
                || datos.fechaHora || datos.fechaInicio || datos.fechaCreacion,
            clinica: datos.clinica || datos.idClinica,
            paciente,
            procedimientos: Array.isArray(procedimientos)
                ? procedimientos
                : Array.isArray(procedimientos?.items) ? procedimientos.items : []
        };
    }

    buscarCitas(filtros = {}, first = 0, max = DEFAULT_PAGE_SIZE) {
        const { clinicaId, ...resto } = filtros;
        const normalizados = clinicaId !== undefined && clinicaId !== null && String(clinicaId).trim() !== ""
            ? { ...resto, idClinica: String(clinicaId).trim() }
            : filtros;

        return this._buscarCitas(normalizados, first, max);
    }

    /**
     * Busca consultas filtrando por datos del paciente y rango de fechas.
     *
     * Construye los query params estándar (`first`, `max`) junto con los
     * filtros opcionales y delega en `findRange()` a través del mecanismo
     * compartido de paginación del servicio base.
     *
     * @param {object}  opciones
     * @param {string|number} [opciones.pacienteId] - Identificador del paciente.
     * @param {string|number} [opciones.idPaciente] - Alias identificador del paciente.
     * @param {string}  [opciones.tipoDocumento]   - Tipo de documento de identidad del paciente.
     * @param {string}  [opciones.numeroDocumento] - Número de documento de identidad del paciente.
     * @param {string|number} [opciones.idClinica] - Identificador de la clínica.
     * @param {string|number} [opciones.clinicaId] - Alias identificador de la clínica.
     * @param {string}  [opciones.fechaDesde]      - Fecha de inicio del rango (ISO 8601, p. ej. "2024-01-01").
     * @param {string}  [opciones.fechaHasta]      - Fecha de fin del rango (ISO 8601, p. ej. "2024-12-31").
     * @param {number}  [first=0]                  - Índice del primer registro (paginación).
     * @param {number}  [max=DEFAULT_PAGE_SIZE]    - Cantidad máxima de registros a devolver.
     * @returns {Promise<DefaultResponse>}
     */
    async buscarPorPacienteYFechas(
        { pacienteId, idPaciente, tipoDocumento, numeroDocumento, idClinica, clinicaId, fechaDesde, fechaHasta } = {},
        first = 0,
        max = DEFAULT_PAGE_SIZE
    ) {
        const clinica = idClinica ?? clinicaId;
        const paciente = pacienteId ?? idPaciente;
        const filtros = {
            ...(paciente != null ? { pacienteId: paciente }         : {}),
            ...(tipoDocumento   ? { tipoDocumento }                : {}),
            ...(numeroDocumento ? { numeroDocumento }              : {}),
            ...(clinica         ? { idClinica: clinica }           : {}),
            ...(fechaDesde      ? { fechaDesde }                   : {}),
            ...(fechaHasta      ? { fechaHasta }                   : {})
        };

        return this._buscarCitas(filtros, first, max);
    }

    /**
     * Actualiza un paso clínico con bloqueo optimista (GET ETag + PATCH
     * If-Match) en el endpoint de consultas-procedimientos-pasos.
     *
     * @param {string} idPaso - UUID de consulta_procedimiento_paso.
     * @param {object} atencion - Datos clínicos y estado del paso.
     */
    actualizarPaso(idPaso, atencion = {}) {
        return consultaProcedimientoService.actualizarPaso(idPaso, atencion);
    }

    /**
     * Serializa los datos clínicos del formulario al formato estructurado que
     * consume el backend dentro de `consulta_procedimiento_paso.valor`.
     *
     * @param {object} atencion
     * @returns {string} JSON con notas, diagnostico y plan.
     */
    serializarValorPaso(atencion = {}) {
        return serializarValorPaso(atencion);
    }

    /**
     * Construye el cuerpo del PATCH: sólo `estadoPaso` y `valor`.
     *
     * @param {object} atencion
     * @returns {{ estadoPaso: string, valor: string }}
     */
    construirPayloadPaso(atencion = {}) {
        return construirPayloadPaso(atencion);
    }

    guardarPaso(idPaso, atencion = {}) {
        return this.actualizarPaso(idPaso, atencion);
    }

    guardarConsultaProcedimientoPaso(idPaso, atencion = {}) {
        return this.actualizarPaso(idPaso, atencion);
    }

    async _leerRelacion(endpoint, id, solicitudes) {
        if (id == null || id === '') return null;
        const url = `${ENDPOINTS.API_BASE}${endpoint}/${encodeURIComponent(id)}`;
        if (!solicitudes.has(url)) {
            solicitudes.set(url, (async () => {
                const response = await this._request(url, { method: 'GET' }, 'Error al leer una relación del paso');
                return response.json();
            })());
        }
        return solicitudes.get(url);
    }

    async cargarFlujoConsulta(consulta, solicitudes = new Map(), idRolSeleccionado = null) {
        // Las respuestas completas ya normalizadas también son válidas (p. ej., caché offline).
        if (Array.isArray(consulta.pasos) && consulta.pasos.length && consulta.pasos.every((paso) =>
            idRolPaso(paso) != null && paso.idProcedimientoPaso != null && typeof paso.indicaFin === 'boolean')) return consulta;
        const [conProcedimientos] = await this._completarProcedimientos([consulta], solicitudes);
        const catalogo = (endpoint) => {
            if (!solicitudes.has(endpoint)) solicitudes.set(endpoint, leerCatalogo(this, endpoint));
            return solicitudes.get(endpoint);
        };
        const asignaciones = conProcedimientos.procedimientos.filter((asignacion) =>
            idEntidad(asignacion.idProcedimiento ?? asignacion.procedimiento, 'idProcedimiento') != null);
        if (!asignaciones.length) return { ...conProcedimientos, pasos: [], pasosClinicos: [], historialPasos: [] };
        const [ejecuciones, ordenes] = await Promise.all([
            catalogo(ENDPOINTS.CONSULTAS_PROCEDIMIENTOS_PASOS), catalogo(ENDPOINTS.ORDENES_EXAMEN)
        ]);
        const procedimientos = await Promise.all(asignaciones.map(async (asignacion) => {
            const idProcedimiento = idEntidad(asignacion.idProcedimiento ?? asignacion.procedimiento, 'idProcedimiento');
            const clave = `flujo:${idProcedimiento}`;
            if (!solicitudes.has(clave)) solicitudes.set(clave, procedimientoService.obtenerArbolPasos(idProcedimiento));
            const definiciones = await solicitudes.get(clave);
            const idAsignacion = asignacion.idConsultaProcedimiento ?? asignacion.id;
            const registros = await Promise.all(ejecuciones.filter((paso) =>
                String(idEntidad(paso.idConsultaProcedimiento, 'idConsultaProcedimiento')) === String(idAsignacion)
            ).map(async (registro) => {
                const personaRol = await this._leerRelacion(ENDPOINTS.PERSONAS_ROLES,
                    idEntidad(registro.idPersonaRol, 'idPersonaRol'), solicitudes);
                const persona = personaRol?.persona ?? await this._leerRelacion(ENDPOINTS.PERSONAS,
                    idEntidad(personaRol?.idPersona, 'idPersona'), solicitudes);
                const examenes = await Promise.all(ordenes.filter((orden) => String(idEntidad(orden.idConsultaProcedimientoPaso,
                    'idConsultaProcedimientoPaso')) === String(registro.idConsultaProcedimientoPaso ?? registro.id))
                    .map(async (orden) => ({ ...orden, examen: orden.examen ?? await this._leerRelacion(
                        ENDPOINTS.EXAMENES, idEntidad(orden.idExamen, 'idExamen'), solicitudes) })));
                return { ...registro, idConsultaProcedimientoPaso: registro.idConsultaProcedimientoPaso ?? registro.id,
                    responsable: { ...personaRol, persona },
                    ordenesExamen: examenes };
            }));
            const pasos = await Promise.all(definiciones.map(async (definicion) => {
                const idDefinicion = definicion.idProcedimientoPaso ?? definicion.id;
                const candidatos = registros.filter((registro) =>
                    String(idEntidad(registro.idProcedimientoPaso, 'idProcedimientoPaso')) === String(idDefinicion));
                const abiertos = candidatos.filter((registro) => ['EN_CURSO', 'PENDIENTE'].includes(estadoPaso(registro)));
                const registro = abiertos.find((paso) => estadoPaso(paso) === 'EN_CURSO') ?? abiertos[0]
                    ?? candidatos.toSorted((a, b) => String(b.fechaFin ?? '').localeCompare(String(a.fechaFin ?? '')))[0];
                const rolResponsable = await this._leerRelacion(ENDPOINTS.ROLES,
                    idEntidad(definicion.idRol, 'idRol'), solicitudes);
                return { ...definicion, ...registro,
                    id: registro?.id ?? null, idConsultaProcedimientoPaso: registro?.idConsultaProcedimientoPaso ?? null,
                    idProcedimientoPaso: idDefinicion, procedimientoPaso: definicion,
                    idRol: definicion.idRol, rolResponsable, orden: definicion.orden,
                    indicaFin: definicion.indicaFin, estado: registro?.estado ?? 'FUTURO' };
            }));
            const historial = registros.filter((registro) => estadoPaso(registro) === 'COMPLETADO').map((registro) => {
                const paso = pasos.find((paso) => String(paso.idProcedimientoPaso) === String(registro.idProcedimientoPaso));
                return { ...paso, ...registro, nombre: paso?.nombre ?? 'Paso sin definición' };
            });
            return { ...asignacion, pasos, historialPasos: historial };
        }));
        const elegido = procedimientos.find((p) => {
            const vigente = indicePasoVigente(p.pasos);
            return vigente >= 0 && (idRolSeleccionado == null || String(idRolPaso(p.pasos[vigente])) === String(idRolSeleccionado));
        }) ?? procedimientos.find((p) => idRolSeleccionado != null
            && String(idRolPaso(p.pasos.at(-1))) === String(idRolSeleccionado)) ?? procedimientos[0];
        return { ...conProcedimientos, procedimientos, pasos: elegido?.pasos ?? [], pasosClinicos: elegido?.pasos ?? [],
            idConsultaProcedimientoActivo: elegido?.idConsultaProcedimiento ?? elegido?.id,
            historialPasos: procedimientos.map((p) => ({
                nombre: p.procedimiento?.nombre ?? p.nombre ?? 'Procedimiento', esGrupoHistorial: true,
                pasos: p.historialPasos
            })) };
    }

    async findById(id) {
        const respuesta = await super.findById(id);
        const consulta = this._normalizePayload(respuesta) ?? respuesta;
        if (!consulta || typeof consulta !== "object") return consulta;
        const mapeada = this._mapearConsulta(consulta);
        const completada = await this._completarConsulta(mapeada, new Map(), {});
        return this.cargarFlujoConsulta({
            ...consulta,
            ...completada,
            pasos: consulta.pasos ?? completada.pasos,
            paciente: completada.paciente ?? consulta.paciente,
            clinica: completada.clinica ?? consulta.clinica
        });
    }

    obtenerUrlTicket(idConsulta) {
        if (idConsulta == null || String(idConsulta).trim() === "") {
            throw new Error("La consulta no tiene un identificador válido para ver el ticket.");
        }

        const url = new URL(`${ENDPOINTS.API_BASE}${ENDPOINTS.CONSULTAS}/${encodeURIComponent(idConsulta)}/ticket`);
        url.searchParams.set('frontendUrl', window.location.origin);
        return url.href;
    }
}

export const consultaService = new ConsultaService();

export default ConsultaService;
