import { API_BASE, HTTP_TIMEOUT_MS } from "../config.js";
import { ENDPOINTS } from "../routes.js";
import DefaultError from "../entity/default_error.js";

// Las credenciales BASIC permanecen en memoria; no se guardan en Web Storage.
export class ApiAuthService {
    constructor() {
        this.autorizacion = null;
        this.formulario = null;
        this.solicitud = null;
    }

    async autenticar(usuario, password) {
        const nombre = String(usuario ?? "").trim();

        if (!nombre || !password || nombre.includes(":")) {
            throw new DefaultError("Ingrese un usuario y una contraseña válidos.", { status: 422 });
        }

        const bytes = new TextEncoder().encode(`${nombre}:${password}`);
        const autorizacion = `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))}`;
        let response;

        try {
            response = await fetch(`${API_BASE}${ENDPOINTS.TIPOS_DOCUMENTO}?first=0&max=1`, {
                method: "GET",
                headers: { Authorization: autorizacion, Accept: "application/json" },
                credentials: "omit",
                cache: "no-store",
                signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
            });
        } catch {
            throw new DefaultError("No se pudo conectar con Open Liberty. Verifique el servidor y el certificado HTTPS.");
        }

        if (!response.ok) {
            const mensaje = response.status === 401
                ? "Usuario o contraseña incorrectos."
                : response.status === 403
                    ? "La cuenta no tiene permiso para consultar la API."
                    : `La API respondió con el error ${response.status}.`;
            throw new DefaultError(mensaje, { status: response.status });
        }

        this.autorizacion = autorizacion;
        return autorizacion;
    }

    solicitarCredenciales() {
        if (!this.formulario) {
            return Promise.resolve(null);
        }

        if (!this.solicitud) {
            this.solicitud = Promise.resolve().then(() => this.formulario()).finally(() => {
                this.solicitud = null;
            });
        }

        return this.solicitud;
    }

    logout() {
        this.autorizacion = null;
    }
}

export const apiAuthService = new ApiAuthService();
