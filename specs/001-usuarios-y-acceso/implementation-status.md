# Estado de implementación: fundación, US1–US3 y US5 de 001

Fecha local: 2026-11-17 (America/Mexico_City). Continuación autorizada:
**solo US5, T063–T076**, desde la primera tarea pendiente T063.
**14/14 implementadas y verificadas localmente**. Se conservan US1–US3 y TLS.
El backlog mantiene **119 tareas: 76 terminadas y 43 pendientes**; la siguiente
es **T077 (US4), no iniciada**. Se acreditan acumulativamente 36 de los 53 CA:
11 REG, nueve SES, diez REC y seis PER nuevos. La auditoría posterior de esta
sección complementa la evidencia histórica de REC sobre el código actual.
Los otros 17 CA y la DoD global de CI, revisión y fusión permanecen pendientes.

## Auditoría de regresión US3 → US5 (2026-11-17)

Se compararon primero los JUnit y JSON históricos, sin reescribirlos. La diferencia
de cifras corresponde a **selección de suites**, no a cinco o una pruebas borradas:
el cierre US5 seleccionó fundación/registro/sesiones/perfil y dejó fuera recuperación.
La justificación de aplazar T110 se refiere a las **nuevas variantes conjuntas de
recuperación y edición de perfil**; no sustituye la regresión independiente de
recuperación tras cambios compartidos. Esa ausencia se trató como un vacío y se
cubrió ejecutando solamente las suites existentes de recuperación, sin desarrollar
ni marcar T110 y sin iniciar US4.

### Comandos e inclusión efectiva en los cierres

Directorio de trabajo backend: `tecnologia/backend`. Los scripts de `package.json`
seleccionan el proyecto Jest `unit`, `integration` o `contract`; `jest.config.mjs`
descubre `test/<proyecto>/**/*.spec.ts`. El filtro adicional de US5 seleccionó los
archivos cuyo nombre/ruta coincide con fundacion, registro, sesiones o perfil.

| Nivel | Cierre US3 | Cierre US5 |
|---|---|---|
| U | `npm.cmd run test:unit` | `npm.cmd run test:unit -- --testPathPatterns fundacion registro sesiones perfil --no-cache` |
| I | `npm.cmd run test:integration -- --runInBand` | `npm.cmd run test:integration -- --runInBand --testPathPatterns fundacion registro sesiones perfil --no-cache` |
| C | `npm.cmd run test:contract -- --no-cache` | `npm.cmd run test:contract -- --testPathPatterns fundacion registro sesiones perfil --no-cache` |

Los JUnit no contienen argv: estos comandos proceden del registro de ejecución y
del cierre documentado. La inclusión real se comprobó por las identidades
`classname + name`, multiplicidad, número de casos y estados en cada reporte,
no deduciéndola únicamente del comando o del total.

Las rutas I son relativas a `tecnologia/backend/test/integration/`; las C, a
`tecnologia/backend/test/contract/`. Cada fila identifica un archivo en ambas raíces:

| Archivo / suite | I US3 | I US5 | C US3 | C US5 |
|---|---:|---:|---:|---:|
| `fundacion.spec.ts` | 6 | 6 | 5 | 5 |
| `usuarios-acceso/registro.spec.ts` | 10 | 10 | 26 | 26 |
| `usuarios-acceso/sesiones.spec.ts` | 19 | 19 | 13 | 13 |
| `usuarios-acceso/recuperacion.spec.ts` | 14 | 0 | 9 | 0 |
| `usuarios-acceso/perfil.spec.ts` | 0 | 9 | 0 | 8 |
| **Total** | **49** | **44** | **53** | **52** |

Por tanto: **49 − 14 REC + 9 PER = 44** en integración y
**53 − 9 REC + 8 PER = 52** en contrato. Los 35 casos I y 44 C comunes de
fundación/US1/US2 permanecen presentes, con las mismas identidades y aprobados.

La comparación también comprobó los demás niveles para evitar una conclusión
incompleta sobre US1–US3:

- U: US3 incluía `tecnologia/backend/test/unit/fundacion.spec.ts` y
  `usuarios-acceso/{registro,sesiones,recuperacion}.spec.ts` bajo esa raíz;
  10 + 32 + 15 + 11 = 68. US5 reemplazó recuperación por `perfil.spec.ts`
  (14): 71. Los 11 REC quedaron fuera de ese comando.
- V, desde `tecnologia/frontend`: US3 ejecutó `npm.cmd run test:unit` con
  `test/unit/fundacion.test.ts` y
  `test/unit/usuarios-acceso/{registro,sesiones,recuperacion}.test.tsx`;
  7 + 7 + 9 + 6 = 29. US5 ejecutó `npm.cmd run test:unit -- test/unit/fundacion.test.ts test/unit/usuarios-acceso/registro.test.tsx test/unit/usuarios-acceso/sesiones.test.tsx test/unit/usuarios-acceso/perfil.test.tsx`;
  añadió ocho PER y no seleccionó los seis REC: 31.
- E, desde `tecnologia/frontend`: US3 ejecutó `npm.cmd run test:e2e:container`
  y `npm.cmd run test:e2e:windows`, con `test/e2e/fundacion.spec.ts` y
  `test/e2e/usuarios-acceso/{registro,sesiones,recuperacion}.spec.ts`.
  Cada entorno tuvo nueve proyectos: 9 fundación + 18 REG + 9 SES + 9 REC = 45.
  US5 pasó los cuatro archivos explícitos `test/e2e/fundacion.spec.ts`,
  `test/e2e/usuarios-acceso/registro.spec.ts`, `sesiones.spec.ts` y `perfil.spec.ts`
  (los tres últimos bajo `test/e2e/usuarios-acceso/`) a ambos scripts mediante
  `npm.cmd run <script> -- <archivos>`; sustituyó nueve REC por nueve PER y
  conservó el total 45. Las repeticiones posteriores de US5 seleccionaron solo
  `test/e2e/usuarios-acceso/perfil.spec.ts`: no aportaban cobertura de REC.

Los reportes comparados son los cuatro JUnit bajo
`tecnologia/.local/evidencia/001/us3/` y `us5/`, más
`us3/e2e-linux/playwright.json`, `us3/e2e-windows/playwright.json`,
`us5/e2e-linux/playwright.json` y
`us5/matriz-final/e2e-windows/playwright.json`, todos relativos a la misma raíz
`tecnologia/.local/evidencia/001/`. Los reintentos/incidentes históricos de US3 y
US5 siguen en sus carpetas; no explican esta diferencia de selección.

### Comprobación de permanencia y cierre del vacío

- Se inventariaron por hash los **20 archivos anteriores** de fundación, registro,
  sesiones y recuperación, en backend U/I/C y frontend V/E. Permanecen iguales
  al HEAD `7f19964a8453dd41db95ac1f283aca92c702d45d`, que contiene US3.
  No se eliminaron casos ni se añadieron `skip`, `todo` u `only` a esas suites.
- Los casos ausentes en US5 fueron exactamente REC: 11 U, 14 I, nueve C, seis V
  y nueve E por entorno. Los casos nuevos fueron exclusivamente PER. No hay
  desapariciones o renombres de casos de fundación/registro/sesiones.
- No hubo casos omitidos en los reportes de cierre comparados. REC estuvo
  **excluida por el filtro**, no marcada como skipped por el ejecutor.
- Se repitieron únicamente los cinco archivos de recuperación ya existentes,
  con PostgreSQL/Mailpit reales y TLS estricto donde corresponde. No se modificó
  aplicación ni pruebas durante esta auditoría.

| Ejecución complementaria | Comando | Resultado |
|---|---|---:|
| U, backend | `npm.cmd run test:unit -- --testPathPatterns=recuperacion --no-cache` | **11/11** |
| I, backend | `npm.cmd run test:integration -- --runInBand --testPathPatterns=recuperacion --no-cache` | **14/14** |
| C, backend | `npm.cmd run test:contract -- --testPathPatterns=recuperacion --no-cache` | **9/9** |
| V, frontend | `npm.cmd run test:unit -- test/unit/usuarios-acceso/recuperacion.test.tsx --outputFile=../.local/evidencia/001/auditoria-us3-us5/frontend-recuperacion-junit.xml` | **6/6** |
| E Linux, frontend | `npm.cmd run test:e2e:container -- --sin-construir test/e2e/usuarios-acceso/recuperacion.spec.ts` | **9/9** |
| E Windows, frontend | `npm.cmd run test:e2e:windows -- test/e2e/usuarios-acceso/recuperacion.spec.ts` | **9/9** |

