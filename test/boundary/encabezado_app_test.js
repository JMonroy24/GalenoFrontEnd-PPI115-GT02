import EncabezadoApp from "../../src/js/boundary/componentes/encabezado_app.js";
import { authService } from "../../src/js/control/auth_service.js";
import store from "../../src/js/store.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("EncabezadoApp: sesión y contexto", () => {
    let host;
    const usuario = { idPersona: 42, nombres: ["Ana", "María"], apellidos: ["López", "Pérez"] };
    const asignacion = { idPersonaRol: 1, clinica: { idClinica: 3, nombre: "Central" },
        rol: { idRol: 2, nombre: "Médico" } };
    const montar = () => {
        host = document.createElement("encabezado-app");
        document.body.appendChild(host);
    };
    const texto = () => host.shadowRoot.querySelector("#textoContexto").textContent;

    setup(() => {
        authService.logout();
        sessionStorage.removeItem("contexto");
        montar();
    });

    teardown(() => {
        host?.remove();
        sinon.restore();
        authService.logout();
        sessionStorage.removeItem("contexto");
    });

    test("muestra Sin sesión cuando no existe usuario activo", () => {
        expect(host).to.be.instanceOf(EncabezadoApp);
        expect(texto()).to.equal("Sin sesión");
    });

    test("lee el usuario guardado al montar el encabezado después de una recarga", () => {
        host.remove();
        sessionStorage.setItem("usuarioActivo", JSON.stringify(usuario));
        montar();
        expect(texto()).to.equal("Ana María López Pérez");
    });

    test("el login emite sesion-iniciada después de guardar el usuario y actualiza el encabezado", async () => {
        const instalador = host.shadowRoot.querySelector("instalador-app");
        const alIniciar = sinon.spy(() => {
            expect(JSON.parse(sessionStorage.getItem("usuarioActivo"))).to.deep.equal(usuario);
        });
        window.addEventListener("sesion-iniciada", alIniciar);
        sinon.stub(window, "fetch").callsFake(async (url) => ({
            ok: true, json: async () => ({ items: String(url).includes("/personas-roles?")
                ? [asignacion] : [usuario] })
        }));
        try {
            await authService.login(1, "01234567-8");
            expect(alIniciar.calledOnce).to.be.true;
            expect(alIniciar.firstCall.args[0].detail.usuario).to.deep.equal(usuario);
            expect(texto()).to.equal("Ana María López Pérez / Central / Médico");
            expect(host.shadowRoot.querySelector("instalador-app")).to.equal(instalador);
        } finally {
            window.removeEventListener("sesion-iniciada", alIniciar);
        }
    });

    test("escucha el evento de sesión y los cambios posteriores de clínica y rol", () => {
        sessionStorage.setItem("usuarioActivo", JSON.stringify(usuario));
        window.dispatchEvent(new CustomEvent("sesion-iniciada"));
        expect(texto()).to.equal("Ana María López Pérez");
        store.setState({ usuario, roles: [asignacion], clinicaActiva: asignacion.clinica,
            rolSeleccionado: asignacion });
        store.setContextoTrabajo({ idClinica: 4, nombreClinica: "Norte" },
            { idRol: 5, nombre: "Enfermería" });
        expect(texto()).to.equal("Ana María López Pérez / Norte / Enfermería");
    });

    test("al cerrar sesión vuelve a Sin sesión y limpia usuarioActivo", () => {
        store.setState({ usuario, roles: [asignacion], clinicaActiva: asignacion.clinica,
            rolSeleccionado: asignacion });
        host.shadowRoot.querySelector("#btnCerrarSesion").click();
        expect(sessionStorage.getItem("usuarioActivo")).to.be.null;
        expect(texto()).to.equal("Sin sesión");
    });

    test("retira los listeners al desconectarse", () => {
        const actualizar = sinon.spy(host, "_actualizarSesion");
        host.remove();
        window.dispatchEvent(new CustomEvent("sesion-iniciada"));
        window.dispatchEvent(new CustomEvent("sesion-cerrada"));
        store.setState({ online: true });
        expect(actualizar.called).to.be.false;
    });
});
