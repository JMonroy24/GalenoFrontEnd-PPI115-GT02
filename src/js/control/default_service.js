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

        const deadline = AbortSignal.timeout(HTTP_TIMEOUT_MS);
        const signal = options.signal
            ? AbortSignal.any([options.signal, deadline]) : deadline;
        signal.throwIfAborted();

        let response;

        try {
            response = await fetch(url, {
                ...options,
                headers,
                credentials: "omit",
                signal
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
        }

        if (!response.ok) {
            const details = await this._readErrorDetails(response);
            const backendMessage = details && typeof details === "object"
                ? details.message ?? details.mensaje ?? details.detail ?? fallbackMessage
                : details;
            const message = `HTTP ${response.status}: ${
                typeof backendMessage === "string" && backendMessage.trim()
                    ? backendMessage.trim() : fallbackMessage
            }`;

            const error = new DefaultError(message, {
                status: response.status,
                message,
                details
            });
            if (INTERCEPTED_STATUSES.has(response.status)) {
                this._notificarError(message, details);
                error.notificado = true;
            }

            if (response.status === 401) {
                store.setState({ token: null, usuario: null, roles: [], rolSeleccionado: null, clinicaActiva: null });
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("navegar", { detail: "login" }));
                }
            }

            throw error;
        }

        return response;
    }

    _errorOffline(method) {
        const mensaje = "Operación no disponible en modo offline. Conéctese a internet para guardar los cambios";

        GeneradorMensajes.crearMensaje("Sin conexión", mensaje, "warning");

        const error = new DefaultError(mensaje, {
            code: "OFFLINE",
            method,
            details: { code: "OFFLINE", method }
        });
        error.notificado = true;
        return error;
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

        // json() puede consumir el cuerpo incluso si falla el parseo.
        const textSource = typeof response.clone === "function" ? response.clone() : response;

        if (typeof textSource?.text === "function") {
            try {
                return await textSource.text() || null;
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

    _normalizePayload(payload) {
        return Array.isArray(payload?.items) ? payload.items : payload;
    }

    async findRange(first = 0, max = DEFAULT_PAGE_SIZE, query = "", options = {}) {
        const params = new URLSearchParams();
        params.set("first", first);
        params.set("max", max);

        if (query !== undefined && query !== null && String(query).trim() !== "") {
            params.set("q", query);
        }

        const response = await this._request(
            `${this._urlBase}?${params.toString()}`,
            { ...options, method: "GET" },
            "Error al listar los recursos"
        );
        const payload = await this._parseBody(response);
        const items = this._normalizePayload(payload);

        // Las vistas existentes necesitan los metadatos para paginar.
        return new DefaultResponse(
            items,
            payload?.total ?? (Array.isArray(items) ? items.length : 0),
            payload?.first ?? first,
            payload?.max ?? max
        );
    }

    async get(id) {
        const response = await this._request(
            id === undefined ? this._urlBase : `${this._urlBase}/${encodeURIComponent(id)}`,
            { method: "GET" },
            "Error al obtener el recurso"
        );

        return this._normalizePayload(await this._parseBody(response));
    }

    async post(payload) {
        const response = await this._request(
            this._urlBase,
            this._jsonOptions("POST", payload),
            "Error al crear el recurso"
        );

        return this._normalizePayload(await this._parseBody(response));
    }

    async put(id, payload) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(id)}`,
            this._jsonOptions("PUT", payload),
            "Error al actualizar el recurso"
        );

        return this._normalizePayload(await this._parseBody(response));
    }

    async delete(id) {
        const response = await this._request(
            `${this._urlBase}/${encodeURIComponent(id)}`,
            { method: "DELETE" },
            "Error al eliminar el recurso"
        );

        return this._normalizePayload(await this._parseBody(response));
    }

    async findById(id) {
        return this.get(id);
    }

    async create(payload) {
        return this.post(payload);
    }

    async update(id, payload) {
        return this.put(id, payload);
    }
}

export default DefaultService;