Se reutilizó la imagen Linux verificada de US5 por el mismo digest. Los nuevos
JUnit se dirigieron mediante `JEST_JUNIT_OUTPUT_DIR` y `JEST_JUNIT_OUTPUT_NAME`
a `tecnologia/.local/evidencia/001/auditoria-us3-us5/`; Vitest usó `--outputFile`
y Playwright `E2E_EVIDENCIA` en esa carpeta, sin sobrescribir los cierres.
Las identidades de todos los REC repetidos coinciden con las ausentes de US5 y
presentes en US3. Salidas 0, cero fallos/omisiones y cero reintentos E.

La unión verificable de US5 y estas ejecuciones complementarias cubre 82 U,
**58 I**, **61 C**, 37 V y 54 E por entorno, incluidos PER y todos los anteriores.
Son casos únicos consolidados de ejecuciones disjuntas, **no** una ejecución
monolítica nueva ni una acreditación de T110. Los totales históricos 49/53 y 44/52
se conservan tal como se ejecutaron.

Evidencia nueva ignorada: `tecnologia/.local/evidencia/001/auditoria-us3-us5/`.
`inventario-inicial.json` registra cada identidad, diferencias, archivos y hashes;
`comandos.json`, comandos y directorios; `verificacion.json`, comprobaciones y
resultados consolidados; JUnit/JSON/HTML y `ejecucion.json`, resultados nuevos;
`secretos-reportes.json`, inspección sin hallazgos de tokens, incluidos los ZIP
HTML. Se comprobaron **83 archivos históricos sin ninguna alteración de hash**.

**Resultado: regresión independiente de US1–US3 cubierta sobre el código actual,
sin bloqueo real de esta auditoría.** T110 sigue pendiente de las variantes
conjuntas nuevas y sus demás dependencias; T077/US4 no se inició. El corpus
productivo aprobado y los demás pendientes/limitaciones históricos se mantienen.

## Resultado de US5

- `GET /api/v1/perfil` obtiene la cuenta desde la sesión vigente. Devuelve solo
  el DTO privado Perfil: identidad, nombre de persona o empresa, correo de lectura,
  teléfono/distrito/foto nullable, perfiles habilitados, versión y consentimiento
  efectivo. No devuelve hash, tokens, HMAC ni datos de otra cuenta. La consulta
  general permite usar los perfiles existentes tras recargar, sin la proyección
  provisional en memoria que US1 mantenía hasta esta historia.
- `PATCH /api/v1/perfil` admite únicamente nombre para mostrar, teléfono, distrito,
  fotografía y decisión explícita de compartir teléfono, además de la versión.
  Conserva los límites de 200/32/100 puntos de código, Unicode válido, nombre no
  vacío y opcionales nullable. UUID, correo, contraseña, perfiles y administración
  no son editables aquí. US6 y US7 continúan pendientes.
- Bloqueo de cuenta→sesión y compare-and-set de versión; toda modificación efectiva
  incrementa la versión del agregado. Un no-op no la incrementa. Campos no enviados,
  identidad, credenciales y privacidad de registro permanecen intactos. La versión
  obsoleta devuelve 409 sin sobrescritura. Resultado idempotente y cambios de
  perfil, consentimiento y referencias de foto se confirman en el mismo commit.
  El replay exige sesión vigente; otro cuerpo con la misma clave devuelve 409.
- Migración `007-consentimientos.ts`: titular, HMAC del teléfono, fechas del servidor
  y versión. Registrar un número no crea autorización. `true` explícito autoriza
  el valor vigente o enviado; `false` retira. Cambiar el número revoca la autorización
  anterior y no la revive al volver al número previo. El HMAC separa propósito,
  cuenta y valor, y verifica claves conservadas ante rotación sin guardar otro
  teléfono en claro en la tabla de consentimiento.
- La proyección compartible **interna** de T069 queda entregada y probada en U/I/C:
  allowlist de nombre, distrito y perfiles; teléfono solo con consentimiento
  efectivo del mismo valor. Excluye correo, documentos, dirección exacta,
  identificadores internos y credenciales. No crea endpoint público ni RF10.
  US4 reutilizará esta función en T082.
- `POST /perfil/fotografias` valida MIME, base64 canónico, contenido JPG/PNG/WEBP
  y máximo de 10000000 bytes, almacena el objeto y crea una referencia propia
  temporal con resultado idempotente. Subir no guarda todavía el perfil.
  `GET /perfil/fotografias/{fotografiaId}` comprueba propietario antes del objeto
  y devuelve solo JSON/base64. Foto ajena, inexistente o no utilizable → 404;
  objeto ausente/corrupto → 503, sin publicar bucket ni clave.
- PATCH solo vincula una foto propia utilizable. Reemplazar/quitar marca la anterior
  para eliminación en el commit; no la borra antes de confirmar. Si falla DB,
  conserva foto vigente, campos y consentimiento. Fallos de compensación dejan
  huérfanos que la limpieza existente recupera. Las pruebas aíslan objetos con
  prefijos únicos y comprueban eliminación y preservación de referencias activas.
- Web `/cuenta` y `/habilitar-perfil`: consulta real, edición, incorporación de
  perfiles y foto obtenida por API mediante object URL revocada al cambiar o
  desmontar. La autorización del teléfono es un control independiente y se
  desmarca al editar el valor. El formulario distingue carga temporal y guardado;
  bloquea controles durante ambas operaciones. Un 409 conserva el borrador y
  exige recarga explícita, sin reintentar con otra versión automáticamente.
  Los cambios de correo/contraseña se indican como próximos flujos específicos.
  No se presentan como operativos. Intentos pendientes se retiran al perder sesión.

## Trazabilidad y pruebas de US5

HU02 → RF05 → FR-015–018/021/031 → AC04/EQ-04 y EQ-07 → DA03/DA10 →
ADR-002/003/004/005/006/011 → Usuarios y acceso → PR04/PR07/PR12 → 001.

| Tareas | Componentes principales | Evidencia propia |
|---|---|---|
| T063, T068–T070 | Dominio de consentimiento/edición, migración/entidad, DTO privado y proyección compartible | 14 U sin DB: allowlist, Unicode/límites, valor autorizado, retiro/cambio y exclusión de privados. |
| T064, T070–T071 | Consulta/actualización, repositorios de perfil/consentimiento y fotografías | 9 I: PostgreSQL real y S3 compatible, persistencia, dos ediciones simultáneas, replay, revocación previa, rollback completo, objetos ausentes y cleanup tras compensación fallida. |
| T065, T069, T072 | Controladores de perfil/fotos y composición | 8 C: cuatro operaciones, DTO OpenAPI, 400/401/404/409/413/503, titularidad, propiedades prohibidas, proyección interna serializada y límite inclusivo de imagen. |
| T066, T073–T074 | Casos web, Perfil/EditarPerfil y foto por API | 8 V: empresa/opcionales, errores, conflicto/borrador, autorización no heredada, carga temporal frente a guardado y revocación de object URL. |
| T067, T075–T076 | Rutas, cuenta con ambos perfiles y pruebas E | Nueve proyectos por entorno: consulta/edición/recarga, foto, dos sesiones editoras independientes, conflicto y consentimiento true/false/cambio de número. |

Archivos de prueba `perfil.spec.ts` en backend U/I/C y frontend E, y
`perfil.test.tsx` en frontend V, bajo las raíces de la matriz normativa.
Los nombres conservan CA-PER-01–06; `cobertura-us5.json` vincula cada CA con todos
sus niveles requeridos. No es cobertura de líneas ni sustituye T115.

## Verificación de US5 y regresiones pertinentes

| Comprobación | Resultado |
|---|---|
| Backend U/I/C | **71/71**, **44/44**, **52/52**; 14/9/8 nuevas, más fundación/US1/US2; salida 0 |
| Frontend V | **31/31**; ocho nuevas y 23 de fundación/US1/US2 |
| Tipos, lint y compilación | Aprobados en ambos proyectos |
| Arquitectura | Sin infracciones: 122 módulos y 368 dependencias |
| Linux Chromium/Firefox/WebKit × 360/768/1366 | **45/45**, cero omitidos/reintentos; incluye nueve US5 y 36 de regresión |
| US5 al reanudar, con consulta sincronizada | **9/9 Linux y 9/9 Windows**, cero omitidos/reintentos |
| Windows nativo, misma matriz completa | **45/45**, cero omitidos/reintentos |
| Imagen backend compilada | UID 1000, Argon2 nativo, salud 200/503/503; perfil/foto sin sesión 401/401; controles previos de sesiones/recuperación conservados |
| Proxy HTTPS | Salud/web 200; excesos de 64 KiB/14 MB → 413 JSON y no-store |

