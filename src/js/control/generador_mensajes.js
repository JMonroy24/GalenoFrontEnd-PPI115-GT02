export class GeneradorMensajes {
    static crearMensaje(titulo, detalle = null, tipo = "info", duracion = 5000) {
        const mensaje = {
            titulo,
            mensaje: titulo,
            detalle,
            tipo,
            nivel: tipo,
            duracion: this._normalizarDuracion(duracion)
        };
        const evento = new CustomEvent("notificacion", {
            composed: true,
            bubbles: true,
            detail: mensaje
        });
        const destino = typeof window !== "undefined" ? window : globalThis.document;

        destino?.dispatchEvent(evento);

        return evento;
    }

    static _normalizarDuracion(duracion) {
        const valor = duracion && typeof duracion === "object"
            ? duracion.duracion ?? duracion.duration
            : duracion;
        const numero = Number(valor);

        return Number.isFinite(numero) && numero >= 0 ? numero : 5000;
    }
}

export default GeneradorMensajes;
