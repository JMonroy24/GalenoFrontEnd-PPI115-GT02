export default class GestorFechas {
    static formatearFechaISO(fechaIso) {
        if (fechaIso === null || fechaIso === undefined || fechaIso === "") {
            return "";
        }

        // Las cadenas ISO sin offset se interpretan como hora local del dispositivo.
        const fecha = new Date(fechaIso);
        if (isNaN(fecha.getTime())) {
            return "";
        }

        const partes = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/El_Salvador",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }).formatToParts(fecha);

        const valores = {};
        partes.forEach((parte) => {
            if (parte.type !== "literal") {
                valores[parte.type] = parte.value;
            }
        });

        return `${valores.day}/${valores.month}/${valores.year} ${valores.hour}:${valores.minute} ${valores.dayPeriod}`;
    }
}
