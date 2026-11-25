export default class GestorFechas {
    static #formatoInstante = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/El_Salvador", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
    });
    static normalizarFechaISO(valor) {
        if (valor instanceof Date) {
            return Number.isNaN(valor.getTime()) ? "" : valor.toISOString();
        }
        return typeof valor === "string" ? valor.trim().replace(/\[.*\]$/u, "") : "";
    }

    // El día programado se conserva tal como lo entrega el DTO, sin convertirlo de zona.
    static extraerFechaCalendario(valor) {
        const texto = this.normalizarFechaISO(valor);
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/u);
        if (!partes) return "";
        if (texto.length > 10 && Number.isNaN(new Date(texto).getTime())) return "";
        const [anio, mes, dia] = partes.slice(1).map(Number);
        const fecha = new Date(0);
        fecha.setUTCHours(0, 0, 0, 0);
        fecha.setUTCFullYear(anio, mes - 1, dia);
        if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
            return "";
        }
        return partes[1] + "-" + partes[2] + "-" + partes[3];
    }

    static formatearFechaCalendario(valor) {
        const iso = this.extraerFechaCalendario(valor);
        if (!iso) return "";
        const [anio, mes, dia] = iso.split("-");
        return `${dia}/${mes}/${anio}`;
    }

    static formatearFechaHoraCalendario(valor, hora = "") {
        const texto = this.normalizarFechaISO(valor);
        const fecha = this.formatearFechaCalendario(texto);
        if (!fecha) return "";
        const horaVisible = hora || texto.match(/[T ](\d{2}:\d{2})/)?.[1] || "";
        return [fecha, horaVisible].filter(Boolean).join(" ");
    }

    static formatearFechaISO(fechaIso) {
        const texto = this.normalizarFechaISO(fechaIso);
        if (!texto) return "";
        if (/^\d{4}-\d{2}-\d{2}$/u.test(texto)) return this.formatearFechaCalendario(texto);

        // Este método sí representa un instante en la zona del negocio.
        const fecha = new Date(texto);
        if (Number.isNaN(fecha.getTime()) || !this.extraerFechaCalendario(texto)) {
            return "";
        }

        const valores = Object.fromEntries(this.#formatoInstante.formatToParts(fecha)
            .filter(parte => parte.type !== "literal").map(({ type, value }) => [type, value]));

        return `${valores.day}/${valores.month}/${valores.year} ${valores.hour}:${valores.minute} ${valores.dayPeriod}`;
    }
}
