import DefaultService from "../../src/js/control/default_service.js";
import DefaultResponse from "../../src/js/entity/default_response.js";
import DefaultError from "../../src/js/entity/default_error.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("DefaultService (unitaria)", () => {
    let fetchStub;
    const servicio = new DefaultService("/test-recurso");

    // ── Helpers ──────────────────────────────────────────────────────────────

    const jsonOk = (body, status = 200) => ({
        ok: true,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: function () { return this; }
    });

    const jsonError = (status, body = {}) => ({
        ok: false,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: function () { return this; }
    });

    const emptyOk = () => ({
        ok: true,
        status: 204,
        json: async () => null,
        text: async () => "",
        clone: function () { return this; }
    });

    // ── Limpieza ─────────────────────────────────────────────────────────────

    teardown(() => {
        fetchStub?.restore();
        store.setState({ token: null });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Construcción
    // ═══════════════════════════════════════════════════════════════════════

    test("construye la URL base uniendo API_BASE + endpoint", () => {
        fetchStub = sinon.stub(window, "fetch");
        expect(servicio._urlBase).to.match(/\/resources\/v1\/test-recurso$/);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  findRange — éxito 200
    // ═══════════════════════════════════════════════════════════════════════

    test("findRange devuelve un DefaultResponse con items, total, first y max", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [{ id: 1 }, { id: 2 }], total: 50, first: 0, max: 10 })
        );

        const resp = await servicio.findRange(0, 10);

        assert.instanceOf(resp, DefaultResponse);
        expect(resp.items).to.have.length(2);
        expect(resp.datos).to.equal(resp.items);
        expect(resp.total).to.equal(50);
        expect(resp.first).to.equal(0);
        expect(resp.max).to.equal(10);
    });

    test("findRange envía los parámetros first, max y q en la query string", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [], total: 0, first: 0, max: 5 })
        );

        await servicio.findRange(10, 5, "filtro");

        const url = fetchStub.firstCall.args[0];
        expect(url).to.contain("first=10");
        expect(url).to.contain("max=5");
        expect(url).to.contain("q=filtro");
    });

    test("findRange omite el parámetro q cuando no se pasa query", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [], total: 0, first: 0, max: 10 })
        );

        await servicio.findRange(0, 10);

        const url = fetchStub.firstCall.args[0];
        expect(url).to.not.contain("q=");
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  findById — éxito 200
    // ═══════════════════════════════════════════════════════════════════════

    test("findById hace GET a /<id> y parsea el cuerpo JSON", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ idRecurso: 42, nombre: "Ejemplo" })
        );

        const item = await servicio.findById(42);

        expect(fetchStub.firstCall.args[0]).to.contain("/test-recurso/42");
        expect(fetchStub.firstCall.args[1].method).to.equal("GET");
        expect(item).to.deep.equal({ idRecurso: 42, nombre: "Ejemplo" });
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  create — éxito 201
    // ═══════════════════════════════════════════════════════════════════════

    test("create envía POST con JSON y devuelve el recurso creado", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ idRecurso: 99 }, 201)
        );

        const payload = { nombre: "Nuevo" };
        const creado = await servicio.create(payload);

        expect(fetchStub.firstCall.args[1].method).to.equal("POST");
        const bodyEnviado = JSON.parse(fetchStub.firstCall.args[1].body);
        expect(bodyEnviado).to.deep.equal(payload);
        expect(creado.idRecurso).to.equal(99);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  update — éxito 200
    // ═══════════════════════════════════════════════════════════════════════

    test("update envía PUT a /<id> con el payload y devuelve el recurso", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ idRecurso: 5, nombre: "Editado" })
        );

        const editado = await servicio.update(5, { nombre: "Editado" });

        expect(fetchStub.firstCall.args[0]).to.contain("/test-recurso/5");
        expect(fetchStub.firstCall.args[1].method).to.equal("PUT");
        expect(editado.nombre).to.equal("Editado");
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  delete — éxito 204
    // ═══════════════════════════════════════════════════════════════════════

    test("delete envía DELETE a /<id> y devuelve null en 204", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(emptyOk());

        const resultado = await servicio.delete(7);

        expect(fetchStub.firstCall.args[0]).to.contain("/test-recurso/7");
        expect(fetchStub.firstCall.args[1].method).to.equal("DELETE");
        expect(resultado).to.be.null;
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Inyección de token Bearer
    // ═══════════════════════════════════════════════════════════════════════

    test("inyecta el header Authorization Bearer cuando el store tiene token", async () => {
        store.setState({ token: "jwt-secreto" });
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [], total: 0, first: 0, max: 10 })
        );

        await servicio.findRange(0, 10);

        const headers = fetchStub.firstCall.args[1].headers;
        expect(headers.get("Authorization")).to.equal("Bearer jwt-secreto");
    });

    test("no inyecta Authorization cuando el store no tiene token", async () => {
        store.setState({ token: null });
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk({ items: [], total: 0, first: 0, max: 10 })
        );

        await servicio.findRange(0, 10);

        const headers = fetchStub.firstCall.args[1].headers;
        expect(headers.has("Authorization")).to.be.false;
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Errores interceptados — DefaultError
    // ═══════════════════════════════════════════════════════════════════════

    test("lanza DefaultError con status 422 y mensaje del servidor", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(422, { message: "Entidad no procesable" })
        );

        let error = null;
        try {
            await servicio.create({ dato: "inválido" });
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(422);
        expect(error.mensaje).to.equal("Entidad no procesable");
    });

    test("lanza DefaultError con status 403 al acceder sin permisos", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(403, { message: "Acceso denegado" })
        );

        let error = null;
        try {
            await servicio.findRange(0, 10);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(403);
        expect(error.mensaje).to.equal("Acceso denegado");
    });

    test("lanza DefaultError con status 412 (precondición fallida)", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(412, { message: "Precondición fallida" })
        );

        let error = null;
        try {
            await servicio.update(1, {});
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(412);
    });

    test("lanza DefaultError con status 428 (precondición requerida)", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(428, { message: "Precondición requerida" })
        );

        let error = null;
        try {
            await servicio.findById(1);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(428);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Error 401 — limpia sesión y redirige a login
    // ═══════════════════════════════════════════════════════════════════════

    test("al recibir 401 limpia el token del store y lanza DefaultError", async () => {
        store.setState({ token: "token-expirado" });
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(401, { message: "Token expirado" })
        );

        let error = null;
        try {
            await servicio.findRange(0, 10);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(401);
        expect(store.getState().token).to.be.null;
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Error de red (fetch rechaza)
    // ═══════════════════════════════════════════════════════════════════════

    test("propaga TypeError cuando la red falla (fetch rechaza)", async () => {
        fetchStub = sinon.stub(window, "fetch").rejects(new TypeError("Failed to fetch"));

        let error = null;
        try {
            await servicio.findRange(0, 10);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, TypeError);
        expect(error.message).to.equal("Failed to fetch");
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Error 500 — NO interceptado pero sí DefaultError
    // ═══════════════════════════════════════════════════════════════════════

    test("un error 500 lanza DefaultError sin interceptar (sin notificación)", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonError(500, { message: "Error interno del servidor" })
        );

        let error = null;
        try {
            await servicio.findRange(0, 10);
        } catch (e) {
            error = e;
        }

        assert.instanceOf(error, DefaultError);
        expect(error.status).to.equal(500);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  DefaultResponse con payload array plano (sin wrapper)
    // ═══════════════════════════════════════════════════════════════════════

    test("findRange normaliza un payload que sea un array plano", async () => {
        fetchStub = sinon.stub(window, "fetch").resolves(
            jsonOk([{ id: 1 }, { id: 2 }])
        );

        const resp = await servicio.findRange(0, 10);

        assert.instanceOf(resp, DefaultResponse);
        expect(resp.items).to.have.length(2);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  Resiliencia Offline — Intercepción de escrituras POST/PUT (Macro-tarea 6)
    // ═══════════════════════════════════════════════════════════════════════

    test("intercepta POST si navigator.onLine es false y lanza aviso offline", async () => {
        const onLineOriginal = navigator.onLine;
        try {
            Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
        } catch {
        }
        store.setState({ online: false });

        let eventoMensaje = null;
        const escuchador = (e) => { eventoMensaje = e.detail; };
        window.addEventListener("mensaje-global", escuchador);

        let error = null;
        try {
            await servicio.create({ nombre: "Prueba offline" });
        } catch (e) {
            error = e;
        } finally {
            window.removeEventListener("mensaje-global", escuchador);
            store.setState({ online: true });
            try {
                Object.defineProperty(navigator, "onLine", { value: onLineOriginal, configurable: true });
            } catch {
            }
        }

        assert.instanceOf(error, DefaultError);
        expect(error.message).to.contain("Operación no disponible en modo offline");
        if (eventoMensaje) {
            expect(eventoMensaje.mensaje).to.contain("Operación no disponible en modo offline");
        }
    });

    test("intercepta PUT si navigator.onLine es false y lanza aviso offline", async () => {
        const onLineOriginal = navigator.onLine;
        try {
            Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
        } catch {
        }
        store.setState({ online: false });

        let error = null;
        try {
            await servicio.update(1, { nombre: "Prueba offline update" });
        } catch (e) {
            error = e;
        } finally {
            store.setState({ online: true });
            try {
                Object.defineProperty(navigator, "onLine", { value: onLineOriginal, configurable: true });
            } catch {
            }
        }

        assert.instanceOf(error, DefaultError);
        expect(error.message).to.contain("Operación no disponible en modo offline");
    });
});

