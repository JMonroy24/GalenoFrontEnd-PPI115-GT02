export class HistorialPasos extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._pasos = [];
    }

    get pasos() {
        return this._pasos;
    }

    set pasos(valor) {
        this._pasos = valor ?? [];
        this.render();
    }

    connectedCallback() {
        this.render();
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
                    width: min(42rem, calc(100vw - 2rem));
                    max-height: calc(100vh - 2rem);
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
                        >Cerrar</button>
                    </header>
                    <div id="detalle-registro" class="detalle-registro"></div>
                </div>
            </dialog>
        `;

        const lista = this.shadowRoot.querySelector("#lista-pasos");
        const vacio = this.shadowRoot.querySelector("#historial-vacio");
        const pasos = this._normalizarPasos(this._pasos);

        lista.replaceChildren();
        vacio.hidden = pasos.length > 0;
        this._renderizarPasos(lista, pasos);

        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");
        const cerrar = this.shadowRoot.querySelector("#cerrar-registro");

        cerrar.addEventListener("click", () => this._cerrarRegistro());
        dialogo.addEventListener("click", (evento) => {
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

            const datos = document.createElement("p");
            datos.className = "paso-datos";

            const profesional = document.createElement("span");
            profesional.className = "paso-dato";
            profesional.textContent = `Profesional: ${this._nombreProfesional(paso)}`;

            const fechaHora = document.createElement("span");
            fechaHora.className = "paso-dato";
            fechaHora.textContent = `Fecha y hora: ${this._fechaHoraPaso(paso)}`;

            datos.append(profesional, fechaHora);
            info.append(nombre, datos);

            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "boton";
            boton.textContent = "Ver Registro";
            boton.addEventListener("click", () => this._abrirRegistro(paso));

            contenido.append(info, boton);
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

    _abrirRegistro(paso) {
        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");
        const titulo = this.shadowRoot.querySelector("#titulo-registro");
        const detalle = this.shadowRoot.querySelector("#detalle-registro");

        titulo.textContent = this._nombrePaso(paso);
        detalle.textContent = this._detallePaso(paso);

        if (typeof dialogo.showModal !== "function") {
            dialogo.setAttribute("open", "");
            return;
        }

        if (!dialogo.open) {
            dialogo.showModal();
        }
    }

    _cerrarRegistro() {
        const dialogo = this.shadowRoot.querySelector("#dialogo-registro");

        if (typeof dialogo.close === "function") {
            dialogo.close();
            return;
        }

        dialogo.removeAttribute("open");
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
            ?? paso?.usuario;

        return this._nombrePersona(profesional) || "Sin profesional";
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

        const personaInterna = persona.persona ?? persona.perfil;

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
        const fechaHora = paso?.fechaHoraEjecucion
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

        const texto = String(fechaHora);

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

        const detalle = paso.contenidoCompleto
            ?? paso.contenido
            ?? paso.detalle
            ?? paso.registro
            ?? paso.observaciones
            ?? paso.notas
            ?? paso.descripcion
            ?? paso.texto;

        return this._textoDetalle(detalle) || "Sin registro disponible.";
    }

    _textoDetalle(detalle) {
        if (detalle === null || detalle === undefined || detalle === "") {
            return "";
        }

        if (typeof detalle === "string") {
            return detalle;
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
}

export default HistorialPasos;

customElements.define("historial-pasos", HistorialPasos);
