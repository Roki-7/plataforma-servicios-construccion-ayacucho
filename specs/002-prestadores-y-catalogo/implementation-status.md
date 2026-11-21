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

## Resultados de la fase 6 (HU25)

Estado: **fase 6 completa**, 11 de 11 tareas pendientes verificadas más T055 (65 de 94 acumuladas).

| Tarea | Estado | Evidencia |
|---|---|---|
| T054 | Verificada | Contrato `categorias.spec.ts`: 9/9 (siete operaciones, esquemas OpenAPI, 400/401/403/404/409/422). |
| T055 | Verificada | Unitaria `clasificaciones.spec.ts`: 12/12. Códigos alineados con el contrato (`JERARQUIA_CATEGORIA_NO_VALIDA`, `TRANSICION_NO_ADMITIDA`). |
| T056 | Verificada | Integración `autorizacion-y-categorias.spec.ts`: 24/24 con PostgreSQL real. Cubre revocación con sesión abierta, entre vista previa y confirmación y en replay; actor ajeno; confirmación vencida y cambio de impacto; alta operativa (ejecutor no habilitado, firmante como ejecutor, autoconcesión, sustitución de cuenta, firma ajena o alterada, vigencia, entorno, aprobación y constancia reutilizadas); reversión conjunta ante fallo de auditoría; carreras; 10 escrituras simultáneas sin agotar el pool. |
| T057 | Verificada | Migraciones `PermisosYAuditoria1795000000007` y `ConfirmacionesDesactivacion1795000000008`. Auditoría de solo adición. |
| T058 | Verificada | Permiso bloqueado con `FOR UPDATE` dentro de `autorizar`, antes de la idempotencia y de Catálogo. El replay revalida. |
| T059 | Verificada | Comando real ejecutado como proceso separado contra un PostgreSQL aislado (ver abajo): 9/9. |
| T060 | Verificada | Permiso, consumo de aprobación y constancia, y auditoría en una transacción (prueba de reversión). |
| T061 | Verificada | Alta inactiva, edición, activación y desactivación con jerarquía inmutable. Servicios conservados. |
| T062 | Verificada | Impacto de servicios distintos con vencimiento de cinco minutos. Confirmación de un solo uso con revalidación bajo bloqueo. |
| T063 | Verificada | Arnés `fixtures-hu25.ts`, siete operaciones y consulta pública con caché. |
| T064 | Verificada | `visibilidad-categorias.spec.ts`: 4/4 con Redis real y claves calientes (CA-CAT-02, 04, 07 a 10). |
| T065 | Verificada | CA-CAT-01 a CA-CAT-09 con datos y permiso operativos (T054, T056, T059, T064). CA-CAT-10: exclusión inmediata con caché caliente (T064). La desactivación durante la caída y la recuperación de Redis corresponde a T069. |

### Evidencia de T059: comando operativo contra un entorno aislado

Entorno: proyecto Docker `ayacucho-rf39-aislada`, contenedor y volumen propios, PostgreSQL 18 (misma imagen fijada por digest que la 002) en `127.0.0.1:54340`, credencial aleatoria en `tecnologia/.local/rf39-aislada/.env` (ignorado por Git). No se usó `ayacucho_002_validacion`, ninguna base de 001 ni producción. Cada ejecución crea una base `rf39_<uuid>`, la migra, y la elimina al terminar. Antes de cada comando la prueba valida el destino (host, puerto, usuario y nombre de la base) y consulta `current_database()` en el servidor.

Prueba: `procedimiento-rf39-aislado.spec.ts` (opt-in con `RF39_AISLADA_URL`; sin esa variable se omite). Ejecuta `scripts/gestionar-permisos-rf39.ts` en procesos nuevos con un entorno construido desde cero. Todas las comprobaciones se hicieron con SQL directo sobre PostgreSQL. Resultado: 9/9.

- `constancia`: sesión por entrada estándar. Una sesión inválida no deja filas. La constancia guarda cuenta y entorno, sin el Bearer. El token no aparece en la salida ni en la base.
- `conceder` rechazado sin cambiar la base (0 permisos, 0 aprobaciones, 0 auditorías, constancia sin consumir): firma de otra clave, cuenta distinta, aprobación vencida, firmante no designado y motivo alterado tras firmar.
- `conceder` válido: permiso `VIGENTE` versión 1. Aprobación registrada con firmante, ejecutor (principal del sistema operativo) y cuenta. Constancia consumida. Auditoría con `operativo:<principal>`, aprobación, acción y motivo. Otro proceso de la aplicación autoriza con ese permiso.
- Reutilización: la misma aprobación se rechaza y no duplica aprobaciones ni auditorías.
- `revocar`: una firma ajena se rechaza. Con una aprobación válida el permiso queda `REVOCADO` versión 2, con la fila conservada y `revocado_en` informado. La sesión 001, todavía abierta, recibe 403 en lectura y escritura. Una revocación repetida se rechaza con `PERMISO_NO_VIGENTE`.
- Auditoría: `UPDATE`, `DELETE` y `TRUNCATE` fallan con «solo adición» y el recuento no cambia.
- Ejecutor: si el principal del sistema no está habilitado en la configuración protegida, o falta esa configuración, el comando falla sin cambios.

Claves: el par Ed25519 se genera en memoria en cada ejecución. En la configuración protegida solo hay clave pública, y el cargador rechaza texto con clave privada. No hay secretos en Git.

Verificaciones transversales: `tsc` y `eslint` limpios. Unit + architecture: 18 suites, 217/217. Las suites 002 de contrato e integración pasan en ejecución individual o por grupos en serie. Frontend sin cambios.

Observaciones: ejecutar todas las suites en paralelo supera el límite de 30 s de algunos hooks por carga de la máquina. Cada suite afectada pasó al repetirse en serie. Esas ejecuciones dejaron bases `ayacucho_002_test_*` huérfanas, y se eliminaron solo esas. La base `ayacucho_002_validacion` no se modificó (no se ejecutaron migraciones sobre ella).

Limitaciones: los controladores, migraciones y rutas de categorías no están registrados todavía en `db:migrate:002` ni en la aplicación de 40 operaciones (T066 y T067). El comando usa `cargarConfiguracion`, que en modo validación solo admite bases `ayacucho_001_*`. Para 002 se resolverá con la raíz de composición de T066. El panel web de categorías pertenece a 012.

### Correcciones tras la auditoría final de la fase 6

Hallazgos de la auditoría y su resolución:

1. **Autoprotección del ejecutor sensible a mayúsculas (defecto confirmado).** `GestionarPermisosRf39` comparaba `ejecutor.cuentaId === a.cuentaId` con texto exacto. Una sonda demostró que el ejecutor asociado a una cuenta podía revocar su propio permiso con el UUID en mayúsculas. Corrección: la firma Ed25519 se verifica sobre el contenido original recibido, sin modificarlo. Solo después se normalizan con `uuidEnMinusculas` el ID de aprobación, la cuenta y la constancia. La comparación del ejecutor normaliza también la cuenta asociada en la configuración. La concesión no era evadible: la constancia se compara con el valor de la base y ya rechazaba mayúsculas.
2. **`emitirConstancia` sin validar al ejecutor.** Ahora recibe el principal del sistema y lo valida con el mismo `ejecutor()` que usan `conceder` y `revocar`, antes de consultar la sesión. Una identidad no habilitada, el firmante o una cadena vacía no crean registros. El comando pasa el principal del sistema operativo; no hay otra vía de autorización.
3. **Concesiones iniciales simultáneas.** No se cambió la lógica. Análisis: con dos constancias y dos aprobaciones válidas y distintas para una cuenta sin fila, ambas concesiones se aceptan (6 de 6 intentos de la sonda): permiso `VIGENTE` en versión 2, dos auditorías y dos aprobaciones consumidas. Una concesión secuencial posterior se rechaza con `PERMISO_YA_VIGENTE`. No incumple ninguna regla de negocio ni de contrato: el permiso es único por cuenta, cada aprobación y constancia se consume una sola vez, cada concesión queda auditada y exige una aprobación válida del Product Owner. Es una diferencia de comportamiento entre el caso secuencial y el concurrente, sin efecto de seguridad. Queda documentada y una prueba permanente fija los invariantes (un único permiso, y versión, auditorías, aprobaciones y constancias consumidas iguales al número de concesiones aceptadas).
4. **Estabilidad del arnés.** Los fallos observados eran siempre hooks `afterAll` de 30 s, nunca aserciones. PostgreSQL no era el límite: máximo 17 conexiones de 100, y crear y eliminar bases con 7 procesos tardó 3 s. Con 7 trabajadores las suites tardaban unos 90 s por contención de CPU de una máquina de 8 núcleos. Con 2 trabajadores terminan en 8 a 30 s. Se añadió el script `test:integration:002` (`--maxWorkers=2`, solo `prestadores-catalogo`). La configuración global de Jest y los timeouts no cambian, y `test:integration` sigue igual.

