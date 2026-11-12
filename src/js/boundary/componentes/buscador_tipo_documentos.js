// Este archivo es un alias heredado de buscador_tipo_doc.js (el canónico).
// Re-exporta la clase sin volver a registrar el custom element para evitar
// la colisión de doble `customElements.define("buscador-tipo-documentos", ...)`.
export { BuscadorTipoDocumentos as default } from "./buscador_tipo_doc.js";