Se aplicó la migración 007 en validación; las suites verificaron todas las
migraciones en DB aisladas. TLS, CA, certificados, hostname, Caddy, confianza y
`ignoreHTTPSErrors:false` no se modificaron. Se conservan los controles negativos
por proyecto y la limitación documentada del inspector SameSite de WebKit Windows.

Las U/V iniciales fallaron por módulos ausentes antes de implementar. La prueba C
de imagen grande descubrió un `RangeError` del formato byte de ajv-formats y un
400 incorrecto: se reemplazó la expresión agrupada por validación base64 canónica
acotada y se comprueba el tamaño decodificado antes del esquema. Se verificaron
una imagen válida de exactamente 10000000 bytes y el rechazo 413 de 10000001,
sin cambiar los límites ni el contrato. El primer filtro de Jest con alternancia
se corrigió para npm/Windows; no llegó a ejecutar pruebas. No reapareció el cierre
nativo histórico de Jest en la regresión final sin caché.

Evidencia ignorada: `tecnologia/.local/evidencia/001/us5/`, con JUnit U/I/C/V,
`cobertura-us5.json`, `verificacion.json`, salidas, `contenedor.json`, `proxy.json`,
`secretos-reportes.json`, primera matriz Linux y smoke Chromium.
`matriz-final/e2e-linux/` conserva el intento 7/9 y sus dos fallos;
`matriz-final/e2e-windows/`, la matriz nativa completa 45/45.
`reanudacion/e2e-linux/` y `reanudacion/e2e-windows/` conservan los 9/9
recorridos de US5 en cada entorno tras corregir la sincronización.
Se inspeccionan también los ZIP embebidos de los reportes HTML para patrones de
token de recuperación, Bearer y cookie sin redactar, sin imprimir valores.

La ejecución se reanudó tras el límite de uso. Se recuperaron los resultados de
71 U, 44 I, 52 C, 31 V y ambas matrices completas 45/45. La repetición Linux
posterior quedó en 7/9: WebKit 768/1366 agotó la aserción de cinco segundos mientras
la pantalla mostraba «Cargando mi cuenta…». Al retomar, Docker y los servidores
estaban detenidos. Se restauraron sin cambiar TLS. La prueba ahora espera el
GET `/perfil` real con status 200 antes del contenido, también al recargar o abrir
otro editor. Mantiene el presupuesto total y no introduce retry automático.
No se cambió código funcional al reanudar; se repitieron los nueve proyectos
US5 en Linux y Windows y pasaron tipos/lint afectados. El intento fallido se conserva.

**Bloqueos de US5: ninguno.** Se detiene después de T076; T077/US4 y posteriores
no se inician. La regresión **conjunta recuperación/perfil queda pendiente en
T110**, según el orden corregido: esta entrega no la adelanta ni la acredita.
US3 conserva sus diez CA y evidencia de la entrega anterior.

El corpus completo, versionado y aprobado de producción sigue pendiente del
despliegue; el fixture no lo sustituye y se rechaza en producción. Se conserva
íntegro el histórico US1–US3, incluidos incidentes de Jest, navegación por
fragmento, reportes redactados y limitaciones TLS/plataforma. La consulta de perfil
que esos históricos reservaban a US5 queda resuelta aquí; sus estados y cifras
anteriores no describen el estado actual. US4/US6/US7, cierre transversal,
rendimiento/usabilidad y DoD global siguen pendientes.

## Histórico: entrega de fundación, US1, US2 y US3

Fecha local: 2026-11-16 (America/Mexico_City). Continuación autorizada:
**solo US3, T049–T062**, desde la primera tarea pendiente T049.
**14/14 implementadas y verificadas localmente**. Se conservan US1, US2 y TLS.
El backlog mantiene **119 tareas: 62 terminadas y 57 pendientes**; la siguiente
es **T063 (US5), no iniciada**. Se verifican 30 de los 53 escenarios: 11 CA-REG,
nueve CA-SES y diez CA-REC; los otros 23 permanecen pendientes. No se declara
completa 001 ni su DoD de CI, revisión y fusión. Las entregas previas se conservan
como histórico más abajo.

## Resultado de US3

- `POST /api/v1/recuperaciones` devuelve siempre 202 y el mensaje exacto
  «Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar
  el acceso» para solicitudes válidas, sin revelar existencia, destinatario ni
  estado de entrega. Solo la cuenta existente guarda desafío y Outbox en el mismo
  commit. Solicitar no cambia contraseña, sesiones ni enlaces previos. Un fallo de
  DB/Outbox revierte ambos registros y conserva la respuesta pública genérica.
- Enlace sobre la URL HTTPS configurada y confiable, dirigido al correo registrado:
  `/recuperar#token=…&version=1`. Secreto aleatorio de 32 bytes, digest único en
  PostgreSQL y payload de correo cifrado por el Outbox existente. Vigencia exacta
  de 1800 s: a partir del límite se rechaza. GET y apertura de pantalla nunca
  consumen. El worker conserva su lease, vencimiento y reintentos acotados.
- `POST /api/v1/recuperaciones/{token}` exige Origin, versión e Idempotency-Key.
  Valida confirmación y contraseña íntegra: 15–128 puntos de código, Unicode válido,
  espacios y pegado sin trim/normalización/truncado; catálogo local de comunes y
  comprometidas. Calcula Argon2 fuera de locks y revalida cuenta→desafío y reloj
  después de bloquear. El commit incluye hash, versiones de cuenta/credencial,
  consumo, invalidación de todos los enlaces pendientes, revocación de todas las
  sesiones/renovaciones, aviso al titular y resultado idempotente. Un fallo del
  último INSERT de idempotencia revierte también las escrituras previas.
- Conforme a R12, el replay exacto confirmado se consulta antes del desafío,
  vencimiento, catálogo y Argon2: devuelve el mismo 200 aun vencido o cambiado el
  catálogo, sin otro hash, aviso ni revocación. Misma clave con otro cuerpo → 409;
  clave nueva sobre enlace usado → 422. La consulta anticipada usa el HMAC del
  cuerpo completo y la clave conservada por identificador; nunca persiste el body
  ni credenciales. Las ejecuciones concurrentes siguen el bloqueo idempotente y
  el orden de locks existente. No se introduce caducidad del resultado confirmado.
- El aviso no contiene contraseña ni enlace de acceso. La respuesta no emite
  tokens/cookie ni inicia sesión; se vuelve a `/acceso`. Un fallo SMTP posterior
  se reintenta sin revertir el cambio confirmado. El login anterior falla y el
  nuevo exige el mecanismo habitual de US2. No se añaden permisos administrativos.
- Web: solicitud, formulario, errores por campo y exigencia de enlace nuevo cuando
  corresponde. El fragmento inicial se captura en memoria y se retira del historial
  antes del módulo y CSS, también en el HTML compilado. Se maneja `hashchange` al
  abrir otro enlace en la misma página. No se restaura/renueva sesión en recuperación;
  al completar se retiran acceso y proyección de perfil de memoria. Token, datos y
  clave estable de reintento permanecen solo en memoria; cambiar datos genera otra
  clave. No hay retry automático ni consumo al navegar, analítica o terceros.

## Trazabilidad y pruebas de US3

HU01 → RF03 → FR-008–011/022/026–027/030 → AC04/EQ-04 → DA03/DA07 →
ADR-002/003/005/006/009 → Usuarios y acceso + API transaccional de Notificaciones
→ PR04/PR13 → funcionalidad 001. Se actualiza también `docs/trazabilidad.md`.

