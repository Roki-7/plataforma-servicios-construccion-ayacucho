# Plan de implementación — 002 Prestadores y catálogo

**Rama** `002-prestadores-y-catalogo` · **Fecha** 2026-11-18 · **Base documental** `eb800b4`

**Entrada** [Especificación aclarada](spec.md) · **Estado** Diseño para revisión

## Resumen

Entregar el perfil profesional y su portafolio (HU03/RF06), publicación y ciclo de servicios (HU04/RF08), búsqueda y detalle públicos (HU05/RF09–RF10), y gestión autorizada de categorías (HU25/RF39). Prestadores, Catálogo y búsqueda, y Administración e incidencias asumen estas responsabilidades dentro del monolito de diez módulos. Usuarios y acceso aporta la identidad por su API interna. PostgreSQL controla la elegibilidad y la revisión de la oferta. Redis acelera las lecturas repetidas de categorías y búsquedas con respaldo en PostgreSQL.

## Contexto técnico

| Aspecto | Diseño |
|---|---|
| Lenguaje y plataforma | Node.js `>=24.15.0 <25`, TypeScript 6, NestJS 12 y Express 5, React 19 con Vite 8. Aplicación web responsive sobre HTTPS y monolito desplegado en Docker. |
| Persistencia | PostgreSQL 18, TypeORM 0.3 con migraciones aditivas y unidad de trabajo existente. Redis 8 mediante adaptador de caché con cliente Node, conexiones acotadas y métricas. |
| Archivos | Garage/S3 compatible, AWS SDK y Sharp ya presentes en el repositorio. Un bucket privado de portafolio con principal propio separa el acceso de los recursos de cuenta. |
| API | OpenAPI 3.1 bajo `/api/v1`, AJV y Supertest. JSON en español y camelCase. Errores con `codigo`, `mensaje` y `detalles`. Fechas UTC, control de versión e idempotencia de mutaciones. |
| Pruebas | Jest, Vitest, Supertest, dependency-cruiser, Playwright, k6, ESLint y GitHub Actions. Integraciones contra PostgreSQL real, Redis y almacenamiento local compatibles con la réplica de despliegue. |
| Alcance y escala | Cinco distritos. 10 trabajos por perfil, 4 fotos por trabajo y 40 por prestador. Hasta 10 MB decodificados y 4096 px por lado. Datos de carga de la 002 con 1 000 prestadores y 5 000 servicios. |
| Metas | EQ-01 y EQ-03 exigen p95 ≤ 2 s y menos de 1 % de errores técnicos en las configuraciones evaluadas. Las mediciones se documentarán por operación, con corrección funcional y recursos reales. |

Las decisiones de diseño, sus alternativas y sus fuentes quedan en [investigación](research.md). Los parámetros de operación como límites de conexión, tiempos de espera y TTL se calibrarán con los ensayos de aceptación de esta entrega.

## Verificación de la constitución

| Principios | Antes de investigar | Diseño resultante y comprobación prevista |
|---|---|---|
| I, II y XII · módulos, capas y simplicidad | Monolito y diez módulos como límite fijo. | Tres módulos existentes realizan la entrega. Comunicación por APIs internas y unidad de trabajo local. Se comprobarán titularidad de datos, dirección de dependencias y ausencia de ciclos con dependency-cruiser. |
| IV · identidad, permisos y privacidad | La 001 conserva la autenticación. El permiso de RF39 pertenece a Administración. | Bearer de la 001, permiso persistente comprobado al operar, auditoría, listas explícitas de campos públicos, almacenamiento privado y copias coordinadas con ensayo aislado. Se comprobarán PR04, revocación, protección de archivos y recuperación. |
| III, V, VI y VIII · otras capacidades | La 002 pertenece a oferta y clasificación. | La elegibilidad queda disponible para 003. Se preservan referencias para flujos posteriores. La integración de IA, las notificaciones de negocio, la contratación y los pagos permanecen en sus entregas correspondientes. |
| VII · REST | Contratos por funcionalidad, compatibilidad de la 001 y validación efectiva de nuevas rutas. | OpenAPI 002 independiente y documento efectivo ensamblado por la composición. Se comprobarán inventarios exactos, ejemplos HTTP y seguridad de ambas composiciones. |
| IX, X y XI · pruebas, stack y trazabilidad | Metas EQ pendientes de medición. Redis de lectura con respaldo en PostgreSQL. | Redis activo desde la entrega, verificación de invalidación y respaldo. Cobertura prevista de los 35 escenarios, PR04 y PR07, y mediciones EQ-01/PR01 y EQ-03/PR03. |

