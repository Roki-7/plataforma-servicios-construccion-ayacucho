# Estado de implementación — 002 Prestadores y catálogo

## Línea base

- Rama `002-prestadores-y-catalogo`. Plan respaldado en `b3897b0148cc21bf099f140f85765b6a2ab3c3d6`. La implementación comenzó desde `5a0393f`, con el árbol limpio y la misma revisión en la referencia remota local.
- La [copia de la especificación 001](../001-usuarios-y-acceso/contracts/openapi.json) y el [contrato activo del backend](../../tecnologia/backend/contracts/openapi.json) son idénticos byte por byte. Ambos tienen el objeto Git `c393b33b2e6a296bfcba4f36edcb8b88a00ec1b6` y 17 operaciones.
- El [contrato 002](contracts/openapi.json) tiene el objeto Git `5d791e9db2ccc1c95e365845a17ddea00040f6bb` y 23 operaciones. La comparación estática encontró 40 combinaciones únicas de método y ruta y 40 `operationId` únicos. La composición base de 001 queda protegida. El ensamblado y su regresión conjunta corresponden a T007, T011, T066 y T068.

| Inventario | Rutas relativas al prefijo `/api/v1` |
|---|---|
| 001 · Cuenta y sesión (8) | `POST /cuentas`, `POST /sesiones`, `DELETE /sesiones/actual`, `POST /sesiones/renovacion`, `GET /sesiones/csrf`, `POST /sesiones/reautenticacion`, `POST /recuperaciones`, `POST /recuperaciones/{token}` |
| 001 · Perfil y salud (9) | `GET` y `PATCH /perfil`, `POST /perfil/perfiles`, `POST /perfil/cambios-correo`, `POST /perfil/cambios-correo/{token}/confirmacion`, `POST /perfil/cambios-contrasena`, `POST /perfil/fotografias`, `GET /perfil/fotografias/{fotografiaId}`, `GET /salud` |
| 002 · Prestadores (10) | `GET` y `PUT /prestadores/perfil`, `POST /prestadores/perfil/trabajos`, `PATCH /prestadores/perfil/trabajos/{trabajoId}`, `POST /prestadores/perfil/trabajos/{trabajoId}/fotografias`, `PUT` y `DELETE /prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId}`, `GET /prestadores/{prestadorId}/trabajos/{trabajoId}/fotografias/{fotografiaId}`, `GET /prestadores/{prestadorId}`, `GET /prestadores` |
| 002 · Servicios (6) | `GET` y `POST /servicios`, `GET /servicios/mios`, `GET` y `PATCH /servicios/{servicioId}`, `POST /servicios/{servicioId}/transiciones` |
| 002 · Categorías (7) | `GET /categorias`, `GET` y `POST /admin/categorias`, `PATCH /admin/categorias/{categoriaId}`, `POST /admin/categorias/{categoriaId}/previsualizaciones-desactivacion`, `POST /admin/categorias/{categoriaId}/desactivaciones`, `POST /admin/categorias/{categoriaId}/activaciones` |

## Estado inicial de las verificaciones

| Grupo | Estado inicial | Alcance y evidencia esperada |
|---|---|---|
| T001–T006 | PENDIENTE | Inventario estático, preparación local, Compose, controles del iniciador, PostgreSQL real y selectores e informes de prueba. |
| HU03 / RF06 | APROBADA | CA-PRE-01 a 08 con el arnés US1 (ver «Resultados de la fase 3»). La integración conjunta de 40 operaciones sigue pendiente. |
| HU04 / RF08 | APROBADA | CA-SER-01 a 07 y 09 con el arnés US2 y CA-SER-08 con las consultas públicas de US3 (fase 5). |
| HU05 / RF09, RF10 | APROBADA | CA-BUS-01 a 08 con el arnés US3 (ver «Resultados de la fase 5»). Los avisos de 011 y 012 usan dobles de fuentes. |
| HU25 / RF39 | PENDIENTE | CA-CAT-01 a 10. |
| Integración y calidad | PENDIENTE | Unión de contratos y regresión de 001, Redis, seguridad, arquitectura, restauración, CI, accesibilidad, responsive, EQ-01 y EQ-03 según [tareas](tasks.md) y [guía de validación](quickstart.md). |
| Integraciones futuras | PENDIENTE | Solicitudes en 003, referencias posteriores, calificaciones en 011 y verificaciones en 012. |

Las verificaciones se registran como `PENDIENTE` cuando falta la ejecución aplicable, `EJECUTADA` cuando hay una ejecución por evaluar, `APROBADA` cuando la evidencia cumple el criterio o `FALLIDA` cuando una ejecución válida incumple el criterio. Los resultados de preparación se registran por separado de los escenarios de aceptación.

## Resultados de la fase 1