Pruebas permanentes nuevas (todas en `autorizacion-y-categorias.spec.ts`, ahora 32): autoprotección con UUID en minúsculas, mayúsculas y capitalización mixta; cuenta asociada en mayúsculas en la configuración; operar con UUID en mayúsculas persistiendo en minúsculas; firma sobre el original (cambiar solo la capitalización la invalida); constancia y cuenta en mayúsculas al conceder; emisión de constancias por ejecutor habilitado, no habilitado, firmante y cadena vacía, y la identidad comprobada antes de la sesión; concesiones simultáneas. En `procedimiento-rf39-aislado.spec.ts`: el comando `constancia` con un principal no habilitado y sin configuración no crea registros. Prueba de mutación: con la comparación antigua, 2 de las pruebas de autoprotección fallan, y con la corrección pasan. En `visibilidad-categorias.spec.ts` (7): referencias previas de solicitudes, cotizaciones y contrataciones, reactivación de un servicio PAUSADO con información anterior (CA-CAT-04) y subcategoría con estado propio inactivo (CA-CAT-08 y 09).

Verificación final (Node 24.15.0 local):
- Comando real RF39 contra PostgreSQL aislado (`ayacucho-rf39-aislada`): 9/9.
- Integración 002 con `--maxWorkers=2` (12 suites, incluido el comando aislado): 109/109, sin fallos de hooks y con 0 bases residuales.
- Contrato 002, unit y architecture (23 suites): 280/280.
- `tsc` y `eslint`: limpios.
- Regresión 001: se reutiliza 222/222 de la auditoría. No cambió código de 001 ni compartido.

Limitación de las pruebas paralelas: con más de 2 trabajadores las suites de integración 002 pueden superar los 30 s de `afterAll` en esta máquina. Es contención de CPU y no un defecto, pero conviene usar `test:integration:002`.


## Avance de la fase 7 (integración del monolito y regresión, en curso)

Estado: **fase 7 incompleta**. Verificadas T066 a T073 (73 de 94 acumuladas). T074 está EN CURSO: el workflow está escrito, pero no tiene una ejecución verificada en GitHub Actions (ver «T074 · CI propia de 002»).

| Tarea | Estado | Evidencia |
|---|---|---|
| T066 | Verificada | `crearAplicacionCompleta002` (`aplicacion-002.ts`, `oferta-002.ts`) registra las 23 operaciones de 002 con las 17 de la 001: el router coincide exactamente con la unión de los dos contratos (40) y la composición base conserva 17. Migraciones aditivas 4 a 8 (`persistenciaOferta002`). Unidad de trabajo, idempotencia e identidad compartidas. Arquitectura sin ciclos ni accesos cruzados. `main.ts` añade `iniciarValidacion002`. `cargarConfiguracion002` valida la base dedicada de 002 sin modificar el cargador de la 001. |
| T067 | Verificada | `arranque-completo.spec.ts` 9/9 (base vacía, copia de la 001 con esquema idéntico, 40 operaciones, semilla, pasos separados) y ejecución real sobre el entorno de validación 002 (ver abajo): `db:migrate:002`, `storage:init:002` y `test:seed:002` aplicados e idempotentes, y verificación HTTPS 22/22 a través del proxy. |
| T068 | Verificada | `regresion-001-002.spec.ts` 2/2: las 17 operaciones de la 001 son idénticas en el contrato compuesto, y la misma secuencia (registro, Origin ajeno o ausente, sin clave, cuerpo de 400 KB, sesión, CSRF, renovación, perfil, lectura de fotografías de cuenta, salud, ruta desconocida, cierre con cuerpo, cinco registros simultáneos, replay idempotente) da estados, cabeceras y atributos de cookie idénticos en la composición base y en la compuesta. X-08 de la 001 (`usuarios-acceso/openapi.spec.ts`, sin modificar) ejecutado en el entorno aislado de la 001: 20/20. La subida de fotografías de cuenta se cubre con X-08 de la 001 (`POST /perfil/fotografias`). |
| T069 | Verificada | `redis-revision.spec.ts` 5/5 con dos réplicas, PostgreSQL real y un Redis propio detenido y reiniciado: caché compartida y TTL ≤ 60 s; CA-CAT-10 con Redis detenido (desactivación excluida de inmediato en ambas réplicas y entradas antiguas recuperadas ni servidas ni sobrescritas); repoblación tardía sin escritura; 503 con la revisión inaccesible; restaurar una base descartable (`pg_dump` y `psql`) sin rotar el espacio sirve el listado de otra línea de tiempo con la misma revisión, y con espacio rotado no. |
| T070 | Verificada | Ver «T070» más abajo: respaldo y restauración coordinados, con rotación del espacio Redis y puerta de restauración. |
| T071 | Verificada | Ver «T071» más abajo: ensayo en un proyecto Docker descartable. |
| T072 | Verificada | Ver «T072» al final del documento. |
| T073 | Verificada | Ver «T073» al final del documento: límites de integración con 003, 004, 007, 008, 011 y 012. |
| T074 | EN CURSO (workflow escrito; sin ejecución en GitHub Actions) | CI propia de 002. Ver «T074 · CI propia de 002 (en curso)». |

### Operaciones sobre el entorno de validación 002 (autorizadas)

Verificación previa, sin modificar datos: destino confirmado como `127.0.0.1:54330`, base `ayacucho_002_validacion`, usuario dedicado `ayacucho_validacion_002`, contenedor `ayacucho-002-validacion-postgres-1` (proyecto `ayacucho-002-validacion`). Modo `validation`. Estado inicial: 11 migraciones, 15 tablas, 0 usuarios, 5 distritos y revisión 1. Las migraciones pendientes (4 a 8) solo contienen `CREATE TABLE`, `CREATE INDEX` y funciones y disparadores nuevos. Los `DROP` solo existen en `down`. No alteran tablas existentes. Respaldo previo con `pg_dump` en el directorio temporal de la sesión (fuera de Git, 31 557 bytes, SHA-256 `7a190e02…`), restaurado en una base descartable con resultado idéntico (11 migraciones, 5 distritos, 15 tablas). Garage: bucket `portafolio-002-validacion` y una identidad `portafolio-002` ya existentes. El script no la reemplaza.

- `db:migrate:002`: primera ejecución, 5 migraciones aplicadas (de 11 a 16; de 15 a 27 tablas); segunda, 0. Datos preexistentes intactos.
- `storage:init:002`: dos ejecuciones idempotentes, mismo bucket y misma identidad de lectura y escritura (sin permiso de propietario).
- `test:seed:002`: 6 clasificaciones ficticias; cuenta ficticia `operador-categorias-002@example.invalid`; permiso RF39 concedido por constancia, aprobación firmada con firmante efímero en memoria (entorno `validacion-002`) y comando interno, con auditoría `operativo:<principal del sistema>`. La segunda ejecución no cambia datos. La credencial ficticia queda solo en `tecnologia/.local/002/operador-ficticio.json` (ignorado por Git). La identidad y el permiso solo existen en esta base y la aprobación quedó consumida.
- Nota: la semilla avanza la revisión de Catálogo en cada ejecución, aunque los datos no cambien. Es inocuo (solo invalida caché).
- Estado final de la base de validación: 16 migraciones; tras la verificación HTTPS hay 4 cuentas ficticias, 9 categorías (6 de la semilla y 3 `Prueba HTTPS`, todas inactivas), 1 permiso y 4 auditorías. No se ejecutaron comandos destructivos.

### Verificación HTTPS (proxy de la 002)

Proxy `ayacucho-002-validacion-proxy-1` (ya definido en el proyecto, solo `127.0.0.1:8444`; se inició y se detuvo de nuevo al terminar) y backend integrado (`start:validation:002`, 40 operaciones) en `127.0.0.1:3002`. Certificado `CN=localhost` con SAN `localhost` y `127.0.0.1`, emitido por la CA local de la 002, válido hasta el 19/12/2026. La cadena se verifica con la CA local, y sin ella el cliente rechaza el certificado (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). `curl` con la CA local responde 200, y el HTTP plano en 8444 no sirve la API. La revocación no se consulta porque la CA local no publica CRL (`--ssl-no-revoke` en `curl`).

`scripts/verificar-https-002.ts` (`test:https:002`), 22 de 22: cabeceras del proxy (no-store, no-referrer, nosniff); 001 (Origin ausente 400 y ajeno 403, 413 con 400 KB, contraseña incorrecta 401, sesión 200 con cookie `__Secure-` HttpOnly Secure SameSite y ruta `/api/v1/sesiones`, perfil con y sin sesión, renovación sin CSRF, alta de cuenta, cierre de sesión 204); 002 (categorías, servicios y prestadores públicos conformes a `C002CategoriasPublicas`, `C002PaginaServicios` y `C002PaginaPrestadores`, filtro no admitido 400, rutas internas sin sesión 401, operador con permiso conforme a `C002CategoriasAdmin`, alta 201 conforme a `C002CategoriaAdmin` con replay idempotente, Origin ajeno 403, sin `Idempotency-Key` 400, propiedad de identidad 400, cuenta sin permiso 403 en lectura y escritura, token de sesión cerrada 401). Los certificados y claves de la CA local están en `.local/002/tls` (ignorado por Git).

Limitación: se verificó con la CA local de validación (no una CA pública) y sin navegador. La interfaz web de la 002 (puerto 5175) no se levantó, ya que su integración corresponde a T072.

### Verificaciones (histórico al cierre de T069; ver «Estado vigente» al final)

