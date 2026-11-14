import { AsistenteBusqueda } from "../../src/js/boundary/componentes/asistente_busqueda.js";
import { personaService } from "../../src/js/control/persona_service.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("AsistenteBusqueda (unitaria)", () => {
    let host;
    let buscarClinicasPacienteStub;

    const clinicasFicticias = [
        { idClinica: 1, nombre: "Clínica Escalón" },
        { idClinica: 2, nombre: "Clínica Santa Tecla" }
    ];

    const esperar = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

    const ingresarDocumento = (documento, tipo = "1", codigo = "DUI") => {
        const buscadorTipo = host.shadowRoot.querySelector("buscador-tipo-documentos");
        const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

        buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
            detail: { value: tipo, item: { codigo } }
        }));

        inputDoc.value = documento;
        inputDoc.dispatchEvent(new Event("input"));
        inputDoc.dispatchEvent(new Event("blur"));

        return inputDoc;
    };

    setup(async () => {
        buscarClinicasPacienteStub = sinon
            .stub(personaService, "buscarClinicasPaciente")
            .resolves(clinicasFicticias);

        host = document.createElement("asistente-busqueda");
        document.body.appendChild(host);

        await esperar();
    });

    teardown(() => {
        buscarClinicasPacienteStub?.restore();
        host?.remove();
    });

    test("renderiza estructura del formulario con la clínica deshabilitada", () => {
        const selectClinica = host.shadowRoot.querySelector("#clinica");
        const ayuda = host.shadowRoot.querySelector("#clinica-ayuda");

        expect(selectClinica).to.exist;
        expect(selectClinica.disabled).to.be.true;
        expect(selectClinica.querySelectorAll("option")).to.have.length(0);
        expect(ayuda.textContent).to.contain("Seleccione un tipo y número de documento");
        expect(buscarClinicasPacienteStub.called).to.be.false;
    });

    suite("Carga dinámica de clínicas del paciente", () => {
        test("consulta las clínicas asociadas al completar un documento válido", async () => {
            ingresarDocumento("098765432");
            await esperar();

            const selectClinica = host.shadowRoot.querySelector("#clinica");
            const ayuda = host.shadowRoot.querySelector("#clinica-ayuda");

            expect(buscarClinicasPacienteStub.calledOnce).to.be.true;
            expect(buscarClinicasPacienteStub.firstCall.args).to.deep.equal([
                "1",
                "09876543-2"
            ]);
            expect(selectClinica.disabled).to.be.false;
            expect(selectClinica.querySelectorAll("option")).to.have.length(2);
            expect(selectClinica.value).to.equal("1");
            expect(ayuda.textContent).to.contain("2 clínicas asociadas");
        });

        test("mantiene la clínica deshabilitada si el paciente no tiene clínicas", async () => {
            buscarClinicasPacienteStub.resolves([]);

            ingresarDocumento("098765432");
            await esperar();

            const selectClinica = host.shadowRoot.querySelector("#clinica");
            const ayuda = host.shadowRoot.querySelector("#clinica-ayuda");

            expect(selectClinica.disabled).to.be.true;
            expect(selectClinica.querySelectorAll("option")).to.have.length(0);
            expect(ayuda.textContent).to.contain("No se encontraron clínicas asociadas");
        });

        test("deshabilita y limpia las clínicas al deseleccionar el tipo de documento", async () => {
            ingresarDocumento("098765432");
            await esperar();

            const buscadorTipo = host.shadowRoot.querySelector("buscador-tipo-documentos");
            const selectClinica = host.shadowRoot.querySelector("#clinica");

            buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
                detail: { value: "", item: null }
            }));

            expect(selectClinica.disabled).to.be.true;
            expect(selectClinica.querySelectorAll("option")).to.have.length(0);
        });
    });

    suite("Captura secuencial de tipo y número de documento", () => {
        test("inicia con el número de documento deshabilitado", () => {
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");
            expect(inputDoc.disabled).to.be.true;
        });

        test("habilita, limpia y enfoca el número de documento al elegir un tipo válido", () => {
            const buscadorTipo = host.shadowRoot.querySelector("buscador-tipo-documentos");
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

            inputDoc.value = "01234567-8";

            buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
                detail: { value: "1", item: { codigo: "DUI" } }
            }));

            expect(inputDoc.disabled).to.be.false;
            expect(inputDoc.value).to.equal("");
            expect(host.shadowRoot.activeElement).to.equal(inputDoc);
        });

        test("vuelve a deshabilitar y limpiar el número de documento al deseleccionar el tipo", () => {
            const buscadorTipo = host.shadowRoot.querySelector("buscador-tipo-documentos");
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

            buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
                detail: { value: "1", item: { codigo: "DUI" } }
            }));
            inputDoc.value = "01234567-8";
            buscadorTipo.dispatchEvent(new CustomEvent("tipo-documento-change", {
                detail: { value: "", item: null }
            }));

            expect(inputDoc.disabled).to.be.true;
            expect(inputDoc.value).to.equal("");
        });
    });

    suite("Validación regex de número de documento", () => {
        test("valida y formatea DUI correctamente con regex /^\d{8}-\d$/", () => {
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

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
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");
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
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

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
        test("emite 'buscar-citas' con los datos completos del formulario al enviar con datos válidos", async () => {
            const form = host.shadowRoot.querySelector("form");
            const selectClinica = host.shadowRoot.querySelector("#clinica");
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            ingresarDocumento("098765432");
            await esperar();

            selectClinica.value = "2";
            inputDesde.value = "2026-11-01";
            inputHasta.value = "2026-11-30";

            let detalle = null;
            host.addEventListener("buscar-citas", (evento) => {
                detalle = evento.detail;
            }, { once: true });

            form.dispatchEvent(new Event("submit", { cancelable: true }));

            expect(detalle).to.deep.equal({
                tipoDocumento: "1",
                numeroDocumento: "09876543-2",
                idClinica: "2",
                fechaDesde: "2026-11-01",
                fechaHasta: "2026-11-30"
            });
        });

        test("no emite 'buscar-citas' si el documento no es válido", () => {
            const form = host.shadowRoot.querySelector("form");
            const inputDoc = host.shadowRoot.querySelector("#numeroDocumento");

            inputDoc.value = "invalido";
            let eventoEmitido = false;

            host.addEventListener("buscar-citas", () => {
                eventoEmitido = true;
            });

            form.dispatchEvent(new Event("submit", { cancelable: true }));

            expect(eventoEmitido).to.be.false;
        });

        test("no emite 'buscar-citas' si las fechas tienen un rango inconsistente", async () => {
            const form = host.shadowRoot.querySelector("form");
            const inputDesde = host.shadowRoot.querySelector("#fecha-desde");
            const inputHasta = host.shadowRoot.querySelector("#fecha-hasta");

            ingresarDocumento("098765432");
            await esperar();

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
