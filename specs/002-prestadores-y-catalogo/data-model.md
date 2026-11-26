# Modelo de datos — 002 Prestadores y catálogo

- **Rama** `002-prestadores-y-catalogo`
- **Fecha** 2026-11-18
- **Referencia** [Especificación](spec.md) y [Plan](plan.md)

## Propiedad y referencias

PostgreSQL es la fuente de verdad. Cada módulo mantiene sus escrituras y sus migraciones. Las operaciones conjuntas usan una unidad de trabajo PostgreSQL y los contratos internos de los módulos. La composición registra las nuevas migraciones de forma aditiva. El esquema, las migraciones y los contratos de Usuarios y Acceso existentes se preservan.

| Dueño | Datos canónicos |
|---|---|
| Usuarios y Acceso | Cuenta, sesión y perfiles habilitados de la 001. La 002 obtiene la identidad con `UsuariosAcceso.exigir` y usa `cuentaId` como referencia lógica opaca. |
| Prestadores | Perfil profesional, especialidades declaradas, zonas, trabajos anteriores, referencias de imágenes y su ciclo de almacenamiento. |
| Catálogo y búsqueda | Distritos de atención, categorías y subcategorías, servicios, proyección pública para búsqueda, revisión de la oferta y confirmaciones de impacto. |
| Administración e incidencias | Autorización persistente de RF39 y auditoría del procedimiento operativo y de los cambios del catálogo. |

Los identificadores de recursos de la 002 son UUID. `prestadorId` es independiente de `cuentaId`. Las claves internas de cuenta, índices de auditoría, objetos y permisos quedan fuera de las representaciones públicas. Las claves foráneas se usan dentro de la propiedad de cada módulo. Las referencias entre módulos se validan con sus contratos públicos internos. El identificador del servicio se conserva para Solicitudes y visitas, Cotizaciones y Contrataciones y acuerdos.

## Prestadores

| Entidad | Datos y relaciones | Invariantes |
|---|---|---|
| Perfil profesional | `id`, `cuentaId` único, `nombrePublico`, `tipo`, `experiencia`, `disponibilidadDeclarada`, `version`, fechas de creación y actualización. Se relaciona con zonas, especialidades y trabajos. | Una cuenta habilitada como prestador puede mantener un perfil. El tipo es `TRABAJADOR_DE_OFICIO`, `TECNICO`, `PROFESIONAL` o `EMPRESA`. Nombre público obligatorio de hasta 120 caracteres y experiencia de hasta 3000. La disponibilidad declarada es booleana y describe la oferta vigente. |
| Especialidad declarada | `prestadorId`, `categoriaId`, clave compuesta. | `especialidadesIds` contiene al menos un identificador y sus valores son distintos. Las nuevas selecciones exigen categorías o subcategorías efectivamente activas. Su desactivación conserva la relación histórica. El catálogo resuelve la validez y la búsqueda de las clasificaciones declaradas. |
| Zona de atención | `prestadorId`, `distritoCodigo`, clave compuesta. | El perfil declara entre uno y cinco distritos distintos del catálogo de cobertura. El distrito privado de la cuenta pertenece a la 001. |
| Trabajo anterior | `id`, `prestadorId`, `titulo`, `descripcion`, `version`, fechas de creación y actualización. | Hasta diez trabajos por perfil. Título obligatorio de hasta 120 caracteres y descripción de hasta 2000. Al agregar un trabajo se comprueba `versionPerfil` y se avanza la versión del perfil en la misma transacción. |
| Fotografía de portafolio | `id`, `trabajoId`, clave de objeto opaca y única, tipo MIME, bytes, ancho, alto, checksum, fecha y condición de publicación. | Hasta cuatro fotos vigentes por trabajo y cuarenta por perfil. Únicamente imágenes comprobadas y recodificadas pueden asociarse como vigentes. La mutación usa la versión del trabajo y las respuestas documentadas devuelven la nueva `versionTrabajo`. |
| Preparación y limpieza de fotografías | Referencias técnicas propias de Prestadores a clave de objeto, vencimiento, intento, estado y próxima ejecución. | Se registra la preparación antes de escribir el objeto. Las eliminaciones pendientes sobreviven a reinicios. El procesador valida propiedad y ausencia de referencias vigentes antes de borrar. |

Los textos se validan y se persisten sin markup ejecutable. Las proyecciones se construyen por lista explícita de campos. El nombre público y el portafolio son datos profesionales de la 002. La proyección omite el teléfono y los demás campos privados de la cuenta. El contacto corresponde a la 008.

### Imágenes, límites y cambios concurrentes

