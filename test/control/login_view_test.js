import { LoginView } from "../../src/js/boundary/vistas/login_view.js";
import { authService } from "../../src/js/control/auth_service.js";
import * as routerModule from "../../src/js/router.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("LoginView (unitaria HU2)", () => {
    let host;
    let loginStub;
    let navigateStub;

    setup(() => {
        loginStub = sinon.stub(authService, "login").resolves({
            perfil: { idPersona: 1, nombres: "Carlos", apellidos: "López" },
            token: "fake-token-123",
            roles: [{ idPersonaRol: 1, nombreRol: "MEDICO" }]
        });

        navigateStub = sinon.stub(routerModule.router, "navigate");

        host = document.createElement("login-view");
        document.body.appendChild(host);
    });

    teardown(() => {
        loginStub?.restore();
        navigateStub?.restore();
        if (host?.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado como customElement con Shadow DOM open", () => {
        expect(customElements.get("login-view")).to.equal(LoginView);
        assert.instanceOf(host, LoginView);
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza formulario con buscador de tipo de documento y campo de número", () => {
        const shadow = host.shadowRoot;
        const form = shadow.querySelector("form");
        const buscadorTipo = shadow.querySelector("#tipo-documento");
        const inputNumero = shadow.querySelector("#numero-documento");
        const botonLogin = shadow.querySelector("#btn-iniciar-sesion");

        assert.isNotNull(form, "Debe existir <form>");
        assert.isNotNull(buscadorTipo, "Debe existir buscador de tipo de documento");
        assert.isNotNull(inputNumero, "Debe existir input de número de documento");
        assert.isNotNull(botonLogin, "Debe existir botón de iniciar sesión");
        expect(botonLogin.type).to.equal("submit");
    });

    test("valida campos requeridos y muestra error si están vacíos al enviar", async () => {
        const shadow = host.shadowRoot;
        const form = shadow.querySelector("form");
        const inputNumero = shadow.querySelector("#numero-documento");

        inputNumero.value = "";

        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 20));

        expect(loginStub.called).to.be.false;
        const errorTipo = shadow.querySelector("#tipo-documento-error");
        const errorNumero = shadow.querySelector("#numero-documento-error");

        expect(errorTipo.textContent.trim()).to.contain("Seleccione un tipo de documento");
        expect(errorNumero.textContent.trim()).to.contain("Ingrese el número de documento");
    });

    test("al ingresar credenciales válidas llama a authService.login y navega a #dashboard", async () => {
        const shadow = host.shadowRoot;
        const buscador = shadow.querySelector("buscador-tipo-documentos");
        const inputNumero = shadow.querySelector("#numero-documento");
        const form = shadow.querySelector("form");

        // Simula selección de tipo y número
        if (buscador) {
            buscador.value = "1";
        }
        inputNumero.value = "01234567-8";

        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 50));

        expect(loginStub.calledOnce).to.be.true;
        expect(loginStub.firstCall.args[0]).to.equal("1");
        expect(loginStub.firstCall.args[1]).to.equal("01234567-8");
        expect(navigateStub.calledWith("#dashboard")).to.be.true;
    });

    test("muestra error y no navega si authService.login rechaza", async () => {
        loginStub.rejects(new Error("Credenciales inválidas"));

        const shadow = host.shadowRoot;
        const buscador = shadow.querySelector("buscador-tipo-documentos");
        const inputNumero = shadow.querySelector("#numero-documento");
        const form = shadow.querySelector("form");

        if (buscador) {
            buscador.value = "1";
        }
        inputNumero.value = "00000000-0";

        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 50));

        expect(loginStub.calledOnce).to.be.true;
        expect(navigateStub.called).to.be.false;
    });
});

