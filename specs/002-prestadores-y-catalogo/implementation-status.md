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
| HU03 / RF06 | PENDIENTE | CA-PRE-01 a 08. |
| HU04 / RF08 | PENDIENTE | CA-SER-01 a 09. |
| HU05 / RF09, RF10 | PENDIENTE | CA-BUS-01 a 08. |
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

Los escenarios funcionales de las historias, la regresión conjunta de 40 operaciones y el resto de las verificaciones siguen `PENDIENTES`.