| Tarea | Estado | Verificación ejecutada |
|---|---|---|
| T001 | APROBADA | Se compararon los contratos con la línea base, se comprobó la igualdad de las dos copias 001 y se contaron 17 y 23 operaciones sin colisiones de rutas por método ni de `operationId`. |
| T002 | APROBADA | `dev:prepare:002 -- --validation` se ejecutó antes de Compose. Al repetir mantuvo los mismos archivos y los cinco archivos locales cotejados de 001. Coincidieron las dos sumas del catálogo y la CA de 002 es independiente. Sin el indicador de validación y en modo producción la preparación se rechazó. |
| T003 | APROBADA | Compose resolvió y arrancó los cinco servicios de `ayacucho-002-validacion`, con seis puertos publicados, tres volúmenes y una red propios. Caddy aceptó la CA 002, rechazó la CA 001 y devolvió 413 con `CUERPO_DEMASIADO_GRANDE` al superar 14 000 000 bytes. Garage arrancó sin un bucket inicial. |
| T004 | APROBADA | Los cuatro puntos de entrada validaron su entorno y señalaron las tareas futuras al intentar ejecutarlos. El iniciador rechazó 12 configuraciones ajenas o inconsistentes. La guía registra `--verificar-config` y los puertos dedicados. |
| T005 | APROBADA | Jest ejecutó 2 pruebas sobre PostgreSQL 18. Se rechazaron destinos 001 y externos, se repitió la carga y la limpieza y se preservó una base de otra suite. La instancia de 002 terminó con cero bases descartables y cero bases de 001. |
| T006 | APROBADA | Playwright seleccionó y ejecutó 1 prueba temporal del ejecutor 002. Se verificaron JUnit de Jest y Playwright en `tecnologia/.local/evidencia/002/fase-1/` y el rechazo de desvíos al directorio 001. La ejecución de la matriz completa de navegadores corresponde a T075. |

`lint`, `typecheck` y `build` finalizaron correctamente en backend y frontend con Node 24.15.0. Los informes generados `backend-integration-junit.xml` y `playwright-junit.xml` se conservan localmente en el directorio ignorado de evidencias de la 002. Los 35 escenarios funcionales, la regresión conjunta, el ensayo de restauración y las mediciones EQ-01 y EQ-03 siguen `PENDIENTES`.

## Resultados de la fase 2 (en revisión)

Entorno: Node.js 24.15.0 del toolchain local del proyecto, PostgreSQL 18, Redis 8, Mailpit y Garage con datos ficticios. Las suites de 002 usan bases temporales de la instancia de validación 002, que se eliminan al terminar. La regresión de 001 se ejecutó en un proyecto Compose aislado (`ayacucho-regresion-001-aislada`) con volúmenes, contenedores y puertos propios (54339, 63809, 1035, 8025, 3920) y secretos ficticios nuevos. No se usaron los volúmenes ni las bases existentes de 001 ni de 002 para ese fin.

### Defectos encontrados y corregidos

| Defecto | Causa | Corrección |
|---|---|---|
| Registro de cuentas (001) respondía 503 | `INSERT` de `confirmar()` en la idempotencia compartida con 7 marcadores y 6 valores (faltaba `resultado.http`) | Se añadió `resultado.http` en `src/compartido/infraestructura/idempotencia.ts`. Pruebas nuevas de persistencia y replay del código HTTP |
| T007 fallaba con un mensaje equivocado | La prueba usaba `structuredClone` (otro realm en Jest) y `isDeepStrictEqual` distingue prototipos. No era un defecto de `componer-openapi.ts` | La prueba clona vía JSON. Mensajes exactos de referencia rota y de incompatibilidad real. Caso nuevo de equivalencia estructural |
| T015 y arnés HTTP: «inconsistent types deduced for parameter $2» | `INSERT` de prueba reutilizaba `$2` en `varchar(120)` y `text` | `$2::varchar,$2::text` en las pruebas. Migraciones sin cambios |

### Verificaciones ejecutadas

| Grupo | Resultado |
|---|---|
| 002: unitarias, contrato, arquitectura e integración (7 suites) | 27 de 27 aprobadas |
| Unitarias y arquitectura de todo el backend | 126 de 126 aprobadas |
| Contrato 001 incl. X-08 y `fundacion` (10 suites, entorno aislado) | 118 de 118 aprobadas en la segunda ejecución. En la primera ejecución falló una vez CA-PER-02 (límite de 10 000 000 bytes) y aprobó aislada y en la repetición completa. No se capturó el mensaje, por lo que la causa (probable tiempo de espera bajo carga) no está confirmada |
| Integración 001 `fundacion` y `usuarios-acceso` (11 suites, entorno aislado) | 104 de 104 aprobadas |
| `typecheck`, `lint`, `build` del backend | Correctos |
| `docker build` del backend (verifica 17, 23 y 40 operaciones) | Correcto. La imagen incluye ambos contratos |
| Modo completo de la fábrica (verificación manual) | Carga ambos activos y compone 40 operaciones. Falla solo por ausencia de controladores (`El router no coincide`), esperado hasta T066. El modo por defecto arranca con el router de 001 |

### Estado de T007–T020

