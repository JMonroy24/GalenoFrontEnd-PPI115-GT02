import "../componentes/asistente_busqueda.js";
import "../componentes/tarjeta_consulta.js";
import { consultaService } from "../../control/consulta_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

export class BusquedaCitasView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.solicitudActual = 0;
        this.escucharBusqueda = (evento) => this.buscar(evento.detail ?? {});
    }

    connectedCallback() {
        this.render();
        this.addEventListener("buscar-citas", this.escucharBusqueda);
    }

    disconnectedCallback() {
        this.removeEventListener("buscar-citas", this.escucharBusqueda);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
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
                    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
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
            </section>
        `;
    }

    async buscar(filtros) {
        if (!this.shadowRoot.querySelector("#resultados")) {
            this.render();
        }

        const estado = this.shadowRoot.querySelector("#estado");
        const resultados = this.shadowRoot.querySelector("#resultados");
        const solicitud = ++this.solicitudActual;

        this._mostrarEstado("Cargando citas...");
        resultados.replaceChildren();
        resultados.hidden = true;
        estado.hidden = false;

        try {
            const respuesta = await consultaService.buscarCitas(filtros);

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
            GeneradorMensajes.crearMensaje(
                "Error al buscar citas",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _crearTarjeta(cita) {
        const tarjeta = document.createElement("tarjeta-consulta");
        tarjeta.consulta = cita;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.slot = "acciones";
        boton.className = "btn";
        boton.textContent = "Descargar Ticket PDF";
        boton.addEventListener("click", () => this._descargarTicket(cita));

        tarjeta.appendChild(boton);
        return tarjeta;
    }

    async _descargarTicket(cita) {
        try {
            await consultaService.descargarTicketPdf(cita?.id ?? cita?.idConsulta);
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "Error al descargar el ticket",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _mostrarEstado(mensaje) {
        const estado = this.shadowRoot.querySelector("#estado");
        estado.textContent = mensaje;
        estado.hidden = false;
    }
}

export default BusquedaCitasView;

customElements.define("busqueda-citas-view", BusquedaCitasView);
