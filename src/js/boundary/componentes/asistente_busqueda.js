import "./buscador_tipo_doc.js";
import { personaService } from "../../control/persona_service.js";
import GeneradorMensajes from "../../control/generador_mensajes.js";

const DEBOUNCE_DOCUMENTO_MS = 500;

export class AsistenteBusqueda extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.tipoDocumento = "";
        this.itemTipoDocumento = null;
        this.documentoTocado = false;
        this.temporizadorDocumento = null;
        this.solicitudClinicas = 0;
        this.documentoConsultado = "";
    }

    connectedCallback() {
        this._renderEstructura();
        this._conectarEventos();
    }

    disconnectedCallback() {
        this._cancelarBusquedaClinicas();
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
                        disabled
                    >
                    <span id="numero-documento-ayuda" class="ayuda" aria-live="polite"></span>
                </div>

                <div class="campo">
                    <label for="clinica">Clínica</label>
                    <select
                        id="clinica"
                        name="idClinica"
                        class="form-control"
                        aria-label="Clínica"
                        aria-describedby="clinica-ayuda"
                        disabled
                    ></select>
                    <span id="clinica-ayuda" class="ayuda" aria-live="polite">
                        Seleccione un tipo y número de documento.
                    </span>
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
            this._invalidarBusquedaClinicas();
            this._sincronizarDocumento(Boolean(this.tipoDocumento));
            this._reiniciarClinicas(
                this.tipoDocumento
                    ? "Ingrese el número de documento para buscar sus clínicas."
                    : "Seleccione un tipo y número de documento."
            );
        });

        numeroDocumento.addEventListener("input", () => {
            this.documentoTocado = true;
            this._invalidarBusquedaClinicas();
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);

            if (this._validarDocumento(true)) {
                this._programarBusquedaClinicas();
                return;
            }

            this._reiniciarClinicas("Ingrese un número de documento válido.");
        });

        numeroDocumento.addEventListener("blur", () => {
            this.documentoTocado = true;
            this._cancelarBusquedaClinicas();
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);

            if (this._validarDocumento(true)) {
                this._cargarClinicasPaciente();
                return;
            }

            this._reiniciarClinicas("Ingrese un número de documento válido.");
        });

        form.addEventListener("submit", (evento) => {
            evento.preventDefault();
            this.documentoTocado = true;
            numeroDocumento.value = this._formatearDocumento(numeroDocumento.value);

            const documentoValido = this._validarDocumento(true);
            const fechasValidas = this._validarFechas();
            const selectClinica = this.shadowRoot.querySelector("#clinica");
            const clinicaValida = !selectClinica.disabled && selectClinica.value !== "";

            if (!clinicaValida) {
                this._mostrarAyudaClinica("Seleccione una clínica para continuar.");
            }

            if (!documentoValido || !fechasValidas || !clinicaValida) {
                return;
            }

            this.dispatchEvent(new CustomEvent("buscar-citas", {
                bubbles: true,
                composed: true,
                detail: {
                    tipoDocumento: this.tipoDocumento || buscador.value || "",
                    numeroDocumento: numeroDocumento.value.trim(),
                    idClinica: selectClinica.value,
                    fechaDesde: this.shadowRoot.querySelector("#fecha-desde").value,
                    fechaHasta: this.shadowRoot.querySelector("#fecha-hasta").value
                }
            }));
        });
    }

    _cancelarBusquedaClinicas() {
        if (this.temporizadorDocumento !== null) {
            clearTimeout(this.temporizadorDocumento);
            this.temporizadorDocumento = null;
        }
    }

    _invalidarBusquedaClinicas() {
        this._cancelarBusquedaClinicas();
        this.solicitudClinicas += 1;
        this.documentoConsultado = "";
    }

    _programarBusquedaClinicas() {
        this._cancelarBusquedaClinicas();
        this.temporizadorDocumento = setTimeout(() => {
            this.temporizadorDocumento = null;
            this._cargarClinicasPaciente();
        }, DEBOUNCE_DOCUMENTO_MS);
    }

    async _cargarClinicasPaciente() {
        const input = this.shadowRoot.querySelector("#numero-documento");
        const numeroDocumento = input.value.trim();

        if (this.tipoDocumento === "" || !this._patronDocumento().test(numeroDocumento)) {
            this._reiniciarClinicas("Ingrese un número de documento válido.");
            return;
        }

        const clave = `${this.tipoDocumento}|${numeroDocumento}`;

        if (this.documentoConsultado === clave) {
            return;
        }

        this.documentoConsultado = clave;
        const solicitud = ++this.solicitudClinicas;
        this._establecerEstadoClinicas(false, "Buscando clínicas del paciente...");

        try {
            const respuesta = await personaService.buscarClinicasPaciente(
                this.tipoDocumento,
                numeroDocumento
            );

            if (solicitud !== this.solicitudClinicas) {
                return;
            }

            const clinicas = this._normalizarClinicas(respuesta);

            if (clinicas.length === 0) {
                this._reiniciarClinicas(
                    "No se encontraron clínicas asociadas a este paciente."
                );
                return;
            }

            this._poblarClinicas(clinicas);
        } catch (error) {
            if (solicitud !== this.solicitudClinicas) {
                return;
            }

            this.documentoConsultado = "";
            this._reiniciarClinicas(
                "No se pudieron obtener las clínicas del paciente."
            );
            GeneradorMensajes.crearMensaje(
                "Error al buscar clínicas del paciente",
                error?.mensaje ?? error?.message ?? "",
                "error"
            );
        }
    }

    _poblarClinicas(clinicas) {
        const select = this.shadowRoot.querySelector("#clinica");

        select.replaceChildren();

        clinicas.forEach((clinica) => {
            const opcion = document.createElement("option");
            opcion.value = String(clinica.idClinica ?? clinica.id ?? clinica.codigo ?? "");
            opcion.textContent = clinica.nombre ?? clinica.name ?? "";
            select.appendChild(opcion);
        });

        this._establecerEstadoClinicas(
            true,
            clinicas.length === 1
                ? "1 clínica asociada al paciente."
                : `${clinicas.length} clínicas asociadas al paciente.`
        );
    }

    _normalizarClinicas(valor) {
        let lista = valor;

        if (!Array.isArray(lista)) {
            if (!lista || typeof lista !== "object") {
                return [];
            }

            lista = lista.clinicas
                ?? lista.items
                ?? lista.datos
                ?? lista.resultado
                ?? [];
        }

        if (!Array.isArray(lista)) {
            return [];
        }

        const clinicas = new Map();

        lista.forEach((item) => {
            const fuente = item?.clinica ?? item?.idClinica ?? item;
            const id = typeof fuente === "object"
                ? fuente?.idClinica ?? fuente?.id ?? fuente?.codigo
                : fuente;
            const nombre = typeof fuente === "object"
                ? fuente?.nombre ?? fuente?.name ?? fuente?.descripcion
                : item?.nombreClinica ?? item?.nombre;

            if (id === undefined || id === null || String(id).trim() === "") {
                return;
            }

            const clave = String(id);

            if (!clinicas.has(clave)) {
                clinicas.set(clave, {
                    idClinica: id,
                    nombre: nombre ?? item?.nombreClinica ?? item?.nombre ?? clave
                });
            }
        });

        return Array.from(clinicas.values());
    }

    _reiniciarClinicas(mensaje) {
        const select = this.shadowRoot.querySelector("#clinica");

        select.replaceChildren();
        select.disabled = true;
        this._mostrarAyudaClinica(mensaje);
    }

    _establecerEstadoClinicas(habilitado, mensaje) {
        const select = this.shadowRoot.querySelector("#clinica");

        select.disabled = !habilitado;
        this._mostrarAyudaClinica(mensaje);
    }

    _mostrarAyudaClinica(mensaje) {
        const ayuda = this.shadowRoot.querySelector("#clinica-ayuda");

        if (ayuda) {
            ayuda.textContent = mensaje;
        }
    }

    _sincronizarDocumento(tipoValido) {
        const input = this.shadowRoot.querySelector("#numero-documento");

        input.disabled = !tipoValido;

        if (tipoValido) {
            input.value = "";
            this.documentoTocado = false;
            this._validarDocumento(false);
            input.focus();
            return;
        }

        this._validarDocumento(false);
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
