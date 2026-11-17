import { Router } from "../../src/js/router.js";
import store, { Store } from "../../src/js/store.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Router: rutas de empleados", () => {
    let rutaAnterior;
    let router;
    const empleado = {
        usuario: { idPersona: 42 }, token: "token",
        roles: [{ idClinica: "central", rol: { idRol: "medico", nombre: "Médico" } }],
        clinicaActiva: { idClinica: "central" }
    };
    const limpiar = () => store.setState({
        usuario: null, token: null, roles: [], clinicaActiva: null, rolSeleccionado: null
    });

    setup(() => {
        rutaAnterior = window.location.hash;
        limpiar();
        router = new Router({ container: document.createElement("main") });
        sinon.stub(router, "render");
    });

    teardown(() => {
        limpiar();
        window.history.replaceState(null, "", window.location.pathname + window.location.search + rutaAnterior);
        sinon.restore();
    });

    for (const ruta of ["#dashboard", "#atencion", "#atencion/42"]) {
        test(`redirige a login al abrir directamente ${ruta} sin sesión`, () => {
            window.history.replaceState(null, "", ruta);
            expect(router.resolve()).to.equal("login");
            expect(window.location.hash).to.equal("#login");
            expect(router.render.calledOnceWithExactly("login")).to.be.true;
        });
    }

    test("permite una sesión sin token, roles ni marcador auxiliar", () => {
        store.setState({ usuario: empleado.usuario, clinica: empleado.clinicaActiva });
        sessionStorage.removeItem("usuarioActivo");
        expect(store.isAuthenticated()).to.be.true;
        expect(router.navigate("#dashboard")).to.equal("dashboard");
    });

    test("un marcador aislado y un token no autorizan el dashboard", () => {
        store.setState({ token: "token-antiguo" });
        sessionStorage.setItem("usuarioActivo", "{}");
        expect(router.navigate("#dashboard")).to.equal("login");
    });

    for (const campo of ["usuario", "clinicaActiva"]) {
        test(`rechaza una sesión sin ${campo} aunque tenga token y marcador`, () => {
            store.setState({ ...empleado, [campo]: null });
            sessionStorage.setItem("usuarioActivo", JSON.stringify(empleado.usuario));
            expect(router.navigate("#dashboard")).to.equal("login");
        });
    }

    test("rehidrata usuario y clínica sin token tras una recarga", () => {
        store.setState({ usuario: empleado.usuario, clinica: empleado.clinicaActiva });
        const restaurado = new Store();
        expect(restaurado.state.token).to.be.null;
        expect(restaurado.state.usuario).to.deep.equal(empleado.usuario);
        expect(restaurado.state.clinica).to.deep.equal(empleado.clinicaActiva);
        expect(restaurado.hasActiveSession()).to.be.true;
    });

    for (const hash of ["#login", "", "#/"]) {
        for (const metodo of ["resolve", "navigate"]) {
            test(`${metodo} lleva ${hash || "la raíz"} al dashboard con sesión activa`, () => {
                store.setState({ ...empleado, token: null });
                window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
                const ruta = metodo === "resolve" ? router.resolve() : router.navigate(hash);
                expect(ruta).to.equal("dashboard");
                expect(window.location.hash).to.equal("#dashboard");
                expect(router.render.calledOnceWithExactly("dashboard")).to.be.true;
            });
        }
    }

    test("mantiene la ruta pública predeterminada al abrir la raíz sin sesión", () => {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        expect(router.resolve()).to.equal("buscar-citas");
        expect(window.location.hash).to.equal("#buscar-citas");
    });

    test("permite dashboard y atención a un empleado y conserva el ID de consulta", () => {
        store.setState(empleado);
        expect(router.navigate("#dashboard")).to.equal("dashboard");
        expect(router.navigate("#atencion/42")).to.equal("atencion");
        expect(window.location.hash).to.equal("#atencion/42");
    });

    test("permite las rutas públicas sin sesión", () => {
        expect(router.canNavigate("#login")).to.be.true;
        expect(router.canNavigate("#buscar-citas")).to.be.true;
    });
});