`tsc`, `eslint` y `build` correctos. Integración 002 con 2 trabajadores (12 suites): 109/109. Suites que alteran infraestructura (RF39 aislado y Redis, serial): 14/14. Contrato 002: 65/65. Unit + architecture: 217/217. X-08 de la 001: 20/20. Regresión completa de la 001: se reutiliza 222/222 (no cambió código de 001 ni `app.module.ts`). Scripts `test:integration:002` (2 trabajadores, sin las suites que alteran infraestructura) y `test:integration:002:infra` (serial) separan los dos grupos. En una corrida paralela, con las dos suites de infraestructura en el grupo, hubo tiempos de espera agotados por la carga del equipo y por detener y reiniciar Redis. Por eso se separaron, como exige T069 (infraestructura propia o ejecución serial). Todas las bases `ayacucho_002_test_*` huérfanas de corridas interrumpidas se eliminaron (0 restantes).

### Riesgos y limitaciones

- **Caché Redis tras restaurar una base (resolver en T070). Resuelto en T070: ver «Estado vigente» al final.** Si se restaura una base con el mismo espacio Redis y las revisiones coinciden, la copia sirve entradas de otra línea de tiempo (demostrado en T069). La restauración debe rotar el espacio Redis antes de abrir el tráfico.
- Al cierre de ese avance, T072 y T073 estaban pendientes (se verificaron después) y T074 está ahora EN CURSO, sin ejecución verificada en GitHub Actions.
- Las pruebas de RF39 y Redis son opt-in (`RF39_AISLADA_URL`, `REDIS_AISLADO_URL`) y usan contenedores propios (`ayacucho-rf39-aislada`, `ayacucho-redis002-aislado`).
- Los scripts de la 002 deben invocarse con la ruta absoluta con unidad `C:` en mayúscula (por ejemplo `node --import tsx C:/…/scripts/iniciar-validacion-002.ts migrar`). Con la unidad en minúscula, la comprobación estricta del manifiesto del catálogo falla (la validación no se relajó).

### T070 · Respaldo y restauración coordinados del portafolio

Estado: **verificada** (70 de 94 acumuladas en ese momento; la corrección posterior de la puerta está en «Estado vigente»). En ese momento T072 y T073 estaban pendientes (se verificaron después) y T074 estaba por empezar; hoy T074 está EN CURSO.

Implementación:
- `src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.ts`: lógica del procedimiento, sin Docker ni S3 (puertos `OrigenPostgres`, `DestinoPostgres` y `AlmacenPortafolio`).
- `src/composicion/respaldo-002.ts`: adaptadores. Instantánea y bloqueo con `pg`, `pg_dump --snapshot` y `psql` dentro del contenedor PostgreSQL con la clave por entorno (`-e PGPASSWORD`, nunca por argumentos), y la puerta de restauración.
- `src/composicion/puerta-restauracion-002.ts`: la puerta y su efecto en el arranque. `main.ts` (`iniciarValidacion002`) rechaza arrancar sobre una base restaurada sin completar y usa el espacio Redis fijado por una restauración completada.
- `scripts/respaldar-portafolio-002.ts` y `scripts/restaurar-portafolio-002.ts` (`backup:portafolio:002`, `restore:portafolio:002`).

Coordinación entre PostgreSQL, Garage y Redis:
1. **Corte.** Se abre una transacción `REPEATABLE READ` con `LOCK TABLE prestadores_fotografias, prestadores_objetos_pendientes IN SHARE MODE` y `lock_timeout`. Esto bloquea INSERT, UPDATE y DELETE sobre ambas tablas: pausa a los escritores de portafolio y a la limpieza de todas las réplicas y espera a las operaciones en curso. Si el drenaje no se confirma, se aborta con `INCOMPLETO` (`DRENAJE_NO_CONFIRMADO`). Después de obtener el bloqueo se exporta la instantánea. Una segunda conexión comprueba que ve el mismo número de referencias, lo que demuestra que la instantánea es posterior al bloqueo. El inventario de fotografías vigentes (clave, tamaño, MIME y SHA-256) y el volcado (`pg_dump --snapshot`) salen de esa misma instantánea. Los objetos referenciados se copian antes de reanudar y se cotejan con tamaño y SHA-256. Los huérfanos no se copian. La transacción se libera siempre (reanuda escritores y limpieza), incluso ante un fallo.
2. **Manifiesto.** `backupId`, corte UTC, origen lógico (base, bucket, prefijo y espacio Redis), versión mayor de PostgreSQL, aplicación y migraciones, SHA-256 del volcado, inventario y conteos, firmado con HMAC-SHA256. `COMPLETO` solo tras cotejar ambos lados. Cualquier fallo deja `INCOMPLETO` con la causa, y ese conjunto no se puede restaurar.
3. **Protección.** Volcado y objetos se cifran con AES-256-GCM, con el `backupId` y el nombre del artefacto como datos autenticados: un artefacto de otro conjunto no se descifra. La clave (`RESPALDO_CLAVE`, 32 bytes en base64) y la ruta de respaldos (`RESPALDO_DIRECTORIO`, absoluta y fuera del repositorio) llegan por entorno, nunca por Git. Los archivos se crean con permisos 0600. Los scripts exigen `--confirmo <nombre exacto de la base>`. El respaldo queda fuera del limpiador, porque está en disco y no en el bucket.
4. **Restauración.** Primero se verifica todo sin tocar destinos: firma, estado `COMPLETO`, mismo `backupId`, versión mayor de PostgreSQL, lista exacta de migraciones, y descifrado y SHA-256 de volcado y objetos. Después: destino validado (`ayacucho_002_restauracion_*` o `ayacucho_002_test_*`, local, distinto del origen y nunca validación, 001 ni producción; bucket o prefijo nuevo, distinto del origen y vacío), `CREATE DATABASE` (falla si existe, no se reutiliza ni sobrescribe), `psql` del volcado, la **puerta** `restauracion_002` creada en `CERRADO`, remapeo de claves al prefijo nuevo, reconstrucción del bucket con los objetos verificados, reconciliación (se descartan las preparaciones inconclusas y se conservan las purgas para que el limpiador las reintente) y cotejo final de cada referencia contra su objeto, tamaño y SHA-256. Solo entonces la puerta pasa a `ABIERTO` con un **espacio Redis nuevo** (`ayacucho:002:restaurada-<id>-<aleatorio>`, distinto del origen y entre restauraciones).
5. **Redis.** El arranque lee la puerta y fuerza `REDIS_NAMESPACE` al espacio de la restauración en todas las réplicas. Como la revisión de Catálogo restaurada coincide con la del origen, ese espacio nuevo es lo que impide servir entradas de otra línea de tiempo (riesgo demostrado en T069).

Si la restauración falla (texto original; la puerta se crea ahora antes del volcado, ver «Estado vigente»): una verificación previa fallida (firma, pareja, versión, objeto ausente o alterado, INCOMPLETO) no crea ningún destino. Un fallo posterior (restauración del volcado, remapeo, objetos, reconciliación, cotejo o apertura) deja la puerta `CERRADO`, y el arranque se rechaza con «el tráfico permanece cerrado». Ni la base ni el prefijo se reutilizan: el reintento exige un destino limpio y recupera el conjunto válido.

Pruebas (Node 24.15.0): unitarias 18/18 (`respaldo-portafolio.spec.ts`: clave, cifrado, firma, validación del destino, respaldo con puertos falsos, pareja incorrecta, manifiesto alterado, INCOMPLETO, versión, objeto ausente o alterado, destino no vacío, interrupciones en cada etapa y cotejo final). Integración 10/10 (`respaldo-portafolio.spec.ts`, PostgreSQL real con `pg_dump` y Garage real, solo bases `ayacucho_002_test_*` y prefijos nuevos): respaldo COMPLETO cifrado con inventario de la instantánea, pausa real de las escrituras y la limpieza (INSERT, UPDATE y DELETE bloqueados, lectura permitida) y reanudación, drenaje no confirmado con un escritor abierto, objeto alterado o ausente en Garage, restauración completa con claves remapeadas, reconciliación, puerta abierta y espacio Redis nuevo, interrupción con puerta cerrada, arranque rechazado, destino ocupado no reutilizado y recuperación en un destino limpio, y rechazo de la base de validación, de 001 y del prefijo de origen. Las guardas de los scripts se ejecutaron como procesos: sin `--confirmo`, directorio dentro del repositorio, destino igual a la base de validación y destino sin confirmar, todos con salida 1 y sin efectos. Unit + architecture 235/235, `tsc`, `eslint` y `build` correctos, `arranque-completo` 9/9. No se ejecutó ninguna restauración sobre `ayacucho_002_validacion` ni sobre el bucket de portafolio: la base de validación conserva 16 migraciones y no tiene la puerta; el bucket sigue con sus 12 objetos. Las bases descartables se eliminaron (0 restantes).

Limitaciones:
- El tráfico «cerrado» se impone en el arranque de la aplicación (`iniciarValidacion002`) y no en una API que ya esté en ejecución. Es suficiente para una restauración a un destino nuevo, donde ninguna réplica apunta aún a la base.
- Las pruebas usan prefijos nuevos `pruebas/<uuid>/portafolio/` en el bucket de validación en vez de un bucket nuevo. La restauración a un bucket nuevo se prepara con `S3_BUCKET_DESTINO` y el prefijo `portafolio/`, y se ensayará con infraestructura descartable en T071.
- Quedan para T071: el ensayo en un proyecto Docker descartable, la comprobación por la API (foto vigente 200, retiradas y pendientes 404), el rechazo del acceso anónimo al bucket y la prueba con parejas incompatibles sobre ese proyecto.
- La cifra de eficiencia con volúmenes grandes no se midió (el volcado se mantiene en memoria).

