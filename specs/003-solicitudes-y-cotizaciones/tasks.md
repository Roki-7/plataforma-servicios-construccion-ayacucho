# Tasks: 003 — Solicitudes y cotizaciones

**Base de planificación** `c32f2c8` · **Rama** `003-solicitudes-y-cotizaciones`

**Entrada** [Especificación](spec.md), [plan](plan.md), [investigación](research.md), [modelo de datos](data-model.md), [OpenAPI](contracts/openapi.json), [contratos](contracts/README.md), [guía de validación](quickstart.md) y [constitución](../../.specify/memory/constitution.md).

## Formato y convenciones

- Cada tarea usa el formato `- [ ] TNNN [P] [USn] (ETIQUETA) Acción en rutas exactas. **Cierre.** Resultado comprobable. **Dep.** TNNN.`. Las etiquetas de historia (`US1` a `US4`) solo se aplican a sus fases. Las rutas parten de la raíz del repositorio.
- **`[P]`** marca trabajo en archivos distintos que puede avanzar en paralelo en cuanto se satisfacen las dependencias indicadas. Un ID de dependencia exige que su criterio de cierre esté cumplido antes de comenzar.
- **Etiquetas de alcance**, para separar los cambios en módulos existentes de las capacidades nuevas:
  - `(EXT)`: cambio **aditivo** en 001, 002, Notificaciones, la composición compartida o el CI. Cada uno cita su requisito y su prueba de protección. **Los únicos cambios en los módulos de la 002 son las lecturas aditivas de Prestadores y Catálogo autorizadas por el Product Owner. No se corrige la limpieza del portafolio ni ningún otro comportamiento de la 002.**
  - `(003)`: capacidad nueva de la funcionalidad 003.
  - `(OPS)`: operación, respaldo y restauración.
  - `(DOC)`: documentación.
- Las pruebas de cada historia se escriben **antes** de su implementación. La ejecución empieza cuando existen contrato, migraciones y controladores.
- Los archivos y la evidencia que aquí se nombran son **destinos de trabajo futuro**. Esta lista no implementa nada. La evidencia de ejecución se deposita en `tecnologia/.local/evidencia/003/` y sus referencias en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. Todo es con datos ficticios.
- **Lo no ejecutado no se declara probado.** Un respaldo no ensayado, un PR01 no medido, un PR06 sin participantes o un PR07 sin celular real quedan en estado PENDIENTE. No se hereda ninguna excepción de la 002.
- Los diferimientos **E1** (RF13: entrega de avisos a la 006 y retiro de selección a la 004) y **E2** (RF18: selección y propuesta de cambio a la 004 o 009) permanecen explícitos. Ninguna tarea los amplía ni implementa selección, contratación o entrega de avisos.
- Los criterios `CP-3xx` y `OP-3xx` son los de [plan.md](plan.md) y [research.md](research.md) (R-22).

## Fase 1 — Preparación

**Objetivo.** Dejar un entorno aislado de la 003, una línea base reproducible y destinos propios de evidencia.

- [x] T001 [P] (DOC) Registrar la línea base `c32f2c8` y los inventarios de 17 operaciones de la 001, 23 de la 002 y 18 de la 003 en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Constan la rama, el SHA, los contratos fuente, la distinción entre lo verificado con el ensamblador de documentos y lo que solo se verificará con el arranque real, y todas las verificaciones en estado PENDIENTE.
- [x] T002 [P] (003) Definir el entorno dedicado de la 003 (PostgreSQL 18, Redis 8 requerido por la composición de la 002, Garage, Mailpit y proxy HTTPS) en `tecnologia/compose.003.yaml`, con proyecto `ayacucho-003-validacion` y puertos propios. **Cierre.** Compose resuelve servicios, volúmenes y puertos distintos de 001 y 002. No crea bucket ni identidad de almacenamiento nuevos.
- [x] T003 [P] (003) Definir nombres de proyecto, puertos, rutas locales y base `ayacucho_003_validacion` en `tecnologia/backend/scripts/entorno-003.ts`. **Cierre.** Los demás scripts de la 003 leen de aquí y ningún valor coincide con los de 001 y 002.
- [x] T004 (003) Preparar configuración local, TLS y catálogo ficticio aislado en `tecnologia/backend/scripts/preparar-validacion-003.ts`, reutilizando el procedimiento de `preparar-validacion-002.ts` sin modificarlo. **Cierre.** Genera solo configuración y archivos de prueba de 003, sin secretos versionados. **Dep.** T003.
- [x] T005 [P] (003) Preparar aislamiento de PostgreSQL real y contador de sentencias SQL en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/postgres.ts` y `tecnologia/backend/test/soporte/solicitudes-cotizaciones/contador-sentencias.ts`, y el cliente de almacenamiento de prueba en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/almacenamiento.ts`. **Cierre.** Cada suite usa una base `ayacucho_003_test_*` propia, un prefijo `pruebas/<uuid>/solicitudes/` propio y las retira al terminar. **Dep.** T003.
- [x] T006 [P] (003) Preparar el ejecutor de navegador de la 003 y el destino de evidencia en `tecnologia/frontend/playwright.003.config.ts`. **Cierre.** Tres navegadores y tres anchos (360, 768 y 1366 px) con evidencia en `tecnologia/.local/evidencia/003/`.
- [x] T007 [P] (EXT) Crear el esqueleto del flujo de CI propio en `.github/workflows/solicitudes-cotizaciones.yml`. **Cierre.** Tres trabajos (calidad, validación 003 y regresión de 001 y 002) con filtros de ruta `tecnologia/**`, `specs/003-solicitudes-y-cotizaciones/**` y el propio flujo, y evidencia en `tecnologia/.local/evidencia/003/ci`. Sin secretos versionados. **Dep.** T002. **Estado.** Creado y verificado solo estructuralmente; no ejecutado en GitHub Actions.
- [x] T008 (EXT) Registrar los comandos de preparación, migración, almacenamiento, semilla y arranque en `tecnologia/backend/package.json` y `tecnologia/backend/scripts/iniciar-validacion-003.ts`: `dev:prepare:003`, `db:migrate:003`, `storage:init:003`, `test:seed:003`, `start:validation:003` y `test:integration:003`. **Cierre.** Los puntos de entrada existen y no alteran los comandos de 001 ni de 002. **Dep.** T003, T004.

## Fase 2 — Fundamentos

**Objetivo.** Preparar los puntos de extensión y los cimientos propios sin romper 001 ni 002.

### 2A · Cambios aditivos en 001, 002, Notificaciones, composición y CI (módulos existentes)