| Tarea | Estado | Evidencia y límites |
|---|---|---|
| T007, T009 | APROBADA | Igualdad de las copias 001, 17 y 23 operaciones, unión de 40, colisiones y referencias |
| T008 | APROBADA | Registro aditivo, `synchronize` en `false`, migración 001→002 en base temporal y `db:migrate:002` sobre la base de validación 002 (ver abajo) |
| T010 | APROBADA | Consultas estrictas, PUT, Bearer, Origin, cabeceras, límites 65 536 y 14 000 000 y redacción de registros |
| T011 | APROBADA | Valor por defecto con 17 operaciones, modo de prueba por historia, modo completo (ver arriba) y empaquetado |
| T012 | APROBADA | Ámbito 002, PUT/DELETE, hash de foto, replay con autorización vigente, 409, reversión y código HTTP persistido |
| T013, T014 | APROBADA | Identidad Bearer y reglas de arquitectura con casos negativos |
| T015, T016, T017 | APROBADA | Distritos, jerarquía, padre inmutable, revisión monótona con bloqueos y proyección con reversión conjunta |
| T018 | APROBADA | Redis 8 con espacio aislado, presupuesto agotado y escrituras en PostgreSQL sin condicionarse |
| T019 | APROBADA | Arnés por historia con controladores reales, correspondencia router-contrato y datos listos |
| T020 | APROBADA | Arranque aislado, migraciones, contratos estáticos, autenticación Bearer, revisión de Catálogo, reglas de arquitectura y arnés por historia verificados. La composición base conserva sus 17 operaciones (X-08 y regresión 001 en entorno aislado). La integración de 40 operaciones en una sola aplicación **no** está declarada: requiere los controladores de las historias y se verifica en T066 |

### db:migrate:002

Configuración comprobada con `iniciar-validacion-002.ts migrar --verificar-config`. El código exige host 127.0.0.1, puerto 54330, base `ayacucho_002_validacion` y usuario dedicado, y la conexión real se confirmó contra el contenedor `ayacucho-002-validacion-postgres-1`. Antes de ejecutar se hizo un respaldo `pg_dump` y se comprobó que la base ya tenía las 11 migraciones aplicadas (8 de 001 y 3 de 002), sin filas en `sesiones` ni `claves_idempotencia`. Las migraciones de 002 solo crean tablas, índices, una función, un disparador y la semilla de cinco distritos. Dos ejecuciones consecutivas informaron 0 migraciones aplicadas y el volcado posterior es idéntico al anterior salvo los tokens aleatorios de `pg_dump`. Estado final: 5 distritos, revisión de oferta 1, 0 clasificaciones, 11 migraciones.

### Limitaciones conocidas

- CA-PER-02 (límite de 10 000 000 bytes, contrato 001) falló una vez en la primera ejecución completa del entorno aislado y aprobó aislada y en la repetición completa. No se capturó el mensaje y la causa no está confirmada.
- El modo completo de la fábrica carga y compone los 40 operaciones, pero la aplicación no arranca hasta montar los controladores de las historias (T031, T040, T050, T063, T066).
- `docker build` del backend solo se verificó una vez. El entorno temporal de regresión 001 y la imagen de prueba permanecen locales.

Los escenarios funcionales de las historias distintas de HU03, la regresión conjunta de 40 operaciones y el resto de las verificaciones siguen `PENDIENTES`.

## Resultados de la fase 3 — HU03 · Perfil profesional y portafolio (RF06)

Entorno: Node.js 24.15.0 del toolchain local, PostgreSQL 18, Redis 8 y Garage de la validación 002 (bases temporales de la suite, eliminadas al terminar) y la regresión de 001 en el proyecto Compose aislado `ayacucho-regresion-001-aislada`. Todos los datos son ficticios.

### Montaje de US1

El arnés `aplicacionPorHistoria('HU03', …)` carga con `registroPrestadores002` los dos controladores, los proveedores, la migración `PerfilesYPortafolio1795000000004` y las ocho operaciones contractuales. Antes de arrancar comprueba la correspondencia entre el router de Nest y el contrato. `fixtures-hu03.ts` registra cuentas reales por HTTP (prestador, prestador ajeno y solo cliente) y carga cuatro clasificaciones, una de ellas inactiva y una hija de raíz inactiva.

El almacenamiento propio se aprovisionó con `storage:init:002`: bucket `portafolio-002-validacion` en el Garage de la 002 e identidad exclusiva con permiso de lectura y escritura solo sobre ese bucket. La ejecución escribió las credenciales en `tecnologia/.local/002/backend.env`, que Git ignora. El script es idempotente y se repitió sin cambios. Una prueba confirma que esa identidad no crea buckets ni accede a otros.

### Verificaciones ejecutadas

| Grupo | Resultado |
|---|---|
| Contrato HU03 (`perfil-y-portafolio.spec.ts`) | 13 de 13 aprobadas |
| Unitarias de dominio, saneamiento y servicios (`perfil-y-portafolio.spec.ts`) | 28 de 28 aprobadas |
| Integración con PostgreSQL y Garage (`portafolio.spec.ts`) | 16 de 16 aprobadas (incluye 2 del retraso de 60 s) |
| Interfaz web (`portafolio.test.tsx`) | 14 de 14 aprobadas |
| Todas las suites 002 del backend (10 suites, fases 2 y 3) | 84 de 84 aprobadas |
| Unitarias y arquitectura del backend, incl. 001 | 122 de 122 aprobadas |
| Contrato e integración de 001 en entorno aislado (21 suites) | 222 de 222 aprobadas |
| Pruebas de la interfaz web (9 archivos) | 69 de 69 aprobadas |
| `typecheck`, `lint` y `build` de backend y frontend | Correctos. El `build` de frontend también |

### Criterios de aceptación