| Tareas | Componentes principales | Evidencia propia de US3 |
|---|---|---|
| T049, T054 | `dominio/recuperacion.ts`, migración `006-recuperaciones.ts`, entidad | 11 U: 1799.999/1800/1800.001 s, propósito/titular/versión, consumido/invalidado, política íntegra y reloj tras lock; puertos sin DB. |
| T050, T055–T058 | Repositorio, solicitud/consumo, idempotencia compartida y plantillas de Notificaciones | 14 I con PostgreSQL real: carreras reset/reset, reset/login y reset/refresh con barreras, varios enlaces/sesiones, rollback completo, replay con catálogo inaccesible y correo SMTP/Mailpit con fallo/reintento. |
| T051, T059 | `presentacion/recuperacion.controller.ts`, composición y validación OpenAPI existente | 9 C: ambas operaciones, respuesta genérica exacta, 400/409/422, Origin/clave/versión, no autologin/cookie, GET sin mutación, tokens de otro propósito y logs redactados. |
| T052, T060–T061 | Web `aplicacion/recuperacion.ts`, `RecuperarAcceso.tsx`, `EstablecerContrasena.tsx` | 6 V: fragmento solo en memoria, no consumo al abrir, confirmación/política, entrada íntegra ante rechazo, clave estable/nueva y redacción de reportes. |
| T053, T062 | Composición web, captura previa en `index.html`, rutas y reporte seguro de Playwright | 9 E por entorno: enlace y aviso en Mailpit, URL limpia, revocación de dos sesiones y refresh, contraseña anterior/nueva, acceso habitual, memoria y anchos previstos. |

Los cinco archivos se llaman `recuperacion.spec.ts` (U/I/C/E) y
`recuperacion.test.tsx` (V), en las raíces backend/frontend de la matriz normativa.
Cada nombre conserva los CA correspondientes. Las rutas backend abreviadas son
relativas a `tecnologia/backend/src/modulos/usuarios-acceso/`; las web, a
`tecnologia/frontend/src/features/usuarios-acceso/`. Notificaciones no importa
internos de Usuarios: composición conecta la plantilla mediante un puerto.

## Verificación final de US3 y regresiones

| Comprobación | Resultado |
|---|---|
| Backend `test:unit` | **68/68**, 11 nuevas y 57 de fundación/US1/US2 |
| Backend `test:integration -- --runInBand` | **49/49**, 14 nuevas y 35 de regresión |
| Backend `test:contract -- --no-cache` | **53/53**, nueve nuevas y 44 de regresión; salida 0 confirmada |
| Frontend `test:unit` | **29/29**, seis nuevas y 23 de regresión |
| Tipos, lint y build de ambos proyectos | Aprobados |
| Arquitectura | Sin infracciones: 105 módulos y 297 dependencias |
| Linux Chromium/Firefox/WebKit × 360/768/1366 | **45/45**, cero omitidos/reintentos; 6,5 min |
| Windows nativo, misma matriz | **45/45**, cero omitidos/reintentos; 5,0 min |
| Imagen backend Linux compilada | UID 1000, Argon2 nativo, salud 200/503/503, sesiones 401/401 y recuperación genérica 202 sin cookie |
| Proxy HTTPS | Salud/web 200; excesos 64 KiB/14 MB → 413 JSON y no-store |
| Reportes de US3 | Cero patrones de token de recuperación/Bearer/cookie sin redactar, incluidos archivos del ZIP embebido en HTML |

Se ejecutó la migración de recuperación en la DB de validación; las suites prueban
las migraciones también sobre PostgreSQL aislado. TLS, CA, certificados, Caddy,
hostname, confianza y `ignoreHTTPSErrors:false` permanecen sin cambios. Los nueve
proyectos de cada plataforma mantienen el control negativo de certificado ajeno.

Las primeras U/V fallaron por módulos ausentes antes de implementar. Se corrigió
un nombre de columna del helper de Outbox y se hicieron deterministas las carreras
con barreras. Un proceso nativo de Jest terminó con `0xC0000409`; la ejecución
completa de contratos sin caché terminó 53/53 y salida 0. No se atribuye una causa
confirmada ni se cambian versiones por ese incidente.

El primer smoke E detectó la navegación por fragmento sin recarga en `/recuperar`;
se añadió su manejo y el flujo final pasó en los 18 proyectos. Ese fallo dejó un
enlace en el reporte: se redactaron el texto y ZIP HTML históricos conservando el
fallo y los resultados. Playwright incorpora ahora un reporter de redacción previo
a list/HTML/JSON/JUnit; siguen desactivadas trazas, capturas y vídeo. Se verificaron
los patrones sensibles de toda la evidencia US3, sin imprimir sus valores.

Evidencia ignorada: `tecnologia/.local/evidencia/001/us3/`: cuatro JUnit U/I/C/V,
`cobertura-us3.json` (diez CA en todos sus niveles exigidos), `verificacion.json`,
`contenedor.json`, `proxy.json`, `secretos-reportes.json`, `e2e-linux/` y
`e2e-windows/`. Se conservan los intentos smoke redactados. Imagen E Linux:
`sha256:4a1e7b64ad253ba87a55659b1e888a99ed0b23877a23e64c6f72dbd88e4b3b1f`;
imagen backend: `sha256:856fdf8e3cbc88b4bd32024b31d8a3b2766f437d891177feb4d68510cf723067`.

**Bloqueos de US3: ninguno.** Se detiene al completar T062; T063 y posteriores
siguen pendientes. Se conservan estas limitaciones:

- Corpus completo, versionado y aprobado de producción pendiente como entrada del
  despliegue. El fixture de validación no lo sustituye y se rechaza en producción.
  Registro y recuperación requieren catálogo preparado; login no lo consulta.
- Inspector SameSite de WebKit Windows: informa None aunque la cabecera es Lax.
  Se mantiene la comprobación Lax en la cabecera en todos los motores, la lectura
  Lax en Linux/Chromium/Firefox y la anotación nativa existente; detalle y referencia
  en el histórico de US2 y `tecnologia/frontend/TLS-PRUEBAS.md`.
- Consulta/edición general del perfil reservada a US5. US1 conserva la proyección
  inicial en memoria tras registro/login; no se adelanta `GET /perfil`.
- Historias restantes, T115/cobertura global, rendimiento/usabilidad y DoD de CI,
  revisión y fusión pendientes según sus tareas. Esta entrega acredita solo US3
  y sus regresiones locales; no acredita la funcionalidad 001 ni el MVP completos.

## Histórico: entrega de fundación, US1 y US2

Fecha local: 2026-11-16 (America/Mexico_City). Continuación autorizada:
**solo US2, T037–T048**, desde la primera tarea pendiente T037.
**12/12 implementadas y verificadas localmente**. Se conserva US1.
El backlog mantiene **119 tareas: 48 terminadas y 71 pendientes**; la siguiente
es **T049 (US3), no iniciada**. De los 53 escenarios se verifican los 11 CA-REG
y los nueve CA-SES; los otros 33 siguen pendientes. No se declara completa 001
ni su DoD de CI, revisión y fusión.

## Resultado de US2

- `POST /api/v1/sesiones` comprueba correo canónico en PostgreSQL y la contraseña
  íntegra con Argon2 fuera de locks, sin consultar el catálogo. Revalida la versión
  de credencial bajo bloqueo de cuenta. Credenciales incorrectas no crean sesión.
  Los fallos se confirman en DB antes de devolver 401/429: el quinto fija 900 s,
  los intentos bloqueados no prolongan el plazo, el límite permite reiniciar la
  secuencia y el éxito restablece los contadores. `Retry-After` refleja la espera.
- Acceso opaco de 32 bytes con vigencia de 900 s; renovación independiente con
  límite absoluto de siete días desde el inicio. Se guardan solo sus digests.
  `POST /sesiones/renovacion` exige Origin, cookie y CSRF por HMAC con propósito
  separado. Bloquea cuenta→sesión, lee reloj tras locks y rota ambos secretos y
  la versión atómicamente. No mueve inicio, límite absoluto ni marca de contraseña.
  La renovación anterior y el Bearer anterior dejan de ser vigentes.
- `GET /sesiones/csrf` exige contexto de mismo origen mediante Fetch Metadata o
  Origin/Referer confiable, comprueba cookie vigente y no altera sesión ni cookie.
  `DELETE /sesiones/actual` comprueba Bearer, revoca en DB antes de responder 204
  y después elimina la cookie. Otras sesiones de la cuenta permanecen vigentes.
  Fallos de DB no emiten credenciales, no confirman cierre parcial y no borran cookie.
- Cookie `__Secure-renovacion` HttpOnly/Secure/SameSite=Lax,
  `Path=/api/v1/sesiones`, sin Domain y con vencimiento absoluto. Ningún resultado
  con secretos pasa por la tabla genérica de idempotencia.
