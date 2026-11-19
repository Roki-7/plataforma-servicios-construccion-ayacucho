# Contratos — 002 Prestadores y catálogo

Contrato normativo de diseño [OpenAPI 3.1](openapi.json). Las 23 operaciones se publicarán bajo `/api/v1` en el mismo despliegue NestJS. El contrato usa [OpenAPI 3.1.0 y sus esquemas de datos](https://spec.openapis.org/oas/v3.1.0.html).

## Operaciones

| Método y ruta relativa a `/api/v1` | Acceso | Resultado principal |
|---|---|---|
| GET /prestadores/perfil | Titular con perfil habilitado | 200 Perfil propio y portafolio con sus versiones |
| PUT /prestadores/perfil | Titular con perfil habilitado | 201 Alta con `version: 0`, 200 actualización con versión vigente |
| POST /prestadores/perfil/trabajos | Titular con perfil habilitado | 201 Trabajo y nueva `versionPerfil` |
| PATCH /prestadores/perfil/trabajos/{trabajoId} | Titular con perfil habilitado | 200 Trabajo actualizado |
| POST /prestadores/perfil/trabajos/{trabajoId}/fotografias | Titular con perfil habilitado | 201 Foto y nueva `versionTrabajo` |
| PUT /prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId} | Titular con perfil habilitado | 200 Reemplazo con el mismo identificador y nueva `versionTrabajo` |
| DELETE /prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId}?version=… | Titular con perfil habilitado | 200 Nueva `versionTrabajo` y revocación de la URL pública |
| GET /prestadores/{prestadorId}/trabajos/{trabajoId}/fotografias/{fotografiaId} | Público, sujeto a publicación vigente | 200 Foto saneada, 404 si ya no es publicable |
| GET /prestadores | Público | 200 Página de prestadores |
| GET /prestadores/{prestadorId} | Público | 200 Perfil, portafolio, página de servicios visibles y avisos |
| GET /servicios | Público | 200 Página de servicios visibles |
| POST /servicios | Titular con perfil habilitado | 201 Servicio en PUBLICADO |
| GET /servicios/mios | Titular con perfil habilitado | 200 Página privada con servicios propios en los tres estados |
| GET /servicios/{servicioId} | Público, sujeto a visibilidad vigente | 200 Detalle público, 404 si no está visible |
| PATCH /servicios/{servicioId} | Titular con perfil habilitado | 200 Edición de un servicio PUBLICADO o PAUSADO |
| POST /servicios/{servicioId}/transiciones | Titular con perfil habilitado | 200 Estado tras pausa, reactivación o retiro |
| GET /categorias | Público | 200 Clasificaciones efectivamente activas |
| GET /admin/categorias | Identidad autenticada y permiso vigente RF39 | 200 Clasificaciones con estado propio, estado efectivo y versión |
| POST /admin/categorias | Identidad autenticada y permiso vigente RF39 | 201 Clasificación creada inactiva |
| PATCH /admin/categorias/{categoriaId} | Identidad autenticada y permiso vigente RF39 | 200 Nombre actualizado |
| POST /admin/categorias/{categoriaId}/previsualizaciones-desactivacion | Identidad autenticada y permiso vigente RF39 | 201 Confirmación temporal con recuento de servicios afectados |
| POST /admin/categorias/{categoriaId}/desactivaciones | Identidad autenticada y permiso vigente RF39 | 200 Desactivación confirmada y auditada |
| POST /admin/categorias/{categoriaId}/activaciones | Identidad autenticada y permiso vigente RF39 | 200 Activación auditada |

La concesión inicial, las concesiones posteriores y las revocaciones usan el procedimiento protegido de Administración e incidencias. Las APIs internas de identidad, catálogo, auditoría y elegibilidad se detallan en el [plan](../plan.md) y el [modelo de datos](../data-model.md). La 003 volverá a consultar la elegibilidad vigente dentro de la transacción que crea su solicitud.

## Entradas, visibilidad y concurrencia

