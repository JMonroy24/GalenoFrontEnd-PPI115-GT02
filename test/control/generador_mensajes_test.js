import GeneradorMensajes from "../../src/js/control/generador_mensajes.js";
import "../../src/js/boundary/componentes/notificacion_emergente.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

class EmisorShadow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }
}

if (!customElements.get("emisor-shadow-notificaciones")) {
    customElements.define("emisor-shadow-notificaciones", EmisorShadow);
}

suite("GeneradorMensajes", () => {
    let notificacion;

    setup(() => {
        notificacion = document.createElement("notificacion-emergente");
        document.body.appendChild(notificacion);
    });

    teardown(() => {
        notificacion?.remove();
    });

    test("dispara un CustomEvent notificacion con bubbles y composed en true", () => {
        const evento = GeneradorMensajes.crearMensaje("Título", "Detalle", "success", 1500);

        assert.instanceOf(evento, CustomEvent);
        expect(evento.type).to.equal("notificacion");
        expect(evento.bubbles).to.be.true;
        expect(evento.composed).to.be.true;
    });

    test("incluye el mensaje, el tipo/nivel y la duración en detail", () => {
        const evento = GeneradorMensajes.crearMensaje("Guardado", "Todo correcto", "success", 1500);

        expect(evento.detail).to.deep.equal({
            titulo: "Guardado",
            mensaje: "Guardado",
            detalle: "Todo correcto",
            tipo: "success",
            nivel: "success",
            duracion: 1500
        });
    });

    test("acepta la duración en un objeto y usa 5000 para valores inválidos", () => {
        const conObjeto = GeneradorMensajes.crearMensaje("A", null, "info", { duracion: 2500 });
        const invalida = GeneradorMensajes.crearMensaje("B", null, "info", "no-numero");

        expect(conObjeto.detail.duracion).to.equal(2500);
        expect(invalida.detail.duracion).to.equal(5000);
    });

    test("renderiza el toast desde un evento disparado dentro de Shadow DOM", () => {
        const emisor = document.createElement("emisor-shadow-notificaciones");
        document.body.appendChild(emisor);

        const boton = document.createElement("button");
        emisor.shadowRoot.appendChild(boton);

        const evento = new CustomEvent("notificacion", {
            bubbles: true,
            composed: true,
            detail: {
                titulo: "Desde shadow",
                detalle: "Componente hijo",
                tipo: "success",
                nivel: "success",
                duracion: 100000
            }
        });
        boton.dispatchEvent(evento);

        const banner = notificacion.shadowRoot.querySelector(".banner.success");
        expect(banner).to.exist;
        expect(banner.textContent).to.contain("Desde shadow");
        expect(banner.textContent).to.contain("Componente hijo");

        emisor.remove();
    });

    test("respeta la duración configurada para retirar el toast", () => {
        const reloj = sinon.useFakeTimers();

        try {
            GeneradorMensajes.crearMensaje("Temporal", null, "info", 1200);

            expect(notificacion.shadowRoot.querySelector(".banner")).to.exist;
            reloj.tick(1199);
            expect(notificacion.shadowRoot.querySelector(".banner")).to.exist;
            reloj.tick(1);
            expect(notificacion.shadowRoot.querySelector(".banner")).to.be.null;
        } finally {
            reloj.restore();
        }
    });
});
