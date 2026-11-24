import GestorFechas from "../../control/gestor_fechas.js";

export class HistorialPasos extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._pasos = [];
        this._pasoRegistro = null;
        this._botonRegistro = null;
        this._pasosOriginales = new WeakMap();
    }

    get pasos() {
        return this._pasos;
    }

    set pasos(valor) {
        this._pasos = valor ?? [];
        if (this.isConnected) this.render();
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        this._cerrarRegistro();
    }

    get cantidadRegistros() {
        return this._cantidadRegistros;
    }

    render() {
        this._cerrarRegistro();
        this._cantidadRegistros = 0;
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host([hidden]) { display: none; }
                :host {
                    display: block;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, sans-serif);
                }
                .historial {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 0.75rem);
                }
                .lista-pasos,
                .lista-pasos ul {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3, 0.75rem);
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                .lista-pasos ul {
                    margin-top: var(--space-3, 0.75rem);
                    padding-left: var(--space-6, 1.5rem);
                    border-left: var(--border-width, 1px) solid var(--color-border, #64748b);
                }
                .paso {
                    min-width: 0;
                }
                .paso-contenido {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-3, 0.75rem);
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 0.08));
                }
                .paso-info {
                    flex: 1 1 18rem;
                    min-width: 0;
                }
                .paso-nombre {
                    margin: 0 0 var(--space-1, 0.25rem);
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-base, 1rem);
                }
                .paso-datos {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-1, 0.25rem) var(--space-4, 1rem);
                    margin: 0;
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-sm, 0.875rem);
                }
                .paso-dato {
                    overflow-wrap: anywhere;
                }
                .boton {
                    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
                    border: 0;
                    border-radius: var(--radius-md, 0.5rem);
                    background-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                    cursor: pointer;
                }
                .boton:hover {
                    background-color: var(--color-primary-strong, #1e40af);
                }
                .boton:focus-visible {
                    outline: 2px solid var(--color-secondary, #0284c7);
                    outline-offset: 2px;
                }
                .vacio {
                    margin: 0;
                    padding: var(--space-4, 1rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text-muted, #475569);
                    text-align: center;
                }
                .vacio[hidden] {
                    display: none;
                }
                .dialogo {
                    inline-size: min(42rem, calc(100% - 2rem));
                    max-block-size: calc(100dvh - 2rem);
                    overscroll-behavior: contain;
                    padding: 0;
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-lg, 0.75rem);
                    background-color: var(--color-surface, #ffffff);
                    color: var(--color-text, #0f172a);
                    box-shadow: var(--shadow-lg, 0 20px 40px rgb(15 23 42 / 0.3));
                }
                .dialogo::backdrop {
                    background-color: rgb(15 23 42 / 0.55);
                }
                .modal {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4, 1rem);
                    padding: var(--space-4, 1rem);
                }
                .modal-cabecera {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--space-4, 1rem);
                }
                .modal-cabecera h3 {
                    margin: var(--space-1, 0.25rem) 0 0;
                    color: var(--color-primary, #1e3a8a);
                    font-size: var(--text-lg, 1.125rem);
                }
                .etiqueta {
                    color: var(--color-text-muted, #475569);
                    font-size: var(--text-xs, 0.75rem);
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .detalle-registro {
                    overflow-wrap: anywhere;
                    white-space: pre-wrap;
                    line-height: 1.6;
                }
                .boton-cerrar {
                    flex: none;
                    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
                    border: var(--border-width, 1px) solid var(--color-border, #64748b);
                    border-radius: var(--radius-md, 0.5rem);
                    background-color: transparent;
                    color: var(--color-text, #0f172a);
                    font: inherit;
                    font-size: var(--text-sm, 0.875rem);
                    cursor: pointer;
                }
                .boton-cerrar:hover {
                    background-color: var(--color-surface-alt, #e2e8f0);
                }
            </style>
            <section class="historial">
                <ul id="lista-pasos" class="lista-pasos"></ul>
                <p id="historial-vacio" class="vacio" hidden>No hay pasos registrados.</p>
            </section>
            <dialog
                id="dialogo-registro"
                class="dialogo"
                aria-labelledby="titulo-registro"
            >
                <div class="modal">
                    <header class="modal-cabecera">
                        <div>
                            <span class="etiqueta">Registro del paso</span>
                            <h3 id="titulo-registro"></h3>
                        </div>
                        <button
                            type="button"
                            id="cerrar-registro"
                            class="boton-cerrar"
                            aria-label="Cerrar registro"
                            autofocus
                        >Cerrar</button>
                    </header>
                    <p id="datos-registro" class="paso-datos"></p>
                    <div id="detalle-registro" class="detalle-registro"></div>
                </div>
            </dialog>
        `;

        const lista = this.shadowRoot.querySelector("#lista-pasos");
        const vacio = this.shadowRoot.querySelector("#historial-vacio");
        const pasos = this._filtrarEjecutados(this._normalizarPasos(this._pasos));

        lista.replaceChildren();
        vacio.hidden = pasos.length > 0;
        this._renderizarPasos(lista, pasos);

        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");
        const cerrar = this.shadowRoot.querySelector("#cerrar-registro");
        dialogo.addEventListener("close", () => this._notificarCierre());

        cerrar.addEventListener("click", (evento) => {
            evento.stopPropagation();
            this._cerrarRegistro();
        });
        dialogo.addEventListener("click", (evento) => {
            evento.stopPropagation();
            if (evento.target === dialogo) {
                this._cerrarRegistro();
            }
        });
    }

    _renderizarPasos(contenedor, pasos) {
        pasos.forEach((paso) => {
            const item = document.createElement("li");
            item.className = "paso";

            const contenido = document.createElement("div");
            contenido.className = "paso-contenido";

            const info = document.createElement("div");
            info.className = "paso-info";

            const nombre = document.createElement("h4");
            nombre.className = "paso-nombre";
            nombre.textContent = this._nombrePaso(paso);
            const esGrupo = paso.esGrupoHistorial === true;

            const datos = document.createElement("p");
            datos.className = "paso-datos";

            const profesional = document.createElement("span");
            profesional.className = "paso-dato";
            profesional.textContent = `Profesional: ${this._nombreProfesional(paso)}`;

            const fechaHora = document.createElement("span");
            fechaHora.className = "paso-dato";
            fechaHora.textContent = `Fecha y hora: ${this._fechaHoraPaso(paso)}`;

            datos.append(profesional, fechaHora);
            info.append(nombre);
            if (!esGrupo) info.append(datos);

            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "boton";
            boton.textContent = "Ver Registro";
            boton.addEventListener("click", (evento) => {
                evento.stopPropagation();
                this._abrirRegistro(paso, boton);
            });

            contenido.append(info);
            if (!esGrupo) {
                contenido.append(boton);
                this._cantidadRegistros++;
            }
            item.appendChild(contenido);

            const subpasos = this._obtenerSubpasos(paso);

            if (subpasos.length > 0) {
                const listaHijos = document.createElement("ul");
                this._renderizarPasos(listaHijos, subpasos);
                item.appendChild(listaHijos);
            }

            contenedor.appendChild(item);
        });
    }

    _abrirRegistro(paso, boton = null) {
        paso = this._pasosOriginales.get(paso) ?? paso;
        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");
        const titulo = this.shadowRoot.querySelector("#titulo-registro");
        const detalle = this.shadowRoot.querySelector("#detalle-registro");

        this._pasoRegistro = paso;
        this._botonRegistro = boton;

        titulo.textContent = this._nombrePaso(paso);
        detalle.textContent = this._detallePaso(paso);
        this.shadowRoot.querySelector("#datos-registro").textContent =
            `Profesional: ${this._nombreProfesional(paso)} · Fecha y hora: ${this._fechaHoraPaso(paso)}`;

        if (typeof dialogo.showModal !== "function") {
            dialogo.setAttribute("open", "");
        } else if (!dialogo.open) {
            dialogo.showModal();
        }

        this.dispatchEvent(new CustomEvent("registro-abierto", {
            bubbles: true,
            composed: true,
            detail: { paso }
        }));
    }

    _cerrarRegistro() {
        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");

        if (!dialogo?.open) {
            return;
        }

        if (typeof dialogo.close === "function") {
            dialogo.close();
        } else {
            dialogo.removeAttribute("open");
        }

        this._notificarCierre();
    }

    _notificarCierre() {
        if (!this._pasoRegistro) {
            return;
        }

        const paso = this._pasoRegistro;

        this._pasoRegistro = null;
        this._botonRegistro?.focus();
        this._botonRegistro = null;

        this.dispatchEvent(new CustomEvent("registro-cerrado", {
            bubbles: true,
            composed: true,
            detail: { paso }
        }));
    }

    _filtrarEjecutados(pasos, ancestros = new Set()) {
        return pasos.flatMap((paso) => {
            if (!paso || ancestros.has(paso)) return [];
            const ruta = new Set(ancestros).add(paso);
            const subpasos = this._obtenerSubpasos(paso);
            const hijos = this._filtrarEjecutados(subpasos, ruta);
            const estadoOriginal = paso.estadoPaso ?? paso.estado ?? "";
            const estado = String(estadoOriginal?.nombre ?? estadoOriginal?.descripcion
                ?? estadoOriginal?.codigo ?? estadoOriginal?.estado ?? estadoOriginal)
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toUpperCase().trim().replace(/[\s-]+/g, "_");
            const completado = ["COMPLETADO", "COMPLETADA", "FINALIZADO", "FINALIZADA", "EJECUTADO", "REALIZADO"].includes(estado);
            // Los registros antiguos sin estado conservan su contenido y metadatos.
            const tieneRegistro = paso.valor != null || paso.consulta_procedimiento_paso?.valor != null
                || paso.fechaHoraEjecucion || paso.fechaHoraRegistro || paso.contenidoCompleto
                || paso.contenido || paso.detalle || paso.registro || paso.notas;
            const esGrupo = paso.esGrupoHistorial === true || (subpasos.length > 0 && !estado && !tieneRegistro);
            const ejecutado = !esGrupo && (completado || !estado);
            if (!ejecutado && hijos.length === 0) return [];
            if (typeof paso === "string") return [paso];
            const registro = { ...paso, pasos: hijos, esGrupoHistorial: !ejecutado };
            this._pasosOriginales.set(registro, paso);
            return [registro];
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
            ?? valor.datos
            ?? [];

        if (Array.isArray(lista)) {
            return lista;
        }

        if (lista && typeof lista === "object") {
            return this._normalizarPasos(lista);
        }

        return [];
    }

    _obtenerSubpasos(paso) {
        if (!paso || typeof paso !== "object") {
            return [];
        }

        const subpasos = paso.pasos
            ?? paso.hijos
            ?? paso.subpasos
            ?? paso.children
            ?? paso.detalles
            ?? [];

        if (Array.isArray(subpasos)) {
            return subpasos;
        }

        return Array.isArray(subpasos?.items) ? subpasos.items : [];
    }

    _nombrePaso(paso) {
        if (typeof paso === "string") {
            return paso;
        }

        return paso?.nombre
            ?? paso?.nombrePaso
            ?? paso?.idProcedimientoPaso?.nombre
            ?? paso?.procedimientoPaso?.nombre
            ?? paso?.titulo
            ?? paso?.descripcion
            ?? paso?.procedimiento?.nombre
            ?? paso?.idProcedimiento?.nombre
            ?? "Paso sin nombre";
    }

    _nombreProfesional(paso) {
        const profesional = paso?.profesionalResponsable
            ?? paso?.profesional
            ?? paso?.responsable
            ?? paso?.medico
            ?? paso?.empleado
            ?? paso?.idPersonaRol
            ?? paso?.ejecutor
            ?? paso?.usuario;

        const rol = paso?.rolResponsable?.nombre ?? paso?.rolResponsable?.descripcion
            ?? paso?.responsable?.rol?.nombre ?? '';
        return [this._nombrePersona(profesional) || "Sin profesional", rol].filter(Boolean).join(' · ');
    }

    _nombrePersona(persona) {
        if (persona === null || persona === undefined || persona === "") {
            return "";
        }

        if (typeof persona === "string") {
            return persona;
        }

        if (typeof persona !== "object") {
            return String(persona);
        }

        const personaInterna = persona.persona ?? persona.perfil ?? persona.idPersona;

        if (personaInterna !== undefined && personaInterna !== null && personaInterna !== "") {
            return this._nombrePersona(personaInterna);
        }

        if (persona.nombreCompleto) {
            return persona.nombreCompleto;
        }

        const nombres = persona.nombres
            ?? persona.primerNombre
            ?? persona.nombre
            ?? "";

        const apellidos = Array.isArray(persona.apellidos)
            ? persona.apellidos.filter(Boolean).join(" ")
            : persona.apellidos
                ?? [persona.primerApellido, persona.segundoApellido].filter(Boolean).join(" ")
                ?? "";

        return `${nombres} ${apellidos}`.trim()
            || persona.descripcion
            || persona.usuario
            || "";
    }

    _fechaHoraPaso(paso) {
        const fechaHora = paso?.fechaFin
            ?? paso?.fechaHoraEjecucion
            ?? paso?.fechaHoraRegistro
            ?? paso?.fechaHora
            ?? paso?.fechaEjecucion
            ?? paso?.fechaRegistro
            ?? paso?.fechaRealizacion
            ?? paso?.fecha
            ?? "";

        const hora = paso?.horaEjecucion
            ?? paso?.horaRegistro
            ?? paso?.hora
            ?? "";

        if (fechaHora === null || fechaHora === undefined || fechaHora === "") {
            return hora === "" || hora === null || hora === undefined
                ? "Sin fecha"
                : String(hora);
        }

        if (fechaHora instanceof Date) {
            return Number.isNaN(fechaHora.getTime())
                ? "Sin fecha"
                : fechaHora.toLocaleString("es-SV");
        }

        if (typeof fechaHora === "object") {
            const fecha = fechaHora.fecha ?? fechaHora.fechaEjecucion ?? "";
            const horaObjeto = fechaHora.hora ?? fechaHora.horaEjecucion ?? "";
            return [fecha, horaObjeto].filter(Boolean).join(" ") || "Sin fecha";
        }

        if (paso?.fechaFin) return GestorFechas.formatearFechaISO(fechaHora) || 'Sin fecha';
        const texto = GestorFechas.normalizarFechaISO(String(fechaHora));

        if (texto.includes("T")) {
            const [fecha, horaTexto] = texto.split("T");
            return `${fecha} ${horaTexto.slice(0, 5)}`;
        }

        if (hora !== "" && hora !== null && hora !== undefined) {
            return `${texto} ${hora}`;
        }

        return texto;
    }

    _detallePaso(paso) {
        if (paso === null || paso === undefined) {
            return "Sin registro disponible.";
        }

        if (typeof paso === "string") {
            return paso;
        }

        const detalle = paso.consulta_procedimiento_paso?.valor
            ?? paso.valor
            ?? paso.contenidoCompleto
            ?? paso.contenido
            ?? paso.detalle
            ?? paso.registro
            ?? paso.observaciones
            ?? paso.notas
            ?? paso.descripcion
            ?? paso.texto
            ?? paso.datos;

        const examenes = paso.ordenesExamen ?? [];
        const texto = this._textoDetalle(detalle) || 'Sin registro disponible.';
        const lista = examenes.map((orden) => [orden.examen?.nombre ?? orden.nombreExamen ?? orden.idExamen,
            orden.indicaciones].filter(Boolean).join(': ')).join('\n');
        return examenes.length ? `${texto}\n\nExámenes administrados:\n${lista}` : texto;
    }

    _textoDetalle(detalle) {
        if (detalle === null || detalle === undefined || detalle === "") {
            return "";
        }

        if (typeof detalle === "string") {
            try {
                const datos = JSON.parse(detalle);

                return datos && typeof datos === "object"
                    ? this._textoDetalle(datos)
                    : detalle;
            } catch {
                return detalle;
            }
        }

        if (typeof detalle !== "object") {
            return String(detalle);
        }

        if (Array.isArray(detalle)) {
            return detalle
                .map((item) => this._textoDetalle(item))
                .filter(Boolean)
                .join("\n");
        }

        if (this._esRegistroClinico(detalle)) {
            return this._formatearRegistroClinico(detalle);
        }

        const interno = detalle.contenido
            ?? detalle.detalle
            ?? detalle.registro
            ?? detalle.texto
            ?? detalle.descripcion;

        if (interno !== undefined && interno !== null && interno !== detalle) {
            const texto = this._textoDetalle(interno);

            if (texto) {
                return texto;
            }
        }

        try {
            return JSON.stringify(detalle, null, 2);
        } catch {
            return String(detalle);
        }
    }

    _esRegistroClinico(detalle) {
        return [
            "notas", "notasConsulta", "diagnostico", "diagnosticos",
            "plan", "planTratamiento", "observaciones", "observacion"
        ].some((clave) => Object.hasOwn(detalle, clave));
    }

    _formatearRegistroClinico(detalle) {
        const diagnosticos = detalle.diagnostico ?? detalle.diagnosticos ?? [];
        const lista = Array.isArray(diagnosticos) ? diagnosticos : [diagnosticos];
        const textoDiagnosticos = lista
            .map((item) => {
                if (item && typeof item === "object") {
                    return [
                        item.codigo ?? item.code,
                        item.nombre ?? item.descripcion ?? item.description
                    ].filter(Boolean).join(" — ") || this._textoDetalle(item);
                }

                return String(item ?? "");
            })
            .filter(Boolean)
            .join("\n");

        const secciones = [
            ["Notas clínicas", detalle.notas ?? detalle.notasConsulta],
            ["Diagnósticos", textoDiagnosticos],
            ["Plan de tratamiento", detalle.plan ?? detalle.planTratamiento],
            ["Observaciones", detalle.observaciones ?? detalle.observacion]
        ];

        const texto = secciones
            .filter(([, valor]) => (
                valor !== undefined && valor !== null && String(valor).trim() !== ""
            ))
            .map(([titulo, valor]) => `${titulo}:\n${this._textoDetalle(valor)}`)
            .join("\n\n");

        return texto || JSON.stringify(detalle, null, 2);
    }
}

export default HistorialPasos;

if (!customElements.get("historial-pasos")) {
    customElements.define("historial-pasos", HistorialPasos);
}