- Todas las respuestas usan `Cache-Control: no-store` y errores JSON con `codigo`, `mensaje` y `detalles`. El almacenamiento Redis opera en el servidor.
- Las mutaciones requieren `Origin` con el origen HTTPS configurado e `Idempotency-Key`. Las operaciones protegidas aceptan el Bearer opaco de la 001. La identidad obtenida de una sesión activa, el perfil habilitado y los permisos actuales determinan el acceso. La 002 conserva las rutas de sesión y la cookie de renovación de la 001 mediante su contrato original.
- El titular se obtiene de la identidad autenticada. La API rechaza propiedades no declaradas en las entradas. Los UUID de recursos se mantienen separados de `cuentaId`. Las respuestas públicas proyectan campos permitidos y conservan privadas las referencias de cuenta, sesión, permisos, auditoría, contacto y objetos.
- El alta del perfil usa `version: 0`. Al agregar un trabajo se comprueba `versionPerfil`. Editar el trabajo usa `version` y las mutaciones de fotos usan su `versionTrabajo`. Para el DELETE sin cuerpo el parámetro obligatorio `version` representa esa misma versión del trabajo. Las operaciones de servicio y clasificación usan la versión del propio recurso. Se comprueban las versiones dentro de la transacción de la mutación.
- La clave idempotente vincula actor, método, operación, ruta objetivo con sus identificadores y datos normalizados, incluida la versión aplicable. Los reintentos de una respuesta confirmada requieren autorización vigente antes de recuperar el resultado. La misma clave con otros datos produce 409. Se reutiliza la restricción de longitud de la 001.
- La categoría padre es opcional al crear y queda fija. Una subcategoría requiere una categoría raíz existente. Las nuevas especialidades del perfil remiten a clasificaciones efectivamente activas. Se conservan las referencias previas al cambiar la actividad.
- La vista previa de desactivación devuelve `confirmacionId`, `afectados` y `venceEn` a los cinco minutos. Se registra el actor, recurso, versión, revisión de oferta y recuento observado. Al confirmar se vuelven a comprobar permiso, vínculo, vigencia, versión y recuento. Un cambio invalida la confirmación anterior. Se consume la confirmación junto con clasificación, publicación efectiva, resultado idempotente y auditoría. Los estados de los servicios y sus referencias permanecen guardados.
- Solo PUBLICADO puede ser público o elegible, sujeto a clasificación efectivamente activa y condiciones vigentes. PAUSADO y RETIRADO se consultan por el titular autorizado en `/servicios/mios`. RETIRADO permanece en solo lectura.

### Búsqueda

`categoria` y `especialidad` son UUID de clasificaciones, con búsqueda por categoría raíz que incluye su oferta directa y sus subcategorías efectivamente activas. `distrito` usa el código enumerado de los cinco distritos. `disponibilidad` acepta `true` o `false` y expresa la declaración del prestador. Coincidir en todos los filtros produce una página de orden estable. Con `pagina` inicial 1 y `tamano` inicial 20, el máximo permitido es 50 elementos por página. `total` cuenta todas las coincidencias del mismo predicado.

La búsqueda de prestadores es independiente de la existencia de servicios visibles. Al usar `categoria` se exige además un servicio visible que coincida. Una consulta válida sin coincidencias devuelve 200 con `elementos: []` y `total: 0`. Una página fuera del conjunto puede devolver `elementos: []` con `total` mayor que cero. El detalle del prestador pagina sus servicios visibles con las mismas convenciones.

Los parámetros de consulta se aceptan como un único valor por nombre declarado. Enteros y booleanos tienen representación inequívoca y el filtro `calificacion` queda reservado para la 011. Las pruebas de contrato verifican el 400 por parámetros desconocidos, duplicados o inválidos.

### Portafolio y avisos del perfil

La carga y el reemplazo reciben una foto en JSON con `tipoMime`, `contenidoBase64` y `versionTrabajo`. El tope de transporte es 14 000 000 bytes para esas operaciones y 65 536 bytes para las demás. Se validan base64 canónico, formato real, integridad y dimensiones. Solo JPG, PNG o WEBP de hasta 10 000 000 bytes decodificados y 4096 píxeles por lado. La recodificación aplica la orientación y produce WebP estático de hasta 1600 píxeles por lado, con calidad inicial 80 y sin ampliación. Se retiran EXIF, GPS y otros metadatos sensibles antes de publicar.

