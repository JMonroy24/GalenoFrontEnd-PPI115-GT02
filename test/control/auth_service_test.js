import { AuthService, authService, SESSION_STORAGE_KEY } from "../../src/js/control/auth_service.js";
import { personaRolService } from "../../src/js/control/persona_rol_service.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AuthService (unitaria)", () => {
    let servicio;
    let fetchStub;
    let buscarRolesStub;

    const perfilPersonaFicticia = {
        idPersona: 42,
        nombres: "Carlos",
        apellidos: "López",
        numeroDocumento: "01234567-8"
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
    });

    teardown(() => {
        fetchStub?.restore();
        buscarRolesStub?.restore();
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
        test("autentica con éxito a persona con rol de empleado, almacena en sessionStorage y sincroniza store", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                headers: new Headers({ "Authorization": "Bearer token-jwt-secreto" }),
                text: async () => JSON.stringify([perfilPersonaFicticia])
            });

            buscarRolesStub = sinon.stub(personaRolService, "buscarRolesPorPersona")
                .resolves({ items: rolesEmpleadoValidos });

            const sesion = await servicio.login(1, "01234567-8");

            expect(sesion).to.be.an("object");
            expect(sesion.perfil).to.deep.equal(perfilPersonaFicticia);
            expect(sesion.token).to.equal("token-jwt-secreto");
            expect(sesion.roles).to.deep.equal(rolesEmpleadoValidos);

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

        test("falla con DefaultError 403 si la persona no tiene roles de empleado activos", async () => {
            fetchStub = sinon.stub(window, "fetch").resolves({
                ok: true,
                status: 200,
                text: async () => JSON.stringify([perfilPersonaFicticia])
            });

            // Solo rol PACIENTE o inactivo
            const rolesSoloPaciente = [
                {
                    idPersonaRol: 10,
                    activo: true,
                    rol: { idRol: 99, nombre: "PACIENTE", esEmpleado: false }
                },
                {
                    idPersonaRol: 11,
                    activo: false,
                    rol: { idRol: 2, nombre: "MEDICO GENERAL", esEmpleado: true }
                }
            ];

            buscarRolesStub = sinon.stub(personaRolService, "buscarRolesPorPersona")
                .resolves({ items: rolesSoloPaciente });

            let errorLanzado = null;
            try {
                await servicio.login(1, "01234567-8");
            } catch (err) {
                errorLanzado = err;
            }

            assert.instanceOf(errorLanzado, DefaultError);
            expect(errorLanzado.status).to.equal(403);
            expect(errorLanzado.message).to.contain("no tiene roles de empleado activos");
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