- La carga valida el formato real JPG, PNG o WEBP, hasta 10 MB decimales (10 000 000 bytes) y 4096 píxeles en ancho y alto. El contrato REST transporta los bytes en Base64 con límite previo a la decodificación. Se comprueba la integridad durante la decodificación. Se aplica la orientación, se genera WebP estático con lado mayor de hasta 1600 píxeles y calidad inicial 80, y se omite copiar EXIF, GPS, XMP o IPTC. El objeto subido contiene únicamente la variante saneada.
- El contenedor de objetos permanece privado y tiene un espacio lógico y credenciales de portafolio exclusivos de la 002. El enlace público usa el identificador opaco y pasa por Prestadores, que verifica en PostgreSQL que la imagen siga asociada a un trabajo publicable y entrega la representación saneada. La respuesta evita reutilizar un objeto revocado desde cachés HTTP controladas por la aplicación.
- Se registra una clave nueva e inmutable como preparación antes del envío al almacén. Se decodifica y se almacena la imagen fuera de los bloqueos del negocio. La publicación o el reemplazo confirma el nuevo vínculo en PostgreSQL solo después de verificar la escritura y dentro de la transacción que comprueba titular, versión y cuotas. El reemplazo conserva `fotografiaId` y sustituye la clave. Tras confirmar, el enlace devuelve únicamente la nueva variante. Si el reemplazo falla, el vínculo anterior sigue vigente.
- La transacción bloquea el perfil antes del trabajo y valida los límites sobre el conjunto vigente. Una creación simultánea del último trabajo o dos intentos de ocupar el último cupo se serializan. El reemplazo mantiene el recuento. La eliminación lo reduce y registra la tarea de purga en la misma transacción que quita el acceso público.
- El procesador técnico de Prestadores reintenta las eliminaciones de forma idempotente con una reserva temporal y valida de nuevo que la clave exclusiva siga sin referencias vivas. Las preparaciones vencidas se recuperan tras el plazo máximo de operaciones en curso. La reconciliación de objetos del espacio exclusivo cubre escrituras tardías y caídas entre el envío y la confirmación. Las claves de la 001 quedan fuera de sus credenciales, recorridos y borrados.

## Catálogo y búsqueda

| Entidad | Datos y relaciones | Invariantes |
|---|---|---|
| Distrito de atención | Código único, etiqueta oficial y orden de presentación. | Semilla acotada a los cinco distritos de la constitución. |
| Clasificación | `id`, `nombre`, `nombre_clave` (generada, única entre hermanas), `nombre_normalizado` (dato heredado), `categoriaPadreId` opcional, nivel, estado propio, `version` y fechas. | La clasificación nace inactiva y su padre es inmutable. Una categoría raíz tiene nivel 1 y una subcategoría de nivel 2 depende de una raíz. El UUID identifica el recurso. `nombre_clave` la calcula PostgreSQL con `catalogo_clave_nombre(nombre)` y un índice único `(categoria_padre_id, nombre_clave)` con `NULLS NOT DISTINCT` impide hermanas equivalentes, activas o inactivas; las raíces compiten entre sí. `nombre_normalizado` es un dato heredado sin garantía de unicidad ni de criterio único de normalización: la API lo sigue escribiendo por compatibilidad, la semilla lo escribió con otro criterio y ninguna regla depende de él. Su retiro requeriría otra enmienda tras verificar dependencias. Las referencias conservan sus identificadores y su estado propio. |
| Servicio | `id`, `prestadorId`, `categoriaId`, `titulo`, `descripcion`, estado, `version` y fechas. | Un servicio tiene una clasificación y un propietario. Título de hasta 120 caracteres y descripción de hasta 2000. El retiro conserva el registro. La clasificación válida para publicar o reactivar se verifica en la transacción. |
| Proyección de prestadores para búsqueda | `prestadorId`, `nombrePublico`, `tipo`, `disponibilidadDeclarada`, especialidades, distritos y condición de publicación. | Se actualiza mediante el contrato interno y la unidad de trabajo de las mutaciones que cambian la oferta. Contiene los campos mínimos para filtrar o devolver listados públicos. Los trabajos y sus archivos se consultan al módulo Prestadores. |
| Revisión de la oferta | Identificador de la fila única y revisión persistente positiva. | Se incrementa en la transacción que cambia la oferta pública o sus filtros. Esta revisión delimita la proyección que pueden usar las lecturas y los espacios de claves de Redis. |
| Confirmación de desactivación | `confirmacionId` opaco, cuenta del operador, clasificación objetivo, versión de la clasificación, revisión de la oferta, `afectados`, fecha de emisión, `venceEn` UTC y marca de consumo. | Tiene un vencimiento operativo inicial de cinco minutos. El identificador referencia una vista previa de un operador y una clasificación concretos. Su consumo y la desactivación ocurren en una sola transacción. |

