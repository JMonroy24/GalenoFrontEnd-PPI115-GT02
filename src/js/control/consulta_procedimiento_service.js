/**
 * Serializa los datos clínicos de un paso al formato legible que persiste el
 * backend dentro de `consulta_procedimiento_paso.valor`.
 *
 * @param {object} atencion - Datos del formulario clínico.
 * @returns {{ notas: string, diagnostico: Array<unknown>, plan: string }}
 */
export function serializarValorPaso(atencion = {}) {
    const diagnosticos = Array.isArray(atencion.diagnosticos)
        ? atencion.diagnosticos
        : atencion.diagnosticos === undefined
            || atencion.diagnosticos === null
            || atencion.diagnosticos === ""
            ? []
            : [atencion.diagnosticos];

    return {
        notas: atencion.notas ?? atencion.notasConsulta ?? "",
        diagnostico: atencion.diagnostico ?? diagnosticos,
        plan: atencion.plan ?? atencion.planTratamiento ?? ""
    };
}

/**
 * Construye el payload de un paso agregando el valor serializado dentro del
 * atributo `consulta_procedimiento_paso`.
 *
 * @param {object} atencion - Datos clínicos del paso.
 * @returns {object}
 */
export function construirPayloadPaso(atencion = {}) {
    const payload = { ...atencion };
    const clavesDatos = [
        "notas",
        "notasConsulta",
        "diagnostico",
        "diagnosticos",
        "plan",
        "planTratamiento"
    ];
    const tieneDatos = clavesDatos.some(
        (clave) => atencion[clave] !== undefined
    );

    if (tieneDatos) {
        payload.consulta_procedimiento_paso = {
            ...(atencion.consulta_procedimiento_paso ?? {}),
            valor: serializarValorPaso(atencion)
        };
    }

    return payload;
}

/**
 * Servicio de apoyo para serializar y persistir los datos clínicos asociados
 * al paso activo de una consulta.
 */
export class ConsultaProcedimientoService {
    serializarValorPaso(atencion = {}) {
        return serializarValorPaso(atencion);
    }

    construirPayloadPaso(atencion = {}) {
        return construirPayloadPaso(atencion);
    }

    async guardarPaso(idConsulta, atencion = {}) {
        const { consultaService } = await import("./consulta_service.js");

        return consultaService.guardarPaso(idConsulta, atencion);
    }

    guardarConsultaProcedimientoPaso(idConsulta, atencion = {}) {
        return this.guardarPaso(idConsulta, atencion);
    }
}

export const consultaProcedimientoService = new ConsultaProcedimientoService();

export default ConsultaProcedimientoService;
