import "../../src/js/boundary/componentes/menu_lateral.js";
import { authService } from "../../src/js/control/auth_service.js";
import { store } from "../../src/js/store.js";
import { Router } from "../../src/js/router.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("MenuLateral: ruta activa", () => {
    let host;
    let urlAnterior;
    const cambiarRuta = (hash) => {
        window.history.replaceState(null, "", hash || window.location.pathname);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
    };
    const activo = () => host.shadowRoot.querySelector("a.activo");

    setup(() => {
        urlAnterior = window.location.href;
        authService.logout();
        cambiarRuta("#buscar-citas");
        host = document.createElement("menu-lateral");
        document.body.appendChild(host);
    });

    teardown(() => {
        host.remove();
        sinon.restore();
        authService.logout();
        window.history.replaceState(null, "", urlAnterior);
    });

    test("mueve la selección entre buscar citas, dashboard y login sin remontar", () => {
        const enlaceBusqueda = activo();
        expect(enlaceBusqueda.hash).to.equal("#buscar-citas");
        for (const ruta of ["dashboard", "login", "buscar-citas"]) {
            cambiarRuta(`#${ruta}`);
            expect(activo().hash).to.equal(`#${ruta}`);
            expect(activo().getAttribute("aria-current")).to.equal("page");
            expect(host.shadowRoot.querySelectorAll("a.activo")).to.have.length(1);
            expect(host.shadowRoot.querySelectorAll('[aria-current="page"]')).to.have.length(1);
        }
        expect(activo()).to.equal(enlaceBusqueda);
    });

    test("marca Atención Médica al navegar a una consulta concreta", () => {
        cambiarRuta("#atencion/42");
        expect(activo().hash).to.equal("#atencion");
    });

    test("selecciona buscar citas cuando no hay hash", () => {
        cambiarRuta("");
        expect(activo().hash).to.equal("#buscar-citas");
    });

    test("retira el listener de navegación al desmontarse", () => {
        const actualizar = sinon.spy(host, "_actualizarRutaActiva");
        host.remove();
        cambiarRuta("#dashboard");
        expect(actualizar.called).to.be.false;
    });

    test("el acceso de sesión cambia de iniciar a cerrar y cierra antes de navegar al login", () => {
        const enlace = host.shadowRoot.querySelector('a[href="#login"]');
        expect(enlace.textContent).to.equal("Iniciar sesión");
        store.setState({ usuario: { id: 42 }, clinicaActiva: { id: 3 } });
        expect(enlace.textContent).to.equal("Cerrar sesión");
        const router = new Router({ container: document.createElement("main") });
        sinon.stub(router, "render");
        host.addEventListener("navegar", (evento) => router.navigate(evento.detail));
        enlace.click();
        expect(store.hasActiveSession()).to.be.false;
        expect(window.location.hash).to.equal("#login");
        expect(router.render.calledOnceWithExactly("login")).to.be.true;
        expect(enlace.textContent).to.equal("Iniciar sesión");
    });

    test("actualiza la selección al hacer clic en los enlaces de navegación", async () => {
        store.setState({ usuario: { id: 42 }, clinicaActiva: { id: 3 } });
        for (const ruta of ["dashboard", "atencion", "buscar-citas"]) {
            const cambio = new Promise((resolve) => window.addEventListener("hashchange", resolve, { once: true }));
            host.shadowRoot.querySelector(`a[href="#${ruta}"]`).click();
            await cambio;
            expect(activo().hash).to.equal(`#${ruta}`);
            expect(host.shadowRoot.querySelectorAll("a.activo")).to.have.length(1);
        }
    });
});
