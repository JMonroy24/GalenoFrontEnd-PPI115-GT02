import { store } from "./store.js";

const DEFAULT_ROUTE = "buscar-citas";

export const PRIVATE_ROUTES = Object.freeze(["#dashboard", "#atencion"]);

/**
 * Extrae la ruta base y los parámetros de un hash con segmentos dinámicos.
 * Ejemplo: "#atencion/42" → { route: "atencion", params: { id: "42" } }
 *
 * @param {string} hash - El hash completo (con o sin "#").
 * @returns {{ route: string, params: Record<string, string> }}
 */
export const parseRouteParams = (hash = "") => {
    const clean = String(hash)
        .replace(/^#/, "")
        .replace(/^\/+|\/+$/g, "")
        .trim();
    const [route = "", ...segments] = clean.split("/");
    const params = segments.length > 0 ? { id: segments[0] } : {};
    return { route: route || "", params };
};

const PRIVATE_ROUTE_PATHS = new Set(
    PRIVATE_ROUTES.map((route) => route.replace(/^#/, ""))
);

const ROUTES = Object.freeze({
    login: "login-view",
    "buscar-citas": "busqueda-citas-view",
    dashboard: "dashboard-view",
    consulta: "detalle-consulta-view",
    atencion: "atencion-consulta-view"
});

const routeFromView = (view) => {
    const route = view.dataset.route
        ?? view.dataset.view
        ?? view.dataset.hash
        ?? view.id
        ?? "";

    return String(route)
        .replace(/^#/, "")
        .replace(/^\/+|\/+$/g, "")
        .trim();
};

export class Router {
    constructor(options = {}) {
        this.containerSelector = options.containerSelector ?? "main#app";
        this.defaultRoute = options.defaultRoute ?? DEFAULT_ROUTE;
        this.routes = options.routes ?? ROUTES;
        this.container = options.container ?? null;
        this._initialized = false;
        this._ultimoHash = null;
        this._ultimaSesion = null;
        this._params = {};
        this._onHashChange = () => {
            if (this._ultimoHash !== window.location.hash || this._ultimaSesion !== this.hasActiveSession()) {
                this.resolve();
            }
        };
        this._onDOMContentLoaded = () => this.resolve();
    }

    init(options = {}) {
        if (options.container) {
            this.container = options.container;
        }
        if (options.containerSelector) {
            this.containerSelector = options.containerSelector;
        }
        if (options.defaultRoute) {
            this.defaultRoute = options.defaultRoute;
        }
        if (options.routes) {
            this.routes = options.routes;
        }

        if (this._initialized || typeof window === "undefined") {
            return this;
        }

        this._initialized = true;

        window.addEventListener("hashchange", this._onHashChange);
        window.addEventListener("DOMContentLoaded", this._onDOMContentLoaded);

        if (document.readyState !== "loading") {
            this.resolve();
        }

        return this;
    }

    resolve() {
        return this.navigate(window.location.hash);
    }

    /**
     * Extrae el nombre de ruta base desde un hash, ignorando segmentos dinámicos.
     * "#atencion/42" → "atencion"
     *
     * @param {string} hash
     * @returns {string}
     */
    normalizeRoute(hash) {
        const { route } = parseRouteParams(hash);
        return route || this.defaultRoute;
    }

    hasActiveSession() {
        return store.hasActiveSession();
    }

    isPrivateRoute(route) {
        return PRIVATE_ROUTE_PATHS.has(this.normalizeRoute(route));
    }

    canNavigate(route) {
        if (!this.isPrivateRoute(route) || this.hasActiveSession()) {
            return true;
        }

        if (typeof window !== "undefined") {
            window.location.hash = "#login";
        }

        return false;
    }

    getContainer() {
        if (this.container) {
            return this.container;
        }

        if (typeof document === "undefined") {
            return null;
        }

        return document.querySelector(this.containerSelector)
            ?? document.querySelector("#contenido");
    }

    getViews(container) {
        const explicitViews = Array.from(
            container.querySelectorAll("[data-route], [data-view], [data-hash]")
        );

        if (explicitViews.length > 0) {
            return explicitViews;
        }

        return Array.from(container.children).filter((child) =>
            child.tagName !== "SCRIPT" && child.tagName !== "STYLE"
        );
    }

    render(route) {
        const container = this.getContainer();

        if (!container) {
            return null;
        }

        const views = this.getViews(container);
        const activeView = views.find((view) => routeFromView(view) === route
            && (view.dataset.routeId ?? "") === (this._params.id ?? ""));

        if (activeView) {
            views.forEach((view) => {
                const isActive = view === activeView;
                view.hidden = !isActive;
                view.classList.toggle("is-active", isActive);
                view.setAttribute("aria-hidden", String(!isActive));
            });

            return activeView;
        }

        views.forEach((view) => {
            view.hidden = true;
            view.classList.remove("is-active");
            view.setAttribute("aria-hidden", "true");
        });

        const viewTag = this.routes[route];

        if (!viewTag) {
            return null;
        }

        const view = document.createElement(viewTag);
        view.dataset.route = route;
        if (this._params.id) view.dataset.routeId = this._params.id;
        view.classList.add("is-active");
        view.setAttribute("aria-hidden", "false");
        container.replaceChildren(view);

        return view;
    }

    /**
     * Navega a un hash, preservando segmentos dinámicos en window.location.hash
     * pero resolviendo solo la ruta base para el render.
     * Ejemplo: navigate("#atencion/42") setea el hash completo y renderiza "atencion".
     *
     * @param {string} hash
     * @returns {string} La ruta base resuelta.
     */
    navigate(hash) {
        const { route, params } = parseRouteParams(hash);
        // Resolver la guardia antes de cambiar el hash o montar una vista.
        if ((!route || route === "login") && this.hasActiveSession()) {
            return this.navigate("#dashboard");
        }

        const resolvedRoute = route || this.defaultRoute;

        if (!this.canNavigate(resolvedRoute)) {
            const loginRoute = this.normalizeRoute("#login");
            this._params = {};
            this.render(loginRoute);
            this._ultimoHash = window.location.hash;
            this._ultimaSesion = this.hasActiveSession();
            return loginRoute;
        }

        // Preserva el hash completo (incluye segmentos dinámicos como /42)
        const targetHash = params.id
            ? `#${resolvedRoute}/${params.id}`
            : `#${resolvedRoute}`;

        if (typeof window !== "undefined" && window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }

        this._params = params;
        this.render(resolvedRoute);
        this._ultimoHash = typeof window !== "undefined" ? window.location.hash : targetHash;
        this._ultimaSesion = this.hasActiveSession();

        return resolvedRoute;
    }
}

export const router = new Router();

export const initRouter = (options) => router.init(options);

export const navigate = (hash) => router.navigate(hash);

export default router;