**Resultado después del diseño.** El plan satisface los límites de la constitución. Las verificaciones de ejecución quedan registradas en la [guía de validación](quickstart.md). La aprobación de la especificación y del diseño sigue el flujo SDD del proyecto.

## Estructura prevista

```text
specs/002-prestadores-y-catalogo/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── README.md
│   └── openapi.json
└── quickstart.md

tecnologia/
├── backend/
│   ├── src/composicion/                         # ensamblaje y arranques
│   ├── src/compartido/                          # HTTP, unidad de trabajo e idempotencia
│   ├── src/modulos/prestadores/                 # perfil profesional y portafolio
│   ├── src/modulos/catalogo/                    # servicios, categorías y búsqueda
│   ├── src/modulos/administracion/              # autorización y auditoría RF39
│   └── test/{unit,integration,contract,architecture,performance}/
└── frontend/
    ├── src/features/prestadores-catalogo/
    └── test/{unit,e2e}/
```

Cada nuevo directorio de negocio materializa un módulo ya descrito en el [C4 de componentes](../../docs/04-modelo-c4/03-nivel3-componentes.md). El dominio permanece independiente de NestJS, TypeORM y otros módulos. La aplicación declara puertos y la raíz de composición conecta adaptadores HTTP, PostgreSQL, Redis y S3. Los recorridos web usan las convenciones de sesión existentes y separan modelos, casos de uso y adaptadores.

## Diseño por responsabilidad

### Prestadores y portafolio

- El perfil profesional conserva un UUID público independiente y vincula de forma privada el identificador de cuenta validado por la 001. El titular con perfil habilitado registra su nombre público, tipo, experiencia, especialidades de Catálogo, distritos y disponibilidad declarada. Un perfil válido es consultable. Catálogo recibe una proyección explícita de campos públicos dentro de la misma unidad de trabajo.
- Los distritos usan un catálogo fijo con los códigos canónicos del [modelo de datos](data-model.md). Las zonas profesionales son independientes del distrito de la cuenta. Las taxonomías públicas se leen de Catálogo. Se conservan las asignaciones previas cuando se desactiva una clasificación.
- El titular agrega y modifica trabajos y agrega, reemplaza y elimina sus fotografías. El bloqueo del perfil y del trabajo, la versión esperada y las comprobaciones de cardinalidad preservan las cuotas con escrituras simultáneas. El reemplazo mantiene el cupo y conserva la foto anterior ante rechazo.
- El backend reconoce formato real y valida tamaño, dimensiones y decodificación antes de publicar. Sharp reorienta la imagen y genera una variante estática WebP sin metadatos de origen, con lado mayor de hasta 1600 px, sin ampliación y calidad inicial 80. Se verifica la variante sanitizada y se guarda bajo una clave inmutable. El listado incluye referencias de foto y la web carga cada imagen cuando se necesita.
- Una intención persistente registra la preparación antes del PUT a S3. Se publica la referencia en PostgreSQL una vez confirmado el objeto. Reemplazo y eliminación retiran acceso en el commit y programan limpieza durable. Un proceso del monolito reclama trabajos con arrendamiento y reintentos, comprueba el ámbito del bucket y que la clave siga sin referencias, y recupera preparaciones vencidas. La identidad del bucket del portafolio carece de acceso a recursos privados de la 001. El backend valida la referencia vigente antes de servir la foto y responde con `no-store`.
- Para CA-PRE-06 se detiene una alta de prueba antes de confirmar su referencia. El GET público para el ID pendiente devuelve 404 `RECURSO_NO_DISPONIBLE`. Una vez confirmada, responde 200 con el WebP saneado y sin EXIF, GPS, XMP o IPTC sensibles. Un reemplazo conserva la variante vigente durante la preparación y entrega solo la nueva desde el commit.

### Respaldo coordinado y recuperación del portafolio

