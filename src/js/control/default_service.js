import {
    API_BASE,
    DEFAULT_PAGE_SIZE,
    HTTP_TIMEOUT_MS
} from "../config.js";
import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";
import GeneradorMensajes from "./generador_mensajes.js";
import { store } from "../store.js";

const INTERCEPTED_STATUSES = new Set([401, 403, 412, 422, 428]);

export class DefaultService {
    constructor(endpoint = "") {
        this.endpoint = endpoint;
        this._urlBase = `${API_BASE.replace(/\/+$/, "")}${endpoint}`;
    }

    async _request(url, options = {}, fallbackMessage = "Error al acceder al repositorio") {
        const method = String(options.method ?? "GET").toUpperCase();

        // Interceptar antes de preparar o enviar la petición, incluso si el store
        // todavía no recibió el evento offline del navegador.
        if (this._esOperacionEscritura(method) && this._estaSinConexion()) {
            throw this._errorOffline(method);
        }

        const headers = new Headers(options.headers);
        const session = store.state?.token;
        const token = typeof session === "string"
            ? session
            : session?.token ?? session?.accessToken ?? session?.access_token;

        if (typeof token === "string" && token.trim() !== "") {
            headers.set("Authorization", `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`);
            if (!headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
        const abortFromCaller = () => controller.abort(options.signal.reason);

        if (options.signal?.aborted) {
            controller.abort(options.signal.reason);
        } else {
            options.signal?.addEventListener("abort", abortFromCaller, { once: true });
        }

        let response;

        try {
            response = await fetch(url, {
                ...options,
                headers,
                credentials: "omit",
                signal: controller.signal
            });
        } catch (error) {
            if (this._esOperacionEscritura(method) && this._estaSinConexion()) {
                throw this._errorOffline(method);
            }

            if (error instanceof TypeError) {
                throw new DefaultError(
                    `No se pudo conectar con ${new URL(this._urlBase).origin}. `
                    + "Verifique que Open Liberty esté iniciado en el puerto HTTP configurado "
                    + "y que el backend permita el origen de la aplicación mediante CORS.",
                    {
                        code: "NETWORK_ERROR",
                        details: { url: String(url), causa: error.message }
                    }
                );
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
            options.signal?.removeEventListener("abort", abortFromCaller);
        }

        if (response.ok) {
            return response;
        }

        const details = await this._readErrorDetails(response);
        const message = details && typeof details === "object"
            ? details.message ?? details.mensaje ?? details.detail ?? fallbackMessage
            : fallbackMessage;

        if (INTERCEPTED_STATUSES.has(response.status)) {
            this._notificarError(message, details);
        }

        if (response.status === 401) {
            store.setState({ token: null, usuario: null, roles: [], rolSeleccionado: null, clinicaActiva: null });
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("navegar", { detail: "login" }));
            }
        }

        throw new DefaultError(message, {
            status: response.status,
            message,
            details
        });
    }

    _errorOffline(method) {
        const mensaje = "Operación no disponible en modo offline. Conéctese a internet para guardar los cambios";

        GeneradorMensajes.crearMensaje("Sin conexión", mensaje, "warning");

        return new DefaultError(mensaje, {
            code: "OFFLINE",
            method,
            details: { code: "OFFLINE", method }
        });
    }

    _esOperacionEscritura(method) {
        return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase());
    }

    _estaSinConexion() {
        return globalThis.navigator?.onLine === false || store.state?.online === false;
    }

    _notificarError(message, details) {
        if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
            return;
        }

        GeneradorMensajes.crearMensaje(message, details, "error");
    }

    async _readErrorDetails(response) {
        const source = typeof response.clone === "function" ? response.clone() : response;

        if (typeof source?.json === "function") {
            try {
                return await source.json();
            } catch {
            }
        }

        if (typeof source?.text === "function") {
            try {
                return await source.text() || null;
            } catch {
                return null;
            }
        }

        return null;
    }

    async _parseBody(response) {
        if (response.status === 204) {
            return null;
        }

        if (typeof response.text === "function") {
            const text = await response.text();

            if (!text || text.trim() === "") {
                return null;
            }

            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        }

        if (typeof response.json === "function") {
            try {
                return await response.json();
            } catch {
                return null;
            }
        }

        return null;
    }

    _jsonOptions(method, payload) {
        return {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        };
    }

    async findRange(first = 0, max = DEFAULT_PAGE_SIZE, query = "") {
        const params = new URLSearchParams();
        params.set("first", first);
        params.set("max", max);

        if (query !== undefined && query !== null && String(query).trim() !== "") {
            params.set("q", query);
        }

        const response = await this._request(
            `${this._urlBase}?${params.toString()}`,
            { method: "GET" },
            "Error al listar los recursos"
        );
        const payload = await response.json();

        return new DefaultResponse(
            payload?.items ?? [],
            payload?.total ?? 0,
            payload?.first ?? 0,
            payload?.max ?? 0
        );
    }

    async findById(id) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(id)}`,
            { method: "GET" },
            "Error al obtener el recurso"
        );

        return this._parseBody(response);
    }

    async create(payload) {
        const response = await this._request(
            this._urlBase,
            this._jsonOptions("POST", payload),
            "Error al crear el recurso"
        );

        return this._parseBody(response);
    }

    async update(id, payload) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(id)}`,
            this._jsonOptions("PUT", payload),
            "Error al actualizar el recurso"
        );

        return this._parseBody(response);
    }

    async delete(id) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(id)}`,
            { method: "DELETE" },
            "Error al eliminar el recurso"
        );

        return this._parseBody(response);
    }
}

export default DefaultService;
