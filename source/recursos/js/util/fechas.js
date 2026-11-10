const FORMATO_FECHA = new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium",
    timeStyle: "short"
});

const FORMATO_SOLO_FECHA = new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium"
});

export function aFecha(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }
    if (valor instanceof Date) {
        return Number.isNaN(valor.getTime()) ? null : new Date(valor.getTime());
    }
    if (Array.isArray(valor) && valor.length >= 3) {
        const [anio, mes, dia, hora = 0, minuto = 0, segundo = 0] = valor;
        const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function aISO(valor) {
    const fecha = aFecha(valor);
    return fecha ? fecha.toISOString() : null;
}

export function aInputDateTime(valor) {
    const fecha = aFecha(valor);
    if (!fecha) {
        return "";
    }
    const desfase = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16);
}

export function formatearFecha(valor, soloFecha = false) {
    const fecha = aFecha(valor);
    if (!fecha) {
        return "—";
    }
    return (soloFecha ? FORMATO_SOLO_FECHA : FORMATO_FECHA).format(fecha);
}

export function formatearPeriodo(inicio, fin) {
    const desde = aFecha(inicio);
    const hasta = aFecha(fin);
    if (!desde && !hasta) {
        return "Sin periodo definido";
    }
    if (!hasta) {
        return `Desde ${FORMATO_FECHA.format(desde)}`;
    }
    if (!desde) {
        return `Hasta ${FORMATO_FECHA.format(hasta)}`;
    }
    return `${FORMATO_FECHA.format(desde)} — ${FORMATO_FECHA.format(hasta)}`;
}

export function textoCorto(valor, maximo = 8) {
    if (valor === null || valor === undefined) {
        return "—";
    }
    const texto = String(valor);
    return texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto;
}

export function estaVencida(fechaFin) {
    const fin = aFecha(fechaFin);
    return fin !== null && fin.getTime() < Date.now();
}

export function estaVigente(fechaInicio, fechaFin) {
    const inicio = aFecha(fechaInicio);
    const fin = aFecha(fechaFin);
    const ahora = Date.now();
    return (!inicio || inicio.getTime() <= ahora) && (!fin || fin.getTime() >= ahora);
}
