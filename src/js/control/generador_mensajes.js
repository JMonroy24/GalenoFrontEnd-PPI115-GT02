import DefaultError from "../entity/default_error.js";

export default class GeneradorMensajes {
    static crearMensaje(titulo, detalle = null, tipo = "ERROR", origen = null) {
        let mensaje = new DefaultError();
        mensaje.titulo = titulo;
        if (detalle !== null) {
            mensaje.detalle = detalle;
        }
        mensaje.origen = origen;
        mensaje.tipo = tipo;
        // bubbles permite subir por el DOM y composed permite cruzar el Shadow DOM hasta window.
        return new CustomEvent("notificacion", { composed: true, bubbles: true, detail: mensaje });
    }
}