### T071 · Ensayo de restauración coordinada

Estado: **verificada** (71 de 94 acumuladas). T072 y T073 se verificaron después y T074 está hoy EN CURSO, sin ejecución verificada en GitHub Actions. Pruebas de puerta y arranque añadidas después: ver «Estado vigente».

Infraestructura descartable e independiente: proyecto Docker `ayacucho-ensayo-restauracion` (`compose.ensayo-restauracion.yaml`) con PostgreSQL 18, Garage v2.5.0 y Redis 8 propios (imágenes fijadas por digest), contenedores, red, volúmenes (`ensayo-postgres-datos`, `ensayo-objetos-meta`, `ensayo-objetos-datos`) y puertos exclusivos (`127.0.0.1:54341`, `3930` y `63851`). Credenciales aleatorias exclusivas del ensayo, generadas por `scripts/preparar-ensayo-restauracion-002.ts` en `tecnologia/.local/ensayo-restauracion` (ignorado por Git, permisos restringidos). El origen del ensayo es una base `ayacucho_002_ensayo_origen_*` con el bucket `ensayo-origen`. El destino es una base `ayacucho_002_restauracion_*` nueva con el bucket `ensayo-destino`. No se tocaron `ayacucho_002_validacion` (16 migraciones, sin la puerta de restauración), ninguna base de 001, ni el bucket `portafolio-002-validacion` (sigue con 12 objetos).

Prueba `restauracion-portafolio.spec.ts` (opt-in con `ENSAYO_RESTAURACION_ENV`), 11/11. El origen se prepara con el API real: una cuenta, un perfil, un trabajo, una foto vigente, una foto retirada (con purga pendiente) y una preparación inconclusa con su objeto sin referencia.
- **Respaldo.** COMPLETO con 1 referencia vigente y 1 objeto copiado. La retirada, la preparación inconclusa y el objeto huérfano no se copian.
- **Restauración completa de PostgreSQL y Garage.** Destino nuevo: la puerta pasa de CERRADO a ABIERTO con un espacio Redis nuevo (`ayacucho:002:restaurada-…`). PostgreSQL restaurado tiene 1 referencia con el mismo SHA-256, la purga conservada, la preparación descartada y todas las migraciones. Garage de destino tiene exactamente 1 objeto con el mismo contenido. El origen no cambia.
- **Aplicación integrada sobre la base restaurada, con dos réplicas** (`iniciarValidacion002`, puertos 3941 y 3942, con `REDIS_NAMESPACE` configurado al espacio del origen): ambas responden `salud`, `categorias`, `servicios` y `prestadores`. Todas las claves de Redis (Redis descartable vaciado antes) empiezan por el espacio de la restauración y ninguna por el del origen: las dos réplicas usan el espacio nuevo que fija la puerta.
- **HTTP.** Fotografía vigente: 200 con el mismo contenido (SHA-256 idéntico). Retirada, pendiente e inexistente: 404 sin contenido, en las dos réplicas.
- **Acceso anónimo directo al bucket:** `GET` del objeto y listado del bucket, tanto en el destino como en el origen, responden 403. Una firma con una clave falsa también se rechaza.
- **Limpieza** sobre la base restaurada (purgas vencidas y reconciliación de huérfanos): sin errores, no borra la fotografía vigente (sigue 200) y consume la purga pendiente.
- **Tráfico cerrado ante una restauración incompleta.** Una restauración interrumpida tras copiar objetos deja la puerta CERRADA. `iniciarValidacion002` rechaza arrancar («el tráfico permanece cerrado») y no hay ningún puerto escuchando. El destino ocupado (mismo prefijo o misma base) no se reutiliza. En un destino limpio se recupera el conjunto y el servicio sí arranca.
- **Rechazo de conjuntos incompatibles o alterados, sin crear ninguna base:** versión mayor de PostgreSQL y migraciones distintas, clave de respaldo distinta, manifiesto de otro respaldo, manifiesto con estado, hash del volcado o hash de objeto alterados, volcado y objeto cifrados alterados, objeto ausente, volcado ausente y respaldo INCOMPLETO (origen con un objeto alterado). Tras restaurar los artefactos válidos, un destino limpio abre su puerta.
- **Protección de claves.** Cada proceso externo (`docker exec … pg_dump` y `psql`) se observa por un punto de sustitución: ningún argumento contiene la clave de respaldo ni las credenciales de PostgreSQL, Garage ni S3, y la clave de PostgreSQL viaja solo por la variable de entorno `PGPASSWORD` (el argumento es únicamente el nombre). Esos valores tampoco aparecen en la salida estándar y de error durante respaldo, restauración, arranque y fallos, ni en los mensajes de error y las trazas. Tampoco están en el manifiesto, en los artefactos cifrados, en el resultado de la restauración, ni en ningún archivo versionado o sin versionar y no ignorado (`git grep --untracked`).

Cambios de código por el ensayo: `cargarConfiguracion002` admite también `ayacucho_002_restauracion_*` (con prueba), `iniciarValidacion002` devuelve un manejador para cerrar el servicio, y `respaldo-002.ts` expone el punto de sustitución de procesos externos (`lanzador`). `test:integration:002` y `test:integration:002:infra` separan la nueva suite con las que alteran infraestructura (ejecución serial).

Verificaciones: `tsc`, `eslint` y `build` correctos. Unit, architecture y contrato (26 suites): 305/305. Integración 002 (sin las suites de infraestructura): todas pasan, algunas solo al repetirse sola por carga del equipo. Suites de infraestructura en serie (RF39 aislado, Redis y ensayo de restauración): pasan. Todas las bases descartables eliminadas (0 en el servidor de validación, en el de RF39 y en el del ensayo) y los buckets del ensayo vacíos.

Limitaciones:
- El ensayo emplea un Garage descartable con credenciales exclusivas. En producción habría que usar la identidad de lectura y escritura del bucket real.
- El tráfico «cerrado» se impone en el arranque de la aplicación, no en una API que ya esté en ejecución sobre esa base.
- El ensayo no cubre el proxy HTTPS ni la interfaz web (T072).
- Varias corridas aparecieron lentas o con tiempos de espera agotados cuando la CPU del equipo estaba ocupada por otros programas (hasta 5 veces más tiempo). Cada suite pasó al repetirse sola.
- Con volúmenes grandes de datos el volcado se mantiene en memoria (no se midió).

### Revisión complementaria de T071 (regresión de 001 y seguridad de procesos)

**Diff de `main.ts` respecto a `8aa7425`.** `iniciar()` (el punto de entrada de 001, usado por `scripts/iniciar-validacion.ts`, `npm start` y el `CMD` del Dockerfile) no cambió: mismo cuerpo, mismas llamadas, mismo mensaje. El cambio es aditivo: se añade la función exportada `iniciarValidacion002` y sus importaciones estáticas (`S3Client`, `cargarConfiguracion002`, `aplicacion-002`, `puerta-restauracion-002`, `ClienteRedis002`, `PortafolioS3`). Esas importaciones se evalúan al cargar el módulo, también cuando solo se usa `iniciar()`. Efecto medido en el módulo compilado, con 5 cargas por variante: `app.module` solo, 119 MB de RSS, y `main`, 127 a 128 MB (unos 9 MB más) y unos cientos de ms más, dentro del ruido de la máquina. No ejecutan lógica de arranque al importarse. Las dependencias (`sharp`, `redis`, `@aws-sdk/client-s3`) son de producción y el Dockerfile ya incluye los contratos de 002. Ningún archivo de 001 cambió (`usuarios-acceso`, `compartido`, `app.module.ts`, `contracts/openapi.json`, `scripts/iniciar-validacion.ts`).

**Arranque de 001 por su punto de entrada de producción.** El módulo compilado `main.js` (el mismo que ejecuta el `CMD`) se arrancó con la configuración del entorno aislado de la 001, sobre una base nueva `ayacucho_001_test_*` del contenedor aislado con las 8 migraciones fundacionales (se eliminó al terminar; la base de validación aislada, vacía, no se tocó). Respuesta de salud 200 a los 8 s. Humo HTTP, 18 de 19 correctas:
- Las 17 operaciones del contrato de 001 están registradas, y las 6 rutas de 002 sondeadas (`/categorias`, `/servicios`, `/prestadores`, `/admin/categorias`, `/servicios/mios`, `/prestadores/perfil`) responden 404: la composición base sigue siendo de 17 operaciones.
- Salud 200, alta 201, Origin ausente 400, ajeno 403 y sin `Idempotency-Key` 400, cuerpo de 400 KB 413, contraseña incorrecta 401, sesión 200, cookie `__Secure-` HttpOnly Secure SameSite con ruta `/api/v1/sesiones`, perfil con sesión 200 y sin sesión 401, renovación sin credencial 401 y con CSRF incorrecto rechazada, cierre de sesión 204 y el token deja de servir.
- La única marca fallida fue un error de mi script: consultaba `GET /sesiones/csrf` con Bearer. El contrato exige la cookie de renovación. Con ella: sin credencial 401, con cookie y Origin propio 200 (devuelve `csrfToken`) y con Origin ajeno 403.

