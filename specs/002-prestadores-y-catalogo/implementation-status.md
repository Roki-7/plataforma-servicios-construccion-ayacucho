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


## Avance de la fase 7 (integración del monolito y regresión, completa)

Estado: **fase 7 completa**. Verificadas T066 a T074 (74 de 94 acumuladas). T074 se verificó con la ejecución n.º 3 de GitHub Actions, aprobada en los tres trabajos (ver «T074 · CI propia de 002»).

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
| T074 | Verificada | CI propia de 002: ejecución n.º 3 de GitHub Actions (commit `9b57fbf`) aprobada en `calidad`, `validar-002` y `regresion-001`. Ver «T074 · CI propia de 002 (verificada)». |

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
- Al cierre de ese avance, T072 y T073 estaban pendientes (se verificaron después) y T074 se verificó después con la ejecución n.º 3 de GitHub Actions.
- Las pruebas de RF39 y Redis son opt-in (`RF39_AISLADA_URL`, `REDIS_AISLADO_URL`) y usan contenedores propios (`ayacucho-rf39-aislada`, `ayacucho-redis002-aislado`).
- Los scripts de la 002 deben invocarse con la ruta absoluta con unidad `C:` en mayúscula (por ejemplo `node --import tsx C:/…/scripts/iniciar-validacion-002.ts migrar`). Con la unidad en minúscula, la comprobación estricta del manifiesto del catálogo falla (la validación no se relajó).

### T070 · Respaldo y restauración coordinados del portafolio

Estado: **verificada** (70 de 94 acumuladas en ese momento; la corrección posterior de la puerta está en «Estado vigente»). En ese momento T072 y T073 estaban pendientes (se verificaron después) y T074 estaba por empezar; se verificó después con la ejecución n.º 3 de GitHub Actions.

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

Estado: **verificada** (71 de 94 acumuladas). T072, T073 y T074 se verificaron después (T074 con la ejecución n.º 3 de GitHub Actions). Pruebas de puerta y arranque añadidas después: ver «Estado vigente».

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
- **Suites opt-in.** Las del ensayo de restauración, las de Redis y RF39 aislados y las de fotos de cuenta exigen sus variables de entorno y se omiten sin ellas. Se ejecutan con `test:integration:002:infra` y las invoca el workflow de T074 (aprobado en la ejecución n.º 3 de GitHub Actions).
- **Carga del equipo.** Con la CPU ocupada por otros programas, algunas suites superan los 30 s. Cada una pasó al repetirse sola.
- Los permisos 0600 de las copias no se aplican en Windows: la protección real es el cifrado y que el directorio esté fuera del repositorio. El volcado se mantiene en memoria.
- La verificación de salud solo comprueba las tablas de la 001: una base sin migraciones de la 002 no se detecta ahí.
- `docker()` confía en que sus llamadores pasen constantes (endurecimiento posible, sin defecto demostrado).

### T072 · Interfaz compuesta: navegación, origen y sesión

Estado: **verificada** (72 de 94 acumuladas). T073 y T074 se verificaron después (T074 con la ejecución n.º 3 de GitHub Actions).

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

Estado: **verificada** (73 de 94 acumuladas). T074 se verificó después con la ejecución n.º 3 de GitHub Actions (74 de 94 acumuladas).

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

## T074 · CI propia de 002 (verificada)

Estado: **verificada** (74 de 94 acumuladas). El workflow `.github/workflows/prestadores-catalogo.yml` terminó con éxito en GitHub Actions (ejecución n.º 3, commit `9b57fbf`). `.github/workflows/usuarios-acceso.yml` no se modificó.

### Evidencia de GitHub Actions

Datos obtenidos de la API pública de GitHub (conclusiones de trabajos y pasos y lista de artefactos):

- Ejecución n.º 3 (id 45228447717), rama `002-prestadores-y-catalogo`, commit `9b57fbf`: **completada con éxito**, de las 17:30:41 a las 17:33:57 UTC (3 min 16 s).
- `calidad`: aprobado (9 de 9 pasos, 53 s). `validar-002`: aprobado (21 de 21 pasos, unos 2 min 18 s), incluidos unitarias, arquitectura, contratos de 002, integración 002 con PostgreSQL real, integración que altera infraestructura, verificación de la base principal y de la semilla, y verificación de que no quedan bases temporales. `regresion-001`: aprobado (11 de 11 pasos, unos 1 min 30 s).
- Tres artefactos vigentes con nombre `prestadores-catalogo-002-<calidad|validacion|regresion-001>-<sha>-<intento>` (4 805 B, 26 230 B y 11 560 B).
- Las ejecuciones n.º 1 (`408f11a`) y n.º 2 (`06adca1`) fallaron por los dos errores descritos más abajo.

Cobertura de los criterios de cierre de T074: lint, typecheck y build (`calidad`); unitarias, contratos y arquitectura, e integración con PostgreSQL real (`validar-002`); regresión 001 con infraestructura propia (`regresion-001`); suites que alteran infraestructura en serie y con proyectos descartables propios, con verificación de la base y de la semilla antes y después (`validar-002`); evidencias de 002 separadas, en artefactos propios; `usuarios-acceso.yml` intacto; informes JUnit en carpetas 002 por grupo.

Alcance de la evidencia: se comprobaron las conclusiones de pasos y artefactos, pero no se descargaron los registros ni los XML (la descarga exige autenticación). Por tanto, el número de pruebas por grupo en CI no se ha contrastado con las cifras locales (248, 65, 140 y 35) ni se ha confirmado que las cuatro suites de infraestructura se ejecutaron sin omitirse; una suite omitida también terminaría en éxito.

### Errores corregidos tras las primeras ejecuciones

1. **Contexto `runner` no permitido (ejecución n.º 1, `408f11a`).** GitHub rechazó el workflow: «Line 72, Col 17: Unrecognized named-value: 'runner'». La expresión `${{ runner.temp }}` estaba en el `env:` del trabajo `validar-002`, donde solo se admiten los contextos `github`, `needs`, `strategy`, `matrix`, `vars`, `secrets` e `inputs`; ningún trabajo llegó a iniciarse. Corrección (`06adca1`): el directorio se calcula en cada paso con la variable de entorno `$RUNNER_TEMP`, y las variables `COMPOSE_*` pasaron a arrays de bash en los pasos. Validado con `actionlint` 1.7.12 y `shellcheck` 0.11.0.
2. **Configuración local de 001 ausente (ejecución n.º 2, `06adca1`).** `validar-002` falló en las unitarias (246 de 248): dos pruebas de `test/unit/fundacion.spec.ts` («Catálogo verifica integridad, consulta completa y rechaza fixture en producción» y «Configuración impide fixture productivo y claves AEAD/HMAC compartidas») terminaron con «Falta configuración: PUBLIC_ORIGIN.». Causa: usan `cargarLocal()`, que lee `tecnologia/.local/backend.env` y el catálogo fixture de 001, y el trabajo solo preparaba `.local/002/backend.env`. Corrección (`9b57fbf`): un paso previo a las unitarias ejecuta `dev:prepare -- --validation` y `security:catalog:prepare -- --fixture`, que solo generan archivos de configuración en el ejecutor efímero, sin iniciar infraestructura de 001 ni relajar validaciones. Reproducido y verificado en un clon limpio (246/248 antes y 248/248 después).

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

Sobre la regresión 001 se comprobó, en un clon limpio con Node.js 24 y sin levantar contenedores, que `dev:prepare -- --validation` genera `tecnologia/.env`, `.local/backend.env` y el material TLS (idempotente en la segunda ejecución), que `docker compose config` resuelve los servicios (también con `--profile web`, usado en la limpieza del ejecutor efímero de CI, no en entornos locales) y que los comandos coinciden con `tecnologia/scripts/validar-001-ci.sh`. Los pasos `compose up`, `db:migrate`, `storage:init`, la semilla y las pruebas de 001 no se habían ejecutado en local en un ejecutor limpio; se ejecutaron después en GitHub Actions (ejecución n.º 3).

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

El patrón `usuarios-acceso|fundacion` (comprobado con `jest --listTests`) selecciona 8 suites unitarias (el comando `test:unit` completo tiene 20), 10 de contrato y 11 de integración. X-08 está incluido en `contract/usuarios-acceso/openapi.spec.ts` (inventario de 17 rutas, 17 casos por operación, enum de rechazos y exceso de foto) y en `contract/usuarios-acceso/sesiones.spec.ts` (CA-SES-06 X-08). `test/unit/cobertura.spec.ts` y `test/unit/diagnostico.spec.ts` se ejecutan con el comando `test:unit` completo, pero no con el patrón del trabajo `regresion-001`: corren en `validar-002`. El trabajo `regresion-001` fue aprobado en la ejecución n.º 3 de GitHub Actions (11 de 11 pasos); el número de pruebas ejecutadas por grupo no se ha contrastado en los registros.

### Pendientes (no forman parte del cierre de T074)

- Contrastar en los XML y registros de la ejecución n.º 3 el número de pruebas por grupo y que las cuatro suites de infraestructura no se omitieron (requiere descargar los artefactos con autenticación).
- Estabilidad en CI: solo hay una ejecución aprobada. El margen de 120 s del `afterAll` de `busqueda-publica.spec.ts` no está demostrado estadísticamente, y se observó una operación aislada de 23,2 s en otra suite (`fundamentos-postgres`). Una mitigación general (menos `DROP DATABASE` por suite o PostgreSQL efímero de CI sin `fsync`) queda pendiente de decisión.
- Causa del fallo de `procedimiento-rf39-aislado.spec.ts` (inferida, sin mensaje de error).
- Regeneración de los tres informes locales de 001 perdidos y decisión sobre los valores por defecto de `jest.config.mjs` y `vitest.config.ts`.
- Decisión sobre `verificar-https-002.ts` (acumula datos en la base de validación; no se modificó sin autorización).

## T075 · Ejecutor de navegador 002 (verificada)

Estado: **verificada** (75 de 94 acumuladas). Chromium, Firefox y WebKit se ejecutan contra el origen HTTPS `https://localhost:8444` con la CA 002 como única confianza, con reportes 002, registro de dispositivo y entorno sin secretos, verificación previa de independencia y preparación de las series T076 a T079 sobre **recursos descartables propios de cada corrida** (base de datos, bucket y espacio Redis). No se modificó ningún archivo de 001 ni su workflow, y no se escribe nunca en la validación local 002.

### Implementación

