import PersonaService from "../../src/js/control/persona_service.js";
import { expect } from "../lib/chai/index.js";


mocha.setup("tdd");

suite("PersonaService (unitaria)", () => {
    let fetchStub;
    const servicio = new PersonaService();

    teardown(() => fetchStub?.restore());

    test("buscarClinicasPaciente devuelve solo las clínicas embebidas del paciente", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({
                items: [
                    {
                        idPersona: 7,
                        numeroDocumento: "01234567-8",
                        clinicas: [
                            { idClinica: 3, nombre: "Clínica Norte" },
                            { idClinica: 3, nombre: "Clínica Norte duplicada" },
                            { idClinica: 5, nombre: "Clínica Sur" }
                        ]
                    }
                ]
            })
        });

        const clinicas = await servicio.buscarClinicasPaciente("1", "01234567-8");

        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("valor")).to.equal("01234567-8");
        expect(url.searchParams.get("tipoDocumentoId")).to.equal("1");
        expect(url.searchParams.has("q")).to.be.false;
        expect(clinicas).to.deep.equal([
            { idClinica: 3, nombre: "Clínica Norte" },
            { idClinica: 5, nombre: "Clínica Sur" }
        ]);
    });

    test("codifica el documento como valor sin alterar caracteres reservados", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true, json: async () => ({ items: [{ idPersona: 7, numeroDocumento: "AB&12+3" }] })
        });
        expect((await servicio.buscarPorDocumento(" pasaporte ", " AB&12+3 ")).idPersona).to.equal(7);
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("valor")).to.equal("AB&12+3");
        expect(url.searchParams.get("tipoDocumentoId")).to.equal("pasaporte");
        expect(url.searchParams.has("q")).to.be.false;
    });

    test("buscarClinicasPaciente filtra roles y conserva solo los de paciente", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({
                items: [
                    {
                        idPersona: 8,
                        numeroDocumento: "09876543-2",
                        roles: [
                            {
                                rol: { nombre: "PACIENTE" },
                                clinica: { idClinica: 2, nombre: "Clínica Santa Tecla" }
                            },
                            {
                                rol: { nombre: "EMPLEADO" },
                                clinica: { idClinica: 9, nombre: "Clínica Interna" }
                            }
                        ]
                    }
                ]
            })
        });

        const clinicas = await servicio.buscarClinicasPaciente("1", "09876543-2");

        expect(clinicas).to.deep.equal([
            { idClinica: 2, nombre: "Clínica Santa Tecla" }
        ]);
    });

    test("buscarClinicasPaciente devuelve vacío cuando la persona no existe", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            status: 200,
            json: async () => ({ items: [] })
        });

        const clinicas = await servicio.buscarClinicasPaciente("1", "00000000-0");

        expect(clinicas).to.deep.equal([]);
    });

    test("excluye roles inactivos aunque la persona tenga un catálogo de clínicas", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            json: async () => ({ items: [{
                numeroDocumento: "01234567-8",
                clinicas: [{ idClinica: 99, nombre: "Catálogo general" }],
                roles: [
                    { activo: true, idRol: { nombre: "PACIENTE" }, idClinica: { idClinica: 1, nombre: "Activa" } },
                    { activo: false, rol: "PACIENTE", clinica: { idClinica: 2 } },
                    { estado: "INACTIVO", rol: "PACIENTE", clinica: { idClinica: 3 } },
                    { activo: "0", rol: "PACIENTE", clinica: { idClinica: 4 } },
                    { rol: { nombre: "PACIENTE", activo: false }, clinica: { idClinica: 5 } },
                    { rol: "PACIENTE", clinica: { idClinica: 6, activo: false } },
                    { rol: "EMPLEADO", clinica: { idClinica: 7 } }
                ]
            }] })
        });

        expect(await servicio.buscarClinicasPaciente("1", "01234567-8"))
            .to.deep.equal([{ idClinica: 1, nombre: "Activa" }]);
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("no recupera otras clínicas cuando todas las asociaciones están inactivas", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            json: async () => ({ items: [{
                idPersona: 7, numeroDocumento: "01234567-8",
                clinicas: [{ idClinica: 3, activo: false }]
            }] })
        });

        expect(await servicio.buscarClinicasPaciente("1", "01234567-8")).to.deep.equal([]);
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("no usa coincidencias parciales ni otro tipo de documento", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves({
            ok: true,
            json: async () => ({ items: [
                { idPersona: 1, numeroDocumento: "01234567-9", idTipoDocumento: 1 },
                { idPersona: 2, numeroDocumento: "01234567-8", idTipoDocumento: { idTipoDocumento: 2 } }
            ] })
        });

        expect(await servicio.buscarClinicasPaciente("1", "01234567-8")).to.deep.equal([]);
        expect(fetchStub.calledOnce).to.be.true;
    });

    test("buscarClinicasPaciente consulta personas-roles si no vienen clínicas embebidas", async () => {
        fetchStub = sinon.stub(window, "fetch");

        fetchStub.onFirstCall().resolves({
            ok: true,
            status: 200,
            json: async () => ({
                items: [{ idPersona: 11, numeroDocumento: "11111111-1" }]
            })
        });
        fetchStub.onSecondCall().resolves({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                items: [{ rol: { nombre: "PACIENTE" }, clinica: { idClinica: 4, nombre: "Clínica Oriente" } }]
            })
        });

        const clinicas = await servicio.buscarClinicasPaciente("1", "11111111-1");

        expect(fetchStub.callCount).to.equal(2);
        const url = new URL(fetchStub.secondCall.args[0]);
        expect(url.pathname).to.match(/\/personas-roles$/);
        expect(url.searchParams.get("personaId")).to.equal("11");
        expect(clinicas).to.deep.equal([
            { idClinica: 4, nombre: "Clínica Oriente" }
        ]);
    });

    test("acepta el DTO filtrado sin documento y resuelve UUIDs de rol y clínica", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const recurso = new URL(url);
            const respuestas = {
                "/personas": { items: [{ id: "persona-1", nombres: "Ana" }] },
                "/personas-roles": { items: [
                    { idPersona: "persona-1", idRol: "rol-1", idClinica: "clinica-1", activo: true },
                    { idPersona: "persona-1", idRol: "rol-1", idClinica: "clinica-1", activo: true },
                    { idPersona: "persona-1", idRol: "rol-1", idClinica: "inactiva", activo: false },
                    { idPersona: "otra-persona", idRol: "rol-1", idClinica: "ajena" },
                    { idPersona: "persona-1", idRol: "rol-2", idClinica: "empleado" }
                ] },
                "/roles/rol-1": { id: "rol-1", nombre: "PACIENTE" },
                "/roles/rol-2": { id: "rol-2", nombre: "EMPLEADO" },
                "/clinicas/clinica-1": { id: "clinica-1", nombre: "Clínica Central" }
            };
            const ruta = recurso.pathname.replace("/galenoSV/api/v1", "");
            expect(respuestas, ruta).to.have.property(ruta);
            return { ok: true, json: async () => respuestas[ruta] };
        });

        expect(await servicio.buscarClinicasPaciente("tipo-1", "12312378-0"))
            .to.deep.equal([{ idClinica: "clinica-1", nombre: "Clínica Central" }]);
        expect(fetchStub.callCount).to.equal(5);
        const url = new URL(fetchStub.firstCall.args[0]);
        expect(url.searchParams.get("tipoDocumentoId")).to.equal("tipo-1");
        expect(url.searchParams.get("valor")).to.equal("12312378-0");
    });

    test("recupera las siguientes páginas de asociaciones del paciente", async () => {
        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const recurso = new URL(url);
            if (recurso.pathname.endsWith("/personas")) {
                return { ok: true, json: async () => ({ items: [{ id: "persona-1" }] }) };
            }
            const first = Number(recurso.searchParams.get("first"));
            const items = first === 0
                ? Array.from({ length: 10 }, () => ({ rol: { nombre: "EMPLEADO" } }))
                : [{ rol: { nombre: "PACIENTE" }, clinica: { id: 4, nombre: "Oriente" } }];
            return { ok: true, json: async () => ({ items, total: 11 }) };
        });
        expect(await servicio.buscarClinicasPaciente("1", "12312378-0"))
            .to.deep.equal([{ idClinica: 4, nombre: "Oriente" }]);
        expect(new URL(fetchStub.thirdCall.args[0]).searchParams.get("first")).to.equal("10");
    });
});