1. **Corte.** Asignar un `backupId`, detener nuevas escrituras de portafolio y pausar su limpieza en todas las réplicas. Esperar operaciones en curso de publicación, reemplazo y purga. Si el drenaje no se confirma, abortar el conjunto. Exportar una instantánea PostgreSQL de solo lectura, mantenerla vigente mientras se genera el volcado y leer desde esa misma instantánea las referencias de fotografías vigentes. Copiar los objetos inmutables de esa lista antes de reanudar las escrituras y el limpiador.
2. **Conjunto compatible.** El manifiesto privado registra `backupId`, corte UTC, origen lógico, versión mayor de PostgreSQL, revisión de aplicación y migraciones, SHA-256 del volcado y un inventario de cada clave, tamaño, MIME y SHA-256 de la imagen saneada. Declarar `COMPLETO` solo tras cotejar ambos lados y comprobar que cada referencia vigente tenga su objeto y checksum. El catálogo de copias corresponde a operación y queda fuera de las respuestas públicas. Un conjunto `INCOMPLETO` queda excluido de recuperación. La pareja cubre el portafolio de 002 y conserva el procedimiento independiente de recursos privados de 001.
3. **Protección.** Cifrar los artefactos en tránsito y en reposo, con almacenamiento de respaldo privado y permisos separados para lectura y restauración. Registrar el resultado y los conteos sin tokens, credenciales ni URLs de objetos. Conservar la copia según la política operativa de retención y excluirla del limpiador de fotografías.
4. **Restauración.** Seleccionar una pareja `COMPLETO` de manifiesto, volcado y objetos del mismo `backupId`, verificar versiones y sumas y restaurar en una base y un bucket privados nuevos, con tráfico y limpiador detenidos. Reconciliar las referencias del corte, descartar de la entrega las preparaciones inconclusas y dejar los objetos no referenciados en cuarentena para revisión del limpiador. Validar destinatario, hashes y ACL. Si falta una pieza, falla su integridad o hay bajas posteriores conocidas sin conciliar, mantener el tráfico público cerrado. Una restauración parcial se reintenta en un destino limpio. Cambiar el espacio Redis en todas las réplicas antes de abrir tráfico. Tras validar, reanudar la limpieza con comprobación de referencias y el acceso autorizado a las fotos vigentes.
5. **Ensayo.** Usar únicamente infraestructura descartable con datos ficticios. Restaurar una foto vigente y su checksum, probar que una baja anterior al corte sigue sin acceso, que los objetos y preparaciones huérfanos no se publican y que el anonimato sobre el bucket falla. Inyectar una pareja incorrecta, un objeto ausente o alterado y una restauración interrumpida. El ensayo debe demostrar que se impide abrir tráfico y que el reintento recupera un conjunto válido. [Operación y evidencia](quickstart.md#respaldo-y-restauración-del-portafolio) · [Instantáneas PostgreSQL](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION) · [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).

### Catálogo, servicios y búsqueda

- Catálogo es dueño de servicios y de la jerarquía categoría/subcategoría. La relación al padre se fija al crear la subcategoría. Una clasificación nueva se activa explícitamente. La actividad efectiva exige que la clasificación y su padre aplicable estén activos. Las especialidades siguen esta taxonomía y sus códigos no se duplican en un catálogo separado.
- La publicación inicial crea un servicio `PUBLICADO`. Para publicar o reactivar se valida el titular, su perfil habilitado, la clasificación y los datos vigentes. Las transiciones permitidas son las cuatro de la especificación. `RETIRADO` sigue siendo consultable por titular y procesos autorizados como histórico. El estado del servicio permanece independiente del estado de su clasificación.
- Solo servicios `PUBLICADO` con clasificación efectivamente activa y condiciones vigentes integran la oferta pública y la elegibilidad. La API interna de Catálogo ofrece a la 003 la comprobación con contexto de transacción y bloqueo compartido de la revisión de Catálogo hasta el commit de la solicitud. Así se serializa la escritura futura con cambios de elegibilidad que toman el bloqueo exclusivo de la revisión.
- La búsqueda combina filtros de categoría, especialidad, distrito y disponibilidad declarada. La categoría raíz incluye subcategorías activas. El filtro de categoría en la búsqueda de prestadores requiere al menos un servicio visible que coincida. El orden es determinista con desempate por UUID y el total pertenece a la misma instantánea que la página. PostgreSQL emplea consultas parametrizadas e índices sobre relaciones y patrones de filtros medidos. Un filtro no reconocido, incluido `calificacion`, recibe 400. El perfil público mantiene por separado los avisos de calificaciones y verificaciones hasta 011 y 012.

### Administración y auditoría de RF39

- El servidor obtiene el `cuentaId` y los perfiles mediante `UsuariosAcceso.exigir(token)`. Administración lee el permiso específico y persistente en PostgreSQL. Para mutaciones bloquea la fila del permiso y vuelve a comprobarla antes de cualquier resultado del registro idempotente o acción de negocio. La revocación usa la misma fila. Después de su commit, se rechaza toda operación nueva del operador aunque su sesión siga abierta. La autorización de categorías es independiente de los perfiles de cliente/prestador y del procedimiento operativo de permisos.
- **Identidades y designación.** El comando interno corre en un host operativo reservado. Obtiene el principal nominativo autenticado del sistema y comprueba la autorización vigente para operar RF39 en una configuración protegida, excluyendo nombres de actor suministrados por argumentos o variables de usuario. La persona designada acredita la cuenta por su propia sesión 001, con entrada efímera oculta en el canal interno. El sistema obtiene `cuentaId` con `UsuariosAcceso.exigir` y genera una constancia interna breve ligada a esa cuenta, sin conservar el Bearer.
- **Aprobación y ejecución.** El Product Owner firma la designación de una cuenta existente o su revocación. La aprobación Ed25519 incluye identificador único, acción, permiso RF39, `cuentaId`, motivo, entorno, vigencia UTC y, para concesión, el identificador de la constancia. El comando verifica la firma con la clave pública configurada fuera del repositorio, el estado autorizado del ejecutor, la coincidencia de cuenta y constancia y el uso único. La configuración protegida identifica por separado al titular de la clave y al principal del host en el mismo registro de identidades. El comando exige que correspondan a personas distintas. Revocar se dirige a la cuenta del permiso existente y no requiere una nueva sesión del titular. El permiso de categorías por sí solo carece de capacidad operativa. La red HTTP conserva el contrato actual, sin altas ni revocaciones públicas.
- **Confirmación.** Una unidad de trabajo bloquea las filas aplicables, consume la aprobación y, cuando corresponda, la constancia, y confirma permiso y auditoría juntos. Un fallo revierte los tres efectos y permite un reintento autorizado. La auditoría conserva el responsable operativo, el identificador de aprobación, fecha UTC, acción, cuenta objetivo y motivo. Las pruebas deben rechazar un operador sin autorización, que se autoconceda o sea el firmante, una cuenta distinta, una firma o vigencia inválidas y una aprobación reutilizada. [Verificación de firmas en Node.js](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback).
- Administración coordina la autorización, el registro de auditoría y la confirmación. Catálogo ejecuta la mutación mediante su API interna y una unidad de trabajo común. La auditoría registra fecha UTC, responsable, acción, recurso afectado y motivo. Sin auditoría confirmada, la mutación tampoco se confirma.
- Antes de desactivar, se muestra el recuento de servicios públicos o elegibles que perderían esa condición, incluyendo subcategorías. La evidencia temporal de confirmación vincula actor, clasificación, versión, revisión y recuento. Al confirmar, el backend vuelve a autorizar, valida vigencia y recuento y consume la evidencia dentro de la misma transacción. Una vista previa vencida o desactualizada requiere una nueva confirmación. La reactivación restituye la oferta que vuelve a cumplir las condiciones. Los estados y las referencias históricas se conservan.

### Redis, proyección y consistencia

1. **Escritura.** Una transacción PostgreSQL actualiza las fuentes, la proyección pública aplicable y una revisión global monotónica propiedad de Catálogo. La secuencia de bloqueos es permiso del operador cuando corresponda, clave de idempotencia, revisión de Catálogo y filas de negocio en orden estable. El cambio de visibilidad se calcula con la jerarquía vigente, incluidos los hijos de la clasificación. La llamada a Redis queda fuera del commit y su disponibilidad no condiciona confirmar una mutación.
2. **Lectura.** Consultar la revisión en el primario de PostgreSQL y limitar el tiempo dedicado a Redis. La clave incluye entorno, espacio de claves del despliegue, versión de representación, revisión, tipo de listado, filtros y paginación normalizados. Un acierto se acepta después de volver a consultar la revisión. En un fallo o un cambio de revisión, leer PostgreSQL en una instantánea coherente para resultado y total. Si la revisión cambia mientras se llena la caché, la clave anterior queda aislada y la respuesta se obtendrá de una lectura coherente vigente.
3. **Respaldo.** Ante Redis vacío, corrupto o caído, PostgreSQL sigue atendiendo las consultas. Al recuperarse Redis, se usan solo claves de la revisión vigente. Antes de reabrir tráfico tras restaurar PostgreSQL, asignar a todas las réplicas un nuevo espacio de claves de 002 para que revisiones anteriores reutilizadas por la restauración no coincidan con claves viejas. Si PostgreSQL es inaccesible, responder 503 en las consultas dependientes. Emplear TTL inicial de 1 h para categorías y 60 s para búsquedas con variación para distribuir expiraciones. La revisión manda sobre el TTL. Las consultas de detalle y fotografía usan PostgreSQL y las políticas de acceso vigentes.
4. **Observabilidad.** Medir aciertos, fallos, respaldo, tiempo de Redis, lectura y espera de la revisión, tiempos SQL, número de conexiones y evicciones. Acotar cardinalidad, memoria y espera de Redis. Los logs registran operación y resultado agregado, con filtros personales, cuerpos e identificadores protegidos excluidos de los registros.

### HTTP y compatibilidad de la 001

1. **Fuentes.** El contrato de [002](contracts/openapi.json) aporta las operaciones nuevas de perfil, trabajos y fotografías, servicios, consultas y administración de categorías. `specs/001-usuarios-y-acceso/contracts/openapi.json` y `tecnologia/backend/contracts/openapi.json` siguen siendo las fuentes de la composición base de 001. El OpenAPI efectivo se genera para el arranque completo a partir de las dos fuentes y se empaqueta junto con los artefactos correspondientes.
2. **Composición.** Mantener `crearAplicacion` con sus opciones por defecto para el entorno base y las pruebas de 001. El arranque completo registra explícitamente controladores/proveedores de 002, migraciones aditivas y contrato combinado dentro del mismo Nest. El ensamblador preserva cada operación y componente de 001, rechaza colisiones ambiguas y referencias inválidas y verifica la unicidad de `operationId`. Las rutas estáticas como `/prestadores/perfil` y `/servicios/mios` tienen precedencia sobre plantillas tanto en Nest como en el middleware.
3. **Validación.** Habilitar PUT y parámetros de consulta de 002 explícitamente en el adaptador compartido. Limitar a 65 536 bytes los cuerpos JSON ordinarios y a 14 000 000 bytes el transporte de una foto, con máximo decodificado de 10 000 000. Aplicar Bearer contractual, `Origin` y `Idempotency-Key` a las escrituras de 002 y la versión esperada a las modificaciones. Un lector 001 prueba la sesión, y cada caso de uso comprueba autorización y titularidad. Registrar 401 por falta de identidad, 403 por permiso insuficiente, 404 para recursos no públicos o ajenos cuando corresponda y 409 para versiones obsoletas, claves reutilizadas o confirmaciones obsoletas.
4. **Idempotencia.** Usar una extensión aditiva del almacén compartido en un ámbito de cuenta exclusivo de 002. La huella incluye método, ruta lógica, IDs concretos, versión y representación canónica del cuerpo, con hash de bytes para fotos. La operación nueva acepta el contexto de transacción del caso de uso, bloquea la clave y graba el resultado junto con los cambios. Los reintentos verifican sesión y autorización vigente antes de recuperar el resultado. Se conserva la interfaz preexistente de la 001.
5. **Regresión.** La suite X-08 conserva las 17 operaciones y la igualdad de ambos contratos de 001 en su arranque base. Añadir una suite en la composición completa para comparar las operaciones y componentes base, cotejar el router con la unión y repetir los escenarios críticos de autenticación, Origin, CSRF, límites JSON, visibilidad de fotos de cuenta y escritura concurrente de la 001. Validar el empaquetado de ambos contratos y el montaje con HTTPS.

El [contrato de la 002 y su guía](contracts/README.md) fijan nombres de rutas, parámetros, versiones, estados y errores. Las capacidades de otorgar y revocar permisos se ejercen por el procedimiento operativo de Administración.

## Validación y evidencia

| Cobertura | Ensayos previstos |
|---|---|
| HU03 · CA-PRE-01 a 08 | Dominio y validaciones, PostgreSQL real con cuotas concurrentes, contrato HTTP, S3 con geometría, metadatos y pérdida de escritura, E2E de portafolio. |
| HU04 · CA-SER-01 a 09 | Máquina de estados, versión y reintentos, visibilidad posterior a pausa y retiro, titularidad, elegibilidad y preservación de referencias. |
| HU05 · CA-BUS-01 a 08 | Combinaciones de filtros y total por página, datos públicos permitidos, avisos independientes, caída de Redis, carga y trayectos web. |
| HU25 · CA-CAT-01 a 10 | Identidad y permisos, alta inicial, revocación con sesión abierta, confirmación obsoleta, auditoría atómica, jerarquía y cambio público con Redis antes, durante y después de una caída. |
| PR04 / EQ-04 y arquitectura | Todas las peticiones denegadas de la matriz deben rechazar sin mutar ni divulgar. Validar dependencias y contrato privado de módulos siguiendo PR12 como precedente arquitectónico. |
| PR07 / EQ-07 | Navegadores Chromium, Firefox y WebKit en 360, 768 y 1366 px. Comprobar recorridos web y revisión manual de legibilidad, controles por teclado y mensajes de estado. |
| PR01 / EQ-01 | 50 usuarios concurrentes, 15 minutos, pausas de 3–8 s y datos ficticios. p95 ≤ 2 s, fallos técnicos < 1 %. Medir las operaciones HTTP de búsqueda y consulta de la API por separado con RPS y corrección. |
| PR03 / EQ-03 | Base de una réplica a 25 y 50 usuarios, ampliación de dos réplicas a 50 con doble presupuesto total de CPU y memoria, 15 minutos por caso. Mantener demás servicios y datos constantes y registrar consumos efectivos. |

**Orden y aislamiento.** Las suites escriben primero los casos y solo ejecutan pruebas HTTP o de integración después de montar controladores y contratos de su historia, aplicar sus migraciones y cargar sus datos. El arnés parcial protegido usa la misma validación HTTP y autenticación de la aplicación. Los cierres por historia se hacen con ese arnés. La regresión sobre las 40 operaciones se ejecuta tras el montaje completo y la preparación de datos. Pruebas que mutan oferta, detienen Redis, restauran PostgreSQL o miden rendimiento usan proyectos e instancias independientes o una ejecución serial que restaura su estado y verifica la semilla entre corridas. Las pruebas de caché con dos réplicas prueban coherencia, y EQ-03 conserva su propia comparación de recursos.

**Criterio de cierre.** `PENDIENTE` indica ausencia de una corrida válida, `EJECUTADA` indica que existe evidencia aún por evaluar, `APROBADA` exige cumplir el resultado esperado y `FALLIDA` identifica incumplimiento comprobado. EQ-01 exige p95 ≤ 2 s y errores técnicos < 1 % en la corrida nominal. EQ-03 exige los mismos umbrales en base a 25 VU y ampliada a 50 VU, con medición de ambas a 50 VU para comparar. La falta de infraestructura deja EQ-03 pendiente. El checklist de éxito y el cierre requieren evidencia de aprobación de todas las pruebas aplicables.

Usar la [guía de validación](quickstart.md) para entornos, comandos y evidencia. El escenario integral de EQ-01 incluye solicitudes y comparación de cotizaciones. El ensayo de 002 cubre las operaciones de oferta con 1 000 prestadores y 5 000 servicios. El tramo de 10 000 solicitudes y las comparaciones de cotizaciones se medirán cuando sus funcionalidades estén disponibles. Se registrará alcance y estado con cada resultado. Las pruebas de concurrencia, idempotencia y transiciones propias de la 002 conservan sus IDs CA. PR09–PR11 corresponden a contratación y sus transiciones.

## Dependencias posteriores

| Entrega | Contrato de integración previsto |
|---|---|
| 003 y 004 | Catálogo proporciona elegibilidad con contexto de transacción y conserva identificadores históricos. La 003 revalida al guardar la solicitud. La 004 retoma referencias de contratación conforme a sus permisos. |
| 007 y 008 | La IA futura consume la búsqueda por filtros ya validada. El contacto y las visitas siguen su flujo y consentimiento en 008. |
| 011 y 012 | Los avisos públicos tienen estados independientes. La 011 aporta calificaciones, filtro y «Sin valoraciones». La 012 aporta estados reales de verificación y el alcance restante de administración y auditoría. |

## Riesgos y decisiones de documentación

| Riesgo o discrepancia | Resolución de diseño y seguimiento |
|---|---|
| OpenAPI único y regresión de 001 | Composición base y completa con suites separadas y contrato efectivo determinista. Revisar el [documento REST](../../docs/02-arquitectura-software/api-rest.md) para inventario, filtros y operaciones, incluida la dependencia de calificaciones. |
| Activación de Redis condicionada a EQ-01 y tolerancia de obsolescencia por TTL | Aplicar el principio X y el alcance aclarado de la 002. Actualizar después [estrategia de caché](../../docs/02-arquitectura-software/estrategia-de-cache.md) y [patrones de diseño](../../docs/03-diseno-de-software/diseno-interno/patrones-de-diseno.md) para revisión durable, respaldo, TTL y estrategia de perfiles. |
| Contención de la revisión, páginas profundas o exceso de conexiones | Transacciones cortas, revisión por consulta y planes de ejecución medidos. Registrar espera de bloqueos, desfase de proyección y presupuesto de pools al duplicar réplicas. |
| Arranque conjunto y entornos de validación aislados | Registrar migraciones aditivas, verificar una base vacía y una copia de la 001, y activar la composición completa después de que estén disponibles sus dependencias. Actualizar la [guía tecnológica](../../tecnologia/README.md) con el arranque, almacenamiento y restauración de la 002. |
| Foto reemplazada, objeto huérfano o dato privado público | Revocación desde el commit, referencias verificadas, limpieza durable y aislamiento de bucket. Actualizar [seguridad y privacidad](../../docs/02-arquitectura-software/seguridad-y-privacidad.md), [modelo de datos general](../../docs/03-diseno-de-software/modelo-de-datos.md) y [despliegue C4](../../docs/04-modelo-c4/05-despliegue.md). |
| Autoría del cambio de categoría e integración modular | Catálogo conserva los datos y Administración registra permiso y auditoría. Actualizar [componentes](../../docs/02-arquitectura-software/componentes-arquitectonicos.md) y [C4 nivel 3](../../docs/04-modelo-c4/03-nivel3-componentes.md) con la colaboración real, sin renumerar módulos. |
| Cobertura futura y discrepancia PR12 / EQ-05 | [Estrategia de pruebas](../../docs/05-gestion/04-pruebas.md) y [trazabilidad](../../docs/trazabilidad.md) deben reflejar el nuevo código y evidencia, la diferencia entre el ensayo arquitectónico y EQ-05, y el alcance medido de EQ-01/EQ-03. Revisar [backlog](../../docs/05-gestion/02-backlog-y-sprints.md) y [MVP y evolución](../../docs/05-gestion/06-mvp-y-evolucion.md) para la dependencia explícita del filtro por calificación. |

Se conservan los IDs de HU, RF, EQ y PR. Los cambios generales se reservarán para su revisión con evidencia de implementación. Las decisiones que requieran una enmienda constitucional o un cambio de alcance se elevarán al Product Owner antes de aplicarse.

## Fases y criterio de salida

- **Fase 0.** [Investigación](research.md) con alternativas y decisiones dentro del alcance acordado.
- **Fase 1.** [Modelo](data-model.md), [contratos](contracts/README.md) y [validación](quickstart.md), revisados contra la especificación y la constitución. Punto de revisión del Product Owner previo a `speckit.tasks`.
- **Fase posterior.** Primero se incorporarán los contratos y pruebas de regresión de composición, seguidos por la persistencia, permisos y auditoría, las funciones de Prestadores y Catálogo, y el cierre de rendimiento y documentación. La evidencia debe seguir la cadena HU → RF → AC/EQ → DA → ADR → módulo → prueba → funcionalidad.