- `tecnologia/frontend/playwright.002.config.ts`: nueve proyectos (`chromium|firefox|webkit` × 360, 768 y 1366 px), `ignoreHTTPSErrors: false`, traza `retain-on-failure`, una sola trabajadora y sin reintentos, reportes JUnit, JSON y `ejecucion-002.json` en `tecnologia/.local/evidencia/002`, y `globalSetup` que exige la preparación de la corrida.
- `tecnologia/frontend/test/e2e/prestadores-catalogo/soporte.ts`: `test` de la 002 con un fixture automático que adjunta a cada prueba `dispositivo.json` (navegador, versión, dispositivo, ancho y alto, plataforma del ejecutor, Node, origen y entorno con los recursos descartables). Las series T076 a T079 deben importar este `test`. `global-setup.ts` rechaza la ejecución si no hay preparación de esta ejecución, si no es válida o si no usa recursos descartables.
- `tecnologia/frontend/test/e2e/prestadores-catalogo/entorno.spec.ts` (4 pruebas por proyecto: HTTPS con la CA 002, API por el mismo origen, control negativo de certificado no confiable y registro del dispositivo sin secretos) y `aislamiento.spec.ts` (1 prueba por proyecto, que **crea datos ficticios persistentes**: una categoría con el operador RF39 y una cuenta nueva, y comprueba que la semilla sigue intacta). En total, 45 pruebas.
- `tecnologia/frontend/test/soporte/reporte-002.ts`: reporter que agrega por proyecto navegador, versión, dispositivo, ancho y resultados, con la redacción de secretos de 001.
- `tecnologia/frontend/scripts/independencia-002.mjs` (y `.d.mts`): lógica pura y sin credenciales (identidad de recursos, independencia, semilla, nombres de recursos descartables y comparación de estados).
- `tecnologia/backend/scripts/e2e-efimero-002.ts` (nuevo): `crear`, `servir` y `retirar` los recursos descartables de una corrida. Solo actúa sobre recursos con nombres exactos derivados del identificador de la corrida y reutiliza `aplicarMigraciones002`, `sembrar002`, `crearAplicacionCompleta002` e `iniciarOferta002`, sin cambiar ningún código verificado.
- `tecnologia/frontend/scripts/ejecutar-e2e-002.mjs` (orquestador del anfitrión), `ejecutar-e2e-linux-002.mjs` y `confianza-e2e-002.sh` (lado del contenedor): ejecutan los navegadores en un contenedor Linux efímero que reutiliza la imagen `ayacucho-001-e2e:fundacion` sin modificarla, en la red `ayacucho-002-validacion_default`, con la CA 002 instalada solo allí. Comando: `npm --prefix tecnologia/frontend run test:e2e:002` (opciones: `--especificaciones=a.spec.ts,b.spec.ts` para una serie, y argumentos de Playwright como `--project=chromium-360`).
- `tecnologia/frontend/package.json` (script `test:e2e:002`) y `tecnologia/frontend/test/unit/prestadores-catalogo/ejecutor-e2e-002.test.ts` (17 pruebas unitarias).

### Estado que se conserva y estado que se restablece (análisis y decisión)

La primera versión del ejecutor compartía la base de validación: solo restablecía las claves del espacio Redis `ayacucho:002:validacion:*` y el buzón de Mailpit, y **todo dato de negocio persistía** en `ayacucho_002_validacion`. Eso no basta para T076 a T079: la base impide deliberadamente borrar parte de ese estado (la auditoría es de solo adición, `catalogo_servicio_conservado` y `catalogo_servicio_retirado` conservan los servicios, el contador de revisión de la oferta solo avanza, y las tablas de Prestadores y Catálogo no tienen claves foráneas hacia `usuarios`), de modo que un dato creado por una serie (por ejemplo, las categorías que cambie T079) no podía deshacerse y alteraba el estado inicial de la corrida siguiente. La propia base de validación lo demuestra: acumula 12 clasificaciones y 6 cuentas «Cuenta ficticia HTTPS» de ejecuciones anteriores del guion HTTPS, sin posibilidad de limpieza. Se sustituyó por aislamiento completo:

1. **Una corrida, un entorno propio.** Cada corrida crea la base `ayacucho_002_test_<id>` (con las migraciones y la semilla exacta de seis clasificaciones y el operador RF39 ficticio), el bucket `e2e-<id>` y el espacio Redis `ayacucho:002:e2e-<id>` (`id` = 32 hexadecimales), arranca su propia API compuesta y su propia web sobre ellos (puertos 3002 y 5175, los que enruta el proxy 8444) y, al terminar, retira únicamente esos recursos. Los nombres siguen las formas ya admitidas por la configuración 002 y la limpieza de CI, y se validan estrictamente (no pueden coincidir con ningún recurso de validación 002, de 001 ni del ensayo de restauración).
2. **Nunca se escribe en la validación local.** Antes y después de la serie se comparan la huella de las 27 tablas de `ayacucho_002_validacion`, las claves de su espacio Redis, el contenido de su bucket y los mensajes previos de Mailpit; cualquier cambio hace fallar la serie. Del correo solo se eliminan los mensajes generados por la propia corrida.
3. **Semilla y mismo estado inicial.** Al comenzar cada corrida se exige la semilla exacta (seis filas, sin adicionales) y se registra el número de filas de cada tabla; entre corridas deben ser idénticos.
4. **Auditoría.** Durante la corrida, la auditoría de su base no se modifica ni se elimina. Antes de retirar la base se exporta íntegra a `auditoria-corrida-<n>.json` en la evidencia 002.
5. **Recuperación ante interrupciones.** El orquestador registra cada entorno (con los PID de sus servicios) en `entornos-efimeros.json`. Si una ejecución muere a mitad, la siguiente retira, antes de empezar y solo por lo registrado, los recursos y procesos huérfanos.
6. **Bloqueo exclusivo (una sola ejecución a la vez).** Lo primero que hace el orquestador, antes de comprobar Docker, recuperar huérfanos o tocar cualquier recurso, es crear de forma atómica (`wx`) `bloqueo-e2e-002.lock` en la evidencia 002, con su PID, anfitrión, hora y un token propio, y lo mantiene hasta el final, también durante la limpieza. Si ya existe, la segunda ejecución se rechaza de inmediato con un mensaje claro y **no modifica nada**: no escribe, no detiene procesos y no retira recursos de la primera. El bloqueo solo se recupera si su propietario está **comprobadamente muerto** (el PID no existe, o existe pero su línea de comandos ya no es la de este ejecutor porque otro programa reutilizó el PID); un archivo ilegible o incompleto, de otro anfitrión o con un proceso que no puede comprobarse se trata como incierto y no se toca. La recuperación se serializa con un segundo archivo exclusivo (`.recuperando`) y se revalida antes de retirar el bloqueo. Al terminar (también si falla o se interrumpe con una señal) solo se libera el bloqueo cuyo token es el de la ejecución actual.

### Verificación

Todas las comprobaciones se hicieron en local, con infraestructura 002 propia, Node.js 24.22.1 en el anfitrión y 24.15.0 en el contenedor.

- **Matriz y navegadores:** `playwright test --list` da 45 pruebas (9 proyectos × 5). Versiones registradas: Chromium 159.0.8154.6, Firefox 159.0 y WebKit 27.2, en 360, 768 y 1366 px. Con el diseño anterior se obtuvieron 36 de 36 en cuatro ejecuciones completas (tras dos fallos iniciales de WebKit corregidos: no informa el emisor del certificado y a veces cancela la navegación del control negativo sin motivo).
- **Dos corridas consecutivas que crean datos** (`aislamiento.spec.ts`, `--project=chromium-360`): ambas pasan. Cada una añadió a su base descartable una categoría, una cuenta, una sesión, un perfil habilitado, una fila de auditoría y dos claves de idempotencia (6 tablas con filas nuevas); el estado inicial de las dos fue idéntico; la auditoría exportada tiene 2 filas (`PERMISO_RF39_CONCEDIDO` y `CATEGORIA_CREADA`); y tras cada una quedaron 0 bases `ayacucho_002_test_*`, 0 buckets `e2e-*` y 0 claves Redis `ayacucho:002:e2e-*`. La serie terminó con `estadoInicialIgualEntreCorridas: true` y `validacionLocalSinCambios: true`.
- **Corrida completa** (todas las especificaciones y los nueve proyectos): 45 de 45 (JUnit `tests="45" failures="0"`). Se crearon 9 categorías, cuentas y sesiones en la base descartable, que se retiró al final; la validación local no cambió.
- **Validación local intacta:** la huella de las 27 tablas de `ayacucho_002_validacion` (incluidos 7 registros de auditoría y 12 clasificaciones) es idéntica a la tomada antes de empezar, tras todas las corridas de la verificación.
- **Interrupción real:** se terminó a la fuerza el proceso del orquestador a mitad de una corrida; quedaron 1 base y 1 bucket descartables huérfanos. La ejecución siguiente los retiró («Retirados 1 entorno(s) descartable(s) huérfano(s)»), pasó y no dejó ni bases ni buckets.
- **Bloqueo exclusivo (pruebas reales):** (a) con una primera ejecución en uso, una segunda lanzada a la vez se rechazó en 2,9 s indicando el PID y la hora del propietario vivo; el bloqueo, el registro y la preparación quedaron idénticos byte a byte, la API y la web de la primera siguieron respondiendo y la primera terminó con éxito; (b) tras terminar a la fuerza el orquestador a mitad de una corrida quedaron el bloqueo, 1 base y 1 bucket huérfanos, y la siguiente ejecución recuperó el bloqueo, retiró los huérfanos, pasó y no dejó nada; (c) con un bloqueo ilegible, de otro anfitrión o con campos inválidos la ejecución se rechazó y el archivo permaneció idéntico; (d) con un bloqueo cuyo PID había sido reutilizado por otro programa (un proceso `node` ajeno) se recuperó el bloqueo sin tocar ese proceso, que siguió vivo; (e) una ejecución normal completa (45 de 45, 9 proyectos) terminó sin bloqueo, sin credencial del operador, sin bases, buckets ni claves Redis descartables y sin procesos en los puertos 3002 y 5175. En todas, la huella de las 27 tablas de `ayacucho_002_validacion` siguió idéntica a la tomada antes de empezar, y no se tocó nada de 001.
- **Casos negativos reales:** sin preparación, `playwright test` aborta en `globalSetup`; si la API o la web de validación ocupan los puertos 3002 o 5175, el orquestador se detiene antes de crear nada (el proxy 8444 enruta a esos puertos).
- **Pruebas unitarias nuevas:** 17/17 (incluidas las de la decisión sobre el propietario del bloqueo); frontend completo 13 archivos y 117/117, typecheck, lint y build sin errores; backend `lint` y `typecheck` sin errores con el script nuevo. La evidencia de 001 no se tocó.
- **Secretos:** ninguno de los valores sensibles de los `.env` locales aparece en la evidencia (`ejecucion-002.json`, `preparacion-002.json`, `serie-002.json`, `tls-002.json`, JUnit y JSON). La credencial del operador ficticio de la base descartable se escribe solo durante la corrida y se elimina al retirarla.

### Limitaciones y pendientes

