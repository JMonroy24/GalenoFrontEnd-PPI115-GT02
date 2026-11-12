import { StepperProgreso, ETAPAS_POR_DEFECTO } from "../../src/js/boundary/componentes/stepper_progreso.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("StepperProgreso (unitaria)", () => {
    let host;

    setup(() => {
        host = document.createElement("stepper-progreso");
        document.body.appendChild(host);
    });

    teardown(() => {
        if (host && host.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    test("está registrado en customElements con la etiqueta 'stepper-progreso'", () => {
        const definicion = customElements.get("stepper-progreso");
        expect(definicion).to.equal(StepperProgreso);
        assert.instanceOf(host, StepperProgreso);
        assert.isNotNull(host.shadowRoot);
    });

    test("utiliza las etapas por defecto cuando no se especifican", () => {
        expect(host.etapas).to.deep.equal(["Triaje", "Consulta Médica", "Tratamiento", "Cierre"]);
        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        expect(items).to.have.length(4);

        const etiquetas = Array.from(host.shadowRoot.querySelectorAll(".stepper-etiqueta"))
            .map((el) => el.textContent.trim());
        expect(etiquetas).to.deep.equal(["Triaje", "Consulta Médica", "Tratamiento", "Cierre"]);
    });

    test("renderiza estructura accesible con role='list' y role='listitem'", () => {
        const lista = host.shadowRoot.querySelector("ol.stepper-lista");
        assert.isNotNull(lista, "Debe existir un contenedor ol.stepper-lista");
        expect(lista.getAttribute("role")).to.equal("list");

        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        items.forEach((item) => {
            expect(item.getAttribute("role")).to.equal("listitem");
        });
    });

    test("diferencia claramente los estados completado, activo y pendiente con pasoActivo = 1", () => {
        host.pasoActivo = 1;

        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        expect(items).to.have.length(4);

        // Paso 0: Completado
        expect(items[0].classList.contains("stepper-paso--completado")).to.be.true;
        expect(items[0].hasAttribute("aria-current")).to.be.false;
        expect(items[0].querySelector(".stepper-icono")).to.not.be.null;

        // Paso 1: Activo
        expect(items[1].classList.contains("stepper-paso--activo")).to.be.true;
        expect(items[1].getAttribute("aria-current")).to.equal("step");
        expect(items[1].querySelector(".stepper-cifra").textContent.trim()).to.equal("2");

        // Pasos 2 y 3: Pendiente
        expect(items[2].classList.contains("stepper-paso--pendiente")).to.be.true;
        expect(items[2].hasAttribute("aria-current")).to.be.false;
        expect(items[3].classList.contains("stepper-paso--pendiente")).to.be.true;
        expect(items[3].hasAttribute("aria-current")).to.be.false;
    });

    test("permite establecer pasoActivo mediante el nombre de la etapa", () => {
        host.pasoActivo = "Tratamiento";
        expect(host.obtenerIndiceActivo()).to.equal(2);

        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        expect(items[0].classList.contains("stepper-paso--completado")).to.be.true;
        expect(items[1].classList.contains("stepper-paso--completado")).to.be.true;
        expect(items[2].classList.contains("stepper-paso--activo")).to.be.true;
        expect(items[2].getAttribute("aria-current")).to.equal("step");
        expect(items[3].classList.contains("stepper-paso--pendiente")).to.be.true;
    });

    test("permite establecer pasoActivo mediante búsqueda insensible a mayúsculas", () => {
        host.pasoActivo = "consulta médica";
        expect(host.obtenerIndiceActivo()).to.equal(1);
    });

    test("reacciona al atributo reactivo 'paso-activo'", () => {
        host.setAttribute("paso-activo", "2");
        expect(host.obtenerIndiceActivo()).to.equal(2);

        const activo = host.shadowRoot.querySelector(".stepper-paso--activo");
        expect(activo.getAttribute("data-indice")).to.equal("2");
    });

    test("reacciona a la propiedad reactiva 'etapas'", () => {
        host.etapas = ["Admisión", "Laboratorio", "Facturación"];
        expect(host.etapas).to.deep.equal(["Admisión", "Laboratorio", "Facturación"]);

        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        expect(items).to.have.length(3);

        const etiquetas = Array.from(host.shadowRoot.querySelectorAll(".stepper-etiqueta"))
            .map((el) => el.textContent.trim());
        expect(etiquetas).to.deep.equal(["Admisión", "Laboratorio", "Facturación"]);
    });

    test("reacciona al atributo reactivo 'etapas' con formato JSON y lista separada por comas", () => {
        host.setAttribute("etapas", JSON.stringify(["Registro", "Evaluación"]));
        expect(host.etapas).to.deep.equal(["Registro", "Evaluación"]);

        host.setAttribute("etapas", "Paso A, Paso B, Paso C");
        expect(host.etapas).to.deep.equal(["Paso A", "Paso B", "Paso C"]);
    });

    test("el método setPaso(indice) actualiza la fase activa dinámicamente y despacha 'cambio-paso'", () => {
        let eventoRecibido = null;
        host.addEventListener("cambio-paso", (evento) => {
            eventoRecibido = evento.detail;
        });

        host.setPaso(3);

        expect(host.pasoActivo).to.equal(3);
        expect(host.obtenerIndiceActivo()).to.equal(3);

        const activo = host.shadowRoot.querySelector(".stepper-paso--activo");
        expect(activo.getAttribute("data-indice")).to.equal("3");
        expect(activo.querySelector(".stepper-etiqueta").textContent.trim()).to.equal("Cierre");

        assert.isNotNull(eventoRecibido);
        expect(eventoRecibido.paso).to.equal(3);
        expect(eventoRecibido.indice).to.equal(3);
        expect(eventoRecibido.etapa).to.equal("Cierre");
    });

    test("renderiza conectores visuales y oculta extremos primero y último", () => {
        host.pasoActivo = 2; // Tratamiento

        const items = host.shadowRoot.querySelectorAll("li.stepper-paso");
        // Primer paso: conector izquierdo oculto
        const primerIzq = items[0].querySelector(".stepper-conector--izq");
        expect(primerIzq.classList.contains("stepper-conector--oculto")).to.be.true;

        // Último paso: conector derecho oculto
        const ultimoDer = items[3].querySelector(".stepper-conector--der");
        expect(ultimoDer.classList.contains("stepper-conector--oculto")).to.be.true;

        // Conector derecho del paso 0 debe estar completado porque paso activo es 2
        const paso0Der = items[0].querySelector(".stepper-conector--der");
        expect(paso0Der.classList.contains("stepper-conector--completado")).to.be.true;

        // Conector izquierdo del paso 2 debe estar completado
        const paso2Izq = items[2].querySelector(".stepper-conector--izq");
        expect(paso2Izq.classList.contains("stepper-conector--completado")).to.be.true;

        // Conector derecho del paso 2 debe ser pendiente (no completado)
        const paso2Der = items[2].querySelector(".stepper-conector--der");
        expect(paso2Der.classList.contains("stepper-conector--completado")).to.be.false;
    });

    test("muestra cada etapa numerada tanto en texto como en indicador", () => {
        const numerosTexto = Array.from(host.shadowRoot.querySelectorAll(".stepper-numero"))
            .map((el) => el.textContent.trim());
        expect(numerosTexto).to.deep.equal(["Paso 1", "Paso 2", "Paso 3", "Paso 4"]);
    });
});
