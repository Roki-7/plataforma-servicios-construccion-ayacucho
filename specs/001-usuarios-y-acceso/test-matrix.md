# Matriz de validación — 53 escenarios de 001

**Estado**: CA-REG-01–11 de US1, CA-SES-01–09 de US2, CA-REC-01–10 de US3 y
CA-PER-01–06 de US5 implementados y verificados en sus niveles aplicables U/I/C/V/E;
los otros 17 CA siguen planificados. US3 conserva su evidencia histórica; la regresión
conjunta recuperación/perfil permanece pendiente en T110. Resultados y evidencia en
[implementation-status.md](implementation-status.md). Se conservan todos los
criterios y niveles normativos de las 53 filas.
Fuente: [spec.md](spec.md). Regla de replay confirmada: [research R12](research.md#r12-tensión-documental-de-idempotencia-decisión-confirmada).
El alcance sigue siendo RF01–RF05 y HU01–HU02; las variantes no crean nuevos CA.
Ninguna cifra de cobertura declarada prueba que las pruebas ya pasen.

## Niveles, archivos futuros y evidencia

U = Jest unitario con reloj y puertos; I = Jest con PostgreSQL real;
C = Jest/Supertest y OpenAPI; V = Vitest con Testing Library;
E = Playwright con backend real y correo local.

La columna «suite» identifica los archivos futuros:
`tecnologia/backend/test/unit/usuarios-acceso/<suite>.spec.ts`,
`tecnologia/backend/test/integration/usuarios-acceso/<suite>.spec.ts`,
`tecnologia/backend/test/contract/usuarios-acceso/<suite>.spec.ts`,
`tecnologia/frontend/test/unit/usuarios-acceso/<suite>.test.tsx` y
`tecnologia/frontend/test/e2e/usuarios-acceso/<suite>.spec.ts`, según niveles.
No se crean esos archivos en la planificación. Nombres de test incluyen CA exacto
y variante; evidencia futura JUnit/HTML con commit, entorno y datos.

Se debe declarar al menos una prueba ejecutable por cada fila. Los niveles
indicados distinguen regla pura, garantía DB, contrato y recorrido; no requieren
replicar la misma aserción superficial en cada nivel.

## Cobertura uno a uno

| CA | Origen | FR locales | Niveles | Suite | Datos, variantes y resultado verificable |
|---|---|---|---|---|---|
| CA-REG-01 | HU01 / RF01 | FR-001–003 | U/I/C/E | registro | Datos obligatorios válidos, tres selecciones de perfil y variantes con/sin opcionales; una cuenta y foto propia si se aporta. |
| CA-REG-02 | HU01 / RF01 | FR-003, FR-022 | U/C/V | registro | Omitir cada obligatorio, correo inválido y confirmación distinta: no crear cuenta ni devolver secretos. |
| CA-REG-03 | HU01 / RF01 | FR-001 | I/C | registro | Diez registros simultáneos del mismo correo con variantes de mayúsculas: un registro; resto conflicto controlado. |
| CA-REG-04 | HU01 / RF01 | FR-002 | U/I/E | registro | Seleccionar ambos al alta: dos perfiles, una cuenta y las mismas credenciales. |
| CA-REG-05 | HU01 / RF01 | FR-003 | U/C/V | registro | Privacidad ausente o falsa: rechazo sin cuenta; consentimiento válido conserva versión y fecha. |
| CA-REG-06 | HU01 / RF01 | FR-028 | U/I/E | registro | Añadir faltante con confirmación true: preservar identidad/datos; false o ausente no habilita. |
| CA-REG-07 | HU01 / RF01 | FR-014, FR-028–029 | I/C | registro | Repetición y concurrencia de habilitación: no duplicar; sin verificación ni administración; sin insertar RF06. |
| CA-REG-08 | HU01 / RF01 | FR-021 | C/E | registro | Sin teléfono/distrito/foto se permite; con opcionales válidos se conservan y no se exige información profesional. |
| CA-REG-09 | HU01 / RF01 | FR-022 | U/C/V | registro | 14/15/128/129 puntos de código: rechazo/aceptación/aceptación/rechazo. Repetir con Unicode suplementario. |
| CA-REG-10 | HU01 / RF01 | FR-022 | U/V/E | registro | Espacios y pegado preservados; contraseñas sin mezcla admitidas; dos valores distintos después del byte72 no equivalen. |
| CA-REG-11 | HU01 / RF01 | FR-022 | U/I/C | registro | Fixture común/comprometida rechazada; control no comprometido admitido; catálogo ausente no omite el control. |
| CA-SES-01 | HU01 / RF02 | FR-004, FR-012 | I/C/E | sesiones | Correo+contraseña correctos: acceso a datos propios y solo perfiles vigentes; cookie y Bearer previstos. |
| CA-SES-02 | HU01 / RF02 | FR-004 | U/I/C | sesiones | Contraseña incorrecta y correo inexistente no crean sesión ni exponen datos privados. |
| CA-SES-03 | HU01 / RF02 | FR-005 | I/C | sesiones | Fallar cuatro veces y quinto: bloqueo; ni contraseña correcta entra antes de 900 s; concurrentes no pierden incrementos. |
| CA-SES-04 | HU01 / RF02 | FR-005 | U/I/C | sesiones | Bloqueo a 899.999/900/900.001 s: impedir/permitir nuevo intento/permitir; intentos bloqueados no alargan el plazo. |
| CA-SES-05 | HU01 / RF02 | FR-006 | U/I/C | sesiones | Bearer a 899.999/900/900.001 s: vigente/vencido/vencido; sin renovación no permitir acceso privado. |
| CA-SES-06 | HU01 / RF02 | FR-006 | I/C/E | sesiones | Rotación y límite de 7 d: justo antes puede renovar; en el límite no; no mover fecha inicial ni marca con contraseña. |
| CA-SES-07 | HU01 / RF02 | FR-007 | I/C/E | sesiones | Cerrar y reutilizar Bearer/cookie antiguos: denegar inmediatamente; fallo de DB no produce un cierre confirmado parcial. |
| CA-SES-08 | HU01 / RF02 | FR-014 | U/I/C | sesiones | Ambos perfiles comparten identidad; cada operación evalúa papel y titularidad; sin administración. |
| CA-SES-09 | HU01 / RF02 | FR-004 | I/C/E | sesiones | Variar mayúsculas del correo en login: misma cuenta con contraseña completa correcta. |
| CA-REC-01 | HU01 / RF03 | FR-008, FR-030 | I/C/E | recuperacion | Correo existente/inexistente: mismo202 y mensaje exacto; solo existente recibe enlace; solicitud no modifica credenciales. |
| CA-REC-02 | HU01 / RF03 | FR-009–010, FR-022 | I/C/E | recuperacion | Token válido y contraseña confirmada: cambiar hash completo, consumir enlace; login nuevo sí/anterior no. |
| CA-REC-03 | HU01 / RF03 | FR-009, FR-011 | U/I/C | recuperacion | 1799.999/1800/1800.001 s: válido/vencido/vencido; usados no se aceptan por no estar vencidos. |
| CA-REC-04 | HU01 / RF03 | FR-011 | I/C | recuperacion | Enlace inválido/usado o solo correo: rechazar; misma clave+datos reproduce resultado previo sin repetir; clave nueva rechaza usado. |
| CA-REC-05 | HU01 / RF03 | FR-009–010 | I/C | recuperacion | Consumos concurrentes con claves diferentes: como máximo un cambio y un aviso lógico; mismo replay no vuelve a mutar. |
| CA-REC-06 | HU01 / RF03 | FR-008, FR-020 | I/C/E | recuperacion | Falla SMTP/DB antes del cambio: no otorgar acceso ni decir cambio exitoso; preservar mensaje público genérico de solicitud. |
| CA-REC-07 | HU01 / RF03 | FR-009, FR-018 | U/I/C | recuperacion | Token exclusivo de cuenta y propósito: no sirve para otro titular ni cambio de correo; revisar redacción de logs. |
| CA-REC-08 | HU01 / RF03 | FR-026 | I/C/E | recuperacion | Varias sesiones y enlaces: tras reset todos los Bearer/refresh/pendientes previos fallan; probar carreras reset/login y reset/refresh. |
| CA-REC-09 | HU01 / RF03 | FR-026–027 | I/C/E | recuperacion | Aviso en Mailpit, sin contraseña y sin autologin; falla/reintento posterior no revierte reset ni duplica efectos. |
| CA-REC-10 | HU01 / RF03 | FR-010, FR-022 | U/C/V | recuperacion | Contraseña inválida, común/comprometida o confirmación distinta: no cambiar credencial ni informar éxito. |
| CA-AUT-01 | HU01 / RF04 | FR-012 | I/C | permisos | Sin Bearer, vencido y revocado: no leer ni modificar perfil; comprobar datos antes/después. |
| CA-AUT-02 | HU01 / RF04 | FR-012, FR-015 | I/C/E | permisos | Controles positivos para cliente, prestador y ambos: titular puede leer/editar campos permitidos. |
| CA-AUT-03 | HU01 / RF04 | FR-013 | U/I/C | permisos | Dos cuentas: IDs manipulados, foto ajena y campos extra no permiten leer/cambiar otro perfil; inexistente/no visible404. |
| CA-AUT-04 | HU01 / RF04 | FR-013, FR-029 | U/C | permisos | Intentos de administrador en alta/perfil, flags o permisos extra: rechazo; no elevación. |
| CA-AUT-05 | HU01 / RF04 | FR-012, FR-014 | U/I/C | permisos | Rol correcto sin titularidad: rechazo; no basta ocultar botón ni disponer de ambos perfiles. |
| CA-AUT-06 | HU01 / RF04 | FR-017, FR-031 | U/C | permisos | Proyección compartible interna sin correo/documentos/dirección/credenciales; teléfono solo con consentimiento explícito. No crear RF10. |
| CA-AUT-07 | HU01 / RF04 | FR-029 | I/C | permisos | No editar UUID interno ni crear administrador mediante registro o edición; campos desconocidos rechazados. |
| CA-PER-01 | HU02 / RF05 | FR-015, FR-018 | I/C/E | perfil | Lectura propia devuelve campos permitidos, opcionales y perfiles; no hash, contraseña ni datos ajenos. |
| CA-PER-02 | HU02 / RF05 | FR-015 | I/C/V/E | perfil | Editar cada campo autorizado; nombre de persona/empresa; persistencia y campos no tocados intactos; foto en objeto. |
| CA-PER-03 | HU02 / RF05 | FR-016 | U/I/C/V | perfil | Campos inválidos/no autorizados: rechazo sin cambios parciales ni alteración de secretos. |
| CA-PER-04 | HU02 / RF05 | FR-017 | U/I/C | perfil | Modificar dato privado no cambia la proyección compartible ni publica correo/documentos/dirección. |
| CA-PER-05 | HU02 / RF05 | FR-016 | I/C/E | perfil | Dos ediciones con misma versión: una gana y la otra409; no sobrescribir silenciosamente. |
| CA-PER-06 | HU02 / RF05 | FR-031 | U/I/C/E | perfil | Registrar teléfono no autoriza; true explícito autoriza valor, false retira; cambiar número no hereda consentimiento del anterior. |
| CA-COR-01 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-023, FR-032 | I/C/E | correo | Solicitud con autenticación de hasta300 s: autorizada, correo anterior permanece hasta verificación y desafío se entrega al nuevo. |
| CA-COR-02 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-032 | U/I/C | correo | 299.999/300/300.001 s y sin marca: admitir/admitir/exigir contraseña/exigir contraseña; usar misma sesión. |
| CA-COR-03 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-032 | U/I/C | correo | Actividad/refresh no renuevan marca; fecha enviada por cliente no manda; reautenticación correcta sí actualiza su sesión. |
| CA-COR-04 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-001, FR-023 | I/C | correo | Correo inválido/duplicado case-insensitive; dos cuentas verifican destino igual: una cambia y la otra409 conservando anterior. |
| CA-COR-05 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-023 | I/C/E | correo | Sin verificar, token incorrecto/vencido o entrega fallida: correo anterior y recuperación continúan con destino anterior. |
| CA-COR-06 | HU02; apoyo HU01 / RF05; apoyo RF02/RF04 | FR-024 | I/C/E | correo | Confirmar con versión: mismo UUID/perfiles/credenciales/datos; login por nuevo sí/anterior no; no exigir recencia otra vez al confirmar. |
| CA-CLA-01 | HU02; apoyo HU01 / RF05; apoyo RF02–RF04 | FR-022, FR-025 | I/C/E | contrasena | Flujo específico con actual correcta y nueva válida+confirmación: nueva autentica, anterior no; política completa sin truncado. |
| CA-CLA-02 | HU02; apoyo HU01 / RF05; apoyo RF02–RF04 | FR-025 | U/I/C | contrasena | Actual incorrecta: rechazo sin modificar hash o versión; no acreditar reautenticación por fallo. |
| CA-CLA-03 | HU02; apoyo HU01 / RF05; apoyo RF02–RF04 | FR-022, FR-025 | U/C/V | contrasena | Nueva fuera de rango/común/comprometida o confirmación distinta: rechazo; credencial anterior sigue vigente. |
| CA-CLA-04 | HU02; apoyo HU01 / RF05; apoyo RF02–RF04 | FR-025 | C/V/E | contrasena | PATCH con contraseña no la cambia; exigir recorrido específico o recuperación; sin revocación global inferida. |

## Garantías transversales y pruebas adicionales

- **PR04 / EQ-04**: matriz completa con visitante, cliente, prestador, ambos y
  referencia administrativa preexistente mediante fixtures, sin construir
  consola/alta administrativa. Comparar respuestas y estado protegido;
  incluir controles positivos. El100% se refiere al conjunto evaluado.
- **PR13**: reloj controlado en 899.999/900/900.001 segundos del quinto fallo.
  Cinco peticiones concurrentes no pierden incrementos ni permiten saltar el bloqueo.
- **PR14**: recuperar en 1799.999/1800/1800.001 segundos; expiración se decide
  después de locks con reloj confiable, sin esperas reales de 30 min.
- **Q4**: recencia en 299.999/300/300.001 s, marca ausente o futura; reloj de servidor,
  misma sesión. Renovar incluso dentro de 15 min no rehabilita la ventana.
- **PR12**: dependency-cruiser comprueba dominio sin framework/ORM/otro módulo;
  aplicación sin infraestructura; infraestructura de Usuarios no importa
  repositorios privados de Notificaciones; frontend puro no importa React.
- **FR-019 / PR07 / EQ-07**: recorridos E en 360/768/1366 px; Chromium, Firefox y WebKit,
  registrando versiones. Usar contextos y base de datos aislados, no usuarios reales.
- **X-01 — Hashing completo**: Unicode de 128 puntos de código supera72 bytes;
  verificar una contraseña y rechazar otra con iguales primeros72 bytes. Comprobar
  PHC Argon2id y sal independiente, sin comparar hashes aleatorios por igualdad.
  Rechazar Unicode inválido antes de codificar y valores actuales mayores de
  128 puntos de código antes de calcular Argon2, sin truncarlos.
- **X-02 — Atomicidad**: inyectar fallo entre cambio de hash, revocación,
  registro del aviso y resultado idempotente. Todo anterior o todo nuevo,
  nunca nueva contraseña con sesiones previas válidas.
- **X-03 — Carreras**: barreras deterministas para reset/reset, reset/login,
  reset/refresh y reset/reautenticación. Contraseña verificada antes del reset
  no puede acreditar sesión después. Serializar operaciones con orden coherente.
- **X-04 — Reintentos**: misma clave+datos devuelve resultado; diferente cuerpo409;
  otra clave con enlace usado422; aun vencido el enlace, replay confirmado exacto
  devuelve el resultado previo sin reaplicar efectos ni recalcular política actual.
  Repetición posterior no restaura sesión, crea desafío ni reenvía aviso.
- **X-05 — Fallas externas**: caída de Redis no afecta autorización; DB caída
  no permite fallback permisivo. SMTP falla/reintenta sin rollback del cambio.
  Outbox no envía desafíos vencidos y limpia secretos cifrados al concluir.
- **X-06 — Navegador**: CSRF ausente/incorrecto, origen ajeno, cookies Secure/HttpOnly,
  ausencia de credenciales en almacenamiento web, historial, referer y logs.
  No consumir enlaces por GET ni cargar analítica en recuperación/verificación.
- **X-07 — Fotos**: contenido disfrazado, PDF, base64 inválido, >10000000 bytes,
  referencia ajena, fallo entre objeto y DB y limpieza de temporales.
  Verificar también foto opcional en registro, sin almacenar binario en tablas.
- **X-08 — Contrato**: todos los endpoints de OpenAPI, errores/códigos/constantes,
  additionalProperties=false, propiedades de contraseña completas, versión e
  Idempotency-Key obligatorios donde proceden; solo login/refresh/cierre cambian
  la cookie de renovación.
  En T113, las 17 operaciones declaran y prueban 413 CUERPO_DEMASIADO_GRANDE
  sobre el transporte ordinario de 65536 bytes (14000000 para registro con foto
  y carga), también si se envía cuerpo inesperado. En rutas sin requestBody,
  cuerpo no vacío dentro del límite produce 400 DATOS_INVALIDOS, sin admitirlo.
  Foto decodificada >10000000 bytes produce 413 ARCHIVO_DEMASIADO_GRANDE.
  Origin ausente en las 13 mutaciones produce 400 CABECERA_REQUERIDA,
  malformado 400 DATOS_INVALIDOS y origen ajeno 403 ORIGEN_NO_ADMITIDO.
  No exigir Origin en GET; conservar 401 para credenciales y 403 para CSRF.
  Añadir JSON/MIME/codificación, UUID/token malformados y propiedades extra
  con 400, recurso ajeno/no visible con 404, conflicto/replay con 409, política
  o desafío semánticamente rechazado con 422, y 429/503 donde correspondan.
  Probar límites exactos y exceso de un byte con controles válidos, una condición
  alterada por variante y enum de código correspondiente al HTTP; no modificar
  la cuenta protegida ni exponer secretos. Tabla normativa en contracts/README.md.

## Dependencias de validación corregidas

La proyección compartible usada por CA-PER-04/CA-PER-06 se implementa en T069
(US5) antes de ejecutar su cierre T076. CA-AUT-06 conserva sus pruebas U/C en
T077/T079 y la integración transversal T082 (US4), reutilizando esa implementación.
No hay dependencia de US5 sobre la finalización de US4.

La regresión conjunta recuperación/perfil se añade en T110, con dependencia
explícita de T062 (cierre US3) y T076 (cierre US5), en las suites futuras
`tecnologia/backend/test/integration/usuarios-acceso/recuperacion-perfil.spec.ts`
y `tecnologia/frontend/test/e2e/usuarios-acceso/recuperacion-perfil.spec.ts`.
Variantes: datos editados conservados tras reset, sesión revocada sin lectura/edición
y nueva autenticación habilitando al titular; reutilizar CA-REC-08, CA-PER-02 y
CA-AUT-01, sin sumar escenarios ni sustituir las suites originales de las 53 filas.

T001 entrega Dockerfile/.dockerignore, T023 verifica construcción/arranque Linux
tras T022 y preparación de DB/corpus, y T116 repite con las siete historias y
conserva digest/evidencia CI. Son comprobaciones técnicas de entrega, no nuevos CA.
La planificación conserva 119 tareas y 152 asociaciones CA/nivel de las filas
originales; las variantes transversales adicionales no cambian esos recuentos.

PR02 planifica salud cada minuto en demostración, sin acreditar disponibilidad
mensual por un test local. k6 caracteriza costo Argon2 y sesiones con datos ficticios,
sin trasladar el SLA de búsquedas EQ-01 ni inventar un volumen de usuarios para 001.
PR09–PR11 de contratación y PR15 de avisos de contratación quedan fuera de alcance.

## Cierre y registro

Se exige53/53 CA con evidencia automatizada y verde, además de los controles
transversales aplicables, lint/build y revisión contra constitución y spec.
Una fila planificada o un archivo presente no equivale a una prueba aprobada.
Guardar resultados reales en CI y enlazarlos desde la trazabilidad al implementar;
esta fase no cambia estados PRnn ni la matriz global para simular avance.
