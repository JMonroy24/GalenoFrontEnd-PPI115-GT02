import "./buscador_tipo_doc.js";
import { clinicaService } from "../../control/clinica_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

export class AsistenteBusqueda extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.tipoDocumento = "";
        this.itemTipoDocumento = null;
        this.documentoTocado = false;
    }

    async connectedCallback() {
        this._renderEstructura();
        this._conectarEventos();
        await this._cargarClinicas();
    }

    _renderEstructura() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                }
                form {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
                    gap: 1rem;
                    align-items: start;
                }
                .campo {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    min-width: 0;
                }
                label {
                    font-weight: 600;
                }
                .ayuda {
                    min-height: 1.1rem;
                    font-size: 0.8rem;
                    color: var(--color-texto-secundario, #475569);
                }
                .ayuda.mensaje-error {
                    color: #b91c1c;
                }
                .form-control.valido {
                    border-color: #166534;
                    outline-color: #166534;
                }
                .form-control.invalido {
                    border-color: #b91c1c;
                    outline-color: #b91c1c;
                }
                .acciones {
                    display: flex;
                    grid-column: 1 / -1;
                    justify-content: flex-end;
                }
            </style>
            <form novalidate>
                <buscador-tipo-documentos id="tipo-documento"></buscador-tipo-documentos>

                <div class="campo">
                    <label for="numero-documento">Número de documento</label>
                    <input
                        id="numero-documento"
                        name="numeroDocumento"
                        type="text"
                        class="form-control"
                        autocomplete="off"
                        placeholder="00000000-0"
                        aria-describedby="numero-documento-ayuda"
                    >
                    <span id="numero-documento-ayuda" class="ayuda" aria-live="polite"></span>
                </div>

                <div class="campo">
                    <label for="clinica">Clínica</label>
                    <select id="clinica" name="idClinica" class="form-control" aria-label="Clínica"></select>
                </div>

                <div class="campo">
                    <label for="fecha-desde">Desde</label>
                    <input id="fecha-desde" name="fechaDesde" type="date" class="form-control">
                </div>

                <div class="campo">
                    <label for="fecha-hasta">Hasta</label>
                    <input id="fecha-hasta" name="fechaHasta" type="date" class="form-control">
                </div>

                <div class="acciones">
                    <button type="submit" class="btn btn-primario">Buscar citas</button>
                </div>
            </form>
        `;
    }

    _conectarEventos() {
        const form = this.shadowRoot.querySelector("form");
        const buscador = this.shadowRoot.querySelector("buscador-tipo-documentos");
        const numeroDocumento = this.shadowRoot.querySelector("#numero-documento");

        buscador.addEventListener("tipo-documento-change", (evento) => {
            this.tipoDocumento = evento.detail?.value ?? "";
            this.itemTipoDocumento = evento.detail?.item ?? null;
            this._validarDocumento(true);
        });

        numeroDocumento.addEventListener("input", () => {
            this.documentoTocado = true;
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);
            this._validarDocumento(true);
        });

        numeroDocumento.addEventListener("blur", () => {
            this.documentoTocado = true;
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);
            this._validarDocumento(true);
        });

        form.addEventListener("submit", (evento) => {
            evento.preventDefault();
            this.documentoTocado = true;
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);

            const documentoValido = this._validarDocumento(true);
            const fechasValidas = this._validarFechas();

            if (!documentoValido || !fechasValidas) {
                return;
            }

            this.dispatchEvent(new CustomEvent("buscar-citas", {
                bubbles: true,
                composed: true,
                detail: {
                    tipoDocumento: this.tipoDocumento || buscador.value || "",
                    numeroDocumento: numeroDocumento.value.trim(),
                    idClinica: this.shadowRoot.querySelector("#clinica").value,
                    fechaDesde: this.shadowRoot.querySelector("#fecha-desde").value,
                    fechaHasta: this.shadowRoot.querySelector("#fecha-hasta").value
                }
            }));
        });
    }

    async _cargarClinicas() {
        try {
            const respuesta = await clinicaService.findRange();
            const clinicas = Array.isArray(respuesta?.items)
                ? respuesta.items
                : Array.isArray(respuesta?.datos)
                    ? respuesta.datos
                    : Array.isArray(respuesta)
                        ? respuesta
                        : [];

            const select = this.shadowRoot.querySelector("#clinica");
            if (!select) {
                return;
            }

            select.replaceChildren();

            clinicas.forEach((clinica) => {
                const opcion = document.createElement("option");
                opcion.value = String(clinica.idClinica ?? clinica.id ?? clinica.codigo ?? "");
                opcion.textContent = clinica.nombre ?? clinica.name ?? "";
                select.appendChild(opcion);
            });
        } catch (error) {
            GeneradorMensajes.crearMensaje(
                "Error al cargar clínicas",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _formatearDocumento(valor) {
        const clave = this._claveTipoDocumento();

        if (clave === "" || clave.includes("DUI")) {
            const digitos = valor.replace(/\D/g, "").slice(0, 9);
            return digitos.length > 8
                ? `${digitos.slice(0, 8)}-${digitos.slice(8)}`
                : digitos;
        }

        const maximo = clave.includes("PASAPORTE") ? 12 : 15;
        return valor
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, "")
            .slice(0, maximo);
    }

    _validarDocumento(mostrarError) {
        const input = this.shadowRoot.querySelector("#numero-documento");
        const ayuda = this.shadowRoot.querySelector("#numero-documento-ayuda");
        const valor = input.value.trim();
        const valido = this._patronDocumento().test(valor);

        input.classList.toggle("valido", valido);
        input.classList.toggle("invalido", mostrarError && !valido);
        input.setAttribute("aria-invalid", String(mostrarError && !valido));

        if (ayuda) {
            ayuda.textContent = valido
                ? "Formato válido"
                : mostrarError
                    ? this._mensajeDocumento()
                    : "";
            ayuda.classList.toggle("mensaje-error", mostrarError && !valido);
        }

        return valido;
    }

    _validarFechas() {
        const desde = this.shadowRoot.querySelector("#fecha-desde");
        const hasta = this.shadowRoot.querySelector("#fecha-hasta");
        const rangoInvalido = Boolean(desde.value && hasta.value && desde.value > hasta.value);

        desde.classList.toggle("invalido", rangoInvalido);
        hasta.classList.toggle("invalido", rangoInvalido);

        return !rangoInvalido;
    }

    _patronDocumento() {
        const clave = this._claveTipoDocumento();

        if (clave === "" || clave.includes("DUI")) {
            return /^\d{8}-\d$/;
        }

        if (clave.includes("PASAPORTE")) {
            return /^[A-Z0-9]{6,12}$/;
        }

        if (clave.includes("LICENCIA")) {
            return /^[A-Z0-9-]{6,15}$/;
        }

        return /^[A-Z0-9-]{5,20}$/;
    }

    _mensajeDocumento() {
        const clave = this._claveTipoDocumento();

        if (clave === "" || clave.includes("DUI")) {
            return "El DUI debe tener el formato 00000000-0.";
        }

        if (clave.includes("PASAPORTE")) {
            return "El pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.";
        }

        if (clave.includes("LICENCIA")) {
            return "La licencia debe tener entre 6 y 15 caracteres alfanuméricos.";
        }

        return "El número de documento no tiene un formato válido.";
    }

    _claveTipoDocumento() {
        const item = this.itemTipoDocumento;

        return String(
            item?.codigo
            ?? item?.code
            ?? item?.nombre
            ?? item?.name
            ?? this.tipoDocumento
            ?? ""
        ).toUpperCase();
    }
}

export default AsistenteBusqueda;

customElements.define("asistente-busqueda", AsistenteBusqueda);
