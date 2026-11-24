import { esRolEmpleado, estaActivo } from './rol_empleado.js';

export const idEntidad = (valor, campo = 'id') => valor && typeof valor === 'object'
    ? valor[campo] ?? valor.id : valor;
export const estadoPaso = (paso) => {
    const valor = paso?.estadoPaso ?? paso?.estado ?? '';
    return String(typeof valor === 'object' ? valor?.nombre ?? valor?.codigo ?? '' : valor)
        .trim().toUpperCase().replaceAll(' ', '_');
};
export const idRolAsignacion = (asignacion) => idEntidad(asignacion?.rol ?? asignacion?.idRol, 'idRol');
export const idClinicaAsignacion = (asignacion) => idEntidad(
    asignacion?.clinica ?? asignacion?.idClinica, 'idClinica');
export const idRolPaso = (paso) => idEntidad(paso?.rolResponsable ?? paso?.idRol
    ?? paso?.procedimientoPaso?.idRol ?? paso?.idProcedimientoPaso?.idRol
    ?? paso?.responsable?.idRol, 'idRol');
export const esPasoFinal = (paso) => (paso?.indicaFin ?? paso?.procedimientoPaso?.indicaFin
    ?? paso?.idProcedimientoPaso?.indicaFin) === true;

export function indicePasoVigente(pasos = []) {
    const enCurso = pasos.findIndex((paso) => estadoPaso(paso) === 'EN_CURSO');
    return enCurso >= 0 ? enCurso : pasos.findIndex((paso) => estadoPaso(paso) === 'PENDIENTE');
}

// Los permisos se calculan en cada acción; la selección visual nunca concede edición.
export function puedeOperarPaso(paso, consulta, estado) {
    const seleccion = estado?.rolSeleccionado ?? estado?.selectedRole;
    const clinica = idEntidad(estado?.clinicaActiva ?? estado?.clinica, 'idClinica');
    const clinicaConsulta = idEntidad(consulta?.clinica ?? consulta?.idClinica, 'idClinica');
    const rol = idRolAsignacion(seleccion);
    const responsable = idRolPaso(paso);
    const asignado = idEntidad(paso?.idPersonaRol, 'idPersonaRol');
    const seleccionado = idEntidad(seleccion?.idPersonaRol ?? seleccion?.id, 'idPersonaRol');
    const pertenece = (estado?.roles ?? []).some((item) => esRolEmpleado(item)
        && String(idRolAsignacion(item)) === String(rol)
        && String(idClinicaAsignacion(item)) === String(clinica)
        && (seleccionado == null || String(item.idPersonaRol ?? item.id) === String(seleccionado)));
    return Boolean(esRolEmpleado(seleccion) && pertenece && estaActivo(paso?.rolResponsable)
        && rol != null && responsable != null && String(rol) === String(responsable)
        && clinica != null && clinicaConsulta != null && String(clinica) === String(clinicaConsulta)
        && String(idClinicaAsignacion(seleccion)) === String(clinica)
        && (asignado == null || seleccionado != null && String(asignado) === String(seleccionado))
        && ['EN_CURSO', 'PENDIENTE'].includes(estadoPaso(paso))
        && !consulta?.fechaFin && consulta?.estado !== 'FINALIZADA');
}

export function pasosConsulta(consulta) {
    return consulta?.pasos ?? consulta?.pasosClinicos ?? [];
}

export function puedeAtenderConsulta(consulta, estado) {
    const pasos = pasosConsulta(consulta);
    return puedeOperarPaso(pasos[indicePasoVigente(pasos)], consulta, estado);
}
