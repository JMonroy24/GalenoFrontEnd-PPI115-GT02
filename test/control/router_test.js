import { Router } from "../../src/js/router.js";
import store from "../../src/js/store.js";
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

    test("exige usuarioActivo incluso cuando el store conserva un empleado", () => {
        store.setState(empleado);
        sessionStorage.removeItem("usuarioActivo");
        expect(router.navigate("#dashboard")).to.equal("login");
    });

    test("un marcador aislado y un token no autorizan el dashboard", () => {
        store.setState({ token: "token-antiguo" });
        sessionStorage.setItem("usuarioActivo", "{}");
        expect(router.navigate("#dashboard")).to.equal("login");
    });

    test("una sesión Paciente no permite acceder aunque tenga marcador", () => {
        store.setState({ ...empleado, roles: [{ rol: { nombre: "Paciente" } }] });
        sessionStorage.setItem("usuarioActivo", JSON.stringify(empleado.usuario));
        expect(router.navigate("#dashboard")).to.equal("login");
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