| Criterio | Evidencia |
|---|---|
| CA-PRE-01 | Alta con versión 0, consulta propia, edición con versión, replay idempotente, 409 por versión obsoleta o clave reutilizada. Los datos se devuelven con tipo, especialidades, experiencia, zonas, disponibilidad y trabajos |
| CA-PRE-02 | Una zona fuera de los cinco distritos devuelve 400 con `distritos[1]` y el perfil guardado no cambia. La especialidad inactiva, hija de raíz inactiva o inexistente devuelve 422 `CATEGORIA_NO_ACTIVA` |
| CA-PRE-03 | Visitante 401, solo cliente 403, prestador ajeno 404 al agregar, reemplazar o eliminar. Identidad o propiedades enviadas en el cuerpo se rechazan. Las imágenes protegidas se conservan |
| CA-PRE-04 | JPG, PNG y WEBP válidos. Se aceptan por HTTP un PNG de exactamente 10 000 000 bytes y imágenes de 4096 píxeles por lado. Se rechazan 10 000 001 bytes (413), 4097 píxeles, GIF o contenido corrupto con tipo de imagen y tipo declarado distinto del real, siempre con la causa y sin alterar lo ya vinculado |
| CA-PRE-05 | Cuatro fotos por trabajo y diez trabajos por prestador. La quinta foto y el undécimo trabajo reciben 422 `LIMITE_PORTAFOLIO` indicando el límite. Los últimos cupos simultáneos se serializan y no se exceden |
| CA-PRE-06 | Con la confirmación retenida, el identificador pendiente devuelve 404 `RECURSO_NO_DISPONIBLE` sin bytes. Tras confirmar, 200 con WebP sin EXIF, GPS, XMP ni IPTC y sin el marcador sensible de prueba |
| CA-PRE-07 | El reemplazo inválido conserva la imagen anterior. El válido conserva `fotografiaId` y el recuento, y durante el reemplazo solo se sirve la variante anterior |
| CA-PRE-08 | Tras eliminar, el acceso público devuelve 404 desde el commit, el trabajo y las demás fotos se conservan y se libera un cupo. La purga se reintenta con Garage caído y se completa al recuperarse |

### Estado de T021–T033

| Tarea | Estado | Evidencia |
|---|---|---|
| T021, T022, T023, T024 | APROBADA | Pruebas escritas antes de la implementación y ejecutadas con el arnés de T019. Cubren los criterios de cierre indicados arriba |
| T025 | APROBADA | Dominio con límites exactos, cuenta única y UUID público distinto, textos planos sin marcado ni controles |
| T026 | APROBADA | Restricciones de PostgreSQL probadas (cuenta única, UUID distinto, tipo, texto, distrito, clave de objeto, MIME) y cuotas bajo bloqueo de perfil antes que trabajo |
| T027 | APROBADA | PUT con versión 0, edición con versión, alta de trabajo avanza `versionPerfil`, especialidades activas, proyección y revisión de Catálogo en la misma transacción y revertidas juntas |
| T028 | APROBADA | Base64 canónico, formato real, 10 000 000 bytes, 4096 píxeles, orientación, variante WebP de hasta 1600 píxeles, calidad 80 y sin metadatos |
| T029 | APROBADA | Intención durable antes del PUT, vínculo solo con objeto verificado por checksum, reemplazo con nueva clave inmutable y `storage:init:002` con identidad limitada al bucket |
| T030 | APROBADA | Purgas y preparaciones vencidas con arrendamiento, reintentos, ámbito verificado, ausencia de referencias y reconciliación de huérfanos. No toca objetos de otro ámbito |
| T031 | APROBADA | Las ocho operaciones respetan versiones, respuestas y titularidad. La entrega pública solo sirve WebP saneado con `no-store` y responde 404 para altas pendientes, fotos retiradas o perfiles no publicables |
| T032 | APROBADA | Formulario de perfil y portafolio con versiones, mensajes de rechazo, imágenes bajo demanda y ruta `/prestador/perfil`. Las pruebas de interfaz pasan. No se ejecutó Playwright, que corresponde a T075 |
| T033 | APROBADA | CA-PRE-01 a CA-PRE-08 demostrados con el arnés US1 (ver arriba), con 404 antes de confirmar y 200 con la variante saneada después |

### Decisiones y limitaciones

- La validación con esquema de las rutas de 002 ahora devuelve `detalles` con el campo y el motivo, sin reflejar valores del cliente. La respuesta de las rutas de 001 no cambió y su regresión pasa.
- La composición base de `app.module.ts` añade dos tokens internos (`IDEMPOTENCIA_002` y `CLASIFICACIONES_EFECTIVAS_002`). El módulo Catálogo expone la lista de distritos y un contrato `ClasificacionesEfectivas` mediante su API pública.
- Las migraciones y controladores de Prestadores no están registrados todavía en `db:migrate:002` ni en la aplicación de 40 operaciones. Su integración corresponde a T066 y T067, y no se declara completa.
- El selector de especialidades de la web recibe la lista desde la composición. Hasta que exista la consulta de categorías (HU25, T063) la pantalla muestra solo las especialidades ya registradas del perfil.
- El limpiador está implementado y probado como servicio, pero no hay un temporizador del monolito que lo ejecute. La planificación periódica corresponde a T066.
- La purga de una foto reemplazada o eliminada tiene un retraso de 60 segundos en producción para no interrumpir lecturas en curso. La mayoría de las pruebas usa retraso cero. Dos pruebas permanentes ejercitan la regla de producción con el reloj inyectable del limpiador, sin esperas reales: la purga queda programada a 60 s (medidos por PostgreSQL), no se elimina nada con el reloj real ni 50 s después, al vencer el plazo se elimina solo la clave anterior y la nueva sigue entregándose con 200, una foto eliminada devuelve 404 de inmediato, y una purga vencida de un objeto que volvió a estar referenciado se descarta sin borrarlo.
- La prueba de contrato de 001 CA-PER-02 sigue con el antecedente de una falla intermitente no explicada de la fase 2. No volvió a aparecer.

