# Estado del cierre transversal de 001 Usuarios y acceso

Fecha local 2026-11-18. **119/119 tareas completadas.** T110–T119 completadas (T117 y T118 con las limitaciones de su fila; T119 con las limitaciones de su fila). PR #1 fusionado en `main` el 2026-11-18 (commit de integración `b6c998a892f67a0eb55dd2dbbce338ff46f793ba`, cabeza del PR `eba08a2`).
Las siete historias y sus 53 CA conservan su evidencia por nivel. La versión de producto usada en los ensayos históricos de cierre es
`04af69e2d5cd78db6e1654f36c28a343af41d7b1`. Las huellas `F3-*` de esta sección
identifican instantáneas locales de fuentes y pruebas sobre ese commit. Cada
intento nuevo está debajo de `tecnologia/.local/evidencia/001/cierre/`.

## Enmienda controlada 2026-11-25 — validación de contacto del perfil (revisión manual de T080 de la 002)

**Origen.** En la revisión manual de T080 «Editar mi perfil» guardó un teléfono con letras. La especificación no definía qué caracteres admite un teléfono (solo prohibía formatos nacionales). El responsable del producto aprobó expresamente cuatro decisiones como enmienda controlada de 001; no cambian autenticación, permisos ni privacidad.

**Decisiones aprobadas (spec.md «Enmienda controlada», FR-033, CA-PER-07 a CA-PER-10).**
- **D1 teléfono:** opcional; solo dígitos, espacios, `+ - . ( )`; 6 a 15 dígitos; hasta 32 caracteres; sin formato nacional.
- **D2 vacíos:** teléfono y distrito vacíos o de solo espacios se guardan como null.
- **D3 control:** se rechazan NUL, saltos de línea, tabuladores y los demás caracteres de control (categoría Cc más U+2028/U+2029) en nombre, teléfono y distrito; las reglas de nombres de personas y empresas se conservan.
- **D4 distrito:** texto libre de cuenta, máximo 100, sin lista cerrada.

**Defectos y cambios.**
- **D-01 (defecto previo, corregido):** un NUL en nombre, teléfono, distrito o correo superaba la validación y PostgreSQL lo rechazaba: 503 en lugar de 400 (reproducido con la integración nueva: fallaba con 503).
- **Backend:** `dominio/datos-contacto.ts` (nuevo: reglas, motivos por campo y normalización), `dominio/cuenta.ts` (registro), `dominio/consentimiento-telefono.ts` (edición) y los casos de uso `actualizar-perfil.ts` y `registrar-cuenta.ts` (normalizan después de validar; la clave de idempotencia usa el cuerpo original). Un rechazo informa todos los campos inválidos a la vez y no guarda nada. Sin `CHECK` nuevo ni migración: los valores anteriores no se migran y solo se revalidan si el titular los cambia.
- **Frontend:** `aplicacion/validacion-contacto.ts` (nuevo, mismas reglas y mensajes), `perfil.ts`, `registro.ts`, `Registro.tsx` y `EditarPerfil.tsx`: ayuda visible del teléfono enlazada con `aria-describedby`, `type="tel"` e `inputMode="tel"`, `aria-invalid` y error junto al campo; vacíos se envían como null.
- **Contrato y datos:** `contracts/openapi.json` (y su espejo `tecnologia/backend/contracts/openapi.json`) documenta las reglas en las descripciones y conserva `maxLength` 200/32/100. **No se usa `pattern`:** el adaptador HTTP compartido responde 400 sin motivo por campo ante un fallo de esquema en el cuerpo y no se modificó por ser común a 001 y 002. `data-model.md`, `spec.md`, `contracts/README.md` y `test-matrix.md` (57 escenarios, 169 asociaciones) actualizados; `scripts/verificar-cobertura-001.ts` y `test/unit/cobertura.spec.ts` esperan ahora 57 casos y 169 asociaciones.

**Pruebas nuevas y adaptadas.** Unitarias de backend `perfil-validacion.spec.ts` (57 casos); integración `perfil-validacion.spec.ts` (25 casos con PostgreSQL real: datos inválidos no se guardan, vacíos quedan `NULL`, repetición idempotente, registro); contrato `perfil-validacion.spec.ts` (cuerpo `Error`, `Perfil`, `RegistroResultado`); frontend (perfil y registro: mensajes, accesibilidad, null, distrito libre; 18 casos nuevos); E2E Playwright `perfil-validacion.spec.ts` (recorrido completo con recarga de página). Los teléfonos de prueba que ya no eran válidos (`111`, `+51 libre`, etc.) se sustituyeron por números válidos en las suites existentes; los dos mensajes de «nombre vacío» pasaron a «Ingrese su nombre para mostrar.».

**Resultados (2026-11-25).** Backend `tsc` y `eslint` sin errores; unitarias 315/315; contratos de 001 126/126 (11 suites); integración de 001 129/129 (12 suites; un fallo aislado de `registro.spec.ts` tras un E2E no se reprodujo en dos repeticiones, 10/10 y 129/129); frontend `tsc`, `eslint` y 152/152 pruebas. **E2E en Chromium con la imagen reconstruida a 360 y 1366 px: 16/16** (perfil-validacion, perfil, registro, sesiones, contrasena, permisos, recuperacion-perfil, seguridad-navegador; resumen en `tecnologia/.local/evidencia/002/t080-enmienda-001-e2e/`). Regresión de 002: integración 143/143 (15 suites) y contratos 65/65 (6 suites, incluida `regresion-001-002`).

**Nota sobre los E2E.** El ejecutor corre dentro de la imagen `ayacucho-001-e2e:fundacion`, que copia `test/` al construirse; una imagen antigua hace fallar suites ya corregidas. Se reconstruyó antes de esta regresión.

## Criterios y resultados por tarea

