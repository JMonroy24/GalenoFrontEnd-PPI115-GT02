import { consultaService } from '../../src/js/control/consulta_service.js';
import { API_BASE } from '../../src/js/config.js';
import { Router } from '../../src/js/router.js';
import { store } from '../../src/js/store.js';
import GestorFechas from '../../src/js/control/gestor_fechas.js';
import '../../src/js/boundary/vistas/detalle_consulta_view.js';
import { expect } from '../lib/chai/index.js';

mocha.setup('bdd');
describe('Ticket y detalle público (integración con Open Liberty)', function () {
    this.timeout(30000);
    let id;
    before(async function () {
        const respuesta = await fetch(`${API_BASE}/consultas?first=0&max=1`);
        expect(respuesta.status).to.equal(200);
        const datos = await respuesta.json();
        id = datos.items[0]?.idConsulta ?? datos.items[0]?.id;
        expect(id, 'Se necesita una consulta existente para comprobar el PDF y el QR').to.be.a('string');
    });

    it('obtiene un PDF público válido pasando el origen del frontend, sin descarga automática', async () => {
        const respuesta = await fetch(consultaService.obtenerUrlTicket(id),
            { headers: { Accept: 'application/pdf' }, credentials: 'omit' });
        expect(respuesta.status).to.equal(200);
        expect(respuesta.headers.get('Content-Type')).to.include('application/pdf');
        const blob = await respuesta.blob();
        expect(blob.size).to.be.greaterThan(100);
        expect(await blob.slice(0, 5).text()).to.equal('%PDF-');
    });

    it('abre #consulta/id sin empleado y resuelve paciente, clínica y pasos con fetch real', async () => {
        const estadoAnterior = { ...store.state };
        const hashAnterior = location.hash;
        const contenedor = document.body.appendChild(document.createElement('main'));
        try {
            store.setState({ usuario: null, token: null, clinicaActiva: null, roles: [], rolSeleccionado: null });
            const consulta = await consultaService.findById(id);
            const router = new Router({ container: contenedor });
            expect(router.navigate(`#consulta/${id}`)).to.equal('consulta');
            const vista = contenedor.querySelector('detalle-consulta-view');
            for (let i = 0; i < 200 && vista.shadowRoot.querySelector('#detalle').hidden; i++) {
                if (!vista.shadowRoot.querySelector('#reintentar').hidden) break;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            expect(vista.shadowRoot.querySelector('#detalle').hidden, vista.shadowRoot.querySelector('#estado').textContent).to.be.false;
            expect(store.hasActiveSession()).to.be.false;
            expect(vista.shadowRoot.querySelector('#datos').textContent).to.include(GestorFechas.formatearFechaCalendario(consulta.fecha ?? consulta.fechaInicio));
            expect(vista.shadowRoot.querySelector('#datos').textContent).not.to.include('Sin paciente');
            expect(vista.shadowRoot.querySelector('#datos').textContent).not.to.include('Sin clínica');
            expect(vista.shadowRoot.querySelector('form, input, textarea, dialog')).to.be.null;
        } finally {
            contenedor.remove();
            store.setState(estadoAnterior);
            history.replaceState(null, '', location.pathname + location.search + hashAnterior);
        }
    });
});