- El aislamiento es por base, bucket y espacio Redis dentro de los servidores PostgreSQL, Garage y Redis del proyecto 002 (que comparten con la validación), no por instancias separadas de cada servicio. Mailpit también es compartido; solo se eliminan los mensajes de la propia corrida.
- Solo se admite una ejecución del ejecutor a la vez. Si un bloqueo no puede comprobarse como abandonado, la ejecución se rechaza y debe eliminarse a mano `tecnologia/.local/evidencia/002/e2e-linux/bloqueo-e2e-002.lock` solo después de confirmar que no hay ninguna ejecución activa. El bloqueo no coordina con un ejecutor lanzado en otro equipo.
- Para ejecutar, la API y la web de validación 002 deben estar detenidas (puertos 3002 y 5175): el ejecutor levanta las suyas sobre los recursos descartables.
- El ejecutor es para Linux (contenedor). No existe un ejecutor Windows nativo para la 002: exigiría instalar la CA 002 en el almacén de Windows, que requiere confirmación visible del usuario.
- El trabajo de CI de T074 no ejecuta navegadores; T075 se verificó en local. Ejecutarlo en Actions queda para una decisión posterior.
- Las trazas se conservan solo al fallar y pueden contener datos ficticios; permanecen en `tecnologia/.local` (ignorado por Git) y no se publican.
- WebKit no informa el emisor del certificado y puede cancelar la navegación del control negativo sin motivo; se acepta solo en WebKit y siempre se comprueba que no se carga el contenido.
- En esta máquina, Vitest falla de forma engañosa («Cannot read properties of undefined (reading 'config')» o «Vitest failed to find the runner») si el directorio de trabajo usa la unidad en minúscula (`c:\`); con `C:\` en mayúscula todas las pruebas pasan. Es la misma advertencia ya registrada para los scripts de 002.
- Siguen abiertos los pendientes técnicos anteriores que no forman parte de T075: contrastar en los registros de Actions los conteos de la ejecución n.º 3, la estabilidad del margen de 120 s de `busqueda-publica.spec.ts`, la causa inferida del fallo de RF39, la regeneración de los tres informes locales de 001 y los valores por defecto de Jest y Vitest, y `verificar-https-002.ts`.
- T076 a T079 no se han iniciado.

## T076 · Recorridos de HU03: titular y cuenta ajena (verificada)

Estado: **verificada** (76 de 94 acumuladas). Los ocho criterios CA-PRE-01 a CA-PRE-08 se ejecutan en Chromium, Firefox y WebKit a 360, 768 y 1366 px (9 proyectos) sobre HTTPS con la CA 002 y una base, un bucket y un espacio Redis descartables por corrida (T075). Cada prueba declara los criterios que demuestra y el reporte los enlaza por navegador y resolución. No se modificó ningún archivo de 001, su workflow ni el workflow de CI.

### Implementación

- `tecnologia/frontend/test/e2e/prestadores-catalogo/perfil-y-portafolio.spec.ts`: siete pruebas por proyecto (63 en la matriz; 108 con las de T075). El titular usa la **interfaz web real** (inicio de sesión, perfil, trabajos, alta, reemplazo y eliminación de fotos) y la cuenta ajena, la cuenta solo cliente y el visitante se comprueban por la API pública y, para el portafolio y las fotos, también en el navegador. Los límites pesados y los rechazos del servidor se comprueban por la API.
- `tecnologia/frontend/test/e2e/prestadores-catalogo/soporte.ts`: se añaden las utilidades compartidas con T077 a T079: `crearCuenta` (registro e inicio de sesión por la API real con cuentas ficticias únicas), `cabecerasEscritura`, `criterios` (vincula la prueba con sus criterios) y `registrarEvidencia` (hechos verificables sin credenciales).
- `tecnologia/frontend/test/soporte/reporte-002.ts`: el reporte agrega `trazabilidad-criterios-002.json` (cada criterio con sus pruebas, proyectos y estado) y conserva los hechos adjuntos en `hu03/<proyecto>/evidencia-<criterio>.json`.
- `tecnologia/backend/scripts/generar-imagenes-e2e-002.ts`: corpus de 13 imágenes ficticias (con `sharp` y los helpers de prueba existentes): JPG, PNG y WEBP válidos, un PNG de exactamente 10 000 000 bytes, uno de 4096 × 4096 px, un GIF y un TIFF con extensión de imagen, uno de 10 000 001 bytes, imágenes de 4097 px de ancho y de alto, y fotografías con coordenadas GPS y un marcador sensible. Solo escribe dentro de la evidencia 002.
- `tecnologia/backend/scripts/agente-retencion-e2e-002.ts`: reproduce para el navegador la «alta pendiente» de CA-PRE-06. A petición de la prueba (archivos de señal atómicos en la evidencia, sin credenciales), retiene con `FOR UPDATE` la fila del perfil en la base descartable para que la foto tenga su objeto escrito pero sin vincular, informa su identificador y libera el bloqueo. Se detiene a los 30 minutos o al desaparecer su carpeta, y libera todo bloqueo a los 30 s como máximo.
- `tecnologia/frontend/scripts/ejecutar-e2e-002.mjs`: genera el corpus y lanza el agente por corrida, los retira al terminar (junto con las evidencias `hu*` de series anteriores) y registra el agente entre los procesos recuperables tras una interrupción.
- `tecnologia/frontend/playwright.002.config.ts`: espera de 20 s para las aserciones (solo el tiempo de espera).
- `tecnologia/frontend/test/unit/prestadores-catalogo/reporte-002.test.ts`: 3 pruebas unitarias del reporte.

### Cobertura por criterio

| Criterio | Recorrido verificado |
|---|---|
| CA-PRE-01 | El titular crea su perfil en la web (tipo, experiencia, especialidad, dos zonas, disponibilidad declarada «no» y un trabajo), recarga la página y se muestran todos los valores guardados; la API confirma el perfil. |
| CA-PRE-02 | Una zona fuera de los cinco distritos se rechaza con 400 `DATOS_INVALIDOS` indicando `distritos[1]` («Valor no admitido.»); la versión y las zonas guardadas no cambian. La interfaz solo ofrece distritos válidos, por lo que la zona inválida se envía por la API; en la web se comprueba además que no se envía un perfil sin zonas. |
| CA-PRE-03 | Visitante (401), cuenta solo cliente (403) y prestador ajeno (403 o 404) no pueden crear o modificar el perfil ni agregar, reemplazar o eliminar fotos del titular; el perfil, la versión, las fotos y la huella del archivo público quedan idénticos. En la web, el prestador ajeno no ve el portafolio del titular. |
| CA-PRE-04 | En la web se aceptan JPG, PNG, WEBP, 4096 × 4096 px y 10 000 000 bytes. Se rechazan, indicando la causa y conservando las fotos: GIF y TIFF con extensión de imagen («El formato real del archivo no es JPG, PNG ni WEBP.»), 4097 px de ancho y de alto («La imagen supera 4096 píxeles por lado.») y más de 10 MB (el navegador lo bloquea y, además, la API devuelve 413 `ARCHIVO_DEMASIADO_GRANDE`). |
| CA-PRE-05 | Nueve trabajos de cuatro fotos (API) más un décimo con sus cuatro fotos (web): 10 trabajos y 40 fotos. La web deshabilita el undécimo trabajo y la quinta foto, y la API los rechaza con 422 `LIMITE_PORTAFOLIO` sin alterar los datos. |
| CA-PRE-06 | Con la confirmación retenida, un visitante recibe 404 `RECURSO_NO_DISPONIBLE` sin contenido para el objeto pendiente y el portafolio no lo lista. Tras confirmar, el visitante obtiene 200 con un WebP (RIFF/WEBP con un único fragmento `VP8 `, sin EXIF, XMP ni ICC), sin el marcador sensible ni coordenadas, con `Cache-Control: no-store`, y lo ve en el navegador. El identificador público se asigna al confirmar y es distinto del del objeto pendiente, que sigue sin ser accesible. |
| CA-PRE-07 | Con cuatro fotos, un reemplazo con un archivo inválido se rechaza con su causa y conserva las fotos y la imagen anterior (misma huella); uno válido con GPS mantiene cuatro fotos y se publica solo como WebP saneado y distinto. |
| CA-PRE-08 | Se elimina la foto 2 en la web: el acceso público anterior devuelve 404, el trabajo y las otras tres fotos se conservan y se entregan (200), la vista pública muestra tres imágenes y se libera un cupo (se vuelve a cuatro). |

### Verificación

- **Matriz completa:** 63 de 63 pruebas aprobadas en los 9 proyectos (14,1 min). `trazabilidad-criterios-002.json` registra los ocho criterios aprobados en 9 de 9 proyectos y la evidencia suma 63 archivos en `hu03/<proyecto>/` (7 por proyecto). Ninguna operación necesitó el reintento por indisponibilidad transitoria.
- **Historial de la puesta a punto (se conserva por transparencia):** las primeras matrices completas dieron 61 de 63 con dos fallos cada una. Las causas, todas corregidas sin relajar ninguna aserción: (1) pruebas con el límite por defecto de 60 s, que se agotaba cuando el host se detuvo por un checkpoint de PostgreSQL de 40 s (el mismo fenómeno ya documentado en T074); (2) un 503 transitorio de una dependencia durante una subida de 10 MB, ahora con un único reintento acotado que deja constancia en la prueba; (3) una carrera de mi propio agente, que leyó una señal a medio escribir (ahora se escriben de forma atómica); (4) una ventana de retención demasiado larga: la aplicación espera el bloqueo del perfil como máximo 5 s (`lock_timeout`), así que la ventana pendiente solo hace comprobaciones rápidas por la API; (5) esperas de 5 s en la interfaz que no bastaban en Firefox 768 sobre el host cargado (ahora 20 s). No se detectó ningún defecto funcional de HU03.
- **Aislamiento:** al terminar no quedan bases `ayacucho_002_test_*`, buckets `e2e-*`, claves Redis `ayacucho:002:e2e-*`, bloqueo, credencial del operador, corpus de imágenes ni señales, y no hay procesos en los puertos 3002 y 5175. La huella de las 27 tablas de `ayacucho_002_validacion`, su bucket, su espacio Redis y los mensajes previos de Mailpit quedaron idénticos (`validacionLocalSinCambios: true`). No se tocó nada de 001.
- **Calidad:** frontend 14 archivos y 120 de 120 pruebas unitarias, typecheck, lint y build sin errores; backend `lint` y `typecheck` sin errores con los dos scripts nuevos; `playwright test --list` da 108 pruebas (9 proyectos × 12). La evidencia de 001 no se modificó. Comando: `npm --prefix tecnologia/frontend run test:e2e:002 -- --especificaciones=perfil-y-portafolio.spec.ts` (Docker con el proyecto 002 en marcha y los puertos 3002 y 5175 libres).

### Limitaciones y pendientes

- La ventana de «alta pendiente» está acotada a unos 5 s por el `lock_timeout` de la aplicación; por eso la comprobación del visitante en el navegador se hace antes y después de ella, y durante ella solo se usa la API. Que el objeto pendiente tenga un identificador distinto del público se verificó, igual que en las pruebas de backend (T033).
- CA-PRE-02 envía la zona inválida por la API (la interfaz no permite elegirla) y CA-PRE-03 comprueba a la cuenta ajena principalmente por la API; no existe una pantalla pública para el visitante además de la vista de detalle del prestador.
- La traza de Playwright solo se conserva al fallar; el corpus de imágenes (unos 20 MB) se genera por serie y se retira al terminar. Como en T075, no se ejecuta en CI.
- Siguen abiertos los pendientes técnicos anteriores: contrastar en los registros de Actions los conteos de la ejecución n.º 3, la estabilidad del margen de 120 s de `busqueda-publica.spec.ts` y la lentitud ocasional del disco del host, la causa inferida del fallo de RF39, la regeneración de los tres informes locales de 001 y `verificar-https-002.ts`. T077 a T079 no se han iniciado.

## T077 · Recorridos de HU04: servicios del titular, cuenta ajena y visitante (verificada)

Estado: **verificada** (77 de 94 acumuladas). Los nueve criterios CA-SER-01 a CA-SER-09 se ejecutan en Chromium, Firefox y WebKit a 360, 768 y 1366 px (9 proyectos) sobre HTTPS con la CA 002 y una base, un bucket y un espacio Redis descartables por corrida (T075). Cada prueba declara los criterios que demuestra y el reporte los enlaza por navegador y resolución. No se modificó ningún archivo de 001, ni el workflow de CI, ni el código de la aplicación.

### Implementación

- `tecnologia/frontend/test/e2e/prestadores-catalogo/servicios.spec.ts`: cuatro pruebas por proyecto (36 en la matriz; 144 con las de T075 y T076). Reutiliza `soporte.ts` (`crearCuenta`, `cabecerasEscritura`, `criterios`, `registrarEvidencia`) y el ejecutor de T075 sin cambios. El titular usa la **interfaz web real** (inicio de sesión, publicar, editar, pausar, reactivar y retirar con confirmación); el visitante, la cuenta solo cliente, el prestador sin perfil y el prestador ajeno se comprueban por la API y, para la visibilidad, también en el navegador. El operador de la base descartable (`E2E_OPERADOR_002`) crea, activa y desactiva categorías ficticias propias de cada prueba, de modo que ninguna prueba altera la semilla ni las demás.
- `tecnologia/frontend/test/soporte/reporte-002.ts`: los hechos `evidencia-ca-ser-*` se conservan en `hu04/<proyecto>/` (los `evidencia-ca-pre-*` siguen en `hu03/`); prueba unitaria añadida en `reporte-002.test.ts`.

### Cobertura por criterio

| Criterio | Nivel y recorrido verificado |
|---|---|
| CA-SER-01 | E2E web: el titular publica en «Construcción › Albañilería» (versión 1), edita título y descripción (versión 2) y la API confirma identificador, categoría y estado conservados; el detalle público refleja el cambio. |
| CA-SER-02 | E2E (parte observable): pausado y retirado conservan identificador, contenido y categoría para el titular (`/servicios/mios`). Que se conserven las referencias previas no es visible por HTTP: se traza a `backend/test/contract/prestadores-catalogo/servicios-propios.spec.ts` («las cuatro transiciones permitidas conservan las referencias previas») y a `integration/ciclo-servicios.spec.ts` (T036/T042, verificadas). |
| CA-SER-03 | Visitante: 401 `NO_AUTENTICADO` al publicar, editar, pausar y listar; cuenta solo cliente: 403 `SIN_PERMISO`; prestador sin perfil habilitado y prestador ajeno: 404 `RECURSO_NO_DISPONIBLE` (no distingue «no existe» de «no es suyo»); el servicio, su versión y su visibilidad quedan idénticos. En la web, el visitante que abre `/prestador/servicios` solo ve «Iniciar sesión». |
| CA-SER-04 | Con la categoría desactivada por el operador (vista previa y confirmación), publicar devuelve 422 `CATEGORIA_NO_ACTIVA` (`categoriaId`: «La clasificación no está activa.»); igual con una categoría inexistente y con la sembrada inactiva (Electricidad). La web ya no la ofrece en el selector. |
| CA-SER-05 | E2E web: se edita un servicio pausado (conserva PAUSADO, versión 4) y se reactiva (PUBLICADO, versión 5), tras lo cual vuelve a ser público. También se reactiva tras volver a activar la categoría. |
| CA-SER-06 | Con la categoría inactiva, reactivar un servicio pausado devuelve 422 `CATEGORIA_NO_ACTIVA` y lo deja PAUSADO en su misma versión; la web muestra la alerta y conserva el estado. Al activar de nuevo la categoría, la reactivación se admite. |
| CA-SER-07 | E2E web: RETIRADO muestra «Registro histórico de solo lectura. No admite cambios.» y ningún botón; editar, reactivar o pausar por la API devuelven 422 `SERVICIO_RETIRADO` sin alterar la versión 6 ni el contenido. «Cancelar retiro» no cambia nada. |
| CA-SER-08 | Pausado y retirado desaparecen de la búsqueda por categoría y del perfil público (web: «Este prestador no tiene servicios visibles por ahora.») y su enlace directo `/servicios/<id>` muestra «El contenido solicitado no está disponible.»; la API devuelve 404 `RECURSO_NO_DISPONIBLE`, idéntico al de un servicio inexistente. Al reactivar reaparece de inmediato (la caché de búsqueda no conserva datos caducados). |
| CA-SER-09 | Nivel de integración (T036/T073: `integration/ciclo-servicios.spec.ts`, «solo PUBLICADO con clasificación efectivamente activa es elegible»). En E2E se comprueba el efecto visible: un servicio PUBLICADO cuya categoría se desactiva deja de tener detalle, búsqueda y lugar en el perfil público y el titular lo sigue viendo; al reactivar la categoría vuelve. La consulta interna del puerto no es observable desde el navegador. |

### Verificación

- **Matriz completa:** 36 de 36 pruebas aprobadas en los 9 proyectos (13,3 min), en una sola corrida del ejecutor. `trazabilidad-criterios-002.json` registra los nueve criterios aprobados en 9 de 9 proyectos y la evidencia suma 36 archivos en `hu04/<proyecto>/` (4 por proyecto). Ninguna operación necesitó el reintento por indisponibilidad transitoria (`reintentosPorIndisponibilidadTransitoria: 0` en las 36).
- **Historial de la puesta a punto (se conserva por transparencia):** la primera ejecución en Chromium 1366 falló en 2 de 4 pruebas por supuestos míos sobre la interfaz y la API, no por defectos de HU04: (1) la opción del selector se llama «Construcción › Albañilería» (ahora se selecciona por valor); (2) un prestador sin perfil habilitado recibe 404 y no 403, y su lista propia es vacía (200). Se ajustaron las aserciones a lo que el contrato ya establece, sin relajar ninguna comprobación; los códigos de RETIRADO (422 `SERVICIO_RETIRADO`) se fijaron tras observarlos. Además, las corridas de exploración iniciales fallaron porque el intérprete por defecto del shell era Node 22 y la aplicación exige Node 24 (se usó el Node 24.15.0 del toolchain local).
- **Aislamiento:** al terminar no quedan bases `ayacucho_002_test_*`, buckets `e2e-*`, claves Redis `ayacucho:002:e2e-*`, bloqueo, credencial del operador, corpus ni señales, y no hay procesos escuchando en 3002 ni 5175. La huella de las 27 tablas de `ayacucho_002_validacion`, su bucket, su espacio Redis y los mensajes previos de Mailpit quedaron idénticos (`validacionLocalSinCambios: true`). No se tocó nada de 001 ni se eliminó ningún volumen.
- **Calidad (Node 24.15.0):** frontend `typecheck`, `lint` y `build` sin errores; 121 de 121 pruebas unitarias; `playwright test -c playwright.002.config.ts --list` da 144 pruebas. No hubo cambios de backend. `git diff --check` sin errores.
- Comando: `npm --prefix tecnologia/frontend run test:e2e:002 -- --especificaciones=servicios.spec.ts` (Docker con el proyecto 002 en marcha, puertos 3002 y 5175 libres y Node 24).

### Limitaciones y pendientes

- CA-SER-02 (referencias previas) y CA-SER-09 (consulta de elegibilidad) se verifican en el nivel de backend ya verificado y en E2E solo por su efecto visible; no se reejecutaron las pruebas de backend en esta tarea.
- El selector de categorías de la web se carga una vez por carga de página: tras desactivar una categoría, se actualiza al recargar (la prueba lo comprueba tras una nueva carga).
- La tabla de trazabilidad de `tasks.md` asigna además CA-SER-03 a T079, CA-SER-08 a T078 y CA-SER-04/06 a T064; esta tarea aporta cobertura E2E adicional, pero no cierra T078 ni T079, que siguen sin iniciarse.
- Siguen abiertos los pendientes técnicos anteriores (conteos de Actions n.º 3, margen de 120 s de `busqueda-publica.spec.ts`, lentitud ocasional del disco, causa inferida de RF39, informes locales de 001, `verificar-https-002.ts`). Como en T075, no se ejecuta en CI.

## T078 · Recorridos de HU05: búsqueda y consulta pública de la oferta (verificada)

Estado: **verificada** (78 de 94 acumuladas). Los criterios CA-BUS-01 a CA-BUS-05, CA-BUS-07 (caso de ambas fuentes ausentes) y CA-BUS-08, junto con la parte pública de CA-SER-08 y CA-CAT-02, se ejecutan en Chromium, Firefox y WebKit a 360, 768 y 1366 px (9 proyectos) sobre HTTPS con la CA 002 y una base, un bucket y un espacio Redis descartables por corrida (T075). No se modificó ningún archivo de 001, ni el workflow de CI, ni el código de la aplicación.

### Implementación

- `tecnologia/frontend/test/e2e/prestadores-catalogo/busqueda.spec.ts`: cuatro pruebas por proyecto (36 en la matriz; 180 con las de T075 a T077). Reutiliza `soporte.ts` y el ejecutor de T075 sin cambios. Cada prueba crea su propia oferta ficticia (categorías, prestadores y servicios con sufijos únicos, preparados por la API con el operador de la base descartable `E2E_OPERADOR_002`), de modo que los resultados esperados son exactos aunque la base acumule datos de otros proyectos. El visitante (contexto de navegador sin sesión) y una cuenta autenticada usan la **interfaz web real**.
- `tecnologia/frontend/test/soporte/reporte-002.ts`: los hechos `evidencia-ca-bus-*` se conservan en `hu05/<proyecto>/` (`hu03/` y `hu04/` siguen igual); la prueba unitaria de `reporte-002.test.ts` cubre las tres carpetas.

### Cobertura por criterio

| Criterio | Nivel y recorrido verificado |
|---|---|
| CA-BUS-01 | E2E web (visitante): categoría raíz (incluye la subcategoría), subcategoría, zona de atención, disponibilidad declarada y los tres filtros a la vez devuelven exactamente los servicios esperados; lo mismo para prestadores. Una cuenta autenticada obtiene los mismos resultados en el navegador y por la API. Paginación: 22 servicios; por API con página de 7 (7, 7, 7, 1) la unión es exacta, sin repetidos, con total constante y página repetida idéntica; fuera de rango devuelve 200 vacío con el total. En la web (cuenta autenticada) la página 1 muestra 20, la 2 muestra 2, la unión es exacta y «Anterior» recupera el mismo orden. |
| CA-BUS-02 | Una zona sin prestadores muestra «No hay coincidencias para esos criterios. Ajuste los filtros e intente de nuevo.» sin error; «Quitar filtros» restablece los criterios y se puede volver a buscar. |
| CA-BUS-03 | El detalle del servicio y el perfil público muestran el servicio, la experiencia, las zonas, los trabajos anteriores y la disponibilidad como declaración («no constituye una reserva ni una confirmación»). |
| CA-BUS-04 | La búsqueda base sigue disponible y no ofrece filtro ni texto de calificaciones; el parámetro `calificacion` se rechaza con 400 `DATOS_INVALIDOS` como cualquier parámetro desconocido; el perfil muestra «Calificaciones aún no disponibles» y no aparecen «Sin valoraciones», puntuaciones ni estrellas. |
| CA-BUS-05 | El perfil muestra «Verificaciones aún no disponibles», los datos aportados siguen en la sección «Información declarada por el prestador» y no hay insignias ni estados de verificación. |
| CA-BUS-07 | Solo el caso real de 002 (ambas fuentes ausentes: los dos avisos exactos, en ese orden y sin otros). Los otros tres casos de disponibilidad requieren dobles de las fuentes y se verifican en backend (`unit/filtros-y-avisos.spec.ts`, T044, e `integration/privacidad-publica.spec.ts`, T052), no en el navegador. |
| CA-BUS-08 | Las respuestas públicas (perfil, detalle, resumen de búsqueda, servicios del perfil) tienen una lista cerrada de campos y no contienen el correo, su parte local, el identificador de cuenta ni cadenas como documento, dirección, teléfono, token o credenciales; las vistas web tampoco. Las rutas de documentos o archivos privados y una fotografía inexistente devuelven 404 `RECURSO_NO_DISPONIBLE` sin confirmar nada. 002 no tiene aún un recurso de documentos privados: se comprueba que no hay ruta pública que lo entregue. |
| CA-SER-08 / CA-CAT-02 (parte pública) | Un servicio pausado y otro retirado desaparecen de la búsqueda web y API, del perfil público («Este prestador no tiene servicios visibles por ahora.») y del enlace directo («El contenido solicitado no está disponible.», 404 idéntico al de uno inexistente). Al desactivar la subcategoría, la oferta queda oculta (búsqueda vacía con su mensaje, detalle 404, perfil sin servicios) mientras el servicio de su titular sigue PUBLICADO en la misma versión y el prestador sigue público; al reactivar la categoría vuelven los publicados y no el pausado ni el retirado. |

### Verificación

- **Matriz completa:** 36 de 36 pruebas aprobadas en los 9 proyectos (10,7 min), en una sola corrida. `trazabilidad-criterios-002.json` registra los nueve criterios declarados aprobados en 9 de 9 proyectos y la evidencia suma 36 archivos en `hu05/<proyecto>/` (4 por proyecto).
- **Historial de la puesta a punto (se conserva por transparencia):** la primera ejecución en Chromium 1366 falló en 2 de 4 pruebas por un fallo de mi propia prueba: tras iniciar sesión esperaba el enlace «Buscar servicios», que también existe sin sesión, y pulsaba antes de que terminara el inicio de sesión. Ahora espera «Mi cuenta», que solo existe con sesión. No hubo defectos de HU05 ni se relajó ninguna aserción.
- **Aislamiento:** al terminar no quedan bases `ayacucho_002_test_*`, claves Redis `ayacucho:002:e2e-*`, bloqueo ni procesos en 3002 y 5175; la huella de las 27 tablas de `ayacucho_002_validacion`, su bucket, su espacio Redis y los mensajes previos de Mailpit quedaron idénticos (`validacionLocalSinCambios: true`). No se tocó 001 ni se eliminó ningún volumen.
- **Calidad (Node 24.15.0):** frontend `typecheck`, `lint` y `build` sin errores; 121 de 121 pruebas unitarias; `playwright test -c playwright.002.config.ts --list` da 180 pruebas. Sin cambios de backend. `git diff --check` sin errores.
- Comando: `npm --prefix tecnologia/frontend run test:e2e:002 -- --especificaciones=busqueda.spec.ts` (Docker con el proyecto 002 en marcha, puertos 3002 y 5175 libres y Node 24).

### Limitaciones y pendientes

- CA-BUS-06 (caché de lectura vacía o con fallo) y los tres casos restantes de CA-BUS-07 no son inducibles desde el navegador sin alterar la infraestructura compartida; siguen cubiertos en backend (T053, T064, T044) y no se reejecutaron aquí.
- CA-BUS-08 se verifica sobre los datos privados que 002 realmente almacena (correo e identificador de cuenta); no hay en 002 un recurso de documentos privados que probar.
- El orden de los resultados se comprueba como estabilidad entre páginas y repeticiones, no contra un orden de negocio concreto.
- Siguen abiertos los pendientes técnicos anteriores (conteos de Actions n.º 3, margen de 120 s de `busqueda-publica.spec.ts`, lentitud ocasional del disco, causa inferida de RF39, informes locales de 001, `verificar-https-002.ts`). Como en T075, no se ejecuta en CI. T079 no se ha iniciado.

## T079 · RF39 por el canal interno real y matriz EQ-04/PR04 (verificada)

Estado: **verificada** (79 de 94 acumuladas). La gestión de categorías por el canal interno autenticado del monolito y la matriz de accesos no autorizados se ejecutan en dos niveles: **E2E** contra el monolito completo por HTTPS (Chromium, Firefox y WebKit a 360, 768 y 1366 px; base, bucket y espacio Redis descartables por corrida, T075) e **integración** con PostgreSQL real y las rutas HTTP reales del arnés US4. No se modificó ningún archivo de 001, ni el workflow de CI, ni el código de la aplicación, y no se relajó ningún control.

### Implementación

- `tecnologia/frontend/test/e2e/prestadores-catalogo/categorias.spec.ts`: tres pruebas por proyecto (27 en la matriz; 207 con las de T075 a T078). El canal interno de RF39 es la API HTTPS autenticada (no tiene interfaz web propia); el operador es el operador ficticio de la base descartable (`E2E_OPERADOR_002`, con el permiso concedido por el flujo operativo de la semilla). El navegador aporta el cliente HTTP y la visibilidad pública.
- `tecnologia/backend/test/integration/prestadores-catalogo/seguridad-end-to-end.spec.ts`: tres pruebas con la matriz de nueve actores por seis operaciones (más servicios ajenos), huella de contenido de **todas** las tablas antes y después de cada actor y cuerpo de error sin divulgación. Escribe `matriz-pr04-002.json` en `EVIDENCIA_JEST`.
- `tecnologia/frontend/scripts/verificar-auditoria-002.mjs`: contrasta la auditoría que exporta el ejecutor por corrida (`auditoria-corrida-N.json`) con las acciones que declaran las pruebas (`auditoriaEsperada`); solo lee evidencia local.
- `tecnologia/frontend/test/soporte/reporte-002.ts` (+ prueba unitaria): los hechos `evidencia-ca-cat-*` se guardan en `hu25/<proyecto>/`.

### Cobertura por criterio

| Criterio | Nivel y verificación |
|---|---|
| CA-CAT-01 | E2E: el operador crea una raíz y una subcategoría (nacen inactivas y no son públicas), edita la raíz (versión 2), activa ambas y aparecen en la consulta pública. |
| CA-CAT-02, CA-CAT-08 | E2E: con la búsqueda ya calentada, la desactivación confirmada de la raíz la oculta de inmediato junto con sus servicios (detalle 404, búsqueda vacía); los servicios conservan PUBLICADO/PAUSADO y versión; la subcategoría conserva su estado propio activo y queda efectivamente inactiva. |
| CA-CAT-03 | E2E e integración: ver matriz. Visitante, cuenta sin permiso, permiso revocado y sesión cerrada no crean, editan, activan, previsualizan ni confirman, y no obtienen el recuento. |
| CA-CAT-05 | Backend (T060 a T065, `autorizacion-y-categorias.spec.ts`, 32 pruebas reejecutadas): concesión solo con constancia, firma, ejecutor distinto y sin autoconcesión. En E2E: ninguna de las cuentas ajenas puede usar el canal. |
| CA-CAT-06 | E2E: contraste con la auditoría exportada: cada acción del operador deja una fila con responsable (la cuenta del operador), acción, recurso y motivo. Los rechazos no dejan filas. |
| CA-CAT-07 | E2E: la vista previa informa 2 servicios afectados (el pausado no cuenta) sin cambiar nada; sin `confirmacionId` o sin motivo la desactivación da 400; con una confirmación inexistente, 409 `CONFIRMACION_NO_VALIDA`; con versión vieja, 409 `VERSION_DESACTUALIZADA`; una confirmación ya usada, 409. Todo se conserva hasta la confirmación válida. Si el impacto cambia tras la vista previa, la confirmación se rechaza con 409 `IMPACTO_DESACTUALIZADO` (observado en la puesta a punto y cubierto en `autorizacion-y-categorias.spec.ts`). |
| CA-CAT-09 | E2E: al reactivar vuelven los publicados cuya clasificación efectiva está activa; el pausado sigue excluido. |
| CA-CAT-10 | E2E (parte con Redis disponible): exclusión inmediata con búsqueda calentada. La caída de Redis queda en T069 (`redis-revision.spec.ts`), no se reejecutó aquí. |
| EQ-04 / PR04 | Ver matriz. |

### Matriz EQ-04/PR04

| Nivel | Actores | Intentos | Rechazados | Mutaciones | Divulgaciones |
|---|---|---|---|---|---|
| Integración (PostgreSQL real, 6 operaciones × 9 actores, más servicios ajenos) | visitante; token malformado; cliente sin permiso; prestador titular; prestador ajeno; permiso revocado con sesión abierta; sesión cerrada del operador; operador con origen ajeno; operador sin `Origin`; revocación entre vista previa y confirmación; servicios del titular desde visitante, cliente y prestador ajeno | 67 | 67 (100 %) | 0 (huella de todas las tablas idéntica por actor) | 0 (cuerpo = solo `codigo`, `mensaje`, `detalles`, sin nombres, recuento, confirmación ni claves) |
| E2E (monolito completo, HTTPS) | visitante; token malformado; cliente; titular; prestador ajeno; sesión cerrada; origen ajeno; sin `Origin`; recursos privados (perfil, servicios, trabajos y fotografías ajenos, 8 URLs privadas) | 828 en 9 proyectos (92 por proyecto) | 774 con 4xx; 54 son URLs fuera de `/api/v1` que la aplicación web responde con su carcasa HTML (no es el recurso) | 0 (el catálogo, la búsqueda, el perfil y los servicios del titular quedan idénticos y la confirmación del operador sigue siendo suya y vigente) | 0 |

Códigos observados: visitante 401 `NO_AUTENTICADO`; token malformado o sesión cerrada 401 (`NO_AUTENTICADO` o `SESION_NO_VALIDA`); cuenta sin permiso o permiso revocado 403 `SIN_PERMISO`; origen ajeno 403 `ORIGEN_NO_ADMITIDO`; sin `Origin` 400 `CABECERA_REQUERIDA`; recurso ajeno 404 `RECURSO_NO_DISPONIBLE` o 403.

### Verificación

- **E2E:** 27 de 27 pruebas aprobadas en 9 proyectos (2,2 min). La trazabilidad registra CA-CAT-01, 02, 03, 05, 06, 07, 08, 09, 10, CA-PRE-03 y CA-SER-03 aprobados en 9 de 9 proyectos; la evidencia suma 27 archivos en `hu25/<proyecto>/`.
- **Auditoría:** `verificar-auditoria-002.mjs`: 109 filas exportadas = 108 acciones esperadas de las pruebas + la concesión de la semilla; cada recurso tiene exactamente las filas esperadas (36 recursos) con el mismo responsable, sin filas de intentos no autorizados y en orden cronológico.
- **Integración:** `seguridad-end-to-end.spec.ts` 3 de 3, junto con `autorizacion-y-categorias.spec.ts` y `visibilidad-categorias.spec.ts` reejecutados (42 de 42 pruebas).
- **Aislamiento:** al terminar no quedan bases de prueba, buckets `e2e-*`, claves Redis `ayacucho:002:e2e-*`, bloqueo ni procesos en 3002 y 5175; la huella de las 27 tablas de `ayacucho_002_validacion`, su bucket, su espacio Redis y Mailpit quedaron idénticos (`validacionLocalSinCambios: true`). No se tocó 001 ni se eliminó ningún volumen.
- **Calidad (Node 24.15.0):** frontend `typecheck`, `lint` y `build` sin errores; 121 de 121 pruebas unitarias; backend `typecheck` y `lint` sin errores; `playwright test --list` da 207 pruebas. `git diff --check` sin errores.
- Comandos: `npm --prefix tecnologia/frontend run test:e2e:002 -- --especificaciones=categorias.spec.ts` y después `node tecnologia/frontend/scripts/verificar-auditoria-002.mjs`; en backend, `npm --prefix tecnologia/backend run test:integration:002 -- --testPathPatterns seguridad-end-to-end` (infraestructura 002 en marcha y Node 24).

### Puesta a punto (se conserva por transparencia)

Las primeras ejecuciones fallaron por supuestos míos, no por defectos de seguridad ni funcionales: versiones de categoría mal contadas (la activación sube la versión), códigos de error de origen (`ORIGEN_NO_ADMITIDO` y `CABECERA_REQUERIDA`), una vista previa tomada antes de publicar el servicio (el control `IMPACTO_DESACTUALIZADO` la invalidó correctamente), rutas del perfil de prestador que el arnés US4 no monta (se movieron a la matriz E2E del monolito completo) y, en la matriz E2E, rutas fuera de `/api/v1` que la aplicación web sirve como HTML. Ninguna aserción de seguridad se relajó.

### Limitaciones y pendientes

- La **concesión y la revocación firmadas** del permiso (comando interno del host, firma del Product Owner, ejecutor distinto) no pueden ejecutarse desde el navegador: se verifican en integración (`autorizacion-y-categorias.spec.ts`, T060 a T065). Por eso la **cuenta revocada con sesión abierta** y la revocación entre vista previa y confirmación se prueban en integración y no en E2E.
- Tras reconceder el permiso, una confirmación anterior de la misma cuenta, clasificación y versión sigue siendo usable una sola vez si no venció; el criterio solo exige el rechazo mientras el permiso está revocado, que se cumple.
- 002 no tiene aún un recurso de documentos privados en 002: las rutas de documentos y archivos privados devuelven 404 y no existe ruta que los entregue.
- CA-CAT-10 con Redis caído y la restauración se mantienen en T069/T071.
- Siguen abiertos los pendientes técnicos anteriores (conteos de Actions n.º 3, margen de 120 s de `busqueda-publica.spec.ts`, lentitud ocasional del disco, causa inferida de RF39, informes locales de 001, `verificar-https-002.ts`). Como en T075, no se ejecuta en CI. T080 no se ha iniciado.

## T080 · Accesibilidad, adaptabilidad y usabilidad (EQ-07/PR07): parte automatizada ejecutada, **PENDIENTE** de los recorridos manuales

Estado: **pendiente** (79 de 94; `tasks.md` mantiene `[ ]`). El cierre de T080 exige, además de las comprobaciones automatizadas, «recorridos manuales en celular y computadora reales» y la documentación de PR07 con ellos. Esa parte **no se ha podido ejecutar** (no hay dispositivos físicos disponibles para esta sesión) y una emulación de navegador no la sustituye, por lo que T080 no se marca como verificada. Lo automatizado se ejecutó completo y queda aprobado.

### Implementación

- `tecnologia/frontend/test/e2e/prestadores-catalogo/accesibilidad-responsive.spec.ts`: seis pruebas por proyecto (54 en la matriz de 9 proyectos; 261 con las de T075 a T079). Recorre, en cada navegador y ancho, las vistas de 002: búsqueda con resultados, búsqueda sin coincidencias, detalle de servicio, servicio no disponible, perfil público (visitante) y perfil profesional, «Mis servicios» y «Mis servicios» con edición y confirmación de retiro (titular con sesión).
- `tecnologia/frontend/test/e2e/prestadores-catalogo/analisis-accesibilidad.ts`: mediciones que se ejecutan en la página con el DOM y los estilos calculados reales de cada navegador (sin dependencia nueva; `axe-core` no está instalado ni se añadió).
- `tecnologia/frontend/src/features/prestadores-catalogo/presentacion/errores-campo.ts` (+ `errores-campo.test.ts`, 2 pruebas) y cambios en `PerfilProfesional.tsx`, `Portafolio.tsx` y `ServiciosPropios.tsx`: **corrección de un defecto de 002** (ver más abajo).
- `tecnologia/frontend/scripts/ejecutar-e2e-002.mjs` y `test/soporte/reporte-002.ts` (+ prueba): la evidencia `evidencia-eq-07-*` se conserva en `eq07/<proyecto>/` y el ejecutor la retira al inicio de la serie siguiente igual que las `hu*`.

### Qué mide cada prueba (por proyecto y vista)

| Prueba | Criterio comprobado | Resultado |
|---|---|---|
| Diseño adaptable | Sin desplazamiento horizontal general; ningún elemento fuera de la ventana; ningún control superpuesto; todo objetivo táctil ≥ 24×24 px (WCAG 2.5.8; el mínimo observado es 40 px); sin texto recortado | Aprobada en 9/9 |
| Nombres y estructura | Todo control visible tiene nombre accesible (aria-label, etiqueta, contenido o alt); `lang`; un `main`, un `h1` y navegación; encabezados sin saltos; imágenes con `alt` | Aprobada en 9/9 |
| Contraste | Todo texto visible ≥ 4,5:1 (≥ 3:1 si es grande); bordes de campos ≥ 3:1; sin animaciones en curso al medir. El peor texto medido es 7,67:1 (mensaje de error) y ninguna medición omitió fondos complejos | Aprobada en 9/9 |
| Teclado | Todo control visible y habilitado recibe el foco con Tab, en el orden del documento, sin trampas ni `tabindex` positivo, siempre dentro de la ventana y con un indicador de foco visible de al menos 3:1 | Aprobada en 9/9 |
| Flujos solo con teclado | Buscar con filtros (flechas y Enter), iniciar sesión y publicar un servicio, sin ratón; el resultado se contrasta con la API | Aprobada en 9/9 |
| Errores y avisos | Cada error de validación es un `alert` visible con `id` y su campo declara `aria-invalid` y `aria-describedby` hacia él (título de servicio, nombre público) | Aprobada en 9/9 tras la corrección |

### Defecto de 002 detectado y corregido

Los errores de validación de los formularios de 002 (`role="alert"`) no estaban asociados a su campo: el campo no declaraba `aria-invalid` ni `aria-describedby`, por lo que un lector de pantalla no anunciaba el error al enfocarlo. La prueba lo detectó en Chromium 360. Se corrigió con el ayudante `errores-campo.ts` (id del texto, `aria-invalid` y `aria-describedby` en el campo; solo `aria-describedby` en los grupos) en el perfil profesional, el trabajo anterior, la publicación y la edición de servicios. No se tocó ninguna pantalla de 001 ni la hoja de estilos compartida, y no se relajó ninguna comprobación. Humo posterior en Chromium 1366: `servicios.spec.ts` 4/4 y `perfil-y-portafolio.spec.ts` 7/7.

### Verificación

- **Matriz completa:** 54 de 54 aprobadas en los 9 proyectos (17,2 min). `trazabilidad-criterios-002.json` registra EQ-07 y PR07 aprobados en 9 de 9 proyectos y la evidencia suma 54 archivos en `eq07/<proyecto>/` (ancho, vistas, controles, objetivo mínimo, textos comprobados, peor contraste y paradas de Tab por vista).
- **Historial de la puesta a punto (se conserva por transparencia):** hasta llegar a la serie verde hubo cuatro series completas con fallos que no eran defectos de 002 y se corrigieron en la medición sin relajar ningún umbral: (1) tras pulsar un enlace, Tab continuaba desde ese enlace y los marcó «no alcanzables» (ahora el recorrido parte de un marcador no tabulable al inicio del documento); (2) en WebKit el desplazamiento hasta un campo enfocado tarda más que la medición (intermitente: se conceden hasta 3 s y se comprobó en 4 repeticiones aisladas); (3) la transición de color de 150 ms de los enlaces de navegación daba un contraste transitorio de 2,92:1 en Chromium 1366 (ahora se mide en reposo, sin animaciones); (4) un cuelgue puntual de WebKit 1366 al cerrar el contexto (300 s) y una carga de `/buscar` que no terminó en WebKit 360, ambos intermitentes y no repetidos. Una ejecución se interrumpió por dejar mi shell dentro de la carpeta de evidencia, que impidió su retirada; no afectó a los datos.
- **Aislamiento:** al terminar no quedan bases de prueba, buckets `e2e-*`, claves Redis `ayacucho:002:e2e-*`, bloqueo ni procesos en 3002 y 5175; la huella de las 27 tablas de `ayacucho_002_validacion`, su bucket, su espacio Redis y Mailpit quedaron idénticos (`validacionLocalSinCambios: true`). No se tocó 001 ni se eliminó ningún volumen.
- **Calidad (Node 24.15.0):** frontend `typecheck`, `lint` y `build` sin errores; 123 de 123 pruebas unitarias; `playwright test --list` da 261 pruebas. `git diff --check` sin errores.
- Comando: `npm --prefix tecnologia/frontend run test:e2e:002 -- --especificaciones=accesibilidad-responsive.spec.ts` (Docker con el proyecto 002 en marcha, puertos 3002 y 5175 libres y Node 24).

### Observaciones sobre 001 (no modificado)

Las pantallas de acceso y registro pertenecen a 001 y no se midieron como parte de T080. Una medición preliminar mostró en ellas dos hallazgos para la 001: el botón «mostrar contraseña» se superpone por diseño al campo (el campo reserva espacio con relleno) y el enlace «Olvidé mi contraseña» mide menos de 24 px de alto. No se corrigieron por la restricción de no modificar 001.

### Lo que falta para cerrar T080 (obligatorio, no ejecutado)

1. **Recorridos manuales en un celular real y en una computadora real**, registrando versión del navegador, ancho y plataforma (EQ-07 y `plan.md`): búsqueda con filtros, detalle y perfil público, y para el titular el perfil profesional, la alta de servicios y su ciclo. Cada uno con su resultado y las incidencias.
2. **Revisión manual de legibilidad, uso del teclado y mensajes de estado** en esos dispositivos (`plan.md`, PR07) y su registro en este documento.
3. Opcional y recomendable: una pasada con un lector de pantalla real (NVDA, VoiceOver o TalkBack) sobre los formularios corregidos; las comprobaciones automatizadas verifican los atributos ARIA, no cómo los anuncia cada lector.
4. Con eso registrado, marcar T080 y dejar PR07 documentado.

### Limitaciones de lo ejecutado

- Los navegadores son los de Playwright (Chromium, Firefox y WebKit de Linux) con viewports de 360, 768 y 1366 px: son emulación de tamaño, no dispositivos reales ni sus motores móviles; el contacto táctil, los teclados virtuales y el zoom del sistema no se probaron.
- El contraste mide el texto y los bordes de campos con colores sólidos; no analiza imágenes ni el contraste de estados de pasar el ratón o deshabilitados (exentos por WCAG).
- No se cubrió el zoom de texto al 200 % ni el modo de contraste forzado.
- Siguen abiertos los pendientes técnicos anteriores (conteos de Actions n.º 3, margen de 120 s de `busqueda-publica.spec.ts`, lentitud ocasional del disco y de WebKit, causa inferida de RF39, informes locales de 001, `verificar-https-002.ts`). Como en T075, no se ejecuta en CI. T081 no se ha iniciado.

### T080 · Rediseño visual de 002, selectores desplegables y navegación lateral (segunda ronda; T080 sigue PENDIENTE)

Tras la revisión manual se rediseñaron las vistas de 002 y el menú principal. T080 **continúa pendiente**: faltan los recorridos manuales en dispositivos reales y una nueva serie E2E completa con la interfaz nueva (ver «No verificado»).

**Causas reales de los defectos de estilo** (hoja compartida `composicion/estilos.css`, no modificada): `label{display:grid}` junto con `input{width:100%;min-height:48px}` estiraba casillas y radios lejos de su texto; `form button[type=button]` dejaba los botones transparentes y los botones sin contenedor se apilaban sin separación; `.superficie` limitaba todo a 40 rem con el marco de un formulario de cuenta.

**Qué cambió**
- `presentacion/estilos-002.css` (nuevo): sistema visual de 002 con todas las reglas bajo `.superficie .p002`: tarjetas, rejillas adaptables, botones (acento, primario, contorno, peligro, deshabilitado y cargando), campos con foco y error, casillas y radios alineados, insignias de estado, mensajes de éxito y error. No afecta a 001.
- `BuscarOferta`, `DetallePrestador`, `PerfilProfesional`, `Portafolio`, `ServiciosPropios`: marcado con las clases del sistema; los botones de tarjetas muestran «Ver detalle», «Editar», «Pausar»… y conservan el nombre accesible completo con `aria-label`. Textos, validaciones, API y orden de tabulación se conservan.
- **Selectores desplegables** (`SelectorMultiple.tsx`): especialidades (agrupadas por categoría y subcategoría, la raíz con subcategorías como «toda la categoría») y zonas de atención. Selección múltiple, buscador sin tildes ni mayúsculas, lista con desplazamiento vertical, casillas nativas alineadas, resumen «N seleccionadas», etiquetas con «Quitar», «Quitar todas» y «Listo». Teclado: ↑ ↓ Inicio Fin entre opciones, Escape cierra y devuelve el foco. No cambia datos ni contratos (devuelve la lista de identificadores). Escala a muchas categorías (probado con 60 opciones). No se ampliaron las categorías reales.
- **Navegación lateral** (`composicion/BarraLateral.tsx` + `barra-lateral.css`): desde 768 px barra fija a la izquierda con la identidad, iconos lineales, opción activa resaltada, «Cerrar sesión» al pie y contenido amplio a la derecha; en celular, barra superior con botón «Menú» que abre un panel lateral (se cierra con el botón, Escape, tocando fuera o al elegir una opción) y enlace «Saltar al contenido». Visitantes y cuentas usan la misma disposición con sus opciones.

**Archivos compartidos con 001 modificados (documentados a propósito):** `src/composicion/App.tsx` (solo el bloque de presentación: cabecera y navegación se sustituyen por `BarraLateral`, el contenido va en `<main>`; rutas, sesión, permisos y cierre de sesión no cambian y siguen usando `EstadoSesion` de 001 sin tocarlo) y los nuevos `BarraLateral.tsx` y `barra-lateral.css` (clases `app-*`, sin reglas globales). `estilos.css` no se modificó.

**Pruebas de 001 adaptadas (solo el acceso al menú en celular, sin cambiar su lógica):** `test/e2e/usuarios-acceso/{contrasena,permisos,recuperacion-perfil,seguridad-navegador,sesiones,registro}.spec.ts` usan `conMenu`/`irA` de `test/soporte/menu-principal.ts`, que abren el menú solo si está plegado. **No se ejecutaron**: requieren el entorno 001 y su evidencia, que no se debe tocar; hay que correrlas con su ejecutor habitual.

**Verificado**
- `typecheck`, `lint` y `build` sin errores; 130 de 130 pruebas unitarias (7 nuevas: selector múltiple y barra lateral; se adaptaron 3 que abrían las casillas); `playwright --list` da 279 pruebas.
- Revisión visual y auditoría automática en Microsoft Edge a 360, 768 y 1366 px contra la validación en marcha (carpeta `tecnologia/.local/evidencia/002/t080-mejora-visual/despues/`, con `auditoria.json` por ancho): sin desplazamiento horizontal, sin textos con contraste insuficiente, sin controles sin nombre y objetivos ≥ 24 px en todas las vistas de 002 y en «Mi cuenta» y «Mis perfiles» de 001 bajo el nuevo menú. Los solapamientos que reporta la auditoría son los previstos: el panel del menú móvil, los paneles desplegables abiertos y el botón de ver contraseña de 001.
- Esa revisión creó en la base de validación tres cuentas ficticias `captura-*@example.invalid` con su perfil, servicios y un trabajo; no se eliminó nada.

**No verificado (pendiente)**
- Las suites E2E de 002 adaptadas al menú y a los selectores (`perfil-y-portafolio`, `servicios`, `busqueda`, `entorno`, `accesibilidad-responsive`, `diseno-visual`) **no se han reejecutado**: la API y Vite de la validación están en marcha en los puertos 3002 y 5175 y el ejecutor exige tenerlos libres. Hay que detenerlas y ejecutar la serie.
- No se capturó el estado «antes» del rediseño; se conserva el diagnóstico de causas y el «después».
- Recorridos manuales en celular y computadora reales (T080).
- Pendiente separado de 001: botón de contraseña superpuesto al campo y enlace «Olvidé mi contraseña» con menos de 24 px de alto.

### T080 · Ajustes de la búsqueda tras la revisión visual (tercera ronda; T080 sigue PENDIENTE)

- **Nombres repetidos en «Prestadores» (investigado, no es duplicación).** Consulta de solo lectura a `ayacucho_002_validacion`: 6 perfiles con 6 identificadores y 6 cuentas distintos, 6 filas en la proyección de búsqueda (todas con su perfil) y 0 filas huérfanas. «Carlos Quispe Huamán» (`601455ec` y `6225ea0e`) y «Rosa Mendoza Ccente» (`5a225ea8` y `91aa3325`) son cuentas distintas creadas en dos ejecuciones de mi script de capturas (04:38 y 04:41 del 24-nov); «Maestro de obra ficticio T072» (`6f7f739d` y `d84e24ba`) son dos cuentas de pruebas anteriores (20-nov). Son datos de prueba legítimos: no se eliminó ni se fusionó nada y la búsqueda no deduplica por nombre (correcto, dos prestadores reales pueden llamarse igual).
- **Tarjetas de servicio:** muestran «Categoría» y, si existe, «Subcategoría» (a partir de `categoriaId` y de las categorías públicas ya cargadas) y «Zona: X» solo cuando hay un filtro de zona activo (el servicio ya cumple ese filtro). Limitación: el servicio público no trae las zonas de su prestador, así que sin filtro no se puede mostrar la zona sin otra petición por tarjeta o un cambio de API; queda como mejora separada.
- **Tarjetas de prestador:** muestran sus especialidades concretas («Raíz › Subcategoría») cuando el identificador se puede nombrar con las categorías públicas; las que no (inactivas) se omiten.
- Sin otros cambios de diseño. Pruebas: `tarjetas-resultados.test.tsx` (3 nuevas) y 133 de 133 unitarias; `typecheck`, `lint` y `build` sin errores. Capturas de solo lectura en `t080-mejora-visual/despues-tarjetas/{360,768,1366}`.
- **Pruebas E2E focalizadas: pendientes.** Los puertos 3002 y 5175 siguen ocupados por la API y Vite de la validación en marcha (PID 23764 y 29336) y el ejecutor exige tenerlos libres; no se han detenido sin autorización de la persona usuaria.

### T080 · Ronda de verificaciones E2E tras el rediseño (T080 sigue PENDIENTE)

Puertos 3002 y 5175 liberados por la persona usuaria; las series se ejecutaron una tras otra con la evidencia de cada una copiada a `tecnologia/.local/evidencia/002/t080-ronda3/<serie>` antes de que la siguiente retirara `hu*`/`eq*`.

**Resultados 002 (Node 24.15.0, HTTPS con la CA 002, base/bucket/Redis descartables)**

| Serie | Proyectos | Resultado |
|---|---|---|
| `accesibilidad-responsive.spec.ts` (6 pruebas por proyecto) | los 9 | **54 de 54** (30 min). EQ-07 y PR07 aprobados en 9 de 9; base de validación idéntica (`validacionLocalSinCambios: true`) |
| `perfil-y-portafolio.spec.ts` (selectores desplegables, tarjetas del portafolio) | chromium-360, chromium-1366, webkit-360, firefox-768 | 7 de 7 en cada uno |
| `servicios.spec.ts` (botones de tarjeta, menú) | chromium-360 y 1366 | 4 de 4 en cada uno |
| `busqueda.spec.ts` (tarjetas, filtros, paginación) | chromium-360 y 1366 | 4 de 4 en cada uno |
| `entorno.spec.ts` (menú principal, navegación) | chromium-360 y 1366 | 4 de 4 en cada uno |

Comprueban: menú lateral desde 768 px y panel «Menú» en celular, selectores múltiples (elegir, buscar, quitar, recargar y conservar lo guardado), tarjetas de servicios y prestadores, flujos solo con teclado y todas las vistas (desbordamiento, nombres, contraste, foco y orden de tabulación).

**Defectos encontrados y corregidos en esta ronda (todos de pruebas o de su medición, ninguno de la aplicación)**
- Tras iniciar sesión en celular el panel se cierra al cambiar de ruta y podía cerrarse entre abrirlo y pulsar: `irA` reintenta (`test/soporte/menu-principal.ts`).
- La barra superior adherida en celular se contaba como solape con el contenido que se desplaza por debajo, y la barra lateral adherida como «retroceso de foco»: la medición ignora los elementos fijos o adheridos y admite el cambio de columna (rejillas, campos en dos columnas). La prueba de teclado de celular alternaba el menú en lugar de abrirlo.
- Una carga de `/buscar` devolvió el 503 del proxy antes de que el contenedor alcanzara a Vite: `ejecutar-e2e-002.mjs` ahora espera además a que `/` y `/api/v1/salud` respondan **a través del proxy 8444** antes de lanzar las pruebas.
- Dos arranques fallaron por infraestructura (`timeout expired` al crear la base descartable y un `exit 127` del lanzador) y pasaron al repetirlos.

**Regresión de 001 (entorno habitual: contenedores, API 3000, Vite 5173 y proxy 8443 de la validación 001; evidencia en carpetas nuevas `t080-regresion-001*`; la de 001 no se tocó)**
- Con las pruebas ya adaptadas al menú, `registro`, `sesiones`, `contrasena`, `permisos`, `recuperacion-perfil` y `seguridad-navegador` de `usuarios-acceso`: **8 de 8 en Chromium 360 y 8 de 8 en Chromium 1366**.
- La primera pasada usó las pruebas antiguas copiadas en la imagen `ayacucho-001-e2e:fundacion` (la imagen no se reconstruyó): en 1366 pasaron 7 de 8 (la barra lateral mantiene visibles «Cerrar sesión» y el resto del menú) y en 360 fallaron como era previsible por el menú plegado; después se montaron las pruebas actuales sobre la imagen. Se añadió `cerrarMenu` para no dejar el panel abierto sobre el contenido.
- Esas ejecuciones registraron cuentas ficticias nuevas en la base de validación 001 (de 1588 a 1635 usuarios); no se modificó ni eliminó nada existente. Se detuvieron la API, Vite y los contenedores de 001 que se arrancaron.
- **Salvedad:** se ejecutaron Chromium 360 y 1366 y las seis suites que cambiaron; no se corrió la matriz completa de 001 (Firefox, WebKit y 768 px, ni el resto de sus suites).

**Incidencia propia:** `vitest` escribe por defecto su informe en `tecnologia/.local/evidencia/001/frontend-junit.xml`; varias de mis ejecuciones de pruebas unitarias lo sobrescribieron sin pasar la ruta alternativa que ya conocía. Es un informe regenerable (133 pruebas, 0 fallos, fecha 24-nov), pero la versión anterior se perdió. El último ciclo de calidad usó una ruta temporal.

**Calidad:** `typecheck`, `lint` y 133 de 133 unitarias sin errores; `playwright --list` da 279 pruebas.

**Sigue pendiente para cerrar T080:** recorridos manuales en celular y computadora reales (plantilla en `evidencia/002/manual-t080/`), y, si se desea cobertura de 001 completa tras el cambio del menú, su matriz habitual completa.

## T081 · Escenario k6 de la 002 con 1 000 prestadores y 5 000 servicios (verificada)

Estado: **verificada** (80 de 94 acumuladas). T080 continúa `[ ]` (verificaciones manuales en dispositivos reales). T081 figura con T080 entre sus dependencias, pero **no consume ningún resultado de T080**: el escenario es solo HTTP sobre la API pública y no usa la interfaz, su accesibilidad ni sus evidencias. Se ejecutó sin cerrar T080 por indicación expresa de la persona usuaria; queda anotado para que el cierre de T082/T083 (que dependen de T081) lo tenga en cuenta. T081 prepara y verifica el escenario; **la medición de EQ-01/PR01 es T082** y no se evalúa aquí.

### Implementación

- `tecnologia/backend/test/soporte/prestadores-catalogo/carga.ts`: conjunto ficticio y determinista (semilla `20260101`): 1 000 prestadores (3 tipos, 1 a 3 zonas, 1 a 2 especialidades, 60 % declaran disponibilidad, 5 % no publicables), 5 000 servicios (5 por prestador; 80 % PUBLICADO, 10 % PAUSADO, 10 % RETIRADO; 5 % en clasificaciones inactivas), 30 categorías de carga en dos niveles (con una raíz inactiva y una subcategoría con estado propio inactivo bajo una raíz activa) y 400 trabajos. Sin datos personales. Calcula, con las mismas reglas de visibilidad que las consultas públicas, el resultado esperado de 44 consultas de servicios y 44 de prestadores, de una muestra de 440 detalles y de 315 perfiles.
- `tecnologia/backend/scripts/cargar-datos-carga-002.ts`: vuelca el conjunto en la base **descartable** `ayacucho_002_test_<id>` en una transacción (exige ese patrón de nombre; nunca `ayacucho_002_validacion`) y escribe el manifiesto.
- `tecnologia/backend/test/performance/prestadores-catalogo.k6.js`: trayecto reproducible por usuario virtual (categorías → búsqueda de servicios → página siguiente → detalle → perfil → búsqueda de prestadores → perfil), **pausas de 3 a 8 s**, mezcla con generador sembrado (sin `Math.random`), ocho operaciones etiquetadas, aserciones de corrección por operación, umbrales (p95 < 2 s por operación, corrección 100 %, errores técnicos < 1 %), perfiles `humo` (5 VU, 90 s), `nominal` (50 VU, 15 min, para T082) y `ensayo-rapido` (solo corrección; pausas de 0,2 a 0,6 s) y un control negativo.
- `tecnologia/frontend/scripts/ejecutar-e2e-002.mjs --carga` (`npm run test:carga:002`): reutiliza el ejecutor de T075 (bloqueo exclusivo, recursos descartables por corrida, recuperación de huérfanos, comprobación de que la validación local no cambia). En este modo no levanta Vite ni navegadores: crea la base/bucket/espacio Redis descartables, carga el conjunto, sirve la API compuesta, ejecuta k6 contra `https://localhost:8444` (o `--origen=directo` a `127.0.0.1:3002`) y retira todo. Evidencia en `tecnologia/.local/evidencia/002/carga` (sin tocar `e2e-linux`).
- `tecnologia/backend/test/unit/prestadores-catalogo/carga.spec.ts`: 9 pruebas del conjunto y de las garantías estáticas del escenario.

### Operaciones y etiquetas

| `operacion` | `name` (plantilla sin identificadores) | Aserciones |
|---|---|---|
| `categorias` | `GET /categorias` | 200; número de categorías vigentes del manifiesto; sin datos privados |
| `busqueda_servicios`, `busqueda_servicios_pagina` | `GET /servicios` | total, página y tamaño esperados; solo PUBLICADOS; categorías admitidas por el filtro; orden estable por identificador |
| `busqueda_prestadores` | `GET /prestadores` | total, página y tamaño; orden por nombre; solo campos públicos |
| `detalle_servicio` / `detalle_servicio_no_disponible` | `GET /servicios/{id}` | 200 del servicio pedido y publicado / 404 `RECURSO_NO_DISPONIBLE` sin revelar el estado |
| `perfil_prestador` / `perfil_prestador_no_publicable` | `GET /prestadores/{id}` | 200 con el total de servicios visibles esperado y los dos avisos de 011 y 012 / 404 |

El `url` completo se excluye de las etiquetas del sistema. Comprobación con la salida JSON de k6: etiquetas `check, error_code, escenario, expected_response, method, name, operacion, scenario, status`; `name` solo toma las seis plantillas de ruta y **ningún valor de etiqueta contiene un UUID**.

### Verificación (Node 24.15.0, k6 2.0.0, API compuesta de 40 operaciones sobre recursos descartables)

| Serie | Resultado |
|---|---|
| Base cargada (SQL independiente) | 1 000 perfiles, 1 000 proyecciones, 5 000 servicios (3 985 publicados, 3 606 visibles), 36 clasificaciones (6 de la semilla + 30 de carga), 400 trabajos |
| `ensayo-rapido` (4 VU × 6 iteraciones) | 125 peticiones, corrección 100 %, 0 errores técnicos, p95 55 ms; 7 de las 8 operaciones muestreadas (en otra serie, 127 peticiones con las 8) |
| `humo` (5 VU, 90 s, pausas de 3 a 8 s) | 93 peticiones en 120 s (0,78 RPS), **corrección 100 %**, 0 errores técnicos, p95 global 72 ms; las 8 operaciones con p95 ≤ 91 ms; umbrales cumplidos |
| Control negativo (`--control-negativo`, totales desplazados en 1) | k6 sale con **99**: corrección 61 % y umbrales de corrección incumplidos en las búsquedas; confirma que las aserciones detectan errores |

Tras cada serie: base, bucket y claves Redis descartables retirados, sin bloqueo ni procesos en 3002/5175 y huella de la validación (`ayacucho_002_validacion`, su bucket, Redis y Mailpit) **idéntica** (`validacionLocalSinCambios: true`). Evidencia archivada en `tecnologia/.local/evidencia/002/carga-t081/<serie>/` (resumen k6 por operación, manifiesto, preparación y `etiquetas-k6.json`).

**Calidad:** backend `typecheck` y `lint` sin errores, 9 de 9 pruebas unitarias nuevas, frontend `typecheck` y `lint` sin errores. No se modificó la interfaz ni 001.

### Limitaciones y cobertura posterior

- Las **10 000 solicitudes** del escenario integral de EQ-01 y las **comparaciones de cotizaciones** son cobertura posterior (003 y siguientes); el manifiesto y el resumen de k6 las declaran.
- Los resultados de `humo` y `ensayo-rapido` **no son** la medición de EQ-01: 5 usuarios y 90 s no acreditan p95 con 50 VU durante 15 min. La evaluación (p95, RPS, errores técnicos y la corrida con Redis caído) es T082; EQ-03 es T083.
- El conjunto se carga por SQL directo en la base descartable (como los arneses de HU05), no por la API; así cada corrida parte del mismo estado exacto. La caché de lectura de Redis arranca vacía en cada corrida.
- k6 confía en la CA 002 a través del almacén de certificados de Windows (importada previamente); con `--origen=directo` no usa TLS ni el proxy.
- La proporción de 404 (servicio no disponible y perfil no publicable) en el trayecto es pequeña y aleatoria: en una serie corta puede no aparecer alguna operación.
