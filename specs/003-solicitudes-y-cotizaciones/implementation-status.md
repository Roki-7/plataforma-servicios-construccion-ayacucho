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