| Tarea | Versión, alcance y resultado | Evidencia |
|---|---|---|
| T110 | La primera ejecución conjunta pasó 1/1 I y 1/1 E en Chromium Linux a 768 px sobre el commit base y las huellas de las dos suites nuevas. X-01–X-05 pasó 10/10 I y permisos 21/21 C sobre `F3-25d611c817adceb0`. Con Redis detenido pasaron recuperación 14/14, sesiones 19/19, correo 16/16 y la conjunta 1/1. Se verificó la restauración del servicio. | `t110-conjunta-i-1`, `t110-conjunta-e-linux-1`, `t110-garantias-1`, `t110-permisos-1`, `t110-redis*`. Las cuatro huellas con Redis detenido están en cada `version.json`. |
| T111 | X-06/X-07 pasó 4/4 C en `F3-25d611c817adceb0`; I `perfil` pasó 9/9 en `F3-29ad8cca7b81897c`. X-06 pasó 1/1 E Linux `F3-9cc555f544090b8d`. La selección Windows de X-06 y la conjunta pasó 2/2 con Chromium a 768 px en `F3-e47ee3a0adb60c67`. | `t111-contrato-1`, `matriz-uicav-windows-1/I/usuarios-acceso/perfil.xml`, `t111-e-linux-3`, `t110-t111-e-windows-1`. |
| T112 | PR12 analiza el grafo de ambas apps y un fixture con dependencias prohibidas. El sexto intento pasó 2/2 en `F3-d74232c9118d32f3`. La versión con la regla explícita de HTTP pasó 2/2 en `F3-78a926e567ecdd39`. | `t112-arquitectura-1` a `t112-arquitectura-7`. |
| T113 | X-08 pasó 20/20 C sobre `F3-4243a19f8f891073`. Cubre 17 rutas, 13 mutaciones con tres rechazos de Origin, límites de transporte y de foto, contrato empaquetado y enum de errores. | `t113-openapi-1`, `t113-openapi-2`. |
| T114 | Commit base, fuentes de medición con SHA-256 y Node 24.15.0. k6 completó 6 iteraciones, 20 peticiones HTTPS y aprobó sus comprobaciones con 1 y 2 usuarios virtuales. Argon2id registró 213 ms y 439 ms en los dos lotes, con RSS pico del proceso de 146,84 MB y 146,87 MB. Salud devolvió 200/200 a un minuto de distancia durante 60,05 s. | `t114-demo-1` con JSON k6, Argon2 y salud, versión de k6 y huellas. La medición describe esta demostración local. |
| T115 | `F3-960a8ba8bfafa410` aprobó **53/53 CA y 152/152 asociaciones** con reportes de ambas apps. U 120, I 104, C 118, V 53 y E 13 en Chromium Linux a 768 px. El verificador pasó 6/6 U y rechazó el reporte de la matriz Linux con cuatro fallos. CI activa además la validación estricta de los nueve proyectos T007. | `t115-verificador-1`, `t115-verificador-2`, `t115-cobertura-real-1`, `t115-cobertura-rechazo-1` y `t115-e-proyecto-1`. |
| T116 | **Completada.** Ejecución alojada #5 del PR #1 sobre `d330a06302464ef4c7f4a7d7b181b26e13da53d2` (SHA corregido el 2026-11-18 con la API pública de GitHub; la cita anterior `4068815…` no existe en el repositorio). Los resultados de Playwright que siguen fueron comunicados por el responsable del PR y no se pudieron releer del artefacto. Playwright Linux 117/117, incluido Fundación TLS 9/9. Salud registró dos HTTP 200 con un minuto de diferencia y sin incidencias. Los ensayos locales previos acreditan la imagen Linux con UID 1000, Argon2, salud 200/503/503, correo capturado en Mailpit y el proxy HTTPS. | [GitHub Actions #5](https://github.com/Roki-7/plataforma-servicios-construccion-ayacucho/actions/runs/44319286410). Evidencia local previa en `estatica-1`, `estatica-2`, `t116-contenedor-1/contenedor.json` y `t116-proxy-tls-1`. |
| T117 | Se completaron las instrucciones de ejecución y el protocolo de revisión humana. Ensayo local sobre `d330a06302464ef4c7f4a7d7b181b26e13da53d2`, con Node 24.15 y Docker Linux en Windows. Se aplicaron 8 migraciones y quedaron 0 pendientes tras reiniciar y tras restaurar. Con el origen detenido, el respaldo se restauró en PostgreSQL y Garage nuevos. El titular recuperó la foto con el mismo SHA-256. La lectura sin sesión devolvió 401 y el objeto anónimo 403. La ejecución #7 de GitHub Actions sobre `a13d0ce` terminó `success` en un trabajo con todos los pasos en verde (comprobado con la API pública; el recuento de pruebas del artefacto no se pudo abrir). La revisión humana fue parcial y se registró como tal: registro, acceso, perfiles, cambio de correo y de contraseña, recuperación y cierre, confirmados verbalmente por la persona responsable; la presentación del registro, observada a 360, 768 y 1366 px. Los demás recorridos por ancho se acreditan solo con la matriz automatizada (Chromium local 36/36 y CI #7 con Chromium, Firefox y WebKit); no hubo revisión manual por ancho, ni versión de navegador ni capturas. La ejecución #7 corrió `validar-001-ci.sh`, cuyo último paso, `test:coverage:001` con la matriz E exigida, no pasa si falta algún CA; el recuento no se pudo leer del artefacto. Se conservan como observaciones sin causa confirmada tres fallos intermitentes de navegador y el autocompletado de Opera normal tras cerrar sesión. **T117 completada con esas limitaciones.** | [Quickstart](quickstart.md#8-revisión-humana-de-usabilidad-y-responsive-de-t117), `tecnologia/.local/evidencia/001/validacion.md` y `cierre/t117-operativo-2/respaldo.json`. El anterior `t117-respaldo-2` se conserva como ensayo parcial histórico. |
| T118 | Documentación preparada sobre el commit base y los cambios locales. Se actualizaron los dos README, trazabilidad, API, datos, pruebas y quickstart. Tras T117 se contrastó la documentación con el contrato (17 operaciones) y con la evidencia: `api-rest.md` ahora lista las 17 operaciones de 001, `trazabilidad.md` registra la evidencia de T116–T117 con su ubicación (remota, versionada o solo local) y sus limitaciones, y `04-pruebas.md`, el quickstart y el README reflejan la CI #7 sobre `a13d0ce` y que la administración queda fuera de 001. Enlaces relativos comprobados. La revisión documental fue aprobada por la persona responsable el 2026-11-18, tras comprobar que las 17 operaciones de `api-rest.md` coinciden con el OpenAPI, que los enlaces relativos resuelven y que no se incluyen secretos ni datos privados. **T118 completada.** Limitaciones que se conservan: tres fallos intermitentes de navegador sin causa confirmada; Firefox y WebKit constan solo por la CI alojada; el recuento del artefacto de la ejecución #7 no se pudo leer; la revisión humana fue parcial (sin revisión manual por ancho del resto de recorridos, sin versión de navegador ni capturas); la evidencia local (`validacion.md`, `cierre/*`) está ignorada por Git y no se publica. | Diff de documentación y enlaces de esta sección. |
| T119 | **Completada el 2026-11-18.** Revisión independiente en sesión nueva (sin defectos de código bloqueantes; hallazgos documentales corregidos en `eba08a2`: SHA del CI #5 y referencias a #8/#9). Evaluación humana favorable de la persona responsable, publicada como [comentario en el PR #1](https://github.com/Roki-7/plataforma-servicios-construccion-ayacucho/pull/1#issuecomment-6994979641). GitHub Actions #10 `success` sobre `eba08a2` (cabeza del PR) y #9 `success` sobre `d534a60`. PR #1 fusionado en `main` con el commit `b6c998a892f67a0eb55dd2dbbce338ff46f793ba`. **Limitaciones que se conservan:** el recuento 53/53 de las ejecuciones de CI no pudo leerse (registros y artefacto exigen autenticación); la cobertura 53/53 medida localmente es sobre `04af69e`; la revisión manual de usabilidad fue parcial (solo el registro se observó a 360/768/1366 px); la evaluación humana la emite la misma persona responsable del desarrollo, sin segundo revisor humano; la CI #11 sobre `b6c998a` en `main` estaba en curso al registrar este cierre y no se verificó; tres fallos intermitentes sin causa, Firefox/WebKit solo por CI, abortos nativos de Windows, 503 histórico y corpus de producción pendientes. | `tecnologia/.local/evidencia/001/revision.md` (local, ignorado por Git) y el comentario del PR. |

## Alcance de las ejecuciones

- Las selecciones de backend usaron Node 24, `NODE_OPTIONS=--experimental-vm-modules`,
  Jest `--selectProjects <nivel> --runInBand --no-cache --runTestsByPath <archivo>`
  y JUnit por intento. La regresión con Redis detenido seleccionó `recuperacion`,
  `sesiones`, `correo` y `recuperacion-perfil` de I. Los fallos inyectados de PostgreSQL
  y Outbox en T110 permiten comprobar rollback y trazas seguras.
- `matriz-uicav-windows-1` enumera todos los archivos U/I/C/A por proyecto de Jest
  y ejecuta V con `vitest run --outputFile.junit=<reporte>`. `inventario.json` y
  los resultados de proceso identifican cada archivo. U pasó 120/120, I 104/104, V 53/53 y A
  2/2. En C, 9/10 archivos informaron 98 resultados aprobados. `openapi.spec.ts`
  abortó con `0xC0000409` sin JUnit en esa matriz y también en la repetición
  `t113-openapi-3-native` (`F3-6b78f423d384da46`). El manifiesto de T115 usa los
  20 casos aprobados de `t113-openapi-2` para completar la evidencia del archivo.
  Se comprobaron las huellas del contrato, el test y 96 fuentes del backend
  entre ambas versiones, con cero diferencias (`estatica-2/paridad-openapi.json`).
- La selección inicial E de T110 usó `npm run test:e2e:container --
  test/e2e/usuarios-acceso/recuperacion-perfil.spec.ts --project=chromium-768`.
  Para X-06 se seleccionó `seguridad-navegador.spec.ts`. Una invocación usó una
  carpeta de trabajo incorrecta y otra quedó bloqueada en la preparación Docker.
  `t111-e-linux-2` agotó la espera de la interfaz tras iniciar por el cliente API.
  Se repitió con inicio de sesión desde la interfaz y se verificó la misma cookie
  en el navegador. El ejecutor nativo ejecutó las dos suites nuevas con
  `npm run test:e2e:windows -- <ambos archivos> --project=chromium-768`.
- Linux completo `matriz-e-linux-1` usó `npm run test:e2e:container`,
  todos los archivos y nueve proyectos, sobre `F3-feabcccf7be40884`.
  Resultado 113 aprobados y cuatro fallos entre 117 casos. A 360 px,
  Chromium agotó la espera de 5 s del mensaje mientras la foto seguía cargando.
  El caso ahora comprueba primero el HTTP 201 de la carga. La selección corregida
  `perfil-e-linux-2` pasó 1/1 sobre `F3-e41dc1a1d03bc838`. Los otros fallos fueron
  contraseña en Firefox 1366 y permisos del prestador y perfil en WebKit 768 y
  1366, respectivamente. `matriz-e-linux-2` se inició sin filtros con
  `--sin-construir --workers=2` sobre `F3-e41dc1a1d03bc838`. Se interrumpió tras
  nuevos fallos de navegador y un error `EINVAL` al abrir un adjunto para redactar.
  Su resultado 143 corresponde a ejecución parcial. La selección independiente
  `t115-e-proyecto-1`, `--sin-construir --project=chromium-768`, pasó 13/13 en
  `F3-960a8ba8bfafa410` y es la evidencia E del manifiesto de T115.
- Las cuatro repeticiones acotadas de los fallos de `matriz-e-linux-1` pasaron
  por separado. `perfil-e-linux-2` cubre Chromium 360. `perfil-e-linux-webkit-2`,
  `contrasena-e-linux-firefox-2` y `permisos-e-linux-webkit-2` cubren WebKit 1366,
  Firefox 1366 y el prestador en WebKit 768, respectivamente, sobre
  `F3-960a8ba8bfafa410`. El resultado original de la matriz completa conserva sus
  cuatro fallos.
- T112 conservó intentos del arnés con ruta de CLI errónea, SWC sin acceso al
  módulo nativo y una aserción que esperaba código distinto de cero del emisor
  JSON incluso al detectar infracciones. La suite actual comprueba directamente
  las infracciones. En X-08 el primer intento pasó 10/20 y otros diez casos
  sufrieron `ECONNRESET` al seguir enviando el cuerpo después del rechazo temprano.
  La repetición verifica el `Content-Length` excedente y conserva el envío real
  de cuerpos en el límite. `test:proxy` añade exceso real del transporte.
- El catálogo usado fue el fixture determinista de validación. No hubo cambios
  en el código de producto, los contratos publicados, certificados ni almacenes
  de confianza existentes. Los diagnósticos TLS nuevos se guardaron por intento.

## Seguimiento independiente

- **503 histórico de recuperación** abierto, con causa indeterminada porque se
  perdió el detalle interno del intento original. Se conserva el diagnóstico D099,
  su evidencia y sus medidas de seguimiento. Los 503 inducidos para validar rollback
  y preparación se identifican como tales en las suites y en esta sección.
- **503 de sesión en la demostración de cierre**. El backend local registró un
  `POST /sesiones` en `db.conexion`, código `no_disponible`, mientras se ejecutaban
  comprobaciones. Los dos registros seguros de ese evento están en
  `cierre/matriz-e-linux-2/observacion-api.ndjson`. La evidencia identifica la
  etapa y la ruta de sesión. Las selecciones posteriores de inicio de sesión pasaron.
- **Windows nativo** mantiene su seguimiento separado por abortos de procesos y
  tiempos de espera documentados. Se verificaron por SHA-256 los 467 reportes
  del inventario histórico, con cero diferencias.
- **Corpus productivo** pendiente de entrega y validación para despliegue. Los
  resultados con el fixture corresponden a validación.

---

# Estado histórico de implementación de US7

Fecha local 2026-11-17. **US7 implementada y verificada.** T100–T109 completadas.
El backlog suma **109/119 tareas terminadas**. Los **53 escenarios de aceptación**
tienen evidencia en sus niveles requeridos y en las versiones documentadas.
El cierre transversal T110–T119 queda pendiente.

El titular autenticado entra desde Mi cuenta a Cambiar contraseña o puede
solicitar un enlace de recuperación si olvidó la actual. El cambio exige
la contraseña actual exacta y una nueva de 15 a 128 puntos Unicode con confirmación.
Argon2id usa el valor completo. El catálogo de validación comprueba valores comunes
y comprometidos. El formulario borra las tres entradas al confirmar el cambio.

El servidor prepara verificación, catálogo y hash fuera de los bloqueos. Dentro
de la transacción comprueba de nuevo titularidad, sesión, versión del perfil
y versión de credencial. Confirma PHC, versiones y resultado idempotente juntos.
Un replay exacto autenticado devuelve el resultado previo y una clave reutilizada
con otros datos válidos produce 409. Las pruebas concurrentes cubren un único
commit con claves distintas, replay con la misma clave y un reset que precede
a la escritura. El rollback conserva credencial, versiones y sesión.

Un cambio ordinario conserva las sesiones existentes, sus renovaciones y marcas
de autenticación reciente. Conserva también los enlaces de recuperación y solicitudes
de correo pendientes bajo sus políticas vigentes. La nueva versión del perfil
causa 409 ante una confirmación de correo con la versión anterior. Con versión
actual, el desafío conserva su vigencia. El consumo posterior de recuperación
sí revoca las sesiones según US3. PATCH de perfil rechaza campos de contraseña.
La respuesta del flujo específico se limita a código y mensaje, sin Set-Cookie.

## Evidencia de la versión probada

**US7-407db07e4ac3dbb3**, base Git `4430ca116f4b657681de7ddde1469fd883526afb` con cambios locales de US7.
El manifiesto registra 200 huellas y cada ejecución
comprueba la fuente antes y después. Los JUnit, comandos efectivos, JSON de Playwright
e informes de TLS están en `tecnologia/.local/evidencia/001/us7/US7-407db07e4ac3dbb3/`.

| Comprobación | Resultado | Archivos o proyectos |
|---|---:|---|
| Jest unitario completo | 114 | 9 archivos |
| Jest integración completo | 93 | 9 archivos con PostgreSQL real |
| Jest contrato completo | 93 | 8 archivos |
| Vitest completo | 53 | 7 archivos |
| US7 navegador Linux | 9/9 | Chromium, Firefox y WebKit a 360, 768 y 1366 px |
| US7 navegador Windows | 9/9 | Los mismos nueve proyectos |
| Regresión de navegador Linux | 10/10 | Selección de siete archivos en Chromium a 768 px |
| Regresión de navegador Windows | 10 casos cubiertos | La misma selección en Chromium a 768 px. Véase el detalle de intentos. |

US7 aporta 7 U, 7 I, 4 C y 7 V propias.
El contrato ampliado de permisos añade un caso sobre visitante, acceso vencido
y sesión revocada para POST /perfil/cambios-contrasena.
`verificacion.json` cruza CA-CLA-01–04 con los niveles de la matriz.

Para reproducir la cobertura del backend se ejecutó `node tecnologia/.local/pruebas/verificar-us7.mjs backend 1`
con Node 24.15.0 en Windows. Invoca Jest por archivo completo con
`--selectProjects <unit|integration|contract> --runInBand --no-cache --runTestsByPath <archivo>`.
Incluye fundación y las siete historias (registro, sesiones, recuperación, permisos,
perfil, correo y contraseña), diagnóstico unitario y diagnóstico de recuperación
en integración. Los archivos y códigos de los 26 procesos constan en
`backend-1/ejecuciones.json`. Vitest ejecutó `npm run test:unit -- --maxWorkers=1 --outputFile=<junit>`
con fundación, registro, sesiones, recuperación, vista de perfil, correo y contraseña.

Los comandos de navegador usan `npm run test:e2e:container -- ...` y
`npm run test:e2e:windows -- ...`. Para US7 se seleccionó
`test/e2e/usuarios-acceso/contrasena.spec.ts` en los nueve proyectos. La
regresión seleccionó fundación, registro, sesiones, recuperación, perfil,
permisos y correo con `--project=chromium-768`. Esta última selección cubre
diez casos por entorno y deja la matriz global de todas las historias para
el cierre transversal. Las matrices F3 siguen asociadas a F3. Se confirmó
que la CA, el certificado del servidor y los nombres admitidos coinciden
con la evidencia TLS previa. Los 7 controles estáticos de tipos,
lint, compilación y arquitectura pasaron.

## Intentos y pendientes

La primera prueba unitaria previa al código quedó en rojo por ausencia del
caso de uso. Los primeros chequeos de tipos detectaron mocks sin retorno
asíncrono tipado y un método Unicode fuera de la biblioteca configurada en
frontend. Ambos se corrigieron antes de congelar la fuente probada.

En el primer barrido, `test/integration/usuarios-acceso/correo.spec.ts` (salida 3221226505 / `0xC0000409`) terminó sin JUnit final.
La cobertura completa se acredita por archivo y con la repetición de los
archivos afectados. Los intentos iniciales se conservan en `backend-1/`
y sus repeticiones en `repeticion-1/`, con observador de inicio y fin de casos.
Los abortos nativos de Windows conservan su seguimiento independiente.

La selección Windows inicial aprobó 8/10.
Dos casos de registro agotaron el plazo al seleccionar perfil y al localizar
la confirmación de incorporación. Se conservó el reporte inicial y se repitió
solo registro con `test/e2e/usuarios-acceso/registro.spec.ts --project=chromium-768`
en `registro-windows-1/`. Pasó 2/2.
La cobertura de diez casos se acredita por unión. La repetición aprobada no
determina la causa de los timeouts ni modifica sus plazos originales.

El HTTP 503 histórico de recuperación mantiene causa indeterminada.
El diagnóstico, sus limitaciones y las propuestas de captura y seguimiento
se conservan en [diagnostico-t099.md](diagnostico-t099.md). El aborto nativo
y el 503 histórico son incidentes independientes. Se verificaron las huellas
de 467 reportes anteriores inventariados.
El ejecutor Windows actualizó el diagnóstico TLS de ruta fija. Se archivó el
diagnóstico de US7 junto a los nuevos resultados y se restauró el archivo anterior
con la huella SHA-256 idéntica al inventario. Véase `separacion-diagnostico-tls.json`.
El corpus productivo completo aprobado y el cierre transversal T110–T119 siguen
pendientes. El catálogo de estas pruebas es el fixture de validación.

## Registro histórico de US6 y entregas anteriores

Este registro conserva el estado anterior con sus versiones y alcances.

# Estado actual: T099 aceptada; US6 terminada en su alcance

Fecha local: 2026-11-17. **T099 terminada y verificada por su criterio original.**
Balance: **99/119 tareas terminadas, 20 pendientes**. US7 no iniciada.
La reevaluación separa la aceptación funcional del incidente HTTP 503 histórico,
que continúa abierto con causa indeterminada. T110 y el corpus productivo completo
aprobado conservan sus pendientes independientes; tampoco se cierra la DoD global.

T099 exige conectar las rutas y ejecutar T086–T090, permisos ampliados y regresiones
de acceso/recuperación, conservar resultados y comprobar destinos/sesiones según
contrato. Esos criterios están acreditados. No se añade como condición identificar
la causa histórica. Tabla por criterio, versiones y justificación de las pruebas
necesarias en [aceptacion-t099.md](aceptacion-t099.md).

**Fuente actual D099-e333f5a7f71d150f**, 188 huellas, sin cambios de código en esta
reevaluación. La selección previa D099 acredita 54 U/57 I/35 C e incluye correo,
sesiones, recuperación, fundación y diagnóstico. Se actualizaron únicamente:

- I permisos: **10/10**, archivo completo.
- C permisos: **19/19**, archivo completo, incluidas las tres rutas US6.
- E correo: **1/1**, Linux/chromium-768, API D099 reiniciada, TLS activo.

La unión D099, sin duplicar casos, acredita **54 U/67 I/54 C** en archivos
seleccionados. **No es una regresión completa del backend.** El E actual es un
único recorrido; **no es una nueva matriz de navegador**. No hubo fallos, omitidos,
reintentos automáticos ni abortos nativos en estas verificaciones nuevas.
Tipos/lint/build/arquitectura ya están aprobados en la misma fuente D099 y no se
repitieron. La regla inclusiva 0–300 s y las garantías de sesión no cambiaron.

Frontend, pruebas web, lockfiles y contrato coinciden con F3 en 51 huellas revisadas.
V correo 9/9 (dentro de 46 V) y los 9 E de correo por entorno (dentro de 90/90 Linux
y 90/90 Windows, con espera 301 s en chromium-360) se conservan identificados con F3.
El recorrido actual demuestra la conexión web/API D099; I/C actuales cubren las
reglas, permisos, destino anterior/nuevo y conservación de sesiones/renovaciones.
No se atribuyen a D099 las matrices completas anteriores ni se suman como casos nuevos.

**Incidente HTTP 503: abierto e independiente.** Se conservan evidencia original,
limitaciones de la investigación, registros seguros añadidos y propuestas de
captura/retención/correlación del [diagnóstico](diagnostico-t099.md). La causa
continúa indeterminada; la prueba inducida 55P03 no la demuestra.
**Abortos Windows 0xC0000409: separados**, con intentos y repeticiones conservados;
esta aceptación no los declara reparados.

Evidencia nueva: tecnologia/.local/evidencia/001/us6/aceptacion-t099-20261117/.
**467 archivos de evidencia anteriores mantienen sus huellas.** Fuente e imagen
del navegador comprobadas, CA/certificado/SAN conservados, sin tokens expuestos
en el escaneo de reportes y ZIP HTML. Se detuvieron únicamente API/Vite propios.
**Siguiente T100/US7, no iniciada. T110, corpus e incidente histórico pendientes.**

## Registro histórico del diagnóstico y decisiones anteriores

El estado que sigue se conserva como histórico. Sus menciones de T099 pendiente
corresponden a la instrucción anterior y quedan sustituidas por esta reevaluación.
Las evidencias, incidentes y limitaciones conservan su significado y su versión.

Fecha: 2026-11-17. **US6 implementada, T099 pendiente; US7 no iniciada.**
Balance sin cambios: **98/119 tareas terminadas y 21 pendientes**. T110 y corpus
productivo completo aprobado siguen pendientes. No se marca ninguna tarea nueva.

T099 exige conectar las rutas de correo y comprobar sus regresiones: ese criterio
está acreditado por F3. No exige una atribución causal retrospectiva. La petición
posterior añadió el diagnóstico y ordena mantenerla pendiente si la información
original no permite identificar la causa. Se conserva su texto y su checkbox.

**Conclusión del 503 histórico:** causa no determinada. El XML original conserva
HTTP 503 / esperado 200 y stack de aserción, sin excepción interna ni código de driver.
La duración 23.977 s y los inventarios de PostgreSQL no establecen causalidad.
Los reportes históricos no se reescriben. Detalle, criterio literal e inventario
de rutas en [diagnostico-t099.md](diagnostico-t099.md).

**Mejora aplicada:** registro seguro antes de perder las excepciones del flujo
examinado. Correlación UUID generada por el servidor y aislada por petición;
ruta contractual redactada, etapa fija, clase/código permitidos y puntos de código
propios. Sin mensajes libres, SQL, parámetros, cuerpos, cabeceras, credenciales,
enlaces ni datos de cuenta. Respuesta/cookies/contratos/reglas/TLS conservados.
No se acredita observabilidad integral de los adaptadores ajenos al diagnóstico.

**Versión final D099-e333f5a7f71d150f**, base Git 7d3f71bb2d5ceaae2928e2534d5234425cbd67fc,
188 huellas de fuente. Windows/Node 24.15.0 y PostgreSQL 18 real. Selección completa
por archivos: **54 U,57 I,35 C**, 14 procesos secuenciales, sin casos omitidos. Incluye
fundación/recuperación/sesiones/correo y 10 U+2 I nuevos de diagnóstico. No se presenta
como ejecución de todas las suites del backend. Tipos/lint/build/arquitectura 0;
141 módulos y 459 dependencias, sin infracciones. Comandos y archivos exactos en
la tabla del diagnóstico y en final-2/ejecuciones.json.

Una carrera controlada con lock mantenido produjo 503 / SQLSTATE 55P03, dejando
diagnóstico seguro; rollback, login sin reset confirmado y retry posterior pasaron.
Esto prueba ese fallo inducido, **no explica el incidente histórico**. La carrera
normal de recuperación y la del correo anterior también pasan en esta versión.

Incidente separado: final-1 tuvo dos abortos nativos Windows 0xC0000409 sin JUnit
final en REC/SES; su repetición 14/14 + 19/19 con observador se conserva. El lint inicial
también falló; la liberación se movió a un auxiliar y se repitió toda la selección
en final-2, que pasó 54/57/35 sin abortos. No se declara reparado el incidente nativo.

**Navegadores no repetidos:** frontend, TLS, contrato y comportamiento público no
cambiaron. Las matrices anteriores 90/90 Linux y 90/90 Windows corresponden a F3,
no a esta nueva revisión de diagnóstico; conservan su evidencia histórica.
417 archivos de evidencia anteriores mantienen sus huellas. Evidencia nueva en
tecnologia/.local/evidencia/001/us6/diagnostico-t099-20261117/ (verificacion.json,
examen-historico.json, intentos iniciales, final-1, repeticion-1 y final-2).
Quedan por preparar captura/retención de stderr en despliegue y conservación de
correlación/versión ante una próxima ocurrencia; véase el diagnóstico detallado.

## Registro histórico de F3 y entregas anteriores

El cuerpo siguiente conserva el estado anterior. Sus matrices completas y conteos
pertenecen a las versiones allí indicadas; el estado vigente es el diagnóstico anterior.


Fecha local: 2026-11-17 (America/Mexico_City). Alcance: **solo US6, T086–T099**.
Se conservan US1–US5 y TLS. **T086–T098 verificadas; T099 permanece pendiente** por
la petición adicional de determinar la causa del 503 histórico de recuperación.
No se presenta como resuelto un fallo cuya causa original no se pudo demostrar.
Balance: **98/119 tareas terminadas, 21 pendientes**. Las pruebas acreditan
**49/53 CA**, incluidos los seis CA-COR; US6 aún no tiene cierre completo.
**US7 no iniciada. T110 y el corpus productivo siguen pendientes.**

## Correcciones comprobadas al retomar

**Correo anterior durante un login concurrente.** La barrera nueva de CA-COR-06
reprodujo un 200 indebido: el login encontraba el correo anterior y verificaba su
contraseña fuera del lock; otra petición confirmaba el cambio antes de emitir la
sesión. `aplicacion/iniciar-sesion.ts` ahora vuelve a resolver el correo con la
misma canonización PostgreSQL **después de bloquear la cuenta**, comprobando que
todavía identifica al mismo UUID. Conserva la revalidación de versión de contraseña.
La prueba final recibe 401, sin Set-Cookie y sin crear otra sesión. No se compara
el correo con reglas Unicode distintas en JavaScript ni se revocan sesiones existentes.

**Reloj de fixtures.** Los fixtures nuevos de correo tomaban la marca de contraseña
de `clock_timestamp()` mientras la aplicación decide con `RelojServidor` de Node;
el caso de actividad también restaba 301 segundos al reloj DB. Esa sincronización
entre relojes no era una precondición válida para esos tests. El helper nuevo
`cuentaCorreoFicticia` usa una marca Node como el login productivo, y la prueba
actividad/refresh deriva la marca de `e.reloj.ahora()`. Las pruebas de frontera
inyectan explícitamente el mismo reloj de decisión. **La política no cambió:**
0–300000 ms inclusive; 300001, marca ausente o futura requieren reautenticación.
No se amplió el intervalo, añadió tolerancia ni modificó la configuración horaria
del host/Docker. Una muestra diagnóstica posterior midió desfase DB/Node de 0–3 ms;
esa muestra no prueba cuál era el desfase durante el intento fallido anterior.

**503 histórico: investigación y bloqueo.** En
`post-correccion/backend-integration-junit.xml`, CA-REC-08 reset/login esperaba 200
y recibió 503. El reporte conserva el HTTP y stack de la aserción, pero no la
excepción original convertida a `DEPENDENCIA_NO_DISPONIBLE`. Se revisaron los logs
de PostgreSQL del intervalo: no apareció timeout/deadlock de servidor que explique
ese caso. No se atribuye retrospectivamente a locks, memoria, reloj o código sin
evidencia. Se añadieron observadores de diagnóstico **solo en herramientas ignoradas**:
registran etapa/código/clase, nunca SQL, parámetros, contraseñas o tokens.
Recuperación aislada14/14, correo16/16 y la integración completa 84/84 con observador
pasaron; también la ejecución final completa por archivos pasó84/84 sin observador.
La carrera de recuperación final pasó y conserva la garantía de revocar sesiones.
**La causa histórica no se reprodujo ni se pudo recuperar de los datos originales.**
Esta es la condición pendiente de T099; no se declara que repetir la suite la reparó.

## Flujo US6 implementado

La solicitud exige sesión y perfiles vigentes, titularidad, versión actual y marca
de contraseña de **esa misma sesión**, de antigüedad inclusiva 0–300 segundos.
Actividad y renovación no reinician la marca. Reautenticación compara la contraseña
completa fuera del lock y revalida credencial/sesión después; solo acredita su sesión,
sin crear o renovar tokens. Los intentos fallidos respetan y confirman el bloqueo5/15.
La barrera reset/reautenticación impide acreditar una sesión ya revocada.

La migración008 y el repositorio propio crean desafíos separados de recuperación:
FK titular/sesión, nuevo correo y canónico con `correo_001/lower`, digest único,
30 minutos, autenticación acreditada, uso único y versión. Solicitud+Outbox cifrado+
resultado idempotente se confirman juntos. **No reservan el destino ni cambian el
correo vigente.** La plantilla envía verificación al nuevo destinatario con base
HTTPS confiable y fragmento; el worker reintenta el mismo desafío y limpia el payload.
Un fallo de entrega conserva el correo anterior y el destino anterior de recuperación.

Confirmación exige sesión válida del mismo titular, propósito/token vigentes,
versiones actuales de perfil y desafío, y unicidad al commit por índice. **No exige
otra vez 300 segundos.** Correo+versiones+consumo+resultado se confirman atómicamente;
se conserva UUID, hash/versión de credencial, perfiles, datos, sesiones y renovaciones.
No se añaden invalidaciones por versión de credencial ni revocación global no aprobadas.
Dos cuentas verificando el mismo destino tienen una ganadora y un409; un error
después de escribir revierte correo, consumo y resultado. El nuevo correo pasa
a identificar login y recuperación; el anterior deja de identificar esa cuenta.

Las tres rutas nuevas aplican guard/origen/allowlists y **no emiten Set-Cookie**.
Solicitud/confirmación exigen Idempotency-Key; reautenticación no es idempotente.
Replay exacto con sesión válida conserva el resultado, incluso tras vencer el desafío,
sin nuevas mutaciones/avisos. Misma clave con otro cuerpo/token da409; otra clave
con enlace usado da422. La sesión vencida/revocada no permite saltar autenticación
por replay. GET no consume. CorreoWeb conserva cuerpo y clave ante respuesta perdida,
consulta versión actual y permite resolver409; formularios conservan el correo
vigente y el servidor decide recencia. Fragmento solo en memoria/historial limpio,
sin almacenamiento local. No se implementa el cambio de contraseña de US7.

## Versiones y ejecuciones

**Versión final:** `F3-a6f68f56d2e7d9bb`, base Git
`013f02040fb99dd645da15724351f32324cacb08` más los cambios locales de US6.
`tecnologia/.local/evidencia/001/us6/version-final.json` y `final-f3/version.json`
contienen las **185 huellas de fuente/configuración/lockfiles/contrato**.
Las matrices registran la huella antes/después; ambas deben coincidir con F3.
La API se reinició tras la corrección; no se atribuyen los E anteriores a esa API nueva.

| Etapa | Versión probada | Resultado y acreditación |
|---|---|---|
| Implementación inicial | V0 lógica: antes de revalidar correo en login y alinear fixtures | U97/I83/V46; C inicial nativo sin JUnit, repetición88/88. Linux 90/90. Windows interrumpida: al menos62 aprobados, sin reporte final acreditado. |
| Carrera de correo, RED | V0 | Una prueba seleccionada recibió 200 en vez401; quince no seleccionadas. Diagnóstico, no cobertura completa. |
| Primera corrección de login | V1 lógica: login corregido, fixtures aún con reloj DB | `post-correccion/`: U97; I74 aprobadas/10 fallidas (REC503 y nueveCOR); C nativo. Conservada. |
| Revisión de fixtures | V2 lógica, cambios que integra F3 | `validacion-final/`: U97/C88 y estáticos0; I termina nativamente tras recuperación, sin JUnit final. No se acredita como84/84. |
| Diagnóstico al retomar | Fuente final F3, observadores declarados | REC14/14, COR16/16 y completa I84/84; no se reprodujo el503. |
| Final F3, backend | Huella F3 contemporánea | U97/I84 completos; C88 por seis archivos62 casos y repetición diagnóstica registro26/26. No es C monolítica sin repeticiones. |
| Final F3, frontend | Huella F3 | V46/46, seis archivos; tipos/lint/build0. |
| Final F3, E Linux | Huella F3 antes/después | 90/90, sin omitidos ni reintentos automáticos. |
| Final F3, E Windows | Huella F3 antes/después | 90/90, sin omitidos ni reintentos automáticos. |

V0/V1/V2 son asociaciones lógicas reconstruidas por las correcciones y el orden
de ejecución; no existía una huella completa contemporánea de cada intento.
La identificación criptográfica verificable corresponde a F3. Las fuentes no
cambiaron durante los ensayos F3. Los intentos parciales no se suman como casos nuevos.

## Comandos y suites incluidas

Backend Windows/Node24, PostgreSQL18 real en bases aisladas. Para acotar la
inestabilidad nativa de Jest Windows se ejecutó cada archivo completo en un
proceso secuencial, con el mismo Jest/SWC y sin relajar aserciones ni plazos:

`node tecnologia/.local/pruebas/backend-completo-us6.mjs`

El orquestador descubre **los siete archivos de cada grupo** y llama al CLI Jest
con `--selectProjects <unit|integration|contract> --runInBand --no-cache
--runTestsByPath <archivo>`. No selecciona nombres de casos ni excluye historias.
`final-f3/{unit,integration,contract}-ejecuciones.json` conserva las 21 invocaciones,
archivos, huella y salidas. Los nombres bajo cada `backend/test/<grupo>/` son:
`fundacion.spec.ts` y `usuarios-acceso/{correo,perfil,permisos,recuperacion,registro,sesiones}.spec.ts`.
La primera pasada F3 C dejó registro con0xC0000409; la repetición con un observador
que solo registra inicio/fin de casos pasó26/26. `contract-consolidado.json` y
`backend-contract-verificado-junit.xml` mantienen esa unión explícita de siete archivos.

Frontend: `npm.cmd run test:unit -- --maxWorkers=1
--outputFile=../.local/evidencia/001/us6/final-f3/frontend-junit.xml`.
Seis archivos: `test/unit/fundacion.test.ts` y
`usuarios-acceso/{registro,sesiones,recuperacion,perfil,correo}.test.tsx`.

Navegadores: `node tecnologia/.local/pruebas/navegadores-f3.mjs linux` y luego
`... windows`, que ejecutan respectivamente `npm run test:e2e:container` y
`npm run test:e2e:windows`, **sin filtros**, siete archivos y nueve proyectos,
un worker. Los archivos E son `test/e2e/fundacion.spec.ts` y
`usuarios-acceso/{registro,sesiones,recuperacion,perfil,permisos,correo}.spec.ts`.
Chromium/Firefox/WebKit ×360/768/1366; diez casos por proyecto. En chromium-360
de cada entorno se espera **301 segundos reales** antes de confirmar; los otros
ocho proyectos verifican el mismo recorrido sin repetir esa espera física.
No existe backdoor de reloj en la aplicación. Las fronteras exactas se prueban U/I.

| Suite | U | I | C | V | E por entorno |
|---|---:|---:|---:|---:|---:|
| Fundación | 10 | 6 | 5 | 7 | 9 |
| Registro US1 | 32 | 10 | 26 | 7 | 18 |
| Sesiones US2 | 15 | 19 | 13 | 9 | 9 |
| Recuperación US3 | 11 | 14 | 9 | 6 | 9 |
| Perfil US5 | 14 | 9 | 8 | 8 | 9 |
| Permisos US4 ampliada | 7 | 10 | 19 | — | 27 |
| Correo US6 | 8 | 16 | 8 | 9 | 9 |
| **Total final** | **97** | **84** | **88** | **46** | **90** |

La comparación por identidad y multiplicidad conserva los 89 U/68 I/77 C/37 V/81 E
del cierre US4; se añaden8 U/16 I/8 C/9 V/9 E de correo y tresC de permisos. REC sigue
incluida. Los233 archivos históricos inventariados permanecen sin cambios.
Tipos/lint/build de ambas aplicaciones pasan; arquitectura0 infracciones,139 módulos/
450 dependencias. La imagen Linux recompilada y proxy pasan; certificados, CA,
confianza, TLS, contratos y políticas aprobadas intactos. No acredita rendimiento.

## Trazabilidad, evidencia y pendientes

CA-COR-01/05/06: I/C/E; CA-COR-02/03: U/I/C; CA-COR-04: I/C. V adicional cubre
pendiente, petición de contraseña, errores y reintentos. T097 amplía permisos a
las tres rutas nuevas: nueve Bearer y dos de cookie; queda futura solo la ruta US7.
Cadena: HU02/RF05, apoyo HU01/RF02/RF04 → FR-001/023/024/032 → AC04/EQ-04,
AC07/EQ-07 → DA03/DA04/DA10 → ADR-002/003/004/005/006/009 → Usuarios y acceso/
API mínima de Notificaciones → U/I/C/V/E; PR04/PR07/PR13 y regresión PR14.

Evidencia en `tecnologia/.local/evidencia/001/us6/`: originales y parciales,
diagnóstico y `final-f3/`; `verificacion-f3.json`, `comandos-y-suites-f3.json`,
`cobertura-us6-f3.json`, huellas y examen de secretos, incluido ZIP de HTML.
Los reportes de C con proceso abortado no se sustituyen por el resultado posterior.
La inestabilidad Windows 0xC0000409 sigue sin causa demostrada; registrar una
repetición aprobada no equivale a reparar ese fallo nativo. Se conservan también
US5Linux7/9, timeoutsWebKitUS4 y limitación del inspector SameSiteWebKitWindows;
la cabecera Lax sigue comprobándose y TLS no se relaja.

**Bloqueo de cierre:** no se ha cumplido la petición de identificar causalmente el
503 original. Su ejecución descartó la excepción interna y no se ha conseguido
reproducirlo con diagnóstico; no hay un fallo funcional actual demostrado en F3.
T099 queda pendiente y US6 no se declara cerrada. T100/US7 no iniciada; T110,
corpus productivo completo aprobado y DoD global/CI/rendimiento/usabilidad/revisión/
fusión permanecen pendientes. El fixture local no sustituye el corpus productivo.

## Registro histórico de US4 y anteriores

Se conserva a continuación todo el cuerpo del estado previo. Sus cifras y tareas
pendientes son históricas; el estado vigente es el informe F3 anterior.


Fecha local: 2026-11-17 (America/Mexico_City). Continuación autorizada:
**solo US4, T077–T085, nueve tareas implementadas y verificadas localmente**.
Se conservan US1–US3, US5 y TLS. El backlog mantiene **119 tareas: 85 terminadas
y 34 pendientes**. La siguiente es **T086 (US6), no iniciada**. Se acreditan
acumulativamente **43/53 CA**: 11 REG, nueve SES, diez REC, seis PER y siete AUT.
Los diez CA de US6/US7 y la DoD global permanecen pendientes.

## Cierre de US4: permisos, titularidad y privacidad

`aplicacion/evaluar-acceso.ts` aplica identidad/sesión vigente, perfiles habilitados
y titularidad mediante el puerto propio `LectorSesion`. No conserva permisos en
caché ni acepta roles enviados por el cliente. `api-publica.ts` entrega identidad
mínima y autorización interna, sin repositorios, tipos ORM o credenciales. La
composición la conecta a los adaptadores actuales; no se construyen otros módulos.
La lectura del servidor se repite por operación. Las escrituras de perfil,
fotografías e incorporación de perfiles vuelven a comprobar sesión y perfiles
después del bloqueo de cuenta; inicio, bootstrap CSRF, renovación y cierre comprueban
los perfiles actuales dentro de su transacción. Tener ambos perfiles no permite
operar sobre otro titular. El cierre usa la sesión Bearer, aunque se envíe una
cookie de otra cuenta.

El guard conserva su interfaz fundacional y comparte la evaluación de acceso.
Además del decorador, exige el Bearer indicado por el contrato mediante una marca
interna del middleware; un controlador que omita el decorador no queda abierto.
Las allowlists existentes rechazan identificadores, propiedades administrativas
y campos extra. Se comprueban 401 por ausencia/vencimiento/revocación, 403 por
permiso insuficiente, 404 indistinguible para foto ajena/inexistente y 400 por
campos no admitidos. El rechazo conserva datos y no emite credenciales. Un error
de PostgreSQL produce 503, sin autorización alternativa. Las fotos ajenas se
rechazan antes de consultar el objeto privado en S3.

T082 reutiliza **sin modificar ni duplicar** la proyección de T069. La API interna
solo permite nombre para mostrar, distrito, perfiles y teléfono si el consentimiento
efectivo corresponde al mismo valor. Excluye correo, documentos, dirección exacta
y credenciales. No se añade endpoint, búsqueda ni perfil público RF10. La web
incorpora `EstadoAcceso.tsx`, mensajes seguros y limpieza del estado al perder sesión;
la autorización se comprueba en el servidor incluso con peticiones manipuladas.

La referencia administrativa es un fixture adversarial que señala esa condición;
no es un nuevo rol persistido ni un administrador creado por registro. Las pruebas
demuestran que esa marca no otorga derechos sobre otra cuenta. PostgreSQL exige
uno o dos perfiles válidos: la ausencia de perfiles se inyecta dentro de una
transacción revertida o mediante el puerto de prueba. No se deshabilitan constraints
ni se atribuye a esos casos una cuenta inválida persistida. El cambio real de
cliente a prestador en DB confirma la ausencia de caché de permisos.

### Comandos y suites efectivamente incluidas

Se usó Node 24 local, lockfiles y dependencias existentes. U/I/C/V se ejecutaron
en Windows nativo; I/C usan PostgreSQL 18 real en bases aisladas y los servicios
locales de validación. Desde `tecnologia/backend`,
`JEST_JUNIT_OUTPUT_DIR` apunta en absoluto a `tecnologia/.local/evidencia/001/us4/`
y `JEST_JUNIT_OUTPUT_NAME` a `backend-<nivel>-junit.xml`, por ejecución:

| Nivel | Comando | Archivos incluidos bajo `test/<nivel>/` | Aprobadas |
|---|---|---|---:|
| U | `npm.cmd run test:unit -- --no-cache` | `fundacion.spec.ts` y `usuarios-acceso/{registro,sesiones,recuperacion,perfil,permisos}.spec.ts` | 89 |
| I | `npm.cmd run test:integration -- --runInBand --no-cache` | Los mismos seis nombres bajo `test/integration/` | 68 |
| C | `npm.cmd run test:contract -- --no-cache` | Los mismos seis nombres bajo `test/contract/` | 77 |

Desde `tecnologia/frontend`:

| Nivel/entorno | Comando | Inclusión efectiva | Aprobadas |
|---|---|---|---:|
| V, Windows | `npm.cmd run test:unit -- --outputFile=../.local/evidencia/001/us4/frontend-junit.xml` | `test/unit/fundacion.test.ts` y `usuarios-acceso/{registro,sesiones,recuperacion,perfil}.test.tsx` | 37 |
| E, Linux Docker | `npm.cmd run test:e2e:container` | `test/e2e/fundacion.spec.ts` y `usuarios-acceso/{registro,sesiones,recuperacion,perfil,permisos}.spec.ts`; nueve proyectos | 80/81 inicialmente; cierre por repetición indicada abajo |
| E, Windows nativo | `npm.cmd run test:e2e:windows` | Los mismos seis archivos y nueve proyectos | 80/81 inicialmente; cierre por repetición indicada abajo |
| E, Linux, repetición secuencial | `npm.cmd run test:e2e:container -- --sin-construir test/e2e/usuarios-acceso/sesiones.spec.ts` | Solo sesiones, nueve proyectos; misma imagen y fuente | 9/9 |
| E, Windows, repetición secuencial | `npm.cmd run test:e2e:windows -- test/e2e/usuarios-acceso/registro.spec.ts` | Solo registro/incorporación, nueve proyectos | 18/18 |

Los comandos completos no usan filtros de rutas, historias, grep ni proyectos.
Recuperación está incluida en **todos** los niveles. Cada matriz E usa un worker,
Chromium/Firefox/WebKit × 360/768/1366, backend real, datos ficticios aislados,
Mailpit y HTTPS estricto. `E2E_EVIDENCIA` separa `us4/` (el runner Linux crea
`e2e-linux/`) y `us4/e2e-windows/`; Windows usa `PLAYWRIGHT_BROWSERS_PATH` absoluto
a `tecnologia/.local/ms-playwright/`. Las matrices completas tuvieron un fallo de
espera por entorno; las suites afectadas se repitieron de forma manual y secuencial,
sin cambios de código, tiempos o aserciones. La unión por identidad y multiplicidad
cubre **81 casos distintos aprobados por entorno**, con cero fallos pendientes,
sin omitidos ni reintentos automáticos. No se presenta como una ejecución monolítica
81/81. Smoke complementario de US4: `npm.cmd run test:e2e --
test/e2e/usuarios-acceso/permisos.spec.ts --project=chromium-360 --workers=1`, 3/3.

| Suite | U | I | C | V | E por entorno |
|---|---:|---:|---:|---:|---:|
| Fundación | 10 | 6 | 5 | 7 | 9 |
| Registro US1 | 32 | 10 | 26 | 7 | 18 |
| Sesiones US2 | 15 | 19 | 13 | 9 | 9 |
| Recuperación US3 | 11 | 14 | 9 | 6 | 9 |
| Perfil US5 | 14 | 9 | 8 | 8 | 9 |
| Permisos US4 | 7 | 10 | 16 | — | 27 |
| **Total de casos distintos cubiertos** | **89** | **68** | **77** | **37** | **81** |

La comparación por identidad de caso y multiplicidad conserva los **82 U, 58 I,
61 C, 37 V y 54 E por entorno** de la unión US5 + auditoría REC. Las únicas
adiciones son 7 U, diez I, 16 C y 27 E por entorno de US4. Se conservan las fuentes
de los 20 archivos de pruebas fundacionales/US1–US3 inventariados en la auditoría, y las huellas
de los reportes históricos. Esta ejecución completa acredita la regresión
independiente de esas historias; **no sustituye las nuevas variantes de T110**.
Además, `fuentes-anteriores.json` acredita los 25 archivos de suites anteriores,
incluidos los de perfil, sin cambios contra HEAD.

También pasan typecheck, lint y build de ambas aplicaciones, y
`npm.cmd run test:architecture`: cero infracciones, 125 módulos y 388 dependencias.
`npm.cmd run test:container` recompila la imagen Linux: UID 1000, Argon2id nativo,
salud 200/503/503, sesiones 401/401, recuperación genérica 202 y perfil/foto 401/401.
`npm.cmd run test:proxy` verifica salud/web 200 y excesos 413. Las matrices de
navegador verifican confianza TLS y rechazo de certificados no confiables, con
CA/certificados/proxy/confianza anteriores conservados.

### Rutas y trazabilidad de los siete CA-AUT

T079 cubre las **ocho operaciones privadas actuales**, bajo `/api/v1`:
seis Bearer (`GET/PATCH /perfil`, `POST /perfil/perfiles`, `POST /perfil/fotografias`,
`GET /perfil/fotografias/{fotografiaId}`, `DELETE /sesiones/actual`) y dos con cookie
(`GET /sesiones/csrf`, `POST /sesiones/renovacion`). Las cinco operaciones públicas
existentes son registro, inicio, solicitud/consumo de recuperación y salud. Las
cuatro operaciones futuras de US6/US7 siguen sin implementar: `POST
/sesiones/reautenticacion`, `POST /perfil/cambios-correo`, `POST
/perfil/cambios-correo/{token}/confirmacion` y `POST /perfil/cambios-contrasena`.
La matriz se ampliará en T097/T107 y se repetirá en T110; su ausencia actual está
delimitada, no es una exclusión silenciosa.

| CA | Evidencia ejecutada conforme a matriz | Tareas |
|---|---|---|
| CA-AUT-01 | I/C: visitante, vencimiento, revocación; seis rutas Bearer y dos de cookie; sin datos ni emisión | T078/T079/T083/T085 |
| CA-AUT-02 | I/C/E: cliente, prestador y ambos consultan/editan su cuenta; fotos propias; petición manipulada rechazada | T078–T080/T085 |
| CA-AUT-03 | U/I/C: dos titulares, ID/foto ajenos, sesión propia al cerrar, estado conservado | T077–T079/T081/T085 |
| CA-AUT-04 | U/C: ninguna marca o campo concede administración; perfiles inválidos rechazados | T077/T079/T083/T085 |
| CA-AUT-05 | U/I/C: rol sin titularidad, perfiles vigentes, revalidación tras lock y DB caída sin bypass | T077–T079/T081/T083/T085 |
| CA-AUT-06 | U/C: proyección interna serializada y consentimiento del mismo teléfono, sin privados | T077/T079/T082/T085 |
| CA-AUT-07 | I/C: UUID, cuentaId y privilegios extra inmutables; sin cambios parciales | T078/T079/T083/T085 |

Evidencia local ignorada: `tecnologia/.local/evidencia/001/us4/`. Incluye JUnit U/I/C/V,
`e2e-linux/`, `e2e-windows/`, `repeticion-linux/e2e-linux/` y `repeticion-windows/`
con JSON/JUnit/HTML, versiones y TLS; `verificacion.json`,
`comandos-y-suites.json` con archivos y casos exactos, `cobertura-us4.json`, códigos de
salida, imagen/proxy, huellas históricas y `secretos-reportes.json`. Los reportes
sanitizados no conservan tokens de acceso/renovación/recuperación sin redacción;
capturas, vídeos y trazas siguen desactivados. La comprobación incluye el ZIP
embebido en HTML. Los documentos normativos y contratos no se modificaron.

### Incidentes conservados y pendientes

Antes de implementar se observó el fallo unitario por módulos de US4 todavía
ausentes. En la ejecución aislada posterior, integración dio 9/10 porque el
wrapper de fallo seguía activo durante el GET de verificación. Se corrigió la
restauración del wrapper en la prueba y la ejecución completa dio 68/68. El
contrato aislado no llegó a ejecutarse por el corte secuencial: su código propagado
no representa una suite ejecutada. El guard mantuvo su constructor original para
conservar los mocks fundacionales. No se modificaron las pruebas previas.

El primer intento Windows se interrumpió al detectar una ruta de navegadores
inexistente. Se conservan los registros parciales bajo
`intento-windows-ruta-incorrecta/`; la matriz posterior usa la ruta instalada correcta; su cierre se acredita
junto con la repetición de la suite afectada. La matriz completa de Linux acabó 80/81:
WebKit 360 seguía mostrando «Cerrando sesión…» al vencer la aserción de cinco segundos.
La de Windows acabó 80/81: WebKit 768 agotó 60 segundos esperando el primer campo
del registro, antes de enviar el alta. Ambas matrices se estaban ejecutando en
paralelo; esa circunstancia es una posible causa de latencia, no una causa probada.
Se conservaron los dos fallos y se repitieron secuencialmente las suites existentes
de sesiones Linux (9/9) y registro Windows (18/18), sin ampliar tiempos, desactivar
validaciones ni cambiar el código probado. No se reprodujeron los fallos. Las
repeticiones manuales están identificadas y no se ocultan bajo `flaky: 0` del runner.
Estos intentos adicionales no aumentan los 81 casos distintos del total.
Se conservan además el incidente US5 Linux 7/9 y todos los históricos
US1–US3, incluida la limitación del inspector SameSite WebKit Windows: informa
None aunque la cabecera es Lax. Se sigue exigiendo la cabecera Lax en cada motor.

**Sin bloqueo actual de US4.** T086–T109 (US6/US7) no iniciadas; T110 mantiene la
regresión conjunta recuperación/perfil, barreras/rollback y variantes transversales
extendidas. T111–T119, CI, cobertura global, rendimiento/usabilidad, revisión y fusión
siguen pendientes según el plan. El **corpus productivo completo aprobado continúa
pendiente antes del despliegue**: el fixture de validación no lo sustituye y se
rechaza en producción. No se declara 001 terminada ni desplegada. Detención al
cerrar T085, antes de US6.

## Registro histórico de US5 y auditoría US3 → US5

El contenido siguiente se conserva como evidencia histórica del estado previo;
sus cifras y tareas pendientes corresponden a aquel cierre. El estado vigente
es el cierre de US4 documentado arriba.


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

## Administración fuera de 001 (nota para el módulo futuro)

001 solo habilita los perfiles cliente y prestador. No implementa cuentas, roles, autenticación ni panel administrativos, conforme a FR-029 y a la matriz de permisos. El futuro módulo de administración (HU25–HU28, RF39–RF45) debe definir un procedimiento seguro de creación de cuentas administrativas, separado del registro público y de la edición de perfil, con su autenticación y trazabilidad. Hasta entonces, la comprobación de 001 es negativa: registro, edición y habilitación de perfiles rechazan `administrador`, `rol`, `permisos` e identificadores (CA-AUT-04, CA-AUT-07).

## Ajuste visual: fotografía de perfil e identidad «WasiMaki» (2026-11-25, sin versionar)

**Naturaleza.** Ajuste visual compatible con 001 y 002: no cambia almacenamiento, contratos, base de datos ni reglas de privacidad. No requiere enmienda controlada.
**Decisiones del responsable.** (1) Mejorar la presentación de la fotografía existente; (2) mostrarla circular en «Mi cuenta» y en la navegación lateral y móvil, solo al titular; (3) mostrar las iniciales cuando no hay fotografía; (4) la fotografía sigue privada: no aparece en el perfil público del prestador; (5) adoptar la marca «WasiMaki» y el lema «Buenas manos para tu hogar» en lugar de «Plataforma Ayacucho»; (6) conservar la paleta petróleo y terracota.
**Implementado.** `src/compartido/Avatar.tsx` (avatar circular reutilizable e iniciales que conservan ñ, tildes y letras quechuas), `Marca.tsx` e `identidad-marca.ts` (nombre, lema y `LOGO_SRC`); `useFotoUrl` y `useCuentaSesion` (lectura privada de la fotografía y revocación de la URL); `Perfil.tsx` (avatar y nombre en «Mi cuenta», con el texto alternativo «Fotografía de mi cuenta» intacto); `BarraLateral.tsx` (marca, lema y avatar con nombre solo con sesión, en la barra superior móvil y en el panel); estilos en `barra-lateral.css`; título «WasiMaki · Buenas manos para tu hogar».
**Impacto en las pruebas.** El encabezado principal visible pasa de «Plataforma Ayacucho» a «WasiMaki»: se actualizaron la aserción en `test/e2e/fundacion.spec.ts`, en `test/e2e/prestadores-catalogo/entorno.spec.ts` y en `test/unit/prestadores-catalogo/selector-y-navegacion.test.tsx`. Se añadió `test/unit/marca-y-avatar.test.tsx` (18 pruebas).
**Verificación.** `tsc` y `eslint` sin errores; unitarias del frontend: 152 previas aprobadas (una, `navegacion-compuesta`, agotó el tiempo una vez bajo carga y pasó dos veces ejecutada sola) y 18 nuevas aprobadas. E2E de 002 (Node 24, base y recursos descartables, `tecnologia/.local/evidencia/002/marca-avatar-20261125-144614`): `entorno`, `perfil-y-portafolio`, `servicios`, `busqueda` y `categorias` en Chromium 360 y 1366 aprobadas, y `accesibilidad-responsive` **54 de 54** en los 9 proyectos. Regresión E2E de 001 (`marca-regresion-001`): las 8 suites de `usuarios-acceso` en Chromium 360 y 1366, 22 pruebas aprobadas, 0 fallidas y 0 omitidas; la validación 001 pasó de 1 695 a 1 721 cuentas ficticias, sin modificar ni eliminar datos existentes. No se ejecutó la matriz completa de 001 (Firefox, WebKit y 768 px).
**Pendiente.** Integrar el logo (archivo aún no entregado): pantallas públicas, acceso, registro, navegación autenticada, menú móvil y favicon, a través de `LOGO_SRC`. La fotografía de la cuenta en el perfil público del prestador queda fuera hasta una enmienda y autorización.

### Integración del logo de WasiMaki (2026-11-25, sin versionar)

**Recursos.** El logo original entregado se conserva sin cambios en `tecnologia/frontend/assets-fuente/marca/wasimaki-logo-original.png` (no se sirve). Derivados web en `tecnologia/frontend/public/marca/`: logo completo en WebP (480, 768 y 1200 px), emblema (96, 192 y 384 px) y favicon (`favicon.ico`, PNG de 32, 192 y 512 px y `apple-touch-icon.png`); procedencia en `assets-fuente/marca/LEEME.md`.
**Presentación.** Barra lateral (escritorio y tableta): emblema dentro de un círculo, sin recuadro blanco, con el nombre «WasiMaki» y el lema «Buenas manos para tu hogar» como texto, y debajo el avatar y el nombre de la persona con sesión. Celular: barra superior con el emblema circular, el nombre y el lema, y panel desplegable (se ajustó la altura de la barra para que el panel no tape el lema). Pantallas públicas de acceso y registro: logo completo como portada en todos los anchos. El logo es decorativo (`alt` vacío): el nombre accesible sigue siendo el texto. Favicon, color de tema y descripción en `index.html`. Sin cambios en contratos, base de datos ni privacidad de las fotografías.
**Defecto propio detectado y corregido.** La primera versión ocultaba el nombre y el lema en escritorio con un recorte (`overflow: hidden`) que la prueba de «texto recortado» detectó en 6 proyectos; se retiró esa técnica al volver el lema a ser texto visible.
**Verificación.** `tsc` y `eslint` sin errores; unitarias completas 18 archivos y 173 pruebas aprobadas (incluidas las 18 de avatar y marca y 3 de recursos y marca). E2E con el diseño final (Node 24, recursos desechables): prueba de teclado de Chromium 1366 repetida aislada, 2 aprobadas (el fallo anterior fue un tiempo agotado en una corrida de 42 minutos con la laptop cargada; no se reprodujo); `entorno` y `diseno-visual` en Chromium 360 y 1366 aprobadas; accesibilidad y diseño adaptable en 5 proyectos (Chromium 360, 768 y 1366, Firefox 1366 y WebKit 360) **30 de 30**; regresión de 001 (`perfil-validacion`, `perfil`, `registro`, `sesiones`) en Chromium 360 y 1366, 8 de 8. No se repitió la batería completa de 54 con el diseño final; el resultado de la penúltima versión fue 53 de 54 (el fallo era el tiempo agotado indicado). Las capturas están en `tecnologia/.local/evidencia/002/logo-circular-vistas/`.
**Servicios.** API y Vite de 002 restablecidos y conectados a `ayacucho_002_validacion`; inicio y cierre de sesión verificados con cuentas ficticias de prueba. Las 15 cuentas existentes siguen intactas, sin bloqueos; se añadieron 4 cuentas ficticias de prueba (`prueba-login-…`, dos `prueba-vista-…` y `prueba-final-…`, dominio `example.invalid`).
