import { ListaExamenesAsignables } from "../../src/js/boundary/componentes/lista_examenes.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("ListaExamenesAsignables (unitaria)", () => {
    let host;
    let tipoStub;
    let ordenStub;

    const examenes = [
        { idTipoExamen: 1, nombre: "Hemograma", categoria: "Laboratorio" },
        { idTipoExamen: 2, nombre: "Glucosa", categoria: "Laboratorio" },
        { idTipoExamen: 3, nombre: "Rayos X de tórax", categoria: "Imagenología" },
        { idTipoExamen: 4, nombre: "Examen retirado", categoria: "Laboratorio", activo: false }
    ];

    const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms));
    const marcar = (valor) => {
        const input = host.shadowRoot.querySelector(`input[value="${valor}"]`);
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    setup(async () => {
        tipoStub = { findRange: sinon.stub().resolves({ items: examenes }) };
        ordenStub = { crearOrdenes: sinon.stub().resolves([{}, {}]) };

        host = document.createElement("lista-examenes-asignables");
        host.tipoExamenService = tipoStub;
        host.ordenExamenService = ordenStub;
        host.idConsulta = "c-1";
        document.body.appendChild(host);
        await esperar();
    });

    teardown(() => host?.remove());

    test("lista solo los exámenes activos", () => {
        const inputs = host.shadowRoot.querySelectorAll("input[type=checkbox]");
        expect(inputs).to.have.length(3);
    });

    test("filtra por categoría", async () => {
        const select = host.shadowRoot.querySelector("#filtro-categoria");
        select.value = "Imagenología";
        select.dispatchEvent(new Event("change"));

        const inputs = host.shadowRoot.querySelectorAll("input[type=checkbox]");
        expect(inputs).to.have.length(1);
        expect(inputs[0].value).to.equal("3");
    });

    test("el botón está deshabilitado sin selección y se habilita al marcar", () => {
        const boton = host.shadowRoot.querySelector("#btn-asignar");
        expect(boton.disabled).to.be.true;

        marcar("1");
        expect(boton.disabled).to.be.false;
        expect(host.shadowRoot.querySelector("#contador").textContent)
            .to.equal("1 examen seleccionado");
    });

    test("asigna los seleccionados y emite ordenes-asignadas", async () => {
        let detalle = null;
        host.addEventListener("ordenes-asignadas", (e) => { detalle = e.detail; });

        marcar("1");
        marcar("3");
        host.shadowRoot.querySelector("#btn-asignar").click();
        await esperar();

        assert.isTrue(ordenStub.crearOrdenes.calledOnceWith("c-1", ["1", "3"]));
        expect(detalle.examenes).to.deep.equal(["1", "3"]);
        expect(host.obtenerSeleccionados()).to.have.length(0);
    });

    test("si el backend falla (422) emite notificación de error y conserva la selección", async () => {
        ordenStub.crearOrdenes.rejects({ status: 422, message: "Orden inválida" });
        const mensajes = [];
        const oyente = (e) => mensajes.push(e.detail);
        window.addEventListener("notificacion", oyente);

        marcar("2");
        host.shadowRoot.querySelector("#btn-asignar").click();
        await esperar();
        window.removeEventListener("notificacion", oyente);

        expect(mensajes.some((m) => m.tipo === "error")).to.be.true;
        expect(host.obtenerSeleccionados()).to.deep.equal(["2"]);
    });

    test("si falla la carga de exámenes muestra estado de error", async () => {
        host.remove();
        tipoStub.findRange.rejects(new Error("sin red"));
        host = document.createElement("lista-examenes-asignables");
        host.tipoExamenService = tipoStub;
        host.ordenExamenService = ordenStub;
        document.body.appendChild(host);
        await esperar();

        expect(host.shadowRoot.querySelector("#estado").textContent)
            .to.contain("No se pudieron cargar");
    });
});
