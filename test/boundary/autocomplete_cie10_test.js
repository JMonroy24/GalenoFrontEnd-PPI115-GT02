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
});