**Regresión de 001.** Como `main.ts` es el punto de entrada, aunque no cambie su lógica, se ejecutó la regresión completa en el entorno aislado: 21 suites, 222/222. Unit y architecture, 305/305 (26 suites con contrato 002).

**Seguridad del punto de sustitución (`respaldo-002.ts`).**
- `lanzador.execFile` es `execFile` de Node (sin shell). Programa fijo `docker`, subcomando fijo `exec -i -e PGPASSWORD <contenedor> <pg_dump|psql> -h 127.0.0.1 -p 5432 -U <usuario> …`. Los únicos programas lanzados son `pg_dump` y `psql`, con constantes en los dos puntos de llamada. Los nombres de contenedor son constantes de los scripts (`ayacucho-002-validacion-postgres-1`) o de las pruebas.
- Argumentos controlados: el identificador de instantánea debe cumplir `^[0-9A-F]{8}-[0-9A-F]{8}-\d$` (si no, se rechaza antes de lanzar procesos); la base de destino debe cumplir `^ayacucho_002_(restauracion|test)_[a-z0-9_]{4,60}$` (validarDestino) y `^ayacucho_002_[a-z0-9_]+$` antes de `CREATE DATABASE`; el resto de los argumentos son literales.
- Ninguna entrada HTTP llega a ese código: solo lo importan `scripts/respaldar-portafolio-002.ts`, `scripts/restaurar-portafolio-002.ts` y pruebas. Ningún archivo de `src` lo importa, y es el único archivo de `src` que usa `node:child_process` (comprobado por una prueba). El arranque solo importa `puerta-restauracion-002.ts`, que no lanza procesos.
- Credenciales: la clave de PostgreSQL viaja solo en `PGPASSWORD` por el entorno del proceso, y el argumento es únicamente el nombre de la variable. Un fallo del proceso informa solo programa y código de salida (`psql terminó con código 2`), sin argumentos, entorno ni salida. El ensayo T071 verificó además que ninguna credencial aparece en procesos, registros, errores, artefactos ni archivos del repositorio.
- Nueva prueba unitaria `respaldo-002-procesos.spec.ts` (5/5, sin Docker): forma exacta de los procesos, entorno, rechazos previos al lanzamiento, mensajes de error y alcance de importaciones.
- Observación de endurecimiento (no es un defecto demostrado, sin cambio aplicado): `docker()` confía en que sus llamadores pasen constantes. Si en el futuro se aceptara un nombre de contenedor externo, convendría validarlo (`^[a-z0-9][a-z0-9_.-]*$`) y limitar `programa` a `pg_dump` y `psql` dentro de la función.

**Operación de restauración.** La puerta de restauración protege el arranque de nuevas instancias sobre la base restaurada. No detiene una API que ya esté en funcionamiento. Antes de dirigir el tráfico a una base restaurada hay que detener o aislar todas las réplicas antiguas (las que usan la base y el espacio Redis anteriores) y arrancar las nuevas solo cuando la restauración termine con la puerta ABIERTA. Está documentado en `scripts/restaurar-portafolio-002.ts` y en `quickstart.md`.

## Estado vigente tras la auditoría final de T066–T071

Esta sección sustituye, como referencia vigente, a las cifras y estados de las secciones anteriores de la fase 7, que se conservan como historial de trabajo y reflejan el momento en que se escribieron. Fecha de las verificaciones: 19/11/2026, Node.js 24.15.0 local.

### Hallazgos de la auditoría y su resolución

- **Alto, corregido: una restauración interrumpida durante `psql` podía dejar una base que arrancaba.** El orden era crear la base, restaurar el volcado y después crear la puerta. Si `psql` fallaba a mitad, la base quedaba sin puerta y `iniciarValidacion002` interpretaba «sin puerta» como «no restaurada». Esto hacía incorrecta la frase de T070 («una interrupción deja la puerta CERRADA») para los fallos anteriores a la creación de la puerta. Correcciones:
  - La puerta se crea CERRADA inmediatamente después de crear la base y antes de restaurar ningún dato. Tras restaurar el volcado se comprueba, con una consulta real, que sigue CERRADA y ligada al mismo respaldo (`PUERTA_ALTERADA` si no).
  - `iniciarValidacion002` trata como destino de restauración toda base `ayacucho_002_restauracion_*`: si su puerta no existe, no se puede consultar (incluida una base inexistente o inaccesible) o no está ABIERTA, el arranque se rechaza. La ausencia de la puerta nunca autoriza el arranque. Para el resto de las bases el comportamiento no cambia (sin puerta arrancan; una puerta CERRADA las rechaza).
  - El volcado no puede tocar la puerta: `pg_dump` excluye la tabla `restauracion_002` (`--exclude-table`) y la restauración rechaza un volcado que la mencione (`VOLCADO_CONTIENE_PUERTA`).
  - Los destinos reales de restauración son únicamente `ayacucho_002_restauracion_*`. Los nombres `ayacucho_002_test_*` solo se admiten si el llamador de pruebas lo pide de forma explícita (`permitirBasesDePrueba`). Los scripts no lo piden.
- **Evidencia añadida para T067:** la respuesta de salud se valida contra el esquema `Salud` del contrato de la 001, tanto en la aplicación compuesta (`arranque-completo.spec.ts`) como por HTTPS (`verificar-https-002.ts`).
- **Evidencia añadida para T068:** nueva prueba `fotos-cuenta-composicion.spec.ts` (ver más abajo) con subida real de fotografías de cuenta, lectura propia, rechazos, aislamiento y subidas simultáneas, comparadas con la composición base.
- **Documentación:** este apartado, las notas de «histórico» en las secciones previas y la actualización de los riesgos que T070 resolvió.

### Pruebas añadidas

- Unitarias (`respaldo-portafolio.spec.ts`, ahora 21): orden (la puerta antes del volcado), fallos al crear la base, tras crearla, tras cerrar la puerta y durante el volcado, volcado que menciona la puerta, puerta eliminada tras el volcado y destinos de prueba solo con indicación explícita.
- Integración con PostgreSQL real en el proyecto descartable del ensayo (`restauracion-portafolio.spec.ts`, ahora 20), diez pruebas nuevas:
  - Interrupción inmediatamente después de crear la base.
  - Puerta CERRADA sin datos.
  - Fallo real de `psql` tras restaurar parcialmente los datos.
  - Ausencia de la puerta en una base de restauración sana y migrada.
  - Puerta no consultable.
  - Base inexistente o inaccesible.
  - El volcado de una base ya restaurada no toca la puerta (la nueva restauración tiene la suya).
  - Restauración completa y arranque con el espacio Redis nuevo.
  - Bases que no son destinos de restauración que conservan su comportamiento.
  - Una puerta CERRADA en una base que no es de restauración también la rechaza.
- `fotos-cuenta-composicion.spec.ts` (nueva, opt-in, proyecto descartable, 1 prueba): la misma secuencia sobre la composición base y la completa da respuestas idénticas (estados, cabeceras y forma). Subida 201 conforme a `FotografiaResultado`, lectura propia 200 conforme a `FotografiaLectura` con el mismo contenido, imagen inválida y formato no admitido rechazados, sin sesión 401, otra cuenta 404, sin sesión 401 al leer y seis subidas simultáneas 201.
- Prueba de mutación: con el orden antiguo (puerta después del volcado) fallan las pruebas «puerta CERRADA sin datos» y «fallo de psql». Con «ausencia de la puerta = autorización» fallan «interrupción inmediatamente después de crear la base» y «ausencia de la puerta». Con la corrección pasan las dos. Los archivos se restauraron y comparados byte a byte con los originales.

### Resultados vigentes

| Verificación | Resultado vigente |
|---|---|
| `typecheck`, `eslint` (`--max-warnings=0`) y `build` | Limpios |
| Unit + architecture + contrato (27 suites) | 314/314 |
| Integración 002 con 2 trabajadores, sin las suites de infraestructura (13 suites) | 119/119 |
| Infraestructura propia, en serie (ensayo de restauración 20, RF39 aislado 9, Redis 5 y fotos de cuenta 1) | 35/35 |
| HTTPS contra el entorno de validación 002 (`verificar-https-002.ts`, ahora con el esquema `Salud`) | 22/22 |
| Regresión completa de la 001 | 222/222, última ejecución completa en la revisión complementaria de T071. Desde entonces no cambió código de 001 ni `main.ts` (las modificaciones son del respaldo y la restauración). No se repite. |
| Bases `ayacucho_002_test_*`, `rf39_*`, `ayacucho_002_*` de los servidores | 0 residuales |

Los resultados de las secciones anteriores que difieren de esta tabla (por ejemplo 217/217, 109/109 o «12 suites») eran correctos al cierre de T069 y quedaron superados por el crecimiento de las suites. La base `ayacucho_002_validacion` conserva 16 migraciones y no tiene tabla de puerta. Tras las verificaciones HTTPS contiene solo datos ficticios: 5 cuentas, 10 categorías (6 de la semilla y 4 `Prueba HTTPS`, inactivas), 1 permiso y 5 auditorías.

