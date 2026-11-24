import { expect } from '../lib/chai/index.js';
import { API_BASE } from '../../src/js/config.js';
import { AuthService, SESSION_STORAGE_KEY } from '../../src/js/control/auth_service.js';
import { consultaService } from '../../src/js/control/consulta_service.js';
import { procedimientoService, leerCatalogo } from '../../src/js/control/procedimiento_service.js';
import { indicePasoVigente } from '../../src/js/entity/flujo_consulta.js';
import store from '../../src/js/store.js';
import '../../src/js/boundary/vistas/dashboard_view.js';
import '../../src/js/boundary/vistas/atencion_consulta_view.js';

mocha.setup('bdd');

describe('Flujo por roles (integración con datos temporales)', function () {
    this.timeout(60000);

    it('inicia sesión, muestra la cita y entrega recepción → enfermería → doctor sin adelantar roles', async function () {
        const api = async (ruta, method = 'GET', body) => {
            const response = await fetch(`${API_BASE}${ruta}`, { method,
                ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
            expect(response.ok, `${method} ${ruta}: HTTP ${response.status}`).to.be.true;
            return response.status === 204 ? null : response.json();
        };
        const [roles, asignaciones, documentos, definiciones] = await Promise.all([
            '/roles', '/personas-roles', '/documentos', '/procedimientos-pasos'
        ].map(recurso => leerCatalogo(consultaService, recurso)));
        const normalizar = nombre => nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const recepcion = roles.find(r => r.activo && ['atencion al cliente', 'atencion al publico']
            .includes(normalizar(r.nombre)));
        const enfermeria = roles.find(r => r.activo && normalizar(r.nombre) === 'enfermera');
        const doctor = roles.find(r => r.activo && normalizar(r.nombre) === 'doctor');
        const paciente = roles.find(r => r.activo && normalizar(r.nombre) === 'paciente');
        if (!recepcion || !enfermeria || !doctor || !paciente) this.skip();
        const idsRoles = [recepcion.id, enfermeria.id, doctor.id];
        const candidato = definiciones.find(p => p.idRol === recepcion.id);
        if (!candidato) this.skip();
        const pasos = await procedimientoService.obtenerArbolPasos(candidato.idProcedimiento);
        if (pasos[0]?.idRol !== recepcion.id || !pasos.some(p => p.idRol === enfermeria.id)
            || !pasos.some(p => p.idRol === doctor.id)) this.skip();
        const empleado = asignaciones.find(a => a.idRol === recepcion.id
            && [...new Set(pasos.map(p => p.idRol)), paciente.id].every(idRol =>
                asignaciones.some(b => b.idClinica === a.idClinica && b.idRol === idRol)));
        if (!empleado) this.skip();
        const personal = new Map(idsRoles.map(idRol => [idRol, asignaciones.find(a =>
            a.idClinica === empleado.idClinica && a.idRol === idRol && documentos.some(d => d.idPersona === a.idPersona))]));
        if ([...personal.values()].some(a => !a)) this.skip();
        const pacienteAsignado = asignaciones.find(a => a.idRol === paciente.id && a.idClinica === empleado.idClinica);
        const anterior = { ...store.getState() };
        const rutaAnterior = location.hash;
        const almacenamiento = sessionStorage.getItem(SESSION_STORAGE_KEY);
        const marca = `QA-FLUJO-ROLES-${crypto.randomUUID()}`;
        const fixture = document.body.appendChild(document.createElement('div'));
        let consulta, procedimiento;
        const buscar = idRol => consultaService.buscarCitas({ idClinica: empleado.idClinica, idRol, q: marca });
        try {
            // Las suites de offline pueden dejar el store desconectado; aquí se usa la red real.
            store.setState({ online: navigator.onLine });
            consulta = await api('/consultas', 'POST', { idPersonaRol: pacienteAsignado.id,
                fechaInicio: new Date().toISOString(), referenciaExterna: marca });
            procedimiento = await api('/consultas-procedimientos', 'POST', {
                idConsulta: consulta.id, idProcedimiento: candidato.idProcedimiento });
            await api('/consultas-procedimientos-pasos', 'POST', { idConsultaProcedimiento: procedimiento.id,
                idProcedimientoPaso: pasos[0].id, idPersonaRol: empleado.id, estado: 'PENDIENTE', valor: '{}' });
            expect((await buscar(enfermeria.id)).items).to.have.length(0);
            expect((await buscar(doctor.id)).items).to.have.length(0);

            for (const [indice, paso] of pasos.entries()) {
                const asignacion = personal.get(paso.idRol);
                expect(asignacion, 'Cada paso debe pertenecer a uno de los tres roles verificados').to.exist;
                const documento = documentos.find(d => d.idPersona === asignacion.idPersona);
                const sesion = new AuthService();
                await sesion.login(documento.idTipoDocumento, documento.valor);
                const seleccion = store.getState().roles.find(a => a.id === asignacion.id);
                expect(seleccion, 'La asignación seleccionada debe proceder de la sesión real').to.exist;
                store.setContextoTrabajo(seleccion.clinica, seleccion);
                const dashboard = fixture.appendChild(document.createElement('dashboard-view'));
                dashboard.busqueda = marca;
                await dashboard._cargarCitas();
                const tarjetas = [...dashboard.shadowRoot.querySelectorAll('tarjeta-consulta')];
                expect(tarjetas).to.have.length(1);
                expect(tarjetas[0].consulta.idConsulta).to.equal(consulta.id);
                expect(tarjetas[0].querySelector('button').disabled).to.be.false;
                const actual = tarjetas[0].consulta;
                expect(actual.pasos[indicePasoVigente(actual.pasos)].idProcedimientoPaso).to.equal(paso.id);
                dashboard.remove();
                history.replaceState(null, '', '#atencion');
                store.setState({ consultaActiva: actual, consultaSeleccionada: actual, consulta: actual });
                const atencion = fixture.appendChild(document.createElement('atencion-consulta-view'));
                expect(atencion.shadowRoot.querySelector('#notas').readOnly).to.be.false;
                expect(atencion.shadowRoot.querySelector(paso.indicaFin ? '#btn-finalizar' : '#btn-siguiente').disabled).to.be.false;
                atencion.cargarDatosFormulario({ notasConsulta: `${marca}: paso temporal ${indice + 1}` });
                await (paso.indicaFin ? atencion._finalizarConsulta() : atencion._avanzarPaso());
                const guardada = await consultaService.findById(consulta.id);
                expect(guardada.pasos[indice].estado).to.equal('COMPLETADO');
                expect(guardada.pasos[indice].fechaFin).to.be.a('string');
                if (paso.indicaFin) {
                    expect(indicePasoVigente(guardada.pasos)).to.equal(-1);
                    expect(guardada.fechaFin).to.be.a('string');
                } else {
                    expect(indicePasoVigente(guardada.pasos)).to.equal(indice + 1);
                    if (pasos[indice + 1].idRol !== paso.idRol) {
                        expect(atencion.shadowRoot.querySelector('#notas').readOnly).to.be.true;
                        expect((await buscar(paso.idRol)).items).to.have.length(0);
                    }
                }
                atencion.remove();
            }
        } finally {
            fixture.remove();
            try {
                // Solo se eliminan los IDs creados por esta prueba, nunca consultas preexistentes.
                if (consulta) {
                    const detalle = await api(`/consultas/${consulta.id}`);
                    for (const paso of detalle.pasos) await api(`/consultas-procedimientos-pasos/${paso.id}`, 'DELETE');
                }
                if (procedimiento) await api(`/consultas-procedimientos/${procedimiento.id}`, 'DELETE');
                if (consulta) await api(`/consultas/${consulta.id}`, 'DELETE');
            } finally {
                store.setState(anterior);
                if (almacenamiento === null) sessionStorage.removeItem(SESSION_STORAGE_KEY);
                else sessionStorage.setItem(SESSION_STORAGE_KEY, almacenamiento);
                history.replaceState(null, '', location.pathname + location.search + rutaAnterior);
            }
        }
    });
});
