import GestorFechas from "../../control/gestor_fechas.js";
import "./historial_pasos.js";
import { obtenerPacienteConsulta, obtenerDocumentoConsulta, obtenerNombreClinicaConsulta } from "../../control/consulta_service.js";

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
        if (this.isConnected) this.render();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const datos = {
            ...(this._consulta?.consulta?.cita ?? {}),
            ...(this._consulta?.consulta ?? {}),
            ...(this._consulta?.cita ?? {}),
            ...(this._consulta ?? {})
        };
        const listaProc = this._obtenerProcedimientos(datos);
        const estado = this._obtenerEstado(datos);
        const pasos = this._obtenerPasos(datos);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    min-inline-size: 0;
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
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
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
                        <dt>Paciente</dt>
                        <dd id="paciente"></dd>
                    </div>
                    <div class="dato">
                        <dt>Documento</dt>
                        <dd id="documento-paciente"></dd>
                    </div>
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

        const fecha = this._obtenerFecha(datos);
        const hora = this._obtenerHora(datos);
        const paciente = obtenerPacienteConsulta(datos) ?? {};
        const texto = (valor) => Array.isArray(valor)
            ? valor.filter((parte) => typeof parte === "string" && parte.trim()).join(" ")
            : typeof valor === "string" ? valor.trim() : "";
        const nombrePaciente = typeof paciente === "string"
            ? paciente
            : texto(paciente?.nombreCompleto) || [
                texto(paciente?.nombres) || texto(paciente?.nombre),
                texto(paciente?.apellidos) || texto(paciente?.apellido)
            ].filter(Boolean).join(" ") || "Sin paciente";
        const doc = obtenerDocumentoConsulta(datos) || "Sin documento";
        const clinica = this._obtenerClinica(datos);
        this.shadowRoot.querySelector("#fecha").textContent = fecha;
        this.shadowRoot.querySelector("#paciente").textContent = nombrePaciente;
        this.shadowRoot.querySelector("#documento-paciente").textContent = doc;
        this.shadowRoot.querySelector("#hora").textContent = hora;
        this.shadowRoot.querySelector("#clinica").textContent = clinica;
        this.shadowRoot.querySelector("#estado-texto").textContent = estado;

        const estadoElemento = this.shadowRoot.querySelector("#estado");
        estadoElemento.textContent = estado;
        estadoElemento.classList.add(`estado--${this._claseEstado(estado)}`);

        const lista = this.shadowRoot.querySelector("#lista-procedimientos");
        const vacio = this.shadowRoot.querySelector("#procedimientos-vacio");

        vacio.hidden = listaProc.length > 0;

        listaProc.forEach((proc) => {
            const item = document.createElement("li");
            item.textContent = this._nombreProcedimiento(proc);
            lista.appendChild(item);
        });

        const historial = this.shadowRoot.querySelector("#historial-pasos");
        const historialDesplegable = this.shadowRoot.querySelector("#historial-desplegable");
        const historialContador = this.shadowRoot.querySelector("#historial-contador");
        const historialVacio = this.shadowRoot.querySelector("#historial-vacio");

        historial.pasos = pasos;
        const cantidad = historial.cantidadRegistros;
        historialDesplegable.hidden = cantidad === 0;
        historialVacio.hidden = cantidad > 0;
        historialContador.textContent = cantidad > 0
            ? `(${cantidad})`
            : "";
        for (const tipo of ["registro-abierto", "registro-cerrado"]) {
            historial.addEventListener(tipo, (evento) => {
                this.dispatchEvent(new CustomEvent(`registro-consulta-${tipo === "registro-abierto" ? "abierto" : "cerrado"}`, {
                    bubbles: true,
                    composed: true,
                    detail: { consulta: this._consulta, paso: evento.detail.paso }
                }));
            });
        }
    }

    _fuentesDatos(datos) {
        return [datos, datos?.consulta, datos?.cita, datos?.consulta?.cita].filter(Boolean);
    }

    _fechasConsulta(datos) {
        return this._fuentesDatos(datos).flatMap((fuente) => [
            fuente?.inicio, fuente?.fecha, fuente?.fechaConsulta, fuente?.fechaCita,
            fuente?.fechaHora, fuente?.fechaInicio, fuente?.fechaCreacion
        ]).filter((fecha) => typeof fecha === "string" && fecha.trim());
    }

    _obtenerFecha(datos) {
        const fecha = this._fechasConsulta(datos)[0]?.trim() || "";
        return GestorFechas.extraerFechaCalendario(fecha) || "Sin fecha";
    }

    _obtenerHora(datos) {
        const hora = this._fuentesDatos(datos).map((fuente) => fuente?.hora || fuente?.horaConsulta
            || fuente?.horaCita || fuente?.horaInicio).find((valor) => valor != null && String(valor).trim());
        if (hora) return String(hora).match(/[T ](\d{2}:\d{2})/)?.[1] || String(hora);
        const fechaHora = this._fechasConsulta(datos).find((fecha) => /[T ]\d{2}:\d{2}/.test(fecha));
        return fechaHora?.match(/[T ](\d{2}:\d{2})/)?.[1] || "Sin hora";
    }

    _obtenerClinica(datos) {
        return obtenerNombreClinicaConsulta(datos);
    }

    _obtenerEstado(datos) {
        return this._fuentesDatos(datos).flatMap((fuente) => [fuente?.estado, fuente?.estadoConsulta, fuente?.estadoCita])
            .map((estado) => typeof estado === "object"
                ? estado?.nombre || estado?.descripcion || estado?.estado : estado)
            .find((estado) => typeof estado === "string" && estado.trim()) || "Sin estado";
    }

    _obtenerProcedimientos(datos) {
        const procedimientos = this._buscarListaProcedimientos(datos);
        const lista = procedimientos.length > 0 ? procedimientos : this._obtenerPasos(datos);

        return lista.filter((procedimiento) => {
            if (procedimiento == null || (typeof procedimiento !== "object"
                && typeof procedimiento !== "string") || Array.isArray(procedimiento)) {
                return false;
            }
            if (procedimiento?.activo === false) {
                return false;
            }

            const estado = String(procedimiento?.estado ?? "").toLowerCase();
            return estado !== "inactivo" && estado !== "cancelado" && estado !== "eliminado";
        });
    }

    _buscarListaProcedimientos(datos) {
        const campos = [
            "consultaProcedimientos", "procedimientos", "consultaProcedimientoList",
            "consulta_procedimientos", "consulta_procedimiento", "procedimientosActivos",
            "detalles", "detallesConsulta", "detalleConsulta"
        ];
        // El servicio puede añadir procedimientos: [] sin quitar la lista original.
        // Buscar una lista con elementos también en la consulta o cita anidada.
        for (const consulta of this._fuentesDatos(datos)) {
            const listaProc = consulta.consultaProcedimientos || consulta.procedimientos || consulta.pasos || [];
            const lista = this._normalizarPasos(listaProc);
            if (lista.length > 0) return lista;

            for (const campo of campos) {
                const lista = this._normalizarPasos(consulta[campo]);
                if (lista.length > 0) return lista;
            }
        }
        return [];
    }

    _obtenerPasos(datos) {
        const fuentes = [
            datos.historialPasos,
            datos.pasosClinicos,
            datos.pasos_clinicos,
            datos.consulta_procedimiento_paso,
            datos.consultaProcedimientoPasos,
            datos.consultaProcedimientoPasoList,
            datos.pasosEjecutados,
            datos.historialPasos,
            datos.historial,
            datos.atencion?.pasosEjecutados,
            datos.atencion?.historialPasos,
            datos.atencion?.historial,
            datos.cita?.pasosEjecutados,
            datos.cita?.historialPasos,
            datos.cita?.historial,
            datos.pasos,
            datos.atencion?.pasos,
            datos.cita?.pasos
        ];

        for (const fuente of fuentes) {
            const pasos = this._normalizarPasos(fuente);

            if (pasos.length > 0) {
                return pasos;
            }
        }

        // Si los pasos vienen dentro de cada procedimiento, conserva ese nivel
        // del árbol, incluyendo procedimientos que ya no están activos.
        const procedimientos = this._buscarListaProcedimientos(datos);
        return procedimientos.flatMap((procedimiento) => {
            const pasos = this._normalizarPasos(
                procedimiento.pasosClinicos ?? procedimiento.consulta_procedimiento_paso
                ?? procedimiento.consultaProcedimientoPasoList ?? procedimiento.pasos
            );
            return pasos.length > 0 ? [{
                nombre: this._nombreProcedimiento(procedimiento),
                esGrupoHistorial: true,
                pasos
            }] : [];
        });
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

        return lista && lista !== valor ? this._normalizarPasos(lista) : [];
    }

    _nombreProcedimiento(proc) {
        if (typeof proc === "string") return proc.trim() || "Procedimiento clínico";
        const nombreProc = proc.procedimiento?.nombre || proc.nombre || 'Procedimiento clínico';
        const nombres = [
            proc.procedimiento?.nombre,
            proc.nombre,
            proc.nombreProcedimiento,
            proc.descripcion,
            proc.idProcedimiento?.nombre,
            proc.paso?.nombre,
            proc.procedimiento,
            nombreProc
        ];
        return nombres.find((nombre) => typeof nombre === "string" && nombre.trim())?.trim()
            || "Procedimiento clínico";
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

if (!customElements.get("tarjeta-consulta")) {
    customElements.define("tarjeta-consulta", TarjetaConsulta);
}
