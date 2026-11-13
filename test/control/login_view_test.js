import { LoginView } from "../../src/js/boundary/vistas/login_view.js";
import { authService, SESSION_STORAGE_KEY } from "../../src/js/control/auth_service.js";
import store from "../../src/js/store.js";
import * as routerModule from "../../src/js/router.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("LoginView (unitaria)", () => {
    let host;
    let fetchStub;
    let navigateStub;

    const esperar = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

    const perfilFicticio = {
        idPersona: 42,
        numeroDocumento: "01234567-8",
        nombres: "Ana",
        apellidos: ["López"],
        token: "jwt-login",
        clinicas: [{ idClinica: 3, nombre: "Clínica Norte" }]
    };

    const rolEmpleado = {
        idPersonaRol: 1,
        activo: true,
        rol: {
            idRol: 2,
            nombre: "MEDICO",
            esEmpleado: true
        }
    };

    const responder = (payload) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => payload,
        text: async () => JSON.stringify(payload)
    });

    const obtenerBuscador = () => host.shadowRoot.querySelector("buscador-tipo-documentos");

    const enviarFormulario = () => {
        const form = host.shadowRoot.querySelector("form");
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    };

    setup(async () => {
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
        }

        authService.sesion = null;
        store.setState({
            online: true,
            token: null,
            usuario: null,
            roles: [],
            rolSeleccionado: null,
            clinicaActiva: null
        });

        navigateStub = sinon.stub(routerModule.router, "navigate");

        fetchStub = sinon.stub(window, "fetch").callsFake(async (url) => {
            const recurso = String(url);

            if (recurso.includes("/tipos-documento?")) {
                return responder({
                    items: [
                        {
                            idTipoDocumento: 1,
                            codigo: "DUI",
                            nombre: "DUI",
                            activo: true
                        }
                    ]
                });
            }

            if (recurso.includes("/personas-roles?")) {
                return responder({ items: [rolEmpleado] });
            }

            if (recurso.includes("/personas?")) {
                return responder({ items: [perfilFicticio] });
            }

            return responder({ items: [] });
        });

        host = document.createElement("login-view");
        document.body.appendChild(host);
        await esperar();
    });

    teardown(() => {
        navigateStub?.restore();
        fetchStub?.restore();
        host?.remove();
        authService.sesion = null;

        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
        }

        store.setState({
            online: true,
            token: null,
            usuario: null,
            roles: [],
            rolSeleccionado: null,
            clinicaActiva: null
        });
    });

    test("registra el componente y renderiza el formulario de acceso", () => {
        expect(customElements.get("login-view")).to.equal(LoginView);
        assert.instanceOf(host, LoginView);
        assert.isNotNull(host.shadowRoot);
        assert.isNotNull(host.shadowRoot.querySelector("form"));
        assert.isNotNull(obtenerBuscador());
        assert.isNotNull(host.shadowRoot.querySelector("#numero-documento"));
        assert.isNotNull(host.shadowRoot.querySelector("#btn-iniciar-sesion"));
    });

    test("muestra error y no autentica cuando falta el tipo de documento", () => {
        const buscador = obtenerBuscador();
        const select = buscador.shadowRoot.querySelector("select");
        const input = host.shadowRoot.querySelector("#numero-documento");

        select.value = "";
        input.value = "01234567-8";
        fetchStub.resetHistory();

        enviarFormulario();

        expect(host.shadowRoot.querySelector("#tipo-documento-error").textContent)
            .to.equal("Seleccione un tipo de documento.");
        expect(host.shadowRoot.querySelector("#numero-documento-error").textContent)
            .to.equal("");
        expect(fetchStub.called).to.be.false;
        expect(navigateStub.called).to.be.false;
    });

    test("muestra error y no autentica cuando falta el número de documento", () => {
        const input = host.shadowRoot.querySelector("#numero-documento");

        input.value = "";
        fetchStub.resetHistory();

        enviarFormulario();

        expect(host.shadowRoot.querySelector("#tipo-documento-error").textContent)
            .to.equal("");
        expect(host.shadowRoot.querySelector("#numero-documento-error").textContent)
            .to.equal("Ingrese el número de documento.");
        expect(input.classList.contains("invalido")).to.be.true;
        expect(input.getAttribute("aria-invalid")).to.equal("true");
        expect(fetchStub.called).to.be.false;
        expect(navigateStub.called).to.be.false;
    });

    test("autentica, persiste la sesión, sincroniza el store y navega al dashboard", async () => {
        const buscador = obtenerBuscador();
        const input = host.shadowRoot.querySelector("#numero-documento");

        expect(buscador.value).to.equal("1");
        input.value = "01234567-8";
        fetchStub.resetHistory();

        enviarFormulario();
        await esperar(60);

        const llamadaLogin = fetchStub.getCalls().find((llamada) => (
            String(llamada.args[0]).includes("/personas?")
        ));
        const llamadaRoles = fetchStub.getCalls().find((llamada) => (
            String(llamada.args[0]).includes("/personas-roles?")
        ));
        const sesionGuardada = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY));

        assert.isDefined(llamadaLogin);
        assert.isDefined(llamadaRoles);
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
        expect(host.sesion.perfil.idPersona).to.equal(42);

        const urlLogin = new URL(llamadaLogin.args[0]);
        expect(urlLogin.searchParams.get("tipoDocumentoId")).to.equal("1");
        expect(urlLogin.searchParams.get("idTipoDocumento")).to.equal("1");
        expect(urlLogin.searchParams.get("numeroDocumento")).to.equal("01234567-8");

        expect(sesionGuardada.token).to.equal("jwt-login");
        expect(sesionGuardada.perfil.idPersona).to.equal(42);
        expect(sesionGuardada.roles).to.have.length(1);

        expect(store.state.token).to.equal("jwt-login");
        expect(store.state.usuario.idPersona).to.equal(42);
        expect(store.state.roles).to.have.length(1);
        expect(store.state.rolSeleccionado).to.deep.equal(rolEmpleado);
        expect(store.state.clinicaActiva.idClinica).to.equal(3);

        expect(input.value).to.equal("");
        expect(buscador.value).to.equal("");
        expect(host.cargando).to.be.false;
        expect(host.shadowRoot.querySelector("#btn-iniciar-sesion").disabled).to.be.false;
    });
});
