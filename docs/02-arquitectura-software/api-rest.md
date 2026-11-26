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
| Paginación | `?pagina=1&tamano=20`; la respuesta incluye `total` y `pagina`. En la 002 `tamano` admite de 1 a 50 (20 por defecto) y `pagina` empieza en 1. |
| Escrituras de 002 | Exigen `Origin` con el origen HTTPS configurado y `Idempotency-Key`; las modificaciones envían la versión esperada. Todas las respuestas de 002 llevan `Cache-Control: no-store`. |
| Entradas estrictas | Las consultas rechazan parámetros desconocidos o repetidos con 400, y los cuerpos rechazan propiedades no declaradas (por ejemplo `cuentaId`, `rol` o `activa`). |
| Fechas e importes | Fechas en ISO 8601 (UTC). Importes en céntimos y moneda `PEN`. |
| Errores | Cuerpo `{ "codigo", "mensaje", "detalles" }` con un código estable. |

| Estado HTTP | Uso |
|---|---|
| 200 / 201 / 204 | Consulta correcta / recurso creado / acción sin contenido |
| 400 | Datos con formato inválido o falta una cabecera obligatoria |
| 401 | Sin sesión o sesión vencida |
| 403 | Sin permiso o sin participación en la operación |
| 404 | El recurso no existe o no es visible para el usuario |
| 409 | Conflicto: versión desactualizada, contratación activa, clave reutilizada, confirmación u impacto obsoletos, nombre de clasificación en uso |
| 422 | Regla de negocio incumplida |
| 429 | Demasiados intentos |
| 413 | Cuerpo o archivo demasiado grande (`CUERPO_DEMASIADO_GRANDE`, `ARCHIVO_DEMASIADO_GRANDE`) |
| 500 / 503 | Error inesperado / dependencia necesaria no disponible (`DEPENDENCIA_NO_DISPONIBLE`) |

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

### Prestadores (002)

| Método y ruta | Descripción | RF |
|---|---|---|
| `GET /prestadores/perfil` · `PUT /prestadores/perfil` | Consultar y registrar o actualizar el perfil profesional propio (especialidades, experiencia, zonas y disponibilidad declarada). El alta usa `version: 0` | RF06 |
| `POST /prestadores/perfil/trabajos` · `PATCH /prestadores/perfil/trabajos/{trabajoId}` | Agregar y editar trabajos anteriores (hasta 10 por perfil) | RF06 |
| `POST /prestadores/perfil/trabajos/{trabajoId}/fotografias` · `PUT …/{fotografiaId}` · `DELETE …/{fotografiaId}?version=` | Agregar, reemplazar y eliminar fotos de un trabajo (4 por trabajo, 40 por prestador) | RF06 |
| `GET /prestadores/{prestadorId}/trabajos/{trabajoId}/fotografias/{fotografiaId}` | Fotografía pública saneada; 404 si deja de ser publicable | RF10 |
| `GET /prestadores` | Buscar prestadores visibles con filtros | RF09 |
| `GET /prestadores/{prestadorId}` | Perfil público con portafolio, servicios visibles paginados y avisos | RF10 |
| `POST /prestadores/verificacion` | Presentar documentos de verificación (**012**, fuera de la 002) | RF07 |

### Catálogo y búsqueda (002)

| Método y ruta | Descripción | RF |
|---|---|---|
| `GET /servicios` | Buscar servicios visibles con filtros | RF09 |
| `GET /servicios/{servicioId}` | Detalle público, sujeto a visibilidad vigente (404 si no está visible) | RF10 |
| `POST /servicios` | Publicar un servicio propio; nace PUBLICADO | RF08 |
| `GET /servicios/mios` | Listar los servicios propios en los tres estados | RF08 |
| `PATCH /servicios/{servicioId}` | Editar un servicio PUBLICADO o PAUSADO | RF08 |
| `POST /servicios/{servicioId}/transiciones` | Pausar, reactivar o retirar | RF08 |
| `GET /categorias` | Categorías y subcategorías efectivamente activas | RF39 |
| `POST /busquedas/interpretacion` | Interpretar una necesidad con IA (**posterior**, fuera de la 002) | RF11 |

