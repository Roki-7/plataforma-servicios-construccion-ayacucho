# Diseño de la API REST

La aplicación web se comunica con el backend solo mediante esta API (RC06, ADR-003). Este documento fija las convenciones y la lista de recursos por módulo. Cada funcionalidad de Spec Kit detalla sus contratos en `specs/<funcionalidad>/contracts/`.

## 1. Convenciones

| Tema | Regla |
|---|---|
| Base | Todas las rutas empiezan por `/api/v1`. |
| Formato | JSON en peticiones y respuestas, con nombres en español y estilo `camelCase`. |
| Recursos | Sustantivos en plural: `/solicitudes`, `/cotizaciones`. Las acciones que cambian un estado se expresan como subrecurso: `/contrataciones/{id}/confirmacion`. |
| Autenticación | Cabecera `Authorization: Bearer <token>`; la renovación usa una cookie `httpOnly`. |
| Idempotencia | Las operaciones críticas exigen la cabecera `Idempotency-Key`. |
| Concurrencia | Las modificaciones envían la versión que el usuario consultó; si cambió, se responde 409. |
| Paginación | `?pagina=1&tamano=20`; la respuesta incluye `total` y `pagina`. |
| Fechas e importes | Fechas en ISO 8601 (UTC). Importes en céntimos y moneda `PEN`. |
| Errores | Cuerpo `{ "codigo", "mensaje", "detalles" }` con un código estable. |

| Estado HTTP | Uso |
|---|---|
| 200 / 201 / 204 | Consulta correcta / recurso creado / acción sin contenido |
| 400 | Datos con formato inválido o falta una cabecera obligatoria |
| 401 | Sin sesión o sesión vencida |
| 403 | Sin permiso o sin participación en la operación |
| 404 | El recurso no existe o no es visible para el usuario |
| 409 | Conflicto: versión desactualizada, contratación activa, clave reutilizada |
| 422 | Regla de negocio incumplida |
| 429 | Demasiados intentos |
| 500 / 503 | Error inesperado / servicio no disponible |

## 2. Endpoints por módulo

### Usuarios y acceso

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /cuentas` | Crear una cuenta de cliente o prestador | RF01 |
| `POST /sesiones` · `DELETE /sesiones/actual` | Iniciar y cerrar sesión | RF02 |
| `POST /sesiones/renovacion` · `GET /sesiones/csrf` | Renovar la sesión y obtener el token CSRF de la cookie de renovación | RF02 |
| `POST /sesiones/reautenticacion` | Acreditar la contraseña en la sesión (autenticación reciente, hasta 300 s) | RF02, RF05 |
| `POST /recuperaciones` · `POST /recuperaciones/{token}` | Pedir y usar el enlace de recuperación | RF03 |
| `GET /perfil` · `PATCH /perfil` | Consultar y actualizar el perfil propio | RF05 |
| `POST /perfil/perfiles` | Añadir el perfil faltante (cliente o prestador) con confirmación explícita. No concede verificación ni administración | RF01, RF04 |
| `POST /perfil/cambios-correo` · `POST /perfil/cambios-correo/{token}/confirmacion` | Solicitar y confirmar el cambio de correo de acceso | RF05 |
| `POST /perfil/cambios-contrasena` | Cambiar la contraseña con la contraseña actual | RF03, RF05 |
| `POST /perfil/fotografias` · `GET /perfil/fotografias/{fotografiaId}` | Cargar y leer la fotografía privada del titular | RF05 |
| `GET /salud` | Comprobar disponibilidad (soporte operativo, sin datos privados) | — |

Las 17 operaciones de esta tabla coinciden con el OpenAPI versionado de 001. 001 no define rutas ni roles administrativos: el registro y la edición rechazan `administrador`, `rol`, `permisos` e identificadores (CA-AUT-04, CA-AUT-07).

### Prestadores

| Método y ruta | Descripción | RF |
|---|---|---|
| `PUT /prestadores/perfil` | Registrar especialidades, experiencia, zonas y disponibilidad | RF06 |
| `POST /prestadores/perfil/trabajos` | Agregar trabajos anteriores | RF06 |
| `POST /prestadores/verificacion` | Presentar documentos de verificación | RF07 |
| `GET /prestadores/{id}` | Perfil público | RF10 |

### Catálogo y búsqueda

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /servicios` · `PATCH /servicios/{id}` | Publicar, editar, pausar o retirar un servicio | RF08 |
| `GET /servicios?categoria=&distrito=&calificacion=` | Buscar servicios y prestadores | RF09 |
| `GET /servicios/{id}` | Detalle del servicio | RF10 |
| `POST /busquedas/interpretacion` | Interpretar una necesidad con IA | RF11 |
| `GET /categorias` | Categorías activas | RF39 |

