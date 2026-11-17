import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import DefaultResponse from "../entity/default_response.js";
import { ENDPOINTS } from "../routes.js";
import {
    construirPayloadPaso,
    serializarValorPaso
} from "./consulta_procedimiento_service.js";

export class ConsultaService extends DefaultService {
    constructor() {
        super(ENDPOINTS.CONSULTAS);
    }

    async _buscarCitas(filtros, first, max) {
        const params = new URLSearchParams();
        params.set("first", first);
        params.set("max", max);

        Object.entries(filtros).forEach(([clave, valor]) => {
            if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
                params.set(clave, valor);
            }
        });

        const response = await this._request(
            `${this._urlBase}?${params.toString()}`,
            { method: "GET" },
            "Error al consultar las citas"
        );
        const payload = await response.json();
        const items = Array.isArray(payload?.items)
            ? payload.items.filter((consulta) => consulta !== null
                && typeof consulta === "object" && !Array.isArray(consulta))
                .map((consulta) => this._mapearConsulta(consulta))
            : [];

        return new DefaultResponse(
            items,
            payload?.total ?? 0,
            payload?.first ?? 0,
            payload?.max ?? 0
        );
    }

    _mapearConsulta(consulta) {
        const datos = { ...consulta.cita, ...consulta };
        const paciente = datos.paciente ?? datos.persona ?? datos.idPersona;
        const procedimientos = datos.procedimientos
            ?? datos.consultaProcedimientos
            ?? datos.consultaProcedimientoList
            ?? datos.procedimientosActivos
            ?? datos.detalles ?? datos.detallesConsulta ?? datos.detalleConsulta;

        // Conservar el JSON original (incluidos rol, clínica y pasos anidados)
        // y exponer los nombres que comparten las vistas de búsqueda y dashboard.
        return {
            ...consulta,
            idConsulta: consulta.idConsulta ?? consulta.id,
            fecha: datos.fecha ?? datos.fechaConsulta ?? datos.fechaCita ?? datos.fechaHora,
            clinica: datos.clinica ?? datos.idClinica,
            paciente: paciente?.persona ?? paciente,
            procedimientos: Array.isArray(procedimientos)
                ? procedimientos
                : Array.isArray(procedimientos?.items) ? procedimientos.items : []
        };
    }

    buscarCitas(filtros = {}, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this._buscarCitas(filtros, first, max);
    }

    buscarPorClinica(idClinica, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this._buscarCitas({ idClinica }, first, max);
    }

    buscarCitasPorClinica(idClinica, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.buscarPorClinica(idClinica, first, max);
    }

    buscarPorEstado(estado, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this._buscarCitas({ estado }, first, max);
    }

    buscarCitasPorEstado(estado, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.buscarPorEstado(estado, first, max);
    }

    buscarCitasPorClinicaYEstado(idClinica, estado, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this._buscarCitas({ idClinica, estado }, first, max);
    }

    buscarPorClinicaYEstado(idClinica, estado, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.buscarCitasPorClinicaYEstado(idClinica, estado, first, max);
    }

    consultarCitas(filtros = {}, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.buscarCitas(filtros, first, max);
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

    async registrarAtencion(idConsulta, atencion) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(idConsulta)}/atencion`,
            this._jsonOptions("POST", atencion),
            "Error al registrar la atención médica"
        );

        return this._parseBody(response);
    }

    registrarAtencionMedica(idConsulta, atencion) {
        return this.registrarAtencion(idConsulta, atencion);
    }

    /**
     * Serializa los datos clínicos del formulario al formato estructurado que
     * consume el backend dentro de `consulta_procedimiento_paso.valor`.
     *
     * @param {object} atencion
     * @returns {{ notas: string, diagnostico: Array<unknown>, plan: string }}
     */
    serializarValorPaso(atencion = {}) {
        return serializarValorPaso(atencion);
    }

    /**
     * Construye el payload de un paso clínico agregando el valor serializado
     * al atributo `consulta_procedimiento_paso`.
     *
     * @param {object} atencion
     * @returns {object}
     */
    construirPayloadPaso(atencion = {}) {
        return construirPayloadPaso(atencion);
    }

    async guardarPaso(idConsulta, atencion) {
        return this.registrarAtencion(
            idConsulta,
            this.construirPayloadPaso(atencion)
        );
    }

    guardarConsultaProcedimientoPaso(idConsulta, atencion) {
        return this.guardarPaso(idConsulta, atencion);
    }

    async descargarTicketPdf(idConsulta) {
        if (idConsulta == null || String(idConsulta).trim() === "") {
            throw new Error("La consulta no tiene un identificador válido para descargar el ticket.");
        }

        const url = `${this._urlBase}/${encodeURIComponent(idConsulta)}/ticket`;
        const response = await this._request(
            url,
            { method: "GET", headers: { Accept: "application/pdf" } },
            "Error al descargar el ticket de la consulta"
        );
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const enlace = document.createElement("a");

        enlace.href = objectUrl;
        enlace.download = `ticket-cita-${idConsulta}.pdf`;
        enlace.style.display = "none";

        try {
            document.body?.appendChild(enlace);
            enlace.click();
        } finally {
            enlace.remove?.();
            // Da tiempo al navegador para iniciar la descarga antes de liberar el blob.
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }

        return blob;
    }
}

export const consultaService = new ConsultaService();

export default ConsultaService;