El portafolio admite 10 trabajos, 4 fotos por trabajo y 40 fotos por prestador. El reemplazo exitoso mantiene `fotografiaId` y usa una nueva clave inmutable en el almacén. La URL pública de la API entrega únicamente los nuevos bytes saneados desde el reemplazo confirmado. La eliminación revoca el acceso público a esa URL al confirmar, libera un cupo y deja la purga física al proceso técnico de Prestadores. La respuesta de imagen usa JSON con `tipoMime: image/webp` y base64. Los listados incluyen metadatos de la variante y enlaces a la API. El acceso al objeto saneado se resuelve en servidor.

El DTO del perfil público devuelve `avisos.calificaciones` con «Calificaciones aún no disponibles» y `avisos.verificaciones` con «Verificaciones aún no disponibles». El control de contrato de la 002 comprueba ambos textos. El esquema admite que cada valor pase a nulo cuando exista su fuente para retirar su aviso de forma independiente. Las representaciones reales de 011 y 012 definirán «Sin valoraciones» y el estado de una verificación evaluada. La 002 identifica la información profesional declarada y omite estrellas, puntuaciones e insignias sin respaldo.

## Composición con la 001

1. Conservar intactos `specs/001-usuarios-y-acceso/contracts/openapi.json` y su copia `tecnologia/backend/contracts/openapi.json`. Las pruebas existentes de la 001 comparan esos dos documentos y comprueban un router de 17 operaciones exactas.
2. Empaquetar el contrato de la 002 como artefacto separado al preparar la aplicación. La composición base de pruebas sigue usando la configuración y el router actuales. La raíz de producción registra de forma explícita controladores y dependencias de la 002 junto con los existentes en una misma aplicación y genera o carga los contratos compuestos.
3. Generar la unión determinista de `paths` y `components`. Fallar ante una colisión de método y ruta, `operationId` duplicado, referencia sin resolución o componente homónimo diferente. `Origin`, `IdempotencyKey` y `bearerAuth` se deduplican por igualdad estructural con las definiciones empaquetadas de la 001. Los demás componentes de la 002 llevan el prefijo `C002`.
4. Extender el adaptador HTTP compartido para reconocer PUT en el router contractual, registro y diagnóstico seguro, validar las consultas estrictas declaradas y aplicar el límite de imagen decodificada por operación. Mantener la validación de UTF-8, JSON, cabeceras, Bearer, los límites de la 001 y las respuestas de error de proxy. Resolver las rutas literales `/prestadores/perfil` y `/servicios/mios` antes de sus parámetros UUID en el middleware y en NestJS.
5. Validar por separado la igualdad exacta de 001 y su inventario y, sobre la composición completa, la presencia e igualdad de esas 17 operaciones, la lista de las 23 nuevas operaciones, la resolución de sus esquemas, la conformidad de respuestas y los rechazos relevantes de ambos contratos. Verificar que los activos empaquetados correspondan a sus fuentes versionadas.

## Errores que debe distinguir la validación

| HTTP | Códigos y casos |
|---|---|
| 400 | Entrada, query o versión malformada, cabecera que falta o propiedad no admitida |
| 401 | `NO_AUTENTICADO` o `SESION_NO_VALIDA` |
| 403 | `SIN_PERMISO` para rol, perfil habilitado o permiso RF39 insuficiente y `ORIGEN_NO_ADMITIDO` para origen ajeno |
| 404 | `RECURSO_NO_DISPONIBLE` para recurso que falta o no es visible. Se aplica a registros propios ajenos, fotos retiradas y oferta no visible |
| 409 | `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `CONFIRMACION_NO_VALIDA` o `IMPACTO_DESACTUALIZADO` |
| 413 | `CUERPO_DEMASIADO_GRANDE` para el transporte o `ARCHIVO_DEMASIADO_GRANDE` para la foto decodificada |
| 422 | Estado, jerarquía, clasificación, cuota, formato real o dimensiones incompatibles con las reglas de negocio |
| 503 | `DEPENDENCIA_NO_DISPONIBLE` para una dependencia necesaria. Redis caído conserva una ruta de lectura válida por PostgreSQL |

Los escenarios de validación previstos están en [Quickstart](../quickstart.md). El diseño por sí solo no acredita pruebas funcionales, regresiones de 001 ni mediciones EQ-01 y EQ-03.