## Resultados de la fase 4 — HU04 · Publicación y estados de servicios (RF08)

Entorno: Node.js 24.15.0 del toolchain local, PostgreSQL 18, Redis 8 y Garage de la validación 002 (bases temporales, eliminadas al terminar) y la regresión de 001 en el proyecto Compose aislado. Todos los datos son ficticios.

### Montaje de US2

`registroServicios002` monta el controlador de las cuatro operaciones (`publicarServicio002`, `listarMisServicios002`, `editarServicio002`, `cambiarEstadoServicio002`), los proveedores y la migración `ServiciosCatalogo1795000000005`. El arnés `aplicacionPorHistoria('HU04', …)` comprueba antes de arrancar que el router coincide con el contrato. `fixtures-hu04.ts` carga cuentas reales por HTTP, perfiles profesionales, seis clasificaciones (activa, hija activa, raíz inactiva, hija de raíz inactiva, raíz activa con hija inactiva) y una tabla de referencias históricas de prueba (solicitud, cotización y contratación) con clave foránea restrictiva hacia los servicios.

Las consultas públicas del servicio (`GET /servicios` y `GET /servicios/{servicioId}`) pertenecen a US3 y no se implementaron.

### Verificaciones ejecutadas

| Grupo | Resultado |
|---|---|
| Unitarias de estados y casos de uso (`estados-servicio.spec.ts`) | 30 de 30 aprobadas |
| Contrato HU04 (`servicios-propios.spec.ts`) | 12 de 12 aprobadas |
| Integración con PostgreSQL real (`ciclo-servicios.spec.ts`), repetida tres veces | 9 de 9 aprobadas cada vez |
| Interfaz web (`servicios-propios.test.tsx`) | 11 de 11 aprobadas |
| Todas las suites 002 del backend (13 suites, fases 2 a 4) | 135 de 135 aprobadas |
| Unitarias y arquitectura de todo el backend | 184 de 184 aprobadas |
| Contrato e integración de 001 en entorno aislado (21 suites) | 222 de 222 aprobadas |
| Pruebas de la interfaz web (10 archivos) | 80 de 80 aprobadas |
| `typecheck`, `lint` y `build` de backend y frontend | Correctos |

### Criterios de aceptación

| Criterio | Evidencia |
|---|---|
| CA-SER-01 | Alta en PUBLICADO con versión 1 asociada al perfil del titular. La consulta propia muestra los datos guardados y la edición avanza la versión. El alta con la misma clave devuelve el mismo resultado y no duplica el servicio |
| CA-SER-02 | Las cuatro transiciones permitidas. El servicio queda inelegible para nuevas solicitudes y las referencias de solicitudes, cotizaciones y contrataciones se conservan y siguen consultables |
| CA-SER-03 | Visitante 401, solo cliente 403, prestador ajeno o sin perfil profesional 404, versión obsoleta 409, transición no permitida 422. Cada rechazo conserva estado y datos |
| CA-SER-04 | Publicar en una clasificación inactiva, hija de raíz inactiva, hija inactiva o inexistente devuelve 422 `CATEGORIA_NO_ACTIVA` sin crear el servicio ni avanzar la revisión |
| CA-SER-05 | La edición de un servicio PAUSADO conserva el estado. La reactivación con condiciones vigentes lo publica |
| CA-SER-06 | Reactivar con la clasificación desactivada devuelve 422 y el servicio sigue PAUSADO. Los datos que incumplen una condición se rechazan con 400 sin cambios |
| CA-SER-07 | Un servicio RETIRADO rechaza edición y cambios de estado con 422 `SERVICIO_RETIRADO`, también del titular. Sigue consultable como registro histórico por el inventario propio y por la API interna. PostgreSQL impide reabrirlo, modificarlo o borrarlo |
| CA-SER-08 | Pendiente: depende de las consultas públicas de US3 (T052) |
| CA-SER-09 | Solo PUBLICADO con clasificación efectivamente activa es elegible. PAUSADO, RETIRADO, clasificación inactiva por estado propio, por su categoría padre o servicio inexistente son inelegibles. La evaluación no crea solicitudes ni modifica el servicio |

### Estado de T034–T042

