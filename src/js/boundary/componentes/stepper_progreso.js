/**
 * Constante con las etapas por defecto del flujo clínico / de atención.
 */
export const ETAPAS_POR_DEFECTO = Object.freeze([
    "Triaje",
    "Consulta Médica",
    "Tratamiento",
    "Cierre"
]);

/**
 * Escapa caracteres HTML especiales para evitar inyecciones al renderizar cadenas.
 * @param {unknown} texto - Texto a escapar.
 * @returns {string} Texto seguro para HTML.
 */
function escaparHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Parsea un valor (array, string JSON o string separado por comas) en un array de etapas.
 * @param {unknown} valor - Entrada a parsear.
 * @returns {string[]} Lista normalizada de nombres de etapas.
 */
function parsearEtapas(valor) {
    if (!valor) {
        return [...ETAPAS_POR_DEFECTO];
    }

    if (Array.isArray(valor)) {
        const resultado = valor
            .map((item) => (typeof item === "object" && item !== null && item.nombre ? String(item.nombre) : String(item).trim()))
            .filter((item) => item.length > 0);
        return resultado.length > 0 ? resultado : [...ETAPAS_POR_DEFECTO];
    }

    if (typeof valor === "string") {
        const textoLimpio = valor.trim();
        if (textoLimpio.startsWith("[") && textoLimpio.endsWith("]")) {
            try {
                const parseado = JSON.parse(textoLimpio);
                if (Array.isArray(parseado)) {
                    return parsearEtapas(parseado);
                }
            } catch (_) {
                // Si falla JSON.parse, se continúa con separación por comas
            }
        }

        const itemsSeparados = textoLimpio
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        return itemsSeparados.length > 0 ? itemsSeparados : [...ETAPAS_POR_DEFECTO];
    }

    return [...ETAPAS_POR_DEFECTO];
}

/**
 * Web Component nativo `<stepper-progreso>` con Shadow DOM.
 * Muestra el progreso de un proceso a través de un indicador horizontal accesible.
 */
