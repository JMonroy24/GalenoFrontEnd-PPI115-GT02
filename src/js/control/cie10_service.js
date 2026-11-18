import DefaultService from "./default_service.js";
import DefaultResponse from "../entity/default_response.js";
import { ENDPOINTS } from "../routes.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";

const RUTA_CATALOGO_LOCAL = new URL("../../recursos/datos/cie10.json", import.meta.url).href;

function normalizarTexto(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");
}

/**
 * Servicio para consultar el catálogo de diagnósticos médicos CIE-10.
 * usa el parámetro 'q' de findRange y un catálogo local como respaldo.
 */
export class Cie10Service extends DefaultService {
    constructor(rutaCatalogoLocal = RUTA_CATALOGO_LOCAL) {
        super(ENDPOINTS.CIE10);
        this.rutaCatalogoLocal = rutaCatalogoLocal;
        this._catalogoLocal = null;
        this._promesaCatalogoLocal = null;
    }

    /**
     * Consulta diagnósticos que coincidan por código o nombre mediante el parámetro 'q'.
     * Si el backend falla o no hay conexión, busca en el catálogo local cacheado.
     *
     * @param {string} query - Término de búsqueda (código o nombre).
     * @param {number} [first=0] - Desplazamiento inicial.
     * @param {number} [max=DEFAULT_PAGE_SIZE] - Cantidad máxima de registros.
     * @returns {Promise<import("../entity/default_response.js").default>}
     */
    async buscarDiagnosticos(query = "", first = 0, max = DEFAULT_PAGE_SIZE) {
        if (this._estaSinConexion()) {
            return this._buscarEnCatalogoLocal(query, first, max);
        }

        try {
            return await super.findRange(first, max, query);
        } catch (error) {
            if (error?.name === "AbortError") {
                throw error;
            }

            try {
                return await this._buscarEnCatalogoLocal(query, first, max);
            } catch {
                throw error;
            }
        }
    }

    findRange(first = 0, max = DEFAULT_PAGE_SIZE, query = "") {
        return this.buscarDiagnosticos(query, first, max);
    }

    async _buscarEnCatalogoLocal(query = "", first = 0, max = DEFAULT_PAGE_SIZE) {
        const catalogo = await this._obtenerCatalogoLocal();
        const termino = normalizarTexto(query).trim();

        const coincidencias = termino === ""
            ? catalogo
            : catalogo.filter((diagnostico) => {
                const codigo = normalizarTexto(diagnostico?.codigo ?? diagnostico?.code);
                const nombre = normalizarTexto(
                    diagnostico?.nombre ??
                    diagnostico?.descripcion ??
                    diagnostico?.label
                );

                return codigo.includes(termino) || nombre.includes(termino);
            });

        const inicio = Math.max(0, Number(first) || 0);
        const cantidad = Math.max(0, Number(max) || 0);
        const items = coincidencias.slice(inicio, inicio + cantidad);

        return new DefaultResponse(items, coincidencias.length, inicio, cantidad);
    }

    async _obtenerCatalogoLocal() {
        if (Array.isArray(this._catalogoLocal)) {
            return this._catalogoLocal;
        }

        if (!this._promesaCatalogoLocal) {
            this._promesaCatalogoLocal = fetch(this.rutaCatalogoLocal)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`No se pudo cargar el catálogo CIE-10 local (HTTP ${response.status})`);
                    }
                    return response.json();
                })
                .then((payload) => {
                    const catalogo = Array.isArray(payload) ? payload : payload?.items;
                    if (!Array.isArray(catalogo)) {
                        throw new Error("Catálogo CIE-10 local inválido");
                    }

                    this._catalogoLocal = catalogo;
                    return catalogo;
                })
                .catch((error) => {
                    this._promesaCatalogoLocal = null;
                    throw error;
                });
        }

        return this._promesaCatalogoLocal;
    }
}

export const cie10Service = new Cie10Service();

export default Cie10Service;
