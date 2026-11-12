import config, {
    DEFAULT_FIRST,
    DEFAULT_MAX,
    HTTP_TIMEOUT_MS
} from "../config.js";
import DefaultError from "../entity/default_error.js";
import DefaultResponse from "../entity/default_response.js";
import store from "../store.js";

export default class DefaultService {
    constructor(endpoint = "") {
        this._urlBase = `${config.API_BASE.replace(/\/+$/, "")}${endpoint}`;
    }

    async _request(url, options = {}, fallbackMessage = "Error al acceder al repositorio") {
        const headers = new Headers(options.headers);
        const session = store.getState().session;
        const token = typeof session === "string"
            ? session
            : session?.token ?? session?.accessToken ?? session?.access_token;

        if (typeof token === "string" && token.trim() !== "") {
            headers.set("Authorization", `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
        const abortFromCaller = () => controller.abort(options.signal.reason);
        options.signal?.addEventListener("abort", abortFromCaller, { once: true });

        let response;
        try {
            response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
            options.signal?.removeEventListener("abort", abortFromCaller);
        }

        if (response.ok) {
            return response;
        }

        const errorDetails = await this._readErrorDetails(response);
        const formattedError = this._formatError(response.status, errorDetails, fallbackMessage);

        if (response.status === 401 || response.status === 403) {
            store.setState("session", null);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("navegar", { detail: "login" }));
            }
        }

        const error = new DefaultError(formattedError.message, formattedError);
        error.status = formattedError.status;
        error.message = formattedError.message;
        error.details = formattedError.details;
        throw error;
    }

    async _readErrorDetails(response) {
        if (typeof response.clone !== "function") {
            return null;
        }

        try {
            return await response.clone().json();
        } catch {
            try {
                const text = await response.clone().text();
                return text || null;
            } catch {
                return null;
            }
        }
    }

    _formatError(status, details, fallbackMessage) {
        const message = details && typeof details === "object"
            ? details.message ?? details.mensaje ?? details.detail ?? fallbackMessage
            : fallbackMessage;

        return { status, message, details };
    }

    async _get(urlBase, params = {}) {
        const url = new URL(urlBase);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        });

        const response = await this._request(url, { method: "GET" });
        const { items, total, first, max } = await response.json();
        return new DefaultResponse(items, total, first, max);
    }

    async findRange(first = DEFAULT_FIRST, max = DEFAULT_MAX, q = "") {
        return this._get(this._urlBase, { first, max, q });
    }
}