export class StepperProgreso extends HTMLElement {
    static get observedAttributes() {
        return ["etapas", "paso-activo", "pasoactivo"];
    }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._etapas = [...ETAPAS_POR_DEFECTO];
        this._pasoActivo = 0;
        this._bloqueoAtributos = false;
    }

    /**
     * Lista de nombres de las etapas del stepper.
     * @returns {string[]}
     */
    get etapas() {
        return [...this._etapas];
    }

    /**
     * Establece las etapas (admite array, JSON o string separado por comas).
     * @param {string[]|string} valor
     */
    set etapas(valor) {
        this._etapas = parsearEtapas(valor);
        this.render();
    }

    /**
     * Identificador o índice de la etapa activa.
     * @returns {number|string}
     */
    get pasoActivo() {
        return this._pasoActivo;
    }

    /**
     * Establece la etapa activa (admite índice numérico o nombre de la etapa).
     * @param {number|string} valor
     */
    set pasoActivo(valor) {
        this._pasoActivo = valor;
        this.render();
    }

    /**
     * Responde a los cambios en los atributos observados en el DOM.
     * @param {string} name
     * @param {string|null} oldValue
     * @param {string|null} newValue
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue || this._bloqueoAtributos) {
            return;
        }

        if (name === "etapas") {
            this._etapas = parsearEtapas(newValue);
            this.render();
        } else if (name === "paso-activo" || name === "pasoactivo") {
            this._pasoActivo = newValue;
            this.render();
        }
    }

    connectedCallback() {
        if (this.hasAttribute("etapas")) {
            this._etapas = parsearEtapas(this.getAttribute("etapas"));
        }
        if (this.hasAttribute("paso-activo")) {
            this._pasoActivo = this.getAttribute("paso-activo");
        } else if (this.hasAttribute("pasoactivo")) {
            this._pasoActivo = this.getAttribute("pasoactivo");
        }
        this.render();
    }

    /**
     * Actualiza la fase activa dinámicamente.
     * @param {number|string} indice - Índice numérico o nombre de la etapa.
     */
    setPaso(indice) {
        this.pasoActivo = indice;
        this.dispatchEvent(new CustomEvent("cambio-paso", {
            bubbles: true,
            composed: true,
            detail: {
                paso: this._pasoActivo,
                indice: this.obtenerIndiceActivo(),
                etapa: this._etapas[this.obtenerIndiceActivo()] ?? null
            }
        }));
    }

    /**
     * Resuelve el índice numérico activo a partir de `this._pasoActivo`.
     * Soporta números directos, cadenas numéricas y coincidencias por nombre de etapa.
     * @returns {number} Índice de la etapa activa.
     */
    obtenerIndiceActivo() {
        if (this._pasoActivo === null || this._pasoActivo === undefined) {
            return 0;
        }

        if (typeof this._pasoActivo === "number") {
            return Math.floor(this._pasoActivo);
        }

        const valorStr = String(this._pasoActivo).trim();
        if (valorStr === "") {
            return 0;
        }

        // Búsqueda insensible a mayúsculas/minúsculas por nombre exacto de la etapa
        const valorLower = valorStr.toLowerCase();
        const indiceEncontrado = this._etapas.findIndex(
            (etapa) => String(etapa).trim().toLowerCase() === valorLower
        );
        if (indiceEncontrado !== -1) {
            return indiceEncontrado;
        }

        // Si es una representación numérica ("0", "1", "2", ...)
        const numero = Number(valorStr);
        if (!Number.isNaN(numero)) {
            return Math.floor(numero);
        }

        return 0;
    }

    /**
     * Determina el estado de un paso según el índice activo.
     * @param {number} indicePaso
     * @returns {"completado"|"activo"|"pendiente"}
     */
    obtenerEstadoPaso(indicePaso) {
        const indiceActivo = this.obtenerIndiceActivo();
        if (indicePaso < indiceActivo) {
            return "completado";
        }
        if (indicePaso === indiceActivo) {
            return "activo";
        }
        return "pendiente";
    }

    /**
     * Renderiza el componente en su Shadow Root.
     */
    render() {
        const etapas = this._etapas.length > 0 ? this._etapas : [...ETAPAS_POR_DEFECTO];
        const total = etapas.length;
        const indiceActivo = this.obtenerIndiceActivo();

        const pasosHtml = etapas.map((nombreEtapa, i) => {
            const estado = this.obtenerEstadoPaso(i);
            const esActivo = estado === "activo";
            const esCompletado = estado === "completado";
            const numeroPaso = i + 1;

            // Conector izquierdo (del límite izquierdo al círculo)
            const izqOculto = i === 0;
            const izqCompletado = !izqOculto && indiceActivo >= i;
            const clasesIzq = [
                "stepper-conector",
                "stepper-conector--izq",
                izqOculto ? "stepper-conector--oculto" : "",
                izqCompletado ? "stepper-conector--completado" : ""
            ].filter(Boolean).join(" ");

            // Conector derecho (del círculo al límite derecho)
            const derOculto = i === total - 1;
            const derCompletado = !derOculto && indiceActivo >= i + 1;
            const clasesDer = [
                "stepper-conector",
                "stepper-conector--der",
                derOculto ? "stepper-conector--oculto" : "",
                derCompletado ? "stepper-conector--completado" : ""
            ].filter(Boolean).join(" ");

            // Contenido visual del círculo indicador
            let contenidoCirculo = "";
            if (esCompletado) {
                contenidoCirculo = `
                    <svg class="stepper-icono" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                `;
            } else {
                contenidoCirculo = `<span class="stepper-cifra" aria-hidden="true">${numeroPaso}</span>`;
            }

            const etiquetaEstado = esCompletado
                ? "Completado"
                : esActivo
                    ? "Activo"
                    : "Pendiente";

            const ariaCurrentAttr = esActivo ? 'aria-current="step"' : "";

            return `
                <li class="stepper-paso stepper-paso--${estado}" role="listitem" ${ariaCurrentAttr} data-indice="${i}">
                    <div class="stepper-indicador-fila">
                        <span class="${clasesIzq}" aria-hidden="true"></span>
                        <span class="stepper-circulo" aria-hidden="true">
                            ${contenidoCirculo}
                        </span>
                        <span class="${clasesDer}" aria-hidden="true"></span>
                    </div>
                    <div class="stepper-cuerpo">
                        <span class="sr-only">Estado: ${etiquetaEstado}. Paso ${numeroPaso} de ${total}: </span>
                        <span class="stepper-numero" aria-hidden="true">Paso ${numeroPaso}</span>
                        <span class="stepper-etiqueta">${escaparHtml(nombreEtapa)}</span>
                        <span class="stepper-estado-badge stepper-estado-badge--${estado}" aria-hidden="true">${etiquetaEstado}</span>
                    </div>
                </li>
            `;
        }).join("");

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                    color: var(--color-text, #0f172a);
                    font-family: var(--font-body, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
                }

                *, *::before, *::after {
                    box-sizing: inherit;
                }

                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border-width: 0;
                }

                .stepper-nav {
                    width: 100%;
                    overflow-x: auto;
                    padding: var(--space-3, 0.75rem) 0;
                    -webkit-overflow-scrolling: touch;
                }

                .stepper-lista {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    width: 100%;
                    min-width: fit-content;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .stepper-paso {
                    flex: 1 1 0;
                    min-width: 6.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    position: relative;
                }

                .stepper-indicador-fila {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    margin-bottom: var(--space-2, 0.5rem);
                }

                .stepper-conector {
                    flex: 1 1 0;
                    height: 3px;
                    background-color: var(--color-surface-alt, #e2e8f0);
                    transition: background-color 0.25s ease;
                }

                .stepper-conector--completado {
                    background-color: var(--color-primary, #1e3a8a);
                }

                .stepper-conector--oculto {
                    visibility: hidden;
                }

                .stepper-circulo {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: var(--radius-full, 9999px);
                    font-size: var(--text-sm, 0.875rem);
                    font-weight: 600;
                    line-height: 1;
                    flex-shrink: 0;
                    transition: all 0.25s ease;
                    background-color: var(--color-surface, #ffffff);
                    border: 2px solid var(--color-surface-alt, #cbd5e1);
                    color: var(--color-text-muted, #64748b);
                    box-sizing: border-box;
                }

                .stepper-icono {
                    display: block;
                    width: 1.25rem;
                    height: 1.25rem;
                }

                .stepper-cifra {
                    line-height: 1;
                }

                .stepper-cuerpo {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--space-1, 0.25rem);
                    padding: 0 var(--space-2, 0.5rem);
                    width: 100%;
                }

                .stepper-numero {
                    font-size: var(--text-xs, 0.75rem);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                    color: var(--color-text-muted, #64748b);
                }

                .stepper-etiqueta {
                    font-size: var(--text-sm, 0.875rem);
                    line-height: 1.3;
                    font-weight: 500;
                    color: var(--color-text-muted, #64748b);
                    word-break: normal;
                    overflow-wrap: break-word;
                }

                .stepper-estado-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    line-height: 1.2;
                    font-weight: 600;
                    padding: 0.125rem 0.5rem;
                    border-radius: var(--radius-full, 9999px);
                    margin-top: 0.125rem;
                }

                /* --- ESTADO: PENDIENTE --- */
                .stepper-paso--pendiente .stepper-circulo {
                    background-color: var(--color-surface, #ffffff);
                    border-color: var(--color-surface-alt, #cbd5e1);
                    color: var(--color-text-muted, #64748b);
                }
                .stepper-paso--pendiente .stepper-numero {
                    color: var(--color-text-muted, #64748b);
                }
                .stepper-paso--pendiente .stepper-etiqueta {
                    color: var(--color-text-muted, #64748b);
                }
                .stepper-paso--pendiente .stepper-estado-badge {
                    background-color: var(--color-surface-alt, #f1f5f9);
                    color: var(--color-text-muted, #64748b);
                }

                /* --- ESTADO: ACTIVO (DESTACADO CON --color-primary) --- */
                .stepper-paso--activo .stepper-circulo {
                    background-color: var(--color-primary, #1e3a8a);
                    border-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                    box-shadow: 0 0 0 4px var(--color-primary-soft, #dbeafe);
                    transform: scale(1.06);
                }
                .stepper-paso--activo .stepper-numero {
                    color: var(--color-primary, #1e3a8a);
                    font-weight: 700;
                }
                .stepper-paso--activo .stepper-etiqueta {
                    color: var(--color-primary, #1e3a8a);
                    font-weight: 700;
                }
                .stepper-paso--activo .stepper-estado-badge {
                    background-color: var(--color-primary-soft, #dbeafe);
                    color: var(--color-primary, #1e3a8a);
                }

                /* --- ESTADO: COMPLETADO --- */
                .stepper-paso--completado .stepper-circulo {
                    background-color: var(--color-primary, #1e3a8a);
                    border-color: var(--color-primary, #1e3a8a);
                    color: #ffffff;
                }
                .stepper-paso--completado .stepper-numero {
                    color: var(--color-text-muted, #475569);
                }
                .stepper-paso--completado .stepper-etiqueta {
                    color: var(--color-text, #0f172a);
                    font-weight: 600;
                }
                .stepper-paso--completado .stepper-estado-badge {
                    background-color: var(--color-success-bg, #f0fdf4);
                    color: var(--color-success, #166534);
                }

                @media (max-width: 640px) {
                    .stepper-circulo {
                        width: 2.125rem;
                        height: 2.125rem;
                        font-size: var(--text-xs, 0.75rem);
                    }
                    .stepper-etiqueta {
                        font-size: var(--text-xs, 0.75rem);
                    }
                    .stepper-numero {
                        font-size: 0.65rem;
                    }
                    .stepper-estado-badge {
                        font-size: 0.65rem;
                        padding: 0.1rem 0.35rem;
                    }
                }
            </style>
            <nav class="stepper-nav" aria-label="Progreso del proceso">
                <ol class="stepper-lista" role="list">
                    ${pasosHtml}
                </ol>
            </nav>
        `;

        // Delegar o registrar escuchador de evento de selección en cada paso
        const items = this.shadowRoot.querySelectorAll(".stepper-paso");
        items.forEach((item) => {
            item.addEventListener("click", () => {
                const idx = Number(item.getAttribute("data-indice"));
                this.dispatchEvent(new CustomEvent("paso-click", {
                    bubbles: true,
                    composed: true,
                    detail: {
                        indice: idx,
                        etapa: etapas[idx],
                        estado: this.obtenerEstadoPaso(idx)
                    }
                }));
            });
        });
    }
}

if (!customElements.get("stepper-progreso")) {
    customElements.define("stepper-progreso", StepperProgreso);
}

export default StepperProgreso;