Los distritos canónicos son `ayacucho` (Ayacucho), `carmen-alto` (Carmen Alto), `san-juan-bautista` (San Juan Bautista), `jesus-nazareno` (Jesús Nazareno) y `andres-avelino-caceres-dorregaray` (Andrés Avelino Cáceres Dorregaray).

La clasificación raíz está efectivamente activa si su estado propio es activo. Para una subcategoría también debe estar activa su raíz. La jerarquía se restringe a dos niveles con verificación del nivel y vínculo a una raíz. Los servicios mantienen sus referencias y estados al cambiar el estado de una clasificación. El filtro por categoría raíz incluye su oferta directa y la de sus subcategorías efectivamente activas. El catálogo de opciones de filtro ofrece las clasificaciones activas. La especialidad y los distritos corresponden a las declaraciones vigentes del prestador. La consulta de prestadores usa su proyección pública con independencia de que tengan un servicio publicado. Con un filtro por categoría, exige una oferta visible que coincida.

### Ciclo del servicio, impacto y elegibilidad

| Estado | Transiciones del titular | Visibilidad y elegibilidad |
|---|---|---|
| `PUBLICADO` | Pausar o retirar. Edición con la versión esperada. | Puede aparecer en la oferta y aceptar solicitudes si cumple la clasificación efectiva, la habilitación aplicable y las demás condiciones vigentes. |
| `PAUSADO` | Reactivar o retirar. Edición con la versión esperada. | Permanece fuera de la oferta pública. Reactivar vuelve a validar el perfil habilitado, la clasificación y los datos exigidos para publicación. |
| `RETIRADO` | Estado terminal. | Registro histórico de solo lectura para el titular y los procesos autorizados. |

La publicación inicial crea el servicio en `PUBLICADO`. El dueño del registro y el prestador habilitado se comprueban con la identidad autenticada. Los detalles públicos y los listados del perfil aplican el mismo predicado de visibilidad que la búsqueda. El listado privado del titular incluye los registros retirados y los servicios que quedan fuera de la oferta pública. Las representaciones públicas conservan los avisos independientes de calificaciones y verificaciones. Los resultados de 011 y 012 quedarán a cargo de sus propias fuentes.

La desactivación cuenta una sola vez los servicios `PUBLICADO` hoy elegibles que perderían visibilidad o elegibilidad. Incluye los asociados directamente a la categoría objetivo y, cuando esta es raíz, los de las subcategorías efectivamente activas que se verían afectadas. Al confirmar se revalida el permiso, la versión, la revisión, la vigencia de la vista previa y el recuento. Una diferencia exige consultar y confirmar de nuevo. El cambio actualiza la clasificación, la revisión y la auditoría y consume la confirmación en la misma transacción. Al activar se recalcula la elegibilidad por estado propio y jerarquía. Un servicio pausado o retirado conserva su estado.

La 002 ofrece al uso interno una evaluación de elegibilidad por `servicioId` basada en el estado vigente de PostgreSQL. En la 003 esa comprobación debe ejecutarse en la misma unidad de trabajo que crea una solicitud. El contrato de escritura toma un bloqueo compartido sobre la revisión de Catálogo antes de evaluar y lo conserva hasta el commit de la solicitud. Las mutaciones de Catálogo que cambian elegibilidad requieren el bloqueo exclusivo de esa misma revisión. Los procesos futuros consultan registros históricos por su contrato interno y según su participación.

## Administración e incidencias

| Entidad | Datos y relaciones | Invariantes |
|---|---|---|
| Permiso de gestión de clasificaciones | `cuentaId`, permiso RF39, estado, `version` y fechas de concesión y revocación. | Clave única por cuenta y permiso. Estado vigente consultado en cada acción administrativa. La revocación conserva la fila para serializar futuras operaciones y reintentos. |
| Auditoría administrativa de la 002 | Identificador, responsable autenticado web u operativo, fecha UTC, acción, tipo e identificador del recurso, motivo de hasta 500 caracteres. | Registro de solo adición por concesión, revocación o modificación correcta de clasificación. La mutación y su registro comparten transacción. |

La primera concesión se vincula a la cuenta previamente identificada con la API de la 001 y designada por el Product Owner. El procedimiento interno valida el principal nominativo del host y la aprobación firmada. La constancia de identidad registra identificador opaco, `cuentaId`, entorno, vencimiento y consumo. El registro de aprobación de Administración conserva un identificador único, firmante, acción, cuenta, entorno, fechas, motivo, constancia cuando corresponde y consumo, sin conservar el Bearer. El ejecutor debe ser distinto del firmante y seguir habilitado para operar. El consumo de esos registros, el permiso y la auditoría se confirman en una transacción. Una revocación actúa sobre el permiso existente. Las representaciones públicas omiten la auditoría, los permisos y los identificadores de cuenta. Los resultados idempotentes preservan las mismas comprobaciones de identidad y permiso vigente antes de devolverse.