- [x] T009 [P] (EXT) Escribir primero las pruebas de contrato de la composición en `tecnologia/backend/test/contract/solicitudes-cotizaciones/composicion-contratos.spec.ts`. **Cierre.** Exigen: espejo idéntico a `specs/003-solicitudes-y-cotizaciones/contracts/openapi.json`, inventarios de 17, 23 y 18, 58 operaciones sin colisión ni ruta ambigua ni `operationId` duplicado, componentes compartidos `IdempotencyKey`, `Origin` y `bearerAuth` idénticos, y que los arranques base (17) y de la 002 (40) no cambien. Cubre CP-308. **Dep.** T001.
- [x] T010 (EXT) Crear el espejo ejecutable `tecnologia/backend/contracts/solicitudes-cotizaciones.openapi.json` idéntico al contrato fuente. **Cierre.** La prueba de igualdad pasa. No se edita a mano: cualquier cambio de contrato se hace en la fuente. **Dep.** T009.
- [x] T011 [P] (EXT) Escribir primero las pruebas de arranque en `tecnologia/backend/test/integration/solicitudes-cotizaciones/arranque-completo-003.spec.ts`. **Cierre.** Cubren el modo `prueba` con un subconjunto de operaciones, el modo `completa` con las 58, la tabla de rutas de `configurarApi`, `verificarRouter` (router igual a la unión, sin ruta parametrizada que oculte una literal) y la no regresión de los arranques base y de la 002. Cubre CP-308. **Dep.** T005, T001.
- [x] T012 (EXT) Generalizar el registro de migraciones en `tecnologia/backend/src/composicion/persistencia.ts` y crear `tecnologia/backend/src/composicion/migraciones-003.ts` (`aplicarMigraciones003`). **Cierre.** Orden aditivo único y posterior a `1795000000009`, con una prueba unitaria de unicidad y orden. El comportamiento de `persistencia002` no cambia. **Dep.** T011.
- [x] T013 (EXT) Generalizar `tecnologia/backend/src/composicion/app.module.ts` para admitir `oferta003` junto a `oferta002` (modos `completa` y `prueba`), componer tres documentos en `contratoDeOferta`, pasar a `configurarApi` la unión de las operaciones extendidas y crear `tecnologia/backend/src/composicion/oferta-003.ts` y `tecnologia/backend/src/composicion/aplicacion-003.ts` (`crearAplicacionCompleta003`). **Cierre.** Las pruebas de T-contratos y T-arranque en modo `prueba` pasan. No se modifica `configurar-api.ts`. Cubre R-01. **Dep.** T009, T010, T012.
- [x] T014 [P] (EXT) Crear `tecnologia/backend/src/composicion/configuracion-003.ts` con su prueba unitaria. **Cierre.** Acepta bases `ayacucho_003_(validacion|test_[a-z0-9_]+)` y las de 002 para regresión, solo locales, y delega el resto en el cargador existente. `configuracion-002.ts` no cambia.
- [x] T015 [P] (EXT) Crear `tecnologia/backend/src/compartido/aplicacion/reintento-concurrencia.ts` y sus pruebas unitarias. **Cierre.** Interbloqueo (40P01) y fallo de serialización (40001) se reintentan hasta 2 veces con espera corta y aleatoria. Si persisten, `CONFLICTO_CONCURRENTE`. Un error inesperado no se reintenta ni se oculta. Cubre FR-346 y CA-ERR-02.
- [x] T016 [P] (EXT) Escribir primero las pruebas de las lecturas aditivas de Prestadores en `tecnologia/backend/test/integration/solicitudes-cotizaciones/api-prestadores-lecturas.spec.ts`. **Cierre.** Cubren `perfilPorId`, `distritosDe`, `especialidadesDe` y `nombresPublicos` (una sola consulta por página), solo lectura y sin tocar tablas ajenas. Cubre FR-302, FR-305, FR-333 y FR-343. **Dep.** T005.
- [x] T017 (EXT) Añadir las cuatro lecturas a `tecnologia/backend/src/modulos/prestadores/api-publica.ts` y a su repositorio. **Cierre.** Pasan T-prest y toda la suite de 002 de Prestadores sin cambios. **Dep.** T016.
- [x] T018 [P] (EXT) Escribir primero las pruebas de `categoriasDeOferta` en `tecnologia/backend/test/integration/solicitudes-cotizaciones/api-catalogo-categorias-oferta.spec.ts`. **Cierre.** Con categoría A, subcategorías A1 y A2 y categoría B: un servicio en A1 aporta {A1, A}, uno en A aporta {A}, solo cuentan servicios PUBLICADO con clasificación propia y del padre activas. Cubre CA-CMP-01 a 07 en su parte de Catálogo. **Dep.** T005.
- [x] T019 (EXT) Añadir `categoriasDeOferta(prestadorId, tx?)` a `tecnologia/backend/src/modulos/catalogo/api-publica.ts` y su lectura de persistencia. **Cierre.** Pasan T-cat y las suites de búsqueda y elegibilidad de 002 sin cambios. **Dep.** T018.
- [x] T020 [P] (EXT) Escribir primero las pruebas de `avisos_negocio` en `tecnologia/backend/test/integration/solicitudes-cotizaciones/avisos-negocio.spec.ts`. **Cierre.** Cubren: inserción atómica con la transacción del llamador y reversión conjunta, idempotencia por `clave_logica`, que el worker de correo de 001 no los tome ni los envíe y que `avisos_pendientes` no cambie. Cubre FR-344 y FR-345. **Dep.** T005.
- [x] T021 (EXT) Crear la migración `1796000000003` de `avisos_negocio` en `tecnologia/backend/src/modulos/notificaciones/infraestructura/migraciones/` y `AvisosNegocioApi.registrar(avisos, tx)` en `tecnologia/backend/src/modulos/notificaciones/api-publica.ts`. **Cierre.** Restricciones: `tipo` en `SOLICITUD_DIRIGIDA_PUBLICADA`, `SOLICITUD_CAMBIADA` o `SOLICITUD_CERRADA`, `clave_logica` única, `estado` solo `REGISTRADO`, solo identificadores. Pasa T-notif y la suite de notificaciones de 001. **Dep.** T020, T012.
- [x] T022 [P] (EXT) Añadir las reglas de los módulos `solicitudes` y `cotizaciones` a `tecnologia/dependency-cruiser.cjs` y crear `tecnologia/backend/test/architecture/solicitudes-cotizaciones.spec.ts`. **Cierre.** Dominio sin otros módulos ni infraestructura, aplicación sin implementaciones, consumo solo mediante `api-publica`, `solicitudes` sin importar `cotizaciones` y sin ciclos. Cubre PR12. **Dep.** T001.
- [x] T023 (EXT) Ampliar los filtros de aislamiento en `tecnologia/scripts/validar-001-ci.sh` y, si corresponde, en `.github/workflows/usuarios-acceso.yml` para excluir `solicitudes-cotizaciones`, y comprobar que los filtros de `.github/workflows/prestadores-catalogo.yml` no capturen las pruebas nuevas. **Cierre.** Una comprobación local muestra que 001 no selecciona las suites de 003 y que 002 solo selecciona las suyas. **Dep.** T007.
- [x] T024 (EXT) Ejecutar y registrar la regresión de 001 y 002 tras los cambios aditivos en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Unitarias, contratos, arquitectura e integración de 002 relevantes y la regresión de 001 pasan con la evidencia depositada. Si alguna falla, se corrige antes de seguir. **Dep.** T013, T017, T019, T021, T022, T023, T014, T015.

### 2B · Fundamentos propios de la 003 (modelo, almacenamiento y política de acceso)

