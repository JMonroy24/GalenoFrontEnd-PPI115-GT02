import "../../src/js/boundary/componentes/menu_lateral.js";
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
        cambiarRuta("#buscar-citas");
        host = document.createElement("menu-lateral");
        document.body.appendChild(host);
    });

    teardown(() => {
        host.remove();
        sinon.restore();
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
});
