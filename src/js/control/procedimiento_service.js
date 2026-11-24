import DefaultService from "./default_service.js";
import { ENDPOINTS } from "../routes.js";
import { idEntidad } from '../entity/flujo_consulta.js';

// Recorre páginas reales; no supone que un catálogo cabe en su primera página.
export async function leerCatalogo(servicio, endpoint) {
    const items = [];
    const vistos = new Set();
    let first = 0;
    while (true) {
        const response = await servicio._request(`${ENDPOINTS.API_BASE}${endpoint}?first=${first}&max=100`,
            { method: 'GET' }, 'Error al consultar el flujo clínico');
        const payload = await response.json();
        const pagina = Array.isArray(payload) ? payload : payload?.items ?? [];
        const nuevos = pagina.filter((item) => {
            if (item.id == null) return true;
            if (vistos.has(String(item.id))) return false;
            vistos.add(String(item.id));
            return true;
        });
        items.push(...nuevos);
        first += pagina.length;
        if (!nuevos.length || first >= Number(payload?.total ?? first)) return items;
    }
}

export class ProcedimientoService extends DefaultService {
    constructor() {
        super(ENDPOINTS.PROCEDIMIENTOS);
    }

    async obtenerArbolPasos(idProcedimiento) {
        const [catalogo, secuencias] = await Promise.all([
            leerCatalogo(this, ENDPOINTS.PROCEDIMIENTOS_PASOS),
            leerCatalogo(this, ENDPOINTS.PROCEDIMIENTOS_PASOS_SECUENCIAS)
        ]);
        const pasos = catalogo.filter((paso) => String(idEntidad(paso.idProcedimiento, 'idProcedimiento'))
            === String(idProcedimiento));
        const porId = new Map(pasos.map((paso) => [String(paso.id ?? paso.idProcedimientoPaso), paso]));
        const enlaces = secuencias.filter((s) => s.tipoSecuencia === 'SIGUIENTE'
            && porId.has(String(s.idProcedimientoPaso)) && porId.has(String(s.idProcedimientoPasoReferencia)));
        const destinos = new Set(enlaces.map((s) => String(s.idProcedimientoPasoReferencia)));
        const iniciales = [...porId.keys()].filter((id) => !destinos.has(id));
        if (!pasos.length) return [];
        if (iniciales.length !== 1) throw new Error('El procedimiento no tiene un único paso inicial.');
        const ordenados = [];
        const visitados = new Set();
        let id = iniciales[0];
        while (id != null) {
            if (visitados.has(id)) throw new Error('El procedimiento contiene un ciclo de pasos.');
            visitados.add(id);
            ordenados.push({ ...porId.get(id), orden: ordenados.length });
            const siguientes = enlaces.filter((s) => String(s.idProcedimientoPaso) === id);
            if (siguientes.length > 1) throw new Error('El procedimiento tiene más de un siguiente paso.');
            id = siguientes.length ? String(siguientes[0].idProcedimientoPasoReferencia) : null;
        }
        if (ordenados.length !== pasos.length || !ordenados.at(-1)?.indicaFin) {
            throw new Error('La secuencia del procedimiento está incompleta o no tiene finalización.');
        }
        return ordenados;
    }

    obtenerArbolPasosAtencion(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }

    obtenerArbol(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }

    obtenerArbolProcedimientos(idProcedimiento) {
        return this.obtenerArbolPasos(idProcedimiento);
    }
}

export const procedimientoService = new ProcedimientoService();

export default ProcedimientoService;