- [x] T025 [P] (003) Crear los errores y la traducción de condiciones de base de datos en `tecnologia/backend/src/modulos/solicitudes/dominio/errores.ts` y `tecnologia/backend/src/modulos/cotizaciones/dominio/errores.ts`. **Cierre.** Usan `ErrorAplicacion` con los códigos del contrato: 23505 → `COTIZACION_EXISTENTE`, 23514 sobre contadores → `LIMITE_ARCHIVOS` y espera de bloqueo → `CONFLICTO_CONCURRENTE`. Pruebas unitarias. **Dep.** T013.
- [x] T026 [P] (003) Crear el esqueleto del módulo en `tecnologia/backend/src/modulos/solicitudes/` con `api-publica.ts` (lecturas para Cotizaciones y para la 004: estado y versión de trabajo por lote, bloqueo compartido y validación de cliente y disponibilidad) y los puertos de aplicación. **Cierre.** Compila, respeta las reglas de arquitectura y no importa otros módulos. **Dep.** T025, T022.
- [x] T027 [P] (003) Crear el esqueleto del módulo en `tecnologia/backend/src/modulos/cotizaciones/` con `api-publica.ts` (lecturas: autores no retirados, solicitudes con cotización no retirada, `obtenerVigente`) y los puertos de aplicación. **Cierre.** Compila y respeta las reglas, e importa solo `solicitudes/api-publica`. **Dep.** T025, T022.
- [x] T028 [P] (003) Escribir primero las pruebas del modelo de solicitudes en `tecnologia/backend/test/integration/solicitudes-cotizaciones/modelo-solicitudes.spec.ts`. **Cierre.** Verifican las restricciones y disparadores con PostgreSQL real: dominios cerrados, `(publicada_en IS NOT NULL) = (version_trabajo >= 1)`, `fecha_hasta >= fecha_desde`, `archivos_cantidad` entre 0 y 5, `archivos_bytes` entre 0 y 30 000 000, inmutabilidad tras publicar, terminalidad de CERRADA salvo contadores, versiones y bitácora inmutables, y sin `DELETE`. **Dep.** T005.
- [x] T029 (003) Crear la migración `1796000000001` en `tecnologia/backend/src/modulos/solicitudes/infraestructura/migraciones/` con `solicitudes`, `solicitudes_versiones`, `solicitudes_bitacora`, `solicitudes_archivos` y `solicitudes_objetos_pendientes`, sus disparadores e índices. **Cierre.** Cumple el modelo de datos: `descripcion` varchar(2000), `medidas` varchar(500), `distrito_codigo` con los cinco códigos canónicos, estados `PREPARANDO`, `PREPARADO`, `CONFIRMADO`, `DESCARTADO` y `ELIMINADO`, `objeto_clave` única con la forma `solicitudes/<solicitudId>/<archivoId>`, y un único disparador que mantiene los contadores. Es reversible. Pasa T-mod-sol. **Dep.** T028, T012, T026.
- [x] T030 [P] (003) Escribir primero las pruebas del modelo de cotizaciones en `tecnologia/backend/test/integration/solicitudes-cotizaciones/modelo-cotizaciones.spec.ts`. **Cierre.** Verifican el índice único parcial `(solicitud_id, prestador_id) WHERE estado <> 'RETIRADA'`, las restricciones por tipo (estimada: `precio_centimos` o `forma_calculo`; definitiva: `precio_centimos`, `plazo_dias` y `condiciones_pago`), `precio_centimos` mayor que 0 y hasta 9 007 199 254 740 991, `numero` de aclaración entre 1 y 20 con unicidad, retiro terminal y filas inmutables. **Dep.** T005.
- [x] T031 (003) Crear la migración `1796000000002` en `tecnologia/backend/src/modulos/cotizaciones/infraestructura/migraciones/` con `cotizaciones`, `cotizaciones_versiones` y `cotizaciones_aclaraciones`, sus disparadores e índices. **Cierre.** Cumple el modelo de datos: `alcance` varchar(2000) NOT NULL, `forma_calculo` y `condiciones_pago` varchar(1000), `texto` de aclaración varchar(1000) no vacío, `estado` solo `ACTIVA` o `RETIRADA`. Es reversible. Pasa T-mod-cot. **Dep.** T030, T029, T027.
- [x] T032 [P] (003) Escribir primero las pruebas de las lecturas de autoría en `tecnologia/backend/test/integration/solicitudes-cotizaciones/api-cotizaciones-lecturas.spec.ts`. **Cierre.** Cubren `autoresNoRetirados`, `solicitudesConCotizacionNoRetirada` y la consulta por cuenta, sin tocar tablas de otro módulo y con una sola sentencia por llamada. **Dep.** T031.
- [x] T033 (003) Implementar las lecturas de autoría en `tecnologia/backend/src/modulos/cotizaciones/api-publica.ts` y su repositorio de solo lectura. **Cierre.** Pasa T-lect-cot. Permite a Solicitudes resolver interesados y el título (c) con datos reales desde la primera historia. **Dep.** T032.
- [x] T034 [P] (003) Escribir primero las pruebas de la política de acceso en `tecnologia/backend/test/unit/solicitudes-cotizaciones/politica-acceso.spec.ts`. **Cierre.** Cubren los títulos (a), (b) y (c), el autor retirado, las solicitudes CERRADAS, el permiso de compartir y la revocación para todos los prestadores. Cubren FR-324 a FR-328 y CA-PRI-02 a 08. **Dep.** T001.
- [x] T035 (003) Implementar la política única de acceso y fotografías en `tecnologia/backend/src/modulos/solicitudes/dominio/politica-acceso.ts`. **Cierre.** Función pura sin dependencias de infraestructura. Pasa T-politica. Es la única fuente de esa regla. **Dep.** T034.
- [x] T036 [P] (003) Escribir primero las pruebas del adaptador de almacenamiento en `tecnologia/backend/test/unit/solicitudes-cotizaciones/solicitudes-s3.spec.ts`. **Cierre.** Cubren la expresión estricta de clave (`solicitudes/<uuid>/<uuid>` y `pruebas/<uuid>/solicitudes/<uuid>/<uuid>`), que rechaza cualquier otra, listados y borrados acotados al prefijo, tiempos acotados, `Cache-Control: no-store` y que no genera enlaces firmados. **Dep.** T005.
- [x] T037 (003) Implementar `tecnologia/backend/src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.ts` sobre el bucket existente. **Cierre.** Pasa T-s3. No requiere variables, bucket ni identidad nuevos. **Dep.** T036.
- [x] T038 [P] (003) Escribir primero las pruebas del saneador en `tecnologia/backend/test/unit/solicitudes-cotizaciones/sanear-imagen.spec.ts`. **Cierre.** Cubren formato real JPG, PNG o WEBP, rechazo de PDF y de formato falso (`IMAGEN_FORMATO_NO_ADMITIDO`), bomba de píxeles, 4 096 px por lado, 10 000 000 bytes (uno exacto se acepta, más devuelve `ARCHIVO_DEMASIADO_GRANDE`), recodificación a WebP sin EXIF ni GPS y lado mayor de hasta 1 600 px. **Dep.** T005.
- [x] T039 (003) Implementar el saneador propio en `tecnologia/backend/src/modulos/solicitudes/infraestructura/archivos/sanear-imagen.ts` con Sharp, sin importar internos de Prestadores. **Cierre.** Pasa T-sanear. La duplicación respecto de la 002 queda registrada como deuda técnica en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Dep.** T038.
- [x] T040 [P] (003) Escribir primero las pruebas de aislamiento del almacenamiento en `tecnologia/backend/test/integration/solicitudes-cotizaciones/aislamiento-almacenamiento.spec.ts`. **Cierre.** Comprueban con Garage real: el acceso anónimo al bucket falla, el adaptador de solicitudes rechaza claves fuera de su prefijo, los adaptadores de 001 y 002 no leen, listan ni borran objetos `solicitudes/`, y los procedimientos de limpieza y de respaldo de 002 siguen intactos con objetos `solicitudes/` presentes. Cubre CP-307 y CP-310. **Si fallan, se reabre la decisión y se justifica un bucket propio.** **Dep.** T005, T037.
- [x] T041 (003) Implementar `storage:init:003` en `tecnologia/backend/scripts/iniciar-validacion-003.ts`. **Cierre.** Comprueba el acceso al bucket privado existente con el prefijo `solicitudes/` y la ausencia de acceso anónimo. No crea bucket ni identidad. Pasa T-aisl. **Dep.** T040, T008.
- [x] T042 [P] (003) Crear los datos ficticios en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/datos.ts` y el comando `test:seed:003`. **Cierre.** Clientes, prestadores con servicios publicados en la categoría A, la subcategoría A1, la hermana A2 y la categoría B, distintos distritos y coberturas, un prestador con especialidad pero sin servicio publicado y una cuenta con ambos perfiles. No altera la base de validación de 002. **Dep.** T017, T019, T008.

## Fase 3 — US1 — HU07 · Registrar, publicar y gestionar solicitudes (P1)

**Objetivo.** RF12 y RF13. Verificar de forma independiente el ciclo de una solicitud, sus versiones, archivos, datos personales y avisos registrados.

### Pruebas primero

- [x] T043 [P] [US1] (003) Escribir primero las pruebas unitarias del versionado en `tecnologia/backend/test/unit/solicitudes-cotizaciones/versionado-solicitud.spec.ts`. **Cierre.** Cubren versión de control y de trabajo, la versión 1 en la primera publicación, cambios relevantes (descripción, medidas, conjunto de archivos, categoría, distrito y fecha), exclusión de privacidad y cierre, edición idéntica sin efectos y edición mixta con una sola versión. Cubren CA-SOL-05 a 07 y CA-VER-01 a 07. **Dep.** T026.
- [x] T044 [P] [US1] (003) Escribir primero las pruebas unitarias de datos personales en `tecnologia/backend/test/unit/solicitudes-cotizaciones/datos-personales.spec.ts`. **Cierre.** Tabla con todos los ejemplos de la sección «Criterios verificables de datos personales» de la spec (aceptados, rechazados y solo advertencia), exenciones de montos con indicador monetario, medidas, porcentajes, fechas y numeraciones cortas, y casos adicionales de falsos positivos. Cubren FR-315, FR-316, FR-348 y CA-DAT-01 a 08. **Dep.** T026.
- [x] T045 [P] [US1] (003) Escribir primero las pruebas unitarias de validación en `tecnologia/backend/test/unit/solicitudes-cotizaciones/validacion-solicitud.spec.ts`. **Cierre.** Cubren datos obligatorios al publicar (`SOLICITUD_INCOMPLETA`), `descripcion` de hasta 2 000 y `medidas` de hasta 500 (`DATOS_INVALIDOS`), distrito canónico, fecha no anterior a hoy en America/Lima con periodo coherente, categoría del servicio, autodirección, inmutabilidad (`CAMPO_NO_MODIFICABLE`) y advertencias de cobertura y de especialidad. Cubren CA-SOL-02 a 04, CA-SOL-09 y 10 y CA-BOR-01 a 10 en su parte de dominio. **Dep.** T026.
- [x] T046 [P] [US1] (003) Escribir primero las pruebas de integración del ciclo de solicitudes en `tecnologia/backend/test/integration/solicitudes-cotizaciones/ciclo-solicitudes.spec.ts`. **Cierre.** Con PostgreSQL real cubren CA-SOL-01 (**escritura real que rechaza el alta de una solicitud para un servicio inelegible aunque antes lo fuera**), CA-SOL-05 a 08, CA-BOR-01 a 10, CA-VER-01 a 07, CA-CIE-01 y 02, CA-AVI-02 y 03 (atómico e idempotente) y la parte de cierre de CA-AVI-04. **Dep.** T029, T021, T017, T019, T042, T033.
- [x] T047 [P] [US1] (003) Escribir primero las pruebas de integración de archivos en `tecnologia/backend/test/integration/solicitudes-cotizaciones/archivos-solicitud.spec.ts`. **Cierre.** Cubren CA-ARC-01 a 07, 12 y 13: cargas simultáneas que exceden 5 archivos o 30 000 000 bytes, fallo del almacenamiento sin cupo consumido (503), interrupción tras guardar, caducidad a las 24 horas liberada en la misma transacción, confirmación todo o nada (404, `ARCHIVO_NO_LISTO`, `ARCHIVO_EXPIRADO` y `LIMITE_ARCHIVOS`), repetición idempotente de una carga y ausencia de direcciones públicas. **Dep.** T029, T037, T039, T042.
- [x] T048 [P] [US1] (003) Escribir primero las pruebas de limpieza y control en `tecnologia/backend/test/integration/solicitudes-cotizaciones/limpieza-solicitudes.spec.ts`. **Cierre.** Cubren CA-ARC-08 a 11 y OP-305 y OP-306: idempotencia, dos instancias sin repetir una clave, reintentos con espera creciente, protección de archivos en carga (una entrada de preparación no se procesa antes de su vencimiento ni si la fila está `PREPARADO` o `CONFIRMADO`), trazabilidad por entrada, objetos sin fila solo informados, umbral de 900 s distinto de la caducidad de 24 horas y código de salida distinto de cero ante hallazgos. **Dep.** T029, T037, T042.
- [x] T049 [P] [US1] (003) Escribir primero las pruebas de contrato de las operaciones de la historia en `tecnologia/backend/test/contract/solicitudes-cotizaciones/solicitudes.spec.ts`. **Cierre.** Cubren las 9 operaciones (`crearSolicitud003`, `listarMisSolicitudes003`, `obtenerSolicitud003`, `editarSolicitud003`, `publicarSolicitud003`, `cerrarSolicitud003`, `consultarHistorialSolicitud003`, `cargarArchivoSolicitud003` y `obtenerArchivoSolicitud003`) con esquemas, errores, seguridad Bearer, `Origin`, `Idempotency-Key` y ejemplos HTTP. **Dep.** T010, T013.
- [x] T050 [P] [US1] (003) Escribir primero la matriz PR04 de solicitudes y archivos en `tecnologia/backend/test/integration/solicitudes-cotizaciones/seguridad-solicitudes.spec.ts`. **Cierre.** Peticiones sin sesión, cuenta ajena, perfil incorrecto, dueño y destinatario sobre cada operación de la historia, incluida la bitácora y los archivos. Todo intento no autorizado se rechaza sin modificar datos ni revelar existencia. Cubre CA-SEG-01, CA-PRI-01 a 04 y CA-HIS-03. **Dep.** T029, T042, T035.

### Implementación y punto de verificación

- [x] T051 [US1] (003) Implementar el dominio de solicitudes en `tecnologia/backend/src/modulos/solicitudes/dominio/solicitud.ts`, `version.ts` y `fechas.ts`. **Cierre.** Estados BORRADOR, ABIERTA y CERRADA, estado canónico y detección de cambios relevantes y de edición idéntica, validaciones de publicación, categoría del servicio e inmutabilidad, y fechas de calendario en America/Lima. Pasan las pruebas unitarias de versionado y validación. **Dep.** T043, T045.
- [x] T052 [P] [US1] (003) Implementar `tecnologia/backend/src/modulos/solicitudes/dominio/datos-personales.ts`. **Cierre.** Función pura que devuelve rechazos y advertencias según los criterios de la spec, sin registrar el texto. Pasa las pruebas de datos personales. **Dep.** T044.
- [x] T053 [US1] (003) Implementar el repositorio PostgreSQL de solicitudes en `tecnologia/backend/src/modulos/solicitudes/infraestructura/persistencia/solicitudes.ts`. **Cierre.** Altas, lecturas con bloqueo `FOR UPDATE` o `FOR SHARE` según el caso, versiones, bitácora y paginación determinista con total por ventana. No consulta tablas de otro módulo. **Dep.** T029, T051.
- [x] T054 [US1] (003) Implementar los casos de uso de solicitudes en `tecnologia/backend/src/modulos/solicitudes/aplicacion/` (guardar borrador, editar, publicar, cerrar, listar propias como cliente, detalle de dueño e historial) con idempotencia reutilizada, orden de bloqueos idempotencia → revisión de oferta → solicitud, elegibilidad con `ElegibilidadServicio.evaluar(..., tx)` y avisos de FR-344 mediante `AvisosNegocioApi`. **Cierre.** Pasan las pruebas del ciclo de solicitudes. **Dep.** T053, T052, T021, T017, T019, T035, T015, T033, T046.
- [x] T055 [US1] (003) Implementar los casos de uso de archivos en `tecnologia/backend/src/modulos/solicitudes/aplicacion/archivos-solicitud.ts` y el repositorio en `tecnologia/backend/src/modulos/solicitudes/infraestructura/persistencia/archivos.ts`. **Cierre.** Carga en tres tiempos con compensación entre PostgreSQL y S3, descarte de caducados dentro de la transacción que evalúa el cupo, confirmación todo o nada (FR-347), borrado lógico con entrada de purga, intento de borrado inmediato y descarga autorizada por la política. Pasan las pruebas de archivos. **Dep.** T053, T037, T039, T035, T047.
- [x] T056 [US1] (003) Implementar la limpieza en `tecnologia/backend/src/modulos/solicitudes/infraestructura/archivos/limpieza-solicitudes.ts`, el proceso periódico en `tecnologia/backend/src/composicion/solicitudes-003.ts` y los comandos `solicitudes:limpiar:003` y `solicitudes:verificar:003` en `tecnologia/backend/scripts/`. **Cierre.** Reclamo con `FOR UPDATE SKIP LOCKED` y arrendamiento de 120 s, intervalo configurable (`SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS`, inicial 300, mínimo 60), umbral configurable (`SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS`, inicial 900, al menos tres intervalos), reintentos, trazabilidad por entrada y conteos agregados sin datos personales. Pasan las pruebas de limpieza. **No modifica la limpieza de 002.** **Dep.** T048, T055, T013.
- [x] T057 [US1] (003) Implementar los controladores de las 9 operaciones de la historia en `tecnologia/backend/src/modulos/solicitudes/presentacion/` y el registro `tecnologia/backend/src/composicion/solicitudes-003.ts` con el orden de rutas (literales antes que parametrizadas). **Cierre.** Pasan las pruebas de contrato y de seguridad de la historia y el arranque en modo `prueba` con esas operaciones. El interesado de los avisos es el destinatario más los autores de cotizaciones no retiradas, resueltos con las lecturas reales de Cotizaciones. **Dep.** T054, T055, T056, T049, T050, T033.
- [x] T058 [US1] (003) Implementar la parte web de HU07 en `tecnologia/frontend/src/features/solicitudes-cotizaciones/` y `tecnologia/frontend/src/composicion/solicitudes-cotizaciones.ts`, con pruebas Vitest en `tecnologia/frontend/test/unit/solicitudes-cotizaciones/`. **Cierre.** Crear y completar un borrador con advertencias, adjuntar y confirmar imágenes, publicar, editar, cerrar y consultar versiones. Los textos dicen «cambio registrado» y nunca «notificado». Las advertencias de datos personales no prometen protección. Responsive en 360, 768 y 1366 px. **Dep.** T049, T057.
- [x] T059 [US1] (003) Ejecutar y registrar el punto de verificación de la historia en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Las pruebas de HU07 pasan y se puede publicar, editar, cerrar y cargar archivos con datos ficticios de forma independiente, con la evidencia depositada. **Dep.** T058, T057.

## Fase 4 — US2 — HU08 · Oportunidades y solicitudes dirigidas (P1)

**Objetivo.** RF14. Verificar quién ve qué solicitudes, incluida la localización de una dirigida cerrada sin haber cotizado.

### Pruebas primero

- [x] T060 [P] [US2] (003) Escribir primero las pruebas de oportunidades en `tecnologia/backend/test/integration/solicitudes-cotizaciones/oportunidades.spec.ts`. **Cierre.** Cubren CA-OPO-01 a 03 y CA-CMP-01 a 08 con las categorías A, A1, A2 y B, cobertura de distrito, servicio pausado, retirado o con clasificación inactiva, paginación determinista con total coherente (CP-304), permisos por tipo de cuenta (CP-303) y un presupuesto de sentencias SQL constante e independiente del tamaño de página (CP-306). **Dep.** T059.
- [x] T061 [P] [US2] (003) Escribir primero las pruebas del listado como prestador y del detalle por títulos en `tecnologia/backend/test/integration/solicitudes-cotizaciones/solicitudes-prestador.spec.ts`. **Cierre.** Cubren CP-301 (el destinatario localiza y lee una dirigida CERRADA sin haber cotizado), CP-302 (403 sin perfil prestador, 404 para cuentas ajenas, sin datos del cliente), CA-PRI-05 y 07, CA-CIE-03, CA-ARC-04 y CA-HIS-01 en su parte de versión vigente para un compatible. **Dep.** T059.
- [x] T062 [P] [US2] (003) Escribir primero las pruebas de contrato en `tecnologia/backend/test/contract/solicitudes-cotizaciones/oportunidades.spec.ts`. **Cierre.** Cubren `listarOportunidades003`, el parámetro `rol` de `listarMisSolicitudes003` y la vista visible de `obtenerSolicitud003`, con esquemas, errores y seguridad. **Dep.** T010, T013.

### Implementación y punto de verificación

- [x] T063 [US2] (003) Implementar las consultas de oportunidades y de «mis solicitudes como prestador» en `tecnologia/backend/src/modulos/solicitudes/infraestructura/persistencia/oportunidades.ts`. **Cierre.** `categoria_id = ANY(categorías cubiertas) AND distrito_codigo = ANY(distritos)` sobre el índice parcial de publicadas ABIERTAS, dirigidas por `prestador_cuenta_id` en cualquier estado salvo borrador e identificadores de autoría, con una sentencia de página y total por ventana. **Dep.** T060, T061.
- [x] T064 [US2] (003) Implementar los casos de uso en `tecnologia/backend/src/modulos/solicitudes/aplicacion/oportunidades.ts` y la vista del prestador en el detalle. **Cierre.** Obtienen categorías cubiertas (Catálogo) y distritos (Prestadores) una vez por petición, aplican la política de acceso por títulos y de fotografías, y no hacen consultas por elemento. Pasan las pruebas de oportunidades y de listado como prestador. **Dep.** T063, T035, T019, T017, T033.
- [x] T065 [US2] (003) Implementar los controladores de oportunidades y de la rama `rol=prestador` en `tecnologia/backend/src/modulos/solicitudes/presentacion/` y registrarlos en `tecnologia/backend/src/composicion/solicitudes-003.ts`. **Cierre.** Pasan las pruebas de contrato y el arranque en modo `prueba`. `oportunidades` queda registrada antes que `{solicitudId}`. **Dep.** T064, T062.
- [x] T066 [US2] (003) Implementar la parte web de HU08 en `tecnologia/frontend/src/features/solicitudes-cotizaciones/` (oportunidades, mis solicitudes como prestador y detalle con la política de fotografías) con pruebas Vitest. **Cierre.** Un prestador localiza una dirigida cerrada y lee su detalle sin datos del cliente. Responsive. **Dep.** T065.
- [x] T067 [US2] (003) Ejecutar y registrar el punto de verificación de la historia en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Las pruebas de HU08 pasan con datos ficticios y la evidencia depositada. **Dep.** T066, T065.

## Fase 5 — US3 — HU10 · Enviar y mantener cotizaciones (P1)

**Objetivo.** RF17 y RF18. Verificar identidad, versiones, estados derivados, retiro, concurrencia y la frontera con la 004.

### Pruebas primero

- [x] T068 [P] [US3] (003) Escribir primero las pruebas unitarias del dominio de cotizaciones en `tecnologia/backend/test/unit/solicitudes-cotizaciones/dominio-cotizacion.spec.ts`. **Cierre.** Cubren estimada y definitiva con sus campos obligatorios (`COTIZACION_INCOMPLETA`), precio en céntimos sin máximo de negocio, vigencia futura, estado efectivo con la prioridad RETIRADA, VENCIDA, PENDIENTE_REVISION y VIGENTE, indicadores y motivos de no aceptabilidad. Cubren CA-RF17-01 a 03, CA-COT-07 y CA-COT-04. **Dep.** T027.
- [x] T069 [P] [US3] (003) Escribir primero las pruebas de integración del ciclo de cotizaciones en `tecnologia/backend/test/integration/solicitudes-cotizaciones/ciclo-cotizaciones.spec.ts`. **Cierre.** Cubren CA-COT-01 a 06, 09 y 10, CA-COT-11 en su parte de prestador, CA-RF17-01 a 03, CA-PRI-05, 06 y 08, CA-HIS-01 con autores, CA-SOL-08 y los avisos de CA-AVI-04 con cotizaciones, con PostgreSQL real. **Dep.** T031, T059, T042.
- [x] T070 [P] [US3] (003) Escribir primero las pruebas de concurrencia de solicitudes y cotizaciones en `tecnologia/backend/test/integration/solicitudes-cotizaciones/concurrencia.spec.ts`. **Cierre.** Cubren CA-CON-01 a 06 con el orden de bloqueos: cierre y envío, edición y envío, retiro y actualización, retiro y reenvío, misma clave repetida a la vez, dos envíos del mismo prestador y que ninguna combinación quede bloqueada. **Dep.** T031, T059, T042, T015.
- [x] T071 [P] [US3] (003) Escribir primero las pruebas de la frontera con la 004 en `tecnologia/backend/test/integration/solicitudes-cotizaciones/frontera-004.spec.ts`. **Cierre.** Cubren CA-FRO-01 (no existe ninguna operación ni estado de selección, aceptación o contratación) y las lecturas `obtenerVigente` y `validarClienteYDisponibilidad` con sus motivos, solo lectura. Dejan escrito el contrato futuro de la 004 (E2) sin simularlo. **Dep.** T031, T059.
- [x] T072 [P] [US3] (003) Escribir primero las pruebas de contrato en `tecnologia/backend/test/contract/solicitudes-cotizaciones/cotizaciones.spec.ts`. **Cierre.** Cubren las 5 operaciones (`enviarCotizacion003`, `listarMisCotizaciones003`, `obtenerCotizacion003`, `actualizarCotizacion003` y `retirarCotizacion003`) con esquemas, errores, seguridad y ejemplos HTTP. **Dep.** T010, T013.

### Implementación y punto de verificación

- [x] T073 [US3] (003) Implementar el dominio de cotizaciones en `tecnologia/backend/src/modulos/cotizaciones/dominio/cotizacion.ts`. **Cierre.** Validaciones por tipo, estado efectivo derivado, versiones inmutables y motivos de no aceptabilidad. Pasan las pruebas unitarias. **Dep.** T068.
- [x] T074 [US3] (003) Implementar el repositorio de cotizaciones en `tecnologia/backend/src/modulos/cotizaciones/infraestructura/persistencia/cotizaciones.ts`. **Cierre.** Bloqueos `FOR UPDATE` por identificador, versiones, listados paginados con total por ventana y traducción de la violación de unicidad a `COTIZACION_EXISTENTE`. **Dep.** T031, T073.
- [x] T075 [US3] (003) Implementar los casos de uso en `tecnologia/backend/src/modulos/cotizaciones/aplicacion/` (enviar, actualizar, retirar, mis cotizaciones y detalle). **Cierre.** Con el orden de bloqueos (solicitud compartida y luego cotización), compatibilidad con la política y el conjunto de categorías cubiertas, destinatario para dirigidas, rechazo de la propia solicitud, versión de trabajo vigente (`SOLICITUD_MODIFICADA`), idempotencia y reintento acotado. Pasan las pruebas de ciclo y de concurrencia. **Dep.** T074, T026, T035, T019, T017, T015, T069, T070.
- [x] T076 [US3] (003) Implementar `obtenerVigente` y `validarClienteYDisponibilidad` en `tecnologia/backend/src/modulos/cotizaciones/api-publica.ts` y `tecnologia/backend/src/modulos/solicitudes/api-publica.ts`, y el adaptador de composición que lee estado y versión de trabajo por lote. **Cierre.** Solo lectura, con `motivosNoAceptable`. No hay operaciones de selección. Pasan las pruebas de frontera con la 004. **Dep.** T075, T071.
- [x] T077 [US3] (003) Implementar los controladores de las 5 operaciones en `tecnologia/backend/src/modulos/cotizaciones/presentacion/` y el registro `tecnologia/backend/src/composicion/cotizaciones-003.ts`. **Cierre.** Pasan las pruebas de contrato y el arranque en modo `prueba` con las operaciones de las tres primeras historias. **Dep.** T075, T072.
- [x] T078 [US3] (003) Implementar la parte web de HU10 en `tecnologia/frontend/src/features/solicitudes-cotizaciones/` (cotizar estimada o definitiva, mis cotizaciones, revisión por cambio de solicitud, retiro y reenvío) con pruebas Vitest. **Cierre.** Muestra «Requiere revisión» y «Vencida» sin afirmar que se avisó a nadie. Responsive. **Dep.** T077.
- [x] T079 [US3] (003) Ejecutar y registrar el punto de verificación de la historia en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Las pruebas de HU10 pasan con datos ficticios y la evidencia depositada. **Dep.** T078, T076, T077.

## Fase 6 — US4 — HU11 · Aclaraciones y comparación (P2)

**Objetivo.** RF18 y RF19. Verificar aclaraciones asociadas a la cotización y la comparación de hasta 10.

### Pruebas primero

- [x] T080 [P] [US4] (003) Escribir primero las pruebas de aclaraciones y comparación en `tecnologia/backend/test/integration/solicitudes-cotizaciones/aclaraciones-comparacion.spec.ts`. **Cierre.** Cubren CA-ACL-01 a 04, CA-COT-08, CA-COT-11 en su parte de cliente, CA-COT-12, CA-RF17-04, paginación determinista, un presupuesto de sentencias constante (lectura masiva de solicitudes y de nombres) y que el hilo sobrevive a las actualizaciones. Cubren CP-304 y CP-306. **Dep.** T079.
- [x] T081 [P] [US4] (003) Escribir primero las pruebas de contrato en `tecnologia/backend/test/contract/solicitudes-cotizaciones/aclaraciones.spec.ts`. **Cierre.** Cubren las 3 operaciones (`listarCotizacionesDeSolicitud003`, `enviarAclaracion003` y `listarAclaraciones003`), el parámetro `ids` (hasta 10, más devuelve `LIMITE_COMPARACION`) y los errores. **Dep.** T010, T013.
- [x] T082 [P] [US4] (003) Escribir primero las pruebas unitarias de la vista de comparación en `tecnologia/backend/test/unit/solicitudes-cotizaciones/comparacion.spec.ts`. **Cierre.** Cubren «No indicado», el rótulo de estimada, no sumar importes, no ordenar por «mejor» y señalar vencidas, pendientes de revisión y de solicitud cerrada. **Dep.** T027.

### Implementación y punto de verificación

- [x] T083 [US4] (003) Implementar aclaraciones y la vista de comparación en `tecnologia/backend/src/modulos/cotizaciones/dominio/aclaracion.ts` y `tecnologia/backend/src/modulos/cotizaciones/dominio/comparacion.ts`. **Cierre.** Texto de hasta 1 000 caracteres, 20 mensajes por hilo, sin adjuntos, inmutables, hilo asociado a la cotización. Pasan las pruebas unitarias. **Dep.** T082.
- [x] T084 [US4] (003) Implementar los casos de uso en `tecnologia/backend/src/modulos/cotizaciones/aplicacion/` y el repositorio de aclaraciones en `tecnologia/backend/src/modulos/cotizaciones/infraestructura/persistencia/aclaraciones.ts`. **Cierre.** Enviar y leer aclaraciones, listar cotizaciones de una solicitud y comparar hasta 10 con `ids`, con lectura masiva de estado de solicitudes y de nombres públicos. Pasan las pruebas de aclaraciones y comparación. **Dep.** T083, T080, T075, T017.
- [x] T085 [US4] (003) Implementar los controladores de las 3 operaciones en `tecnologia/backend/src/modulos/cotizaciones/presentacion/` y registrarlos en `tecnologia/backend/src/composicion/cotizaciones-003.ts`. **Cierre.** Pasan las pruebas de contrato y el arranque en modo `prueba` con las 18 operaciones. **Dep.** T084, T081.
- [x] T086 [US4] (003) Implementar la parte web de HU11 en `tecnologia/frontend/src/features/solicitudes-cotizaciones/` (aclaraciones, lista y comparación de hasta 10) con pruebas Vitest. **Cierre.** Muestra «No indicado», rotula las estimadas y no presenta una clasificación de «mejor». Responsive. **Dep.** T085.
- [x] T087 [US4] (003) Ejecutar y registrar el punto de verificación de la historia en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Las pruebas de HU11 pasan con datos ficticios y la evidencia depositada. **Dep.** T086, T085.

## Fase 7 — Integración, composición definitiva y regresión

**Objetivo.** Entregar la aplicación compuesta con las 58 operaciones, comprobar seguridad, concurrencia, arquitectura y compatibilidad con 001 y 002.

- [x] T088 (EXT) Ejecutar y completar `tecnologia/backend/test/integration/solicitudes-cotizaciones/arranque-completo-003.spec.ts` con `crearAplicacionCompleta003` y las 58 operaciones. **Cierre.** El inventario de 17, 23 y 18 de `contratoDeOferta`, la tabla de rutas de `configurarApi`, `verificarRouter`, la ausencia de colisiones y la no regresión de los arranques base (17) y de la 002 (40) pasan **con el ensamblador y el arranque reales**. Cubre CP-308 y R-27. **Dep.** T059, T067, T079, T087.
- [x] T089 (003) Completar las pruebas de contrato con los ejemplos HTTP y la seguridad por operación de las 18 en `tecnologia/backend/test/contract/solicitudes-cotizaciones/`. **Cierre.** Espejo idéntico, errores reales contra los esquemas y ninguna operación pública. **Dep.** T088.
- [ ] T090 (003) Completar la matriz PR04 en `tecnologia/backend/test/integration/solicitudes-cotizaciones/seguridad-end-to-end.spec.ts`. **Cierre.** Cuentas (dueño, destinatario, compatible, autor no retirado, autor retirado, ajeno y sin sesión) contra todas las operaciones, listados y archivos, con CA-SEG-01 y CP-303 al 100 % y sin modificar datos. Se ejecuta en CI. **Dep.** T088.
- [ ] T091 (003) Completar `tecnologia/backend/test/integration/solicitudes-cotizaciones/errores-concurrencia.spec.ts`. **Cierre.** CA-ERR-01 a 03: cada conflicto esperado devuelve su código, un interbloqueo forzado se reintenta o devuelve `CONFLICTO_CONCURRENTE`, y un fallo inesperado de infraestructura no deja estado parcial ni expone detalles. No promete ocultar errores inesperados. **Dep.** T088, T070.
- [ ] T092 (003) Ejecutar y completar `tecnologia/backend/test/architecture/solicitudes-cotizaciones.spec.ts` con los módulos completos. **Cierre.** PR12 pasa: sin ciclos entre `solicitudes` y `cotizaciones`, sin importar internos de otros módulos y con el dominio independiente. **Dep.** T088.
- [ ] T093 (EXT) Ejecutar y registrar la regresión de 001 y 002 con la 003 completa y con objetos `solicitudes/` presentes en el bucket. **Cierre.** Las suites de 001 y 002, los procedimientos de limpieza y de respaldo de 002 y las pruebas de aislamiento (CP-307 y CP-310) pasan. Evidencia en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Dep.** T088, T056.
- [ ] T094 (EXT) Completar el flujo `.github/workflows/solicitudes-cotizaciones.yml` y la guía de ejecución. **Cierre.** Calidad, validación 003 (PostgreSQL y almacenamiento reales, contratos, arquitectura e integración) y regresión de 001 y 002 con evidencia, sin k6 ni Playwright de 003, lo que se declara en el informe. Un resultado verde sobre el commit exacto lo registra la persona responsable. **Dep.** T088, T093, T007.
- [ ] T095 (003) Verificar y documentar E1 y E2 en `tecnologia/backend/test/integration/solicitudes-cotizaciones/diferimientos-e1-e2.spec.ts` y `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Ninguna respuesta ni texto afirma que un aviso fue enviado, entregado, visto o leído (CA-AVI-01), el único registro adicional es el aviso de la primera publicación de una dirigida (FR-344), RF13 consta como parcial y RF18 como parcial, y no existe selección ni contratación (CA-FRO-01). **Dep.** T088, T071.

