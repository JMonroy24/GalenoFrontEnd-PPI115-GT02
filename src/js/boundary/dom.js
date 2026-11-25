const ENTIDADES_HTML = Object.freeze({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
});

/** Solo texto y atributos entre comillas; no admite HTML, scripts ni URLs. */
export function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ENTIDADES_HTML[caracter]);
}

/** Se crea una vez por módulo y se comparte entre instancias del mismo componente. */
export function crearEstilos(css) {
    const estilos = new CSSStyleSheet();
    estilos.replaceSync(`:host([hidden]) { display: none; }\n${css}`);
    return estilos;
}

/** Recibe únicamente HTML estático del proyecto, nunca datos de la API. */
export function crearPlantilla(html) {
    const contenido = document.createElement('template');
    contenido.innerHTML = html;
    const reglas = [...contenido.content.querySelectorAll('style')];
    const estilos = crearEstilos(reglas.map(regla => regla.textContent).join('\n'));
    reglas.forEach(regla => regla.remove());
    return { contenido, estilos };
}
