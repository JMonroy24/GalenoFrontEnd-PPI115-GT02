import { Router, router, parseRouteParams, PRIVATE_ROUTES, navigate } from "../../src/js/router.js";
import store from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Router (unitaria)", () => {
    let contenedor;
    let routerPrueba;

    setup(() => {
        contenedor = document.createElement("div");
        contenedor.id = "app-contenedor-test";
        document.body.appendChild(contenedor);

        routerPrueba = new Router({
            container: contenedor,
            defaultRoute: "buscar-citas"
        });
    });

    teardown(() => {
        contenedor?.remove();
        store.setState({
            token: null,
            usuario: null,
            roles: [],
            clinicaActiva: null,
            clinica: null
        });
        window.location.hash = "";
    });

    suite("parseRouteParams", () => {
        test("extrae ruta base y parámetros vacíos en rutas estáticas", () => {
            const res = parseRouteParams("#dashboard");
            expect(res.route).to.equal("dashboard");
            expect(res.params).to.deep.equal({});
        });

        test("extrae id en rutas dinámicas como #atencion/<id>", () => {
            const res = parseRouteParams("#atencion/42");
            expect(res.route).to.equal("atencion");
            expect(res.params).to.deep.equal({ id: "42" });
        });

        test("maneja barras inclinadas al inicio o al final sin recortar el id", () => {
            const res = parseRouteParams("#/atencion/109/");
            expect(res.route).to.equal("atencion");
            expect(res.params).to.deep.equal({ id: "109" });
        });

        test("retorna objeto vacío cuando el hash está vacío", () => {
            const res = parseRouteParams("");
            expect(res.route).to.equal("");
            expect(res.params).to.deep.equal({});
        });
    });

    suite("normalizeRoute", () => {
        test("resuelve ruta por defecto cuando el hash es vacío o no tiene ruta", () => {
            expect(routerPrueba.normalizeRoute("")).to.equal("buscar-citas");
            expect(routerPrueba.normalizeRoute("#")).to.equal("buscar-citas");
        });

        test("extrae la ruta base ignorando parámetros dinámicos", () => {
            expect(routerPrueba.normalizeRoute("#atencion/55")).to.equal("atencion");
            expect(routerPrueba.normalizeRoute("#dashboard")).to.equal("dashboard");
            expect(routerPrueba.normalizeRoute("#buscar-citas")).to.equal("buscar-citas");
        });
    });

    suite("Guardias de rutas privadas (canNavigate e isPrivateRoute)", () => {
        test("identifica correctamente las rutas privadas (#dashboard y #atencion)", () => {
            expect(routerPrueba.isPrivateRoute("dashboard")).to.be.true;
            expect(routerPrueba.isPrivateRoute("#dashboard")).to.be.true;
            expect(routerPrueba.isPrivateRoute("atencion")).to.be.true;
            expect(routerPrueba.isPrivateRoute("#atencion/15")).to.be.true;
            expect(routerPrueba.isPrivateRoute("buscar-citas")).to.be.false;
            expect(routerPrueba.isPrivateRoute("login")).to.be.false;
        });

        test("permite acceso a rutas públicas sin sesión activa", () => {
            store.setState({ token: null, usuario: null, roles: [], clinicaActiva: null, clinica: null });
            expect(routerPrueba.canNavigate("buscar-citas")).to.be.true;
            expect(routerPrueba.canNavigate("login")).to.be.true;
        });

        test("bloquea ruta privada y redirige a #login si no hay sesión activa", () => {
            store.setState({ token: null, usuario: null, roles: [], clinicaActiva: null, clinica: null });
            window.location.hash = "#dashboard";

            const permiso = routerPrueba.canNavigate("dashboard");

            expect(permiso).to.be.false;
            expect(window.location.hash).to.equal("#login");
        });

        test("permite navegación a ruta privada si existe sesión activa", () => {
            store.setState({ token: "token-valido-123" });
            expect(routerPrueba.canNavigate("dashboard")).to.be.true;
            expect(routerPrueba.canNavigate("atencion")).to.be.true;
        });

        test("permite navegación a ruta privada si existe usuario y rol/clínica aunque el token sea null", () => {
            store.setState({
                token: null,
                usuario: { idPersona: 42, nombres: "Carlos" },
                roles: [{ idPersonaRol: 1, nombreRol: "MEDICO" }],
                clinicaActiva: { idClinica: 1, nombre: "Central" }
            });
            expect(routerPrueba.canNavigate("dashboard")).to.be.true;
            expect(routerPrueba.canNavigate("atencion")).to.be.true;
        });
    });

    suite("Navegación y renderizado", () => {
        test("navigate renderiza la vista pública correspondiente en el contenedor", () => {
            const ruta = routerPrueba.navigate("#buscar-citas");
            expect(ruta).to.equal("buscar-citas");

            const vista = contenedor.querySelector("busqueda-citas-view");
            expect(vista).to.exist;
            expect(vista.classList.contains("is-active")).to.be.true;
        });

        test("navigate a ruta privada sin sesión renderiza login-view y redirige hash a #login", () => {
            store.setState({ token: null });
            const ruta = routerPrueba.navigate("#dashboard");

            expect(ruta).to.equal("login");
            expect(window.location.hash).to.equal("#login");
            const vista = contenedor.querySelector("login-view");
            expect(vista).to.exist;
        });

        test("navigate a #atencion/<id> con sesión activa preserva el hash completo y renderiza atencion-consulta-view", () => {
            store.setState({ token: "token-sesion-activa" });
            const ruta = routerPrueba.navigate("#atencion/88");

            expect(ruta).to.equal("atencion");
            expect(window.location.hash).to.equal("#atencion/88");
            const vista = contenedor.querySelector("atencion-consulta-view");
            expect(vista).to.exist;
            expect(vista.dataset.route).to.equal("atencion");
        });

        test("resolve() resuelve hash actual de la ventana", () => {
            store.setState({ token: "token-sesion-activa" });
            window.location.hash = "#dashboard";

            const resuelta = routerPrueba.resolve();
            expect(resuelta).to.equal("dashboard");
            expect(contenedor.querySelector("dashboard-view")).to.exist;
        });
    });
});
