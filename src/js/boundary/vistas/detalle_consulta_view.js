import { consultaService, obtenerPacienteConsulta, obtenerDocumentoConsulta, obtenerNombreClinicaConsulta } from '../../control/consulta_service.js';
import GestorFechas from '../../control/gestor_fechas.js';
import '../componentes/historial_pasos.js';
import '../componentes/opciones_ticket.js';

const texto = valor => Array.isArray(valor) ? valor.map(texto).filter(Boolean).join(' ')
    : typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';

export class DetalleConsultaView extends HTMLElement {
    static get observedAttributes() { return ['data-route-id', 'id-consulta']; }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._solicitud = 0;
    }

    get idConsulta() { return this.getAttribute('id-consulta') ?? this.dataset.routeId ?? ''; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host { display: block; min-inline-size: 0; }
                section { background: var(--color-surface, white); padding: 1rem; border: 1px solid var(--color-border, #64748b); border-radius: 0.75rem; }
                h1, h2, h3 { color: var(--color-primary, #1e3a8a); }
                h1 { margin-block-start: 0; }
                dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
                dt { font-weight: 600; } dd { margin: 0.25rem 0 0; overflow-wrap: anywhere; white-space: pre-wrap; }
                article { margin-block: 1rem; padding-block: 0.5rem; border-block-start: 1px solid var(--color-border, #64748b); }
                .acciones { display: flex; flex-wrap: wrap; gap: 1rem; margin-block-start: 1rem; }
                [hidden] { display: none !important; }
            </style>
            <section aria-labelledby="titulo-consulta">
                <h1 id="titulo-consulta">Detalle de la consulta</h1>
                <p>Información de solo lectura.</p>
                <p id="estado" role="status" aria-live="polite"></p>
                <div id="detalle" hidden>
                    <h2>Paciente y clínica</h2><dl id="datos"></dl>
                    <h2>Procedimientos y pasos realizados</h2><div id="procedimientos"></div>
                    <opciones-ticket></opciones-ticket>
                </div>
                <div class="acciones">
                    <a class="btn" href="#buscar-citas">Volver a buscar citas</a>
                    <button class="btn" id="reintentar" type="button" hidden>Reintentar</button>
                </div>
            </section>
        `;
        this.shadowRoot.querySelector('#reintentar').addEventListener('click', () => this.cargar());
        this.cargar();
    }

    disconnectedCallback() { this._solicitud++; }
    attributeChangedCallback() { if (this.isConnected) this.cargar(); }

    async cargar() {
        const solicitud = ++this._solicitud;
        const estado = this.shadowRoot.querySelector('#estado');
        const detalle = this.shadowRoot.querySelector('#detalle');
        const reintentar = this.shadowRoot.querySelector('#reintentar');
        detalle.hidden = true;
        reintentar.hidden = true;
        const id = this.idConsulta.trim();
        if (!id) { estado.textContent = 'Falta el identificador de la consulta.'; return; }
        estado.textContent = 'Cargando información de la consulta…';
        try {
            const consulta = await consultaService.findById(id);
            if (!this.isConnected || solicitud !== this._solicitud) return;
            if (!consulta || !(consulta.idConsulta ?? consulta.id)) throw Object.assign(new Error(), { status: 404 });
            this._mostrar(consulta);
            estado.textContent = 'Consulta disponible en modo de solo lectura.';
            detalle.hidden = false;
        } catch (error) {
            if (!this.isConnected || solicitud !== this._solicitud) return;
            estado.textContent = error?.status === 404 ? 'No se encontró una consulta con este identificador.'
                : !navigator.onLine ? 'Sin conexión. Conéctate a internet para consultar los datos actualizados de esta consulta.'
                    : 'No se pudo cargar la consulta. Comprueba tu conexión e inténtalo de nuevo.';
            reintentar.hidden = false;
        }
    }

    _mostrar(consulta) {
        const paciente = obtenerPacienteConsulta(consulta) ?? {};
        const clinica = consulta.clinica ?? consulta.idClinica ?? {};
        const nombre = typeof paciente === 'string' ? paciente : texto(paciente.nombreCompleto)
            || [texto(paciente.nombres ?? paciente.nombre), texto(paciente.apellidos ?? paciente.apellido)].filter(Boolean).join(' ');
        const fecha = consulta.fecha ?? consulta.fechaInicio ?? consulta.fechaConsulta ?? consulta.fechaCita;
        const hora = consulta.hora ?? consulta.horaInicio ?? String(fecha ?? '').match(/[T ](\d{2}:\d{2})/)?.[1];
        const estado = consulta.estado ?? consulta.estadoConsulta ?? consulta.estadoCita
            ?? (typeof consulta.activo === 'boolean' ? (consulta.activo ? 'Activa' : 'Inactiva') : null);
        const datos = [
            ['Paciente', nombre || 'Sin paciente'], ['Documento', obtenerDocumentoConsulta(consulta) || 'Sin documento'],
            ['Clínica', obtenerNombreClinicaConsulta(consulta)],
            ['Fecha', GestorFechas.formatearFechaCalendario(fecha) || 'Sin fecha'], ['Hora', texto(hora) || 'Sin hora'],
            ['Estado', texto(estado?.nombre ?? estado?.descripcion ?? estado) || 'Sin estado']
        ];
        if (paciente.fechaNacimiento) datos.push(['Fecha de nacimiento', GestorFechas.formatearFechaCalendario(paciente.fechaNacimiento)]);
        for (const [etiqueta, valor] of [
            ['Dirección del paciente', paciente.direccion], ['Teléfono del paciente', paciente.telefono],
            ['Correo del paciente', paciente.correo ?? paciente.email],
            ['Dirección de la clínica', clinica.direccion], ['Teléfono de la clínica', clinica.telefono]
        ]) if (texto(valor)) datos.push([etiqueta, texto(valor)]);
        const listaDatos = this.shadowRoot.querySelector('#datos');
        listaDatos.replaceChildren();
        for (const [etiqueta, valor] of datos) {
            const grupo = document.createElement('div');
            const dt = document.createElement('dt'); dt.textContent = etiqueta;
            const dd = document.createElement('dd'); dd.textContent = valor;
            grupo.append(dt, dd); listaDatos.append(grupo);
        }
        const contenedor = this.shadowRoot.querySelector('#procedimientos');
        contenedor.replaceChildren();
        const procedimientos = Array.isArray(consulta.procedimientos) ? consulta.procedimientos : [];
        for (const procedimiento of procedimientos) {
            const articulo = document.createElement('article');
            const titulo = document.createElement('h3');
            titulo.textContent = texto(procedimiento.procedimiento?.nombre ?? procedimiento.nombre ?? procedimiento.nombreProcedimiento ?? procedimiento) || 'Procedimiento clínico';
            const historial = document.createElement('historial-pasos');
            historial.pasos = procedimiento.historialPasos?.length ? procedimiento.historialPasos : procedimiento.pasos ?? [];
            articulo.append(titulo, historial); contenedor.append(articulo);
        }
        if (!procedimientos.length) {
            const historial = document.createElement('historial-pasos');
            historial.pasos = consulta.historialPasos?.length ? consulta.historialPasos : consulta.pasos ?? consulta.pasosClinicos ?? [];
            contenedor.append(historial);
        }
        this.shadowRoot.querySelector('opciones-ticket').setAttribute('id-consulta', this.idConsulta);
    }
}

customElements.define('detalle-consulta-view', DetalleConsultaView);
