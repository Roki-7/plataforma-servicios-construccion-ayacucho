# Contratos — 003 Solicitudes y cotizaciones

Contrato normativo de diseño [OpenAPI 3.1](openapi.json). Las 18 operaciones se publicarán bajo `/api/v1` en el mismo despliegue NestJS. Compuesto con los contratos de la 001 (17 operaciones) y la 002 (23 operaciones) forma **58 operaciones**. Esa composición se verificó con el ensamblador real del repositorio, sin colisiones de ruta ni de `operationId` y con todas las referencias resueltas. Los nueve esquemas de entrada compilan con Ajv 2020 y se comprobaron con casos válidos e inválidos.

El espejo ejecutable `tecnologia/backend/contracts/solicitudes-cotizaciones.openapi.json` **se crea en la implementación** y una prueba exige que sea idéntico a este archivo, como en la 002.

## Operaciones

| Método y ruta relativa a `/api/v1` | `operationId` | Acceso | Resultado principal |
|---|---|---|---|
| POST /solicitudes | `crearSolicitud003` | Cliente | 201 Borrador. Solo `tipo` es obligatorio. |
| GET /solicitudes | `listarMisSolicitudes003` | Cliente (`rol=cliente`, por defecto) o prestador (`rol=prestador`) | 200 Página de solicitudes propias o, con `rol=prestador`, de las dirigidas al prestador en cualquier estado salvo borrador y de aquellas donde tiene una cotización no retirada. Filtro `estado`. 403 si `rol=prestador` y no tiene perfil prestador. |
| GET /solicitudes/oportunidades | `listarOportunidades003` | Prestador | 200 Publicadas compatibles y dirigidas, solo ABIERTAS. Una dirigida CERRADA se localiza con `GET /solicitudes?rol=prestador` |
| GET /solicitudes/{solicitudId} | `obtenerSolicitud003` | Dueño o prestador con título | 200 Vista privada o visible, 404 sin título |
| PATCH /solicitudes/{solicitudId} | `editarSolicitud003` | Dueño | 200 Solicitud actualizada |
| POST /solicitudes/{solicitudId}/publicacion | `publicarSolicitud003` | Dueño | 200 ABIERTA con la versión de trabajo 1 |
| POST /solicitudes/{solicitudId}/cierre | `cerrarSolicitud003` | Dueño | 200 CERRADA |
| GET /solicitudes/{solicitudId}/historial | `consultarHistorialSolicitud003` | Versiones: dueño, destinatario y autores no retirados. Bitácora: solo el dueño | 200 Página, 404 en otro caso |
| POST /solicitudes/{solicitudId}/archivos | `cargarArchivoSolicitud003` | Dueño | 201 Archivo PREPARADO |
| GET /solicitudes/{solicitudId}/archivos/{archivoId} | `obtenerArchivoSolicitud003` | Según la política de fotografías | 200 Imagen WebP saneada, 404 sin permiso |
| POST /solicitudes/{solicitudId}/cotizaciones | `enviarCotizacion003` | Prestador compatible o destinatario | 201 Cotización |
| GET /solicitudes/{solicitudId}/cotizaciones | `listarCotizacionesDeSolicitud003` | Dueño | 200 Página. Con `ids`, vista de comparación |
| GET /cotizaciones | `listarMisCotizaciones003` | Prestador | 200 Página de cotizaciones propias |
| GET /cotizaciones/{cotizacionId} | `obtenerCotizacion003` | Autor y dueño de la solicitud | 200 Cotización con sus versiones |
| POST /cotizaciones/{cotizacionId}/versiones | `actualizarCotizacion003` | Autor | 201 Versión nueva |
| POST /cotizaciones/{cotizacionId}/retiro | `retirarCotizacion003` | Autor | 200 Cotización retirada |
| POST /cotizaciones/{cotizacionId}/aclaraciones | `enviarAclaracion003` | Dueño de la solicitud o autor | 201 Mensaje |
| GET /cotizaciones/{cotizacionId}/aclaraciones | `listarAclaraciones003` | Dueño de la solicitud o autor | 200 Página de mensajes |

## Relación con `api-rest.md`

`api-rest.md` ya preveía ocho de estas operaciones (`POST /solicitudes`, `PATCH /solicitudes/{id}`, el cierre, las oportunidades, el envío, la actualización, el retiro y el listado de cotizaciones). La 003 añade diez, necesarias para los recorridos de la especificación: listado y detalle de solicitudes, publicación, historial, carga y lectura de archivos, listado y detalle de cotizaciones y las dos de aclaraciones. La implementación actualiza `api-rest.md` y la matriz de seguridad.

**Sin rutas nuevas para tres funciones.** El historial y la bitácora comparten una sola operación (`tipo=versiones|bitacora`) para no inflar el detalle. La comparación de hasta 10 cotizaciones usa el parámetro `ids` de la operación de listado existente. La localización de una dirigida cerrada usa el parámetro `rol` del listado de solicitudes.

## Entradas, visibilidad y concurrencia