## Fase 8 — Operación: limpieza, respaldo y restauración

**Objetivo.** Dejar procedimientos operativos verificables. La validación es requisito previo al uso con datos reales.

- [ ] T096 [P] (OPS) Escribir primero las pruebas de respaldo y restauración en `tecnologia/backend/test/integration/solicitudes-cotizaciones/respaldo-solicitudes.spec.ts` y `tecnologia/backend/test/integration/solicitudes-cotizaciones/restauracion-solicitudes.spec.ts`. **Cierre.** Cubren OP-301 a OP-304 con infraestructura descartable e inyección de fallos: manifiesto `COMPLETO` solo con objeto, tamaño y SHA-256 coincidentes, pareja inconsistente, objeto ausente o alterado, destino no vacío, restauración interrumpida, pausa de escrituras de archivos y de limpieza durante el corte y su reanudación. **Dep.** T059, T042.
- [ ] T097 (OPS) Implementar el respaldo coherente en `tecnologia/backend/src/modulos/solicitudes/infraestructura/respaldo/respaldo-solicitudes.ts`. **Cierre.** Corte con bloqueo compartido de `solicitudes_archivos` y `solicitudes_objetos_pendientes`, instantánea de la base, inventario de objetos `PREPARADO` y `CONFIRMADO` con SHA-256, manifiesto cifrado con permisos separados y sin credenciales ni claves en los registros. No modifica el respaldo de 002. **Dep.** T096.
- [ ] T098 (OPS) Implementar la restauración en `tecnologia/backend/src/modulos/solicitudes/infraestructura/respaldo/restauracion-solicitudes.ts` y los comandos `solicitudes:respaldar:003` y `solicitudes:restaurar:003` en `tecnologia/backend/scripts/` y `tecnologia/backend/package.json`. **Cierre.** Destino en base y prefijo nuevos con tráfico y limpieza detenidos, conciliación (una fila sin objeto no se publica, un objeto sin fila queda en cuarentena, los `PREPARANDO` inconclusos se descartan) y validación de accesos por la política. Pasan las pruebas de respaldo y restauración. **Dep.** T097, T057.
- [ ] T099 (OPS) Redactar el procedimiento operativo en `specs/003-solicitudes-y-cotizaciones/operacion.md`. **Cierre.** Describe el proceso periódico, `limpiar`, `verificar` (frecuencia: cada día laborable, antes de cada respaldo y antes de cada despliegue, a cargo del responsable operativo que designe el Product Owner), `respaldar` y `restaurar`, y los tres plazos que no deben confundirse (24 horas, 300 s y 900 s). Declara el riesgo residual de retención física temporal y que no hay borrado físico automático a las 24 horas. **Dep.** T056, T098.
- [ ] T100 (OPS) Ejecutar el ensayo de respaldo y restauración en infraestructura descartable y registrar los resultados de OP-301 a OP-304 en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Cada criterio queda en estado APROBADA, FALLIDA o PENDIENTE con evidencia. **Hasta que se ejecute, no se declara probado.** **Dep.** T098, T099.
- [ ] T101 (OPS) Registrar el requisito previo OP-307 en `specs/003-solicitudes-y-cotizaciones/implementation-status.md` y en el README del repositorio. **Cierre.** Consta que la 003 **no se usa con datos reales** hasta que OP-301 a OP-304 estén aprobados con evidencia, y el estado vigente de ese requisito. **Dep.** T100.

