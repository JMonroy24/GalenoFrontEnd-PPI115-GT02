export const asignacionPrueba = { idPersonaRol: 'empleado-prueba', idClinica: 'clinica-prueba',
    rol: { idRol: 'medico-prueba', nombre: 'Doctor', activo: true } };

// Las pruebas de presentación usan un contexto explícito y DTOs completos.
// Los casos de rechazo y relevo usan sus propios datos en flujo_roles_test.js.
export function consultaConContexto(consulta) {
    if (!consulta) return consulta;
    const lista = consulta.pasos ?? consulta.pasosClinicos ?? consulta.consultaProcedimientoPasos;
    if (!Array.isArray(lista)) return { ...consulta, clinica: { idClinica: 'clinica-prueba', nombre: 'Clínica Central' } };
    const pasos = lista.toSorted((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((paso, indice) => ({ idRol: 'medico-prueba', idPersonaRol: 'empleado-prueba',
        rolResponsable: asignacionPrueba.rol, idProcedimientoPaso: `definicion-${indice}`,
        indicaFin: indice === lista.length - 1, ...paso }));
    return { ...consulta, clinica: { idClinica: 'clinica-prueba', nombre: 'Clínica Central' },
        ...(consulta.pasos ? { pasos } : consulta.pasosClinicos ? { pasosClinicos: pasos } : { consultaProcedimientoPasos: pasos.toSorted((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) }) };
}
