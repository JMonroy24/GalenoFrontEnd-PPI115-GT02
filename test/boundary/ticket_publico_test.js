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

suite('Ticket público: modal de descarga PDF e instalación reactiva', () => {
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
    /** Abre el modal haciendo clic en el botón "Descargar PDF" del banner. */
    const abrirModal = (root) => {
        root.querySelector('#btn-descargar-pdf').click();
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

    // ── Banner ────────────────────────────────────────────────────────────────

    test('muestra un banner discreto con único botón "Descargar PDF"', () => {
        const root = montar('opciones-ticket').shadowRoot;
        const banner = root.querySelector('#banner-pdf');
        const btn = root.querySelector('#btn-descargar-pdf');
        expect(banner).to.not.be.null;
        expect(btn).to.not.be.null;
        expect(btn.textContent.trim()).to.equal('Descargar PDF');
        expect(banner.hidden).to.be.false;
        // No muestra el modal por defecto
        expect(root.querySelector('#modal-pdf').open).to.be.false;
    });

    test('sin identificador oculta el banner y deshabilita el botón', () => {
        const root = montar('opciones-ticket', '').shadowRoot;
        expect(root.querySelector('#banner-pdf').hidden).to.be.true;
        expect(root.querySelector('#btn-descargar-pdf').disabled).to.be.true;
    });

    // ── Modal ─────────────────────────────────────────────────────────────────

    test('clic en "Descargar PDF" abre el modal nativo <dialog>', () => {
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        expect(root.querySelector('#modal-pdf').open).to.be.true;
    });

    test('el modal tiene aria-labelledby y aria-modal', () => {
        const root = montar('opciones-ticket').shadowRoot;
        const modal = root.querySelector('#modal-pdf');
        expect(modal.getAttribute('aria-labelledby')).to.equal('modal-pdf-titulo');
        expect(modal.getAttribute('aria-modal')).to.equal('true');
    });

    test('el modal contiene los botones "Instalar y descargar" y "Solo ver"', () => {
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        expect(root.querySelector('#btn-instalar-descargar')).to.not.be.null;
        expect(root.querySelector('#btn-solo-ver')).to.not.be.null;
        expect(root.querySelector('#btn-cerrar-modal')).to.not.be.null;
    });

    test('el foco inicial cae en el botón "Instalar y descargar" al abrir el modal', () => {
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        expect(root.activeElement).to.equal(root.querySelector('#btn-instalar-descargar'));
    });

    test('cerrar con botón ✕ cierra el modal y devuelve el foco al disparador', async () => {
        const root = montar('opciones-ticket').shadowRoot;
        root.querySelector('#btn-descargar-pdf').focus();
        abrirModal(root);
        root.querySelector('#btn-cerrar-modal').click();
        await esperar();
        expect(root.querySelector('#modal-pdf').open).to.be.false;
        expect(root.activeElement).to.equal(root.querySelector('#btn-descargar-pdf'));
    });

    // ── Botón "Solo ver" ──────────────────────────────────────────────────────

    test('"Solo ver" abre el PDF en pestaña nueva y cierra el modal sin instalar', () => {
        const abrir = sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-solo-ver').click();
        expect(abrir.calledOnceWithExactly(
            consultaService.obtenerUrlTicket('consulta-1'), '_blank', 'noopener'
        )).to.be.true;
        expect(root.querySelector('#modal-pdf').open).to.be.false;
    });

    // ── Botón "Instalar y descargar" ──────────────────────────────────────────

    test('"Instalar y descargar" llama al prompt y luego abre el PDF', async () => {
        const evento = prompt('accepted');
        const abrir = sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        await esperar();
        expect(evento.prompt.calledOnce).to.be.true;
        expect(abrir.calledOnceWithExactly(
            consultaService.obtenerUrlTicket('consulta-1'), '_blank', 'noopener'
        )).to.be.true;
        expect(root.querySelector('#modal-pdf').open).to.be.false;
    });

    test('si no hay prompt disponible el botón principal solo descarga', async () => {
        const abrir = sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        // Sin evento beforeinstallprompt: botón dice "Descargar"
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        await esperar();
        expect(abrir.calledOnce).to.be.true;
        expect(root.querySelector('#modal-pdf').open).to.be.false;
    });

    test('si la app ya está instalada el botón principal dice "Descargar"', () => {
        store.setState({ appInstalada: true });
        const root = montar('opciones-ticket').shadowRoot;
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
    });

    // ── Offline ───────────────────────────────────────────────────────────────

    test('offline muestra aviso en el modal sin abrir pestaña vacía', () => {
        sinon.stub(navigator, 'onLine').get(() => false);
        const abrir = sinon.stub(window, 'open');
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-solo-ver').click();
        expect(abrir.called).to.be.false;
        expect(root.querySelector('#aviso').textContent).to.include('Sin conexión');
    });

    // ── Reactivo a instalación ────────────────────────────────────────────────

    test('appinstalled actualiza el texto del botón a "Descargar" sin recargar', () => {
        prompt();
        const root = montar('opciones-ticket').shadowRoot;
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Instalar y descargar');
        window.dispatchEvent(new Event('appinstalled'));
        expect(store.state.appInstalada).to.be.true;
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
    });

    test('cambiar appInstalada en Store actualiza todos los componentes visibles', () => {
        const uno = montar('opciones-ticket').shadowRoot;
        const dos = montar('opciones-ticket', 'dos').shadowRoot;
        store.setState({ appInstalada: true });
        expect(uno.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        expect(dos.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        store.setState({ appInstalada: false });
        // Con un prompt disponible volvería a "Instalar y descargar";
        // sin prompt, se muestra "Descargar" en ambos casos.
        for (const root of [uno, dos]) {
            expect(root.querySelector('#btn-descargar-pdf').disabled).to.be.false;
        }
    });

    test('aceptar userChoice consume un único prompt', async () => {
        const evento = prompt('accepted');
        sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        const segunda = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        abrirModal(segunda); // segundo componente no debería obtener el prompt
        segunda.querySelector('#btn-instalar-descargar').click();
        expect(evento.defaultPrevented).to.be.true;
        await esperar();
        expect(evento.prompt.calledOnce).to.be.true;
        expect(store.state.appInstalada).to.be.true;
        expect(localStorage.getItem(APP_INSTALADA_KEY)).to.equal('1');
        expect(new Store().state.appInstalada).to.be.true;
    });

    test('el instalador de la cabecera usa el mismo prompt y reactiva todas las tarjetas', async () => {
        const evento = prompt('accepted');
        const instalador = montar('instalador-app');
        const root = montar('opciones-ticket').shadowRoot;
        instalador.shadowRoot.querySelector('button').click();
        expect(evento.prompt.calledOnce).to.be.true;
        await esperar();
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        expect(instalador.shadowRoot.querySelector('button').hidden).to.be.true;
    });

    test('cancelar restaura los botones y permite volver a solicitar instalación', async () => {
        let resolver;
        const evento = prompt();
        evento.userChoice = new Promise(resolve => { resolver = resolve; });
        sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        expect(root.querySelector('#btn-instalar-descargar').disabled).to.be.true;
        expect(root.querySelector('#btn-instalar-descargar').getAttribute('aria-busy')).to.equal('true');
        resolver({ outcome: 'dismissed' }); await esperar();
        expect(store.state.appInstalada).to.be.false;
        expect(instalacionService.enCurso).to.be.false;
        expect(root.querySelector('#btn-instalar-descargar').disabled).to.be.false;
        expect(root.querySelector('#btn-instalar-descargar').getAttribute('aria-busy')).to.equal('false');
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
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
    });

    test('los cambios de instalación en otra pestaña se reflejan en la tarjeta', () => {
        const root = montar('opciones-ticket').shadowRoot;
        localStorage.setItem(APP_INSTALADA_KEY, '1');
        window.dispatchEvent(new StorageEvent('storage', { key: APP_INSTALADA_KEY, newValue: '1', storageArea: localStorage }));
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
    });

    for (const modo of ['standalone', 'window-controls-overlay', 'ios']) {
        test(`detecta modo instalado ${modo} y muestra "Descargar" en el modal`, () => {
            if (modo === 'ios') Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
            else sinon.stub(window, 'matchMedia').callsFake(query => ({ matches: query === `(display-mode: ${modo})` }));
            instalacionService.sincronizarEstado();
            expect(store.state.appInstalada).to.be.true;
            const root = montar('opciones-ticket').shadowRoot;
            expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        });
    }

    test('un nuevo beforeinstallprompt limpia la bandera persistida de una desinstalación', () => {
        store.setState({ appInstalada: true });
        const root = montar('opciones-ticket').shadowRoot;
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        const evento = prompt();
        expect(store.state.appInstalada).to.be.false;
        expect(localStorage.getItem(APP_INSTALADA_KEY)).to.be.null;
        expect(instalacionService.eventoPendiente).to.equal(evento);
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Instalar y descargar');
    });

    test('appinstalled durante un prompt pendiente desbloquea inmediatamente la UI', async () => {
        let resolver;
        const evento = prompt();
        evento.userChoice = new Promise(resolve => { resolver = resolve; });
        sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        window.dispatchEvent(new Event('appinstalled'));
        expect(instalacionService.enCurso).to.be.false;
        expect(root.querySelector('#btn-instalar-descargar').textContent.trim()).to.equal('Descargar');
        resolver({ outcome: 'dismissed' }); await esperar();
        expect(store.state.appInstalada).to.be.true;
    });

    test('una aceptación obsoleta no invalida el nuevo prompt disponible', async () => {
        let resolver;
        const anterior = prompt();
        anterior.userChoice = new Promise(resolve => { resolver = resolve; });
        sinon.stub(window, 'open').returns(null);
        const root = montar('opciones-ticket').shadowRoot;
        abrirModal(root);
        root.querySelector('#btn-instalar-descargar').click();
        const nuevo = prompt();
        resolver({ outcome: 'accepted' }); await esperar();
        expect(store.state.appInstalada).to.be.false;
        expect(instalacionService.eventoPendiente).to.equal(nuevo);
        expect(root.querySelector('#btn-instalar-descargar').disabled).to.be.false;
    });

    // ── Integración: detalle de consulta ──────────────────────────────────────

    for (const caso of ['404', 'offline']) {
        test(`el detalle público mantiene el error ${caso} amigable y de solo lectura`, async () => {
            sinon.stub(consultaService, 'findById').rejects(Object.assign(new Error('Fallo'), { status: caso === '404' ? 404 : null }));
            if (caso === 'offline') sinon.stub(navigator, 'onLine').get(() => false);
            const root = montar('detalle-consulta-view').shadowRoot; await esperar();
            expect(root.querySelector('#estado').textContent).to.include(caso === '404' ? 'No se encontró' : 'Sin conexión');
            expect(root.querySelector('#reintentar').hidden).to.be.false;
            expect(root.querySelector('form, input, textarea, [popover]')).to.be.null;
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
        expect(root.querySelector('form, input, textarea, [popover]')).to.be.null;
        expect(root.querySelector('opciones-ticket').getAttribute('id-consulta')).to.equal('consulta-1');
    });

});
