import { AsistenteBusqueda } from "../../src/js/boundary/componentes/asistente_busqueda.js";
import { clinicaService } from "../../src/js/control/clinica_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AsistenteBusqueda (unitaria)", () => {
    let host;
    let findRangeStub;

    const clinicasFicticias = [
        { idClinica: 1, nombre: "Clínica Escalón" },
        { idClinica: 2, nombre: "Clínica Santa Tecla" }
    ];

    setup(async () => {
        findRangeStub = sinon.stub(clinicaService, "findRange").resolves({
            items: clinicasFicticias
        });

        host = document.createElement("asistente-busqueda");
        document.body.appendChild(host);

        // Espera a que termine la carga asíncrona de clínicas en connectedCallback
        await new Promise((resolve) => setTimeout(resolve, 20));
    });

    teardown(() => {
        findRangeStub?.restore();
        host?.remove();
    });

    test("renderiza estructura del formulario y carga lista de clínicas", () => {
        const selectClinica = host.shadowRoot.querySelector("#clinica");
        expect(selectClinica).to.exist;

        const opciones = selectClinica.querySelectorAll("option");
        expect(opciones).to.have.length(2);
        expect(opciones[0].value).to.equal("1");
        expect(opciones[0].textContent).to.equal("Clínica Escalón");
        expect(opciones[1].value).to.equal("2");
        expect(opciones[1].textContent).to.equal("Clínica Santa Tecla");
    });

    suite("Validación regex de número de documento", () => {
        test("valida y formatea DUI correctamente con regex /^\d{8}-\d$/", () => {
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");

            // Simula ingreso sin guión
            inputDoc.value = "012345678";
            inputDoc.dispatchEvent(new Event("input"));

            // Debe auto-formatear con guión
            expect(inputDoc.value).to.equal("01234567-8");
            expect(inputDoc.classList.contains("valido")).to.be.true;
            expect(inputDoc.classList.contains("invalido")).to.be.false;

            const ayuda = host.shadowRoot.querySelector("#numero-documento-ayuda");
            expect(ayuda.textContent).to.equal("Formato válido");
        });

        test("marca inválido DUI con caracteres incorrectos o longitud incompleta", () => {
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");
            const ayuda = host.shadowRoot.querySelector("#numero-documento-ayuda");

            inputDoc.value = "12345";
            inputDoc.dispatchEvent(new Event("input"));

            expect(inputDoc.classList.contains("valido")).to.be.false;
            expect(inputDoc.classList.contains("invalido")).to.be.true;
            expect(inputDoc.getAttribute("aria-invalid")).to.equal("true");
            expect(ayuda.textContent).to.contain("El DUI debe tener el formato 00000000-0");
        });

        test("valida formato según tipo de documento PASAPORTE /^[A-Z0-9]{6,12}$/", () => {
            const buscadorTipo = host.shadowRoot.querySelector("buscador-tipo-documentos");
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");

            // Cambiar a PASAPORTE
            buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
                detail: { value: "2", item: { codigo: "PASAPORTE" } }
            }));

            inputDoc.value = "A1234567";
            inputDoc.dispatchEvent(new Event("input"));

            expect(inputDoc.classList.contains("valido")).to.be.true;
            expect(inputDoc.classList.contains("invalido")).to.be.false;

            // Inválido si es demasiado corto
            inputDoc.value = "AB";
            inputDoc.dispatchEvent(new Event("input"));

            expect(inputDoc.classList.contains("valido")).to.be.false;
            expect(inputDoc.classList.contains("invalido")).to.be.true;
        });
    });

    suite("Validación de fechas y selección de clínica", () => {
        test("detecta rango inválido cuando fechaDesde es posterior a fechaHasta", () => {
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            inputDesde.value = "2026-11-20";
            inputHasta.value = "2026-11-10";

            const sonValidas = host._validarFechas();
            expect(sonValidas).to.be.false;
            expect(inputDesde.classList.contains("invalido")).to.be.true;
            expect(inputHasta.classList.contains("invalido")).to.be.true;
        });

        test("acepta rango de fechas válido o fechas vacías", () => {
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            inputDesde.value = "2026-11-01";
            inputHasta.value = "2026-11-15";

            expect(host._validarFechas()).to.be.true;
            expect(inputDesde.classList.contains("invalido")).to.be.false;
            expect(inputHasta.classList.contains("invalido")).to.be.false;
        });
    });

    suite("Emisión del evento 'buscar-citas'", () => {
        test("emite 'buscar-citas' con los datos completos del formulario al enviar con datos válidos", (done) => {
            const form = host.shadowRoot.querySelector("form");
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");
            const selectClinica = host.shadowRoot.querySelector("#clinica");
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            // Configurar datos válidos
            inputDoc.value = "09876543-2";
            selectClinica.value = "2";
            inputDesde.value = "2026-11-01";
            inputHasta.value = "2026-11-30";
            host.tipoDocumento = "1";

            host.addEventListener("buscar-citas", (evento) => {
                expect(evento.detail).to.deep.equal({
                    tipoDocumento: "1",
                    numeroDocumento: "09876543-2",
                    clinicaId: "2",
                    fechaDesde: "2026-11-01",
                    fechaHasta: "2026-11-30"
                });
                done();
            }, { once: true });

            form.dispatchEvent(new Event("submit", { cancelable: true }));
        });

        test("no emite 'buscar-citas' si el documento no es válido", () => {
            const form = host.shadowRoot.querySelector("form");
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");

            inputDoc.value = "invalido";
            let eventoEmitido = false;

            host.addEventListener("buscar-citas", () => {
                eventoEmitido = true;
            });

            form.dispatchEvent(new Event("submit", { cancelable: true }));

            expect(eventoEmitido).to.be.false;
        });

        test("no emite 'buscar-citas' si las fechas tienen un rango inconsistente", () => {
            const form = host.shadowRoot.querySelector("form");
            const inputDoc = host.shadowRoot.querySelector("#numero-documento");
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            inputDoc.value = "09876543-2";
            inputDesde.value = "2026-12-01";
            inputHasta.value = "2026-11-01"; // Inconsistente

            let eventoEmitido = false;
            host.addEventListener("buscar-citas", () => {
                eventoEmitido = true;
            });

            form.dispatchEvent(new Event("submit", { cancelable: true }));

            expect(eventoEmitido).to.be.false;
        });
    });
});
