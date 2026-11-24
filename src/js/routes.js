import { API_BASE } from "./config.js";

export const ENDPOINTS = Object.freeze({
    API_BASE,
    CLINICAS: "/clinicas",
    TIPOS_DOCUMENTO: "/tipos-documento",
    TIPOS_EXAMEN: "/tipos-examen",
    EXAMENES: "/examenes",
    EXAMENES_TIPOS_EXAMEN: "/examenes-tipos-examen",
    PROCEDIMIENTOS_PASOS_EXAMENES: "/procedimientos-pasos-examenes",
    TIPOS_MEDIO_CONTACTO: "/tipos-medio-contacto",
    PERSONAS: "/personas",
    PERSONAS_ROLES: "/personas-roles",
    ROLES: "/roles",
    CONSULTAS: "/consultas",
    CONSULTAS_PROCEDIMIENTOS: "/consultas-procedimientos",
    CONSULTAS_PROCEDIMIENTOS_PASOS: "/consultas-procedimientos-pasos",
    PROCEDIMIENTOS: "/procedimientos",
    ORDENES_EXAMEN: "/ordenes-examen",
    EXAMENES_RESULTADOS: "/examenes-resultados",
    CIE10: "/cie10"
});
