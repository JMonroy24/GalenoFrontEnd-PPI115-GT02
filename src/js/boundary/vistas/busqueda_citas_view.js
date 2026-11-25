import "../componentes/asistente_busqueda.js";
import "../componentes/tarjeta_consulta.js";
import { consultaService } from "../../control/consulta_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";
import { DEFAULT_FIRST, DEFAULT_PAGE_SIZE } from "../../config.js";

export class BusquedaCitasView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.solicitudActual = 0;
        this.filtros = {};
        this.first = DEFAULT_FIRST;
        this.max = DEFAULT_PAGE_SIZE;
        this.total = 0;
        this.cargando = false;
        this.escucharBusqueda = (evento) => this.buscar(evento.detail ?? {});
        this.escucharPaginacion = (evento) => this._cambiarPagina(evento);
    }

    connectedCallback() {
        this.render();
        this.addEventListener("buscar-citas", this.escucharBusqueda);
        this.shadowRoot.addEventListener("click", this.escucharPaginacion);
    }

    disconnectedCallback() {
        this.solicitudActual++;
        this.cargando = false;
        this.removeEventListener("buscar-citas", this.escucharBusqueda);
        this.shadowRoot.removeEventListener("click", this.escucharPaginacion);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    min-inline-size: 0;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, sans-serif);
                }
                .vista {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                }
                .resultados {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
                    gap: var(--space-4, 1rem);
                }
                .estado {
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text-muted, #475569);
                    text-align: center;
                }
                .estado[hidden] {
                    display: none;
                }
                .paginacion {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-3, 0.75rem);
                }
                .paginacion[hidden] {
                    display: none;
                }
                .paginacion button:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                #pagina-info {
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-sm, 0.875rem);
                }
            </style>
            <section class="vista">
                <asistente-busqueda></asistente-busqueda>
                <div
                    id="estado"
                    class="estado"
                    role="status"
                    aria-live="polite"
                    hidden
                ></div>
                <div id="resultados" class="resultados" role="list" hidden></div>
                <div id="paginacion" class="paginacion" hidden>
                    <button id="pagina-anterior" type="button" class="btn" data-pagina="anterior">
                        Anterior
                    </button>
                    <span id="pagina-info" aria-live="polite"></span>
                    <button id="pagina-siguiente" type="button" class="btn" data-pagina="siguiente">
                        Siguiente
                    </button>
                </div>
            </section>
        `;
    }

    async buscar(filtros = this.filtros, { first = DEFAULT_FIRST, max = DEFAULT_PAGE_SIZE } = {}) {
        if (!this.shadowRoot.querySelector("#resultados")) {
            this.render();
        }

        const estado = this.shadowRoot.querySelector("#estado");
        const resultados = this.shadowRoot.querySelector("#resultados");
        const solicitud = ++this.solicitudActual;

        this.filtros = filtros ?? {};
        this.first = first;
        this.max = max;
        this.cargando = true;

        this._mostrarEstado("Cargando citas...");
        resultados.replaceChildren();
        resultados.hidden = true;
        this._actualizarPaginacion(0);

        let cantidad = 0;

        try {
            const respuesta = await consultaService.buscarCitas(this.filtros, this.first, this.max);

            if (solicitud !== this.solicitudActual) {
                return;
            }

            const citas = Array.isArray(respuesta?.items)
                ? respuesta.items
                : Array.isArray(respuesta?.datos)
                    ? respuesta.datos
                    : Array.isArray(respuesta)
                        ? respuesta
                        : [];

            cantidad = citas.length;
            this.total = Number(respuesta?.total ?? citas.length) || 0;

            if (citas.length === 0) {
                this._mostrarEstado("No se encontraron citas.");
                return;
            }

            estado.hidden = true;
            resultados.hidden = false;

            citas.forEach((cita) => {
                resultados.appendChild(this._crearTarjeta(cita));
            });
        } catch (error) {
            if (solicitud !== this.solicitudActual) {
                return;
            }

            this._mostrarEstado("No se pudieron cargar las citas.");
            if (!error?.notificado) {
                GeneradorMensajes.crearMensaje(
                    "Error al buscar citas",
                    error?.mensaje ?? error?.message ?? "",
                    "error"
                );
            }
        } finally {
            if (solicitud === this.solicitudActual) {
                this.cargando = false;
                this._actualizarPaginacion(cantidad);
            }
        }
    }

    _cambiarPagina(evento) {
        const boton = evento.target?.closest?.("button[data-pagina]");

        if (!boton || boton.disabled || this.cargando) {
            return;
        }

        const first = boton.dataset.pagina === "siguiente"
            ? this.first + this.max
            : Math.max(DEFAULT_FIRST, this.first - this.max);

        if (first === this.first) {
            return;
        }

        this.buscar(this.filtros, { first, max: this.max });
    }

    _actualizarPaginacion(cantidad) {
        const contenedor = this.shadowRoot.querySelector("#paginacion");
        const anterior = this.shadowRoot.querySelector("#pagina-anterior");
        const siguiente = this.shadowRoot.querySelector("#pagina-siguiente");
        const info = this.shadowRoot.querySelector("#pagina-info");

        if (!contenedor) {
            return;
        }

        const conResultados = this.total > 0 && cantidad > 0;

        contenedor.hidden = !conResultados;
        anterior.disabled = this.cargando || this.first <= DEFAULT_FIRST;
        siguiente.disabled = this.cargando || !conResultados || this.first + cantidad >= this.total;
        info.textContent = conResultados
            ? `Mostrando ${this.first + 1}-${this.first + cantidad} de ${this.total}`
            : "";
    }

    _crearTarjeta(cita) {
        const tarjeta = document.createElement("tarjeta-consulta");
        tarjeta.consulta = cita;

        return tarjeta;
    }

    _mostrarEstado(mensaje) {
        const estado = this.shadowRoot.querySelector("#estado");
        estado.textContent = mensaje;
        estado.hidden = false;
    }
}

export default BusquedaCitasView;

customElements.define("busqueda-citas-view", BusquedaCitasView);
