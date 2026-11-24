import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";

/** Estados permitidos por el backend para un paso de consulta-procedimiento. */
const ESTADOS_PASO = new Set(["COMPLETADO", "EN_CURSO", "PENDIENTE"]);

/** Un reintento tras un 412: GET → PATCH → (412) GET → PATCH. */
const MAX_INTENTOS = 2;

/**
 * Serializa los datos clínicos de un paso al formato legible que persiste el
 * backend dentro de `consulta_procedimiento_paso.valor`.
 *
 * @param {object} atencion - Datos del formulario clínico.
 * @returns {string} JSON con notas, diagnostico y plan.
 */
export function serializarValorPaso(atencion = {}) {
    const diagnosticos = Array.isArray(atencion.diagnosticos)
        ? atencion.diagnosticos
        : atencion.diagnosticos === undefined
            || atencion.diagnosticos === null
            || atencion.diagnosticos === ""
            ? []
            : [atencion.diagnosticos];

    return JSON.stringify({
        notas: atencion.notas ?? atencion.notasConsulta ?? "",
        diagnostico: atencion.diagnostico ?? diagnosticos,
        plan: atencion.plan ?? atencion.planTratamiento ?? ""
    });
}

/**
 * Construye el cuerpo exacto del PATCH de un paso: `estadoPaso` y `valor`.
 * Cualquier otro campo (índices, nombres, fechas, identificadores) se descarta.
 *
 * @param {object} atencion - Datos clínicos y estado del paso.
 * @returns {{ estadoPaso: string, valor: string }}
 */
export function construirPayloadPaso(atencion = {}) {
    const estadoPaso = atencion.estadoPaso ?? atencion.estado ?? "PENDIENTE";

    if (!ESTADOS_PASO.has(estadoPaso)) {
        throw new Error(`Estado de paso no válido: ${estadoPaso}`);
    }

    if (atencion.accion != null && atencion.accion !== 'RETROCEDER') {
        throw new Error('Acción de paso no válida.');
    }
    return {
        estadoPaso,
        ...(atencion.accion ? { accion: atencion.accion } : {}),
        valor: typeof atencion.valor === "string"
            ? atencion.valor
            : serializarValorPaso(atencion)
    };
}

/**
 * Servicio de los pasos de consulta-procedimiento. Persiste cada paso con
 * bloqueo optimista: lee el ETag con GET y lo envía como If-Match en el PATCH.
 */
export class ConsultaProcedimientoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.CONSULTAS_PROCEDIMIENTOS_PASOS);
    }

    serializarValorPaso(atencion = {}) {
        return serializarValorPaso(atencion);
    }

    construirPayloadPaso(atencion = {}) {
        return construirPayloadPaso(atencion);
    }

    async _leerEtag(url) {
        const response = await this._request(
            url,
            { method: "GET" },
            "Error al leer el paso de la consulta"
        );
        const etag = response?.headers?.get?.("ETag");

        if (!etag) {
            throw new Error("El servidor no devolvió el ETag del paso de la consulta.");
        }

        return etag.replace(/^W\//i, "").trim();
    }

    /**
     * Actualiza un paso usando el ETag vigente. Si otro cliente modificó el
     * paso y el servidor responde 412, vuelve a leer el ETag y reintenta una vez.
     *
     * @param {string} idPaso - UUID de consulta_procedimiento_paso.
     * @param {object} atencion - Datos clínicos y estado del paso.
     */
    async actualizarPaso(idPaso, atencion = {}) {
        if (idPaso == null || String(idPaso).trim() === "") {
            throw new Error("El paso no tiene un identificador válido para guardar.");
        }

        const url = `${this._urlBase}/${encodeURIComponent(idPaso)}`;
        const cuerpo = construirPayloadPaso(atencion);

        for (let intento = 0; intento < MAX_INTENTOS; intento++) {
            const etag = await this._leerEtag(url);

            try {
                const response = await this._request(url, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "If-Match": etag
                    },
                    body: JSON.stringify(cuerpo)
                }, "Error al actualizar el paso de la consulta");

                return this._parseBody(response);
            } catch (error) {
                if (error?.status === 412 && intento < MAX_INTENTOS - 1) {
                    continue;
                }
                throw error;
            }
        }

        return null;
    }

    guardarPaso(idPaso, atencion = {}) {
        return this.actualizarPaso(idPaso, atencion);
    }

    guardarConsultaProcedimientoPaso(idPaso, atencion = {}) {
        return this.actualizarPaso(idPaso, atencion);
    }

    registrarPaso(idPaso, datos = {}) {
        return this.actualizarPaso(idPaso, datos);
    }
}

export const consultaProcedimientoService = new ConsultaProcedimientoService();

export default ConsultaProcedimientoService;
