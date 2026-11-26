# Plan de implementación — 003 Solicitudes y cotizaciones

**Rama** `003-solicitudes-y-cotizaciones` · **Fecha** 2026-11-26 · **Base** `main` en `c32f2c8`

**Entrada** [Especificación](spec.md) · **Estado** Diseño con las decisiones del Product Owner del 2026-11-26 incorporadas, previo a la implementación

## Resumen

Entregar solicitudes (HU07, RF12 y RF13), oportunidades para prestadores (HU08, RF14), cotizaciones con versiones y retiro (HU10, RF17 y RF18) y aclaraciones y comparación (HU11, RF18 y RF19). Dos módulos nuevos, **Solicitudes** y **Cotizaciones**, se integran en el monolito con la identidad de la 001 y la elegibilidad, las categorías y la cobertura de la 002. PostgreSQL es la fuente de verdad. Los archivos usan **el bucket privado existente con el prefijo `solicitudes/`**. Los avisos se **registran** de forma atómica en una tabla propia y su entrega queda para la 006. La selección y la contratación (004) no se implementan.

El análisis contra el código real identificó **incompatibilidades con la composición, el CI y la infraestructura actuales** (ver [hallazgos](#hallazgos-de-integración-con-001-y-002)). Ninguna impide la entrega. Varias obligan a hacer cambios aditivos en archivos compartidos, y una revela un problema operativo previo de la 002 que se registra aparte.

## Decisiones del Product Owner incorporadas (2026-11-26)

| N.º | Decisión | Dónde queda |
|---|---|---|
| 1 | Reutilizar el bucket privado existente con el prefijo `solicitudes/`, sin bucket ni identidad nuevos salvo necesidad justificada. Autorización estricta por solicitud y archivo. | [Almacenamiento](#almacenamiento-y-aislamiento), research R-09 |
| 2 | Proceso periódico en el monolito y comandos de limpieza y control, idempotentes, seguros entre instancias, con reintentos, trazabilidad y protección de archivos en carga. La limpieza desconectada de la 002 se registra como problema independiente y no se corrige aquí. | [Limpieza](#limpieza-física-verificable), R-10 y R-28 |
| 3 | Tareas y criterios verificables de respaldo y restauración coherentes. Su validación es requisito previo al uso con datos reales y no se presenta como probada. | [Respaldo](#respaldo-y-restauración-coherentes), R-22, OP-301 a OP-307 |
| 4 | Extensiones aditivas y estrictamente necesarias en Prestadores, Catálogo, Notificaciones, composición y CI, cada una vinculada a requisitos y a pruebas. La composición definitiva valida las 58 operaciones. | [Cambios en módulos existentes](#cambios-en-módulos-existentes), R-27 |
| 5 | Las oportunidades muestran solicitudes ABIERTAS. El destinatario de una dirigida CERRADA la localiza sin haber cotizado, con las operaciones existentes. | [Localización](#localizar-una-dirigida-cerrada), R-25 |
| 6 | Intervalo configurable de 300 s. Umbral de 15 minutos distinto de la caducidad de 24 horas. Sin precio máximo arbitrario. Límites justificados. Objetivos de PR01 conservados. | R-10 y R-24 |
| 7 | Corrección documental acotada de HU10 y PR11 en la trazabilidad. | [Documentación](#documentación-a-actualizar), R-28 |
| 8 | Composición de 58 operaciones con el ensamblador definitivo. Pruebas de permisos, paginación y rendimiento de oportunidades, sin consultas repetitivas. | R-26 y R-27 |

## Contexto técnico

| Aspecto | Diseño |
|---|---|
| Plataforma | Node.js `>=24.15.0 <25`, TypeScript, NestJS 12 con Express 5, React 19 con Vite. Monolito en Docker. |
| Persistencia | PostgreSQL 18, TypeORM 0.3 con migraciones aditivas y la unidad de trabajo existente. **Sin Redis** (R-23). |
| Archivos | Garage/S3 con AWS SDK y Sharp ya instalados. **Bucket privado existente, prefijo `solicitudes/`, misma identidad de la aplicación.** Acceso solo mediante la API. |
| API | OpenAPI 3.1 bajo `/api/v1`. JSON en español y camelCase. Errores con `codigo`, `mensaje` y `detalles`. Fechas UTC, importes en céntimos de PEN. Control de versión e idempotencia en toda mutación. |
| Pruebas | Jest, Vitest, Supertest, dependency-cruiser, Playwright, k6 y GitHub Actions. Integraciones con PostgreSQL y almacenamiento reales. |
| Escala | Cinco distritos. Hasta 5 imágenes por solicitud. Sin máximo de cotizaciones por solicitud. Páginas de hasta 50. |
| Metas | SC-303: p95 ≤ 2 s y menos del 1 % de errores técnicos en oportunidades y comparación (EQ-01 y PR01). SC-302: PR06. SC-304: PR07. |

## Verificación de la constitución

| Principios | Antes de investigar | Diseño resultante y comprobación prevista |
|---|---|---|
| I y II · módulos y capas | Diez módulos y APIs internas. | Dos módulos existentes en el C4 y extensiones aditivas en tres. `solicitudes` no importa a `cotizaciones`. Reglas nuevas de dependency-cruiser y PR12. |
| III · integridad | Una contratación activa por solicitud (004). | La 003 aporta la unicidad de cotización no retirada, versión optimista, idempotencia y estados derivados que la 004 revalida. No hay selección. |
| IV · identidad, permisos, privacidad y copias | Servidor decide por identidad, perfil y participación. Copias de seguridad. | Tres títulos de acceso, 404 sin revelar existencia, listas explícitas de campos, ningún dato de contacto, fotografías solo por la API. Respaldo y restauración coherentes (OP-301 a OP-307). PR04. |
| V · avisos con Outbox | Persistir en la transacción. Envío posterior. | Tabla `avisos_negocio` atómica e idempotente. El envío es de la 006 (E1, aprobada). |
| VI · servicios externos | Adaptadores con límite de tiempo. | Adaptador S3 con tiempos acotados y errores controlados. No hay proveedores nuevos. |
| VII · REST | Contrato por funcionalidad, `Idempotency-Key`, 409, paginación. | [Contrato](contracts/openapi.json) de 18 operaciones. Compuesto con los de 001 y 002, **58 operaciones**. |
| VIII · pagos | Fuera de alcance. | Sin efecto. |
| IX · pruebas | Una prueba por escenario. PostgreSQL real. | 109 escenarios de la spec, más los criterios CP y OP de este plan, mapeados a suites. PR01, PR04, PR06, PR07 y PR12. |
| X · stack | Redis solo para categorías y búsquedas frecuentes. | Sin Redis: lecturas personalizadas y cambiantes. Se reconsidera solo con evidencia de PR01. |
| XI · trazabilidad | HU → RF → … → prueba. | La spec y este plan citan la cadena. La implementación actualiza `docs/trazabilidad.md`. |
| XII · simplicidad | Sin colas ni infraestructura nueva sin ADR. | Sin servicios, buckets ni identidades nuevas. Se justifican en «Seguimiento de complejidad» el proceso periódico propio y la tabla de avisos. |

**Resultado antes de la investigación:** sin violaciones. **Resultado después del diseño:** sin violaciones.

## Hallazgos de integración con 001 y 002

Detalle y evidencia en [research.md](research.md), parte A.

| ID | Hallazgo verificado | Resolución |
|---|---|---|
| H-01 y H-02 | La composición admite una sola extensión y exige 17 y 23 operaciones. Las consultas y la identidad de rutas dependen del conjunto `operaciones002`. | Generalizar `crearAplicacion` y `contratoDeOferta` (R-01). Sin cambios en el adaptador HTTP. |
| H-05 | Las reglas de arquitectura nombran los módulos de la 002. | Añadir las reglas (R-02). |
| H-06 | El CI de 001 solo excluye `prestadores-catalogo`. | Ampliar los filtros y crear un flujo propio (R-16). |
| H-07 | **La limpieza física del portafolio de la 002 no está conectada a ningún proceso.** | La 003 cablea la suya (R-10). El hallazgo de la 002 se registra aparte (R-28) y no se corrige. |
| H-08 | `avisos_pendientes` está acoplada al worker de correo. | Tabla separada (R-05). |
| H-09 | La configuración valida solo bases `ayacucho_002_*`. | `configuracion-003.ts` (R-15). |
| H-03 | Las consultas no admiten parámetros repetidos ni arreglos. | La comparación usa `ids` separado por comas (R-14). |
| H-10 y H-11 | `PrestadoresApi` y Catálogo no ofrecen lo que la 003 necesita. El saneador de la 002 no es reutilizable. | Lecturas aditivas (R-04) y un adaptador propio (R-09). |
| H-17 a H-19 | El runtime ya usa **un solo bucket con prefijos** (`usuarios/` y `portafolio/`). Garage concede permisos por identidad y bucket, sin política por prefijo. | `solicitudes/` en el mismo bucket (R-09). El aislamiento es de aplicación. **Corrección:** una versión anterior de este plan decía que la 002 tenía bucket propio. Era inexacto. |

## Estructura prevista

```text
specs/003-solicitudes-y-cotizaciones/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── README.md
│   └── openapi.json
├── quickstart.md
└── tasks.md

tecnologia/
├── backend/
│   ├── contracts/solicitudes-cotizaciones.openapi.json   # espejo idéntico del contrato
│   ├── src/composicion/        # oferta-003, solicitudes-003, cotizaciones-003, configuracion-003, aplicacion-003; cambios en app.module y persistencia
│   ├── src/compartido/aplicacion/reintento-concurrencia.ts
│   ├── src/modulos/solicitudes/      # dominio, aplicacion/puertos, infraestructura (migraciones, persistencia, archivos, respaldo), presentacion, api-publica
│   ├── src/modulos/cotizaciones/     # ídem
│   ├── src/modulos/notificaciones/   # + AvisosNegocioApi y migración de avisos_negocio
│   ├── src/modulos/prestadores/api-publica.ts   # lecturas aditivas
│   ├── src/modulos/catalogo/api-publica.ts      # categoriasDeOferta
│   ├── scripts/                # migrar, almacenamiento, semilla, limpiar, verificar, respaldar y restaurar de la 003
│   └── test/{unit,integration,contract,architecture,performance}/solicitudes-cotizaciones/
├── frontend/
│   ├── src/features/solicitudes-cotizaciones/{modelos,aplicacion,infraestructura,presentacion}
│   ├── src/composicion/solicitudes-cotizaciones.ts
│   └── test/{unit,e2e}/solicitudes-cotizaciones/
├── compose.003.yaml
├── dependency-cruiser.cjs      # reglas nuevas
└── scripts/validar-001-ci.sh   # filtros ampliados
.github/workflows/solicitudes-cotizaciones.yml
```

El dominio permanece independiente de NestJS, TypeORM y otros módulos. La aplicación declara puertos y la raíz de composición conecta los adaptadores HTTP, PostgreSQL y S3.

## Cambios en módulos existentes

Todos aditivos. Ninguno cambia el comportamiento por defecto de 001 ni de 002. Cada uno queda vinculado a requisitos y protegido por pruebas.

| Módulo o archivo | Cambio | Requisitos | Pruebas de protección |
|---|---|---|---|
| `composicion/app.module.ts`, `persistencia.ts` | Segunda extensión (`oferta003`), contrato de tres documentos y migraciones de 003 | FR-330 a FR-346, constitución VII | Arranque completo con 58 operaciones. Arranque base (17) y 002 (40) sin cambios. |
| `prestadores/api-publica.ts` | `perfilPorId`, `distritosDe`, `especialidadesDe`, `nombresPublicos` | FR-302, FR-305, FR-332, FR-333, FR-343 | Contrato interno y regresión de 002. |
| `catalogo/api-publica.ts` | `categoriasDeOferta` | FR-333, FR-334 | Contrato interno, categorías A, A1 y A2 (CA-CMP). |
| `notificaciones/api-publica.ts` e infraestructura | `AvisosNegocioApi` y `avisos_negocio` | FR-344, FR-345, E1 | Atomicidad, idempotencia y que el worker de correo no los toque. |
| `compartido/aplicacion/reintento-concurrencia.ts` | Reintento acotado de conflictos | FR-346 | Unitarias y CA-ERR-02. |
| `tecnologia/dependency-cruiser.cjs` | Reglas de los módulos nuevos | PR12 | Prueba de arquitectura. |
| `tecnologia/scripts/validar-001-ci.sh` y flujo de 001 | Excluir `solicitudes-cotizaciones` | Aislamiento de CI | Ejecución de la CI de 001. |
| `docs/trazabilidad.md` (una fila) | HU10 → pruebas de la 003 en lugar de PR11 | Constitución XI | Revisión documental. |

**Los únicos cambios en los módulos de la 002 (Prestadores y Catálogo) son las lecturas aditivas de la tabla anterior, autorizadas por el Product Owner.** No se corrige la limpieza del portafolio ni ningún otro comportamiento de la 002, y no se toca su carpeta de especificación. Cualquier otra dependencia indispensable requeriría una autorización posterior.

## Diseño por responsabilidad

### Solicitudes (HU07, RF12, RF13)

- **Casos de uso:** guardar borrador, editar, publicar, cerrar, listar propias o como prestador, consultar detalle, cargar y leer archivos, consultar historial y listar oportunidades.
- **Versionado.** Versión de control y versión de trabajo en la fila (data-model §2.1). El dominio compara el estado canónico antes y después para detectar la edición idéntica y los cambios relevantes. La primera publicación crea la versión 1. El cierre y el cambio de privacidad no crean versión de trabajo.
- **Elegibilidad.** `ElegibilidadServicio.evaluar(servicioId, tx)` al guardar o cambiar el servicio y al publicar. La categoría se toma de `registro(servicioId)`. Una copia del servicio queda en la solicitud.
- **Validaciones.** Prestador existente, con perfil, distinto del cliente. Categoría efectivamente activa. Distrito canónico. Fecha desde hoy en America/Lima. Advertencias de cobertura y de especialidad. Detección de datos personales (R-17).
- **Acceso a una solicitud.** Una función pura de política recibe los tres títulos y devuelve el acceso y las reglas de fotografía (dueño, destinatario, compatible, autor no retirado). Es la **única fuente** de esa regla.

### Almacenamiento y aislamiento

- **Decisión.** Bucket privado existente (`config.s3.bucket`), prefijo `solicitudes/`, misma identidad de la aplicación, sin variables ni recursos nuevos (R-09). Es la práctica vigente de `usuarios/` y `portafolio/`.
- **Resultado de la verificación del repositorio.** Garage concede permisos por identidad y bucket. No hay política por prefijo. **El aislamiento es de aplicación:**
  - un adaptador `SolicitudesS3` con una expresión estricta de clave, que rechaza cualquier otra;
  - listados y borrados acotados al prefijo;
  - bucket sin acceso anónimo;
  - sin enlaces públicos ni firmados;
  - **autorización por solicitud y por archivo en cada lectura**;
  - los adaptadores de 001 y 002 siguen rechazando claves ajenas a su prefijo.
- **Identidad independiente: no se justifica**, porque con Garage exigiría un bucket nuevo y no reduciría el riesgo del único principal de la aplicación. **Si alguna comprobación de ejecución falla, se reabre y se justifica un bucket propio.**
- **Comprobaciones de ejecución (CP-307):** acceso anónimo, claves fuera de prefijo, adaptadores de 001 y 002 sobre objetos `solicitudes/`, y regresión de los procedimientos de 002 con esos objetos presentes. **Aún no se han ejecutado.**

### Archivos y fotografías (FR-317 a FR-323, FR-347)

- Adaptador propio con tres tiempos para la carga: preparación, guardado en S3 y publicación idempotente (R-09).
- Contadores mantenidos solo por el disparador. Caducidad dentro de la transacción que evalúa el cupo. El cierre descarta los pendientes.
- Quitar un archivo: borrado lógico, entrada de purga en la misma transacción e intento inmediato de borrado físico.

### Limpieza física verificable

Detalle en R-10. En resumen:

- **Tres plazos distintos:** caducidad lógica de 24 horas (inmediata, inaccesibilidad), intervalo del proceso de 300 s (cuándo se borra el objeto) y umbral de control de 900 s (retraso máximo tolerado sobre el vencimiento de una entrada, **no un plazo de retención**).
- **Proceso periódico** en el monolito, configurable (`SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS`, mínimo 60), con arrendamiento y `SKIP LOCKED`, idempotente, con reintentos de espera creciente y trazabilidad por entrada.
- **Protección de archivos en carga:** la entrada de preparación no se procesa antes de su vencimiento ni si la fila está `PREPARADO` o `CONFIRMADO`. Los objetos sin fila solo se informan.
- **Comandos:** `solicitudes:limpiar:003` y `solicitudes:verificar:003` (código de salida distinto de cero ante hallazgos).
- **Frecuencia operativa y responsable:** el responsable operativo designado por el Product Owner ejecuta `verificar` cada día laborable, antes de cada respaldo y antes de cada despliegue.
- **Riesgo residual (P2):** retención física temporal si el monolito está detenido. Los objetos son inaccesibles desde la API.

### Respaldo y restauración coherentes

Detalle en R-22 y criterios OP-301 a OP-307:

- Corte coherente con pausa de escrituras de archivos y de limpieza, manifiesto con inventario y SHA-256, declaración `COMPLETO` solo tras conciliar ambos lados, restauración en base y prefijo nuevos con conciliación y cuarentena de huérfanos.
- Ensayo con infraestructura descartable e inyección de fallos.
- **Requisito previo al uso con datos reales (OP-307).** **No se ha ejecutado nada de esto.** Su estado es PENDIENTE hasta que haya evidencia.

### Cotizaciones (HU10, HU11, RF17 a RF19)

- **Casos de uso:** enviar, actualizar, retirar, consultar propias, consultar detalle, listar y comparar, enviar y leer aclaraciones.
- **Identidad y unicidad:** data-model §3. El índice único parcial es la fuente de verdad. El estado efectivo, `vencida`, `requiereRevision` y `solicitudCerrada` se derivan al leer con una lectura masiva de `solicitudes/api-publica` por página.
- **Validaciones por tipo** (FR-337): estimada y definitiva, precio en céntimos sin máximo de negocio, vigencia futura.
- **Compatibilidad al enviar** con la misma función que las oportunidades, y destinatario para las dirigidas.
- **Comparación:** `ids` hasta 10, sin clasificación de «mejor».

### Localizar una dirigida cerrada

- Las oportunidades listan solo solicitudes ABIERTAS. El destinatario de una dirigida CERRADA la localiza con `GET /solicitudes?rol=prestador` y la consulta con `GET /solicitudes/{id}`, aunque no haya cotizado (R-25).
- No añade rutas. Una cuenta sin perfil prestador recibe 403. La respuesta no trae datos del cliente.
- **Criterios CP-301 y CP-302.** Cumple FR-332 («las dirigidas a él») sin modificar el texto aprobado.

### Consultas, permisos, paginación y rendimiento

- **Presupuesto de consultas** constante por petición (R-26): oportunidades usa categorías cubiertas, distritos y una sentencia de página con total por ventana. Los listados de cotizaciones usan una lectura masiva de solicitudes y otra de nombres. **Ninguna consulta se repite por elemento.**
- **Permisos** por título en cada listado y detalle. **Paginación** determinista, con total coherente en la misma lectura.
- **Rendimiento:** PR01 sobre oportunidades, mis solicitudes, listado y comparación, con índices parciales verificados con `EXPLAIN`.

### Notificaciones y avisos (E1)

- `AvisosNegocioApi.registrar(avisos, tx)` en `notificaciones/api-publica`. Adaptador de interesados en `composicion/`. Casos exactos de FR-344. Sin entrega ni lectura. Sin texto libre en las filas.

### HTTP, composición y contrato

1. **Fuentes.** Contrato de la 003 en `specs/003-…/contracts/openapi.json` y su espejo en `tecnologia/backend/contracts/`. Una prueba exige igualdad, como en la 002.
2. **Composición definitiva.** Generalización mínima de `crearAplicacion` y `contratoDeOferta` (R-01). La validación de las **58 operaciones** se hace con el arranque real (`crearAplicacionCompleta003`), el inventario de 17, 23 y 18, la tabla de rutas de `configurarApi` y `verificarRouter` (R-27). **La verificación hecha hasta ahora usó el ensamblador de documentos del repositorio en un script de solo lectura. No sustituye al arranque real.**
3. **Carga.** `x-limite-cuerpo-bytes: 14000000` y `contenidoBase64` activan la protección existente de imagen sin cambiar el adaptador.
4. **Rutas literales y parametrizadas.** `oportunidades` se registra antes que `{solicitudId}`. La verificación existente del router detecta el orden incorrecto.
5. **Errores.** Se reutilizan los códigos existentes y se fijan los nuevos en el contrato.

### Idempotencia, concurrencia y errores

Idempotencia reutilizada tal cual (R-08). Orden global de bloqueos y escenarios abajo. Reintento acotado de interbloqueos (R-11).

### Frontend (R-21)

- Recorridos: crear y completar un borrador con advertencias y archivos, publicar, editar, cerrar, ver versiones, oportunidades, **mis solicitudes como prestador**, cotizar, revisar y retirar, aclaraciones y comparar.
- Los textos de avisos dicen «cambio registrado» o «requiere revisión» y **nunca** «notificado». Las advertencias de datos personales no prometen protección. Las vistas siguen las convenciones de sesión y responsive existentes.

## Orden de bloqueos y escenarios concurrentes

Orden único: **1** idempotencia → **2** revisión de oferta (compartida, solo si se evalúa un servicio) → **3** solicitud (`FOR UPDATE` en creación, edición, publicación, cierre y archivos; `FOR SHARE` en envío, actualización, retiro y aclaraciones) → **4** cotización (`FOR UPDATE`) → **5** filas hijas → **6** avisos. Las operaciones que parten de una cotización leen su `solicitud_id` (inmutable) sin bloquear y siguen el mismo orden. Los disparadores solo actualizan la fila de la solicitud ya bloqueada. La edición no escribe en cotizaciones.

| Escenario | Resultado | Escenarios |
|---|---|---|
| Cierre y envío simultáneos | Se serializan por la solicitud. Si gana el cierre, el envío recibe 409 `SOLICITUD_NO_ABIERTA`. | CA-CON-01 |
| Edición relevante y envío simultáneos | El envío con versión anterior recibe 409 `SOLICITUD_MODIFICADA`. Si entró antes, queda pendiente de revisión. | CA-CON-02 |
| Retiro y actualización simultáneos | La cotización se bloquea. El segundo recibe 409. | CA-CON-03 |
| Retiro y reenvío simultáneos | El reenvío espera al retiro. Nunca hay dos posiciones no retiradas. | CA-CON-04 |
| Dos envíos del mismo prestador | Uno gana y el otro recibe `COTIZACION_EXISTENTE`. | CA-COT-01 |
| Misma clave repetida a la vez | El trabajo se ejecuta una vez. | CA-CON-05 |
| Cargas simultáneas de archivos | Exactamente el cupo permitido. | CA-ARC-01 |
| Limpieza de varias instancias | Cada entrada la procesa una sola instancia. | OP-305 |
| Operaciones mezcladas en cualquier orden | Sin bloqueo indefinido. | CA-CON-06 |
| Conflicto persistente tras reintentos | 409 `CONFLICTO_CONCURRENTE`. | CA-ERR-02 |
| Fallo inesperado de infraestructura | Sin estado parcial y sin detalles internos. | CA-ERR-03 |

## Frontera con 004 y 006

- **Qué ofrece la 003:** `obtenerVigente(cotizacionId, versionCotizacion, tx)` con `motivosNoAceptable` y `validarClienteYDisponibilidad(solicitudId, actorCuentaId, tx)`, ambas de solo lectura. Sin rutas ni estados de selección.
- **Contratos futuros** (no se implementan ni se simulan): la 004 añadirá `registrarContratacion` y el retiro de la selección pendiente en la edición, a `solicitudes/api-publica`, y `marcarSeleccionada`, `marcarNoSeleccionadas` y la guarda de retiro de una seleccionada, a `cotizaciones/api-publica`, con sus migraciones. La 006 añadirá el envío, la lectura y los canales sobre `avisos_negocio`.
- **Diferimientos aprobados** E1 y E2 (spec, sección propia). Esta planificación no los amplía.

## Criterios adicionales de esta planificación

Complementan los escenarios de la spec. No la modifican.

| ID | Criterio | Origen |
|---|---|---|
| CP-301 | El destinatario de una dirigida CERRADA, sin cotización, la localiza con `GET /solicitudes?rol=prestador` con `titulos: [DESTINATARIO]` y la lee con `GET /solicitudes/{id}`. | FR-324, FR-332, R-25 |
| CP-302 | `rol=prestador` sin perfil prestador devuelve 403. Una cuenta ajena recibe 404 en el detalle. Ninguna respuesta trae datos del cliente. | FR-329, R-25 |
| CP-303 | Matriz de permisos de los listados (oportunidades, mis solicitudes con ambos roles, mis cotizaciones, listado del cliente) por tipo de cuenta. | PR04 |
| CP-304 | Paginación determinista: orden estable, total coherente con la página y tamaño máximo respetado. | R-26 |
| CP-305 | PR01 sobre oportunidades, mis solicitudes, listado y comparación: p95 ≤ 2 s y menos del 1 % de errores técnicos, con el perfil de la 002. | SC-303 |
| CP-306 | El número de sentencias SQL por petición es constante e independiente del tamaño de página. | R-26 |
| CP-307 | Aislamiento del almacenamiento: acceso anónimo falla, claves fuera de prefijo rechazadas, adaptadores de 001 y 002 sin acceso a `solicitudes/`, y los procedimientos de 002 intactos. | R-09 |
| CP-308 | Arranque completo con 58 operaciones, 17 en el arranque base y 40 en el de 002, sin colisiones. | R-27 |
| CP-309 | La fila de HU10 de `docs/trazabilidad.md` ya no cita PR11 y apunta a las pruebas de la 003. | R-28 |
| CP-310 | Regresión de 001 y 002 con objetos `solicitudes/` presentes en el bucket. | R-09 |
| OP-301 a OP-307 | Respaldo, restauración, limpieza y control operativos. | R-22 y R-10 |

## Operación

- **Variables nuevas:** solo `SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS` (300, mínimo 60) y `SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS` (900, al menos tres intervalos). **Ninguna credencial ni bucket nuevo.**
- **Comandos nuevos:** migrar, preparar y comprobar el almacenamiento, sembrar datos de prueba, limpiar, verificar, respaldar y restaurar.
- **Registros:** los logs no incluyen texto de solicitudes, aclaraciones ni datos personales, y registran operación y resultado agregado.

## Validación y evidencia

| Cobertura | Ensayos previstos |
|---|---|
| Dominio y casos de uso (sin base de datos) | Versionado y edición idéntica, datos personales (tabla de la spec y falsos positivos), política de acceso por títulos, estado derivado, validación de cotizaciones, conjunto de categorías cubiertas, límites. |
| Integración con PostgreSQL y almacenamiento reales | Escenarios de la spec, CP-301 a CP-304, CP-306, CP-307 y CP-310. Disparadores, índices, atomicidad de avisos, idempotencia, limpieza y su control, y presupuesto de consultas. **Prueba de integración con escritura real para la elegibilidad de la 002**, que solo se probó con un doble. |
| Contratos | Espejo idéntico, composición de 58 operaciones, esquemas, errores, seguridad por operación y ejemplos HTTP. CP-308. |
| Arquitectura | PR12 con las reglas nuevas, sin ciclos entre `solicitudes` y `cotizaciones`. |
| Seguridad (PR04) | Matriz de cuentas (dueño, destinatario, compatible, autor, retirado, ajeno, sin sesión) para cada operación, listado y archivo. CA-SEG-01 y CP-303. En CI. |
| Regresión | 001 y 002 sobre sus infraestructuras efímeras, más las lecturas aditivas y la composición. |
| Respaldo y restauración | Ensayo aislado con inyección de fallos (OP-301 a OP-304). **Pendiente de ejecutar.** |
| Rendimiento (PR01) | k6 con 1 000 prestadores y 5 000 servicios, 20 000 solicitudes publicadas y 40 000 cotizaciones (propuesta), 50 usuarios, 15 minutos, pausas de 3 a 8 s. **La CI no ejecuta k6**: la evidencia es local o del entorno de demostración, y así se declara. |
| Usabilidad (PR06) | Observación con cinco participantes nuevos y protocolo escrito. Si no se realiza queda PENDIENTE. |
| Adaptabilidad (PR07) | Playwright en tres navegadores y tres anchos, más recorridos manuales en un celular real. Sin excepción heredada. |

**Aislamiento de CI.** Flujo `solicitudes-cotizaciones.yml` con calidad, validación 003 y regresión de 001 y 002. Se amplían los filtros de 001 para excluir `solicitudes-cotizaciones` y se comprueba que los de 002 no capturen las pruebas nuevas.

## Documentación a actualizar

`api-rest.md` (18 operaciones, historial, comparación por `ids` y `rol`), `modelo-de-datos.md`, la matriz de `seguridad-y-privacidad.md`, `04-pruebas.md`, el README y los mapas de contratos y de regresión. **Corrección acotada de `docs/trazabilidad.md`:** la fila de HU10 cita PR11, que es de 004 y 005. Se sustituye por las pruebas de la 003, sin reabrir la 002 ni tocar código.

**Problema operativo independiente (002).** La limpieza física del portafolio no está conectada. Se registra en la matriz de riesgos (`docs/05-gestion/05-riesgos.md`) para decisión del Product Owner. No se modifica la 002.

## Riesgos y excepciones

| Riesgo | Tratamiento |
|---|---|
| Se modifican archivos compartidos (composición, persistencia, reglas, CI de 001). | Valores por defecto sin cambios, regresión de 001 y 002 y revisión en el PR. |
| Aislamiento entre prefijos solo de aplicación. | Igual que `usuarios/` y `portafolio/`. Controles de R-09 y pruebas CP-307. Se reabre si fallan. |
| Retención física temporal de archivos eliminados o caducados. | Inaccesibles por la API. Proceso periódico, comando y control diario. Documentado (P2). |
| La limpieza de la 002 no está conectada. | Registrado como problema independiente. No se corrige en la 003. |
| Respaldo y restauración sin ejecutar. | OP-307: requisito previo al uso con datos reales. Estado PENDIENTE hasta que haya evidencia. |
| Dos lecturas de compatibilidad no son atómicas. | Divergencia de milisegundos con una desactivación concurrente. Aceptable y documentada. |
| Duplicación del saneador de imágenes. | Deuda técnica registrada. |
| Prestadores sin aviso proactivo hasta la 006. | E1, aprobada. |
| La 004 no honra el contrato de lectura. | E2, aprobada, y la trazabilidad de «Frontera con 004 y 006». |
| Datos personales no detectables en texto libre. | Advertencia. Sin garantía. El texto anterior queda en versiones. Aceptado en la spec. |
| PR06 depende de participantes. | Queda PENDIENTE si no se realiza. |

## Seguimiento de complejidad

| Elemento | Por qué es necesario | Alternativa más simple descartada |
|---|---|---|
| Proceso periódico propio de limpieza | P2 exige un procedimiento verificable y no hay uno reutilizable (H-07). Tiene precedente en la limpieza de la 001. | Solo comando manual: depende de que alguien lo ejecute. |
| Tabla `avisos_negocio` en Notificaciones | Atomicidad con la operación (constitución V) sin tocar el worker de correo. | Reutilizar `avisos_pendientes`: riesgo de enviar avisos de negocio por correo. |
| Generalización mínima de la composición | Imprescindible para registrar una segunda extensión. | Anidar la 003 en el registro de la 002: acopla ciclos y CI. |
| Procedimiento propio de respaldo y restauración | El de la 002 cubre solo el portafolio. La constitución IV exige copias coherentes. | Ampliar el de la 002: modificaría código ajeno. |
| Parámetro `rol` en el listado de solicitudes | Resuelve la localización de dirigidas cerradas sin una ruta nueva. | Una operación nueva: amplía el contrato sin necesidad. |
