export const API_BASE = "http://localhost:9080/galenoSV/resources/v1";
export const DEFAULT_FIRST = 0;
export const DEFAULT_MAX = 10;
export const HTTP_TIMEOUT_MS = 15000;
export const ENDPOINTS = Object.freeze({
    tiposDocumento: "/tipos-documento",
    tiposExamen: "/tipos-examen",
    tiposMedioContacto: "/tipos-medio-contacto",
    personasRoles: "/personas-roles",
    personas: "/personas",
    clinicas: "/clinicas",
    consultas: "/consultas",
    roles: "/roles",
    procedimientos: "/procedimientos"
});

export default {
    API_BASE,
    DEFAULT_FIRST,
    DEFAULT_MAX,
    HTTP_TIMEOUT_MS,
    ENDPOINTS
};
