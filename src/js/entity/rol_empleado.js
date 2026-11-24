export function estaActivo(entidad) {
    const inactivos = new Set(['false', '0', 'inactivo', 'inactiva', 'deshabilitado', 'deshabilitada',
        'cancelado', 'cancelada', 'suspendido', 'suspendida', 'eliminado', 'eliminada', 'baja']);
    return ![entidad?.activo, entidad?.activa, entidad?.estado?.nombre ?? entidad?.estado,
        entidad?.estadoPersonaRol].some((valor) => valor != null
            && inactivos.has(String(valor).trim().toLowerCase()));
}

export function esRolEmpleado(asignacion) {
    if (!asignacion || typeof asignacion !== "object" || Array.isArray(asignacion)) {
        return false;
    }

    const rol = asignacion.rol
        ?? (typeof asignacion.idRol === "object" ? asignacion.idRol : asignacion);
    const nombre = String(rol?.nombre || rol?.descripcion || rol?.nombreRol || rol?.name
        || asignacion.nombreRol || asignacion.nombre || asignacion.name || "").trim().toLowerCase();
    const esEmpleado = rol?.esEmpleado ?? asignacion.esEmpleado;

    return estaActivo(asignacion) && estaActivo(rol)
        && estaActivo(asignacion.clinica) && estaActivo(asignacion.persona)
        && nombre !== "paciente" && esEmpleado !== false
        && (nombre !== "" || esEmpleado === true);
}
