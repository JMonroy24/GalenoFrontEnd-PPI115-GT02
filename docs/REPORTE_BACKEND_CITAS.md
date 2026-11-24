# Citas: reporte para trabajar el backend

## Diagnóstico y verificación local del flujo por roles — 24/11/2026

La reproducción con datos reales encontró una conexión local incorrecta: Open Liberty
utilizaba PostgreSQL en `localhost:5432`, mientras que el contenedor `GalenoSV-db`
publica la base del proyecto en `127.0.0.1:5433`. La API devolvía HTTP 503 y el registro
del servidor informaba SQLState `28P01` (fallo de autenticación). Se ajustó la conexión
al contenedor existente, sin cambiar sus credenciales ni recrear la base.

La configuración se guardó en los archivos locales `server.env` del backend y en un
override de su servidor generado, todos excluidos de Git. Esta configuración pertenece
al entorno de desarrollo; no se incluyen contraseñas en el frontend ni en este reporte.

Tras recuperar HTTP 200, se verificó en Chrome el servicio y el panel con las
asignaciones reales de empleados de la clínica `fe837a35-fbc8-4165-a146-9c4adc4ae986`:

- Atención al cliente: dos citas visibles y editables en Recepción.
- Enfermera: una cita visible y editable en Evaluación inicial después de la reparación autorizada descrita abajo.
- Doctor: recibe la cita cuando enfermería completa su paso; no se adelantan pasos pendientes.

La consulta histórica `38f051cd-a699-4652-af8d-e76ea6ef8dc2` tenía recepción completada
y carecía de sucesor. Con autorización explícita del usuario, se repitió esa transición
mediante PATCH con ETag, conservando exactamente `valor` y `fechaFin` de recepción.
El servidor creó la ejecución de Evaluación inicial en estado `EN_CURSO`.
No se marcaron como completados pasos de enfermería ni del doctor en consultas reales.

La nueva prueba `test/integration/flujo_roles_it.js`, incluida en ambos runners,
inicia sesión con cada empleado, crea una consulta temporal, comprueba las tarjetas,
guarda cada paso desde la vista real y verifica el relevo hasta el cierre por el doctor.
Elimina exclusivamente los registros creados por la prueba. Resultado contra Open Liberty:
`test/runner.html`: 564/564; `test/runner_it.html`: 8/8. Se comprobó que no quedaron
consultas temporales. El frontend de esta copia quedó disponible en `http://localhost:3000/src/`.

## Contrato actualizado confirmado el 24/11/2026

El backend local y OpenAPI ahora admiten `GET /consultas` con `first`, `max`, `q`,
`pacienteId` (asignación persona-rol del paciente), `idClinica`, `idRol`, `desde` y `hasta`.
Los límites de fecha son inclusivos en `America/El_Salvador`. Los nombres
`clinicaId`, `fechaDesde` y `fechaHasta` son alias internos del frontend y se traducen
antes de enviar HTTP. `tipoDocumento` y `numeroDocumento` no se envían a este recurso;
la búsqueda pública conserva su comprobación de identidad mediante los recursos de personas.

Para HU3/HU4, el frontend une `/consultas-procedimientos`,
`/consultas-procedimientos-pasos`, `/procedimientos-pasos` y
`/procedimientos-pasos-secuencias` mediante sus IDs. Las relaciones `SIGUIENTE`
determinan el orden; `idRol` determina el responsable e `indicaFin` determina el cierre.
Los registros completados aportan `fechaFin` para el historial.

La cola de atención y los permisos del paso vigente corresponden al rol activo y a
la clínica del empleado. `idPersonaRol` de la ejecución identifica al responsable
registrado; no convierte la cola del rol en una cola exclusiva de esa persona.
La selección de contexto se valida siempre contra las asignaciones activas propias
del empleado, excluyendo pacientes y roles inactivos.

`GET /procedimientos-pasos-examenes/asignables?idProcedimientoPaso=...` devuelve los
exámenes permitidos de la definición. Al crear órdenes, `idConsultaProcedimientoPaso`
identifica su ejecución en la consulta, que es un identificador distinto.

`PATCH /consultas-procedimientos-pasos/{id}` conserva `estadoPaso`, `valor` e
`If-Match`; el servidor completa y activa el sucesor o finaliza según `indicaFin`.
Para retroceder se agrega `accion: "RETROCEDER"`. El frontend recarga el flujo tras
la respuesta y no escribe el sucesor por separado. Las observaciones que siguen
documentan el estado anterior a esta actualización.

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
