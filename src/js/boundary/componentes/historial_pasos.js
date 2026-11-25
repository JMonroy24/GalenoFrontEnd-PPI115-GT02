import GestorFechas from "../../control/gestor_fechas.js";

export class HistorialPasos extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._pasos = [];
        this._registros = new Map();
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
        this._registros.clear();
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
                .registro-inline { flex: 1 1 100%; min-inline-size: 0; }
                summary.boton { inline-size: fit-content; }
                .registro-contenido { padding-block-start: 1rem; overflow-wrap: anywhere; }
                .titulo-registro { margin: 0 0 0.5rem; color: var(--color-primary, #1e3a8a); }
                .detalle-registro { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
            </style>
            <section class="historial">
                <ul id="lista-pasos" class="lista-pasos"></ul>
                <p id="historial-vacio" class="vacio" hidden>No hay pasos registrados.</p>
            </section>
        `;

        const lista = this.shadowRoot.querySelector("#lista-pasos");
        const vacio = this.shadowRoot.querySelector("#historial-vacio");
        const pasos = this._filtrarEjecutados(this._normalizarPasos(this._pasos));

        lista.replaceChildren();
        vacio.hidden = pasos.length > 0;
        this._renderizarPasos(lista, pasos);

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
            info.append(nombre);
            const esGrupo = paso.esGrupoHistorial === true;
            const metadatos = `Profesional: ${this._nombreProfesional(paso)} · Fecha y hora: ${this._fechaHoraPaso(paso)}`;
            if (!esGrupo) {
                const datos = document.createElement("p");
                datos.className = "paso-datos";
                datos.textContent = metadatos;
                info.append(datos);
            }
            contenido.append(info);
            if (!esGrupo) {
                const registro = document.createElement("details");
                registro.className = "registro-inline";
                const boton = document.createElement("summary");
                boton.className = "boton";
                boton.textContent = "Ver Registro";
                const panel = document.createElement("div");
                panel.className = "registro-contenido";
                const titulo = document.createElement("h5");
                titulo.className = "titulo-registro";
                titulo.textContent = this._nombrePaso(paso);
                const datos = document.createElement("p");
                datos.className = "datos-registro paso-datos";
                datos.textContent = metadatos;
                const detalle = document.createElement("div");
                detalle.className = "detalle-registro";
                detalle.textContent = this._detallePaso(paso);
                panel.append(titulo, datos, detalle);
                registro.append(boton, panel);
                let abierto = false;
                const actualizar = () => {
                    if (abierto === registro.open) return;
                    abierto = registro.open;
                    boton.textContent = abierto ? "Ocultar Registro" : "Ver Registro";
                    this.dispatchEvent(new CustomEvent(abierto ? "registro-abierto" : "registro-cerrado", {
                        bubbles: true, composed: true,
                        detail: { paso: this._pasosOriginales.get(paso) ?? paso }
                    }));
                };
                registro.addEventListener("toggle", actualizar);
                registro.addEventListener("click", evento => evento.stopPropagation());
                this._registros.set(registro, actualizar);
                contenido.append(registro);
                this._cantidadRegistros++;
            }
            item.append(contenido);
            const subpasos = this._obtenerSubpasos(paso);
            if (subpasos.length) {
                const lista = document.createElement("ul");
                this._renderizarPasos(lista, subpasos);
                item.append(lista);
            }
            contenedor.append(item);
        });
    }

    _cerrarRegistro() {
        for (const [registro, actualizar] of this._registros) {
            registro.open = false;
            actualizar();
        }
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
            return GestorFechas.formatearFechaISO(fechaHora) || "Sin fecha";
        }
        if (typeof fechaHora === "object") {
            return GestorFechas.formatearFechaHoraCalendario(
                fechaHora.fecha ?? fechaHora.fechaEjecucion,
                fechaHora.hora ?? fechaHora.horaEjecucion ?? hora
            ) || "Sin fecha";
        }
        return (paso?.fechaFin ? GestorFechas.formatearFechaISO(fechaHora)
            : GestorFechas.formatearFechaHoraCalendario(fechaHora, hora)) || "Sin fecha";
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
            "plan", "planTratamiento", "observaciones", "observacion",
            "cie10", "codigosCie10", "codigosCIE10", "diagnosticosCie10"
        ].some((clave) => Object.hasOwn(detalle, clave));
    }

    _formatearRegistroClinico(detalle) {
        const diagnosticos = [detalle.diagnostico, detalle.diagnosticos, detalle.cie10,
            detalle.codigosCie10, detalle.codigosCIE10, detalle.diagnosticosCie10]
            .find(valor => Array.isArray(valor) ? valor.length > 0
                : valor != null && String(valor).trim() !== "") ?? [];
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
