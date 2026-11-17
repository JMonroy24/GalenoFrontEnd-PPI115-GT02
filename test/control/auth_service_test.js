import { AuthService, authService, SESSION_STORAGE_KEY } from "../../src/js/control/auth_service.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AuthService (unitaria)", () => {
    let servicio;
    let fetchStub;
    let logStub;

    const responderRoles = (payload) => fetchStub
        .withArgs(sinon.match((url) => new URL(url).pathname.endsWith("/personas-roles")))
        .resolves({ ok: true, status: 200, json: async () => payload });

    const perfilPersonaFicticia = {
        idPersona: 42,
        nombres: "Carlos",
        apellidos: "López",
        numeroDocumento: "01234567-8",
        clinicas: [{ idClinica: 3, nombre: "Clínica Norte" }]
    };

    const rolesEmpleadoValidos = [
        {
            idPersonaRol: 1,
            activo: true,
            rol: {
                idRol: 2,
                nombre: "MEDICO GENERAL",
                esEmpleado: true
            }
        }
    ];

    setup(() => {
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
        }
        servicio = new AuthService();
        logStub = sinon.stub(console, "log");
    });

    teardown(() => {
        fetchStub?.restore();
        logStub?.restore();
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
        }
        store.setState({
            token: null,
            usuario: null,
            roles: [],
            rolSeleccionado: null,
            clinicaActiva: null
        });
    });

    suite("login", () => {
        for (const personaPlana of [false, true]) {
            for (const rolesPlanos of [false, true]) {
                test(`encadena id genérico con persona ${personaPlana ? "[]" : "{ items }"} y roles ${rolesPlanos ? "[]" : "{ items }"}`, async () => {
                    const persona = {
                        id: 42, nombres: "Ana", numeroDocumento: "01234567-8",
                        tipoDocumento: { id: 1 }
                    };
                    const rol = {
                        id: 15, persona: { id: 42 }, rol: { id: 7, nombre: "Personal" },
                        clinica: { id: 3, nombre: "Clínica Norte" }
                    };
                    const respuestaPersona = personaPlana ? [persona] : { items: [persona] };
                    const respuestaRoles = rolesPlanos ? [rol] : { items: [rol] };
                    fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => ({
                        ok: true, status: 200,
                        json: async () => new URL(url).pathname.endsWith("/personas-roles")
                            ? respuestaRoles : respuestaPersona
                    }));

                    const sesion = await servicio.login(1, "01234567-8");

                    expect(fetchStub.callCount).to.equal(2);
                    const urlPersona = new URL(fetchStub.firstCall.args[0]);
                    const urlRoles = new URL(fetchStub.secondCall.args[0]);
                    expect(urlPersona.pathname).to.match(/\/personas$/);
                    expect(urlRoles.pathname).to.match(/\/personas-roles$/);
                    expect(urlRoles.searchParams.get("personaId")).to.equal("42");
                    expect(urlRoles.searchParams.get("first")).to.equal("0");
                    expect(urlRoles.searchParams.get("max")).to.equal("10");
                    expect(sesion.perfil).to.equal(persona);
                    expect(sesion.roles).to.deep.equal([rol]);
                    expect(store.isAuthenticated()).to.be.true;
                    expect(logStub.getCalls().map((llamada) => llamada.args)).to.deep.equal([
                        ["Petición Persona URL:", urlPersona.href],
                        ["Respuesta Backend Persona:", respuestaPersona],
                        ["Petición Roles URL:", urlRoles.href],
                        ["Respuesta Backend Roles:", respuestaRoles]
                    ]);
                });
            }
        }

        for (const id of [42, "", null]) {
            test(`prioriza id válido y usa idPersona si id es ${JSON.stringify(id)}`, async () => {
                const persona = { ...perfilPersonaFicticia, id, idPersona: id === 42 ? 999 : 42 };
                fetchStub = sinon.stub(window, "fetch").resolves({
                    ok: true, json: async () => ({ items: [persona] })
                });
                responderRoles([{ persona: { id: 42 }, rol: { id: 7 } }]);

                const sesion = await servicio.login(1, "01234567-8");

                expect(new URL(fetchStub.secondCall.args[0]).searchParams.get("personaId")).to.equal("42");
                expect(sesion.roles).to.have.length(1);
                expect(store.isAuthenticated()).to.be.true;
            });
        }

        test("no solicita roles si la persona no contiene ningún identificador válido", async () => {
            const { idPersona, ...sinId } = perfilPersonaFicticia;
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true, json: async () => ({ items: [{ ...sinId, id: " " }] })
            });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error).to.be.instanceOf(DefaultError);
            expect(fetchStub.calledOnce).to.be.true;
            expect(logStub.calledWith("Petición Roles URL:", sinon.match.any)).to.be.false;
            expect(store.isAuthenticated()).to.be.false;
        });

        test("propaga el error HTTP al buscar roles sin crear una sesión", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true, json: async () => ({ items: [perfilPersonaFicticia] })
            });
            fetchStub.withArgs(sinon.match((url) => new URL(url).pathname.endsWith("/personas-roles")))
                .resolves({ ok: false, status: 500, json: async () => ({ message: "Roles no disponibles" }) });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error?.status).to.equal(500);
            expect(error?.message).to.equal("Roles no disponibles");
            expect(servicio.sesion).to.be.null;
            expect(store.isAuthenticated()).to.be.false;
        });

        test("autentica con éxito a persona con rol de empleado, almacena en sessionStorage y sincroniza store", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                headers: new Headers({ "Authorization": "Bearer token-jwt-secreto" }),
                text: async () => JSON.stringify([perfilPersonaFicticia])
            });

            responderRoles({ items: rolesEmpleadoValidos });

            const sesion = await servicio.login(1, "01234567-8");

            expect(sesion).to.be.an("object");
            expect(sesion.perfil).to.deep.equal(perfilPersonaFicticia);
            expect(sesion.token).to.equal("token-jwt-secreto");
            expect(sesion.roles).to.deep.equal(rolesEmpleadoValidos);
            expect(servicio.sesion).to.equal(sesion);
            expect(store.isAuthenticated()).to.be.true;
            expect(new URL(fetchStub.firstCall.args[0]).pathname).to.match(/\/personas$/);

            // Verifica persistencia en sessionStorage
            const rawStorage = sessionStorage.getItem(SESSION_STORAGE_KEY);
            expect(rawStorage).to.exist;
            const parseado = JSON.parse(rawStorage);
            expect(parseado.token).to.equal("token-jwt-secreto");
            expect(parseado.perfil.idPersona).to.equal(42);

            // Verifica sincronización en store reactivo
            const estadoStore = store.getState();
            expect(estadoStore.token).to.equal("token-jwt-secreto");
            expect(estadoStore.usuario.idPersona).to.equal(42);
            expect(estadoStore.roles).to.have.length(1);
            expect(estadoStore.rolSeleccionado).to.deep.equal(rolesEmpleadoValidos[0]);
        });

        test("falla con DefaultError 404 si la persona no es encontrada", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                text: async () => JSON.stringify([])
            });

            let errorLanzado = null;
            try {
                await servicio.login(1, "99999999-9");
            } catch (err) {
                errorLanzado = err;
            }

            assert.instanceOf(errorLanzado, DefaultError);
            expect(errorLanzado.status).to.equal(404);
            expect(errorLanzado.message).to.contain("No se encontró la persona");
        });

        test("falla con DefaultError 403 si items no contiene roles asignados", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                text: async () => JSON.stringify([perfilPersonaFicticia])
            });

            responderRoles({ items: [] });

            let errorLanzado = null;
            try {
                await servicio.login(1, "01234567-8");
            } catch (err) {
                errorLanzado = err;
            }

            assert.instanceOf(errorLanzado, DefaultError);
            expect(errorLanzado.status).to.equal(403);
            expect(errorLanzado.message).to.contain("no tiene roles asignados");
        });

        test("no autentica a otra persona si el servidor devuelve una lista sin filtrar", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                json: async () => ({ items: [{ ...perfilPersonaFicticia, numeroDocumento: "99999999-9" }] })
            });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error?.status).to.equal(404);
            expect(fetchStub.calledOnce).to.be.true;
            expect(store.isAuthenticated()).to.be.false;
        });

        test("rechaza registros de otra persona y entradas que no son objetos", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                json: async () => ({ items: [perfilPersonaFicticia] })
            });
            responderRoles({ items: [
                { persona: { idPersona: 99 }, rol: { nombre: "MEDICO" } },
                null, "MEDICO", [], 42
            ] });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error?.status).to.equal(403);
            expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;
            expect(store.isAuthenticated()).to.be.false;
        });

        test("acepta items con persona, rol y clínica anidados sin atributos inventados", async () => {
            const registro = {
                idPersonaRol: 15,
                persona: { idPersona: 42 },
                rol: { idRol: 7, nombre: "Personal de apoyo" },
                clinica: { idClinica: 8, nombre: "Clínica Central" }
            };
            fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => ({
                ok: true, status: 200,
                json: async () => ({ items: String(url).includes("/personas-roles?")
                    ? [registro] : [perfilPersonaFicticia] })
            }));

            const sesion = await servicio.login(1, "01234567-8");

            expect(fetchStub.callCount).to.equal(2);
            const urlRoles = new URL(fetchStub.secondCall.args[0]);
            expect(urlRoles.pathname).to.match(/\/personas-roles$/);
            expect(urlRoles.searchParams.get("personaId")).to.equal("42");
            expect(sesion.roles).to.deep.equal([registro]);
            expect(sesion.rolSeleccionado.rol.nombre).to.equal("Personal de apoyo");
            expect(sesion.clinicaActiva).to.deep.equal(registro.clinica);
            expect(store.isAuthenticated()).to.be.true;
        });

        test("delega la validez del rol al backend sin clasificar nombres ni esEmpleado", async () => {
            const registros = [
                { idPersonaRol: 1, persona: { idPersona: 42 }, rol: { nombre: "PACIENTE", esEmpleado: false } },
                { idPersonaRol: 2, persona: { idPersona: 42 }, activo: false, rol: { nombre: "INVITADO" } }
            ];
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true, json: async () => ({ items: [perfilPersonaFicticia] })
            });
            responderRoles({ items: registros });

            const sesion = await servicio.login(1, "01234567-8");

            expect(sesion.roles).to.deep.equal(registros);
            expect(store.isAuthenticated()).to.be.true;
        });

        test("prioriza items cuando existe aunque haya otras propiedades", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true, json: async () => ({ items: [perfilPersonaFicticia] })
            });
            responderRoles({ items: [], datos: rolesEmpleadoValidos });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error?.status).to.equal(403);
            expect(store.isAuthenticated()).to.be.false;
        });

        test("elige la clínica del rol activo y permite sesiones sin token", async () => {
            fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
                const recurso = new URL(url);
                if (recurso.pathname.endsWith("/personas-roles")) {
                    expect(recurso.searchParams.get("personaId")).to.equal("42");
                    return { ok: true, json: async () => ({ items: [{
                        idPersona: 42, activo: true, rol: { nombre: "Médico general" }, idClinica: 8
                    }] }) };
                }
                expect(recurso.pathname).to.match(/\/personas$/);
                return { ok: true, json: async () => ({ items: [perfilPersonaFicticia] }) };
            });

            const sesion = await servicio.login(1, "01234567-8");

            expect(fetchStub.callCount).to.equal(2);
            expect(sesion.token).to.be.null;
            expect(sesion.clinicaActiva.idClinica).to.equal(8);
            expect(store.isAuthenticated()).to.be.true;
            expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)).clinicaActiva.idClinica).to.equal(8);
        });

        test("rechaza una sesión sin clínica para evitar rebotes del dashboard al login", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                json: async () => ({ items: [{ ...perfilPersonaFicticia, clinicas: [] }] })
            });
            responderRoles({ items: rolesEmpleadoValidos });

            let error;
            try { await servicio.login(1, "01234567-8"); } catch (err) { error = err; }

            expect(error?.status).to.equal(403);
            expect(error?.message).to.contain("clínica activa");
            expect(store.isAuthenticated()).to.be.false;
            expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;
        });
    });

    suite("restaurarSesion", () => {
        test("restaura sesión existente desde sessionStorage hacia la instancia y el store", () => {
            const sesionGuardada = {
                token: "token-restaurado",
                perfil: { idPersona: 100, nombres: "Ana" },
                roles: [{ idPersonaRol: 5, nombreRol: "RECEPCIONISTA" }],
                clinicaActiva: { idClinica: 1, nombre: "Central" },
                rolSeleccionado: { idPersonaRol: 5, nombreRol: "RECEPCIONISTA" }
            };
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sesionGuardada));

            const restaurada = servicio.restaurarSesion();

            expect(restaurada).to.be.an("object");
            expect(restaurada.token).to.equal("token-restaurado");
            expect(servicio.sesion).to.deep.equal(restaurada);

            expect(store.getState().token).to.equal("token-restaurado");
            expect(store.getState().clinicaActiva).to.deep.equal(sesionGuardada.clinicaActiva);
        });

        test("retorna null y limpia almacenamiento si el JSON es inválido", () => {
            sessionStorage.setItem(SESSION_STORAGE_KEY, "json-invalido-{");

            const res = servicio.restaurarSesion();

            expect(res).to.be.null;
            expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;
        });
    });

    suite("logout", () => {
        test("elimina la sesión de sessionStorage, resetea la instancia y limpia el store", () => {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: "token-activo" }));
            servicio.sesion = { token: "token-activo" };
            store.setState({ token: "token-activo", usuario: { id: 1 } });

            servicio.logout();

            expect(servicio.sesion).to.be.null;
            expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;

            const estado = store.getState();
            expect(estado.token).to.be.null;
            expect(estado.usuario).to.be.null;
            expect(estado.roles).to.be.an("array").that.is.empty;
            expect(estado.rolSeleccionado).to.be.null;
            expect(estado.clinicaActiva).to.be.null;
        });
    });
});
