# Citas: reporte para trabajar el backend

## Evidencia y alcance

Las capturas muestran consultas del **2026-09-01** y **2026-10-30** al buscar entre **2026-09-17** y **2026-10-29**. Ambas deben quedar fuera. También muestran tarjetas sin paciente, documento, clínica ni estado.

La comprobación local del 17/11/2026 confirmó que `/personas`, `/personas-roles`, `/roles/{id}` y `/clinicas/{id}` permiten resolver la clínica del paciente de la captura. También confirmó que `/consultas` devuelve una cita de otro paciente y otra clínica aunque la búsqueda envíe documento y clínica. El frontend ahora verifica esas coincidencias antes de mostrar y paginar los resultados. El servidor debe aplicar los filtros para no enviar registros ajenos al navegador.

## Trabajo realizado en el frontend

- Resuelve referencias explícitas de pacientes mediante `personas-roles/{id}` y `personas/{id}`, y de clínicas mediante `clinicas/{id}`. Conserva los datos que ya llegan completos y comparte las peticiones repetidas dentro de cada búsqueda.
- Admite las asociaciones anidadas y los identificadores de las variantes cubiertas por las pruebas. Para una referencia escalar en `idPaciente`, `pacienteId` o `idPersonaRol`, interpreta que identifica una asignación de persona y rol. **Confirmar esta semántica en el DTO real**; si identifica directamente una persona, el contrato debe distinguirla mediante `idPersona` o una entidad `paciente` completa.
- Usa el documento ya presente en el paciente. Si el DTO lo omite, puede usar el documento de la búsqueda después de verificar que el identificador de la persona coincide con el resultado filtrado de `/personas`.
- Muestra `estado`, `estadoConsulta` o `estadoCita`. Cuando únicamente existe `activo` booleano, muestra “Activa” o “Inactiva”; ese indicador no permite inferir si una cita está pendiente, atendida o cancelada.
- Comprueba el rango de fechas de forma inclusiva, usando el mismo día de la cita que muestra la tarjeta, sin convertirlo a otra zona horaria.
- En la búsqueda pública con tipo y número de documento, verifica el documento del paciente y el identificador de clínica después de resolver sus asociaciones. Excluye registros sin identidad verificable y tipos de documento distintos cuando el DTO los incluye. Recorre las páginas antes de filtrar y calcular el total visible.
- Con fechas, recorre las páginas declaradas por el servidor, filtra los resultados y después aplica la paginación visible. Así una primera página sin coincidencias no oculta citas válidas en páginas posteriores.
- No fabrica nombres, procedimientos, estados clínicos ni historiales ausentes.

## Pendientes del backend

### 1. Aplicar los filtros antes de paginar

La búsqueda envía `GET /consultas` con `first`, `max`, `tipoDocumento`, `numeroDocumento`, `idClinica`, `fechaDesde` y `fechaHasta` cuando corresponden. El dashboard también puede enviar `idRol`, `q` y `periodo`.

Confirmar los parámetros que realmente acepta el recurso. Implementar los anteriores o documentar sus nombres oficiales para ajustar el adaptador del frontend. No ignorar silenciosamente filtros recibidos.

Para el rango de las capturas, el criterio sobre el inicio programado de la cita debe equivaler a:

```text
inicio >= 2026-09-17 00:00:00
inicio <  2026-10-30 00:00:00
```

Esto incluye todo el 29 de octubre, incluso sus últimas horas. Acordar la zona horaria del negocio (`America/El_Salvador`) cuando se almacenen instantes con offset. Filtrar por la fecha programada de la cita, no por su fecha de creación.

Aplicar también la identidad del paciente y la clínica seleccionada. Después calcular el total filtrado y finalmente aplicar `first` y `max`, con un orden estable, por ejemplo inicio e identificador.

### 2. Entregar datos suficientes para las tarjetas

Contrato recomendado de respuesta, con valores ilustrativos:

```json
{
  "items": [
    {
      "idConsulta": "consulta-uuid",
      "inicio": "2026-09-17T09:30:00-06:00",
      "estado": "PENDIENTE",
      "paciente": {
        "idPersona": "persona-uuid",
        "nombres": "Ana",
        "apellidos": "López",
        "numeroDocumento": "12312378-0"
      },
      "clinica": {
        "idClinica": "clinica-uuid",
        "nombre": "Clínica Central de Santa Ana"
      },
      "procedimientos": [],
      "pasosClinicos": []
    }
  ],
  "total": 1,
  "first": 0,
  "max": 10
}
```

Si se mantienen DTOs con identificadores, proporcionar referencias inequívocas y sus recursos de lectura: la asignación debe permitir recuperar `idPersona` y `idClinica`; los recursos de persona y clínica deben proporcionar sus nombres. Es preferible incluir estos datos en la lista para evitar lecturas adicionales por tarjeta.

Para procedimientos e historial, incluir las asociaciones cuando existan, con nombres, estado y pasos ejecutados. Una lista vacía debe significar que no existen registros, no que se omitió cargar la relación.

### 3. Verificar el acceso público y los metadatos

La búsqueda de citas es pública. Las lecturas necesarias deben funcionar sin sesión y con CORS habilitado para el origen del frontend, devolviendo únicamente los datos previstos para este flujo. Una alternativa es entregar el DTO completo en el endpoint de búsqueda sin requerir lecturas adicionales.

`total` debe ser el número de coincidencias de los filtros, no el total global. `first` y `max` deben corresponder a la página solicitada. Sin estos metadatos correctos, el frontend no puede garantizar que haya recorrido todas las coincidencias.

## Criterios de aceptación para probar contra el servidor

1. El rango 17/09/2026–29/10/2026 excluye 01/09/2026 y 30/10/2026.
2. Incluye citas del 17/09 a las 00:00 y del 29/10 a las 23:59.
3. Funciona con solo Desde, solo Hasta y con ambos límites iguales.
4. Cambiar paciente o clínica devuelve exclusivamente sus citas.
5. Paciente, documento, clínica y estado muestran los datos de cada cita, sin asignar los de otra persona a partir del formulario.
6. Una coincidencia situada después de la primera página sigue apareciendo; `total` representa las coincidencias filtradas.
7. Las pruebas anteriores funcionan sin iniciar sesión en la búsqueda pública.

El filtro defensivo del frontend evita mostrar fechas fuera de rango, pero puede necesitar leer varias páginas. El filtrado en el backend sigue siendo necesario para reducir transferencias y garantizar resultados completos con grandes volúmenes.