### Estado de T066–T071

| Tarea | Estado | Evidencia vigente |
|---|---|---|
| T066 | Verificada | 40 operaciones (17 + 23), composición base de 17 intacta, arquitectura sin ciclos. |
| T067 | Verificada | Migración, almacenamiento y semilla en el entorno de validación, arranque sobre base vacía y copia de la 001, HTTPS 22/22 incluido el esquema `Salud`. |
| T068 | Verificada | Contrato de las 17 operaciones idéntico, secuencia diferencial 001, X-08 (20/20) y fotografías de cuenta en la composición completa. |
| T069 | Verificada | Dos réplicas, CA-CAT-10 con Redis detenido, repoblación tardía, 503 con revisión inaccesible y rotación del espacio Redis. |
| T070 | Verificada | Respaldo y restauración coordinados; la puerta de restauración protege ahora también las interrupciones durante el volcado. |
| T071 | Verificada | Ensayo en un proyecto descartable, con las pruebas de puerta y arranque sobre PostgreSQL real. |

### Riesgos y limitaciones vigentes

- **Resuelto:** el riesgo de caché Redis tras restaurar una base (T069) quedó resuelto por T070 con la rotación del espacio Redis, y la restauración interrumpida que dejaba una base arrancable quedó resuelta en esta corrección.
- **Operación.** La puerta protege el arranque de instancias nuevas. No detiene una API que ya esté en funcionamiento: antes de dirigir el tráfico a una base restaurada, detener o aislar las réplicas antiguas.
- **Entrada de producción.** Por omisión `npm start` y el `CMD` del Dockerfile arrancan la composición base de 17 operaciones. Las 40 operaciones se activan de forma explícita con `COMPOSICION=oferta-002` (ver T072).
- **Suites opt-in.** Las del ensayo de restauración, las de Redis y RF39 aislados y las de fotos de cuenta exigen sus variables de entorno y se omiten sin ellas. Se ejecutan con `test:integration:002:infra` y las invoca el workflow de T074 (EN CURSO, aún sin ejecución verificada en GitHub Actions).
- **Carga del equipo.** Con la CPU ocupada por otros programas, algunas suites superan los 30 s. Cada una pasó al repetirse sola.
- Los permisos 0600 de las copias no se aplican en Windows: la protección real es el cifrado y que el directorio esté fuera del repositorio. El volcado se mantiene en memoria.
- La verificación de salud solo comprueba las tablas de la 001: una base sin migraciones de la 002 no se detecta ahí.
- `docker()` confía en que sus llamadores pasen constantes (endurecimiento posible, sin defecto demostrado).

### T072 · Interfaz compuesta: navegación, origen y sesión

Estado: **verificada** (72 de 94 acumuladas). T073 se verificó después y T074 está hoy EN CURSO, sin ejecución verificada en GitHub Actions.

- **Backend (`composicion/main.ts`).** `iniciar()` despacha según `COMPOSICION`: vacía o `base` arranca las 17 operaciones; `oferta-002` arranca las 40 con el mismo origen público y los mismos controles; cualquier otro valor se rechaza con «COMPOSICION no es válida» (no hay composición implícita). `iniciarValidacion002` se conserva como alias.
- **Frontend (`composicion/App.tsx`).** Rutas `/buscar` (pública, sin sesión), `/prestador/perfil` y `/prestador/servicios` (requieren sesión y perfil de prestador; sin él se ofrece habilitarlo). Tras iniciar sesión se vuelve a la ruta profesional solicitada, y si no, a `/cuenta`. Las consultas públicas van anónimas (`credentials: 'omit'`, sin Authorization); las privadas usan el Bearer en memoria de la sesión existente. Las categorías públicas (`GET /categorias`) alimentan el filtro de búsqueda, las especialidades del perfil y la categoría del servicio, con etiquetas «Raíz › Subcategoría», error recuperable y reintento.
- **Pruebas.** Frontend: 9 pruebas nuevas de navegación compuesta (100/100 en total). Backend: despacho 3/3 e integración del punto de entrada, 120 de integración 002 y 35 de infraestructura (cifras de la primera ejecución). En la auditoría, proyectos `unit` y `architecture` 247/247 (21 suites) y, tras añadir la comprobación del proxy, 252/252 (22 suites); la cifra «317 unitarias» de la primera versión de este informe no se pudo reconstruir y no es vigente. Regresión 001: 222/222. Arranque base de producción: 19/19. HTTPS por proxy y Chromium real: 11/11 en el recorrido anónimo y de sesión, y 8/8 en el recorrido del titular (alta ficticia con perfil de prestador, inicio de sesión desde `/prestador/perfil`, perfil con especialidad, publicación de un servicio y hallazgo y detalle por un visitante anónimo).
- **Naturaleza de los resultados 11/11 y 8/8.** Son pruebas **exploratorias**, no una suite del repositorio. Se ejecutaron con scripts temporales (`playwright-core` directo, fuera del repositorio) contra `https://localhost:8444` a través del proxy Caddy (que enruta `/api/v1/*` a `3002` y el resto a Vite en `5175`), con el certificado local fijado por su clave pública (SPKI). No usaron `playwright.002.config.ts`, `playwright test` ni `E2E_EXTERNAL_WEB`, y no se pueden repetir desde el repositorio. La automatización E2E reproducible de la 002 (`test/e2e/prestadores-catalogo`, hoy inexistente) corresponde a **T075**; hasta entonces estos resultados no sustituyen una suite.
- **Datos.** El recorrido del titular creó en `ayacucho_002_validacion` solo datos ficticios (`@example.invalid`); sin operaciones destructivas.
- **Limitaciones.** La composición completa es opt-in: no se activó por omisión para no cambiar el comportamiento de producción de la 001. La automatización E2E formal corresponde a T075.

### Auditoría de T072 y correcciones

- **Conectividad medida.** Vite escucha en `127.0.0.1:5175`, el backend de `oferta-002` en `127.0.0.1:3002` y el proxy Caddy en `127.0.0.1:8444`. El contenedor del proxy alcanza la API y Vite por `host.docker.internal:3002` y `:5175` (Vite acepta el encabezado `Host` original que reenvía Caddy, no el de `host.docker.internal`). Los puertos de la 001 (`3000`, `5173`) no responden en ese camino.
- **Arranque de Vite (H2).** `npm run dev:validation:002` (frontend) fija `127.0.0.1:5175` con `--strictPort` y `--mode validation`. Verificado ejecutando realmente el script con el Node 24.15.0 local: escucha en `127.0.0.1:5175` y responde 200 (también `/buscar`).
- **Entrada real (H4).** Con el punto de entrada compilado (`dist/src/composicion/main.js`) y `COMPOSICION=oferta-002` sobre la configuración aislada de validación 002: salud 200, 17/17 operaciones de la 001 y 23/23 de la 002 registradas. `COMPOSICION=completa` falla sin abrir el puerto. Contra ese backend: `test:https:002` y los recorridos de navegador 11/11 y 8/8.
- **Comprobación del proxy (H3).** `scripts/proxy-002.ts` obtiene el Caddyfile esperado de la plantilla `infra/Caddyfile` (no se modifica) con el origen y los puertos de `puertos002`, y `verificar-https-002.ts` lo compara, solo en lectura, con `.local/002/Caddyfile` y con el archivo realmente montado en el contenedor del proxy (`docker exec … cat`). Ahora `test:https:002` da **24/24** (los 22 anteriores más estas dos). Pruebas: `proxy-002.spec.ts` (5 pruebas con puertos y origen alterados en cada fuente) y una alteración real y temporal de `.local/002/Caddyfile` (`3002` → `3003`): la comprobación falló en el generado y en el montado, y se restauró el archivo con hash idéntico al original. La alteración no recarga Caddy (`admin off`).
- **Incidencia: timeout en frontend.** En una ejecución completa, la primera prueba de `navegacion-compuesta.test.tsx` superó el límite de 5 s (99/100): importa en frío todo el módulo de la aplicación mientras 12 entornos jsdom corrían con la CPU ocupada. Aislada tarda ~0,8 s (3 ejecuciones verdes) y la suite completa dio 100/100 al repetirse. **No se aumentó el timeout.** Queda como riesgo de flakiness bajo carga; si reaparece, valorar subir el límite solo de ese archivo.
- **Reproducibilidad.** Los recorridos de navegador son exploratorios (ver arriba); el verificador HTTPS y las pruebas Jest y Vitest sí son reproducibles desde el repositorio.

### T073 · Límites de integración con 003, 004, 007, 008, 011 y 012

Estado: **verificada** (73 de 94 acumuladas). T074 está hoy EN CURSO, sin ejecución verificada en GitHub Actions.

`test/integration/prestadores-catalogo/integraciones-futuras.spec.ts` (20 pruebas, sobre bases descartables `ayacucho_002_test_*`, arnés `montarHu25` y el evaluador real `ElegibilidadServicio`; sin código de producción nuevo ni modificado):

