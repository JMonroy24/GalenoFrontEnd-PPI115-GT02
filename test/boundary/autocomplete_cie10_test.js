import { AutoCompleteCie10 } from "../../src/js/boundary/componentes/autocomplete_cie10.js";
import { Cie10Service, cie10Service } from "../../src/js/control/cie10_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AutoCompleteCie10 (unitaria)", () => {
    let host;
    let clock;
    let buscarStub;

    const mockDiagnosticos = [
        { idCie10: 1, codigo: "A00", nombre: "Cólera" },
        { idCie10: 2, codigo: "A09", nombre: "Gastroenteritis y colitis de origen no especificado" },
        { idCie10: 3, codigo: "I10", nombre: "Hipertensión esencial (primaria)" }
    ];

    setup(() => {
        clock = sinon.useFakeTimers();

        buscarStub = sinon.stub(cie10Service, "findRange").resolves({
            items: mockDiagnosticos,
            total: 3,
            first: 0,
            max: 20
        });

        host = document.createElement("auto-complete-cie10");
        document.body.appendChild(host);
    });

    teardown(() => {
        clock?.restore();
        buscarStub?.restore();
        if (host && host.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado en customElements con la etiqueta 'auto-complete-cie10'", () => {
        expect(customElements.get("auto-complete-cie10")).to.equal(AutoCompleteCie10);
        assert.instanceOf(host, AutoCompleteCie10);
        assert.isNotNull(host.shadowRoot);
    });

    test("renderiza un <input type='search'> con atributos accesibles de combobox", () => {
        const input = host.shadowRoot.querySelector("input#input-busqueda");
        assert.isNotNull(input, "Debe existir input#input-busqueda");
        expect(input.type).to.equal("search");
        expect(input.getAttribute("role")).to.equal("combobox");
        expect(input.getAttribute("aria-autocomplete")).to.equal("list");
        expect(input.getAttribute("aria-expanded")).to.equal("false");
        expect(input.getAttribute("aria-controls")).to.equal("lista-resultados");
    });

    test("renderiza una lista flotante con role='listbox' inicialmente oculta", () => {
        const lista = host.shadowRoot.querySelector("ul#lista-resultados");
        assert.isNotNull(lista, "Debe existir ul#lista-resultados");
        expect(lista.getAttribute("role")).to.equal("listbox");
        expect(lista.hidden).to.be.true;
    });

    test("consulta coincidencias mediante el servicio con debounce de 300ms", async () => {
        const input = host.shadowRoot.querySelector("input#input-busqueda");
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        // Antes de 300ms no debe haber llamado al servicio
        clock.tick(200);
        expect(buscarStub.called).to.be.false;

        // Al alcanzar 300ms ejecuta la llamada
        clock.tick(100);
        expect(buscarStub.calledOnce).to.be.true;
        expect(buscarStub.firstCall.args[2]).to.equal("A0");
    });

    const flushMicrotasks = async () => {
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
        }
    };

    test("despliega los resultados en la lista flotante tras la búsqueda", async () => {
        const input = host.shadowRoot.querySelector("input#input-busqueda");
        input.value = "Gastro";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);

        await flushMicrotasks();

        const lista = host.shadowRoot.querySelector("ul#lista-resultados");
        expect(lista.hidden).to.be.false;
        expect(input.getAttribute("aria-expanded")).to.equal("true");

        const opciones = lista.querySelectorAll("li.resultado-item");
        expect(opciones).to.have.length(3);
        expect(opciones[1].textContent).to.include("A09");
        expect(opciones[1].textContent).to.include("Gastroenteritis");
    });

    test("permite navegar por los resultados con teclado y seleccionar con Enter", async () => {
        let eventoRecibido = null;
        host.addEventListener("cie10-change", (e) => {
            eventoRecibido = e.detail;
        });

        const input = host.shadowRoot.querySelector("input#input-busqueda");
        input.value = "hiper";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        // Presionar ArrowDown tres veces para llegar a I10 (índice 2)
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

        // Presionar Enter para seleccionar
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(host.seleccionados).to.have.length(1);
        expect(host.seleccionados[0].codigo).to.equal("I10");

        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.seleccionados).to.deep.equal([mockDiagnosticos[2]]);
    });

    test("agrega un diagnóstico como chip removible al hacer clic en un resultado", async () => {
        let eventoRecibido = null;
        host.addEventListener("cie10-change", (e) => {
            eventoRecibido = e.detail;
        });

        const input = host.shadowRoot.querySelector("input#input-busqueda");
        input.value = "colera";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        const lista = host.shadowRoot.querySelector("ul#lista-resultados");
        const primeraOpcion = lista.querySelector("li.resultado-item");
        primeraOpcion.click();

        expect(host.seleccionados).to.have.length(1);
        expect(host.seleccionados[0].codigo).to.equal("A00");

        const chips = host.shadowRoot.querySelectorAll("ul#chips-lista li.chip");
        expect(chips).to.have.length(1);
        expect(chips[0].textContent).to.include("A00");
        expect(chips[0].textContent).to.include("Cólera");

        // El input debe limpiarse y la lista ocultarse
        expect(input.value).to.equal("");
        expect(lista.hidden).to.be.true;

        // Debe haberse emitido el evento
        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.seleccionados).to.have.length(1);
    });

    test("evita agregar diagnósticos duplicados", async () => {
        host.seleccionarDiagnostico(mockDiagnosticos[0]);
        expect(host.seleccionados).to.have.length(1);

        // Intentar agregar el mismo diagnóstico nuevamente
        const agregado = host.seleccionarDiagnostico(mockDiagnosticos[0]);
        expect(agregado).to.be.false;
        expect(host.seleccionados).to.have.length(1);

        // También verifica con objeto diferente pero mismo código
        const agregadoPorCodigo = host.seleccionarDiagnostico({ codigo: "A00", nombre: "Cólera duplicado" });
        expect(agregadoPorCodigo).to.be.false;
        expect(host.seleccionados).to.have.length(1);
    });

    test("permite eliminar un diagnóstico seleccionado haciendo clic en el botón del chip", () => {
        host.seleccionarDiagnostico(mockDiagnosticos[0]);
        host.seleccionarDiagnostico(mockDiagnosticos[1]);
        expect(host.seleccionados).to.have.length(2);

        let eventoRecibido = null;
        host.addEventListener("cie10-change", (e) => {
            eventoRecibido = e.detail;
        });

        const chips = host.shadowRoot.querySelectorAll("ul#chips-lista li.chip");
        const btnEliminar = chips[0].querySelector(".btn-eliminar-chip");
        btnEliminar.click();

        expect(host.seleccionados).to.have.length(1);
        expect(host.seleccionados[0].codigo).to.equal("A09");

        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.seleccionados).to.have.length(1);
        expect(eventoRecibido.seleccionados[0].codigo).to.equal("A09");
    });

    test("limpiar() vacía la selección, la búsqueda y emite 'cie10-change'", () => {
        host.seleccionarDiagnostico(mockDiagnosticos[0]);
        expect(host.seleccionados).to.have.length(1);

        let eventoRecibido = null;
        host.addEventListener("cie10-change", (e) => {
            eventoRecibido = e.detail;
        });

        host.limpiar();

        expect(host.seleccionados).to.have.length(0);
        const chips = host.shadowRoot.querySelectorAll("ul#chips-lista li.chip");
        expect(chips).to.have.length(0);

        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.seleccionados).to.deep.equal([]);
    });

    test("cierra la lista flotante al presionar la tecla Escape", async () => {
        const input = host.shadowRoot.querySelector("input#input-busqueda");
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        const lista = host.shadowRoot.querySelector("ul#lista-resultados");
        expect(lista.hidden).to.be.false;

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(lista.hidden).to.be.true;
    });

    test("usa el servicio inyectado con el setter servicio", async () => {
        const buscar = sinon.stub().resolves({ items: [mockDiagnosticos[0]], total: 1, first: 0, max: 20 });
        host.servicio = { findRange: buscar };

        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        expect(buscar.calledOnceWith(0, 20, "A00")).to.be.true;
        expect(host.shadowRoot.querySelector("#lista-resultados").textContent).to.contain("A00");
    });

    test("seleccionados devuelve una copia y el setter repinta chips sin emitir cambio", () => {
        const copia = host.seleccionados;
        copia.push(mockDiagnosticos[0]);
        expect(host.seleccionados).to.have.length(0);

        let cambios = 0;
        host.addEventListener("cie10-change", () => { cambios += 1; });
        host.seleccionados = [mockDiagnosticos[0]];

        expect(host.shadowRoot.querySelectorAll("li.chip")).to.have.length(1);
        expect(cambios).to.equal(0);
    });

    test("limpiar() vacía también el input y los resultados", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        host.limpiar();

        expect(input.value).to.equal("");
        expect(host.shadowRoot.querySelector("#lista-resultados").hidden).to.be.true;
        expect(host._resultados).to.deep.equal([]);
    });

    test("seleccionarDiagnostico devuelve true, false con null y no emite cambio en duplicados", () => {
        let cambios = 0;
        host.addEventListener("cie10-change", () => { cambios += 1; });

        expect(host.seleccionarDiagnostico(null)).to.be.false;
        expect(host.seleccionarDiagnostico(mockDiagnosticos[0])).to.be.true;
        expect(host.seleccionarDiagnostico(mockDiagnosticos[0])).to.be.false;
        expect(cambios).to.equal(1);
    });

    test("elimina diagnósticos por referencia y por texto sin fallar con índices inválidos", () => {
        host.seleccionados = [mockDiagnosticos[0], "A09"];

        host.eliminarDiagnostico(mockDiagnosticos[0]);
        expect(host.seleccionados).to.deep.equal(["A09"]);

        host.eliminarDiagnostico("A09");
        expect(host.seleccionados).to.deep.equal([]);

        host.eliminarDiagnostico(99);
        expect(host.seleccionados).to.deep.equal([]);
    });

    test("un nuevo input reinicia el debounce y vaciar el campo cancela la búsqueda", () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");

        input.value = "A";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(200);
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(150);
        expect(buscarStub.called).to.be.false;

        clock.tick(150);
        expect(buscarStub.calledOnce).to.be.true;
        expect(buscarStub.firstCall.args[2]).to.equal("A0");

        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        expect(buscarStub.calledOnce).to.be.true;
    });

    test("cierra la lista al hacer clic fuera", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(host.shadowRoot.querySelector("#lista-resultados").hidden).to.be.true;
    });

    test("acepta buscarDiagnosticos, el método buscar y un arreglo vacío como respaldo", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        const buscarDiagnosticos = sinon.stub().resolves({ items: [mockDiagnosticos[0]] });
        host.servicio = { buscarDiagnosticos };

        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();
        expect(buscarDiagnosticos.calledOnceWith("A00")).to.be.true;

        const buscar = sinon.stub().resolves({ datos: [mockDiagnosticos[1]] });
        host.servicio = { buscar };
        input.value = "A09";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();
        expect(host.shadowRoot.querySelector("#lista-resultados").textContent).to.contain("A09");

        host.servicio = {};
        input.value = "sin coincidencias";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();
        expect(host.shadowRoot.querySelector("#lista-resultados").textContent)
            .to.contain("No se encontraron diagnósticos");
    });

    test("descarta una respuesta obsoleta de una búsqueda anterior", async () => {
        const resolvers = [];
        host.servicio = {
            findRange: sinon.stub().callsFake(() => new Promise((resolver) => resolvers.push(resolver)))
        };
        const input = host.shadowRoot.querySelector("#input-busqueda");

        input.value = "viejo";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);

        input.value = "nuevo";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);

        resolvers[1]({ items: [mockDiagnosticos[2]], total: 1, first: 0, max: 20 });
        await flushMicrotasks();
        resolvers[0]({ items: [mockDiagnosticos[0]], total: 1, first: 0, max: 20 });
        await flushMicrotasks();

        const lista = host.shadowRoot.querySelector("#lista-resultados");
        expect(lista.textContent).to.contain("I10");
        expect(lista.textContent).to.not.contain("A00");
    });

    test("muestra error de consulta, oculta el spinner y libera aria-busy", async () => {
        host.servicio = { findRange: sinon.stub().rejects(new Error("boom")) };
        const input = host.shadowRoot.querySelector("#input-busqueda");

        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        expect(host.shadowRoot.querySelector("#lista-resultados").textContent)
            .to.contain("Error al consultar diagnósticos.");
        expect(host.shadowRoot.querySelector("#spinner").classList.contains("activo")).to.be.false;
        expect(input.getAttribute("aria-busy")).to.equal("false");
    });

    test("muestra spinner y aria-busy mientras la consulta está pendiente", async () => {
        let resolver;
        host.servicio = {
            findRange: sinon.stub().callsFake(() => new Promise((res) => { resolver = res; }))
        };
        const input = host.shadowRoot.querySelector("#input-busqueda");

        input.value = "A00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);

        expect(host.shadowRoot.querySelector("#spinner").classList.contains("activo")).to.be.true;
        expect(input.getAttribute("aria-busy")).to.equal("true");

        resolver({ items: [], total: 0, first: 0, max: 20 });
        await flushMicrotasks();
        expect(host.shadowRoot.querySelector("#spinner").classList.contains("activo")).to.be.false;
    });

    test("renderiza opciones con role, id y aria-selected, y marca la opción activa", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        const opciones = host.shadowRoot.querySelectorAll("li.resultado-item");
        expect(opciones).to.have.length(3);
        expect(opciones[0].getAttribute("role")).to.equal("option");
        expect(opciones[0].id).to.equal("cie10-opcion-0");
        expect(opciones[0].getAttribute("aria-selected")).to.equal("false");

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        expect(opciones[2].classList.contains("activo")).to.be.true;
        expect(opciones[2].getAttribute("aria-selected")).to.equal("true");
        expect(input.getAttribute("aria-activedescendant")).to.equal("cie10-opcion-2");
    });

    test("ArrowDown y ArrowUp giran al principio y al final de la lista", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        expect(input.getAttribute("aria-activedescendant")).to.equal("cie10-opcion-0");

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        expect(input.getAttribute("aria-activedescendant")).to.equal("cie10-opcion-2");
    });

    test("Enter sin opción activa no agrega diagnósticos", async () => {
        const input = host.shadowRoot.querySelector("#input-busqueda");
        input.value = "A0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        clock.tick(300);
        await flushMicrotasks();

        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(host.seleccionados).to.have.length(0);
    });

    test("los chips incluyen aria-label, role y escapan HTML", () => {
        host.seleccionados = [{ codigo: "X<1>", nombre: "<script>alert(1)</script>" }];

        const chip = host.shadowRoot.querySelector("li.chip");
        const boton = chip.querySelector(".btn-eliminar-chip");
        expect(chip.getAttribute("role")).to.equal("listitem");
        expect(boton.getAttribute("aria-label")).to.contain("Quitar diagnóstico");
        expect(chip.querySelector(".chip-nombre").getAttribute("title"))
            .to.contain("<script>");
        expect(chip.querySelector("script")).to.be.null;
    });

    test("emite cie10-change con bubbles y composed", () => {
        let evento = null;
        host.addEventListener("cie10-change", (e) => { evento = e; });
        host.seleccionarDiagnostico(mockDiagnosticos[0]);

        assert.isNotNull(evento);
        expect(evento.bubbles).to.be.true;
        expect(evento.composed).to.be.true;
    });

    test("muestra resultados del catálogo local cuando el backend falla", async () => {
        const fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("sin red"));
        const servicio = new Cie10Service();
        servicio._catalogoLocal = [mockDiagnosticos[0]];
        host.servicio = servicio;
        const input = host.shadowRoot.querySelector("#input-busqueda");

        try {
            input.value = "A00";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            clock.tick(300);
            await flushMicrotasks();

            expect(host.shadowRoot.querySelector("#lista-resultados").textContent).to.contain("A00");
        } finally {
            fetchStub.restore();
        }
    });
});