### Solicitudes y visitas

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /solicitudes` | Crear una solicitud (borrador, dirigida o publicada) | RF12 |
| `PATCH /solicitudes/{id}` · `POST /solicitudes/{id}/cierre` | Editar o cerrar | RF13 |
| `GET /solicitudes/oportunidades` | Solicitudes compatibles para el prestador | RF14 |
| `POST /solicitudes/{id}/visitas` · `POST /visitas/{id}/confirmacion` | Proponer y confirmar visitas | RF16 |

### Cotizaciones

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /solicitudes/{id}/cotizaciones` | Enviar una cotización | RF17 |
| `POST /cotizaciones/{id}/versiones` · `POST /cotizaciones/{id}/retiro` | Actualizar o retirar | RF18 |
| `GET /solicitudes/{id}/cotizaciones` | Comparar cotizaciones | RF19 |

### Contrataciones y acuerdos

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /contrataciones/aceptaciones` | Aceptar una cotización (exige `Idempotency-Key`) | RF20 |
| `POST /contrataciones/{id}/confirmacion` · `POST /contrataciones/{id}/rechazo` | Respuesta del prestador | RF21 |
| `GET /contrataciones/{id}` · `GET /contrataciones/{id}/historial` | Estado e historial | RF26 |
| `GET /contrataciones/{id}/acuerdo` | Versión vigente del acuerdo | RF23 |
| `POST /contrataciones/{id}/cambios` · `POST /cambios/{id}/aceptacion` | Proponer y aceptar cambios | RF25 |
| `POST /contrataciones/{id}/cancelaciones` | Proponer una cancelación | RF33 |

### Seguimiento y pagos registrados

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /contrataciones/{id}/avances` | Registrar avances y fotos | RF27 |
| `POST /contrataciones/{id}/pagos` · `POST /pagos/{id}/respuesta` | Registrar y confirmar pagos directos | RF28, RF29 |
| `POST /contrataciones/{id}/finalizacion` | Comunicar el fin del trabajo | RF30 |
| `POST /contrataciones/{id}/observaciones` | Registrar observaciones | RF31 |
| `POST /contrataciones/{id}/conformidad` | Confirmar la conformidad | RF32 |

### Calificaciones, Notificaciones y Administración

| Método y ruta | Descripción | RF |
|---|---|---|
| `POST /contrataciones/{id}/calificacion` | Calificar un trabajo finalizado | RF34 |
| `GET /avisos` · `PATCH /avisos/{id}` | Consultar y marcar avisos | RF35 |
| `GET /historial` | Historial de operaciones propias | RF36 |
| `POST /incidencias` · `GET /incidencias/{id}` | Reportar y consultar problemas | RF37, RF38 |
| `POST /admin/categorias` · `PATCH /admin/categorias/{id}` | Gestionar categorías | RF39 |
| `PATCH /admin/cuentas/{id}` | Restringir o suspender cuentas | RF40 |
| `POST /admin/verificaciones/{id}/resultado` | Aprobar o rechazar una verificación | RF41 |
| `GET /admin/reportes` | Reportes de actividad | RF44 |

## 3. Reglas de contrato

- La API valida identidad, permisos y datos aunque la interfaz ya los haya comprobado.
- Un recurso que pertenece a otra persona responde 404, no 403, cuando revelar su existencia expondría información privada.
- Los contratos se documentan en OpenAPI dentro de cada funcionalidad de `specs/` y se prueban automáticamente.
- Un cambio incompatible en un contrato exige una nueva versión de la ruta (`/api/v2`).

### Operaciones de Usuarios y acceso disponibles en `/api/v1`

El contrato versionado de 001 enumera 17 operaciones. Incluye salud, cuentas,
perfiles habilitados, inicio, renovación y cierre de sesión, obtención de CSRF,
recuperación, consulta y edición de perfil, fotos, reautenticación y cambios de
correo y contraseña. Cada operación declara las cabeceras, límites, estados HTTP
y códigos aplicables. Solo inicio, renovación y cierre emiten o eliminan la cookie
de renovación. La proyección compartible de perfil se prepara en el módulo para
consumo interno. [OpenAPI de 001](../../specs/001-usuarios-y-acceso/contracts/openapi.json)

El inventario de T113 compara el router efectivo con el contrato y prueba las
variantes de transporte, origen y datos malformados. Los resultados se guardan
junto con las suites de cada historia. [Evidencia de 001](../../specs/001-usuarios-y-acceso/implementation-status.md)

---

[Índice del proyecto](../../README.md)