## Fase 9 — Extremo a extremo, rendimiento y usabilidad

**Objetivo.** Producir las evidencias de PR07, PR01 y PR06 sin heredar excepciones de la 002.

- [ ] T102 (003) Implementar y ejecutar las pruebas de extremo a extremo en `tecnologia/frontend/test/e2e/solicitudes-cotizaciones/` para los recorridos de las cuatro historias en Chromium, Firefox y WebKit a 360, 768 y 1366 px, con accesibilidad (teclado, foco, nombres, errores y contraste). **Cierre.** Pasan en los nueve proyectos con evidencia en `tecnologia/.local/evidencia/003/`. Cubre PR07 en su parte automatizada. **Dep.** T059, T067, T079, T087, T006.
- [ ] T103 (003) Realizar los recorridos manuales en un celular real y en computadora y registrarlos en `specs/003-solicitudes-y-cotizaciones/evidencia/registro-manual-pr07.md`. **Cierre.** Capturas y observaciones por recorrido. **No se hereda ninguna excepción de la 002:** si no se ejecuta, PR07 queda PENDIENTE y no se declara cumplido. **Dep.** T102.
- [ ] T104 (003) Crear `tecnologia/backend/test/performance/solicitudes-cotizaciones.k6.js` y el cargador de datos en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/carga.ts`. **Cierre.** Datos ficticios reproducibles (1 000 prestadores y 5 000 servicios de la semilla de 002, 20 000 solicitudes publicadas ABIERTAS y 40 000 cotizaciones, propuesta), mezcla de oportunidades, mis solicitudes, listado de cotizaciones y comparación, con métricas por operación y aserciones de corrección. **Dep.** T042, T087.
- [ ] T105 (003) Registrar el plan de ejecución de las consultas de oportunidades y de «mis solicitudes como prestador» con el volumen de carga en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** `EXPLAIN` confirma el uso de los índices parciales. Es informativo: un hallazgo se corrige antes de PR01. **Dep.** T088, T104.
- [ ] T106 (003) Ejecutar PR01 en el entorno de validación y registrar el resultado en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** 50 usuarios virtuales, 15 minutos y pausas de 3 a 8 s. Se compara con p95 ≤ 2 s y menos del 1 % de errores técnicos (CP-305, SC-303). **La CI no ejecuta k6:** la evidencia es local o del entorno de demostración y así se declara. **Dep.** T104, T105.
- [ ] T107 (003) Redactar el protocolo de usabilidad en `specs/003-solicitudes-y-cotizaciones/evidencia/protocolo-pr06.md` y, cuando se realice, registrar los tiempos y resultados de cinco participantes nuevos. **Cierre.** Mide el tiempo desde el inicio de la búsqueda hasta la confirmación del envío, excluyendo el registro y la espera. Si no se realiza, SC-302 queda PENDIENTE. **Dep.** T059, T067.

## Fase 10 — Documentación y cierre

**Objetivo.** Actualizar las fuentes generales con el comportamiento verificado y preparar la revisión de cierre.

- [ ] T108 [P] (DOC) Actualizar `docs/02-arquitectura-software/api-rest.md` con las 18 operaciones, el historial, la comparación por `ids`, el parámetro `rol` y los códigos de error. **Cierre.** Coincide con `contracts/README.md`. **Dep.** T088.
- [ ] T109 [P] (DOC) Actualizar `docs/03-diseno-de-software/modelo-de-datos.md` con las tablas de la 003 y `avisos_negocio`. **Cierre.** Coincide con `data-model.md`. **Dep.** T088.
- [ ] T110 [P] (DOC) Actualizar la matriz de `docs/02-arquitectura-software/seguridad-y-privacidad.md` con los títulos de acceso, las fotografías y el caso de la solicitud cerrada. **Cierre.** Coincide con la matriz de la spec. **Dep.** T090.
- [ ] T111 (DOC) Actualizar `docs/05-gestion/04-pruebas.md` con el estado real de PR01, PR04, PR06, PR07 y PR12 para la 003. **Cierre.** Cada prueba consta como APROBADA, PENDIENTE o FALLIDA con evidencia, y se aclara que la CI no ejecuta k6 ni Playwright de 003. **Dep.** T106, T107, T103, T090, T092.
- [ ] T112 [P] (DOC) Actualizar `docs/trazabilidad.md`: añadir las filas de la 003 y **corregir únicamente la fila de HU10, que cita PR11 (transiciones de la contratación, de 004 y 005), por las pruebas de la 003 que verifican la integridad de cotizaciones**. **Cierre.** La corrección es acotada, no reabre la 002 ni modifica código, y cubre CP-309. **Dep.** T088.
- [ ] T113 [P] (DOC) Registrar en `docs/05-gestion/05-riesgos.md` el problema operativo independiente de la 002 (la limpieza física del portafolio no está conectada a ningún proceso) y los riesgos de la 003 (retención física temporal y respaldo no ejecutado). **Cierre.** Son entradas de decisión para el Product Owner. **No se corrige ni se modifica el comportamiento de la 002.** **Dep.** T088.
- [ ] T114 (DOC) Consolidar los resultados en `specs/003-solicitudes-y-cotizaciones/implementation-status.md` y `specs/003-solicitudes-y-cotizaciones/checklists/requirements.md`. **Cierre.** Cada escenario, CP, OP y PR consta como PENDIENTE, EJECUTADA, APROBADA o FALLIDA con su configuración y evidencia. E1 y E2 constan expresamente. Lo no ejecutado (respaldo, PR06, PR07 manual y PR01) no se presenta como probado. **Dep.** T094, T095, T111, T101, T089, T091.
- [ ] T115 (DOC) Actualizar el estado de la 003 en `README.md` y `docs/05-gestion/02-backlog-y-sprints.md`. **Cierre.** Reflejan lo verificado, lo pendiente y los diferimientos E1 y E2 sin declarar completas las notificaciones ni la contratación. **Dep.** T114.
- [ ] T116 (DOC) Registrar la revisión independiente en sesión nueva y la revisión manual del Product Owner contra la spec y la constitución en `specs/003-solicitudes-y-cotizaciones/implementation-status.md`. **Cierre.** Constan el pull request revisado y fusionado, la evidencia de CI sobre el commit exacto y las excepciones que se hayan aprobado. Cualquier prueba aplicable en estado PENDIENTE, EJECUTADA sin evaluar o FALLIDA sin excepción aprobada impide cerrar la funcionalidad. **Dep.** T114, T113, T112, T108, T109, T110, T115.

## Trazabilidad de pruebas

| Escenarios y criterios | Pruebas | Implementación |
|---|---|---|
| CA-SOL, CA-BOR, CA-VER, CA-CIE | T043, T045, T046 | T051, T054 |
| CA-DAT (FR-348) | T044 | T052 |
| CA-ARC y FR-347 | T047, T036, T038, T040 | T055, T037, T039 |
| CA-PRI y CA-HIS | T034, T050, T061, T069, T090 | T035, T064 |
| CA-OPO y CA-CMP | T018, T060 | T019, T063, T064 |
| CA-COT y CA-RF17 | T068, T069 | T073, T075, T077 |
| CA-ACL y comparación (CA-COT-08, 11 y 12, CA-RF17-04) | T080, T082 | T083, T084 |
| CA-AVI y E1 | T020, T046, T069, T095 | T021, T054 |
| CA-CON y CA-ERR | T070, T091, T015 | T015, T075 |
| CA-FRO y E2 | T071, T095 | T076 |
| CA-SEG-01 y PR04 | T050, T090 | T035 |
| CP-301 y CP-302 (dirigida cerrada) | T061 | T063, T064 |
| CP-303 y CP-304 (permisos y paginación) | T060, T050, T090 | T064 |
| CP-305 y PR01 | T104, T106 | T063 |
| CP-306 (sin consultas repetitivas) | T060, T080 | T063, T084 |
| CP-307 y CP-310 (aislamiento del almacenamiento) | T040, T093 | T037, T041 |
| CP-308 (58 operaciones con el ensamblador real) | T009, T011, T088 | T013, T089 |
| CP-309 (HU10 y PR11) | T112 | T112 |
| OP-301 a OP-304 (respaldo y restauración) | T096, T100 | T097, T098, T099 |
| OP-305 y OP-306 (limpieza y control) | T048 | T056 |
| OP-307 (requisito previo a datos reales) | T101 | T101 |
| PR06 y PR07 | T107, T102, T103 | T058 |
| PR12 | T022, T092 | T022 |

## Cobertura por requisito

| Requisitos | Tareas de implementación | Pruebas |
|---|---|---|
| FR-301 a FR-313 (solicitudes y versionado) | T051, T053, T054, T057 | T043, T045, T046 |
| FR-314 a FR-316 y FR-348 (datos personales) | T052 | T044 |
| FR-317 a FR-323 y FR-347 (archivos) | T055, T037, T039, T056, T029 | T047, T048, T040 |
| FR-324 a FR-329 (acceso y privacidad) | T035, T064 | T034, T050 |
| FR-330 y FR-331 (historial) | T054, T057 | T046, T050 |
| FR-332 a FR-334 (oportunidades) | T063, T064, T019 | T060, T061 |
| FR-335 a FR-341 (cotizaciones y frontera con la 004) | T073, T074, T075, T076 | T069, T071, T072 |
| FR-342 y FR-343 (aclaraciones y comparación) | T083, T084 | T080 |
| FR-344 y FR-345 (avisos, E1) | T021, T054 | T020, T095 |
| FR-346 (concurrencia y errores) | T015, T025, T075 | T070, T091 |

## Dependencias y orden de ejecución

### Orden de fases

1. **Fase 1** (T001 a T008) no depende de nada y puede avanzar en paralelo en gran parte.
2. **Fase 2A** (T009 a T024) hace los cambios aditivos en 001, 002 y los componentes compartidos. **Bloquea todas las historias** y termina con la regresión T024.
3. **Fase 2B** (T025 a T042) prepara el modelo, el almacenamiento y la política de acceso. Bloquea todas las historias.
4. **US1** (HU07) es la base de las demás. **US2** (HU08) y **US3** (HU10) dependen de US1 y pueden avanzar en paralelo entre sí. **US4** (HU11) depende de US3.
5. **Fase 7** necesita las cuatro historias. Las **Fases 8 y 9** necesitan US1 y las historias que cada tarea cita. La **Fase 10** cierra.

### Dependencias críticas

- **Composición:** T009 → T010 → T012 → T013 → T088. Sin la composición generalizada ninguna operación se registra.
- **Modelo:** T029 → T031 → todas las historias. La migración de cotizaciones es previa a US1 para que los interesados y el título (c) usen datos reales desde la primera historia y no haya adaptadores sin efecto.
- **Almacenamiento:** T037 y T040 → T041 → T055. Si T040 falla, se reabre la decisión del bucket.
- **Avisos:** T021 y T033 → T054.
- **Composición definitiva:** T088 necesita T059, T067, T079 y T087. Valida las 58 operaciones con el ensamblador y el arranque reales.
- **Cierre:** T116 depende de T114, T113, T112 y de las evidencias de las Fases 8 y 9.

### Ejemplos de trabajo en paralelo

- **Fase 1.** T002, T003, T005, T006, T007 y T001 en archivos distintos.
- **Fase 2A tras la composición.** T016, T018, T020, T022, T014 y T015.
- **Fase 2B.** T034, T036, T038, T028 y T030.
- **US1, pruebas.** T043 a T050 antes de la implementación.
- **US2 y US3 a la vez** tras T059: las pruebas T060, T061 y T062, y T068, T069, T070.
- **Documentación.** T108, T109, T110, T112 y T113.


## Estrategia de implementación y entrega incremental

- **Base primero.** Fases 1 y 2 completas, con la regresión de 001 y 002 en verde antes de las historias.
- **MVP: US1.** Con HU07 se puede registrar, publicar, editar, cerrar y adjuntar imágenes a una solicitud, con versiones y avisos registrados. Es verificable por sí sola.
- **Incrementos.** US2 añade a los prestadores. US3 añade las cotizaciones y la frontera con la 004. US4 añade aclaraciones y comparación.
- **Cada historia cierra con su punto de verificación** (T059, T067, T079 y T087) antes de pasar a la siguiente en secuencia. US2 y US3 pueden llevarse en paralelo si hay capacidad.
- **Integración y operación.** La Fase 7 cierra la composición definitiva. La Fase 8 deja los procedimientos operativos. **Sin OP-301 a OP-304 aprobados con evidencia no se usa con datos reales.**
- **Evidencia honesta.** PR01, PR06, PR07 manual y el ensayo de respaldo dependen de ejecuciones reales. Hasta entonces constan como PENDIENTE.

## Decisiones y comprobaciones pendientes

1. **Aislamiento del almacenamiento.** Verificado en el repositorio, **no en ejecución**. T040 decide: si falla, se reabre la decisión de reutilizar el bucket.
2. **Responsable operativo.** El Product Owner debe designar quién ejecuta `verificar` y los procedimientos de respaldo (T099).
3. **Volumen de PR01.** Los 20 000 solicitudes y 40 000 cotizaciones son una propuesta. Se confirma o ajusta antes de T104.
4. **Respaldo y restauración.** Su ensayo (T100) puede fallar y reabrir el diseño. Es el requisito previo al uso con datos reales.
5. **Problema operativo de la 002.** La limpieza del portafolio no está conectada. T113 lo registra para decisión del Product Owner. Cablearla requeriría una autorización posterior.
6. **Cierre por excepción.** Si al cerrar queda algún PR en PENDIENTE, solo puede cerrarse con una excepción formal aprobada antes de aplicarse. No hay ninguna aprobada para la 003.