- Web: `/acceso`, estado/cierre y bootstrap al recargar. Acceso solo en memoria;
  una renovación en vuelo por instancia y Web Locks entre pestañas. Cada rotación
  obtiene el CSRF vigente dentro del bloqueo; no hay reintento ciego de una rotación
  fallida. Cierre espera la renovación pendiente y retira acceso; 401 protegido y
  respuestas tardías no restauran credenciales invalidadas. Sin tokens en
  localStorage, sessionStorage o BroadcastChannel.
- La incorporación de perfiles de US1 usa ahora registro y login reales en la misma
  navegación, manteniendo su proyección inicial en memoria. Tras una recarga se
  recupera la sesión; la consulta general de datos/versiones del perfil sigue
  pendiente de US5. No se adelanta `GET /perfil`. Recuperación solo tiene el aviso
  de ruta pendiente previsto por T048, sin solicitud ni cambio de contraseña.

## Trazabilidad y pruebas de US2

| Tareas | Componentes principales | Evidencia propia de US2 |
|---|---|---|
| T037, T042 | `dominio/sesion.ts`, `control-intentos.ts`; `test/unit/usuarios-acceso/sesiones.spec.ts` | 15 U: 899.999/900/900.001 s, siete días, revocación, perfiles y puertos sin DB; contraseña íntegra y fallo confirmado sin emisión. |
| T038, T043–T045 | `infraestructura/persistencia/repositorio-sesiones.ts`, puertos y `aplicacion/iniciar-sesion.ts`, `renovar-sesion.ts`, `obtener-csrf.ts`, `cerrar-sesion.ts` | 19 I: PostgreSQL aislado real, cinco fallos y rotaciones concurrentes, reinicio, límites, recencia intacta, otra sesión conservada, revalidación de credencial y rollback de login/rotación/cierre. |
| T039, T046 | `presentacion/sesiones.controller.ts`, `infraestructura/seguridad/csrf.ts`, composición y HTTP | 13 C: cuatro operaciones, OpenAPI, cabeceras, cookie/CSRF/origen, cuerpos inesperados, 413, 401/429, vencimiento y ausencia de secretos en errores. |
| T040, T047 | Web `aplicacion/sesion.ts`, `infraestructura/coordinador-renovacion.ts` y adaptador HTTP | 9 V: memoria, vuelo único, dos instancias con Web Locks, CSRF actualizado dentro del bloqueo, cierre concurrente, respuesta tardía y fallo sin retry. |
| T041, T048 | Web `presentacion/Acceso.tsx`, `EstadoSesion.tsx`, composición y pruebas E | 9 E de sesiones por entorno, más regresión de 18 E US1 y nueve de fundación/TLS. Login real también en CA-REG-06. |

Los cinco archivos de prueba se llaman `sesiones.spec.ts` (U/I/C/E) y
`sesiones.test.tsx` (V), bajo las rutas de la matriz en `tecnologia/backend/test/`
y `tecnologia/frontend/test/`. Cada nombre conserva el CA correspondiente.
Las rutas de componentes backend de la tabla son relativas a
`tecnologia/backend/src/modulos/usuarios-acceso/`; las web, a
`tecnologia/frontend/src/features/usuarios-acceso/`.

## Verificación final de US2 y regresiones

| Comprobación | Resultado |
|---|---|
| Backend `test:unit` | **57/57**, incluye 42 de fundación/US1 |
| Backend `test:integration -- --runInBand` | **35/35**, incluye 16 de fundación/US1; código de salida 0 confirmado |
| Backend `test:contract` | **44/44**, incluye 31 de fundación/US1; código de salida 0 confirmado |
| Frontend `test:unit` | **23/23**, incluye 14 de fundación/US1 |
| Tipos, lint y build de ambos proyectos | Aprobados |
| Arquitectura | Sin infracciones, 93 módulos y 249 dependencias |
| Linux Chromium/Firefox/WebKit × 360/768/1366 | **36/36**, cero omitidos/reintentos; 3,4 min |
| Windows nativo, misma matriz | **36/36**, cero omitidos/reintentos; 3,0 min |
| Imagen backend Linux | UID 1000, Argon2 nativo, salud 200/503/503 y login/refresh sin credenciales 401/401 |
| Proxy HTTPS | Salud/web 200; exceso 64 KiB/14 MB → 413 JSON y no-store |

TLS, CA, certificados, configuración de Caddy, hostname y
`ignoreHTTPSErrors:false` conservados. Cada proyecto mantiene el control negativo
de certificado no confiable. No se reinstaló la CA ni se cambiaron almacenes.
El runner Linux monta únicamente la CA pública y evidencia; US2 elimina el montaje
de sesiones fixture. El frontend ya no importa el módulo de sesión de validación.

Las primeras pruebas U/V fallaron por módulos aún ausentes antes de implementar.
El harness C ahora escucha en puerto efímero y usa HTTP directo para el transporte
de cuerpos grandes: se aisló un `ECONNRESET` de Supertest en GET sin modificar
el rechazo del servidor. Se corrigieron las inferencias de tipos de composición y
cabeceras de prueba. Un intento nativo agotó 30 s al crear la página, antes del
recorrido: el presupuesto común es ahora 60 s, sin SLA nuevo ni retry automático.
Un proceso de contrato terminó sin informe; se configuró la composición de Nest
para propagar errores al bootstrap/ejecutor en lugar de abortar silenciosamente,
y la suite completa final terminó 44/44 con salida 0.