- Todas las respuestas usan `Cache-Control: no-store` y errores JSON con `codigo`, `mensaje` y `detalles`.
- Las mutaciones exigen `Origin` con el origen HTTPS configurado, `Idempotency-Key` y el Bearer opaco de la 001. Las lecturas exigen el Bearer. Ninguna operación es pública.
- La identidad sale de la sesión, nunca del cuerpo. Los esquemas rechazan propiedades no declaradas. Los UUID de recursos son independientes de las cuentas.
- **Versión de control** (`version`): las modificaciones de una solicitud la exigen y devuelven 409 `VERSION_DESACTUALIZADA` si está desactualizada. **Versión de trabajo** (`versionTrabajo`, `versionTrabajoSolicitud`): una cotización indica la que revisó y recibe 409 `SOLICITUD_MODIFICADA` si ya no es la vigente. **Versión de cotización** (`versionCotizacion`): protege la actualización y el retiro.
- `PATCH /solicitudes/{id}` acepta `tipo`, `prestadorId` y `servicioId` solo para poder responder 422 `CAMPO_NO_MODIFICABLE` cuando difieren tras publicar. El mismo valor no es un cambio.
- **Carga de imágenes.** Una por petición, con `x-limite-cuerpo-bytes: 14000000` y un máximo decodificado de 10 000 000 bytes, igual que la 002. Se recodifica a WebP sin metadatos. El archivo queda PREPARADO y solo lo ve su dueño. Se confirma con `archivosIds` al guardar el borrador, publicar o editar.
- **Consulta `ids`.** UUID separados por coma, hasta 10. Con más, 422 `LIMITE_COMPARACION`. El límite de 4 096 caracteres es técnico (línea de petición). El validador de consultas de la plataforma no admite parámetros repetidos.
- **Paginación.** `pagina` desde 1 y `tamano` hasta 50, con orden determinista y total de la misma lectura.
- **Datos que no existen en las respuestas.** Teléfono, correo, datos de contacto de la otra parte y direcciones públicas de archivos.

## Códigos de error

| Estado | Códigos |
|---|---|
| 400 | `DATOS_INVALIDOS`, `PROPIEDAD_NO_ADMITIDA`, `CABECERA_REQUERIDA` |
| 401 | `NO_AUTENTICADO`, `SESION_NO_VALIDA` |
| 403 | `SIN_PERMISO`, `ORIGEN_NO_ADMITIDO` |
| 404 | `RECURSO_NO_DISPONIBLE` (también cuando el solicitante no tiene título) |
| 409 | `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `SOLICITUD_MODIFICADA`, `SOLICITUD_NO_ABIERTA`, `COTIZACION_EXISTENTE`, `COTIZACION_RETIRADA`, `CONFLICTO_CONCURRENTE` |
| 413 | `ARCHIVO_DEMASIADO_GRANDE`, `CUERPO_DEMASIADO_GRANDE` |
| 422 | `SOLICITUD_INCOMPLETA`, `COTIZACION_INCOMPLETA`, `CAMPO_NO_MODIFICABLE`, `COTIZACION_PROPIA`, `AUTODIRECCION_NO_PERMITIDA`, `PRESTADOR_NO_DISPONIBLE`, `SERVICIO_NO_ELEGIBLE`, `SERVICIO_NO_PERTENECE_AL_PRESTADOR`, `CATEGORIA_NO_COINCIDE_CON_SERVICIO`, `CATEGORIA_NO_ACTIVA`, `FECHA_NO_VALIDA`, `DATOS_PERSONALES_EN_TEXTO`, `LIMITE_ARCHIVOS`, `ARCHIVO_NO_LISTO`, `ARCHIVO_EXPIRADO`, `IMAGEN_FORMATO_NO_ADMITIDO`, `IMAGEN_DIMENSIONES_NO_ADMITIDAS`, `LIMITE_ACLARACIONES`, `LIMITE_COMPARACION` |
| 503 | `DEPENDENCIA_NO_DISPONIBLE` |

Los códigos `DATOS_INVALIDOS`, `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `RECURSO_NO_DISPONIBLE`, `DEPENDENCIA_NO_DISPONIBLE`, `IMAGEN_FORMATO_NO_ADMITIDO`, `ARCHIVO_DEMASIADO_GRANDE` y `CATEGORIA_NO_ACTIVA` ya existen en la 001 o la 002. Los demás son nuevos.

## Límites del contrato

- No incluye ninguna operación de selección, aceptación ni contratación (004), ni de entrega o lectura de avisos (006).
- `motivosNoAceptable` vacío significa que la 003 no detecta impedimentos. No significa que una cotización pueda aceptarse.
- **Sin máximos de negocio arbitrarios.** `precioCentimos` solo está acotado por 2^53 − 1 (el mayor entero exacto de JSON) y `plazoDias` por el entero de 32 bits. Las versiones de una cotización no tienen tope. Los demás límites están justificados en `research.md`, R-24.
- Los componentes `IdempotencyKey`, `Origin` y `bearerAuth` son idénticos a los de la 001 y la 002, como exige el ensamblador. El resto usa el prefijo `C003`.