| Tarea | Estado | Evidencia |
|---|---|---|
| T034 | APROBADA | Contrato de las cuatro operaciones con 401, 403, 404, 409 y 422 según el contrato, versiones y titularidad |
| T035 | APROBADA | Las cuatro transiciones y sus rechazos, retiro terminal, edición, revalidación y elegibilidad, incluida la actividad efectiva de la clasificación |
| T036 | APROBADA | PostgreSQL real: clave idéntica con una sola mutación, escrituras simultáneas serializadas, fallo de escritura que conserva estado, datos, revisión y clave, y referencias históricas |
| T037 | APROBADA | Un propietario y una clasificación por servicio, límites de texto, alta en PUBLICADO, edición solo en PUBLICADO o PAUSADO y registro RETIRADO conservado con restricciones de PostgreSQL |
| T038 | APROBADA | Titularidad, clasificación efectiva, versión, idempotencia y transición en cada caso de uso, con la revisión pública avanzada bajo bloqueo exclusivo |
| T039 | APROBADA | API interna `ElegibilidadServicio` con evaluación y registro histórico. Con transacción toma el bloqueo compartido de la revisión y una transición concurrente espera hasta el commit |
| T040 | APROBADA | Las cuatro rutas con guard, inventario con los tres estados, estados inválidos y actores ajenos rechazados e identificadores estables |
| T041 | APROBADA | Alta, edición, pausa, reactivación, retiro con confirmación y consulta propia en la web. Muestra versión, conflictos y el registro RETIRADO en modo lectura y conserva el estado ante una escritura fallida. No se ejecutó Playwright (T075) |
| T042 | APROBADA | CA-SER-01 a 07 y CA-SER-09 con el arnés US2. CA-SER-08 queda para US3 como indica el criterio |

### Decisiones y limitaciones

- Un servicio ajeno o inexistente responde 404 y no revela su existencia. Una edición o transición sobre un servicio RETIRADO responde 422 `SERVICIO_RETIRADO`. Con dos transiciones simultáneas con la misma versión, el perdedor recibe 409 si el ganador pausó y 422 si el ganador retiró.
- La condición de «perfil publicable» no se modela todavía: todo perfil guardado es publicable. La elegibilidad evalúa estado y clasificación efectiva.
- El selector de categorías de la web usa las especialidades del perfil hasta que exista la consulta de categorías (HU25, T063).
- La migración de servicios se registra de forma aditiva por la composición de US2 y no forma parte de `db:migrate:002`. Esa integración, la del limpiador y la de las 40 operaciones corresponden a T066 y T067 y no se declaran completas.
- `textoPlano` y `filasDe` pasaron a `compartido` para que Catálogo y Prestadores no dependan uno del otro. El comportamiento de Prestadores no cambió y sus pruebas siguen aprobadas.

### Correcciones de la auditoría de la fase 4

La auditoría independiente de la fase 4 encontró dos defectos. Ambos se corrigieron con pruebas permanentes.

| Defecto | Causa | Corrección |
|---|---|---|
| Agotamiento del pool de PostgreSQL con 6 o más escrituras simultáneas (503 generalizado). Afectaba a servicios (fase 4) y a perfil y fotografías (fase 3) | `ejecutar002` llama a `autorizar` dentro de la transacción, y los tres servicios pasaban un `autorizar` que revalidaba la sesión con otra conexión del pool (`usuarios.exigir`). Con el pool de 6, seis transacciones esperaban una conexión que ninguna liberaba y vencían a los 1,5 s | La sesión y el perfil de prestador se revalidan **antes de abrir la transacción** (`revalidarActor` y `revalidar`), y el callback devuelve la identidad ya validada, sin E/S. Se conserva la revalidación antes de devolver un replay. En fotografías se hace justo antes de abrir la transacción, después del saneamiento y la escritura del objeto. `ejecutar002` y el pool (6 conexiones) no se modificaron |
| UUID válidos en mayúsculas rechazados como `CATEGORIA_NO_ACTIVA`, y fotografías con identificador en mayúsculas respondían 404 | El contrato admite cualquier capitalización, pero PostgreSQL y los registros persistidos usan minúsculas, y se comparaba en memoria con cadenas de otra capitalización | `uuidEnMinusculas` (nuevo en `compartido/dominio/identificadores.ts`) normaliza los UUID ya validados por el contrato antes de comparar categorías, especialidades y los identificadores de trabajo, fotografía y servicio. Las especialidades repetidas con distinta capitalización cuentan como repetidas. No cambia la validación de formato ni la titularidad |

Evidencia:

| Verificación | Resultado |
|---|---|
| `concurrencia-escrituras.spec.ts` (5 pruebas), con 8 escrituras simultáneas y el pool de 6 | 5 de 5 aprobadas, repetida 10 veces sin fallos ni 503 |
| Servicios: 8 altas a la vez; segunda ola de 8 con transiciones, edición, conflicto 409, ajeno 404, categoría inactiva 422, alta nueva y transición inválida 422 | Estados exactos por petición, filas y versiones esperadas y revisión avanzada solo por las 4 mutaciones confirmadas |
| Servicios con sesión inválida en la mitad de una ola de 8 | 401 en esas y 201 en las demás, sin 503 |
| Perfil: 8 altas a la vez, ola con 5 actualizaciones, 1 versión obsoleta, 1 especialidad inactiva y 1 alta de trabajo | 8 proyecciones y revisión +8, luego +5, con 409, 422 y 201 correctos |
| Fotografías: 8 altas, luego 4 reemplazos y 4 eliminaciones a la vez | 8 objetos verificados, 4 fotografías finales y 8 purgas programadas |
| Control negativo: reintroducir la revalidación dentro de la transacción en cada flujo | Los tres flujos fallan con 503. Se restauró el código y se comprobó |
| UUID en mayúsculas, minúsculas y mixtas: servicios (3 pruebas) y perfil y fotografías (4 pruebas) | Aprobadas: se guardan en minúsculas, la misma solicitud con otra capitalización es el mismo intento idempotente, los inválidos siguen en 400, las categorías inactivas o inexistentes en 422 y el actor ajeno en 404 |
| Suites 002 del backend (14 suites) | 147 de 147 aprobadas |
| Unitarias y arquitectura de todo el backend | 184 de 184 aprobadas |
| Contrato e integración de 001 en entorno aislado | 222 de 222 aprobadas |
| `typecheck`, `lint` y `build` del backend | Correctos |

