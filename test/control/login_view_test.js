import { LoginView } from "../../src/js/boundary/vistas/login_view.js";
import { authService, SESSION_STORAGE_KEY } from "../../src/js/control/auth_service.js";
import store from "../../src/js/store.js";
import * as routerModule from "../../src/js/router.js";
import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("LoginView (unitaria)", () => {
    let host;
    let fetchStub;
    let navigateStub;
    let mensajeSpy;

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
        mensajeSpy = sinon.spy(GeneradorMensajes, "crearMensaje");

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
        host?.remove();
        navigateStub?.restore();
        fetchStub?.restore();
        mensajeSpy?.restore();
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
        navigateStub.callsFake((hash) => {
            expect(hash).to.equal("#dashboard");
            expect(store.isAuthenticated()).to.be.true;
            expect(routerModule.router.canNavigate(hash)).to.be.true;
            expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)).clinicaActiva.idClinica).to.equal(3);
        });

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
        expect(navigateStub.calledOnce).to.be.true;
        expect(host.sesion.perfil.idPersona).to.equal(42);

        const urlLogin = new URL(llamadaLogin.args[0]);
        expect(urlLogin.searchParams.get("tipoDocumentoId")).to.equal("1");
        expect(urlLogin.searchParams.get("valor")).to.equal("01234567-8");
        expect(urlLogin.searchParams.has("idTipoDocumento")).to.be.false;
        expect(urlLogin.searchParams.has("numeroDocumento")).to.be.false;

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

    test("lee el select y el input actuales al enviar, incluso sin eventos change o input", async () => {
        const select = obtenerBuscador().shadowRoot.querySelector("select");
        const opcion = document.createElement("option");
        opcion.value = "tipo-pasaporte";
        opcion.textContent = "Pasaporte";
        select.appendChild(opcion);
        select.value = "tipo-pasaporte";
        host.shadowRoot.querySelector("#numero-documento").value = " PAS-987&6 ";
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas?")))
            .resolves(responder({ items: [{ ...perfilFicticio,
                tipoDocumentoId: "tipo-pasaporte", numeroDocumento: "PAS-987&6" }] }));
        fetchStub.resetHistory();

        enviarFormulario();
        await esperar(60);

        const llamada = fetchStub.getCalls().find((item) => String(item.args[0]).includes("/personas?"));
        expect(Object.fromEntries(new URL(llamada.args[0]).searchParams)).to.deep.equal({
            tipoDocumentoId: "tipo-pasaporte", valor: "PAS-987&6"
        });
        expect(navigateStub.calledOnceWith("#dashboard")).to.be.true;
    });

    test("no navega ni crea una sesión si el backend devuelve items sin roles", async () => {
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas-roles?")))
            .resolves(responder({ items: [] }));
        host.shadowRoot.querySelector("#numero-documento").value = "01234567-8";

        enviarFormulario();
        await esperar(60);

        expect(navigateStub.called).to.be.false;
        expect(store.isAuthenticated()).to.be.false;
        expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;
        expect(host.sesion).to.be.null;
        expect(host.cargando).to.be.false;
    });

    test("ignora envíos duplicados mientras se autentica", async () => {
        host.shadowRoot.querySelector("#numero-documento").value = "01234567-8";
        fetchStub.resetHistory();
        let resolver;
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas?")))
            .returns(new Promise((resolve) => { resolver = resolve; }));

        const pendiente = host._iniciarSesion();
        const boton = host.shadowRoot.querySelector("#btn-iniciar-sesion");
        expect(host.cargando).to.be.true;
        expect(boton.disabled).to.be.true;
        expect(boton.getAttribute("aria-busy")).to.equal("true");
        await host._iniciarSesion();
        resolver(responder({ items: [perfilFicticio] }));
        await pendiente;

        const llamadasPersonas = fetchStub.getCalls().filter((llamada) => (
            String(llamada.args[0]).includes("/personas?")
        ));
        expect(llamadasPersonas).to.have.length(1);
        expect(navigateStub.calledOnceWith("#dashboard")).to.be.true;
        expect(boton.disabled).to.be.false;
        expect(boton.getAttribute("aria-busy")).to.equal("false");
    });

    test("un error HTTP conserva los datos y permite reintentar sin crear una sesión", async () => {
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas?")))
            .resolves({ ...responder({ message: "Servidor no disponible" }), ok: false, status: 500 });
        const input = host.shadowRoot.querySelector("#numero-documento");
        input.value = "01234567-8";

        await host._iniciarSesion();

        expect(mensajeSpy.calledWith("Error al iniciar sesión", "Servidor no disponible", "error")).to.be.true;
        expect(host.sesion).to.be.null;
        expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).to.be.null;
        expect(navigateStub.called).to.be.false;
        expect(input.value).to.equal("01234567-8");
        expect(host.cargando).to.be.false;
        expect(host.shadowRoot.querySelector("#btn-iniciar-sesion").disabled).to.be.false;
    });

    test("emite la notificación global de error al fallar la autenticación", async () => {
        mensajeSpy.restore();

        const notificaciones = [];
        const oyente = (evento) => notificaciones.push(evento.detail);
        window.addEventListener("notificacion", oyente);

        try {
            fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas?")))
                .resolves({ ...responder({ message: "Servidor no disponible" }), ok: false, status: 500 });
            host.shadowRoot.querySelector("#numero-documento").value = "01234567-8";

            await host._iniciarSesion();

            expect(notificaciones).to.have.length(1);
            expect(notificaciones[0]).to.include({
                titulo: "Error al iniciar sesión",
                detalle: "Servidor no disponible",
                tipo: "error"
            });
            expect(navigateStub.called).to.be.false;
        } finally {
            window.removeEventListener("notificacion", oyente);
            mensajeSpy = sinon.spy(GeneradorMensajes, "crearMensaje");
        }
    });

    test("una persona inexistente no consulta roles ni navega", async () => {
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas?")))
            .resolves(responder({ items: [] }));
        host.shadowRoot.querySelector("#numero-documento").value = "01234567-8";
        fetchStub.resetHistory();

        await host._iniciarSesion();

        expect(fetchStub.getCalls().some((llamada) => String(llamada.args[0]).includes("/personas-roles?"))).to.be.false;
        expect(mensajeSpy.calledWith("Error al iniciar sesión", "Usuario no encontrado", "error")).to.be.true;
        expect(navigateStub.called).to.be.false;
        expect(store.isAuthenticated()).to.be.false;
    });

    test("acepta los roles que el backend devuelve sin reclasificar sus atributos", async () => {
        fetchStub.withArgs(sinon.match((url) => String(url).includes("/personas-roles?")))
            .resolves(responder({ items: [{ ...rolEmpleado, activo: false }] }));
        host.shadowRoot.querySelector("#numero-documento").value = "01234567-8";

        await host._iniciarSesion();

        expect(navigateStub.calledOnceWith("#dashboard")).to.be.true;
        expect(host.sesion.roles).to.deep.equal([{ ...rolEmpleado, activo: false }]);
        expect(store.isAuthenticated()).to.be.true;
    });

    test("limpia los errores de validación al corregir los campos sin llamar al backend", async () => {
        const buscador = obtenerBuscador();
        buscador.shadowRoot.querySelector("select").value = "";
        fetchStub.resetHistory();
        await host._iniciarSesion();

        const input = host.shadowRoot.querySelector("#numero-documento");
        expect(input.getAttribute("aria-invalid")).to.equal("true");
        input.value = "01234567-8";
        input.dispatchEvent(new Event("input"));
        const select = buscador.shadowRoot.querySelector("select");
        select.value = "1";
        select.dispatchEvent(new Event("change"));

        expect(input.getAttribute("aria-invalid")).to.equal("false");
        expect(input.classList.contains("invalido")).to.be.false;
        expect(host.shadowRoot.querySelector("#tipo-documento-error").textContent).to.equal("");
        expect(host.shadowRoot.querySelector("#numero-documento-error").textContent).to.equal("");
        expect(fetchStub.called).to.be.false;
    });
});