- **003, elegibilidad bajo bloqueo.** Dos evaluaciones transaccionales no se esperan (`FOR SHARE` compartido, sin esperas en `pg_stat_activity`). Una pausa de servicio y la desactivación de una categoría (RF39) esperan al commit de una evaluación abierta: se comprueba con `pg_stat_activity` (`wait_event_type = Lock`) y `pg_blocking_pids` que el backend de la escritura está bloqueado por el de la evaluación, con una consulta `FOR UPDATE` sobre `catalogo_revision_oferta`. Un servicio consultado antes como elegible y luego pausado, retirado o con la clasificación desactivada se rechaza al guardar, sin guardar nada; reactivarlo lo admite.
- **Distinción con la 003.** `guardarSolicitud` es un **doble** (evalúa con transacción e inserta en una tabla de prueba). Demuestra que Catálogo ofrece el contrato que la 003 necesita, pero **no sustituye la prueba de integración de la 003**, que deberá validar la escritura real de solicitudes cuando exista.
- **004, referencias.** Las tres referencias (solicitud, cotización, contratación) y el registro sobreviven a pausar, reactivar, retirar y desactivar la categoría. El servicio retirado sigue consultable por `registro()` y fuera de la oferta pública. **Protección contra el borrado, mecanismo comprobado:** es un **disparador `BEFORE DELETE` de PostgreSQL** (`catalogo_servicio_conservado`, función `catalogo_servicio_sin_borrado`, migración `catalogo/infraestructura/migraciones/servicios.ts`), por fila e incondicional, que lanza «Los servicios no se eliminan: se conservan sus referencias históricas» con el código `23514`. No es una regla de dominio de la aplicación ni una clave foránea: actúa antes que cualquier restricción de referencias, de modo que la clave foránea de los dobles de prueba no llega a ejercerse en esa prueba. La prueba comprueba que el disparador existe y está habilitado (`pg_trigger`) y que el `DELETE` falla con ese mensaje y código. Alcance: cubre `DELETE` fila a fila; `TRUNCATE` y la desactivación del disparador por el propietario de la tabla quedan fuera de esta garantía, y un servicio retirado es además de solo lectura por otro disparador (`catalogo_servicio_retirado`, `BEFORE UPDATE`).
- **011 y 012.** Las cuatro combinaciones de fuentes muestran cada aviso solo según su fuente. No aparecen claves de calificación, puntuación, estrellas, verificación ni insignias, y el resto de las respuestas es idéntico entre combinaciones. La 002 no ofrece filtro por calificación aunque la fuente esté disponible.
- **007 y 008.** Los parámetros de consulta asistida, contacto o visitas se rechazan con 400 y no alteran resultados. Las proyecciones públicas cumplen el contrato cerrado (`additionalProperties: false`) y no traen campos de contacto ni de agenda.
- **Ausencia de lo futuro (composición completa de 40 operaciones).** El inventario real de rutas es exactamente la unión de los dos contratos (40) y ninguna ruta es de una funcionalidad futura. El esquema solo contiene tablas de la 001 y de Prestadores, Catálogo y Administración, sin tablas, columnas ni migraciones de solicitudes, cotizaciones, contrataciones, calificaciones, verificaciones, visitas ni contacto. La base recién migrada solo trae los distritos y la revisión. Las únicas tablas de solicitudes y referencias son los dobles del arnés.
- **Control negativo.** Con el `FOR SHARE` eliminado temporalmente de `revision-de-oferta.ts` fallan exactamente las dos pruebas de bloqueo (la pausa y la desactivación no esperan) y ya no hay efecto en cascada sobre las siguientes; con el original, las 6 pruebas de la 003 pasan. Se repitió tras endurecer la limpieza. El archivo se respalda y se restaura con un SHA-256 idéntico (`a87e92bc…` antes y después), y Git no ve cambios en el módulo Catálogo.
- **Resultados (tras endurecer la limpieza).** El archivo: 20/20 en tres ejecuciones seriadas. Suite de integración 002 con 2 trabajadores: 140/140 (14 suites; en la primera versión también 120/120 sin el archivo). Typecheck y lint del backend: OK. Unitarias y arquitectura: 252/252 (sin cambios de código desde esa medición). Sin bases `ayacucho_002_test_*` residuales.
- **Incidencia.** En una primera corrida completa, `portafolio.spec.ts` falló en 2 pruebas (recuperación ante caídas de Garage). Pasó 2/2 aislada y las dos corridas completas siguientes pasaron, también con el archivo nuevo. Es una intermitencia entre suites paralelas que comparten Garage y CPU, no causada por T073. Dos bases `ayacucho_002_test_*` residuales de esas corridas se eliminaron (0 al final).
- **Limpieza ante fallos.** Las pruebas que retienen una transacción o desactivan una categoría usan `conLimpieza`: la limpieza corre siempre (cierra la transacción retenida y devuelve su conexión, deja asentar la petición en vuelo y reactiva la categoría de forma idempotente según su estado real), y si la prueba falla se relanza el error original; un fallo de la limpieza solo se informa por stderr. Verificado con un fallo inyectado en una copia temporal (ya eliminada): con la limpieza real solo falla la prueba inyectada y se conserva su error, y con la restauración neutralizada se detecta la contaminación de la prueba siguiente.
- **Limitaciones.** No se repitió la regresión de la 001 (222/222): no se tocó código de producción ni de 001.

## T074 · CI propia de 002 (en curso)

Estado: **EN CURSO. No está completada.** El workflow `.github/workflows/prestadores-catalogo.yml` está escrito, pero **no se ha ejecutado en GitHub Actions**; la tarea solo se cerrará con una ejecución satisfactoria allí. `.github/workflows/usuarios-acceso.yml` no se modificó.

### Configuración

Ubuntu 24.04, Node.js 24.15.0 y las acciones `actions/checkout`, `actions/setup-node` y `actions/upload-artifact` en la versión 7 (los tags existen y las notas de la 7.0.0 no indican cambios incompatibles con las opciones usadas). Tres trabajos, cada uno en su propio ejecutor efímero:

- `calidad`: lint, typecheck y build de backend y frontend, y pruebas unitarias del frontend.
- `validar-002`:
  - Proyecto Compose `ayacucho-002-validacion`; antes de las pruebas se registran el contenido de las clasificaciones y una huella de todas las tablas, y después se comparan (también si fallan las pruebas).
  - Pruebas unitarias (comando completo), de arquitectura, de contratos de 002 e integración 002 con PostgreSQL real.
  - `test:integration:002:infra` en serie, con los proyectos descartables `ayacucho-ensayo-restauracion`, `ayacucho-redis002-aislado` y `ayacucho-rf39-aislada`, creados en cada ejecución con credenciales aleatorias enmascaradas. Los Compose de Redis y RF39 se generan en `RUNNER_TEMP` porque sus originales locales están ignorados por Git.
  - Verificación final de que no quedan bases temporales en los servidores de validación 002 y del ensayo (el paso falla también si PostgreSQL no responde).
- `regresion-001`: infraestructura de 001 propia y efímera (no se comparte con el flujo de 001); unitarias, contratos (incluido X-08) e integración de 001 con el patrón `usuarios-acceso|fundacion`.
- Evidencias solo en `tecnologia/.local/evidencia/002/ci`, con `EVIDENCIA_JEST` por grupo, publicadas como artefactos con `if: always()`.

### Verificación local (Node.js 24.22.1; no equivale a la ejecución en Actions)

YAML válido y `bash -n` correcto en los 19 bloques `run`; lint, typecheck y build del backend; lint y typecheck del frontend; frontend unitarias 100/100 (12 archivos); backend unitarias 248/248; arquitectura 4/4; contratos de 002 65/65; integración 002 140/140 (14 suites); `test:integration:002:infra` 35/35 con las cuatro suites activas; huella de las 27 tablas de la base de validación 002 idéntica antes y después de la integración.

Sobre la regresión 001 se comprobó, en un clon limpio con Node.js 24 y sin levantar contenedores, que `dev:prepare -- --validation` genera `tecnologia/.env`, `.local/backend.env` y el material TLS (idempotente en la segunda ejecución), que `docker compose config` resuelve los servicios (también con `--profile web`, usado en la limpieza del ejecutor efímero de CI, no en entornos locales) y que los comandos coinciden con `tecnologia/scripts/validar-001-ci.sh`. **No** se ejecutó `compose up`, `db:migrate`, `storage:init`, la semilla ni las pruebas de 001 en un ejecutor limpio.

### Hallazgos, causas y soluciones

**Semilla de la base de validación 002.**
- El workflow exige que `catalogo_clasificaciones` contenga exactamente 6 filas (identificadores 9001 a 9006 de `semilla-002.ts`); el 6 es el tamaño de `clasificacionesSemilla002`. El conteo usa `SELECT count(*) FROM public.catalogo_clasificaciones`.
- Tras las pruebas se compara con `diff` el contenido completo de las clasificaciones (`id, nombre, nombre_normalizado, nivel, categoria_padre_id, activa`) y la huella de todas las tablas (`tecnologia/scripts/huella-bd-002.sql`). Ese paso usa `if: always()` condicionado a que la evidencia inicial esté completa y no sustituye el resultado de los pasos fallidos.
- Probado localmente sobre una copia temporal de la base: con 12 filas falla, con exactamente 6 pasa y con 5 falla; una alteración de una clasificación hace fallar la comparación posterior.