Limitación observada: en tres ejecuciones aisladas de Jest durante el desarrollo, el registro de salida quedó vacío sin un fallo asociado. No se reprodujo en 10 ejecuciones posteriores y no se identificó la causa.

## Resultados de la fase 5 — HU05 · Búsqueda y consultas públicas (RF09, RF10)

Entorno: Node.js 24.15.0 del toolchain local, PostgreSQL 18, Redis 8 y Garage de la validación 002 (bases temporales eliminadas al terminar) y Redis con un espacio de claves propio por prueba. Todos los datos son ficticios.

### Montaje de US3

`registroBusqueda002` monta `BusquedaController` (`GET /servicios`, `GET /servicios/{servicioId}`, `GET /prestadores`) y `PerfilPublicoController` (`GET /prestadores/{prestadorId}`), con la migración `IndicesBusqueda1795000000006` y una caché opcional (`CatalogoCache` sobre Redis). `fixtures-hu05.ts` los monta junto con los servicios propios de US2 y carga una jerarquía de clasificaciones (una raíz inactiva con una hija de estado propio activo), siete prestadores (uno no publicable), servicios en los tres estados, 25 servicios para paginar y un trabajo con fotografía. El arnés comprueba antes de arrancar que el router coincide con las ocho operaciones.

Los controladores de `servicios/mios` y `prestadores/perfil` deben registrarse antes que los de parámetro. Queda documentado en los controladores y en la composición.

### Consultas e índices

Cada búsqueda es una sola sentencia con el total y la página de la misma instantánea (CTE materializada) y orden estable: servicios por UUID, prestadores por nombre sin distinguir mayúsculas y UUID. Un servicio es visible solo si está PUBLICADO, su clasificación está efectivamente activa (propia y de su padre) y su prestador es publicable. La categoría raíz incluye sus subcategorías activas y, para prestadores, exige al menos un servicio visible coincidente. Todos los valores son parámetros enlazados.

Plan con `enable_seqscan=off`, extraído de la prueba de integración (resumen):

| Consulta | Plan |
|---|---|
| Servicios | `Index Scan using catalogo_servicios_publicados_por_prestador`, `Index Scan using catalogo_clasificaciones_id_nivel_key` (hija y padre) y `Bitmap Index Scan on catalogo_proyeccion_disponibilidad`, con `Sort` por `id` |
| Prestadores | `Bitmap Index Scan on catalogo_proyeccion_disponibilidad` con los filtros de especialidades y zonas aplicados sobre las filas seleccionadas (los índices GIN no intervienen en este plan con pocas filas) y `Sort` por `lower(nombre_publico), prestador_id` |

Los planes se forzaron con `enable_seqscan=off` porque las tablas de prueba son pequeñas: demuestran que los índices son utilizables, no que el planificador los elija con ese volumen. El plan con volumen real (1 000 prestadores y 5 000 servicios) se mide en la fase de rendimiento (EQ-01, EQ-03).

### Verificaciones ejecutadas

| Grupo | Resultado |
|---|---|
| Contrato (`busqueda-publica.spec.ts`) | 12 de 12 aprobadas |
| Unitarias (`filtros-y-avisos.spec.ts`) | 17 de 17 aprobadas |
| Integración (`busqueda-publica.spec.ts`: filtros, proyección, índices, Redis) | 9 de 9 aprobadas |
| Integración (`privacidad-publica.spec.ts`) | 8 de 8 aprobadas |
| Integración (`ciclo-servicios.spec.ts`, con la nueva prueba de CA-SER-08 en la capa de datos) | 10 de 10 aprobadas |
| Interfaz web (`busqueda-publica.test.tsx`) | 11 de 11 aprobadas |
| Todas las suites 002 del backend (18 suites, fases 2 a 5) | 194 de 194 aprobadas |
| Unitarias y arquitectura de todo el backend | 201 de 201 aprobadas |
| Pruebas de la interfaz web (11 archivos) | 91 de 91 aprobadas |
| `typecheck`, `lint` y `build` de backend y frontend | Correctos |

La regresión de 001 no se repitió: esta fase no modificó código compartido ni de 001. Se conserva la evidencia de la fase 4 (222 de 222).

### Criterios de aceptación

