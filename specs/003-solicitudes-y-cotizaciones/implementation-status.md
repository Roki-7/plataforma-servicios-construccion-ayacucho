# Estado de implementación — 003 Solicitudes y cotizaciones

Documento vivo de la funcionalidad 003. Se actualiza con cada fase. Datos ficticios; no contiene secretos.

## 1. Línea base

| Elemento | Valor |
|---|---|
| Rama | `003-solicitudes-y-cotizaciones` |
| Commit documental base de la implementación | `d078263` (docs(003): especificacion plan y tareas) |
| Línea base de 001 y 002 en `main` | `c32f2c8` |
| Runtime | Node.js 24.15.0 (toolchain local del proyecto) |
| Alcance autorizado hasta ahora | Fase 1 (T001 a T008, cerrada) y Fase 2A (T009 a T024) |
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
