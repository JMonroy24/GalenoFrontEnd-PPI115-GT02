import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

export class ConsultaProcedimientoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.CONSULTAS);
    }

    /**
     * Serializa las notas, diagnósticos CIE-10 y plan de tratamiento en formato legible.
     * @param {object} datos
     * @returns {string}
     */
    serializarValorPaso({ notasConsulta = "", diagnosticos = [], planTratamiento = "" } = {}) {
        const lineas = [];
        if (notasConsulta) {
            lineas.push(`Notas de Consulta: ${notasConsulta}`);
        }
        if (Array.isArray(diagnosticos) && diagnosticos.length > 0) {
            const diagTexto = diagnosticos
                .map((d) => typeof d === "object" ? `${d.codigo ?? d.code ?? ""} - ${d.descripcion ?? d.nombre ?? ""}`.trim() : String(d))
                .join(", ");
            lineas.push(`Diagnóstico Principal (CIE-10): ${diagTexto}`);
        }
        if (planTratamiento) {
            lineas.push(`Plan de Tratamiento: ${planTratamiento}`);
        }
        return lineas.join("\n");
    }

    /**
     * Registra el valor y estado de un paso dentro del procedimiento de la consulta.
     * @param {string|number} idConsulta
     * @param {string|number} idPaso
     * @param {object} datos
     */
    async registrarPaso(idConsulta, idPaso, datos = {}) {
        const valorLegible = datos.valor ?? this.serializarValorPaso(datos);
        const payload = {
            idConsulta,
            idPaso,
            valor: valorLegible,
            estado: datos.estado ?? "COMPLETADO",
            fechaHora: new Date().toISOString()
        };

        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(idConsulta)}/atencion`,
            this._jsonOptions("POST", payload),
            "Error al registrar el paso de atención"
        );

        return this._parseBody(response);
    }
}

export const consultaProcedimientoService = new ConsultaProcedimientoService();
export default ConsultaProcedimientoService;

