class DefaultService {
    constructor(resource = "", options = {}) {
        this.baseUrl = options.baseUrl || "";
        this.resource = this.normalizarRuta(resource);
        this.ruta = this.resource;
        this.headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };
    }

    normalizarRuta(ruta = "") {
        if (!ruta) {
            return "";
        }

        const valor = String(ruta).trim();
        if (!valor) {
            return "";
        }

        return valor.startsWith("/") ? valor : `/${valor}`;
    }

    get endpoint() {
        return `${this.baseUrl}${this.resource}`;
    }

    async listar(query = {}) {
        const url = this.construirUrl(query);
        return this.request("GET", url);
    }

    async obtenerPorId(id) {
        if (id === null || id === undefined || id === "") {
            throw new Error("Se requiere un identificador para consultar el recurso.");
        }

        return this.request("GET", `${this.endpoint}/${encodeURIComponent(id)}`);
    }

    async guardar(datos, id = null) {
        if (id !== null && id !== undefined && id !== "") {
            return this.actualizar(id, datos);
        }

        return this.crear(datos);
    }

    async crear(datos) {
        return this.request("POST", this.endpoint, datos);
    }

    async actualizar(id, datos) {
        if (id === null || id === undefined || id === "") {
            throw new Error("Se requiere un identificador para actualizar el recurso.");
        }

        return this.request("PUT", `${this.endpoint}/${encodeURIComponent(id)}`, datos);
    }

    async eliminar(id) {
        if (id === null || id === undefined || id === "") {
            throw new Error("Se requiere un identificador para eliminar el recurso.");
        }

        return this.request("DELETE", `${this.endpoint}/${encodeURIComponent(id)}`);
    }

    construirUrl(query = {}) {
        const params = new URLSearchParams();

        Object.entries(query).forEach(([clave, valor]) => {
            if (valor === undefined || valor === null || valor === "") {
                return;
            }

            params.append(clave, String(valor));
        });

        const queryString = params.toString();
        return queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
    }

    async request(method, url, body = null, opciones = {}) {
        const config = {
            method,
            headers: {
                ...this.headers,
                ...(opciones.headers || {})
            },
            ...(body !== null && body !== undefined ? { body: JSON.stringify(body) } : {}),
            ...opciones
        };

        if (!(body instanceof FormData) && body !== null && body !== undefined) {
            config.headers["Content-Type"] = config.headers["Content-Type"] || "application/json";
        }

        const respuesta = await fetch(url, config);

        if (!respuesta.ok) {
            const data = await respuesta.text();
            throw new Error(data || `La solicitud falló con estado ${respuesta.status}`);
        }

        const contenido = await respuesta.text();
        return contenido ? JSON.parse(contenido) : null;
    }
}

export { DefaultService };
export default DefaultService;
