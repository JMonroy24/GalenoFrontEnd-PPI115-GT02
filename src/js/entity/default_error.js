export default class DefaultError {
    constructor(mensaje = "", error = null) {
        this.mensaje = mensaje;
        this.error = error;
        this.titulo = null;
        this.detalle = null;
        this.origen = null;
        this.tipo = null;
    }
}
