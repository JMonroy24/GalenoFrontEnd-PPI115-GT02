import '../../src/js/boundary/componentes/tarjeta_consulta.js';
import '../../src/js/boundary/vistas/detalle_consulta_view.js';
import '../../src/js/boundary/componentes/instalador_app.js';
import { consultaService } from '../../src/js/control/consulta_service.js';
import { instalacionService } from '../../src/js/control/instalacion_service.js';
import { Router } from '../../src/js/router.js';
import { store, Store, APP_INSTALADA_KEY } from '../../src/js/store.js';
import { expect } from '../lib/chai/index.js';

mocha.setup('tdd');
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));

suite('Ticket público: pestaña externa e instalación reactiva', () => {
    let contenedor, sesion, hash, bandera, standaloneAnterior;
    const montar = (nombre, id = 'consulta-1') => {
        const vista = document.createElement(nombre);
        vista.dataset.routeId = id;
        if (nombre === 'opciones-ticket') vista.setAttribute('id-consulta', id);
        if (nombre === 'tarjeta-consulta') vista.consulta = { idConsulta: id, fecha: '2026-11-17', pasos: [] };
        contenedor.append(vista);
        return vista;
    };
    const prompt = (outcome = 'dismissed') => {
        const evento = new Event('beforeinstallprompt', { cancelable: true });
        evento.prompt = sinon.stub().resolves();
        evento.userChoice = Promise.resolve({ outcome });
        window.dispatchEvent(evento);
        return evento;
    };
    const soloVerTicket = root => {
        expect(root.querySelector('#instalar').hidden).to.be.true;
        expect(root.querySelector('#ver-web').hidden).to.be.true;
        expect(root.querySelector('#ver-ticket').hidden).to.be.false;
        expect(root.querySelector('#ver-ticket').textContent).to.equal('Ver ticket');
        expect([...root.querySelectorAll('button, a')].filter(n => !n.hidden)).to.have.length(1);
    };
    setup(() => {
        contenedor = document.body.appendChild(document.createElement('main'));
        sesion = { ...store.state }; hash = location.hash;
        bandera = localStorage.getItem(APP_INSTALADA_KEY);
        standaloneAnterior = Object.getOwnPropertyDescriptor(navigator, 'standalone');
        store.setState({ usuario: null, token: null, roles: [], clinicaActiva: null, rolSeleccionado: null, online: true, appInstalada: false });
        instalacionService.eventoPendiente = null;
        instalacionService.enCurso = false;
    });
    teardown(() => {
        contenedor.remove();
        sinon.restore();
        if (standaloneAnterior) Object.defineProperty(navigator, 'standalone', standaloneAnterior);
        else delete navigator.standalone;
        instalacionService.eventoPendiente = null;
        instalacionService.enCurso = false;
        store.setState(sesion);
        if (bandera === null) localStorage.removeItem(APP_INSTALADA_KEY);
        else localStorage.setItem(APP_INSTALADA_KEY, bandera);
        history.replaceState(null, '', location.pathname + location.search + hash);
    });

    test('la tarjeta ofrece exactamente las dos opciones de promoción inline antes de instalar', () => {
        const root = montar('tarjeta-consulta').shadowRoot.querySelector('opciones-ticket').shadowRoot;
        expect(root.querySelector('#instalar').textContent).to.equal('Descargar aplicación para poder ver el ticket');
        expect(root.querySelector('#instalar').hidden).to.be.false;
        expect(root.querySelector('#ver-web').textContent).to.equal('ver ticket en la web');
        expect(root.querySelector('#ver-web').hidden).to.be.false;
        expect(root.querySelector('#ver-ticket').hidden).to.be.true;
        expect(root.querySelector('#ver-web').href).to.equal(consultaService.obtenerUrlTicket('consulta-1'));
        expect(root.querySelector('#ver-web').target).to.equal('_blank');
        expect(root.querySelector('#ver-web').rel).to.equal('noopener');
        expect(root.querySelector('object, iframe, [download], dialog, [popover], [aria-modal]')).to.be.null;
        expect(getComputedStyle(root.querySelector('.opciones')).flexWrap).to.equal('wrap');
    });

    test('ver ticket en la web abre la URL PDF sin esperar, sin fetch, Blob ni descarga', () => {
        const abrir = sinon.stub(window, 'open').returns(null);
        const red = sinon.spy(window, 'fetch');
        const crear = sinon.spy(URL, 'createObjectURL');
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#ver-web').click();
        expect(abrir.calledOnceWithExactly(consultaService.obtenerUrlTicket('consulta-1'), '_blank', 'noopener')).to.be.true;
        expect(red.called).to.be.false;
        expect(crear.called).to.be.false;
        expect(location.hash).to.equal(hash);
        expect(root.querySelector('object, iframe, [download]')).to.be.null;
    });

    test('appinstalled transforma todas las tarjetas y oculta el instalador sin recargar', () => {
        prompt();
        const instalador = montar('instalador-app');
        const tarjetas = [montar('tarjeta-consulta', 'uno'), montar('tarjeta-consulta', 'dos')];
        const opciones = tarjetas.map(t => t.shadowRoot.querySelector('opciones-ticket').shadowRoot);
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.false;
        window.dispatchEvent(new Event('appinstalled'));
        expect(store.state.appInstalada).to.be.true;
        expect(localStorage.getItem(APP_INSTALADA_KEY)).to.equal('1');
        opciones.forEach(soloVerTicket);
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.true;
        const abrir = sinon.stub(window, 'open');
        opciones[1].querySelector('#ver-ticket').click();
        expect(abrir.calledOnceWithExactly(consultaService.obtenerUrlTicket('dos'), '_blank', 'noopener')).to.be.true;
    });

    test('cambiar appInstalada en Store actualiza todos los componentes visibles', () => {
        const uno = montar('opciones-ticket').shadowRoot;
        const dos = montar('opciones-ticket', 'dos').shadowRoot;
        uno.querySelector('#instalar').focus();
        store.setState({ appInstalada: true });
        soloVerTicket(uno); soloVerTicket(dos);
        expect(uno.activeElement).to.equal(uno.querySelector('#ver-ticket'));
        store.setState({ appInstalada: false });
        for (const root of [uno, dos]) {
            expect(root.querySelector('#instalar').hidden).to.be.false;
            expect(root.querySelector('#ver-web').hidden).to.be.false;
            expect(root.querySelector('#ver-ticket').hidden).to.be.true;
        }
    });

    for (const modo of ['standalone', 'window-controls-overlay', 'ios']) {
        test(`detecta modo instalado ${modo} y muestra únicamente Ver ticket`, () => {
            if (modo === 'ios') Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
            else sinon.stub(window, 'matchMedia').callsFake(query => ({ matches: query === `(display-mode: ${modo})` }));
            instalacionService.sincronizarEstado();
            expect(store.state.appInstalada).to.be.true;
            soloVerTicket(montar('opciones-ticket').shadowRoot);
        });
    }

    test('aceptar userChoice consume un único prompt y persiste instalada incluso sin appinstalled', async () => {
        const evento = prompt('accepted');
        const root = montar('opciones-ticket').shadowRoot;
        const segunda = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click();
        segunda.querySelector('#instalar').click();
        expect(evento.defaultPrevented).to.be.true;
        expect(evento.prompt.calledOnce).to.be.true;
        expect(instalacionService.eventoPendiente).to.be.null;
        await esperar();
        expect(instalacionService.enCurso).to.be.false;
        expect(store.state.appInstalada).to.be.true;
        expect(localStorage.getItem(APP_INSTALADA_KEY)).to.equal('1');
        soloVerTicket(root); soloVerTicket(segunda);
        expect(new Store().state.appInstalada).to.be.true;
    });

    test('el instalador de la cabecera usa el mismo prompt y reactiva todas las tarjetas', async () => {
        const evento = prompt('accepted');
        const instalador = montar('instalador-app');
        const root = montar('opciones-ticket').shadowRoot;
        instalador.shadowRoot.querySelector('button').click();
        expect(evento.prompt.calledOnce).to.be.true;
        await esperar();
        soloVerTicket(root);
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.true;
    });

    test('cancelar restaura los botones y permite volver a solicitar instalación sin bloqueo', async () => {
        let resolver;
        const evento = prompt();
        evento.userChoice = new Promise(resolve => { resolver = resolve; });
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click();
        expect(root.querySelector('#instalar').disabled).to.be.true;
        expect(root.querySelector('#instalar').getAttribute('aria-busy')).to.equal('true');
        resolver({ outcome: 'dismissed' }); await esperar();
        expect(store.state.appInstalada).to.be.false;
        expect(instalacionService.enCurso).to.be.false;
        expect(root.querySelector('#instalar').disabled).to.be.false;
        expect(root.querySelector('#instalar').getAttribute('aria-busy')).to.equal('false');
        expect(root.querySelector('#aviso').textContent).to.include('no se completó');
        expect(root.querySelector('#ver-web').hidden).to.be.false;
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#instalar').disabled).to.be.false;
        expect(root.querySelector('#aviso').textContent).to.include('barra del navegador');
        const siguiente = prompt('accepted');
        root.querySelector('#instalar').click(); await esperar();
        expect(siguiente.prompt.calledOnce).to.be.true;
        soloVerTicket(root);
    });

    test('sin beforeinstallprompt informa inline sin usar otra API ni bloquear el botón', async () => {
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click(); await esperar();
        expect(root.querySelector('#aviso').hidden).to.be.false;
        expect(root.querySelector('#aviso').textContent).to.include('barra del navegador');
        expect(root.querySelector('#instalar').disabled).to.be.false;
        expect(instalacionService.enCurso).to.be.false;
    });

    for (const tipo of ['AbortError', 'Error']) {
        test(`fallo ${tipo} del prompt restaura el estado y permite usar la web`, async () => {
            const evento = prompt();
            evento.prompt.rejects(Object.assign(new Error('Fallo'), { name: tipo }));
            const root = montar('opciones-ticket').shadowRoot;
            root.querySelector('#instalar').click(); await esperar();
            expect(instalacionService.enCurso).to.be.false;
            expect(root.querySelector('#instalar').disabled).to.be.false;
            expect(root.querySelector('#ver-web').hidden).to.be.false;
            expect(root.querySelector('#aviso').hidden).to.be.false;
        });
    }

    test('un nuevo beforeinstallprompt limpia la bandera persistida de una desinstalación', () => {
        store.setState({ appInstalada: true });
        const root = montar('opciones-ticket').shadowRoot;
        soloVerTicket(root);
        const evento = prompt();
        expect(store.state.appInstalada).to.be.false;
        expect(localStorage.getItem(APP_INSTALADA_KEY)).to.be.null;
        expect(instalacionService.eventoPendiente).to.equal(evento);
        expect(root.querySelector('#instalar').hidden).to.be.false;
        expect(root.querySelector('#ver-web').hidden).to.be.false;
    });

    test('appinstalled durante un prompt pendiente desbloquea inmediatamente la UI', async () => {
        let resolver;
        const evento = prompt();
        evento.userChoice = new Promise(resolve => { resolver = resolve; });
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click();
        window.dispatchEvent(new Event('appinstalled'));
        expect(instalacionService.enCurso).to.be.false;
        soloVerTicket(root);
        resolver({ outcome: 'dismissed' }); await esperar();
        expect(store.state.appInstalada).to.be.true;
    });

    test('una aceptación obsoleta no invalida el nuevo prompt disponible', async () => {
        let resolver;
        const anterior = prompt();
        anterior.userChoice = new Promise(resolve => { resolver = resolve; });
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#instalar').click();
        const nuevo = prompt();
        resolver({ outcome: 'accepted' }); await esperar();
        expect(store.state.appInstalada).to.be.false;
        expect(instalacionService.eventoPendiente).to.equal(nuevo);
        expect(root.querySelector('#instalar').disabled).to.be.false;
    });

    for (const instalada of [false, true]) {
        test(`offline no abre pestañas vacías con appInstalada=${instalada}`, () => {
            store.setState({ appInstalada: instalada });
            sinon.stub(navigator, 'onLine').get(() => false);
            const abrir = sinon.stub(window, 'open');
            const root = montar('opciones-ticket').shadowRoot;
            root.querySelector(instalada ? '#ver-ticket' : '#ver-web').click();
            expect(abrir.called).to.be.false;
            expect(root.querySelector('#aviso').textContent).to.include('Sin conexión');
            expect(root.querySelector('object, iframe, dialog')).to.be.null;
        });
    }

    test('sin identificador no permite abrir un ticket', () => {
        const abrir = sinon.stub(window, 'open');
        const root = montar('opciones-ticket', '').shadowRoot;
        expect(root.querySelector('#instalar').disabled).to.be.true;
        expect(root.querySelector('#ver-web').hasAttribute('href')).to.be.false;
        root.querySelector('#ver-web').click();
        expect(abrir.called).to.be.false;
        store.setState({ appInstalada: true });
        expect(root.querySelector('#ver-ticket').disabled).to.be.true;
    });

    test('sin localStorage disponible sigue reaccionando al estado de instalación', () => {
        const original = Storage.prototype.setItem;
        sinon.stub(Storage.prototype, 'setItem').callsFake(function (clave, valor) {
            if (clave === APP_INSTALADA_KEY) throw new DOMException('No permitido', 'SecurityError');
            return original.call(this, clave, valor);
        });
        const root = montar('opciones-ticket').shadowRoot;
        window.dispatchEvent(new Event('appinstalled'));
        expect(store.state.appInstalada).to.be.true;
        soloVerTicket(root);
    });

    test('los cambios de instalación en otra pestaña se reflejan en la tarjeta', () => {
        const root = montar('opciones-ticket').shadowRoot;
        localStorage.setItem(APP_INSTALADA_KEY, '1');
        window.dispatchEvent(new StorageEvent('storage', { key: APP_INSTALADA_KEY, newValue: '1', storageArea: localStorage }));
        soloVerTicket(root);
    });

    for (const caso of ['404', 'offline']) {
        test(`el detalle público mantiene el error ${caso} amigable y de solo lectura`, async () => {
            sinon.stub(consultaService, 'findById').rejects(Object.assign(new Error('Fallo'), { status: caso === '404' ? 404 : null }));
            if (caso === 'offline') sinon.stub(navigator, 'onLine').get(() => false);
            const root = montar('detalle-consulta-view').shadowRoot; await esperar();
            expect(root.querySelector('#estado').textContent).to.include(caso === '404' ? 'No se encontró' : 'Sin conexión');
            expect(root.querySelector('#reintentar').hidden).to.be.false;
            expect(root.querySelector('form, input, textarea, dialog, [popover]')).to.be.null;
        });
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

});
