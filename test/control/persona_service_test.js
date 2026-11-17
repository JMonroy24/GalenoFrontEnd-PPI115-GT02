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

        expect(fetchStub.firstCall.args[0].toString()).to.contain(
            "personas?first=0&max=20&q=01234567-8"
        );
        expect(clinicas).to.deep.equal([
            { idClinica: 3, nombre: "Clínica Norte" },
            { idClinica: 5, nombre: "Clínica Sur" }
        ]);
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

    test("buscarClinicasPaciente consulta el subrecurso de clínicas si no vienen embebidas", async () => {
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
                items: [{ idClinica: 4, nombre: "Clínica Oriente" }]
            })
        });

        const clinicas = await servicio.buscarClinicasPaciente("1", "11111111-1");

        expect(fetchStub.callCount).to.equal(2);
        expect(fetchStub.secondCall.args[0].toString()).to.contain(
            "personas/11/clinicas"
        );
        expect(clinicas).to.deep.equal([
            { idClinica: 4, nombre: "Clínica Oriente" }
        ]);
    });
});
