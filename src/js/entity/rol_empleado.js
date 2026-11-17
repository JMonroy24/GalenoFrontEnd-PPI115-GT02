export function esRolEmpleado(asignacion) {
    if (!asignacion || typeof asignacion !== "object" || Array.isArray(asignacion)) {
        return false;
    }

    const rol = asignacion.rol
        ?? (typeof asignacion.idRol === "object" ? asignacion.idRol : asignacion);
    const nombre = String(rol?.nombre || rol?.descripcion || rol?.nombreRol || rol?.name
        || asignacion.nombreRol || asignacion.nombre || asignacion.name || "").trim().toLowerCase();
    const esEmpleado = rol?.esEmpleado ?? asignacion.esEmpleado;

    return nombre !== "paciente" && esEmpleado !== false
        && (nombre !== "" || esEmpleado === true);
}