## Consistencia, restricciones e índices

- **Bloqueos de escritura.** Las operaciones adquieren los bloqueos que correspondan en este orden global, permiso de RF39, clave de idempotencia, fila de revisión de Catálogo, clasificación raíz y subcategoría, servicio, perfil y trabajo. Las filas alternativas de un mismo nivel se toman por identificador. La revisión se toma antes de las filas de negocio en todas las escrituras que afectan la oferta. Las operaciones independientes de la oferta toman solo sus recursos propios. La futura 003 tomará el bloqueo compartido de revisión antes de las filas de sus solicitudes.
- **Versionado e idempotencia.** Las entidades mutables tienen versión positiva. La actualización compara la versión esperada, aplica el cambio e incrementa la versión en PostgreSQL. Las operaciones críticas ligan el resultado confirmado a su clave de idempotencia, actor y operación. Los manejadores verifican permisos vigentes y titularidad tanto en el primer intento como al recuperar un resultado.
- **Atomicidad.** Una excepción revierte en conjunto la mutación, el resultado de idempotencia, los cambios de la proyección, la revisión, el consumo de una confirmación y la auditoría que corresponda. El acceso a objetos y a Redis ocurre fuera de la sección crítica PostgreSQL. La cola de limpieza es estado técnico de Prestadores en PostgreSQL.
- **Catálogo.** Claves primarias de recurso y claves únicas de referencia estable. Índice de raíz o padre y estado para resolver la jerarquía. Índices de servicio por titular y de servicios publicados por categoría. Índices por código de distrito y especialidad en la proyección para seleccionar prestadores y combinar filtros. Índices para identificador de clasificación y revisión en las vistas previas. La consulta SQL aplica filtros parametrizados, devuelve una página de orden estable con desempate por identificador y calcula el total sobre el mismo predicado de visibilidad.
- **Prestadores y administración.** Índices de trabajos por prestador, de fotos vigentes por trabajo, de claves de objeto y de limpieza por próxima ejecución. Permiso único por cuenta y tipo, y auditoría por recurso y fecha. Las restricciones de formato de estado, referencia y versión se protegen en la base. Los límites que dependen de varias filas se comprueban bajo bloqueo de su propietario.

## Proyección y caché

Catálogo mantiene en PostgreSQL su proyección mínima de perfiles y deriva el conjunto visible desde sus propias filas, cruzadas con la jerarquía de clasificaciones y el estado del servicio. La proyección y la revisión se escriben en la misma unidad de trabajo. Se evita depender de una actualización asíncrona para ocultar una oferta después de una desactivación.

Las referencias vigentes de Prestadores son el inventario canónico que se usa al respaldar el portafolio. El manifiesto privado enlaza ese inventario al volcado PostgreSQL del mismo corte y contiene claves y checksums de objetos saneados. El procedimiento de [respaldo y restauración](plan.md#respaldo-coordinado-y-recuperación-del-portafolio) reconcilia referencias, preparaciones y purgas antes de reactivar el limpiador y el acceso público.

Redis guarda categorías efectivamente activas y búsquedas frecuentes. Las claves incluyen entorno, espacio de claves del despliegue, versión de esquema, revisión durable, tipo de consulta, filtros normalizados, orden y página, según corresponda. Se consulta la revisión vigente a PostgreSQL antes de utilizar Redis y se verifica que los resultados obtenidos pertenezcan a una revisión coherente. Después de un fallo o cambio concurrente se repite con presupuesto acotado o se resuelve desde PostgreSQL con una lectura consistente. Una clave de una revisión anterior queda inaccesible desde las lecturas posteriores a la confirmación, aunque una réplica la repueble tarde o Redis vuelva tras una interrupción. Al restaurar PostgreSQL se cambia el espacio de claves en todas las réplicas antes de reabrir el tráfico. El TTL acota ocupación. Ante falla de Redis se usa PostgreSQL. Si no se puede comprobar la revisión en PostgreSQL, la consulta falla de forma controlada.

## Referencias técnicas

- [Fuente de datos PostgreSQL](../../tecnologia/backend/src/compartido/infraestructura/postgres/data-source.ts), [unidad de trabajo existente](../../tecnologia/backend/src/compartido/infraestructura/postgres/unidad-de-trabajo.ts) y [contrato de Usuarios y Acceso](../../tecnologia/backend/src/modulos/usuarios-acceso/api-publica.ts).
- [Aislamiento PostgreSQL 18](https://www.postgresql.org/docs/18/transaction-iso.html), [bloqueos PostgreSQL 18](https://www.postgresql.org/docs/18/explicit-locking.html), [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) y [tratamiento de metadatos en Sharp](https://sharp.pixelplumbing.com/api-output/#keepmetadata).