| Criterio | Evidencia |
|---|---|
| CA-BUS-01 | Cada filtro (categoría, especialidad, zona, disponibilidad) y sus combinaciones devuelven solo coincidencias. Recorrer las páginas conserva los filtros y devuelve todas las coincidencias sin repetir ni omitir |
| CA-BUS-02 | Una combinación válida sin coincidencias responde 200 con lista vacía y total 0. La interfaz informa que no hay coincidencias y permite quitar los filtros |
| CA-BUS-03 | El detalle del servicio y el perfil público muestran experiencia, trabajos anteriores, servicios visibles y la disponibilidad identificada como declarada, sin prometer reserva. Omiten correo, documento, dirección, credenciales y archivos privados |
| CA-BUS-04, CA-BUS-05 | El perfil devuelve «Calificaciones aún no disponibles» y «Verificaciones aún no disponibles». No aparecen «Sin valoraciones», puntuaciones, estrellas ni insignias. El filtro `calificacion` se rechaza con 400 |
| CA-BUS-06 | Con Redis vacío, caído o con datos inválidos, las respuestas son las de PostgreSQL con los mismos filtros y paginación. Una consulta repetida se sirve de Redis y una revisión nueva la invalida de inmediato. Esta es la corrida de referencia del arnés US3 |
| CA-BUS-07 | Los cuatro casos de disponibilidad de las fuentes, con dobles por separado, retiran solo el aviso de la fuente disponible. Se prueban en dominio, HTTP y web |
| CA-BUS-08 | Las consultas públicas omiten datos personales con cualquier combinación de fuentes. Un visitante recibe 401 y otra cuenta 404 al pedir el archivo privado de una cuenta, y ninguna respuesta pública lo referencia |
| CA-SER-08 (parte pública) | Tras pausar o retirar un servicio, tres consultas sucesivas lo excluyen de la búsqueda, del perfil y del detalle, con el mismo 404 que un servicio inexistente y sin exponer el registro privado. Reactivar lo devuelve |

### Estado de T043–T053

| Tarea | Estado | Evidencia |
|---|---|---|
| T043 | APROBADA | Los cuatro contratos con cada filtro, duplicados y desconocidos, `calificacion`, detalle no visible, vacío válido, avisos exactos y DTO cerrados |
| T044 | APROBADA | Normalización, paginación y los cuatro casos de disponibilidad mediante dobles. En 002 salen los dos avisos exactos |
| T045 | APROBADA | PostgreSQL real: filtros combinados, jerarquía, proyección, retiro y privacidad. Orden estable, total y página coherentes bajo mutaciones concurrentes, y exclusión aun con el UUID conocido |
| T046 | APROBADA | Filtros, vacío, paginación y avisos independientes. Distingue lo declarado y evita puntuaciones, insignias y representaciones ficticias |
| T047 | APROBADA | `pagina` desde 1, `tamano` de 20 por defecto y máximo 50, desempate por UUID, raíz que incluye hijas activas, prestadores buscados de forma independiente e índices con su plan |
| T048 | APROBADA | Perfil y detalles por lista explícita de campos y presentador de avisos independiente, con dobles de fuentes. Excluyen cuenta, sesión, contacto y objetos privados |
| T049 | APROBADA | Clave con entorno, espacio de despliegue, versión, revisión, tipo, filtros y página. Revisión comprobada antes del acceso y al aceptar un acierto. Respaldo en PostgreSQL y descarte por revisión |
| T050 | APROBADA | Las cuatro rutas públicas montadas con proyección, perfiles y servicios ficticios. Filtros estrictos, vacío válido distinto de 404, Redis caído sin cambiar la respuesta y `calificacion` con 400 |
| T051 | APROBADA | Búsqueda sin sesión, resultados, perfil y detalle en la web, con rutas `/buscar`, `/prestadores/{id}` y `/servicios/{id}`. Combina filtros, permite ajustar una búsqueda vacía y distingue visualmente lo declarado de los avisos |
| T052 | APROBADA | CA-SER-08 en la capa de datos (`ciclo-servicios.spec.ts`) y por HTTP (`privacidad-publica.spec.ts`), y CA-BUS-08 con los dobles de fuentes |
| T053 | APROBADA | CA-BUS-01 a 08 y la parte pública de CA-SER-08 con entrada válida, vacía, no admitida y datos privados. Redis vacío o caído |

### Decisiones y limitaciones

- Un perfil o servicio no visible responde el mismo 404 que uno inexistente. Un perfil no publicable es 404.
- La caché solo guarda las dos búsquedas (servicios y prestadores). Los detalles y los servicios de un perfil se leen siempre de PostgreSQL. La caché de categorías activas corresponde a la consulta de categorías de HU25 (T063).
- La pantalla de búsqueda ofrece el filtro de categoría cuando la composición le entrega las opciones. Hasta que exista la consulta de categorías (HU25, T063), la aplicación web no las entrega, y el filtro de categoría no aparece. Las búsquedas por categoría y especialidad están cubiertas por el contrato y las pruebas.
- Las fuentes de calificaciones y verificaciones solo existen como dobles. Su contrato real, el filtro por calificación y «Sin valoraciones» pertenecen a 011 y 012.
- Las migraciones de índices y los controladores públicos no están registrados todavía en `db:migrate:002` ni en la aplicación de 40 operaciones. Esa integración corresponde a T066 y T067 y no se declara completa.
- Una fila de la proyección se actualiza con el perfil. Si cambia el estado `publicable` por SQL, hay que avanzar también la revisión para invalidar la caché, como hacen las operaciones de negocio.
- No se ejecutó Playwright (T075) ni el ensayo de rendimiento con 1 000 prestadores y 5 000 servicios.
