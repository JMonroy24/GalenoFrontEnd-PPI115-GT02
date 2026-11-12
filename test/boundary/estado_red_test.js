import { EstadoRed } from "../../src/js/boundary/componentes/estado_red.js";
import { store } from "../../src/js/store.js";
import { expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("EstadoRed (unitaria)", () => {
    let host;
    let onlineOriginal;

    const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms));
    const banner = () => host.shadowRoot.querySelector("#banner");
    const texto = () => host.shadowRoot.querySelector("#texto").textContent;

    setup(() => {
        onlineOriginal = store.state.online;
        store.setState({ online: true });
        host = document.createElement("estado-red");
        host.duracionMensajeMs = 10;
        document.body.appendChild(host);
    });

    teardown(() => {
        host?.remove();
        store.setState({ online: onlineOriginal });
    });

    test("con conexión el aviso permanece oculto", () => {
        expect(banner().hidden).to.be.true;
    });

    test("al perder la conexión muestra el aviso de modo offline", () => {
        store.setState({ online: false });

        expect(banner().hidden).to.be.false;
        expect(banner().dataset.modo).to.equal("offline");
        expect(texto()).to.contain("Sin conexión");
    });

    test("es accesible: role=status y aria-live=polite", () => {
        expect(banner().getAttribute("role")).to.equal("status");
        expect(banner().getAttribute("aria-live")).to.equal("polite");
    });

    test("al reconectar avisa y luego se oculta solo", async () => {
        store.setState({ online: false });
        store.setState({ online: true });

        expect(banner().dataset.modo).to.equal("online");
        expect(texto()).to.contain("Conexión restablecida");

        await esperar(40);
        expect(banner().hidden).to.be.true;
    });

    test("si ya nace offline lo muestra de inmediato", () => {
        host.remove();
        store.setState({ online: false });
        host = document.createElement("estado-red");
        document.body.appendChild(host);

        expect(banner().dataset.modo).to.equal("offline");
    });

    test("deja de escuchar el store al desconectarse del DOM", () => {
        host.remove();
        store.setState({ online: false });

        expect(banner().hidden).to.be.true;
    });
});
