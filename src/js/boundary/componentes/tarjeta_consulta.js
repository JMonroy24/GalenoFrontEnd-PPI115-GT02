import "./historial_pasos.js";

export class TarjetaConsulta extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._consulta = null;
    }

    get consulta() {
        return this._consulta;
    }

    set consulta(valor) {
        this._consulta = valor;
        this.render();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const datos = {
            ...(this._consulta ?? {}),
            ...(this._consulta?.cita ?? {})
        };
        const procedimientos = this._obtenerProcedimientos(datos);
        const estado = this._obtenerEstado(datos);
        const pasos = this._obtenerPasos(datos);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, sans-serif);
                }
                .tarjeta {
                    overflow: hidden;
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }
                .cabecera {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-3, 0.75rem);
                    padding: var(--space-4, 1rem);
                    background-color: var(--color-primary-soft, #dbeafe);
                }
                .fecha {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1, 0.25rem);
                }
                .etiqueta {
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .fecha-valor {
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-lg, 1.125rem);
                }
                .estado {
                    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
                    border-radius: var(--radius-full, 9999px);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .estado--success {
                    background-color: var(--color-success-bg, #f0fdf4);
                    color: var(--color-success, #166534);
                }
                .estado--warning {
                    background-color: var(--color-warning-bg, #fffbeb);
                    color: var(--color-warning, #854d0e);
                }
                .estado--error {
                    background-color: var(--color-error-bg, #fef2f2);
                    color: var(--color-error, #b91c1c);
                }
                .estado--info {
                    background-color: var(--color-info-bg, #f0f9ff);
                    color: var(--color-info, #075985);
                }
                .datos {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
                    gap: var(--space-4, 1rem);
                    margin: 0;
                    padding: var(--space-4, 1rem);
                }
                .dato {
                    min-width: 0;
                }
                .dato dt {
                    margin-bottom: var(--space-1, 0.25rem);
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .dato dd {
                    margin: 0;
                    overflow-wrap: anywhere;
                }
                .procedimientos {
                    padding: var(--space-4, 1rem);
                    border-top: var(--border-width, 1px) solid var(--color-surface-alt, #e2e8f0);
                }
                .procedimientos h4 {
                    margin: 0 0 var(--space-2, 0.5rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-base, 1rem);
                }
                .procedimientos ul {
                    margin: 0;
                    padding-left: var(--space-6, 1.5rem);
                }
                .procedimientos li + li {
                    margin-top: var(--space-1, 0.25rem);
                }
                .procedimientos li::marker {
                    color: var(--color-secondary, #0284c7);
                }
                .procedimientos-vacio {
                    margin: 0;
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-sm, 0.875rem);
                }
                .historial-pasos {
                    padding: var(--space-4, 1rem);
                    border-top: var(--border-width, 1px) solid var(--color-surface-alt, #e2e8f0);
                }
                .historial-pasos h4 {
                    margin: 0 0 var(--space-2, 0.5rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-base, 1rem);
                }
                .historial-desplegable[hidden] {
                    display: none;
                }
                .historial-desplegable summary {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-2, 0.5rem);
                    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-md, 0.5rem);
                    background-color: var(--color-surface-alt, #e2e8f0);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                    cursor: pointer;
                }
                .historial-desplegable summary::marker {
                    color: var(--color-secondary, #0284c7);
                }
                .historial-contenido {
                    margin-top: var(--space-3, 0.75rem);
                }
                .historial-vacio {
                    margin: 0;
                    padding: var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) dashed var(--color-border, #64748b);
                    border-radius: var(--radius-md, 0.5rem);
                    background-color: var(--color-surface-alt, #e2e8f0);
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-sm, 0.875rem);
                    text-align: center;
                }
                .historial-vacio[hidden] {
                    display: none;
                }
                .pie {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: var(--space-2, 0.5rem);
                    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
                    border-top: var(--border-width, 1px) solid var(--color-surface-alt, #e2e8f0);
                }
            </style>
            <article class="tarjeta">
                <header class="cabecera">
                    <div class="fecha">
                        <span class="etiqueta">Fecha</span>
                        <strong class="fecha-valor" id="fecha"></strong>
                    </div>
                    <span class="estado" id="estado"></span>
                </header>
                <dl class="datos">
                    <div class="dato">
                        <dt>Hora</dt>
                        <dd id="hora"></dd>
                    </div>
                    <div class="dato">
                        <dt>Clínica</dt>
                        <dd id="clinica"></dd>
                    </div>
                    <div class="dato">
                        <dt>Estado</dt>
                        <dd id="estado-texto"></dd>
                    </div>
                </dl>
                <section class="procedimientos">
                    <h4>Procedimientos activos</h4>
                    <ul id="lista-procedimientos"></ul>
                    <p class="procedimientos-vacio" id="procedimientos-vacio">Sin procedimientos activos.</p>
                </section>
                <section class="historial-pasos" aria-labelledby="titulo-historial-pasos">
                    <h4 id="titulo-historial-pasos">Historial de pasos</h4>
                    <details class="historial-desplegable" id="historial-desplegable" open>
                        <summary>
                            <span>Pasos ejecutados</span>
                            <span id="historial-contador"></span>
                        </summary>
                        <div class="historial-contenido">
                            <historial-pasos id="historial-pasos"></historial-pasos>
                        </div>
                    </details>
                    <p class="historial-vacio" id="historial-vacio" hidden>Sin pasos ejecutados.</p>
                </section>
                <footer class="pie">
                    <slot name="acciones"></slot>
                </footer>
            </article>
        `;

        this.shadowRoot.querySelector("#fecha").textContent = this._obtenerFecha(datos);
        this.shadowRoot.querySelector("#hora").textContent = this._obtenerHora(datos);
        this.shadowRoot.querySelector("#clinica").textContent = this._obtenerClinica(datos);
        this.shadowRoot.querySelector("#estado-texto").textContent = estado;

        const estadoElemento = this.shadowRoot.querySelector("#estado");
        estadoElemento.textContent = estado;
        estadoElemento.classList.add(`estado--${this._claseEstado(estado)}`);

        const lista = this.shadowRoot.querySelector("#lista-procedimientos");
        const vacio = this.shadowRoot.querySelector("#procedimientos-vacio");

        vacio.hidden = procedimientos.length > 0;

        procedimientos.forEach((procedimiento) => {
            const item = document.createElement("li");
            item.textContent = this._nombreProcedimiento(procedimiento);
            lista.appendChild(item);
        });

        const historial = this.shadowRoot.querySelector("#historial-pasos");
        const historialDesplegable = this.shadowRoot.querySelector("#historial-desplegable");
        const historialContador = this.shadowRoot.querySelector("#historial-contador");
        const historialVacio = this.shadowRoot.querySelector("#historial-vacio");

        historial.pasos = pasos;
        historialDesplegable.hidden = pasos.length === 0;
        historialVacio.hidden = pasos.length > 0;
        historialContador.textContent = pasos.length > 0
            ? `(${pasos.length})`
            : "";
    }

    _obtenerFecha(datos) {
        const fecha = datos.fecha
            ?? datos.fechaConsulta
            ?? datos.fechaCita
            ?? datos.fechaHora
            ?? "";

        if (typeof fecha === "string" && fecha.includes("T")) {
            return fecha.split("T")[0];
        }

        return fecha === "" ? "Sin fecha" : String(fecha);
    }

    _obtenerHora(datos) {
        const hora = datos.hora
            ?? datos.horaConsulta
            ?? datos.horaCita
            ?? "";

        if (hora !== "") {
            return String(hora);
        }

        const fechaHora = datos.fechaHora ?? datos.fechaConsulta ?? datos.fechaCita;

        if (typeof fechaHora === "string" && fechaHora.includes("T")) {
            return fechaHora.split("T")[1]?.slice(0, 5) ?? "Sin hora";
        }

        return "Sin hora";
    }

    _obtenerClinica(datos) {
        const clinica = datos.clinica ?? datos.idClinica;

        if (typeof clinica === "string") {
            return clinica;
        }

        return datos.nombreClinica
            ?? clinica?.nombre
            ?? clinica?.name
            ?? datos.idClinica?.nombre
            ?? datos.idClinica?.name
            ?? "Sin clínica";
    }

    _obtenerEstado(datos) {
        const estado = datos.estado
            ?? datos.estadoConsulta
            ?? datos.estadoCita
            ?? datos.cita?.estado
            ?? "";

        if (estado && typeof estado === "object") {
            return String(estado.nombre ?? estado.descripcion ?? estado.estado ?? "Sin estado");
        }

        return estado === "" ? "Sin estado" : String(estado);
    }

    _obtenerProcedimientos(datos) {
        let procedimientos = datos.procedimientos
            ?? datos.procedimientosActivos
            ?? datos.detalles
            ?? datos.detallesConsulta
            ?? datos.detalleConsulta
            ?? [];

        if (!Array.isArray(procedimientos) && Array.isArray(procedimientos?.items)) {
            procedimientos = procedimientos.items;
        }

        if (!Array.isArray(procedimientos)) {
            return [];
        }

        return procedimientos.filter((procedimiento) => {
            if (procedimiento?.activo === false) {
                return false;
            }

            const estado = String(procedimiento?.estado ?? "").toLowerCase();
            return estado !== "inactivo" && estado !== "cancelado" && estado !== "eliminado";
        });
    }

    _obtenerPasos(datos) {
        const fuentes = [
            datos.pasos,
            datos.pasosEjecutados,
            datos.historialPasos,
            datos.historial,
            datos.atencion?.pasos,
            datos.atencion?.historial,
            datos.cita?.pasos,
            datos.cita?.historial
        ];

        for (const fuente of fuentes) {
            const pasos = this._normalizarPasos(fuente);

            if (pasos.length > 0) {
                return pasos;
            }
        }

        return [];
    }

    _normalizarPasos(valor) {
        if (Array.isArray(valor)) {
            return valor;
        }

        if (!valor || typeof valor !== "object") {
            return [];
        }

        const lista = valor.pasos
            ?? valor.items
            ?? valor.historial
            ?? valor.resultado
            ?? valor.datos;

        return Array.isArray(lista) ? lista : [];
    }

    _nombreProcedimiento(procedimiento) {
        if (typeof procedimiento === "string") {
            return procedimiento;
        }

        return procedimiento?.nombre
            ?? procedimiento?.nombreProcedimiento
            ?? procedimiento?.descripcion
            ?? procedimiento?.procedimiento?.nombre
            ?? procedimiento?.procedimiento
            ?? procedimiento?.idProcedimiento?.nombre
            ?? "Procedimiento sin nombre";
    }

    _claseEstado(estado) {
        const valor = String(estado ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        if (["confirmada", "completada", "atendida", "activa", "realizada"].includes(valor)) {
            return "success";
        }

        if (["cancelada", "anulada", "rechazada", "vencida"].includes(valor)) {
            return "error";
        }

        if (["pendiente", "programada", "agendada"].includes(valor)) {
            return "warning";
        }

        return "info";
    }
}

export default TarjetaConsulta;

customElements.define("tarjeta-consulta", TarjetaConsulta);
