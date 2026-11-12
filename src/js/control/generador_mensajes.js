export class GeneradorMensajes {
    static crearMensaje(titulo, detalle = null, tipo = "info") {
        const mensaje = { titulo, detalle, tipo };
        const evento = new CustomEvent("notificacion", {
            composed: true,
            bubbles: true,
            detail: mensaje
        });
        const destino = typeof window !== "undefined" ? window : globalThis.document;

        destino?.dispatchEvent(evento);

        return evento;
    }
}

export default GeneradorMensajes;
