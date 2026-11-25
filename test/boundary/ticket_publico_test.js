import '../../src/js/boundary/vistas/ticket_view.js';
import '../../src/js/boundary/vistas/detalle_consulta_view.js';
import '../../src/js/boundary/componentes/instalador_app.js';
import { consultaService } from '../../src/js/control/consulta_service.js';
import { instalacionService } from '../../src/js/control/instalacion_service.js';
import { Router } from '../../src/js/router.js';
import { store } from '../../src/js/store.js';
import { expect } from '../lib/chai/index.js';

mocha.setup('tdd');
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));

suite('Ticket público: instalación, vista previa y detalle de solo lectura', () => {
    let contenedor, sesion, hash;
    const pdf = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const montar = (nombre, id = 'consulta-1') => {
        const vista = document.createElement(nombre);
        vista.dataset.routeId = id;
        if (nombre === 'opciones-ticket') vista.setAttribute('id-consulta', id);
        contenedor.append(vista);
        return vista;
    };
    setup(() => {
        contenedor = document.body.appendChild(document.createElement('main'));
        sesion = { ...store.state }; hash = location.hash;
        store.setState({ usuario: null, token: null, roles: [], clinicaActiva: null, rolSeleccionado: null, online: true });
        instalacionService.eventoPendiente = null;
        instalacionService.instalada = false;
        instalacionService.enCurso = false;
    });
    teardown(() => {
        contenedor.remove();
        sinon.restore();
        instalacionService.eventoPendiente = null;
        instalacionService.instalada = false;
        instalacionService.enCurso = false;
        store.setState(sesion);
        history.replaceState(null, '', location.pathname + location.search + hash);
    });

    test('las dos opciones son inline, responsivas y no contienen descargas ni overlays', () => {
        const host = montar('opciones-ticket');
        const root = host.shadowRoot;
        expect(root.querySelector('#instalar').textContent).to.equal('Descargar aplicación para poder ver el ticket');
        expect(root.querySelector('#ver-web').textContent).to.equal('ver ticket en la web');
        expect(root.querySelector('#ver-web').getAttribute('href')).to.equal('#ticket/consulta-1');
        expect(root.querySelector('[download], dialog, [popover], [aria-modal]')).to.be.null;
        expect(getComputedStyle(root.querySelector('.opciones')).flexWrap).to.equal('wrap');
        expect(getComputedStyle(host).position).to.equal('static');
    });

    test('si falta el prompt explica inline cómo instalar desde la barra', async () => {
        sinon.stub(instalacionService, 'solicitarInstalacion').resolves('no-disponible');
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#aviso').hidden).to.be.false;
        expect(root.querySelector('#aviso').textContent).to.include('barra del navegador');
        expect(root.querySelector('#ver-web').hasAttribute('href')).to.be.true;
    });

    test('comparte beforeinstallprompt con el instalador y consume el evento una sola vez', async () => {
        if (typeof navigator.install === 'function') sinon.stub(navigator, 'install').value(undefined);
        const evento = new Event('beforeinstallprompt', { cancelable: true });
        evento.prompt = sinon.stub().resolves();
        evento.userChoice = Promise.resolve({ outcome: 'accepted' });
        const instalador = montar('instalador-app');
        const opciones = montar('opciones-ticket');
        window.dispatchEvent(evento);
        expect(evento.defaultPrevented).to.be.true;
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.false;
        opciones.shadowRoot.querySelector('#instalar').click();
        expect(evento.prompt.calledOnce).to.be.true;
        await esperar();
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.true;
        opciones.shadowRoot.querySelector('#instalar').click(); await esperar();
        expect(evento.prompt.calledOnce).to.be.true;
    });

    test('usa Web Install API cuando está disponible y conserva la activación del clic', async () => {
        const original = Object.getOwnPropertyDescriptor(navigator, 'install');
        const instalar = sinon.stub().resolves();
        Object.defineProperty(navigator, 'install', { configurable: true, value: instalar });
        try {
            const root = montar('opciones-ticket').shadowRoot;
            root.querySelector('#instalar').click();
            expect(instalar.calledOnce).to.be.true;
            await esperar();
            expect(root.querySelector('#aviso').textContent).to.include('aceptada');
        } finally {
            if (original) Object.defineProperty(navigator, 'install', original);
            else delete navigator.install;
        }
    });

    test('confirma instalación existente y permite ver el ticket sin otro prompt', async () => {
        window.dispatchEvent(new Event('appinstalled'));
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#aviso').textContent).to.include('aplicación instalada');
        expect(root.querySelector('#ver-web').getAttribute('href')).to.equal('#ticket/consulta-1');
        expect(instalacionService.eventoPendiente).to.be.null;
    });

    test('muestra cancelación y fallo de instalación inline sin impedir la vista web', async () => {
        const solicitar = sinon.stub(instalacionService, 'solicitarInstalacion').resolves('cancelada');
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#aviso').textContent).to.include('no se completó');
        solicitar.rejects(new Error('No disponible'));
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#aviso').textContent).to.include('sigue disponible en la web');
    });

    test('la ruta web pública obtiene PDF y muestra object sin descargar; el botón explícito sí descarga', async () => {
        const obtener = sinon.stub(consultaService, 'obtenerTicketPdf').resolves(pdf);
        sinon.stub(URL, 'createObjectURL').returns('blob:ticket-prueba');
        const revocar = sinon.stub(URL, 'revokeObjectURL');
        const click = sinon.stub(HTMLAnchorElement.prototype, 'click');
        const router = new Router({ container: contenedor });
        expect(router.navigate('#ticket/consulta-1')).to.equal('ticket');
        await esperar();
        const host = contenedor.querySelector('ticket-view');
        const root = host.shadowRoot;
        expect(obtener.firstCall.args[0]).to.equal('consulta-1');
        expect(obtener.firstCall.args[1].signal).to.be.instanceOf(AbortSignal);
        expect(root.querySelector('object').type).to.equal('application/pdf');
        expect(root.querySelector('object').data).to.equal('blob:ticket-prueba');
        expect(root.querySelector('#abrir').target).to.equal('_blank');
        expect(root.querySelector('[download], dialog, [popover]')).to.be.null;
        expect(click.called).to.be.false;
        root.querySelector('#descargar').click();
        expect(click.calledOnce).to.be.true;
        expect(click.firstCall.thisValue.download).to.equal('ticket-cita-consulta-1.pdf');
        expect(revocar.called).to.be.false;
        host.remove();
        expect(revocar.calledOnceWithExactly('blob:ticket-prueba')).to.be.true;
        expect(obtener.firstCall.args[1].signal.aborted).to.be.true;
    });

    test('cerrar libera la URL una sola vez y quita la vista previa', async () => {
        sinon.stub(consultaService, 'obtenerTicketPdf').resolves(pdf);
        sinon.stub(URL, 'createObjectURL').returns('blob:cerrar');
        const revocar = sinon.stub(URL, 'revokeObjectURL');
        const host = montar('ticket-view'); await esperar();
        host.shadowRoot.querySelector('#cerrar').addEventListener('click', evento => evento.preventDefault());
        host.shadowRoot.querySelector('#cerrar').click();
        expect(host.shadowRoot.querySelector('object')).to.be.null;
        host.remove();
        expect(revocar.calledOnceWithExactly('blob:cerrar')).to.be.true;
    });

    test('cambiar consulta libera PDF anterior y descarta respuestas tardías', async () => {
        let resolver;
        const obtener = sinon.stub(consultaService, 'obtenerTicketPdf');
        obtener.onFirstCall().returns(new Promise(resolve => { resolver = resolve; }));
        obtener.onSecondCall().resolves(pdf);
        const crear = sinon.stub(URL, 'createObjectURL').returns('blob:actual');
        const revocar = sinon.stub(URL, 'revokeObjectURL');
        const host = montar('ticket-view');
        host.dataset.routeId = 'consulta-2'; await esperar();
        resolver(pdf); await esperar();
        expect(crear.calledOnce).to.be.true;
        expect(host.shadowRoot.querySelector('object').data).to.equal('blob:actual');
        host.remove();
        expect(revocar.calledOnce).to.be.true;
    });

    test('desmontar durante una petición evita crear URLs después', async () => {
        let resolver;
        sinon.stub(consultaService, 'obtenerTicketPdf').returns(new Promise(resolve => { resolver = resolve; }));
        const crear = sinon.spy(URL, 'createObjectURL');
        const host = montar('ticket-view'); host.remove();
        resolver(pdf); await esperar();
        expect(crear.called).to.be.false;
    });

    for (const nombre of ['ticket-view', 'detalle-consulta-view']) {
        for (const caso of ['404', 'offline']) {
            test(`${nombre}: error ${caso} amigable sin controles de escritura`, async () => {
                const metodo = nombre === 'ticket-view' ? 'obtenerTicketPdf' : 'findById';
                sinon.stub(consultaService, metodo).rejects(Object.assign(new Error('Fallo'), { status: caso === '404' ? 404 : null }));
                if (caso === 'offline') sinon.stub(navigator, 'onLine').get(() => false);
                const root = montar(nombre).shadowRoot; await esperar();
                expect(root.querySelector('#estado').textContent).to.include(caso === '404' ? 'No se encontró' : 'Sin conexión');
                expect(root.querySelector('#reintentar').hidden).to.be.false;
                expect(root.querySelector('form, input, textarea, dialog, [popover]')).to.be.null;
            });
        }
    }

    test('la ruta QR renderiza datos y todos los procedimientos históricos sin sesión ni edición', async () => {
        const paso = { nombre: 'Recepción', estado: 'COMPLETADO', orden: 1,
            responsable: { nombres: 'Ana', apellidos: 'Pérez', rol: { nombre: 'Enfermera' } },
            fecha: '2026-11-17T09:30:00', valor: JSON.stringify({ notas: 'Notas clínicas', diagnostico: 'Migraña', plan: 'Reposo' }),
            ordenesExamen: [{ examen: { nombre: 'Hemograma' }, indicaciones: 'En ayunas' }] };
        const consulta = { idConsulta: 'consulta-1', fecha: '2026-11-17T09:30:00', estado: 'Confirmada',
            paciente: { nombres: 'Luis', apellidos: 'López', numeroDocumento: '12345678-9', fechaNacimiento: '1990-01-02' },
            clinica: { nombre: 'Clínica Central', direccion: 'San Salvador' },
            procedimientos: [{ nombre: 'Consulta general', pasos: [paso] }, { nombre: 'Histórico', activo: false, pasos: [paso] }] };
        sinon.stub(consultaService, 'findById').resolves(consulta);
        const router = new Router({ container: contenedor });
        expect(router.navigate('#consulta/consulta-1')).to.equal('consulta');
        expect(store.hasActiveSession()).to.be.false;
        await esperar();
        const root = contenedor.querySelector('detalle-consulta-view').shadowRoot;
        expect(root.querySelector('#detalle').hidden).to.be.false;
        for (const contenido of ['Luis López', '12345678-9', 'Clínica Central', '17/11/2026', '02/01/1990', '09:30', 'Confirmada', 'Histórico']) {
            expect(root.textContent).to.include(contenido);
        }
        expect(root.querySelectorAll('historial-pasos')).to.have.length(2);
        const historial = root.querySelector('historial-pasos').shadowRoot;
        for (const contenido of ['Recepción', 'Ana Pérez', '17/11/2026', 'Notas clínicas', 'Migraña', 'Reposo', 'Hemograma']) expect(historial.textContent).to.include(contenido);
        expect(historial.textContent).not.to.match(/\d{4}-\d{2}-\d{2}/);
        expect(root.querySelector('form, input, textarea, dialog, [popover]')).to.be.null;
        expect(root.querySelector('opciones-ticket').getAttribute('id-consulta')).to.equal('consulta-1');
    });

    test('rechaza respuestas que no sean PDF sin generar vista previa', async () => {
        sinon.stub(window, 'fetch').resolves(new Response('Error HTML', { headers: { 'Content-Type': 'text/html' } }));
        const crear = sinon.spy(URL, 'createObjectURL');
        const root = montar('ticket-view').shadowRoot; await esperar();
        expect(root.querySelector('#estado').textContent).to.include('No se pudo cargar');
        expect(crear.called).to.be.false;
        expect(root.querySelector('#descargar').disabled).to.be.true;
    });
});
