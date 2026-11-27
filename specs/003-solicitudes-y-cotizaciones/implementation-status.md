# Estado de implementación — 003 Solicitudes y cotizaciones

Documento vivo de la funcionalidad 003. Se actualiza con cada fase. Datos ficticios; no contiene secretos.

## 1. Línea base

| Elemento | Valor |
|---|---|
| Rama | `003-solicitudes-y-cotizaciones` |
| Commit documental base de la implementación | `d078263` (docs(003): especificacion plan y tareas) |
| Línea base de 001 y 002 en `main` | `c32f2c8` |
| Runtime | Node.js 24.15.0 (toolchain local del proyecto) |
| Alcance autorizado hasta ahora | Fases 1 (T001–T008), 2A (T009–T024) y 2B (T025–T042) |
| Commit de la Fase 1 | `b6e67bd` (CI #1 «003 Solicitudes y cotizaciones»: SUCCESS, 2 min 27 s, según informó el PO) |

## 2. Contratos fuente e inventario de operaciones

| Funcionalidad | Contrato fuente | Operaciones |
|---|---|---|
| 001 Usuarios y acceso | `specs/001-*/contracts/` | 17 |
| 002 Prestadores y catálogo | `specs/002-prestadores-y-catalogo/contracts/` | 23 |
| 003 Solicitudes y cotizaciones | `specs/003-solicitudes-y-cotizaciones/contracts/` | 18 |
| **Total compuesto** | | **58** |

Distinción de verificación:

- **Verificado con el ensamblador de documentos** (`componerOpenApi`, solo lectura, 2026-11-26): 17 + 23 + 18 = 58 operaciones. Esto prueba la composición de documentos, no el comportamiento de la API.
- **Solo se verificará con el arranque real**: que la aplicación arranque con las 58 operaciones, la validación definitiva de la composición (T088). El espejo ejecutable `tecnologia/backend/contracts/solicitudes-cotizaciones.openapi.json` ya existe (T010) y es idéntico a la fuente.

## 3. Verificaciones de aceptación

Todas en estado **PENDIENTE** salvo lo indicado en la sección 4 (infraestructura de la Fase 1). Ninguna historia de usuario, criterio de aceptación (CA), caso de prueba (CP-301..310) ni objetivo de operación (OP-301..307) se ha implementado ni verificado.

| Bloque | Estado |
|---|---|
| Historias de usuario y requisitos FR-3xx | PENDIENTE |
| Criterios de éxito SC-3xx | PENDIENTE |
| Contratos y pruebas de contrato | PENDIENTE |
| Integración con PostgreSQL y almacenamiento | PENDIENTE |
| Pruebas de extremo a extremo (matriz 3 navegadores × 3 anchos) | PENDIENTE |
| Rendimiento (k6) | PENDIENTE |
| Seguridad y privacidad | PENDIENTE |
| Respaldo y restauración | PENDIENTE |
| Arranque real con 58 operaciones (T088) | PENDIENTE |
| CI en GitHub Actions | PENDIENTE (flujo creado, no ejecutado) |

## 4. Resultados de la Fase 1 (T001–T008)

Evidencia local (ignorada por Git): `tecnologia/.local/evidencia/003/fase1/` (`verificaciones-fase1.txt` y los JUnit de las suites).

| Tarea | Resultado | Evidencia |
|---|---|---|
| T001 | Este documento. | — |
| T002 | `tecnologia/compose.003.yaml`: proyecto `ayacucho-003-validacion`; PostgreSQL 54331, Redis 63801, correo 1027/8027, Garage 3911, proxy 8447. Sin bucket ni clave predeterminados. | `docker compose config`; `up -d --wait` con los cuatro servicios Healthy; `down -v` sin residuos. |
| T003 | `tecnologia/backend/scripts/entorno-003.ts`: identidad, puertos, rutas y base `ayacucho_003_validacion`; ningún valor coincide con 001 ni 002. El bucket `plataforma-003-validacion` es el equivalente en validación del bucket único con prefijos lógicos. | Pruebas unitarias del entorno. |
| T004 | `tecnologia/backend/scripts/preparar-validacion-003.ts`: genera solo configuración, TLS y catálogo ficticio de la 003 bajo `.local/003/`; exige `--validation`; idempotente. | Ejecuciones reales, guardas y pruebas unitarias. |
| T005 | Soporte de pruebas en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/` (`postgres.ts`, `contador-sentencias.ts`, `almacenamiento.ts`). | Verificado contra PostgreSQL y Garage reales (base temporal creada y retirada, conteo de sentencias, retiro acotado por prefijo) y 18 pruebas unitarias. |
| T006 | `tecnologia/frontend/playwright.003.config.ts` y `scripts/independencia-003.mjs`: 3 navegadores × 3 anchos (9 proyectos), evidencia confinada a `.local/evidencia/003/`. | 7 pruebas unitarias. No se ejecutó ninguna prueba de navegador. |
| T007 | `.github/workflows/solicitudes-cotizaciones.yml`: tres trabajos (calidad, validación 003, regresión 001 y 002). | Solo verificación estructural (YAML). **No se ha ejecutado en GitHub Actions.** |
| T008 | Seis comandos en `tecnologia/backend/package.json` y `scripts/iniciar-validacion-003.ts`; los comandos de 001 y 002 no cambian. | `--verificar-config` real; no regresión de comandos de 002. |

Calidad: lint, typecheck y build de backend y frontend en verde. Unitarias completas: backend 26 suites / 378 pruebas; frontend 19 archivos / 180 pruebas.

## 5. Incidencias, desviaciones y pendientes

1. **T007 sin ejecución en GitHub.** El flujo ejecuta hoy solo lo que existe; los pasos que dependen de tareas posteriores se añaden con ellas. La regresión de 002 con la composición de la 003 se añade en T024 y T089; hoy la regresión ejecuta solo 001.
2. **Acciones delegadas.** `migrar`, `storage`, `seed` e `iniciar` informan "pendiente de T012/T029, T041, T042 y T013" y fallan sin tocar infraestructura. T041 menciona implementar `storage:init:003` en `iniciar-validacion-003.ts`, mientras que T008 delega en `scripts/inicializar-storage-003.ts` (como hace 002). Desviación menor; se decide al llegar a T041.
3. **Efecto colateral local.** Durante una ejecución de Vitest se sobrescribió `tecnologia/.local/evidencia/001/frontend-junit.xml` (archivo local, ignorado por Git). Después se evitó con `--outputFile.junit`.
4. **Node en PATH.** En Git Bash el `node` del PATH es v22; las verificaciones se ejecutaron con el toolchain 24.15.0.
5. **Deuda del saneador:** no aplica todavía.
6. **Fuera de alcance:** no se ha iniciado T009 ni ninguna fase posterior.

## 6. Fase 2A (T009–T024): cambios aditivos en 001, 002, Notificaciones, composición y CI

### 6.1 Qué verificó realmente la CI #1 (commit `b6e67bd`)
No se pudo leer el registro de GitHub desde esta sesión; lo siguiente sale de la definición del flujo en ese commit y del resultado SUCCESS informado por el PO. La CI #1 ejecutó: lint, typecheck, build y pruebas unitarias del frontend; la configuración 003 con su infraestructura propia (`--verificar-config`) y las pruebas **unitarias** de la 003; y la regresión de 001 (unitarias, contratos e integración filtradas por `usuarios-acceso|fundacion`). **No ejecutó** pruebas de contrato, arquitectura ni integración de la 003, ni la regresión de 002, ni k6, ni Playwright. Nada de lo de esta fase se atribuye a esa ejecución.

### 6.2 Resultados locales (2026-11-26, Node 24.15.0, infraestructura Docker propia de cada funcionalidad)
| Verificación | Resultado |
|---|---|
| Contrato de composición 003 (T009/T010) | 17 de 17 pruebas. 17 + 23 + 18 = 58 sin colisión, ambigüedad ni `operationId` repetido; espejo idéntico byte a byte; `IdempotencyKey`, `Origin` y `bearerAuth` idénticos |
| Arranque de la composición (T011/T013) | 14 de 14 (PostgreSQL real). Modo `prueba` con subconjunto, modo `completa` con 58 rutas (controladores simulados), orden de rutas, 17 y 40 sin cambios |
| Integración 003 completa (T011, T016, T018, T020) | 4 suites, 57 pruebas |
| Unitarias 003 | 8 suites; backend completo: 29 suites, 429 pruebas |
| Arquitectura (T022) | 3 suites, 8 pruebas (incluye las reglas nuevas) |
| Contratos de todo el backend | 19 suites, 219 pruebas (001, 002 y 003) |
| **Regresión 001, integración** | 12 suites, 129 pruebas |
| **Regresión 002, integración** (`test:integration:002`) | 17 suites, 165 pruebas |
| lint, typecheck, build del backend | sin errores |
| Bases temporales residuales | 0 en las tres instancias |

Evidencia local (ignorada por Git): `tecnologia/.local/evidencia/003/fase2a/`.

### 6.3 Qué NO se ejecutó
- `test:integration:002:infra` (4 suites, 35 pruebas): Jest las **omitió** (skipped). No se cuenta como regresión pasada.
- El flujo de GitHub con los cambios de esta fase (se verá al publicar).
- El arranque real con las 58 operaciones: sigue pendiente (T088). Hoy `crearAplicacionCompleta003` **falla a propósito** con «El router no coincide» porque aún no hay controladores; la prueba lo documenta.

### 6.4 Decisiones e incidencias
1. **Modificación acotada de dos flujos de 001 y 002.** `tecnologia/scripts/validar-001-ci.sh` y `.github/workflows/prestadores-catalogo.yml`: el de 002 ejecutaba `test:unit` y `test:architecture` sin filtro, así que habría capturado suites de la 003. Solo se añadieron exclusiones de `solicitudes-cotizaciones`. `usuarios-acceso.yml` no cambia (invoca el guion). Evidencia: `aislamiento-filtros.txt` (con `jest --listTests`) y `aislamiento-ci.spec.ts`.
2. **`componerExtensiones`** (nuevo, aditivo en `componer-openapi.ts`): componer tres documentos en cadena falla en Jest por prototipos de otro contexto en `isDeepStrictEqual`; la función serializa el resultado intermedio. `componerOpenApi` no cambia.
3. **`avisos_negocio`:** la prueba detectó que el `CHECK` de versión dejaba pasar `NULL` en avisos no de cierre; se corrigió antes de cerrar.
4. **`UnidadDeTrabajoPostgres` oculta el código SQLSTATE** (convierte todo error inesperado en 503). Por eso `reintento-concurrencia.ts` ofrece `traducirConflictoReintentable`, que los adaptadores de 003 deberán usar dentro de la transacción (T025 y siguientes).
5. **`nombresPublicos`** devuelve el nombre de cualquier perfil existente, publicable o no. Revisado después del informe: ver 7.1.
6. **Un primer intento de regresión** ejecutó por error todas las suites juntas (el intérprete de `npm` en Windows perdió las comillas del filtro `a|b`); se detuvo, se retiraron 19 bases temporales y se repitió llamando a Jest directamente. Los resultados de 6.2 son de la repetición limpia.
7. El workflow de la 003 ahora incluye contratos, arquitectura e integración de la 003; la regresión de 002 sobre 58 operaciones se añade en T089.

## 7. Revisión posterior a la Fase 2A (dos comprobaciones pedidas por el PO)

### 7.1 `nombresPublicos`: uso interno frente a exposición al usuario
- **Resultado: no hay vulnerabilidad dentro de T009–T024.** La 003 no registra ninguna ruta HTTP (`registroOferta003().controladores` es `[]`) y ningún archivo de `src` fuera de Prestadores referencia `nombresPublicos`. No existe camino por el que un usuario obtenga un nombre.
- **Qué es y qué no es la API.** Es una lectura interna entre módulos, no una respuesta. No filtra por `publicable` ni conoce a quien pregunta. Es deliberado: el autor de una cotización debe poder mostrarse al dueño de la solicitud aunque su perfil haya dejado de ser publicable; filtrar aquí lo ocultaría.
- **Cambio:** el comentario de la API declara «USO INTERNO» y la obligación del llamador, y la prueba `nombres-publicos-alcance.spec.ts` (4 pruebas) falla si cualquier caso de uso, adaptador o controlador la referencia antes de tiempo o si alguna presentación la usa.
- **Condición concreta que deberán cumplir las historias:**
  - **T084** (listado y comparación de cotizaciones de una solicitud): solo el **dueño** de la solicitud la invoca, solo con los `prestadorId` de las cotizaciones de **esa** solicitud en la página, nunca con identificadores del cliente. Debe actualizar `nombres-publicos-alcance.spec.ts` para admitir ese único consumidor.
  - **T080** (pruebas previas de T084): añadir un caso donde un tercero (ni dueño ni autor) obtiene 404 y no ve ningún nombre, y otro donde un prestador no ve nombres de otros autores.
  - **T064/T066 (oportunidades y detalle del prestador):** no la usan; si algún día lo hicieran, rige la misma condición.

### 7.2 Errores de concurrencia y `UnidadDeTrabajoPostgres`
- **Hallazgo confirmado con un interbloqueo real de PostgreSQL** (`reintento-con-unidad-de-trabajo.spec.ts`, 4 pruebas): la unidad de trabajo convierte todo error que no sea `ErrorAplicacion` en 503 `DEPENDENCIA_NO_DISPONIBLE`, perdiendo el 40P01. Un reintento **fuera** de la unidad de trabajo no vería el código.
- **Cómo se preserva:** dentro del trabajo, `traducirConflictoReintentable` convierte 40P01 y 40001 en `ConflictoReintentable` (un `ErrorAplicacion`, que la unidad de trabajo propaga intacto tras revertir), y `conReintentoDeConcurrencia` envuelve la **unidad de trabajo completa**. Demostrado: ambas operaciones en conflicto terminan (3 intentos en total); un conflicto persistente da 409 `CONFLICTO_CONCURRENTE` sin dejar filas; un error inesperado no se reintenta y responde el 503 genérico sin exponer el detalle.
- **No se modificó `UnidadDeTrabajoPostgres`** (es de 001 y su contrato lo usan 001 y 002).
- **Lo que depende de los adaptadores posteriores y debe ejecutarse allí:**
  - **T025:** los traductores de errores de cada módulo deben llamar a `traducirConflictoReintentable` en su `catch` dentro del trabajo, y traducir 23505 → `COTIZACION_EXISTENTE`, 23514 sobre contadores → `LIMITE_ARCHIVOS`, 55P03 (espera de bloqueo) → `CONFLICTO_CONCURRENTE` sin reintento. Pruebas unitarias de esa traducción.
  - **T054, T084 y demás casos de uso con escritura:** envolver `uow.ejecutar` con `conReintentoDeConcurrencia`, de modo que cada reintento abra su propia transacción.
  - **T070:** interbloqueos entre solicitudes y cotizaciones con el orden global de bloqueos.
  - **T091 (CA-ERR-01 a 03):** prueba de integración HTTP de punta a punta de un interbloqueo forzado.

### 7.3 Estado de verificación
- T001–T024 siguen marcadas `[x]`; T025 y siguientes, sin marcar.
- Las 4 suites de `test:integration:002:infra` (35 pruebas) siguen **omitidas por Jest y no verificadas**.
- Nuevas pruebas de esta revisión: 4 unitarias y 4 de integración. Integración 003: 5 suites, 61 pruebas, en verde.

## 8. Fase 2B (T025–T042): fundamentos propios de la 003

Commit base: `9afa0be` (CI #2 de la Fase 2A: SUCCESS, 2 min 37 s, informado por el PO). Evidencia local: `tecnologia/.local/evidencia/003/fase2b/`.

### 8.1 Qué se entregó
| Tarea | Resultado |
|---|---|
| T025 | `solicitudes/dominio/errores.ts` y `cotizaciones/dominio/errores.ts` con los códigos y estados del contrato; `compartido/dominio/condicion-bd.ts` y `compartido/infraestructura/postgres/traduccion-errores.ts` (`condicionDe`, `traducirErrorBd`, `conTraduccionBd`). 23505 sobre el índice único → `COTIZACION_EXISTENTE`; 23514 sobre un contador → `LIMITE_ARCHIVOS`; 55P03 → `CONFLICTO_CONCURRENTE`; 40P01 y 40001 → conflicto reintentable; todo lo demás se devuelve intacto. |
| T026, T027 | Esqueletos de `solicitudes` y `cotizaciones` con `api-publica.ts` y puertos. Solicitudes no importa otros módulos; Cotizaciones solo importa `solicitudes/api-publica`. |
| T028, T029 | Migración `1796000000001` (cinco tablas, disparadores, contadores). |
| T030, T031 | Migración `1796000000002` (tres tablas). |
| T032, T033 | `ApiCotizaciones` con `autoresNoRetirados`, `solicitudesConCotizacionNoRetirada` y `tieneNoRetirada`, una sentencia por llamada. |
| T034, T035 | `solicitudes/dominio/politica-acceso.ts`: política única de acceso y fotografías. |
| T036, T037 | `SolicitudesS3` sobre el bucket único, clave estricta, sin enlaces firmados. |
| T038, T039 | `SaneadorSharpSolicitudes` propio. |
| T040, T041 | Aislamiento con Garage real y `storage:init:003` (`scripts/inicializar-storage-003.ts`). |
| T042 | `test/soporte/solicitudes-cotizaciones/datos.ts` y `test:seed:003` (`scripts/seed-solicitudes-cotizaciones.ts`). Además `db:migrate:003` (`scripts/migrar-003.ts`). |

### 8.2 Resultados (2026-11-26, Node 24.15.0)
| Verificación | Resultado |
|---|---|
| Integración 003 completa | 11 suites, 157 pruebas |
| Unitarias del backend completo | 35 suites, 514 pruebas |
| Arquitectura | 3 suites, 8 pruebas |
| Contratos del backend (001, 002 y 003) | 19 suites, 219 pruebas |
| **Regresión 001, integración** | 12 suites, 129 pruebas |
| **Regresión 002, integración** (`test:integration:002`) | 17 suites, 165 pruebas |
| lint, typecheck, build | sin errores |
| Comandos reales sobre la base dedicada | `db:migrate:003` (20 migraciones, luego 0), `storage:init:003` (dos veces), `test:seed:003` (dos veces; la segunda no cambia nada) |

**No ejecutado:** `test:integration:002:infra` (4 suites, 35 pruebas, omitidas por Jest). El flujo de GitHub con estos cambios. La API HTTP de la 003 no existe aún (sin controladores). Ninguna prueba de navegador ni de rendimiento. No se tocó ningún archivo de 001 ni de 002 en esta fase.

### 8.3 Decisiones, incidencias y deuda
1. **T041 y «no crea bucket ni identidad».** En la composición real la 003 usa el bucket único existente con el prefijo `solicitudes/`, sin recursos nuevos, y este comando no se ejecuta allí. La Garage aislada de validación arranca vacía, así que `storage:init:003` aprovisiona **una vez** el equivalente del bucket único (`plataforma-003-validacion`) y una identidad de aplicación RW sin permiso de propietario, y comprueba el acceso al prefijo y la ausencia de acceso anónimo. Es idempotente y solo actúa sobre el contenedor 003. Duplica ~20 líneas de `inicializar-storage-002.ts` para no modificarlo. **Conviene que el PO confirme esta lectura.**
2. **T040: el aislamiento por aplicación se sostiene**, así que no se reabre la decisión de un bucket propio: acceso anónimo rechazado (401/403) en listar, leer, escribir y borrar; el adaptador rechaza claves ajenas; los adaptadores de 001 y 002 no leen, listan ni borran `solicitudes/`; la limpieza de 001, la limpieza de 002 (incluida una entrada hostil que nombra una clave de `solicitudes/`) y el respaldo de 002 dejan esos objetos intactos. Un inventario de respaldo que nombrara uno acaba INCOMPLETO. El respaldo se ejercitó con un origen PostgreSQL simulado, no con `pg_dump` real sobre Garage 003.
3. **Deuda técnica (T039):** `SaneadorSharpSolicitudes` duplica a propósito la lógica de `SaneadorSharp` de Prestadores (la constitución impide importar sus internos). Si cambia la política de imágenes, hay que cambiar ambos.
4. **Orden «pruebas primero».** Las pruebas de T028, T034, T036, T038 y T040 se escribieron antes de su implementación, pero solo se vio en rojo la de T030 (20 fallos sin la migración). Las demás pasaron en la primera ejecución con la implementación ya escrita, así que su valor probatorio se apoya en lo que verifican y no en haberlas visto fallar.
5. **Nombres de restricciones como contrato:** `solicitudes_archivos_cantidad_rango`, `solicitudes_archivos_bytes_rango`, `cotizaciones_unica_no_retirada`, `cotizaciones_aclaraciones_numero_unico` y `cotizaciones_aclaraciones_numero_rango` los usa el dominio para traducir errores; las migraciones y las pruebas los fijan.
6. **Reglas de modelo añadidas más allá del texto de las tareas** (a validar con el PO): transiciones de estado de solicitudes y archivos como disparadores; identidad de archivos inmutable; claves de objeto con los identificadores de la solicitud y del archivo; `ultimo_error` limitado a un código en mayúsculas; versiones consecutivas por disparador; `alcance` no vacío.
7. **Contratos de 002 con infraestructura:** una primera ejecución de `test:contract` falló en 14 pruebas porque no estaba levantada la infraestructura de 002; con ella arriba pasan las 219.
8. **Esperas de lectura/escritura:** `SolicitudesS3` fija 8 s por llamada y 10 000 000 bytes de lectura máxima.
9. **Workflow de 003:** ahora ejecuta `db:migrate:003`, `storage:init:003` y `test:seed:003` antes de las pruebas. No se ha ejecutado en GitHub.
10. **Pendiente para fases posteriores:** casos de uso, repositorios de escritura, controladores y frontend (Fase 3 en adelante). El ensamblador definitivo de 58 operaciones sigue pendiente (T088).

## 9. Fase 3 · US1 HU07 (T043–T059)

Rama `003-solicitudes-y-cotizaciones`, base `694aa65`. Se recuperaron 7 archivos rastreados con modificaciones y 24 archivos nuevos en el backend. Los casos de uso, repositorios, controladores y pruebas de US1 ya tenían avances. Se revisaron contra las tareas y se conservaron. El frontend de solicitudes se añadió durante esta continuación.

| Tareas | Implementación y verificación |
|---|---|
| T043–T045, T051–T052 | Versionado de control y trabajo, validación de la solicitud y fechas en America/Lima, avisos de texto libre y detección de datos personales. Pruebas unitarias de versionado, validación y datos personales. Las pruebas recuperadas ya coexistían con la implementación al comenzar la revisión. |
| T046, T053–T054 | Persistencia de solicitudes en PostgreSQL, paginación determinista con total por ventana, transacciones de cambios, elegibilidad de servicio y avisos atómicos. La suite de ciclo comprueba una escritura sobre un servicio que dejó de ser elegible, reintentos, versiones, idempotencia y cierre. |
| T047–T048, T055–T056 | Carga privada en tres tiempos, confirmación de la lista final, purga durable, limpieza periódica y control de pendientes, inventario y contadores. Las suites usan PostgreSQL y Garage reales. |
| T049–T050, T057 | Nueve operaciones HTTP de HU07 con esquemas OpenAPI y matriz de permisos. La composición de validación registra 49 operaciones activas (17 de 001, 23 de 002 y 9 de HU07). El contrato fuente y su espejo conservan las 18 operaciones previstas para 003. |
| T058–T059 | `/solicitudes`, `/solicitudes/nueva` y `/solicitudes/:id` usan la sesión existente. Se crea un borrador público o dirigido, se completan los datos, se muestran advertencias, se cargan y confirman fotos y se publica. Al editar se puede retirar una foto y consultar su referencia histórica, y al cerrar se conserva el historial. Playwright usa la aplicación real por HTTPS y datos ficticios. |

### 9.1 Correcciones durante la continuación

- Se corrigieron un literal roto en el arranque y la incompatibilidad entre el prefijo de Redis 003 y el adaptador de Catálogo. La composición adapta el prefijo para el adaptador y mantiene la instancia Redis aislada. Las solicitudes se consultan en PostgreSQL.
- Se inyectó el traductor de errores desde la composición para respetar las dependencias de la aplicación y preservar los conflictos PostgreSQL antes de que la unidad de trabajo revierta la transacción.
- La carga vuelve a verificar el estado bajo bloqueo antes de dejar un archivo preparado. Si el dueño cierra durante la escritura del objeto, responde 409, libera el cupo y elimina el objeto tardío. Una compensación conserva los archivos ya confirmados por otra operación.
- El control operativo detecta filas preparadas o confirmadas sin objeto y discrepancias de contadores, además de entradas vencidas, reintentos fallidos y objetos sin fila ni entrada. El reclamo de cada clave empieza al procesarla para aprovechar su arrendamiento de 120 s.
- La interfaz conserva la identidad visual de WasiMaki y usa el ancho disponible de la aplicación. El selector de archivos conserva su control nativo y el foco visible. Las fotografías se leen con Bearer y la vista previa usa una URL de objeto temporal.
- Se agregó la CA de validación 003 al almacén de confianza del usuario de Windows para ejecutar Playwright con verificación TLS. Los límites de 24 h, 300 s y 900 s describen caducidad lógica, intervalo de trabajo y umbral de control, respectivamente.

### 9.2 Inventario del árbol de trabajo frente a 694aa65

**Archivos rastreados con cambios**

- Documentación: `docs/trazabilidad.md`, `specs/003-solicitudes-y-cotizaciones/implementation-status.md` y `specs/003-solicitudes-y-cotizaciones/tasks.md`.
- Backend: `tecnologia/backend/package.json`, `src/composicion/{aplicacion-003,main,oferta-003}.ts`, `src/modulos/solicitudes/dominio/{archivos,errores}.ts` y `test/unit/solicitudes-cotizaciones/esqueleto-modulos.spec.ts`.
- Frontend: `tecnologia/frontend/src/composicion/App.tsx`.

**Archivos nuevos**

- Backend, scripts y composición: `scripts/solicitudes-limpiar-003.ts`, `scripts/solicitudes-verificar-003.ts` y `src/composicion/solicitudes-003.ts`.
- Backend, módulo `src/modulos/solicitudes/`: `dominio/{datos-personales,fechas,solicitud,version}.ts`, `aplicacion/{archivos-solicitud,solicitudes}.ts`, `aplicacion/puertos/repositorios.ts`, `infraestructura/archivos/limpieza-solicitudes.ts`, `infraestructura/persistencia/{archivos,solicitudes}.ts` y `presentacion/solicitudes.controller.ts`.
- Backend, pruebas bajo `test/**/solicitudes-cotizaciones/`: `unit/{datos-personales,validacion-solicitud,versionado-solicitud}.spec.ts`, `integration/{archivos-solicitud,ciclo-solicitudes,limpieza-solicitudes,seguridad-solicitudes}.spec.ts`, `contract/solicitudes.spec.ts` y `soporte/{contrato-003,entorno-http}.ts`.
- Frontend: `src/composicion/solicitudes-cotizaciones.ts` y, bajo `src/features/solicitudes-cotizaciones/`, `aplicacion/edicion.ts`, `infraestructura/api-solicitudes.ts`, `modelos/contratos.ts`, `presentacion/{EditorSolicitud,Fotografias,Historial,ListaSolicitudes,SeleccionPrestador}.tsx` y `presentacion/solicitudes.css`.
- Frontend, pruebas: `test/unit/solicitudes-cotizaciones/editor.test.tsx` y `test/e2e/solicitudes-cotizaciones/us1.spec.ts`.

### 9.3 Verificación local del 26 de noviembre de 2026

Node 24.15.0. PostgreSQL 18, Garage, Redis para Catálogo, correo de prueba y Caddy HTTPS del entorno aislado. Evidencia ignorada por Git en `tecnologia/.local/evidencia/003/us1/`.

| Comprobación | Resultado y evidencia |
|---|---|
| Jest unitario del backend | 634 aprobadas en 38 suites, con 274 pruebas de 003 en 14 suites. `backend-unit-junit.xml`. |
| Cobertura Jest unitaria | Dominio de Solicitudes, 162/179 líneas (90,50 %) y 197/224 ramas (87,95 %). Backend global, 1506/3326 líneas (45,28 %) y 1448/3431 ramas (42,20 %). `cobertura/lcov.info`. La cobertura corresponde a unitarias. |
| Integración real 003 | 280 casos verificados en 15 suites entre la ejecución y la repetición de Prestadores. La serie final aprobó 279/280 y todas las pruebas de HU07. La preparación de 50 perfiles de FR-343 agotó el plazo de conexión de 1,5 s. La suite de Prestadores aprobó 13/13 tras repetir con `synchronous_commit=off` solo para las conexiones de su base temporal ficticia. `backend-integration-junit.xml` y `reintento-prestadores-local/backend-integration-junit.xml`. |
| Arquitectura PR12 | 8 aprobadas en 3 suites. `backend-architecture-junit.xml`. |
| OpenAPI 003 | 37 aprobadas en 2 suites, incluidas las nueve operaciones de HU07 y el inventario de arranque. |
| Contratos completos 001, 002 y 003 | 239 aprobadas en 20 suites, incluidas las 37 de 003. `regresiones-final/backend-contract-junit.xml`. |
| Regresión ordinaria de integración 001 y 002 | 294 aprobadas en 29 suites. `regresiones-final/backend-integration-junit.xml`. Se repitió tras tiempos de espera y recuperación de PostgreSQL durante ejecuciones simultáneas. La repetición se hizo después de los contratos, con `synchronous_commit=off` limitado a las conexiones ficticias de prueba. |
| Vitest completo | 185 aprobadas en 20 archivos, con 5 casos nuevos del editor. `frontend-junit.xml`. La repetición se ejecutó con un trabajador y un límite de 15 s por prueba, después de tiempos de espera en ejecuciones concurrentes. |
| TypeScript, ESLint y build | Aprobados en backend y frontend. |
| Control operativo de archivos | `solicitudes:verificar:003` salió con código 0 y cero hallazgos sobre la base ficticia. `control-limpieza.txt`. |
| Playwright sobre la aplicación real | 18 aprobadas en 9 proyectos. Chromium, Firefox y WebKit a 360, 768 y 1366 px. `web-final/playwright-junit.xml` y `web-final/playwright.json`. |
| Ajuste del selector de distrito | 3 recorridos dirigidos aprobados en Chromium a 360, 768 y 1366 px tras ampliar el campo. `web-ubicacion/playwright-junit.xml`. |

Los recorridos de navegador cubrieron borrador vacío, descripción superior al máximo, rechazo por teléfono en texto, aviso de falta de cobertura, rechazo de una imagen inválida, carga y lectura de una imagen válida, publicación, edición, retirada de una foto, historial, cierre y filtro del listado. Se verificó el foco por Tab y la apertura del historial con Enter. Cada captura comprueba el ancho del documento contra el viewport.

Las 54 capturas de la matriz están en `web-final/capturas/<navegador>-<ancho>/`. Se revisaron visualmente el formulario, la fotografía confirmada, las advertencias de una dirigida, el historial y el listado. Las tres capturas del selector ajustado están en `web-ubicacion/capturas/chromium-<ancho>/06-dirigida.png`.

**Punto de verificación de HU07.** T043–T059 comprobadas y marcadas. La aplicación de validación respondió 200 en `/solicitudes` y `/api/v1/salud` por HTTPS. El árbol de trabajo sigue en `003-solicitudes-y-cotizaciones` sobre `694aa65`.

Se detuvieron los contenedores iniciados para las regresiones de 001 y 002 y se conservaron sus volúmenes. La aplicación de validación 003 quedó disponible por HTTPS en el puerto 8447.

### 9.4 Límites del punto de verificación

- La ejecución de GitHub Actions #3 corresponde a la Fase 2B según lo informado por el Product Owner. Los resultados de esta sección proceden de ejecuciones locales de HU07.
- Las 35 pruebas de infraestructura de 002 siguen sin verificarse. La matriz PR04 completa, la parte de CA-ARC-04 para prestadores solamente compatibles, la observación con cinco participantes de PR06, el recorrido en celular físico de PR07 y las pruebas de carga y respaldo de 003 corresponden a tareas posteriores.
- El contrato de edición permite omitir un dato y reemplazarlo por otro valor válido. La interfaz informa cuando se intenta vaciar un dato ya guardado, dado que ese contrato carece de una operación para asignar nulo.

## 10. Revisión para aprobación de HU07

### 10.1 Estabilidad de la integración 003

El JUnit de la ejecución 279/280 identifica el caso `nombresPublicos › usa una sola consulta por página, sea cual sea su tamaño (FR-343)`, en `api-prestadores-lecturas.spec.ts`. El fallo fue `timeout exceeded when trying to connect` de `pg-pool`, a los 1,504 s. La preparación lanzaba 50 inserciones simultáneas contra un pool de seis conexiones con un plazo de adquisición de 1.500 ms.

La preparación usa ahora una sola inserción de 50 perfiles, fuera del contador. El caso conserva la medición de una sentencia para páginas de 1, 10 y 50 perfiles y compara los identificadores y nombres devueltos con los datos persistidos. El cambio se limita al archivo de prueba.

El ajuste del informe anterior se pasó mediante `PGOPTIONS=-c synchronous_commit=off` al proceso de repetición. El cliente `pg` toma esa variable como opciones de inicio de cada conexión del proceso. Con `off`, PostgreSQL puede confirmar al cliente antes de forzar el WAL a disco. Por eso aquella repetición aislada no acreditaba por sí sola la ejecución con las garantías de confirmación predeterminadas. El workflow `validar-003` fija Node 24.15.0, genera la configuración, levanta los servicios de Compose, migra, inicializa Garage, siembra datos ficticios y ejecuta `test:integration:003` con dos trabajadores. Los archivos de configuración de la aplicación, Compose y el workflow conservan sus valores versionados.

Una sonda sobre el PostgreSQL desechable usó la fábrica de conexiones de la aplicación antes y después de abrir una conexión hija con `PGOPTIONS`. Leyó `synchronous_commit=on` (origen `default`) en ambos pools y `off` (origen `client`) solo en la hija. `fsync` y `full_page_writes` se mantuvieron en `on` en las tres lecturas. La evidencia está en `tecnologia/.local/evidencia/003/us1/aprobacion-ci/durabilidad-sesiones.json`. [PostgreSQL 18 · Confirmación síncrona](https://www.postgresql.org/docs/18/runtime-config-wal.html#GUC-SYNCHRONOUS-COMMIT).

**Resultado final del 26 de noviembre de 2026:** `test:integration:003` obtuvo **280/280 casos en 15/15 suites** en una sola ejecución de 108,15 s, con dos trabajadores y `PGOPTIONS` ausente. Se reprodujo localmente el paso de integración del workflow con Node 24.15.0, dependencias instaladas con el lockfile y los servicios e imágenes de Compose sobre volúmenes nuevos. Se verificó la configuración, se aplicaron 20 migraciones, se inicializó el bucket privado y se sembraron datos ficticios. Se usó un nombre de proyecto desechable y el nombre de Garage que esperan los scripts. Se retiraron los volúmenes del ensayo y se restauró la validación 003 original. El job alojado de GitHub Actions queda pendiente de ejecución.

La primera copia de ensayo bajo `.local` no permitió a Jest descubrir las pruebas en Windows. La copia trasladada a `tecnologia/build/ci003-aprobacion` descubrió las 15 suites. El primer ensayo de integración en esa ruta aprobó FR-343 y 252 casos en 14 suites. La suite de archivos quedó sin completar tras cuatro terminaciones del proceso trabajador de Jest. La repetición completa con el mismo comando y volúmenes nuevos aprobó las 15 suites, incluida la de archivos. El informe y la consola finales están en `tecnologia/.local/evidencia/003/us1/aprobacion-ci-repeticion/backend-integration-junit.xml` y `tecnologia/.local/evidencia/003/us1/aprobacion-ci-repeticion/consola.txt`.

### 10.2 Revisión visual y funcional de HU07

Playwright ejecutó los recorridos público y dirigido en Chromium, Firefox y WebKit a 360, 768 y 1366 px. La matriz obtuvo 17/18. El caso público de Firefox a 1366 px agotó el plazo durante el cierre del contexto del navegador y pasó en la repetición aislada (1/1). Los informes están en `tecnologia/.local/evidencia/003/us1/aprobacion-web/playwright-junit.xml` y `tecnologia/.local/evidencia/003/us1/aprobacion-web-firefox/playwright-junit.xml`.

La inspección de las tres capturas representativas confirmó la identidad existente de WasiMaki, formularios legibles, el nombre completo del distrito largo y controles visibles sin superposición. Las comprobaciones de ancho compararon el documento con el viewport. Se verificaron la validación asociada al campo, los estados de guardado, publicación y cierre, el foco visible con Tab, la apertura del historial con Enter y las acciones reales de carga y retiro de fotografías. La revisión se cerró sin cambios de interfaz.

Una comprobación adicional observó el estado de carga del listado, reprodujo un 503 controlado y verificó un reintento real con 200. Sobre la misma fotografía, el titular recibió 200 con `Cache-Control: no-store`, el cliente sin sesión recibió 401 y otra cuenta recibió 404. El borrador ficticio se descartó por la interfaz. Evidencia en `tecnologia/.local/evidencia/003/us1/aprobacion-web/estados-y-privacidad.json`.

| Ancho CSS | Captura desde la raíz del repositorio |
|---|---|
| 360 px | `tecnologia/.local/evidencia/003/us1/aprobacion-web/capturas/chromium-360/03-publicada.png` |
| 768 px | `tecnologia/.local/evidencia/003/us1/aprobacion-web/capturas/chromium-768/06-dirigida.png` |
| 1366 px | `tecnologia/.local/evidencia/003/us1/aprobacion-web/capturas/chromium-1366/04-cerrada.png` |

### 10.3 CA local de Windows

Se comprobó que `Ayacucho Validacion Local 003 CA` sigue en el almacén personal de raíces de confianza (`CurrentUser\Root`). Su huella es `1AFF0BAF5415118AA464AD297AFCA5DC4F30483C`. Cuando deje de usarse la validación HTTPS de 003, ejecutar con la misma cuenta de Windows. El primer comando comprueba la entrada y el segundo retira únicamente esa huella del almacén del usuario.

```powershell
certutil.exe -user -store Root 1AFF0BAF5415118AA464AD297AFCA5DC4F30483C
certutil.exe -user -delstore Root 1AFF0BAF5415118AA464AD297AFCA5DC4F30483C
```

Para verificar la retirada, repetir la consulta `-store` y comprobar que ya no encuentra esa huella. La confianza se mantuvo durante esta revisión. Los anchos se comprobaron en navegadores de escritorio con viewport configurado. La prueba en un teléfono físico permanece pendiente.

[Microsoft Learn · Certutil y almacenes de certificados](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil#-delstore).

## 11. Fase 4 · US2 HU08 (T060–T067)

**Estado:** T060–T067 completadas y marcadas. Sin `git add`, `commit` ni `push`: los cambios están solo en el árbol de trabajo sobre `99a7cb1`. GitHub Actions **no** se declara aprobado para US2 porque no está publicada.

### 11.1 Trabajo de Codex recuperado

Codex dejó, sin commit, las pruebas T060–T062 y la implementación T063–T065 casi completa. Se revisó el diff completo y se conservó íntegro:

- `OportunidadesServicio` (aplicación) con una **decisión única de acceso** (`decidir`) que reutiliza `decidirAcceso`, la compatibilidad (categorías cubiertas de Catálogo + distritos de Prestadores) y la autoría de Cotizaciones. El detalle, el historial y la ruta de la fotografía la consumen todos; se eliminó la copia anterior (`decidirComoPrestador` y el bloque propio de `archivos-solicitud.ts`).
- `RepositorioOportunidadesPostgres`: página y total por ventana en una sola sentencia; las ramas «publicadas compatibles» y «dirigidas al destinatario» son disjuntas.
- `GET /solicitudes/oportunidades` registrado antes de `/{solicitudId}`; rama `rol=prestador` del listado.
- Pruebas: `oportunidades.spec.ts` (integración y contrato) y `solicitudes-prestador.spec.ts`.

Lo que **faltaba** y se completó: pruebas HTTP de 401, no compatible, ajeno, borrador y respuesta opaca idéntica a un identificador inexistente; pruebas de revocación (cierre y pérdida de compatibilidad, en detalle y fotografía); toda la parte web (T066) y su evidencia (T067).

### 11.2 Funcionalidad entregada

Recorrido del prestador (rutas `/prestador/oportunidades`, `/prestador/solicitudes`, `/prestador/solicitudes/{id}`, con el mismo control de perfil y la misma navegación lateral que Mis servicios):

1. **Oportunidades**: publicadas ABIERTAS compatibles y dirigidas abiertas; etiqueta de tipo, categoría, distrito, periodo y estado de fotografías («Sin fotografías», «compartidas», «no compartidas por el cliente»); paginación; estados de carga, vacío (con enlaces reales a servicios y perfil), error con reintento.
2. **Solicitudes recibidas** (`rol=prestador`): dirigidas al prestador en cualquier estado salvo borrador y solicitudes con su cotización no retirada, también cerradas; filtro por estado sin «Borrador»; etiquetas de título.
3. **Detalle de solo lectura**: títulos de acceso, aviso de solicitud cerrada, medidas, fotografías según la política del servidor, historial de versiones solo si es destinatario o autor. Un acceso denegado muestra un mensaje que no distingue entre «no existe» y «sin acceso». Si el cliente abre su propia solicitud aquí, se le remite a su editor.

### 11.3 Reglas verificadas (backend)

El acceso se decide en el servidor; la interfaz solo presenta lo recibido. Verificado con PostgreSQL y Garage reales: compatible (categoría + distrito + servicio publicado y clasificaciones activas) ve la publicada; no compatible, otro cliente, destinatario distinto y cuenta sin perfil reciben 404/403 según corresponda y un cuerpo 404 idéntico al de un identificador inexistente; sin sesión, 401 en detalle y fotografía; el borrador solo lo ve su dueño; la fotografía de una publicada no compartida y la de una dirigida a otro prestador devuelven 404; cerrar la solicitud o pausar el servicio revoca detalle y fotografía en la petición siguiente; la autoría vigente conserva la lectura; ninguna respuesta incluye identificadores ni datos del cliente ni claves de almacenamiento.

### 11.4 Pruebas (26–27 de noviembre de 2026)

Runtime: Node 24.15.0 del toolchain del proyecto, desde PowerShell. (Git Bash usa Node 22 y su `cwd` en minúscula hace fallar Vitest; las primeras ejecuciones de Jest de esta fase se hicieron con Node 22 y **se repitieron** con 24.15.0.)

| Comprobación | Resultado |
|---|---|
| `tsc`, `eslint --max-warnings=0`, `build` del backend | Sin errores |
| `tsc` y `eslint --max-warnings=0` del frontend | Sin errores |
| Jest unitario del backend | 634/634, 38 suites |
| Arquitectura | 8/8, 3 suites |
| Integración 003 completa (`test:integration:003`) | **289/289, 17/17 suites**, una sola ejecución de 98,4 s |
| Contrato 003 | Tras la corrección de la incidencia 3, con Node 24.15.0: **40/40 en 3/3 suites** (antes de ella, 38/39). |
| Integración 003 tras la corrección | **289/289, 17/17 suites**, una sola ejecución de 144,6 s |
| Build del frontend (`npm run build`) | Correcto: tsc y Vite, 79 módulos |
| Vitest 003 | 23/23, 3 archivos (11 casos nuevos en `prestador.test.tsx`). `us2/vitest-junit.xml` |
| Playwright `us2.spec.ts`, Chromium a 360, 768 y 1366 px | 6/6 sobre la aplicación real (HTTPS 8447). `us2/web-chromium/` |

### 11.5 Evidencia visual

Capturas de las siete pantallas a los tres anchos en `tecnologia/.local/evidencia/003/us2/web-chromium/capturas/chromium-{360,768,1366}/` (10 a 16). Cada captura comprueba que el documento no excede el viewport. Se revisaron visualmente oportunidades (360), detalle con fotografía (1366) y dirigida cerrada con historial (768). Se verificó la apertura de un detalle con Enter desde el enlace enfocado.

### 11.6 Incidencias y correcciones

1. **Fechas desplazadas un día** (hallada en la revisión con la app real): `2031-03-10` se mostraba como «9 mar.» al interpretarse como instante UTC y formatearse en Lima. Se creó `fechaCalendario` (UTC) y una prueba. El editor de US1 usa `<input type=date>` y no está afectado.
2. **Nombre accesible del enlace** con un espacio espurio («Ver detalle : …»): se sustituyó el texto oculto por `aria-label`.
3. **Contrato 413 de US1 (corregido).** `solicitudes.spec.ts` fallaba con `read ECONNRESET` en 3 de 3 ejecuciones con Node 24.15.0 (a los 7 ms, en la primera petición: JSON de 70 000 bytes frente a un límite de 65 536). **Causa exacta:** en `configurar-api.ts`, el rechazo anticipado por `Content-Length` enviaba el 413 y solo después llamaba `req.resume()`. Con el cuerpo de la petición sin leer, Node cierra el socket con un reinicio (RST) al terminar la respuesta y el cliente pierde el 413. No dependía de OpenAPI ni de las fotografías. **Corrección** (solo `rechazarCuerpoGrande` en `configurar-api.ts`): el cuerpo se descarta, sin almacenarlo ni interpretarlo, y se responde al terminar de recibirlo, si el tamaño declarado es de hasta 1 MiB; por encima se responde de inmediato con `Connection: close` sin leer nada, de modo que un cliente no puede forzar lecturas arbitrarias. Los límites (65 536 B, 14 000 000 B y 10 MB de imagen decodificada), el esquema del error y el contrato OpenAPI no cambiaron, ni la versión de Node. **Prueba nueva** en el contrato: 413 íntegro con cuerpos de 70 000 y 900 000 bytes y comprobación de que el servicio sigue atendiendo. **Resultado:** 3 de 3 ejecuciones de `solicitudes.spec.ts` con 20/20 (antes 19/20), y la suite 003 completa abajo. El rechazo de imágenes de más de 10 MB y la carga válida siguen cubiertos por las pruebas existentes de contrato e integración, que pasan. **Límite:** el camino de más de 1 MiB declarados responde de inmediato y, ante clientes que siguen enviando, el servidor puede cortar la conexión; no se prueba automáticamente.
4. **Prueba de US1 actualizada**: `seguridad-solicitudes.spec.ts` esperaba `['AUTOR_DE_COTIZACION']` para Beto porque la compatibilidad aún no se evaluaba. Ahora es también compatible y la lectura devuelve `['COMPATIBLE','AUTOR_DE_COTIZACION']`, como establece la spec.
5. **Servidor de validación obsoleto**: el API del puerto 3004 (iniciado a las 17:50) respondía 400 en `/solicitudes/oportunidades`. Con autorización del PO se detuvo y se reinició con el código actual y Node 24.15.0 (log en `.local/003/backend-us2.log`). Volumen y contenedores intactos.
6. Un intento de test de contratos 001/002 con `npm run test:contract` global falla por `ECONNREFUSED 127.0.0.1:54329` (infraestructura de 001 apagada), no por US2.

### 11.7 Limitaciones y verificaciones pendientes

- **Firefox y WebKit no se ejecutaron**: no están instalados en este equipo para la versión actual de Playwright. La matriz de nueve proyectos corresponde a T102.
- Las 35 pruebas de infraestructura de 002 siguen **sin verificar**. No se ejecutaron los contratos 001/002 ni su regresión en esta fase.
- Cobertura Jest, k6 y pruebas de carga no se ejecutaron (fuera de T060–T067).
- El «presupuesto de sentencias» (CP-306) se verificó con el contador de pruebas de integración para oportunidades y recibidas; la carga con k6 queda para la fase de calidad.
- La «cobertura de CA-ARC-04 para prestadores solo compatibles» queda cubierta por las pruebas HTTP de `solicitudes-prestador.spec.ts`.
- CI de GitHub Actions: no ejecutada para estos cambios.


## 12. Fase 5 · US3 HU10 (T068–T079)

**Rango exacto:** T068–T072 (pruebas primero), T073–T077 (backend), T078 (web) y T079 (punto de verificación). Las 12 quedan marcadas `[x]`. Sin `git add`, `commit` ni `push`. El resultado de GitHub Actions de US2 **no** se ha verificado en esta sesión y no se afirma.

### 12.1 Funcionalidad entregada

- **Dominio** (`cotizaciones/dominio/cotizacion.ts`): datos obligatorios por tipo (estimada: alcance, vigencia y precio o forma de cálculo; definitiva: además precio, plazo y condiciones de pago), precio en céntimos (entero > 0, hasta 2^53 − 1), vigencia futura, estado efectivo con la prioridad RETIRADA > VENCIDA > PENDIENTE_REVISION > VIGENTE, indicadores y motivos de no aceptabilidad. No produce estados de la 004.
- **Persistencia** (`RepositorioCotizacionesPostgres`): versiones inmutables, `FOR UPDATE` por identificador, listado paginado con total por ventana (una sentencia) y unicidad de la posición no retirada por el índice parcial (`COTIZACION_EXISTENTE`).
- **Casos de uso** (`CotizacionesServicio`): enviar, actualizar, retirar, mis cotizaciones y detalle, con idempotencia, reintento acotado y el orden de bloqueos del plan (idempotencia → revisión de Catálogo → solicitud `FOR SHARE` → cotización `FOR UPDATE`).
- **API**: `enviarCotizacion003`, `listarMisCotizaciones003`, `obtenerCotizacion003`, `actualizarCotizacion003` y `retirarCotizacion003`, registradas junto a HU07 y HU08. El listado de cotizaciones de una solicitud, las aclaraciones y la comparación son de HU11 y no se implementaron. No se usa `nombresPublicos`: `prestadorNombrePublico` se añadirá en HU11 tras comprobar el título del cliente.
- **Política única de acceso**: `coincideConCobertura` y `tituloParaCotizar` en `solicitudes/dominio/politica-acceso.ts`; las usan Oportunidades (HU08) y Cotizaciones. Cotizaciones solo importa `solicitudes/api-publica`; sus demás dependencias son puertos que conecta `composicion/cotizaciones-003.ts`.
- **Frontera con la 004** (solo lectura): `ApiCotizacionesVigentes.obtenerVigente(cotizacionId, versionCotizacion, tx)` con `motivosNoAceptable`, y `ApiSolicitudes.validarClienteYDisponibilidad(solicitudId, actorCuentaId, tx)`. No existe selección, aceptación ni contratación; el contrato futuro de la 004 queda escrito como 3 pruebas `todo`.
- **Web** (`/prestador/solicitudes/{id}` con el panel «Tu cotización», `/prestador/solicitudes/{id}/cotizar`, `/prestador/cotizaciones`, `/prestador/cotizaciones/{id}` y `/actualizar`): formulario por tipo con requisitos dinámicos, importe en soles convertido a céntimos sin coma flotante, vigencia como fecha de Lima, errores junto al campo con foco en el primero, prevención de doble envío, clave de idempotencia reutilizada en reintentos, conservación de lo escrito, estados «Vigente», «Vencida», «Requiere revisión» y «Retirada» con su explicación y sin afirmar que se avisó a nadie, versiones anteriores y retiro con confirmación. El transporte HTTP se extrajo a `infraestructura/transporte.ts` sin cambiar su comportamiento.

### 12.2 Reglas verificadas (PostgreSQL y Garage reales)

Compatible o destinatario cotiza; no compatible, sin servicio publicado, no destinatario y borrador ajeno reciben el mismo 404 que un identificador inexistente y no se crea nada; sin sesión 401; sin perfil de prestador 403; la propia solicitud, 422 `COTIZACION_PROPIA`; versión de trabajo anterior, 409 `SOLICITUD_MODIFICADA`; solicitud cerrada, 409 `SOLICITUD_NO_ABIERTA` (envío, actualización y retiro); un cambio relevante deja la cotización pendiente de revisión y un cambio de privacidad no; vencida sigue ocupando la posición; retirar es terminal y reenviar crea otra identidad con las versiones anteriores intactas; perder la compatibilidad no impide leer, actualizar ni retirar; retirar sin los otros títulos quita el acceso a la solicitud y conserva la lectura de la cotización; servicio retirado tras publicar una dirigida (CA-SOL-08); avisos registrados una sola vez por interesado (CA-AVI-04); idempotencia con la misma clave y con otros datos; ninguna respuesta incluye cuentas, correos ni contacto. Concurrencia (4 rondas por pareja): dos envíos del mismo prestador, cierre/envío, edición/envío, retiro/actualización, retiro/reenvío, misma clave a la vez (5 peticiones) y una mezcla de 9 operaciones, sin bloqueos y sin dos posiciones no retiradas.

### 12.3 Pruebas (26–27 de noviembre de 2026, Node 24.15.0, PowerShell)

| Comprobación | Resultado |
|---|---|
| `tsc`, `eslint --max-warnings=0` y `build` del backend | Sin errores |
| Jest unitario | 650/650, 39 suites (16 casos nuevos del dominio) |
| Arquitectura | 8/8, 3 suites |
| Contrato 003 | 56/56, 4 suites (16 casos nuevos) |
| Integración 003 completa | 320 aprobadas y 3 `todo`, 20/20 suites, una sola ejecución de 121 s (31 casos nuevos: ciclo 19, concurrencia 7, frontera 5) |
| `tsc`, `eslint` y `npm run build` del frontend | Sin errores |
| Vitest | 223/223, 23 archivos (31 casos nuevos), con 1 trabajador y 15 s por prueba. Con los valores por defecto, la primera ejecución tuvo 3 timeouts en pruebas de 002 (`navegacion-compuesta` y `selector-y-navegacion`, 5–7 s); no son de US3 |
| Playwright `us3.spec.ts`, Chromium a 360, 768 y 1366 px | 9/9 sobre la aplicación real (HTTPS 8447), repetido tras el ajuste visual |

### 12.4 Evidencia visual

Capturas 20 a 33 a los tres anchos en `tecnologia/.local/evidencia/003/us3/web-chromium/capturas/chromium-{360,768,1366}/` (formulario, errores, detalle vigente, requiere revisión, actualizar, versiones, mis cotizaciones, confirmar retiro, retirada, vencida, solicitud cerrada, sin cambios, sin título y cotización ajena). Cada captura comprueba que el documento no excede el viewport. Revisadas a ojo: formulario con errores (360), requiere revisión (1366) y mis cotizaciones (768 y 360).

### 12.5 Incidencias y correcciones

1. **Bloqueo con JOIN** (hallada por la prueba de concurrencia): `SELECT … JOIN … FOR UPDATE OF c` volvía a evaluar el JOIN con la versión vigente anterior tras esperar el bloqueo y devolvía 0 filas (404 falso al actualizar y retirar a la vez). Se separó el bloqueo (`FOR UPDATE` solo de la fila) de la lectura de la versión vigente.
2. **TypeORM no devuelve las filas de un `UPDATE … RETURNING`**: se leyó la versión antes de actualizar (la fila ya está bloqueada).
3. **Arquitectura**: la prueba de US1 exige que `solicitudes/api-publica.ts` no mencione repositorios y `dependency-cruiser` rechaza ciclos. `ApiSolicitudes` vive en `solicitudes/aplicacion/api-solicitudes.ts` y la conecta la composición, sin debilitar ninguna prueba.
4. **Prueba propia**: un servicio retirado es de solo lectura; CA-SOL-08 usa a Darío para no contaminar los demás casos.
5. **Defecto visual** (revisión de capturas): una estimada sin precio mostraba «No indicado» como titular y las tarjetas no distinguían los trabajos. Ahora dice «Precio por definir», muestra la forma de cálculo y un extracto del alcance.
6. **Aborto nativo de Node** (`0xC0000409`) en una ejecución del contrato 003 tras dos suites aprobadas; dos repeticiones completas dieron 56/56. Una repetición satisfactoria **no** equivale a una primera ejecución limpia: queda como intermitencia del anfitrión sin causa identificada.
7. **Entorno**: Docker Desktop estaba apagado. Se arrancó, se iniciaron los 5 contenedores de la validación 003 (`docker start`, sin tocar volúmenes) y se relanzaron el API (3004) y Vite (5177).

### 12.6 Limitaciones y verificaciones pendientes

- Firefox y WebKit no se ejecutaron (no instalados): la matriz de nueve proyectos es de T102.
- Las 35 pruebas de infraestructura de 002 siguen **sin verificar**; no se ejecutaron los contratos ni la regresión de 001 y 002.
- No se ejecutaron cobertura Jest, k6 ni cargas (fuera de US3).
- El contrato no ofrece una consulta de «mi cotización de esta solicitud»: la web recorre «mis cotizaciones» hasta 10 páginas para encontrarla.
- CI de GitHub Actions: no ejecutada para US3; el resultado de US2 no se ha verificado.


## 13. Corrección de la regresión de 001 en la CI de US2 (commit `2398681`)

**Estado de la CI remota: NO aprobada.** El trabajo «Regresión de compatibilidad con 001 y 002» del commit `2398681` terminó cancelado. Hasta que haya una nueva ejecución satisfactoria en GitHub Actions no se declara aprobado. Lo que sigue son resultados locales.

### 13.1 Causa identificada (reproducida)

La causa fue **mi corrección del 413 de la sección 11.6 (incidencia 3)**, no la infraestructura ni una prueba inestable. Esa corrección hacía que el rechazo anticipado por `Content-Length` esperase el evento `end` del cuerpo antes de responder, para evitar `ECONNRESET` en la prueba de 003. El contrato de 001 (`test/contract/usuarios-acceso/openapi.spec.ts`, `X-08 … límites de transporte`) comprueba el límite enviando `Content-Length: máximo + 1` **sin cuerpo**, porque «el límite de cabecera se decide antes de leer el stream». El `end` nunca llegaba: la petición quedaba sin respuesta hasta el timeout de 45 s de cada caso parametrizado, los recursos abiertos provocaban el timeout de 30 s de `afterAll` y el aviso «Jest did not exit one second after the test run has completed», y el trabajo se cancelaba por duración. Eran 126 pruebas de contrato de 001: 15 fallidas y 111 aprobadas en la CI, el mismo total que hoy.

**Evidencia.** Con Node 24.15.0 y la infraestructura local de 001 (PostgreSQL 54329 sembrado), la ejecución de `usuarios-acceso/openapi` con el código de US2 **no terminó en 240 s** y hubo que detener el proceso. Con la corrección, la misma suite aprobó 20/20 con código de salida 0.

### 13.2 Corrección

Archivo de producción modificado: `tecnologia/backend/src/compartido/infraestructura/http/configurar-api.ts` (función `rechazarCuerpoGrande`).

- Hasta 1 MiB declarado: se descarta el cuerpo (nunca se almacena ni interpreta) y se responde al terminar de recibirlo **o, como máximo, tras 250 ms** (`ESPERA_DE_CUERPO_MS`). Un cliente que cumple el protocolo termina antes; uno que declara una longitud y no envía nada, o que envía muy despacio, no puede retener la respuesta. El temporizador es `unref` y se cancela al terminar o cerrarse la petición, de modo que no deja recursos abiertos.
- Por encima de 1 MiB: respuesta inmediata con `Connection: close`, sin leer nada.
- No se subió ningún timeout de Jest, no se usó `--forceExit`, no se cambió la versión de Node, no se modificó ninguna respuesta ni se retiró ninguna prueba. El límite de 250 ms está justificado arriba: es una espera acotada de cortesía, no una holgura de pruebas.

Archivo de prueba modificado: `test/integration/solicitudes-cotizaciones/frontera-004.spec.ts`. Durante la verificación apareció una **intermitencia propia de US3** (1 de cada 16): una consulta de «cotización inexistente» sustituía el último carácter de un UUID por `0`, y si ya era `0` consultaba la misma cotización. Se usa ahora `randomUUID()`.

### 13.3 Pruebas (27 de noviembre de 2026, Node 24.15.0 del toolchain, equivalentes al workflow)

| Comprobación | Resultado |
|---|---|
| 001 · unitarias (`usuarios-acceso\|fundacion`) | 160/160, 9 suites |
| 001 · contratos | **126/126, 11 suites**, salida 0 (antes de la corrección: no terminaba) |
| 001 · integración (`--runInBand`) | 129/129, 12 suites, 85 s, salida 0, sin aviso de «did not exit» |
| 002 · contratos (`prestadores-catalogo`) | 76/76, 7 suites |
| 002 · integración (`test:integration:002`, sin las suites de infraestructura) | 165/165, 17 suites |
| 003 · 413 de `solicitudes.spec.ts` (3 repeticiones) | 21/21 en las 3 |
| 003 · `tsc`, `eslint --max-warnings=0`, `build` | Sin errores |
| 003 · unitarias | 650/650, 39 suites |
| 003 · arquitectura | 8/8, 3 suites |
| 003 · contratos | 56/56, 4 suites |
| 003 · integración | 320 aprobadas y 3 `todo`, 20/20 suites (la ejecución previa a corregir la intermitencia de `frontera-004` tuvo 1 fallo y 319) |

El workflow `solicitudes-cotizaciones.yml` no se modificó: ejecuta exactamente las mismas órdenes que se reprodujeron (`test:unit`, `test:contract` y `test:integration --runInBand` con el patrón `usuarios-acceso|fundacion`) y la causa era determinista, no dependía de la infraestructura de GitHub.

### 13.4 Limitaciones y estado pendiente

- La CI remota sigue sin una ejecución satisfactoria de este cambio: pendiente de publicar y ejecutar.
- Las **35 pruebas de infraestructura de 002** (`test:integration:002:infra`) siguen **sin verificar**; esta verificación cubrió el contrato y la integración de 002, no esas suites.
- Los **3 casos `todo`** de `frontera-004.spec.ts` son el contrato futuro de la 004 (E2), escrito y no simulado.
- Las pruebas de **Firefox y WebKit** siguen sin ejecutarse; la matriz de nueve proyectos corresponde a T102.
- Un aborto nativo de Node (`0xC0000409`) ocurrió en dos ejecuciones locales de Jest sin relación con las suites (la repetición exacta pasó). Sigue sin causa identificada; no lo ocultan las demás pruebas, pero tampoco se atribuye a este cambio.


## 14. Fase 6 · US4 HU11 (T080–T087)

**Rango exacto:** T080–T082 (pruebas primero), T083–T085 (backend), T086 (web) y T087 (punto de verificación). Las 8 quedan marcadas `[x]`. Sin `git add`, `commit` ni `push`. Base: commit `9f5f6df` (CI #6 de 003: SUCCESS, según informó el PO); los resultados de esta sección son locales y la CI remota no se ha ejecutado para US4.

### 14.1 Funcionalidad entregada

- **Dominio** (`cotizaciones/dominio/aclaracion.ts` y `comparacion.ts`): hasta 1 000 caracteres por mensaje, 20 por hilo, sin adjuntos, mensajes inmutables y un hilo por identidad de cotización (sobrevive a las actualizaciones; un retiro seguido de un reenvío crea otra cotización con un hilo vacío). La comparación acepta 1 a 10 identificadores (11 → 422 `LIMITE_COMPARACION`; mal formado → 400) y su vista de referencia no suma, no totaliza, no ordena ni clasifica; las estimadas se rotulan y los campos ausentes dicen «No indicado».
- **Persistencia y casos de uso**: `RepositorioAclaracionesPostgres` (numeración consecutiva bajo `FOR UPDATE` de la cotización, segunda barrera por `UNIQUE` y `CHECK`), `listarDeSolicitud` y `obtenerVarias` en el repositorio de cotizaciones, y en `CotizacionesServicio`: `listarDeSolicitud`, `enviarAclaracion` y `listarAclaraciones`. Orden de bloqueos del plan (idempotencia → solicitud `FOR SHARE` → cotización `FOR UPDATE`).
- **API**: `listarCotizacionesDeSolicitud003`, `enviarAclaracion003` y `listarAclaraciones003`, registradas en `composicion/cotizaciones-003.ts`. La aplicación arranca en modo de prueba con las **18 operaciones** de 003 (10 de Solicitudes y Oportunidades, 5 de HU10 y 3 de HU11). No se tocó T088 ni la composición completa de las 58.
- **`nombresPublicos`**: T084 es su consumidor legítimo, acotado al cliente dueño de la solicitud y a los autores de las cotizaciones de ESA solicitud (lista, comparación y detalle de la cotización). La prueba de protección (`nombres-publicos-alcance.spec.ts`) se actualizó solo para admitir ese consumidor y se endureció: exige que el caso de uso la llame tras comprobar la titularidad, que pase solo los autores de la página y que ni controladores ni presentación la referencien.
- **Web**: cliente, `/solicitudes/{id}/cotizaciones` (lista en orden de llegada, sin clasificación, con casillas para marcar hasta 10), `/solicitudes/{id}/comparar` y `/solicitudes/{id}/cotizaciones/{cotizacionId}` (detalle con el hilo); prestador, el hilo en el detalle de su cotización. La comparación es una tabla accesible (encabezados de fila y columna, primera columna fija y desplazamiento solo dentro de su marco) a partir de 1024 px y tarjetas completas por cotización en tableta y teléfono, sin ocultar datos. El hilo muestra autor, número y versión, un contador visible de 1 000 caracteres, validación junto al campo, prevención del doble envío, conservación del texto ante errores, «Actualizar mensajes» real y modo de solo lectura; no hay adjuntos, ediciones ni respuestas simuladas, y ningún texto afirma que un aviso se haya enviado. Se añadió el enlace «Ver cotizaciones recibidas» en las acciones de la solicitud publicada del cliente (cambio mínimo en una pantalla aprobada).

### 14.2 Reglas de autorización verificadas (PostgreSQL real)

Lista y comparación: solo el cliente dueño; un tercero, otro cliente, el prestador autor o cualquier otro prestador reciben el mismo 404 que ante un identificador inexistente y ningún nombre; un identificador de otra solicitud o inexistente dentro de `ids` da 404 sin revelar de quién es. Aclaraciones: leen y escriben solo el cliente dueño y el prestador autor; cualquier otra cuenta, 404 idéntico; sin sesión, 401; si el dueño ya no tiene el perfil de cliente, 403. Cotización retirada → 409 `COTIZACION_RETIRADA`; solicitud cerrada → 409 `SOLICITUD_NO_ABIERTA`; en ambos casos el hilo sigue en lectura. Mensaje de más de 1 000 caracteres → 400; el 21.º → 422, también con dos mensajes simultáneos (uno gana, el otro recibe 422 y no se repite número). El nombre público aparece solo para el cliente dueño (lista, comparación y detalle); el prestador autor no lo recibe ni ve los de otros.

### 14.3 Pruebas (27 de noviembre de 2026, Node 24.15.0, PowerShell)

| Comprobación | Resultado |
|---|---|
| `tsc`, `eslint --max-warnings=0` y `build` del backend | Sin errores |
| Jest unitario | 669/669, 41 suites (nuevas: comparación 12 y aclaración 5; la de protección de `nombresPublicos` pasa de 4 a 6 casos) |
| Arquitectura | 8/8, 3 suites |
| Contrato 003 | 71/71, 5 suites (nueva `aclaraciones.spec.ts`: 15) |
| Integración 003 completa | 334 aprobadas y 3 `todo`, 21/21 suites (nueva `aclaraciones-comparacion.spec.ts`: 14, con CP-304 y CP-306: la lista cuesta las mismas sentencias con 1, 2 o 50 por página y con 2 o 5 `ids`, con un solo total y una sola lectura de nombres) |
| `tsc`, `eslint` y `npm run build` del frontend | Sin errores |
| Vitest completo | 241/241, 24 archivos (18 casos nuevos de HU11), con 1 trabajador y 15 s por prueba |
| Playwright `us4.spec.ts`, Chromium a 360, 768 y 1366 px | 9/9 sobre la aplicación real (HTTPS 8447) |
| Playwright `us2.spec.ts`, `us3.spec.ts` y `us4.spec.ts` juntos, Chromium a los tres anchos | 24 casos: 21 aprobados en la primera pasada; los 3 fallos eran de `us2` (ver incidencia 6) y `us2` pasó 6/6 tras corregir su aserción |

### 14.4 Evidencia visual

Capturas 40 a 45 a los tres anchos en `tecnologia/.local/evidencia/003/us4/web-chromium/capturas/chromium-{360,768,1366}/` (cotizaciones recibidas, comparación, comparación tras quitar una, hilo del cliente, hilo del prestador y sin acceso). Cada captura comprueba que el documento no excede el viewport. Revisadas a ojo: comparación a 1366 (tabla) y a 360 (tarjetas), recibidas a 1366 y el hilo a 768 y a 360.

### 14.5 Incidencias y correcciones

1. **Pruebas de integración propias**: Beto ya tenía una cotización activa al preparar el caso del presupuesto de sentencias (409); se reordenó la preparación.
2. **Contrato de US3**: afirmaba «exactamente 5 rutas con /cotizaciones»; con HU11 hay 8. Se convirtió en una comparación exacta del conjunto esperado (más estricta, no más débil).
3. **ESLint**: una pasada de edición introdujo un espacio irregular (NBSP) en una prueba; sustituido por su escape ` `.
4. **Defectos visuales** (hallados al revisar capturas): «p. m..» (doble punto) en los textos de estado de las cotizaciones vigente y vencida (incluye textos de US3), y el encabezado de cada mensaje heredaba el estilo global de `<header>`. Corregidos; el texto vencida pasa a «venció (fecha)».
5. **Pruebas Vitest/Playwright**: el fixture del frontend necesitó expresar «no informado» como ausencia (`exactOptionalPropertyTypes`); una aserción de comparación buscaba un texto que la etiqueta de estado ya reemplaza; un selector coincidía también con el título accesible de la tabla.
6. **Aislamiento entre suites e2e**: `us3.spec.ts` publica una solicitud abierta con el mismo título que `us2.spec.ts` esperaba ausente. La aserción de `us2` se acotó a su marca; no es un defecto del producto.
7. **Aborto nativo de Node** (`0xC0000409`): ocurrió 4 veces durante esta fase en ejecuciones de Jest (dos de integración y dos de contratos), siempre al arrancar y sin salida; en todos los casos la repetición idéntica pasó. Sigue **sin causa identificada** y no se oculta: una repetición verde no equivale a una primera ejecución limpia. Ninguna de las cifras de esta sección proviene de una ejecución abortada.
8. **Entorno**: se reinició el API de validación (3004) con el código de US4 y se usó el stack local ya levantado.

### 14.6 Limitaciones y verificaciones pendientes

- Firefox y WebKit **no se ejecutaron** (no instalados): la matriz de nueve proyectos corresponde a T102.
- Las **35 pruebas de infraestructura de 002** siguen sin verificar, y en esta fase **no se ejecutaron las regresiones de 001 y 002**: US4 no modifica código compartido (ni el middleware HTTP ni 001/002); la regresión de 001 se verificó por última vez en la sección 13.
- Los **3 casos `todo`** de `frontera-004.spec.ts` (contrato futuro de la 004) permanecen.
- La selección para comparar vive en memoria de la aplicación: se pierde al recargar la página y entonces se pide volver a elegir (no se persiste ningún dato en el navegador).
- No se ejecutaron cobertura Jest, k6 ni cargas (fuera de T080–T087), ni T088 ni la composición completa de las 58 operaciones.
- CI de GitHub Actions: no ejecutada para US4.


## 15. Fase 7 · T088 — arranque completo con las 58 operaciones (CP-308, R-27)

**Estado:** T088 completada y marcada `[x]`. Sin `git add`, `commit` ni `push`. Base: commit `600a56f` (CI #7 de 003: SUCCESS, según informó el PO). Los resultados de esta sección son locales; la CI remota no se ha ejecutado para este cambio. No se implementó ninguna tarea posterior (T089–T116).

### 15.1 Qué se hizo

Solo se modificó `tecnologia/backend/test/integration/solicitudes-cotizaciones/arranque-completo-003.spec.ts` (ningún código de producción ni el frontend). Se conservan los casos con controladores simulados, que siguen siendo útiles para los escenarios **negativos** (subconjuntos inválidos, ruta no seleccionada, ruta parametrizada antes que una literal, aplicación sin controladores), y se añadió un bloque con el **ensamblador y el arranque reales**: `crearAplicacionCompleta003` sin subconjuntos ni dobles, con los controladores reales de las tres historias y el almacén real de Garage (prefijo propio de la suite), sobre una base descartable `ayacucho_003_test_*`. También se actualizó el comentario de cabecera, que decía que los controladores aún no existían, y se renombró el caso «faltan operaciones» para reflejar lo que comprueba hoy (sin las opciones de las historias no hay controladores de la 003 y la aplicación no arranca).

Casos del bloque real (6):

1. **Inventario**: `contratoDeOferta` valida 17 + 23 + 18 = 58 (la aplicación completa solo arranca si coincide) y el espejo `contracts/solicitudes-cotizaciones.openapi.json` es **idéntico, byte a byte**, a la fuente aprobada `specs/003-solicitudes-y-cotizaciones/contracts/openapi.json`.
2. **`verificarRouter`**: el router de Nest coincide exactamente con la unión de las 58 operaciones (sin rutas de más ni de menos; 58 distintas; 18 con `/solicitudes` o `/cotizaciones`).
3. **Colisiones**: sin `operationId` repetidos, sin método y ruta repetidos y sin rutas equivalentes que solo difieran en el nombre del parámetro; y en el **orden real de registro de Express** cada ruta literal va antes que la parametrizada que podría ocultarla (hay casos reales, p. ej. `solicitudes/oportunidades` frente a `solicitudes/{solicitudId}`).
4. **Tabla de rutas de `configurarApi`**: se pide cada una de las 58 operaciones sin credenciales. De las 58, 45 son protegidas (Bearer) y 13 públicas. Las protegidas nunca responden 404, 403, 2xx ni 5xx: dan 401 o 400 (la validación del contrato precede a la identidad en el middleware, también en la 001: cuerpo vacío o cabecera obligatoria ausente); en la ejecución 14 dieron 401 y 31 validaron primero con 400. Las 9 lecturas (GET) de la 003 dan exactamente 401, con `tipo` indicado en el historial. Las públicas no dan 5xx.
5. **Controladores reales** (un simulado respondería `{}`): con cuentas ficticias, crear una solicitud (201 `BORRADOR`), listar «mis solicitudes», oportunidades, «mis cotizaciones» y las cotizaciones de una solicitud (páginas reales con su forma), y los errores reales del contrato (400 `DATOS_INVALIDOS`, 404 `RECURSO_NO_DISPONIBLE`).
6. **Composición con historias frente a completa**: exponen exactamente el mismo conjunto de rutas.

La no regresión de los arranques base (17 operaciones) y de la 002 (40, sin ninguna de la 003) sigue cubierta por los dos casos finales del mismo archivo, que pasan.

### 15.2 Pruebas (27 de noviembre de 2026, Node 24.15.0, PowerShell)

| Comprobación | Resultado |
|---|---|
| `arranque-completo-003.spec.ts` | **20/20** (14 anteriores y 6 nuevos), una sola suite |
| `tsc`, `eslint --max-warnings=0` y `build` del backend | Sin errores |
| Jest unitario | 669/669, 41 suites |
| Arquitectura | 8/8, 3 suites |
| Contrato 003 | 71/71, 5 suites |
| Integración 003 completa | 340 aprobadas y 3 `todo`, 21/21 suites |
| 001 · unitarias (`usuarios-acceso\|fundacion`) | 160/160, 9 suites |
| 001 · contratos | 126/126, 11 suites |
| 001 · integración (`--runInBand`) | 129/129, 12 suites, 78 s, sin «did not exit» — **solo en el 3.er intento** (ver 15.3) |
| 002 · contratos (`prestadores-catalogo`) | 76/76, 7 suites — en la repetición (ver 15.3) |
| 002 · integración (`test:integration:002`, sin las suites de infraestructura) | 165/165, 17 suites |

### 15.3 Incidencias

1. **Aserciones propias demasiado estrictas** (corregidas en la prueba, sin tocar producción): la primera versión afirmaba «401 siempre» para las operaciones protegidas. Tres ejecuciones fallaron con operaciones que validan primero (`reautenticarSesion`, `eliminarFotografiaPortafolio002` y `consultarHistorialSolicitud003` exigen cuerpo, cabecera o `tipo`) y dieron 400; es el comportamiento documentado del middleware. Se reformuló con el criterio exacto del punto 4 de la sección 15.1. Un umbral posterior («más de la mitad con 401») también era arbitrario y se sustituyó por una condición que sí importa (al menos las 9 lecturas de la 003 con 401 exacto).
2. **Aborto nativo de Node `0xC0000409`: 3 ocurrencias en esta tarea**, siempre al arrancar y sin salida de Jest: 001 integración (dentro del script de regresión), 002 contratos (ídem) y 001 integración (primera repetición). La repetición de 002 contratos pasó (76/76) y la integración de 001 pasó en el 3.er intento (129/129). **Siguen sin causa identificada** y una repetición verde no equivale a una primera ejecución limpia: las cifras de 001 integración y de 002 contratos de la tabla provienen de repeticiones, no de la primera ejecución. Ninguna cifra procede de una ejecución abortada. Los contenedores de 001 estaban sanos durante los intentos.

### 15.4 Limitaciones y pendientes

- No se ejecutaron Firefox ni WebKit (la matriz de nueve proyectos es de T102) ni Playwright en esta tarea (no hubo cambios de frontend).
- Las 35 pruebas de infraestructura de 002 (`test:integration:002:infra`) siguen **sin verificar**.
- Los 3 casos `todo` de `frontera-004.spec.ts` permanecen.
- El aborto nativo intermitente de Node sigue pendiente de diagnóstico.
- La regresión con objetos `solicitudes/` en el bucket, la limpieza y respaldo de 002 y CP-307/CP-310 corresponden a T093; el flujo de CI, a T094. Cobertura Jest, k6 y cargas no se ejecutaron.
- CI de GitHub Actions: no ejecutada para este cambio.