**Limitación de plataforma registrada:** el inspector de WebKit Windows informa
SameSite=None aunque el servidor envía Lax. Playwright 1.65.1 lo contempla en
[CO-007/CO-009](https://github.com/microsoft/playwright/blob/v1.65.1/tests/library/browsercontext-cookies.spec.ts#L121-L132).
El primer intento fue 33/36 por esa lectura. La matriz final exige la cabecera
SameSite=Lax en todos los motores, comprueba Secure/HttpOnly/Path y ausencia de
Domain, y anota el inspector nativo; no omite ningún flujo. Linux, Chromium y
Firefox verifican además la lectura Lax. No se afirma que el inspector Windows
acredite esa propiedad. Detalles en
[TLS-PRUEBAS.md](../../tecnologia/frontend/TLS-PRUEBAS.md).

Evidencia ignorada: `tecnologia/.local/evidencia/001/us2/`, con JUnit de backend y
frontend, `cobertura-us2.json`, `verificacion.json`, `proxy.json`, `contenedor.json`,
`e2e-linux/` y `e2e-windows-final/`. Se conservan los intentos nativos anteriores
en `e2e-windows-smoke/` y `e2e-windows/`. Imagen E Linux:
`sha256:5f13479723a8e9cbafc993108b47291fe6e01abb9e4919f4db9ad4ea84d8e073`;
imagen backend comprobada:
`sha256:ec5eb728a33e5914f5b650d1e9b2409d54ad1a6b37f269443748e4325b0a02d8`.

**Bloqueos de US2: ninguno.** Se detiene antes de T049/US3. El corpus completo,
versionado y aprobado de producción sigue siendo entrada pendiente del despliegue.
El fixture local no lo sustituye y se rechaza en producción. Registro/nuevas
contraseñas requieren catálogo preparado; login no omite credenciales ni depende
de ese catálogo. No se inicia recuperación, consulta/edición general de perfil ni
las demás historias; tampoco se declara el MVP terminado.

## Histórico: entrega de fundación y US1

Fecha local: 2026-11-16 (America/Mexico_City). Continuación autorizada: solo
**US1, T024–T036**, desde la primera tarea pendiente T024. **13/13 verificadas**.
Con la fundación anterior, el backlog conserva **119 tareas: 36 completadas y
83 pendientes**. La siguiente es **T037 (US2), no iniciada**.
Se mantienen los 32 requisitos, siete historias y 53 escenarios: se verificaron
los **11 CA-REG de US1** en los niveles de la matriz; los otros 42 siguen pendientes.
Esto es un corte local verificado, no la entrega completa de 001 ni un cumplimiento
de su DoD de CI, revisión y fusión.

## Histórico US1: resultado

- Registro real mediante `POST /api/v1/cuentas`: cliente, prestador o ambos;
  nombre de persona/empresa, correo único sin distinguir mayúsculas, contraseña
  completa y confirmación, privacidad explícita vigente `001-v1` con fecha servidor.
  Teléfono/distrito nullable y foto opcional JPG/PNG/WEBP en Garage/S3, validada y
  vinculada a su propietario. Sin sesión automática, tokens, cookies, administración
  ni verificación profesional.
- `POST /api/v1/perfil/perfiles`: exige Bearer autoritativo, Origin, clave
  idempotente, confirmación verdadera y versión. Bloquea cuenta→sesión, vuelve a
  comprobar sesión y reloj tras el bloqueo y conserva identidad, credenciales y
  datos. Un perfil ya presente no se duplica ni incrementa la versión; una versión
  obsoleta da 409. Sesión válida antes del replay y reintentos concurrentes seguros.
- Dominio/Aplicación puros, repositorio PostgreSQL, DTO y controlador conectados
  desde composición. Índice único como autoridad; resultado idempotente, cuenta,
  perfiles y metadatos de foto en el mismo commit. La compensación y el limpiador
  fundacional atienden los objetos de altas fallidas.
- Web en `/registro` y `/habilitar-perfil`, tres selecciones, consentimiento,
  opcionales, foto y mensajes. Contraseñas de 15–128 puntos de código sin trim,
  normalización, corte a 72 bytes ni `maxlength` UTF-16; pegado permitido.
  Corregida la invocación nativa de `fetch` que impedía enviar desde el navegador.
  Sin sesión, la incorporación muestra entrada protegida. La prueba E usa una
  sesión ficticia en memoria por composición exclusiva de modo `validation`,
  rotulada expresamente; no se entrega login ni endpoint de fixtures.

| Tareas | Archivos principales | Verificación |
|---|---|---|
| T024, T029 | `dominio/cuenta.ts`, `perfiles-habilitados.ts`, `politica-contrasena.ts`; `test/unit/usuarios-acceso/registro.spec.ts` | 32 U propias: campos, perfiles, confirmaciones, privacidad, ASCII/Unicode 14/15/128/129, espacios y puertos sin DB. |
| T025, T031–T033 | `infraestructura/persistencia/repositorio-cuentas.ts`, `aplicacion/registrar-cuenta.ts`, `habilitar-perfil.ts`; `test/integration/usuarios-acceso/registro.spec.ts` | 10 I propias: PostgreSQL aislado y Garage reales, diez altas concurrentes, carreras de habilitación, replay, revocación, datos preservados, catálogo y rollback con compensación real de foto. |
| T026, T030, T034 | `presentacion/registro.dto.ts`, `registro.controller.ts`, `composicion/app.module.ts`; `test/contract/usuarios-acceso/registro.spec.ts` | 26 C propias: OpenAPI sin cambios, selección, obligatorios, versiones/cabeceras, límites Unicode/ASCII, prohibición administrativa, errores, sin secretos/cookies. |
| T027, T035 | Web `aplicacion/registro.ts`, `presentacion/Registro.tsx`, `HabilitarPerfil.tsx`; `test/unit/usuarios-acceso/registro.test.tsx` | 7 V propias: errores por campo, aceptación explícita, puntos de código y pegado real con espacios. |
| T028, T036 | Web `composicion/App.tsx`, `usuarios-acceso.ts`; `test/e2e/usuarios-acceso/registro.spec.ts`, helpers de fixtures | 18 E propias por entorno + 9 regresiones de fundación/TLS: **27/27 Linux y 27/27 Windows**, tres motores × 360/768/1366. |

Las rutas backend de la tabla son relativas a `tecnologia/backend/src/` o
`tecnologia/backend/test/`; las web, a `tecnologia/frontend/src/` o su `test/`.
Los cinco archivos de pruebas y sus CA exactos conservan la trazabilidad de
[test-matrix.md](test-matrix.md) y [docs/trazabilidad.md](../../docs/trazabilidad.md).

## Histórico US1: pruebas y regresiones

| Grupo | Resultado final, incluida fundación |
|---|---|
| Backend `test:unit` | 42/42 |
| Backend `test:integration -- --runInBand` | 16/16, servicios reales y DB aisladas |
| Backend `test:contract` | 31/31 |
| Frontend `test:unit` | 14/14 |
| Tipos, lint y build de ambos proyectos | Aprobados |
| `test:architecture` | Sin infracciones; Dominio/Aplicación independientes |
| `test:e2e:container` | 27/27, sin omitidos ni reintentos; UID 1001 |
| `test:e2e:windows` | 27/27, sin omitidos ni reintentos; 2,5 min |
| `test:container` backend | Imagen Linux, UID 1000, Argon2 nativo, salud 200/503/503 |
| `test:proxy` | TLS válido, salud/web 200, límites 64 KiB/14 MB → 413 JSON/no-store |

TLS conservado: Caddyfile, certificados/CA, scripts de preparación y confianza,
validación de hostname y `ignoreHTTPSErrors:false` intactos. Cada uno de los nueve
proyectos por entorno vuelve a rechazar el certificado de control no confiable.
Windows mantiene la CA previa solo en CurrentUser/Root; no se reinstaló.
El build productivo no contiene la ruta de importación del fixture de validación.
La configuración de pruebas impide snapshots automáticos con campos privados;
capturas, vídeos y trazas siguen desactivados.

Evidencia local ignorada en `tecnologia/.local/evidencia/001/us1/`:

- `backend-unit-junit.xml`, `backend-integration-junit.xml`,
  `backend-contract-junit.xml`, `frontend-junit.xml`, `verificacion.json`.
- `e2e-linux/`: JSON/JUnit/HTML, `tls.json`, `ejecucion.json` y digest
  `sha256:d77517360730068037f7f413eaadac49633f446621d0bba861d75583b0f7d7af`.
- `e2e-windows-final/`: JSON/JUnit/HTML y `ejecucion.json` con huellas y resultado.
- `proxy.json`, `contenedor.json`; imagen backend verificada
  `sha256:53e90ef8c4d32cb5e368cb2e99fd6a7bdea9b0d1153a238f525e13dbaffdbe6f`.

Pruebas U/V escritas primero: fallaron inicialmente por módulos ausentes antes de
implementar. Se añadieron I/C/E antes del código; servicios reales se ejecutaron
al iniciar Docker Desktop. SWC necesitó el acceso nativo fuera del sandbox ya
identificado en fundación. Los primeros E detectaron `fetch` y la importación de
fixture; corregidos y verificados. El intento Windows `e2e-windows/` quedó 26/27:
WebKit 360 confirmó la operación, pero agotó 30 s durante la limpieza del fixture
con construcción/pruebas simultáneas. El presupuesto del test se ajustó a 60 s,
sin SLA nuevo ni reintento automático; la matriz final quedó 27/27.

**Bloqueos actuales de US1: ninguno.** El corpus completo de producción sigue
siendo entrada del despliegue; las pruebas usan el fixture permitido y no lo
presentan como corpus completo. Se detiene la ejecución antes de US2: no se
implementan inicio, renovación o cierre de sesión, ni historias posteriores.
No se ejecutan T037–T119 ni se marca el MVP completo.

## Histórico: preparación y fundación T001–T023

La entrega anterior verificó 23 tareas y dejó las historias pendientes. Se conserva
a continuación su evidencia histórica; sus límites se refieren a aquel corte.

## Resultado y trazabilidad técnica

| Tareas | Artefactos principales | Verificación |
|---|---|---|
| T001–T002 | `tecnologia/backend/` y `tecnologia/frontend/`: paquetes privados, lockfiles, TypeScript, entrada técnica; Dockerfile y .dockerignore del backend | Dependencias instaladas, peers resueltos; compilación y tipos de ambos proyectos. Imagen Linux comprobada por T023. |
| T003 | ESLint de ambos proyectos; `tecnologia/dependency-cruiser.cjs` | Lint sin errores; 64 módulos y 130 dependencias sin infracciones ni ciclos. |
| T004 | `tecnologia/compose.yaml`, `tecnologia/infra/garage.toml` | Compose válido; PostgreSQL 18, Redis, Mailpit y Garage saludables. Imágenes fijadas por digest. |
| T005 | `tecnologia/infra/Caddyfile`, scripts TLS y `verificar-proxy.ts` | Cadena OpenSSL válida; HTTPS con CA explícita y validación activa: salud/web 200, excesos de 64 KiB y 14 MB:413 JSON con no-store/no-referrer. No acredita confianza del navegador. |
| T006 | Jest/SWC, Supertest, validador OpenAPI, harness PostgreSQL | Suites unitarias, contrato e integración reales aprobadas. Bases de prueba únicas y prefijos S3 aislados. |
| T007 | Vitest/Testing Library, Playwright, fixture Mailpit, Dockerfile.e2e y scripts de confianza/ejecución | Vitest:7 aprobadas; **9/9 proyectos Linux y 9/9 Windows nativo aprobados**, Chromium 159.0.8154.6/Firefox 159.0/WebKit 27.2 × 360/768/1366. UI/API reales, Mailpit y rechazo de certificado no confiable en cada proyecto. CA pública aceptada y verificada únicamente en CurrentUser/Root para Windows. |
| T008 | `.env.example`, `.gitignore`, contexto Docker | Secretos, corpus, herramientas locales, certificados y evidencia ignorados; configuración productiva separada y rechazo de fixture en producción. |
| T009–T010 | Dominio/puertos, DataSource y unidad de trabajo PostgreSQL | TypeScript y reglas de arquitectura; rollback real y transacción opaca compartida. `synchronize:false`, sin SQL en errores. |
| T011–T013 | Migraciones/entidades de cuentas/perfiles/sesiones, lector y guard | Migración en DB vacía; correo único case-insensitive concurrente, UUID inmutable, perfiles válidos, revocación consultada en DB y rechazo ante falla. Sin elevación administrativa. |
| T014–T015 | Crypto, Argon2id y catálogo local | Unicode completo, sal/parámetros, diferencias después del byte 72; corpus exacto por checksum y búsqueda local; ausencia/corrupción y fixture productivo rechazados. Manifiesto vigilado en readiness. |
| T016 | Migración y adaptador de idempotencia | Cinco reintentos concurrentes ejecutan una vez; replay, autorización previa, rechazo de otro cuerpo y rollback del resultado. Sin caducidad ni secretos persistidos en el resultado. |
| T017–T018 | API pública de Notificaciones, Outbox AEAD, worker y SMTP | Rollback conjunto real, payload autenticado, reintento sin revertir negocio, entrega real en Mailpit y eliminación del ciphertext al enviar/vencer. Worker en el mismo backend. |
| T019 | Migración/entidad de fotos, puerto/adaptador S3 y limpieza | Decoder de imágenes real y límite de bytes; Garage real, acceso de propietario, rechazo ajeno y limpieza de temporales/huérfanos conservando la foto activa. |
| T020–T021 | Middleware REST y cliente web con contratos puros | Contrato empaquetado idéntico al normativo; salud 200/503, límites, origen, propiedades extra, Unicode y parámetros; cliente sin almacenamiento web ni reintento automático. Autenticación/CSRF funcional de nuevas rutas queda en sus historias. |
| T022 | Raíz de composición y GET `/api/v1/salud` | Arranque real y compilado Linux; salud según DB/catálogo sin usar Redis para sesiones ni readiness. Ningún controlador de historia registrado. |
| T023 | Scripts de preparación, migraciones, catálogo, storage, seed y smoke Docker | Cinco migraciones aplicadas; seed ficticio guardado solo en .local; bucket privado; imagen multietapa construida/arrancada, UID 1000, Argon2 nativo y salud 200/503/503. Contenedores efímeros retirados. |

Los controles técnicos sustentan las futuras pruebas U/I/C/V/E de la
[matriz](test-matrix.md); no reemplazan CA-REG, CA-SES, CA-REC, CA-AUT, CA-PER,
CA-COR ni CA-CLA. La trazabilidad HU01/HU02 → RF01–RF05 → US1–US7 y las 119
tareas se mantienen sin ampliar alcance. La referencia administrativa del seed
es metadato ficticio: su cuenta tiene perfil cliente, no un rol administrador.

## Verificaciones ejecutadas

- Backend: `typecheck`, `lint`, `build`, `test:unit`, `test:integration -- --runInBand`,
  `test:contract`, `test:architecture`, `test:container` y `test:proxy`.
- Pruebas aprobadas: 10 unitarias backend, 6 de integración con servicios reales,
  5 de contrato y 7 unitarias frontend (28 controles técnicos; no son los 53 CA).
- Frontend: `typecheck`, `lint`, `build`, `test:unit`, `test:e2e -- --list`;
  matriz nativa inicial `test:e2e -- --workers=1 --timeout=15000`: 9 fallos por confianza;
  matrices finales `test:e2e:container` y `test:e2e:windows`:**9/9 aprobados en cada
  entorno**, con controles TLS positivos y negativos. Los resultados históricos,
  Linux y Windows nativo se conservan en directorios distintos.
- Preparación: `dev:prepare -- --validation`, `db:migrate`, `storage:init`,
  `security:catalog:prepare -- --fixture` y `test:seed`.
- Infraestructura: Compose config, arranque con espera de salud, validación de
  configuración de Caddy y cadena TLS con OpenSSL.

Entorno verificado: Windows/PowerShell; Node 24.15.0 portátil bajo `.local`
(el Node global era22.16); TypeScript6/ESM; Docker Desktop con motor Linux amd64,
PostgreSQL18 y Playwright 1.65.1. SWC requirió ejecutar las pruebas con acceso
a su caché nativa fuera del sandbox; la repetición autorizada pasó.

Los JUnit se separan por suite en `tecnologia/.local/evidencia/001/`;
`contenedor.json` conserva fecha, ID SHA-256 de la imagen local, UID y resultados;
`proxy.json` registra TLS/estados/límites. Playwright conserva su reporte local
sin capturas, vídeos ni trazas. No versionar evidencia con datos privados.

La reconstrucción inicial y su smoke test terminaron correctamente: imagen local
`sha256:44dbfe91b422ac58cde625b736c7cd87c53fba1a51d8f57b552c249a24160adc`,
UID 1000, Argon2id nativo y salud 200/503/503. Una reconstrucción intermedia encontró
`ETXTBSY` durante la instalación de esbuild; el reintento sin alterar dependencias
construyó correctamente. La captura del log se corrigió para admitir stdout
redirigido; la comprobación final pasó con esa corrección y retiró sus contenedores.

## Resolución de T007 y límite de entrega

La causa inicial estaba en el entorno de ejecución: los tres navegadores eran
procesos nativos Windows; Caddy y las dependencias estaban en contenedores Linux.
Las primeras importaciones de la CA al almacén del usuario se cancelaron con
HRESULT0x800704C7. Esos resultados se conservan como históricos. La nueva
importación visible fue aceptada y verificó la misma CA, sin desactivar TLS.
Chromium instalado pudo abrirse, pero `page.goto` falló con
`net::ERR_CERT_AUTHORITY_INVALID`; no llegó a verificar la pantalla ni la salud.
El primer intento anterior falló por descarga incompleta del ejecutable.
Los tres motores se descargaron y se intentaron los nueve proyectos. Firefox
devolvió `SEC_ERROR_UNKNOWN_ISSUER`; WebKit devolvió `SSL peer certificate or SSH
remote key was not OK`. Las tres anchuras fallaron en cada motor por TLS, sin
llegar a las aserciones de UI/salud. Curl/Schannel con `--cacert` también falló porque no
pudo determinar la revocación. La prueba Node `test:proxy` verifica certificado,
cadena y hostname contra la CA explícita, sin modificar la confianza de Windows.

Se agregó `tecnologia/scripts/diagnosticar-tls.ps1`, que verifica vigencia,
cadena, propósito sslserver, SAN localhost/127.0.0.1 y presencia de la CA en los
almacenes Windows. El diagnóstico inicial confirmó certificados válidos y CA
ausente; el diagnóstico final nativo confirma CA presente en CurrentUser/Root y
ausente en LocalMachine/Root. `-ExigirConfianzaWindows` termina ahora correctamente.

El ejecutor de `tecnologia/frontend/Dockerfile.e2e` usa una imagen oficial de
Playwright fijada por digest, Node 24.15 y confianza en NSS de Chromium, políticas
de Firefox y CA del sistema de WebKit. Monta solo el certificado público, conserva
el origen localhost mediante un reenvío TCP opaco hasta Caddy y exige que cada
navegador rechace un certificado de control no confiable. El comando reproducible
es `test:e2e:container`; la configuración y las diferencias entre Windows/Linux
se detallan en [TLS-PRUEBAS.md](../../tecnologia/frontend/TLS-PRUEBAS.md).
Firefox de Playwright selecciona la política mediante
`PLAYWRIGHT_FIREFOX_POLICIES_JSON`; la instalación inicial únicamente en
`distribution/policies.json` no activó la confianza. La variable ahora apunta al
JSON público de `Certificates.Install`. El control negativo usa una página nueva
para aislarlo de la navegación/HMR de la aplicación y exige un error de certificado,
incluido `SEC_ERROR_CA_CERT_INVALID` de Firefox; no acepta cancelaciones genéricas.

### Resultado final por entorno

| Entorno | Resultado | Estado de confianza |
|---|---|---|
| Windows nativo antes de aceptar la CA, histórico | 0/9; nueve fallos exactos de CA descritos arriba | CA ausente; importaciones anteriores 0x800704C7. |
| Windows nativo después de la aceptación, Chromium 159.0.8154.6/Firefox 159.0/WebKit 27.2, Node 24.15.0 | **9/9**, sin omitidos ni reintentos, en 46,6 segundos | Única CA pública en CurrentUser/Root de anderson, bytes y huellas verificados; nueve rechazos de certificado no confiable aprobados. LocalMachine/Root sin cambios. |
| Linux x64, imagen oficial de Playwright 1.65.1, Node 24.15.0 | **9/9**, sin omitidos ni reintentos, en 1,1 min | CA pública confiable en NSS/políticas/almacén del contenedor. Los nueve proyectos también rechazan el certificado no confiable. |

La ejecución Linux comenzó el 2026-11-16 a las 22:34:33 UTC. Imagen del ejecutor:
`sha256:935cd94a7ac48584100adde5d44353fc64b3bfce1eb0a0c2720a8c9f2e0ef9be`.
El proceso de pruebas y los navegadores usaron `pwuser`, UID 1001. La preparación
de confianza se ejecutó como root únicamente dentro del contenedor efímero.
No se publicaron puertos ni se montaron claves privadas o secretos del backend.
El contenedor se retiró al finalizar y se comprobó que no quedaban contenedores
con la etiqueta `ayacucho.e2e`.

El handshake comprobó el origen `https://localhost:8443`, la cadena, las fechas y
los SAN `DNS:localhost`/`IP:127.0.0.1`. El runner comparó las huellas SHA-256 del
certificado servido y la CA con los archivos públicos del host y verificó que
`ajeno.example.invalid` no coincide. Certificados originales sin modificaciones:
CA vigente hasta 2026-12-16 19:52:19 UTC; servidor hasta 2026-11-30 19:53:57 UTC.

### Aceptación y verificación de Windows nativo

Antes de solicitar la instalación se mostraron procedencia, sujeto/emisor,
vigencia, huellas SHA-256/SHA-1 y correspondencia con el certificado servido.
La CA procede del generador OpenSSL local `tecnologia/scripts/preparar-tls.ps1`;
no se regeneró ni se sustituyó por otra autoridad:

- SHA-256 CA: `2D:CB:8F:BD:C6:1C:14:66:03:FC:0E:5C:47:F7:D9:C4:4F:92:29:6C:32:71:7D:B7:45:C2:AE:F1:42:1F:2A:85`.
- SHA-1 CA/almacén Windows: `29926A9715BC060FC6CB57903262F6BEA6853DE2`.
- SHA-256 servido/localhost.crt: `E6:7D:F6:33:1B:AF:55:62:40:18:FB:B7:0D:DB:BA:48:33:44:FA:17:AE:3E:EE:95:CD:34:0D:3F:11:81:80:91`.

Se abrió `tecnologia/scripts/confiar-ca-windows-visible.ps1` con
`Start-Process -WindowStyle Normal` en la sesión interactiva 1 de anderson,
iniciada a las 22:49:21 UTC. El helper exige la huella SHA-256 mostrada y utiliza
la confirmación de Windows para `Import-Certificate` en CurrentUser/Root.
La aceptación terminó con resultado `instalada`.

Se verificó nativamente con X509Store ReadOnly: una única entrada idéntica al
certificado público local, sin clave privada asociada, y sin entrada en el
almacén del equipo. La consulta definitiva y las pruebas se ejecutaron con la
identidad Windows nativa, fuera de las restricciones del agente; una consulta
restringida había devuelto `false` y se contrastó con el almacén nativo real.

Después de esa verificación se ejecutó `test:e2e:windows`, inicio 22:53:42 UTC.
El helper de `tecnologia/frontend/scripts/probar-navegadores-windows.mjs` vuelve a
exigir confianza, comprueba la firma y la huella del certificado servido, y genera
un control no confiable en loopback 9443 con clave efímera ignorada. El reporte
confirma `plataforma:win32`, Node 24.15.0, los nueve proyectos aprobados y una
anotación de rechazo TLS en cada uno. La clave y el certificado de control se
eliminaron al cerrar el servidor; no quedaron archivos residuales de ese control.
Lint y typecheck frontend también pasaron con los helpers nuevos.

La instalación se limitó a la confianza del usuario: no se importaron claves
privadas, no se usó LocalMachine/Root ni se eludieron avisos de Windows.
Las instrucciones de retirada selectiva por huellas están en
[TLS-PRUEBAS.md](../../tecnologia/frontend/TLS-PRUEBAS.md#retirar-únicamente-esta-ca-de-windows).
La retirada no se ejecutó: la CA permanece instalada para las pruebas nativas.

Evidencia ignorada de esta corrección:

- `tecnologia/.local/evidencia/001/diagnostico-tls-windows.json`: cadena, nombres,
  vigencia y confianza actual Windows.
- `tecnologia/.local/evidencia/001/e2e-windows/`: JSON/JUnit/HTML de los nueve fallos
  nativos, con errores y versiones exactos.
- `tecnologia/.local/evidencia/001/importacion-ca-windows.json`: resultado de la
  importación visible de la CA pública fijada por huella.
- `tecnologia/.local/evidencia/001/verificacion-ca-windows.json`: identidad, almacén,
  coincidencia de bytes, ausencia de clave privada y de confianza en el equipo.
- `tecnologia/.local/evidencia/001/e2e-windows-native/`: JSON/JUnit/HTML de los nueve
  proyectos nativos aprobados; `ejecucion.json` conserva origen, huellas y control TLS.
- `tecnologia/.local/evidencia/001/e2e-linux/`: JSON/JUnit/HTML de los nueve proyectos
  aprobados; cada resultado incluye anotaciones de motor/versión y rechazo TLS.
  `tls.json` registra UID, Node, huellas, SAN y vigencia; `ejecucion.json` registra
  digest, plataforma y código de salida 0.

La regresión de esta corrección mantuvo verdes las 28 pruebas técnicas anteriores,
lint/tipos/build frontend, arquitectura backend, integración con PostgreSQL/S3/
SMTP reales, contrato y proxy HTTPS/límites. También pasó nuevamente el smoke
Linux del backend: UID 1000, Argon2 nativo y salud 200/503/503; su digest registrado es
`sha256:36637098b66735d92011381255db0112f4063afd180349cc5865d8819a2709a2`.
La sintaxis Bash del arranque se comprobó. No se modificó el código del backend.

Git excluye las claves `ca.key`/`localhost.key`, `.env`, `backend.env`, fixtures,
corpus y evidencia. Se comprobó con `git check-ignore`, listado de archivos
seguidos y búsqueda de cabeceras de claves privadas en archivos no ignorados:
no se encontraron claves privadas versionadas. El contexto Docker excluye esos
artefactos; el montaje del ejecutor contiene solo `ca.crt` público y reportes.

T007 cumple sus criterios en Linux reproducible y en Windows nativo. No quedan
bloqueos de confianza pendientes en estos entornos verificados. Los 53 CA
funcionales siguen pendientes. La configuración conserva `ignoreHTTPSErrors:false`,
la validación de certificados y nombres y el rechazo del certificado de control.
Ese corte se detuvo antes de T024; la continuación US1 documentada arriba supera
ese límite histórico y se detiene ahora antes de T037.

El corpus completo aprobado de producción es una entrada del despliegue,
conforme a research; esta entrega prepara únicamente el fixture local.
`security:catalog:prepare` sin `--fixture` valida el manifiesto externo configurado:
`tipo:completo`, versión, fecha, aprobación, checksums SHA-256, comunes JSON y
comprometidas SHA-1 mayúsculas ordenadas/únicas, 40 caracteres más LF por registro.
No distribuye ni descarga contraseñas. El fixture se rechaza en producción.

`test:coverage:001` informa T115 pendiente y sale con error deliberadamente;
todavía no es el comprobador de cobertura funcional. No se ejecutaron recorridos
de registro, login, recuperación, edición, correo o contraseña, ni se ofrecen
como implementados en aquel corte. Entonces el único endpoint entregado era salud;
el alcance actual de US1 se describe al inicio de este documento.
