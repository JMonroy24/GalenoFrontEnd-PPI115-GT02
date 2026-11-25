import { esRolEmpleado } from '../../src/js/entity/rol_empleado.js';
import { puedeOperarPaso, indicePasoVigente } from '../../src/js/entity/flujo_consulta.js';
import { consultaService, ConsultaService } from '../../src/js/control/consulta_service.js';
import { consultaProcedimientoService } from '../../src/js/control/consulta_procedimiento_service.js';
import { ProcedimientoService, procedimientoService } from '../../src/js/control/procedimiento_service.js';
import { ordenExamenService } from '../../src/js/control/orden_examen_service.js';
import '../../src/js/boundary/vistas/dashboard_view.js';
import '../../src/js/boundary/vistas/atencion_consulta_view.js';
import '../../src/js/boundary/componentes/historial_pasos.js';
import store from '../../src/js/store.js';
import { expect } from '../lib/chai/index.js';

mocha.setup('tdd');

suite('HU3/HU4: permisos y flujo real por rol', () => {
    let sandbox, anterior, ruta, fixture;
    const roles = ['Atención al público', 'Enfermera', 'Doctor'].map((nombre, i) => ({
        idPersonaRol: `asignacion-${i}`, idClinica: 'clinica',
        rol: { id: `rol-${i}`, nombre, activo: true }
    }));
    const paso = (i, estado = 'EN_CURSO') => ({
        idConsultaProcedimientoPaso: `ejecucion-${i}`, idProcedimientoPaso: `definicion-${i}`,
        idRol: `rol-${i}`, idPersonaRol: `asignacion-${i}`, rolResponsable: roles[i].rol,
        nombre: ['Recepción', 'Triaje', 'Atención médica'][i], indicaFin: i === 2, estado
    });
    const consulta = (pasos) => ({ idConsulta: 'consulta', clinica: { id: 'clinica', nombre: 'Central' },
        fechaInicio: '2026-11-24T09:00:00-06:00', fechaFin: '2026-11-24T10:00:00-06:00', pasos });
    const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
    const montar = (tag) => fixture.appendChild(document.createElement(tag));
    const seleccionar = (i, datos = consulta([paso(i)])) => store.setState({ roles,
        rolSeleccionado: roles[i], clinicaActiva: { id: 'clinica' }, consultaActiva: datos,
        consultaSeleccionada: datos, consulta: datos, token: 'prueba', online: true });

    setup(() => {
        sandbox = sinon.createSandbox(); anterior = store.getState(); ruta = location.hash;
        history.replaceState(null, '', '#buscar-citas');
        fixture = document.createElement('div'); document.body.append(fixture);
        sandbox.stub(ordenExamenService, 'listarExamenesPorPaso').resolves([]);
    });
    teardown(() => {
        fixture.remove(); sandbox.restore(); store.setState(anterior);
        history.replaceState(null, '', location.pathname + location.search + ruta);
    });

    for (let i = 0; i < roles.length; i++) {
        test(`Dashboard muestra únicamente consultas de ${roles[i].rol.nombre}`, async () => {
            seleccionar(i);
            const citas = roles.map((_, j) => ({ ...consulta([paso(j)]), idConsulta: `consulta-${j}` }));
            sandbox.stub(consultaService, 'buscarCitas').resolves({ items: citas, total: 3 });
            const host = montar('dashboard-view'); await esperar();
            const tarjetas = [...host.shadowRoot.querySelectorAll('tarjeta-consulta')];
            expect(tarjetas.map(t => t.consulta.idConsulta)).to.deep.equal([`consulta-${i}`]);
            expect(tarjetas[0].querySelector('button').disabled).to.be.false;
            host._atenderConsulta(citas[(i + 1) % 3]);
            expect(store.getState().consultaActiva.idConsulta).to.equal('consulta');
        });

        test(`${roles[i].rol.nombre} ve y opera un paso abierto aunque la cita tenga fechaFin`, async () => {
            const c = { ...consulta([paso(i)]), fechaInicio: '2026-11-24T09:00:00-06:00',
                fechaFin: '2026-11-24T10:00:00-06:00' };
            seleccionar(i, c);
            sandbox.stub(consultaService, 'buscarCitas').resolves({ items: [c], total: 1 });
            const dashboard = montar('dashboard-view'); await esperar();
            const tarjeta = dashboard.shadowRoot.querySelector('tarjeta-consulta');
            expect(tarjeta).not.to.be.null;
            expect(tarjeta.querySelector('button').disabled).to.be.false;
            const host = montar('atencion-consulta-view');
            expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.false;
            expect(puedeOperarPaso(c.pasos[0], { ...c, estado: 'FINALIZADA' }, store.getState())).to.be.false;
        });
    }

    for (const i of [0, 1]) {
        test(`busca la cola de ${roles[i].rol.nombre} en todas las páginas antes de filtrar y paginar`, async () => {
            const servicio = new ConsultaService();
            const datos = [
                { ...consulta([paso(2)]), idConsulta: 'otro-rol' },
                ...[0, 1].map(j => ({ ...consulta([paso(i)]), idConsulta: `propia-${j}` })),
                { ...consulta([paso(i, 'COMPLETADO')]), idConsulta: 'completada' },
                { ...consulta([paso(i)]), idConsulta: 'otra-clinica', clinica: { id: 'otra', nombre: 'Otra' } }
            ];
            sandbox.stub(servicio, '_solicitarCitas').callsFake(async (filtros, first, max) =>
                ({ items: datos.slice(first, first + max), total: datos.length, first, max }));
            const filtros = { idRol: `rol-${i}`, idClinica: 'clinica' };
            const primera = await servicio.buscarCitas(filtros, 0, 1);
            expect(primera.items.map(c => c.idConsulta)).to.deep.equal(['propia-0']);
            const resultado = await servicio.buscarCitas(filtros, 1, 1);
            expect(resultado.items.map(c => c.idConsulta)).to.deep.equal(['propia-1']);
            expect(resultado.total).to.equal(2);
            expect(resultado.first).to.equal(1);
            expect(resultado.max).to.equal(1);
            expect(servicio._solicitarCitas.firstCall.args[1]).to.equal(0);
        });
    }

    test('la cola por rol conserva el día inclusivo de El Salvador al recibir instantes UTC', async () => {
        const servicio = new ConsultaService();
        const datos = [
            { ...consulta([paso(1)]), idConsulta: 'inicio', fechaInicio: '2026-11-24T06:00:00Z[UTC]' },
            { ...consulta([paso(1)]), idConsulta: 'fin', fechaInicio: '2026-11-25T05:59:59Z[UTC]' },
            { ...consulta([paso(1)]), idConsulta: 'fuera', fechaInicio: '2026-11-25T06:00:00Z[UTC]' }
        ];
        sandbox.stub(servicio, '_solicitarCitas').resolves({ items: datos, total: datos.length });
        const resultado = await servicio.buscarCitas({ idRol: 'rol-1', idClinica: 'clinica',
            desde: '2026-11-24', hasta: '2026-11-24' });
        expect(resultado.items.map(c => c.idConsulta)).to.deep.equal(['inicio', 'fin']);
        expect(resultado.total).to.equal(2);
    });

    for (const valor of [null, {}, { nombre: 'Paciente', activo: true },
        { nombre: 'Panadero', activo: false }, { rol: { nombre: 'Doctor', activo: false } },
        { activo: false, rol: roles[2].rol }, { rol: roles[2].rol, clinica: { activo: false } }]) {
        test(`rechaza rol o asignación inválida ${JSON.stringify(valor)}`, () => expect(esRolEmpleado(valor)).to.be.false);
    }

    test('el permiso exige clínica y pertenencia al rol de sesión, sin restringir la cola por persona', () => {
        seleccionar(1); const estado = store.getState(); const c = consulta([paso(1)]);
        expect(puedeOperarPaso(c.pasos[0], c, estado)).to.be.true;
        expect(puedeOperarPaso(c.pasos[0], c, { ...estado, roles: [] })).to.be.false;
        expect(puedeOperarPaso(c.pasos[0], { ...c, clinica: { id: 'otra' } }, estado)).to.be.false;
        expect(puedeOperarPaso({ ...c.pasos[0], idPersonaRol: 'otro-empleado' }, c, estado)).to.be.true;
        expect(puedeOperarPaso(c.pasos[0], c, { ...estado,
            rolSeleccionado: { ...roles[1], idPersonaRol: 'asignacion-ajena' } })).to.be.false;
    });

    test('María en recepción ve y atiende la cola del rol aunque el paso esté asignado a otro empleado', async () => {
        const c = consulta([{ ...paso(0, 'PENDIENTE'), idPersonaRol: 'recepcionista-original' },
            paso(1, 'FUTURO'), paso(2, 'FUTURO')]);
        seleccionar(0, c);
        store.setState({ usuario: { nombres: 'María', apellidos: 'López' } });
        sandbox.stub(consultaService, 'buscarCitas').resolves({ items: [c], total: 1 });
        const dashboard = montar('dashboard-view'); await esperar();
        const tarjeta = dashboard.shadowRoot.querySelector('tarjeta-consulta');
        expect(tarjeta).not.to.be.null;
        expect(tarjeta.querySelector('button').disabled).to.be.false;
        const host = montar('atencion-consulta-view');
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.false;
        expect(host.shadowRoot.querySelector('#btn-anterior').disabled).to.be.true;
        host._seleccionarPaso(1);
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        host._seleccionarPaso(2);
        expect(host.shadowRoot.querySelector('#btn-finalizar').disabled).to.be.true;
    });

    test('Recepción completa su único paso y entrega la consulta a enfermería', async () => {
        const c = consulta([{ ...paso(0), idPersonaRol: 'recepcionista-original' }, paso(1, 'FUTURO'), paso(2, 'FUTURO')]);
        seleccionar(0, c);
        const actualizada = consulta([paso(0, 'COMPLETADO'), paso(1), paso(2, 'FUTURO')]);
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso').resolves({});
        sandbox.stub(consultaService, 'findById').resolves(actualizada);
        sandbox.stub(consultaService, 'buscarCitas').resolves({ items: [actualizada], total: 1 });
        const host = montar('atencion-consulta-view');
        host.cargarDatosFormulario({ notasConsulta: 'Recepción registrada' });
        await host._avanzarPaso();
        expect(guardar.calledOnce).to.be.true;
        expect(guardar.firstCall.args[0]).to.equal('ejecucion-0');
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        expect(host.shadowRoot.querySelector('#aviso-lectura').textContent).to.include('Enfermera');
        await host._avanzarPaso(); await host._finalizarConsulta();
        expect(guardar.calledOnce).to.be.true;
        const dashboard = montar('dashboard-view'); await esperar();
        expect(dashboard.shadowRoot.querySelectorAll('tarjeta-consulta')).to.have.length(0);
        store.setState({ rolSeleccionado: roles[1] }); await esperar();
        expect(dashboard.shadowRoot.querySelectorAll('tarjeta-consulta')).to.have.length(1);
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.false;
    });

    test('prioriza EN_CURSO sobre PENDIENTE y no considera operativos los completados', () => {
        expect(indicePasoVigente([paso(0, 'PENDIENTE'), paso(1)])).to.equal(1);
        expect(indicePasoVigente([paso(0, 'COMPLETADO')])).to.equal(-1);
    });

    test('la URL directa de otro rol bloquea formulario, botones y llamadas programáticas', async () => {
        seleccionar(1, consulta([paso(2)]));
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso');
        const host = montar('atencion-consulta-view');
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        expect(host.shadowRoot.querySelector('#btn-finalizar').disabled).to.be.true;
        expect(host.shadowRoot.querySelector('#aviso-lectura').textContent).to.include('Doctor');
        host.cargarDatosFormulario({ notasConsulta: 'Intento' });
        await host._guardarNotas(); await host._finalizarConsulta(); await host._retrocederPaso();
        expect(guardar.called).to.be.false;
    });

    test('Enfermera completa Triaje y el siguiente paso del Doctor queda bloqueado', async () => {
        const c = consulta([paso(1), paso(2, 'FUTURO')]); seleccionar(1, c);
        const actualizado = consulta([{ ...paso(1, 'COMPLETADO'), fechaFin: '2026-11-24T10:00:00-06:00' }, paso(2)]);
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso').resolves({});
        sandbox.stub(consultaService, 'findById').resolves(actualizado);
        const host = montar('atencion-consulta-view'); host.cargarDatosFormulario({ notasConsulta: 'Signos vitales' });
        await host._avanzarPaso();
        expect(guardar.calledOnce).to.be.true;
        expect(guardar.firstCall.args[0]).to.equal('ejecucion-1');
        expect(guardar.firstCall.args[1].estadoPaso).to.equal('COMPLETADO');
        expect(host._pasoActivo).to.equal(1);
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        expect(host.shadowRoot.querySelector('#btn-finalizar').disabled).to.be.true;
        expect(host.shadowRoot.querySelector('#aviso-lectura').textContent).to.include('siguiente paso corresponde al rol Doctor');
        expect(host.shadowRoot.querySelector('#btn-dashboard')).not.to.be.null;
        await host._finalizarConsulta(); expect(guardar.calledOnce).to.be.true;
        store.setState({ rolSeleccionado: roles[2] });
        expect(host.shadowRoot.querySelector('#btn-finalizar').disabled).to.be.false;
    });

    test('navegar al historial y a pasos futuros permite leer pero nunca editar', async () => {
        seleccionar(1, consulta([{ ...paso(0, 'COMPLETADO'), valor: '{"notas":"Recepción registrada"}',
            fechaFin: '2026-11-24T09:00:00-06:00' }, paso(1), paso(2, 'FUTURO')]));
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso');
        const host = montar('atencion-consulta-view');
        host._seleccionarPaso(0);
        expect(host.obtenerDatosFormulario().notasConsulta).to.equal('Recepción registrada');
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        host._seleccionarPaso(2); host.cargarDatosFormulario({ notasConsulta: 'No guardar' });
        await host._avanzarPaso(); await host._finalizarConsulta();
        expect(guardar.called).to.be.false;
        host._seleccionarPaso(1); expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.false;
    });

    test('Anterior usa una sola transición RETROCEDER y bloquea el relevo al rol anterior', async () => {
        seleccionar(1, consulta([paso(0, 'COMPLETADO'), paso(1), paso(2, 'FUTURO')]));
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso').resolves({});
        sandbox.stub(consultaService, 'findById').resolves(consulta([paso(0), paso(1, 'PENDIENTE'), paso(2, 'FUTURO')]));
        const host = montar('atencion-consulta-view'); await host._retrocederPaso();
        expect(guardar.calledOnce).to.be.true;
        expect(guardar.firstCall.args[1]).to.include({ accion: 'RETROCEDER', estadoPaso: 'PENDIENTE' });
        expect(host.shadowRoot.querySelector('#notas').readOnly).to.be.true;
        expect(host.shadowRoot.querySelector('#btn-anterior').disabled).to.be.true;
    });

    test('Finalizar depende de indicaFin, no de estar al final de un arreglo', () => {
        seleccionar(1, consulta([{ ...paso(1), indicaFin: false }]));
        const host = montar('atencion-consulta-view');
        expect(host.shadowRoot.querySelector('#btn-finalizar')).to.be.null;
        expect(host.shadowRoot.querySelector('#btn-siguiente').disabled).to.be.false;
        seleccionar(1, consulta([{ ...paso(1), indicaFin: true }, paso(2, 'FUTURO')]));
        expect(host.shadowRoot.querySelector('#btn-finalizar').disabled).to.be.false;
    });

    test('sin flujo real la vista permanece bloqueada y no fabrica cuatro pasos', () => {
        seleccionar(1, consulta([])); const host = montar('atencion-consulta-view');
        expect(host.shadowRoot.querySelector('stepper-progreso').etapas).to.deep.equal([]);
        expect(host.shadowRoot.querySelector('#btn-siguiente').disabled).to.be.true;
    });

    test('Guardar Notas actualiza el paso y su indicador sin activar el siguiente', async () => {
        seleccionar(1, consulta([paso(1, 'PENDIENTE'), paso(2, 'FUTURO')]));
        const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso').resolves({});
        const recargar = sandbox.stub(consultaService, 'findById');
        const host = montar('atencion-consulta-view');
        host.cargarDatosFormulario({ notasConsulta: 'Signos vitales' }); await host._guardarNotas();
        expect(guardar.calledOnce).to.be.true;
        expect(guardar.firstCall.args[1].estadoPaso).to.equal('EN_CURSO');
        expect(recargar.called).to.be.false;
        expect(host._pasoActivo).to.equal(0);
        expect(host.shadowRoot.querySelector('stepper-progreso').estados[0]).to.equal('EN_CURSO');
        expect(host._pasosFlujo[1].estado).to.equal('FUTURO');
    });

    test('exámenes usan el ID definido para consultar y el ID ejecutado para crear órdenes', async () => {
        ordenExamenService.listarExamenesPorPaso.resolves([{ idExamen: 'examen', nombre: 'Pulso' }]);
        const crear = sandbox.stub(ordenExamenService, 'crearOrdenes').resolves([{ id: 'orden' }]);
        seleccionar(1); const host = montar('atencion-consulta-view'); await esperar();
        const lista = host.shadowRoot.querySelector('#lista-examenes');
        expect(ordenExamenService.listarExamenesPorPaso.lastCall.args[0]).to.equal('definicion-1');
        const input = lista.shadowRoot.querySelector('input'); input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true })); await lista.asignarSeleccionados();
        expect(crear.firstCall.args[0]).to.equal('ejecucion-1');
        store.setState({ rolSeleccionado: roles[2] });
        expect(lista.soloLectura).to.be.true;
        await lista.asignarSeleccionados(); expect(crear.calledOnce).to.be.true;
    });

    test('si falla la recarga después de guardar impide repetir una escritura sobre el paso anterior', async () => {
        seleccionar(1); const guardar = sandbox.stub(consultaProcedimientoService, 'guardarPaso').resolves({});
        sandbox.stub(consultaService, 'findById').rejects(new Error('Red caída'));
        const host = montar('atencion-consulta-view'); host.cargarDatosFormulario({ notasConsulta: 'Guardado' });
        await host._avanzarPaso(); await host._avanzarPaso();
        expect(guardar.calledOnce).to.be.true;
        expect(host.shadowRoot.querySelector('#btn-siguiente').disabled).to.be.true;
    });

    test('historial muestra responsable, rol, fechaFin y registro inline', () => {
        const host = montar('historial-pasos');
        host.pasos = [{ ...paso(1, 'COMPLETADO'), responsable: { persona: { nombres: 'Ana', apellidos: 'López' } },
            fechaFin: '2026-11-24T10:30:00-06:00', valor: '{"notas":"Registro seguro <script>"}' }];
        expect(host.shadowRoot.textContent).to.include('Ana López');
        expect(host.shadowRoot.textContent).to.include('Enfermera');
        expect(host.shadowRoot.textContent).to.include('24/11/2026');
        host.shadowRoot.querySelector('.boton').click();
        const registro = host.shadowRoot.querySelector('details.registro-inline');
        expect(registro.open).to.be.true; expect(registro.querySelector('textarea, input, script')).to.be.null;
        expect(registro.textContent).to.include('Registro seguro <script>');
        expect(host.shadowRoot.querySelector('dialog, [popover]')).to.be.null;
    });

    test('GET consultas solo envía los nombres oficiales del OpenAPI', async () => {
        const servicio = new ConsultaService();
        const solicitar = sandbox.stub(servicio, '_request').resolves({ json: async () => ({ items: [], total: 0 }) });
        await servicio.buscarCitas({ clinicaId: 'clinica', idRol: 'rol-1', fechaDesde: '2026-11-01',
            fechaHasta: '2026-11-30', periodo: 'hoy', tipoDocumento: 'DUI', numeroDocumento: '123', q: 'Ana' });
        const params = new URL(solicitar.firstCall.args[0]).searchParams;
        expect(Object.fromEntries(params)).to.deep.equal({ first: '0', max: '10', idClinica: 'clinica',
            idRol: 'rol-1', desde: '2026-11-01', hasta: '2026-11-30', q: 'Ana' });
    });

    test('ordena el flujo mediante SIGUIENTE y conserva marca final y responsables', async () => {
        const servicio = new ProcedimientoService();
        sandbox.stub(servicio, '_request').callsFake(async url => ({ json: async () => ({ items:
            url.includes('secuencias') ? [
                { tipoSecuencia: 'SIGUIENTE', idProcedimientoPaso: 'a', idProcedimientoPasoReferencia: 'b' },
                { tipoSecuencia: 'SIGUIENTE', idProcedimientoPaso: 'b', idProcedimientoPasoReferencia: 'c' }
            ] : [
                { id: 'c', idProcedimiento: 'p', idRol: 'rol-2', nombre: 'Final', indicaFin: true },
                { id: 'b', idProcedimiento: 'p', idRol: 'rol-1', nombre: 'Medio' },
                { id: 'a', idProcedimiento: 'p', idRol: 'rol-0', nombre: 'Inicio' }
            ] }) }));
        const pasos = await servicio.obtenerArbolPasos('p');
        expect(pasos.map(p => p.id)).to.deep.equal(['a', 'b', 'c']);
        expect(pasos.at(-1).indicaFin).to.be.true;
    });

    test('une definiciones, ejecuciones, responsable e historial sin confundir identificadores', async () => {
        const servicio = new ConsultaService();
        sandbox.stub(procedimientoService, 'obtenerArbolPasos').resolves([
            { id: 'definicion-1', idRol: 'rol-1', nombre: 'Triaje', orden: 0, indicaFin: false },
            { id: 'definicion-2', idRol: 'rol-2', nombre: 'Atención médica', orden: 1, indicaFin: true }
        ]);
        const recursos = {
            '/consultas-procedimientos-pasos': { items: [
                { id: 'ejecucion-1', idConsultaProcedimiento: 'cp', idProcedimientoPaso: 'definicion-1',
                    idPersonaRol: 'asignacion-1', estado: 'COMPLETADO', fechaFin: '2026-11-24T09:00:00-06:00', valor: '{"notas":"Triaje realizado"}' },
                { id: 'ejecucion-2', idConsultaProcedimiento: 'cp', idProcedimientoPaso: 'definicion-2',
                    idPersonaRol: 'asignacion-2', estado: 'EN_CURSO' }
            ], total: 2 },
            '/ordenes-examen': { items: [{ id: 'orden', idConsultaProcedimientoPaso: 'ejecucion-1', idExamen: 'examen' }], total: 1 },
            '/personas-roles/asignacion-1': { id: 'asignacion-1', idPersona: 'persona-1', idRol: 'rol-1' },
            '/personas-roles/asignacion-2': { id: 'asignacion-2', idPersona: 'persona-2', idRol: 'rol-2' },
            '/personas/persona-1': { id: 'persona-1', nombres: 'Ana', apellidos: 'López' },
            '/personas/persona-2': { id: 'persona-2', nombres: 'José', apellidos: 'Pérez' },
            '/roles/rol-1': roles[1].rol, '/roles/rol-2': roles[2].rol,
            '/examenes/examen': { id: 'examen', nombre: 'Pulso', activo: true }
        };
        sandbox.stub(servicio, '_request').callsFake(async url => {
            const ruta = new URL(url).pathname.replace('/galenoSV/api/v1', '');
            expect(recursos, ruta).to.have.property(ruta);
            return { json: async () => recursos[ruta] };
        });
        const c = await servicio.cargarFlujoConsulta({ ...consulta([{ id: 'ejecucion-1',
            nombre: 'Triaje', idProcedimientoPaso: 'definicion-1', estado: 'COMPLETADO' }]), procedimientos: [{
            id: 'cp', idProcedimiento: 'procedimiento', procedimiento: { nombre: 'Control' }
        }] });
        expect(c.pasos.map(p => [p.idConsultaProcedimientoPaso, p.idProcedimientoPaso]))
            .to.deep.equal([['ejecucion-1', 'definicion-1'], ['ejecucion-2', 'definicion-2']]);
        expect(indicePasoVigente(c.pasos)).to.equal(1);
        expect(c.historialPasos[0].pasos).to.have.length(1);
        const registro = c.historialPasos[0].pasos[0];
        expect(registro.nombre).to.equal('Triaje');
        expect(registro.responsable.persona.nombres).to.equal('Ana');
        expect(registro.fechaFin).to.equal('2026-11-24T09:00:00-06:00');
        expect(registro.ordenesExamen[0].examen.nombre).to.equal('Pulso');
    });
});
