export class DefaultError extends Error {
    constructor(mensaje = "", error = null) {
        super(mensaje);
        this.name = "DefaultError";
        this.mensaje = mensaje;
        this.error = error;
        this.status = error?.status ?? null;
        this.details = error?.details ?? error;
        this.titulo = null;
        this.detalle = null;
        this.origen = null;
        this.tipo = null;
    }
}

export default DefaultError;
