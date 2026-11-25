import GestorFechas from '../../src/js/control/gestor_fechas.js';
import '../../src/js/boundary/componentes/notificacion_emergente.js';
import '../../src/js/boundary/componentes/encabezado_app.js';
import '../../src/js/boundary/componentes/tarjeta_consulta.js';
import { expect } from '../lib/chai/index.js';

mocha.setup('tdd');
suite('Rúbrica: fechas, presentación inline y recursos offline', () => {
    test('la fecha de calendario siempre muestra DD/MM/YYYY sin alterar su valor ISO', () => {
        for (const iso of ['2026-11-17', '2026-11-17T09:30:00', '2026-11-17T23:59:00-06:00']) {
            expect(GestorFechas.formatearFechaCalendario(iso)).to.equal('17/11/2026');
            expect(GestorFechas.extraerFechaCalendario(iso)).to.equal('2026-11-17');
            expect(GestorFechas.formatearFechaHoraCalendario(iso)).not.to.match(/\d{4}-\d{2}-\d{2}/);
        }
        const campo = document.createElement('input'); campo.type = 'date'; campo.value = '2026-11-17';
        expect(campo.value).to.equal('2026-11-17');
    });

    test('la tarjeta muestra la fecha formateada conservando el objeto original', () => {
        const datos = { idConsulta: 'fecha', fecha: '2026-11-17T09:30:00', pasos: [] };
        const tarjeta = document.body.appendChild(document.createElement('tarjeta-consulta'));
        try {
            tarjeta.consulta = datos;
            expect(tarjeta.shadowRoot.querySelector('#fecha').textContent).to.equal('17/11/2026');
            expect(datos.fecha).to.equal('2026-11-17T09:30:00');
        } finally { tarjeta.remove(); }
    });

    test('las notificaciones ocupan espacio en el flujo normal y se pueden cerrar', () => {
        const host = document.body.appendChild(document.createElement('notificacion-emergente'));
        try {
            host.mostrarMensaje({ titulo: 'Registro guardado', detalle: 'Diagnóstico clínico', duracion: 0 });
            const panel = host.shadowRoot.querySelector('#contenedor');
            expect(getComputedStyle(panel).position).to.equal('static');
            expect(panel.textContent).to.include('Registro guardado');
            expect(host.shadowRoot.querySelector('dialog, [popover], [aria-modal]')).to.be.null;
            panel.querySelector('button').click();
            expect(panel.children).to.have.length(0);
        } finally { host.remove(); }
    });

    test('los módulos de producción ya no declaran ventanas flotantes ni cargan CIE-10', async () => {
        const modulos = ['boundary/componentes/historial_pasos.js', 'boundary/componentes/encabezado_app.js',
            'boundary/componentes/notificacion_emergente.js', 'boundary/vistas/atencion_consulta_view.js'];
        for (const modulo of modulos) {
            const response = await fetch(new URL(`../../src/js/${modulo}`, import.meta.url));
            expect(response.ok).to.be.true;
            const fuente = await response.text();
            expect(fuente).not.to.match(/<dialog\b|showModal\s*\(|\bpopover\s*=|position:\s*fixed/);
            expect(fuente).not.to.match(/import\s+.*(?:autocomplete_cie10|cie10_service)|<auto-complete-cie10/);
        }
    });

    test('el precache actualizado solo referencia archivos existentes y no contiene CIE-10', async () => {
        const sw = new URL('../../src/sw.js', import.meta.url);
        const response = await fetch(sw);
        const fuente = await response.text();
        expect(fuente).to.include('galenosv-app-shell-v31').and.not.to.match(/cie10/i);
        const rutas = [...fuente.matchAll(/"(\/[^"\n]+\.(?:html|js|css|json|png))"/g)].map(m => m[1]);
        expect(rutas.length).to.be.greaterThan(30);
        const resultados = await Promise.all(rutas.map(async ruta => {
            const archivo = new URL(ruta.slice(1), new URL('./', sw));
            return { ruta, estado: (await fetch(archivo)).status };
        }));
        expect(resultados.filter(r => r.estado !== 200)).to.deep.equal([]);
    });
});
