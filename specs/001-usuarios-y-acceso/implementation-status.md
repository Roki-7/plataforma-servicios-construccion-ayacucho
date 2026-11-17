# Estado de implementación: fundación, US1 y US2 de 001

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
