import DefaultService from "./default_service.js";
import { DEFAULT_PAGE_SIZE } from "../config.js";
import { ENDPOINTS } from "../routes.js";

const MAX_CATALOGOS = 200;
const CATEGORIA_POR_DEFECTO = "General";

function primero(origen, claves, valorPorDefecto = "") {
    for (const clave of claves) {
        const valor = origen?.[clave];

        if (valor !== undefined && valor !== null && valor !== "") {
            return valor;
        }
    }

    return valorPorDefecto;
}

function idDe(origen, claves) {
    for (const clave of claves) {
        const valor = origen?.[clave];

        if (valor !== undefined && valor !== null && valor !== "") {
            return typeof valor === "object" ? idDe(valor, claves) : valor;
        }
    }

    return null;
}

function itemsDe(servicio, respuesta) {
    const items = servicio._normalizePayload(respuesta);
    return Array.isArray(items) ? items : [];
}

export class OrdenExamenService extends DefaultService {
    constructor() {
        super(ENDPOINTS.ORDENES_EXAMEN);
        this.pasosExamenesService = new DefaultService(ENDPOINTS.PROCEDIMIENTOS_PASOS_EXAMENES);
        this.examenesService = new DefaultService(ENDPOINTS.EXAMENES);
        this.examenesTiposExamenService = new DefaultService(ENDPOINTS.EXAMENES_TIPOS_EXAMEN);
        this.tiposExamenService = new DefaultService(ENDPOINTS.TIPOS_EXAMEN);
    }

    async listarExamenesPorPaso(idProcedimientoPaso) {
        if (idProcedimientoPaso === null || idProcedimientoPaso === undefined
            || String(idProcedimientoPaso).trim() === "") {
            return [];
        }

        const params = new URLSearchParams();
        params.set("idProcedimientoPaso", String(idProcedimientoPaso));
        params.set("first", "0");
        params.set("max", String(MAX_CATALOGOS));

        const respuesta = await this.pasosExamenesService._request(
            `${this.pasosExamenesService._urlBase}?${params.toString()}`,
            { method: "GET" },
            "Error al listar los exámenes del paso"
        );
        const relaciones = itemsDe(
            this.pasosExamenesService,
            await this.pasosExamenesService._parseBody(respuesta)
        );
        const clavesExamen = ["idExamen", "examen"];
        const ids = [...new Set(relaciones
            .map((relacion) => idDe(relacion, clavesExamen))
            .filter((id) => id !== null))];

        if (ids.length === 0) {
            return [];
        }

        const [examenes, vinculos, tipos] = await Promise.all([
            Promise.all(ids.map((id) => this.examenesService.get(id))),
            this.examenesTiposExamenService.findRange(0, MAX_CATALOGOS),
            this.tiposExamenService.findRange(0, MAX_CATALOGOS)
        ]);
        const tiposPorId = new Map(itemsDe(this.tiposExamenService, tipos)
            .map((tipo) => [String(idDe(tipo, ["idTipoExamen", "tipoExamen", "id"])), tipo]));
        const categoriaPorExamen = new Map();

        itemsDe(this.examenesTiposExamenService, vinculos).forEach((vinculo) => {
            const idExamen = idDe(vinculo, clavesExamen);
            const idTipo = idDe(vinculo, ["idTipoExamen", "tipoExamen", "id"]);
            const categoria = primero(tiposPorId.get(String(idTipo)), ["nombre", "descripcion", "categoria"]);

            if (idExamen !== null && categoria !== "" && !categoriaPorExamen.has(String(idExamen))) {
                categoriaPorExamen.set(String(idExamen), String(categoria));
            }
        });

        const indicacionesPorExamen = new Map(relaciones
            .filter((relacion) => idDe(relacion, clavesExamen) !== null)
            .map((relacion) => [
                String(idDe(relacion, clavesExamen)),
                primero(relacion, ["indicaciones", "indicacion", "descripcion"])
            ]));

        return examenes
            .filter((examen) => examen && examen.activo !== false)
            .map((examen) => {
                const idExamen = idDe(examen, ["idExamen", "id"]);

                return {
                    idExamen,
                    id: String(idExamen ?? ""),
                    nombre: primero(examen, ["nombre", "descripcion", "titulo"], "Examen sin nombre"),
                    categoria: categoriaPorExamen.get(String(idExamen)) ?? CATEGORIA_POR_DEFECTO,
                    indicaciones: indicacionesPorExamen.get(String(idExamen)) ?? ""
                };
            });
    }

    _payloadOrden(idProcedimientoPaso, examen) {
        const esObjeto = examen !== null && typeof examen === "object";

        return {
            idExamen: esObjeto ? idDe(examen, ["idExamen", "id"]) : examen,
            idConsultaProcedimientoPaso: idProcedimientoPaso,
            indicaciones: esObjeto ? primero(examen, ["indicaciones", "indicacion"]) : ""
        };
    }

    async crearOrdenes(idConsultaProcedimientoPaso, examenes = []) {
        if (idConsultaProcedimientoPaso === null || idConsultaProcedimientoPaso === undefined
            || String(idConsultaProcedimientoPaso).trim() === "") {
            throw new Error("El paso no tiene un identificador válido para crear órdenes.");
        }

        const lista = Array.isArray(examenes) ? examenes : [examenes];

        if (lista.length === 0) {
            return [];
        }

        const payloads = lista.map((examen) =>
            this._payloadOrden(idConsultaProcedimientoPaso, examen));
        const resultados = await Promise.allSettled(
            payloads.map((payload) => this.create(payload))
        );
        const fallido = resultados.find((resultado) => resultado.status === "rejected");

        if (fallido) {
            throw fallido.reason;
        }

        return resultados.map((resultado) => resultado.value);
    }

    asignarAPaso(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.create(this._payloadOrden(idConsultaProcedimientoPaso, datosOrden));
    }

    asignarAConsulta(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrdenExamen(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrden(idConsultaProcedimientoPaso, datosOrden = {}) {
        return this.asignarAPaso(idConsultaProcedimientoPaso, datosOrden);
    }

    asignarOrdenes(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    asignarOrdenesAConsulta(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    asignarOrdenesExamen(idConsultaProcedimientoPaso, examenes = []) {
        return this.crearOrdenes(idConsultaProcedimientoPaso, examenes);
    }

    consultarPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.findRange(first, max, idConsulta);
    }

    consultarOrdenesPorConsulta(idConsulta, first = 0, max = DEFAULT_PAGE_SIZE) {
        return this.consultarPorConsulta(idConsulta, first, max);
    }
}

export const ordenExamenService = new OrdenExamenService();

export default OrdenExamenService;
