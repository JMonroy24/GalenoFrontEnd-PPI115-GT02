import ConsultaService from "../../src/js/control/consulta_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import { API_BASE } from "../../src/js/config.js";
import { ENDPOINTS } from "../../src/js/routes.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("bdd");

// Se usa function() (no arrow) porque this.timeout depende del contexto que Mocha asigna al callback.
describe("ConsultaService (integración con Open Liberty)", function () {
    this.timeout(5000);

    it("responde 200 por HTTP, sin errores de CORS", async function () {
        this.timeout(20000);
        const servicio = new ConsultaService();
        const response = await servicio._request(`${API_BASE}${ENDPOINTS.CONSULTAS}?first=0&max=10`);
        expect(response.status).to.equal(200);
    });

    it("findRange devuelve items del payload estructurado", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(resp).to.be.instanceOf(DefaultResponse);
        expect(resp.items).to.be.an("array");
    });

    it("lee el total del payload estructurado", async () => {
        const servicio = new ConsultaService();
        const resp = await servicio.findRange(0, 10);

        expect(resp.total).to.be.a("number");
    });

    it("expone el contrato JSON de consultas con una petición fetch real", async function () {
        this.timeout(20000);

        const response = await fetch(
            `${API_BASE}${ENDPOINTS.CONSULTAS}?first=0&max=5`,
            { headers: { Accept: "application/json" } }
        );

        expect(response.status).to.equal(200);
        expect(response.ok).to.be.true;

        const payload = await response.json();
        expect(payload).to.have.property("items").that.is.an("array");
        expect(payload).to.have.property("total").that.is.a("number");
        expect(payload).to.have.property("first").that.is.a("number");
        expect(payload).to.have.property("max").that.is.a("number");
    });

    it('aplica idClinica antes de paginar y devuelve el total filtrado', async () => {
        const response = await fetch(`${API_BASE}/consultas?idClinica=00000000-0000-4000-8000-000000000000&first=0&max=5`);
        expect(response.ok).to.be.true;
        const payload = await response.json();
        expect(payload.items).to.deep.equal([]);
        expect(payload.total).to.equal(0);
    });

    it('desde y hasta incluyen un mismo día según America/El_Salvador', async function () {
        this.timeout(20000);
        const leer = async params => (await (await fetch(`${API_BASE}/consultas?${params}`)).json());
        const muestra = await leer('first=0&max=1');
        if (!muestra.items.length) this.skip();
        const calendario = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador',
            year: 'numeric', month: '2-digit', day: '2-digit' });
        const fechaDe = cita => calendario.format(new Date(cita.fechaInicio.replace(/\[.*\]$/, '')));
        const dia = fechaDe(muestra.items[0]);
        const filtradas = await leer(new URLSearchParams({ first: '0', max: '100', desde: dia, hasta: dia }));
        expect(filtradas.items.length).to.be.greaterThan(0);
        expect(filtradas.items.every(cita => fechaDe(cita) === dia)).to.be.true;
        expect(filtradas.total).to.equal(filtradas.items.length);
    });

    it('carga con fetch real las definiciones y ejecuciones del rol vigente', async function () {
        this.timeout(30000);
        const leer = async recurso => (await (await fetch(`${API_BASE}/${recurso}?first=0&max=100`)).json());
        const registros = await leer('consultas-procedimientos-pasos');
        const vigente = registros.items.find(p => p.estado === 'EN_CURSO')
            ?? registros.items.find(p => p.estado === 'PENDIENTE');
        if (!vigente) this.skip();
        const asignacion = await (await fetch(`${API_BASE}/personas-roles/${vigente.idPersonaRol}`)).json();
        const resultado = await new ConsultaService().buscarCitas({ idClinica: asignacion.idClinica, idRol: asignacion.idRol });
        expect(resultado.items.length).to.be.greaterThan(0);
        for (const consulta of resultado.items) {
            expect(consulta.pasos.length).to.be.greaterThan(0);
            expect(consulta.pasos.at(-1).indicaFin).to.be.true;
            for (const paso of consulta.pasos) {
                expect(paso.idProcedimientoPaso).to.be.a('string');
                expect(paso.rolResponsable.id).to.be.a('string');
                if (['EN_CURSO', 'PENDIENTE'].includes(paso.estado)) {
                    expect(paso.idConsultaProcedimientoPaso).to.be.a('string');
                    expect(paso.idConsultaProcedimientoPaso).not.to.equal(paso.idProcedimientoPaso);
                }
            }
        }
    });
});
