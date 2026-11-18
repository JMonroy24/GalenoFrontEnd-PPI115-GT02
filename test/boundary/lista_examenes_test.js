import { ListaExamenesAsignables } from "../../src/js/boundary/componentes/lista_examenes.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("ListaExamenesAsignables (unitaria)", () => {
    let host;
    let listarStub;
    let crearStub;

    const examenes = [
        { idExamen: 1, nombre: "Hemograma", categoria: "Laboratorio", indicaciones: "Ayuno" },
        { idExamen: 2, nombre: "Glucosa", categoria: "Laboratorio" },
        { idExamen: 3, nombre: "Rayos X de tórax", categoria: "Imagenología" },
        { idExamen: 4, nombre: "Examen retirado", categoria: "Laboratorio", activo: false }
    ];

    const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms));
    const marcar = (valor) => {
        const input = host.shadowRoot.querySelector(`input[value="${valor}"]`);
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    setup(async () => {
        listarStub = sinon.stub().resolves(examenes);
        crearStub = sinon.stub().resolves([{}, {}]);

        host = document.createElement("lista-examenes-asignables");
        host.ordenExamenService = {
            listarExamenesPorPaso: listarStub,
            crearOrdenes: crearStub
        };
        host.idConsulta = "c-1";
        host.idPaso = "p-9";
        document.body.appendChild(host);
        await esperar();
    });

    teardown(() => host?.remove());

    test("carga los exámenes asignables al paso activo", () => {
        expect(listarStub.calledOnceWith("p-9")).to.be.true;
    });

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

    test("asigna los seleccionados al paso y emite ordenes-asignadas", async () => {
        let detalle = null;
        host.addEventListener("ordenes-asignadas", (e) => { detalle = e.detail; });

        marcar("1");
        marcar("3");
        host.shadowRoot.querySelector("#btn-asignar").click();
        await esperar();

        expect(crearStub.calledOnce).to.be.true;
        expect(crearStub.firstCall.args[0]).to.equal("p-9");
        expect(crearStub.firstCall.args[1]).to.deep.equal([
            {
                id: "1",
                idExamen: 1,
                nombre: "Hemograma",
                categoria: "Laboratorio",
                indicaciones: "Ayuno"
            },
            {
                id: "3",
                idExamen: 3,
                nombre: "Rayos X de tórax",
                categoria: "Imagenología",
                indicaciones: ""
            }
        ]);
        expect(detalle.idConsulta).to.equal("c-1");
        expect(detalle.idPaso).to.equal("p-9");
        expect(detalle.idConsultaProcedimientoPaso).to.equal("p-9");
        expect(detalle.examenes).to.deep.equal(["1", "3"]);
        expect(host.obtenerSeleccionados()).to.have.length(0);
    });

    test("la respuesta conserva su contexto aunque cambie el paso durante el envío", async () => {
        let resolver;
        crearStub.callsFake(() => new Promise((r) => { resolver = r; }));
        host.idPaso = "p-1";
        await esperar();
        marcar("1");
        let detalle;
        host.addEventListener("ordenes-asignadas", (e) => { detalle = e.detail; });
        const envio = host.asignarSeleccionados();
        host.idPaso = "p-2";
        host.idConsulta = "c-2";
        resolver([{ idOrdenExamen: 90 }]);
        await envio;
        expect(detalle.idConsulta).to.equal("c-1");
        expect(detalle.idPaso).to.equal("p-1");
    });

    test("cambiar de paso limpia la selección, recarga la lista y sin paso no consulta", async () => {
        host.idPaso = "p-2";
        marcar("1");
        await esperar();

        expect(host.obtenerSeleccionados()).to.deep.equal([]);
        expect(listarStub.callCount).to.equal(2);
        expect(listarStub.firstCall.args[0]).to.equal("p-9");
        expect(listarStub.secondCall.args[0]).to.equal("p-2");

        host.paso = null;
        await esperar();

        expect(host.idPaso).to.be.null;
        expect(listarStub.callCount).to.equal(2);
        expect(host.shadowRoot.querySelector("#estado").textContent)
            .to.contain("Seleccione un paso");
    });

    test("si el backend falla (422) emite notificación de error y conserva la selección", async () => {
        crearStub.rejects({ status: 422, message: "Orden inválida" });
        const mensajes = [];
        const oyente = (e) => mensajes.push(e.detail);
        window.addEventListener("notificacion", oyente);

        try {
            marcar("2");
            host.shadowRoot.querySelector("#btn-asignar").click();
            await esperar();
        } finally {
            window.removeEventListener("notificacion", oyente);
        }

        expect(mensajes.some((m) => m.tipo === "error")).to.be.true;
        expect(host.obtenerSeleccionados()).to.deep.equal(["2"]);
    });

    test("si falla la carga de exámenes muestra estado de error", async () => {
        host.remove();
        listarStub.rejects(new Error("sin red"));
        host = document.createElement("lista-examenes-asignables");
        host.ordenExamenService = {
            listarExamenesPorPaso: listarStub,
            crearOrdenes: crearStub
        };
        host.idConsulta = "c-1";
        host.idPaso = "p-9";
        document.body.appendChild(host);
        await esperar();

        expect(host.shadowRoot.querySelector("#estado").textContent)
            .to.contain("No se pudieron cargar");
    });

    test("sin conexión deshabilita la asignación sin perder la selección", () => {
        marcar("1");
        host.sinConexion = true;

        const boton = host.shadowRoot.querySelector("#btn-asignar");
        const aviso = host.shadowRoot.querySelector("#aviso-offline");
        expect(boton.disabled).to.be.true;
        expect(aviso.hidden).to.be.false;
        expect(aviso.textContent).to.contain("Sin conexión");
        expect(host.obtenerSeleccionados()).to.deep.equal(["1"]);
        expect(host.shadowRoot.querySelector('input[value="1"]').checked).to.be.true;
    });

    test("al volver la red se habilita la asignación y conserva la selección", () => {
        marcar("2");
        host.setAttribute("sin-conexion", "");
        host.removeAttribute("sin-conexion");

        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.false;
        expect(host.shadowRoot.querySelector("#aviso-offline").hidden).to.be.true;
        expect(host.obtenerSeleccionados()).to.deep.equal(["2"]);
    });

    test("sin conexión asignarSeleccionados no llama al servicio", async () => {
        marcar("3");
        host.sinConexion = true;

        await host.asignarSeleccionados();

        expect(crearStub.called).to.be.false;
        expect(host.obtenerSeleccionados()).to.deep.equal(["3"]);
    });

    test("registra el custom element y expone Shadow DOM abierto", () => {
        expect(customElements.get("lista-examenes-asignables")).to.equal(ListaExamenesAsignables);
        assert.instanceOf(host, ListaExamenesAsignables);
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza filtro, lista, estado accesible, contador y botón de asignación", () => {
        const raiz = host.shadowRoot;
        assert.isNotNull(raiz.querySelector("section.panel"));
        assert.isNotNull(raiz.querySelector("select#filtro-categoria"));
        assert.isNotNull(raiz.querySelector("fieldset legend"));
        expect(raiz.querySelector("#estado").getAttribute("role")).to.equal("status");
        expect(raiz.querySelector("#btn-asignar").getAttribute("aria-busy")).to.equal("false");
        expect(raiz.querySelector("#contador").textContent).to.contain("0 exámenes seleccionados");
    });

    test("acepta respuesta {items} y normaliza descripción, id y categoría por defecto", async () => {
        listarStub.resolves({ items: [{ id: 7, activo: true }] });
        host.idPaso = "p-7";
        await esperar();

        const input = host.shadowRoot.querySelector('input[value="7"]');
        assert.isNotNull(input);
        expect(input.parentElement.textContent).to.contain("Examen sin nombre");
        expect(input.parentElement.textContent).to.contain("General");
        expect(host.shadowRoot.querySelector("#estado").textContent).to.equal("");
    });

    test("muestra cargando y limpia el estado cuando termina la carga", async () => {
        let resolver;
        listarStub.callsFake(() => new Promise((res) => { resolver = res; }));
        host.idPaso = "p-carga";

        expect(host.shadowRoot.querySelector("#estado").textContent).to.contain("Cargando exámenes");

        resolver(examenes);
        await esperar();
        expect(host.shadowRoot.querySelector("#estado").textContent).to.equal("");
    });

    test("descarta una carga obsoleta si el paso cambia antes de resolver", async () => {
        const pendientes = [];
        listarStub.callsFake(() => new Promise((res) => pendientes.push(res)));

        host.idPaso = "p-viejo";
        host.idPaso = "p-nuevo";
        pendientes[1](examenes);
        await esperar();
        pendientes[0]([{ idExamen: 99, nombre: "Obsoleto" }]);
        await esperar();

        const nombres = [...host.shadowRoot.querySelectorAll(".examen-nombre")]
            .map((nodo) => nodo.textContent);
        expect(nombres).to.contain("Hemograma");
        expect(nombres).to.not.contain("Obsoleto");
    });

    test("pinta categorías únicas y ordenadas, y muestra vacío al filtrar sin coincidencias", async () => {
        const opciones = [...host.shadowRoot.querySelectorAll("#filtro-categoria option")]
            .map((opcion) => opcion.value);
        expect(opciones).to.deep.equal(["__todas__", "Imagenología", "Laboratorio"]);

        host._examenes = [{ id: "1", nombre: "Hemograma", categoria: "Laboratorio" }];
        host._categoria = "Imagenología";
        host._pintarLista();

        expect(host.shadowRoot.querySelector("#lista").textContent)
            .to.contain("No hay exámenes en esta categoría.");
    });

    test("el botón sigue deshabilitado sin consulta o sin paso aunque haya selección", () => {
        host._seleccion.add("2");

        host.idConsulta = null;
        host._actualizarBoton();
        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;

        host.idConsulta = "c-1";
        host.idPaso = null;
        host._seleccion.add("2");
        host._actualizarBoton();
        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;
    });

    test("desmarcar un checkbox quita el examen e ignora cambios mientras enviando", () => {
        marcar("1");
        const input = host.shadowRoot.querySelector('input[value="1"]');
        input.checked = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(host.obtenerSeleccionados()).to.deep.equal([]);

        marcar("2");
        host._enviando = true;
        host._actualizarBoton();
        const input2 = host.shadowRoot.querySelector('input[value="2"]');
        expect(input2.disabled).to.be.true;
        input2.checked = false;
        input2.dispatchEvent(new Event("change", { bubbles: true }));
        expect(host.obtenerSeleccionados()).to.deep.equal(["2"]);
    });

    test("usa asignarOrdenes cuando el servicio no expone crearOrdenes", async () => {
        const aliasStub = sinon.stub().resolves([{ idOrdenExamen: 1 }]);
        host.ordenExamenService = {
            listarExamenesPorPaso: listarStub,
            asignarOrdenes: aliasStub
        };
        marcar("3");

        await host.asignarSeleccionados();

        expect(aliasStub.calledOnce).to.be.true;
        expect(aliasStub.firstCall.args[0]).to.equal("p-9");
    });

    test("no envía órdenes sin selección, sin consulta o sin contexto", async () => {
        await host.asignarSeleccionados();
        expect(crearStub.called).to.be.false;

        host._seleccion.add("1");
        host.idConsulta = null;
        await host.asignarSeleccionados();
        expect(crearStub.called).to.be.false;

        host.idConsulta = "c-1";
        host.idPaso = null;
        host._seleccion.add("1");
        await host.asignarSeleccionados();
        expect(crearStub.called).to.be.false;
        expect(host._enviando).to.be.false;
    });

    test("emite notificación de éxito, estado de confirmación y restablece el botón", async () => {
        const mensajes = [];
        const oyente = (e) => mensajes.push(e.detail);
        window.addEventListener("notificacion", oyente);
        marcar("1");

        try {
            host.shadowRoot.querySelector("#btn-asignar").click();
            await esperar();
        } finally {
            window.removeEventListener("notificacion", oyente);
        }

        expect(mensajes.some((m) => m.tipo === "success")).to.be.true;
        expect(host.shadowRoot.querySelector("#estado").textContent)
            .to.contain("1 orden(es) registradas correctamente.");
        expect(host.shadowRoot.querySelector("#btn-asignar").disabled).to.be.true;
        expect(host.shadowRoot.querySelector("#btn-asignar").getAttribute("aria-busy")).to.equal("false");
    });

    test("cambiar id-consulta por atributo limpia la selección y el alias id-paso-clinico funciona", async () => {
        marcar("1");
        host.setAttribute("id-consulta", "c-2");
        expect(host.obtenerSeleccionados()).to.deep.equal([]);
        expect(host.shadowRoot.querySelector('input[value="1"]').checked).to.be.false;

        host.setAttribute("id-paso-clinico", "p-alias");
        await esperar();
        expect(host.idPaso).to.equal("p-alias");
        expect(listarStub.lastCall.args[0]).to.equal("p-alias");
    });
});