**Doce clasificaciones en la base local.**
- Seis son la semilla. Las otras seis («Prueba HTTPS …», inactivas) las crea `scripts/verificar-https-002.ts` (`test:https:002`): una categoría inactiva y una cuenta ficticia por ejecución, con su auditoría e idempotencia, y **sin ninguna limpieza** (la única coincidencia de «DELETE» es el cierre de sesión). Este guion modifica los datos persistentes de la base de validación 002, aunque no toque los contenedores.
- La base local tiene 6 cuentas «Cuenta ficticia HTTPS» y 6 categorías «Prueba HTTPS», creadas el 19 de noviembre (23:06, 23:08 y 23:33 UTC) y el 20 de noviembre (02:03, 04:40 y 04:57 UTC). Las cifras anotadas antes (9 categorías tras 3 ejecuciones y 10 tras 4) eran correctas en su momento; las dos últimas ejecuciones no se habían anotado. En un ejecutor limpio la semilla tiene 6 filas.
- Forma segura de repetir la verificación HTTPS (propuesta, no implementada): no ejecutarla sobre la base persistente. La opción preferible es un entorno temporal independiente (por ejemplo, un proyecto Compose 002 efímero con otro nombre, otros puertos y otros volúmenes, como el que crea el trabajo de CI en su ejecutor). Otra alternativa es cambiar el guion para que use una base temporal o limpie lo que crea; esto modifica una funcionalidad verificada y queda pendiente de decisión.
- **Advertencia sobre `docker compose down -v`.** Recrear el proyecto de validación 002 local con `down -v` (y luego `up`, `db:migrate:002`, `storage:init:002` y `test:seed:002`) **no es una limpieza rutinaria ni inocua**: `docker compose down -v` elimina los volúmenes persistentes del proyecto (base de datos, objetos y metadatos de Garage) y puede causar una pérdida irreversible de datos locales. Antes de ejecutarlo hay que verificar el nombre del proyecto Compose (`-p`) y los contenedores y volúmenes que se eliminarán, y contar con un respaldo. Solo debe usarse con autorización expresa y con certeza de que el entorno es descartable. Para repetir verificaciones se debe preferir siempre un entorno temporal independiente. En el ejecutor efímero de CI sí es adecuado, porque ese entorno se crea y se destruye en cada ejecución.

**Aislamiento de las suites y bases temporales.**
- Las suites crean bases `ayacucho_002_test_*` y las eliminan (`baseAislada002`); la huella de las 27 tablas no cambió tras dos corridas de `test:integration:002`. Las suites de infraestructura usan los proyectos descartables propios (esto no se midió con huella).
- El servidor del ensayo acumuló 23 bases residuales (21 `ayacucho_002_restauracion_*` y 2 `ayacucho_002_ensayo_origen_*`) de corridas del 20 de noviembre que fallaron con PostgreSQL reiniciando; se eliminaron con filtro estricto de nombre.
- **Corrección:** en `beforeAll`, `restauracion-portafolio.spec.ts` elimina, solo en el PostgreSQL exclusivo del ensayo (puerto 54341, proyecto comprobado), las bases con la forma exacta `^ayacucho_002_(restauracion|ensayo_origen)_[0-9a-f]{32}$`, además de vaciar los prefijos de objetos que ya limpiaba. Verificado con bases de prueba: se eliminaron las dos huérfanas, se conservaron `ayacucho_002_test_fotos_<hex>` y `ayacucho_002_restauracion_corta` (no coinciden con la forma exacta) y una base con nombre coincidente creada en el PostgreSQL de validación 002 no se tocó.
- **Interrupción real:** se lanzó la suite y se terminó su proceso al aparecer sus bases (quedaron 3 huérfanas); la ejecución siguiente las eliminó, pasó 20/20 y dejó 0 residuos.

**Fallo intermitente de `busqueda-publica.spec.ts` (causa demostrada).**
- Síntoma: «Test suite failed to run: Exceeded timeout of 30000 ms for a hook» en su `afterAll`, con las pruebas aprobadas y una base temporal sin eliminar.
- Medición (instrumentación temporal, ya retirada, de cada `CREATE/DROP DATABASE` de todas las suites, cruzada con el registro de PostgreSQL): en la corrida fallida el primer `DROP DATABASE` del hook tardó 23,5 s (100 % de su duración coincide con un checkpoint forzado de 22,9 s, 22,2 s de ellos de `fsync`) y el segundo 8,2 s (92 % coincide con otro de 7,1 s). Ninguno supera 30 s por separado, pero el hook, que cierra dos entornos, sumó 31,7 s. Cada `CREATE/DROP DATABASE` solicita un checkpoint «immediate force wait».
- `app.close()` no es la demora: el cierre total menos el `DROP` quedó en decenas de milisegundos. Esa cifra es derivada, porque la medición directa de `app.close()` no llegó a registrarse.
- Frecuencia: con 2 trabajadores la corrida fallida sumó 72,5 s de checkpoints (otra, 125,9 s, con uno de 47,4 s) frente a 11–15 s en las que pasaron; con 1 trabajador no hubo fallos en 5 corridas (suma de checkpoints de 4 a 31 s).
- Conclusión: latencia de `fsync` del disco del host (Docker Desktop en Windows), amplificada por la concurrencia de dos trabajadores.
- **Solución limitada:** solo el `afterAll` de `busqueda-publica.spec.ts` recibe un margen de 120 s. No se cambió el máximo global de 30 s ni la configuración de PostgreSQL, ni se desactivó `fsync`.

**Fallo aislado de `procedimiento-rf39-aislado.spec.ts`.** Ocurrió una vez en `test:integration:002:infra` (8 pruebas fallidas, 178 s); no se capturó el mensaje de error. El registro del PostgreSQL de RF39 muestra en esa ventana un checkpoint de 108 s, compatible con un bloqueo de E/S del host. Repetida, la suite pasó 9/9 sola y las cuatro suites pasaron 35/35. La relación entre ese bloqueo y las pruebas fallidas es una inferencia.

### Evidencias de 001

- **Pérdida registrada.** Sin `EVIDENCIA_JEST` (y sin la opción de salida de Vitest), las configuraciones escriben por defecto en `tecnologia/.local/evidencia/001`. Corridas locales del 20 de noviembre hechas sin esas opciones sobrescribieron tres informes locales, ignorados por Git: `frontend-junit.xml`, `backend-contract-junit.xml` y `backend-integration-junit.xml`. Los originales no están en Git ni en otra copia local y se perdieron. Desde entonces todas las corridas usan `EVIDENCIA_JEST` o `--outputFile.junit` hacia carpetas distintas de 001, y se comprobó que esos tres archivos no volvieron a cambiar.
- **Artefactos de Actions.** Los 13 artefactos `usuarios-acceso-001-<sha>` (vigentes hasta febrero de 2027) contienen, según `validar-001-ci.sh`, los informes de CI (`u.xml`, `i.xml`, `c.xml`, `v.xml`) de otro entorno; no se han descargado y su descarga exige autenticación, por lo que no sustituyen los informes locales perdidos.
- **Regeneración (no ejecutada).** Con el procedimiento original de 001: reejecutar `test:unit`, `test:contract` y `test:integration` del backend con la infraestructura de 001, y `npm --prefix tecnologia/frontend run test:unit`, sin `EVIDENCIA_JEST`; o descargar el artefacto de la última ejecución de `usuarios-acceso.yml`. Requiere confirmar antes el procedimiento y autorización.
- **Mejora posible (pendiente de decisión).** Que el valor por defecto de `jest.config.mjs` y de `vitest.config.ts` no apunte a 001.

### Regresión 001: selección de pruebas

El patrón `usuarios-acceso|fundacion` (comprobado con `jest --listTests`) selecciona 8 suites unitarias (el comando `test:unit` completo tiene 20), 10 de contrato y 11 de integración. X-08 está incluido en `contract/usuarios-acceso/openapi.spec.ts` (inventario de 17 rutas, 17 casos por operación, enum de rechazos y exceso de foto) y en `contract/usuarios-acceso/sesiones.spec.ts` (CA-SES-06 X-08). `test/unit/cobertura.spec.ts` y `test/unit/diagnostico.spec.ts` se ejecutan con el comando `test:unit` completo, pero no con el patrón del trabajo `regresion-001`: corren en `validar-002`. La regresión 001 **no está validada**: el trabajo no se ha ejecutado en Actions.

### Pendientes

- Ejecución real del workflow en GitHub Actions y, en particular, del trabajo `regresion-001` (no se ha ejecutado, ni local ni en Actions).
- Confirmar que el margen de 120 s elimina el fallo de `busqueda-publica.spec.ts`: no está demostrado estadísticamente, y se observó una operación aislada de 23,2 s en otra suite (`fundamentos-postgres`), por lo que otras suites podrían acercarse al máximo. Una mitigación general (menos `DROP DATABASE` por suite o PostgreSQL efímero de CI sin `fsync`) queda pendiente de decisión.
- Causa del fallo de `procedimiento-rf39-aislado.spec.ts` (inferida, sin mensaje de error).
- Regeneración de los tres informes locales de 001 y decisión sobre los valores por defecto de `jest.config.mjs` y `vitest.config.ts`.
- Decisión sobre `verificar-https-002.ts` (acumula datos en la base de validación; no se modificó sin autorización).