**Filtros reales de la 002** (`GET /servicios` y `GET /prestadores`): `categoria` (UUID; si es una categoría padre incluye sus subcategorías efectivamente activas), `especialidad` (UUID), `distrito` (uno de los cinco distritos admitidos), `disponibilidad` (`true` o `false`, declarada por el prestador), `pagina` y `tamano`. **El filtro por calificación no existe todavía**: depende de las calificaciones de la funcionalidad 011 y hoy se rechaza con 400 como parámetro desconocido. El perfil público muestra los avisos «Calificaciones aún no disponibles» y «Verificaciones aún no disponibles» mientras falten las fuentes de 011 y 012.

**Fotografías.** El cuerpo es JSON con el tipo de contenido (`image/jpeg`, `image/png` o `image/webp`) y la imagen en base64. El transporte admite hasta 14 000 000 bytes, la imagen decodificada hasta 10 000 000 bytes y cada dimensión hasta 4 096 píxeles. El servidor valida el formato real, elimina los metadatos y publica una imagen WebP saneada de hasta 1 600 px por lado; el almacenamiento es un bucket privado accesible solo por el servidor. Los excesos responden 413 y las imágenes inválidas, 422.

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
| `GET /admin/categorias` · `POST /admin/categorias` · `PATCH /admin/categorias/{categoriaId}` | Listar (estado propio, efectivo y versión), crear (nace inactiva) y renombrar clasificaciones; el nombre debe ser único entre hermanas (409 `NOMBRE_CLASIFICACION_EN_USO`) | RF39 |
| `POST /admin/categorias/{categoriaId}/previsualizaciones-desactivacion` · `POST …/desactivaciones` · `POST …/activaciones` | Informar el impacto, confirmar la desactivación (con evidencia temporal) y activar | RF39 |
| `PATCH /admin/cuentas/{id}` | Restringir o suspender cuentas | RF40 |
| `POST /admin/verificaciones/{id}/resultado` | Aprobar o rechazar una verificación | RF41 |
| `GET /admin/reportes` | Reportes de actividad | RF44 |

## 3. Reglas de contrato

- La API valida identidad, permisos y datos aunque la interfaz ya los haya comprobado.
- Un recurso que pertenece a otra persona responde 404, no 403, cuando revelar su existencia expondría información privada.
- Los contratos se documentan en OpenAPI dentro de cada funcionalidad de `specs/` y se prueban automáticamente.
- Un cambio incompatible en un contrato exige una nueva versión de la ruta (`/api/v2`).

### Composición de la 001 y la 002 en `/api/v1`

El arranque completo publica **40 operaciones en un solo monolito NestJS**: las **17** de la 001 y las **23** de la 002. La 002 es **aditiva**: no cambia ninguna operación de la 001, rechaza colisiones de `operationId` y de ruta y usa el mismo adaptador HTTP de validación. Los contratos de partida son [001](../../specs/001-usuarios-y-acceso/contracts/openapi.json) y [002](../../specs/002-prestadores-y-catalogo/contracts/openapi.json) (con su espejo en `tecnologia/backend/contracts/`). La composición base sin la 002 conserva sus 17 operaciones.

**Precedencia de rutas.** Las rutas literales se registran antes que las de parámetro: `/prestadores/perfil` antes de `/prestadores/{prestadorId}` y `/servicios/mios` antes de `/servicios/{servicioId}`. La aplicación comprueba el orden al arrancar.

**Seguridad.** Las operaciones protegidas usan el Bearer opaco de la 001; las de gestión de categorías exigen además el permiso vigente de RF39, que se comprueba en cada operación. El alta y la revocación de ese permiso no tienen ruta HTTP: pertenecen a un procedimiento operativo interno.

**Errores de la 002.** Cuerpo `{ codigo, mensaje, detalles }` con códigos estables: 400 `DATOS_INVALIDOS` y `PROPIEDAD_NO_ADMITIDA`; 401 `NO_AUTENTICADO` o `SESION_NO_VALIDA`; 403 `SIN_PERMISO` u `ORIGEN_NO_ADMITIDO`; 404 `RECURSO_NO_DISPONIBLE` (también para recursos ajenos o no visibles); 409 `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `CONFIRMACION_NO_VALIDA`, `IMPACTO_DESACTUALIZADO` y `NOMBRE_CLASIFICACION_EN_USO`; 413 `CUERPO_DEMASIADO_GRANDE` o `ARCHIVO_DEMASIADO_GRANDE`; 422 reglas de negocio (jerarquía, estado, cuota, formato); 503 `DEPENDENCIA_NO_DISPONIBLE`. Redis caído no produce error: se consulta PostgreSQL.

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
