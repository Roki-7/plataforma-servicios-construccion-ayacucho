# Investigación técnica — 001 Usuarios y acceso

**Fecha**: 2026-11-16. **Entrada**: [spec.md](spec.md), RF01–RF05 y HU01–HU02.
**Estado**: decisiones de diseño resueltas; no hay implementación ni mediciones.
La constitución 1.0.1 y las decisiones de usuario Q1–Q4 permanecen vigentes.

## R01. Base existente y límites

**Decisión**: iniciar la aplicación en `tecnologia/backend` y
`tecnologia/frontend`; conservar el ejemplo de Contrataciones para 004.
El inventario encontró 21 archivos TypeScript vacíos en ese ejemplo, sin scripts
ni dependencias ejecutables; backend y frontend todavía no existen.
**Razón**: no hay aplicación que migrar ni pruebas funcionales ya disponibles.
**Alternativas**: convertir el ejemplo en backend confundiría el alcance de 001 con 004.
Fuentes: `tecnologia/README.md`, su README de ejemplo y ADR-001–ADR-003, ADR-013.

## R02. Líneas de versiones y compilación

**Decisión**: Node.js 24 LTS (al menos 24.15), NestJS 12 y TypeScript 6 en modo
estricto; React 19 y Vite 8; PostgreSQL 18 y TypeORM 0.3 estable.
Dependencias Nest del mismo major, módulos ESM y resolución NodeNext en backend;
frontend con resolución Bundler. Las versiones exactas de parche, imágenes por
digest y lockfiles se fijarán al implementar, comprobando peers y módulos nativos.
Jest 30 con transformación SWC y comprobación de tipos separada; Vitest compatible
con Vite, Playwright, Supertest y dependency-cruiser.
**Razón**: líneas existentes y compatibles con el runtime LTS elegido; no usar RC,
beta ni Node Alpha para resolver una dependencia. Nest 12 requiere ESM y su
herramienta de generación requiere Node 24.15+ y TypeScript 6.
**Alternativas**: Nest 11/TS5.9 son posibles pero no hay una aplicación que obligue
a retener esa base; no usar TypeORM 1 beta.
Fuentes: [Node](https://nodejs.org/en/about/previous-releases),
[Nest](https://docs.nestjs.com/migration-guide),
[React](https://react.dev/versions), [Vite](https://vite.dev/guide/),
[TypeORM releases](https://github.com/typeorm/typeorm/releases),
[Jest](https://jestjs.io/docs/code-transformation),
[SWC](https://swc.rs/docs/usage/jest).
Son decisiones de diseño; no se ha comprobado una instalación de paquetes.

## R03. Contraseñas completas: Argon2id y Unicode

**Decisión**: adaptador `HashContrasena` con node-argon2/Argon2id, formato PHC,
sal aleatoria de 16 bytes y salida de 32 bytes. Base de calibración:
64 MiB, tres pasadas y paralelismo cuatro; limitar concurrencia para no agotar
memoria. Calibrar antes de afirmar capacidad, sin rebajar la política aprobada.
Contraseñas de 15–128 puntos de código Unicode; validar la secuencia entera y
pasarla completa como UTF-8. No trim, normalización, cambio de mayúsculas, corte
en bytes ni truncado silencioso. Comparar confirmación sobre la misma secuencia.
No imponer mezcla de clases de caracteres; permitir espacios y pegado.
Login y comprobación de contraseña actual rechazan más de 128 puntos de código
antes de Argon2, sin recortar. Rechazar secuencias Unicode inválidas antes de
codificar para no sustituir silenciosamente entradas distintas por el mismo valor.
**Razón**: bcrypt directo suele limitar la entrada a 72 bytes; no satisface
128 caracteres, especialmente multibyte. Argon2 ya está permitido.
**Alternativas**: bcrypt con prehash agrega complejidad y riesgos evitables.
No usar `maxlength=128` de HTML como validador definitivo: cuenta UTF-16.
Fuentes: [RFC9106](https://www.rfc-editor.org/rfc/rfc9106.html),
[node-argon2](https://github.com/ranisalt/node-argon2),
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[NIST](https://pages.nist.gov/800-63-4/sp800-63b.html).

## R04. Contraseñas comunes y comprometidas

**Decisión**: puerto `CatalogoContrasenasRechazadas`, catálogo local versionado
de contraseñas comunes y hashes de Pwned Passwords, con manifiesto, fecha y checksum.
Consultar valores exactos completos; nunca enviar contraseña ni correo a terceros.
Una colección pequeña y determinista sirve solo para tests; no se presenta como
catálogo de producción. El despliegue debe proveer un snapshot completo aprobado
y recursos de disco adecuados antes de habilitar altas/cambios; si falta o está
corrupto, falla la comprobación de preparación y no se acepta una contraseña
sin el control. Autenticar una contraseña existente no requiere consultar el corpus.
**Razón**: evita depender de una llamada externa durante el cambio y conserva
los controles aprobados sin exponer secretos. SHA-1 del corpus solo identifica
entradas comprometidas; no sustituye Argon2id para almacenar credenciales.
**Alternativas**: consulta por rango k-anónimo añade disponibilidad y transferencia
de datos derivados; lista mínima sola no cubre comprometidas.
Fuente: [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords).
Actualización por operación de mantenimiento, fuera del flujo de usuario.

## R05. Sesiones opacas y PostgreSQL autoritativo

**Decisión**: Bearer de acceso opaco aleatorio, con digest SHA-256 y vencimiento
a 900 segundos; renovación independiente, aleatoria, rotada y con límite absoluto
de siete días desde el inicio. La sesión y los perfiles vigentes se consultan en
PostgreSQL en cada operación privada. El frontend conserva acceso solo en memoria.
La cookie de renovación es HttpOnly, Secure, SameSite=Lax, sin Domain y con Path
`/api/v1/sesiones`; usar nombre `__Secure-renovacion`, no `__Host-` con ese Path.
Cerrar sesión revoca acceso y renovación; recuperación completada revoca todas.
**Razón**: la API exige Bearer, no JWT. La consulta de estado permite revocación
inmediata y evita permisos obsoletos. No extender revocación global al cambio
ordinario de contraseña o correo sin una decisión de negocio.
**Alternativas**: JWT autónomo hasta exp viola el cierre inmediato; JWT con
consulta de sesión añade firma y claves sin eliminar la consulta necesaria.
Fuente: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
`estrategia-de-cache.md` prohíbe cachear permisos, sesiones y datos privados:
Redis queda disponible para la arquitectura futura, sin uso funcional artificial en 001.

## R06. Cookies, CSRF y exposición de secretos

**Decisión**: mismo origen público para web y API mediante proxy; orígenes exactos
permitidos, sin CORS comodín con credenciales. Renovación y bootstrap usan cookie.
El token CSRF se deriva con HMAC de la renovación y una clave servidor; se entrega
al iniciar/renovar o mediante GET de bootstrap y se exige en encabezado para usar
la cookie en una mutación. Validar origen en mutaciones de navegador.
Bootstrap no cambia estado; SameSite no sustituye CSRF. Login también valida origen
y JSON para evitar login CSRF. Rotar renovación cambia el token CSRF.
**Razón**: conserva renovación HttpOnly sin persistir Bearer en localStorage.
**Alternativas**: guardar credenciales en almacenamiento web o confiar solo en SameSite.
Fuente: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## R07. Desafíos y recuperación transaccional

**Decisión**: secretos de 32 bytes generados por CSPRNG, digest SHA-256 en tablas
de desafío y propósito separado. Recuperación válida solo si no usada/revocada
y tiempo actual menor que emisión+1800 segundos.
La transacción bloquea primero cuenta y luego desafío, comprueba versión de
credencial, cambia hash, consume/invalida recuperaciones, revoca sesiones y encola
aviso. Login/reautenticación calculan Argon2 fuera del bloqueo, pero vuelven
a comprobar versión de credencial bajo bloqueo antes de crear o actualizar sesión.
Renovación usa el mismo orden de bloqueo. Esto cierra carreras reset/login/refresh.
**Razón**: no basta probar dos consumos aislados; una contraseña validada antes del
reset no puede crear una sesión después. Ningún GET consume ni modifica.
**Alternativas**: estado solo en memoria o en Redis; cambiar hash y revocar en
transacciones separadas permite estados parciales.
Fuentes: [Node crypto](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback),
[PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html),
[OWASP recuperación](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## R08. Recencia y cambio de correo

**Decisión**: guardar `autenticada_con_contrasena_en` en cada sesión; solo login
o reautenticación correcta de esa sesión la actualizan. En la solicitud comprobar
en servidor `0 <= ahora - marca <= 300 segundos`. Actividad y renovación no la cambian.
El desafío de cambio de correo es independiente, ligado a cuenta y nuevo correo,
con registro de la sesión que autorizó la solicitud. No se le añade una invalidación
por versión de credencial no aprobada. La confirmación exige sesión vigente del
mismo titular y versiones actuales del perfil y del desafío bajo lock.
Caducidad técnica de verificación: 30 minutos.
Verificar nuevamente unicidad al confirmar. No exigir de nuevo recencia de
300 segundos en la confirmación: la decisión Q4 la fija al solicitar.
**Razón**: diferencia edad de la autenticación de edad del token.
**Alternativas**: renovar marca con cada petición o exigir recencia también al
confirmar cambiaría la decisión de usuario. Reutilizar tokens de recuperación
confundiría propósitos.
La caducidad técnica del desafío de correo no modifica la regla de 30 minutos
de recuperación ni el momento de comprobación de Q4.

## R09. Correo normalizado y concurrencia

**Decisión**: conservar correo para presentación y una clave canónica coherente
en PostgreSQL, equivalente a `lower(correo)`, con unicidad impuesta por índice
y el mismo cálculo para alta, login, recuperación y cambio. No quitar puntos
ni sufijos `+` de proveedores. Toda operación consulta la misma clave.
No reservar el nuevo correo antes de verificar; revalidar e imponer unicidad al
confirmar. Una carrera produce 409 y conserva el correo anterior.
**Razón**: consulta previa sola no evita dos registros simultáneos.
**Alternativas**: unicidad solo en cliente o normalización específica de Gmail.
Fuente: [índices de expresión PostgreSQL](https://www.postgresql.org/docs/18/indexes-expressional.html).

## R10. Correo de seguridad y propiedad del Outbox

**Decisión**: puerto de Usuarios hacia la API interna mínima de Notificaciones:
`ProgramarCorreoSeguridad`. Notificaciones conserva propiedad de
`avisos_pendientes`; sus repositorios participan en la misma unidad de trabajo
mediante adaptadores vinculados al mismo QueryRunner, sin tipos TypeORM en
Dominio/Aplicación. No implementar RF35, listado de avisos ni otras notificaciones.
Adaptador Nodemailer SMTP: Mailpit para desarrollo/pruebas y Amazon SES SMTP como
destino de producción configurable. Proveedor reemplazable, credenciales solo servidor.
SES requiere remitente verificado y preparación de la cuenta antes de uso real;
este plan no crea cuentas ni envía correos.
**Razón**: respeta ADR-009 y la propiedad de datos, sin escritura cruzada de Usuarios.
**Alternativas**: envío síncrono en transacción, tabla ajena manipulada directamente
o cola separada; outbox duplicado propio agrega otro proceso de envío.

El payload con enlaces va cifrado mediante AEAD y clave fuera de DB/repositorio;
el worker necesita el secreto para entregar el enlace, aunque la tabla del desafío
solo tenga digest. Eliminar payload sensible tras enviar o vencer. Timeout SMTP
de 8 segundos; reintentos acotados con backoff y sin superar vencimiento del enlace.
Un aviso de cambio ya confirmado no revierte credenciales por fallas de envío.
El envío puede duplicarse ante un fallo posterior a entrega; no prometer exactly-once.

Fuentes: [TypeORM transacciones](https://typeorm.io/docs/transactions/),
[Nodemailer SMTP](https://nodemailer.com/smtp),
[Mailpit](https://mailpit.axllent.org/docs/),
[SES SMTP](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html),
[SES preparación](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## R11. Fotografía y almacenamiento

**Decisión**: referencia y metadatos en PostgreSQL; archivo por adaptador compatible
S3. Garage de un nodo en entorno local, Amazon S3 en producción configurable.
Carga y lectura mediante backend con comprobación de propietario; no aceptar
URL arbitraria ni permitir cambiar una referencia ajena. Solo imágenes JPG/PNG/WEBP
para fotografía y máximo 10 MB, validando contenido, no solo extensión.
La lista global permite además PDF para documentos, no para foto.
Transportar foto como JSON con base64 y MIME (también opcional en registro),
para conservar la convención JSON. Límite técnico: 10000000 bytes decodificados;
validar antes de persistir objeto y referencia; no almacenar base64 en tablas.
**Razón**: RF05 incluye foto opcional; RF06 y documentos siguen fuera de alcance.
**Alternativas**: binario en tablas o URL externa sin control no respetan ADR-011.
Fuente: [Garage quickstart](https://garagehq.deuxfleurs.fr/documentation/quick-start/).
No se crean recursos externos en esta fase.

## R12. Tensión documental de idempotencia: decisión confirmada

**Fuentes**: constitución III exige devolver resultado previo para misma petición
y clave; CA-REC-04 rechaza enlace consumido.
**Decisión del usuario, 2026-11-16**: misma clave y mismos datos devuelven el resultado
anterior, sin repetir cambios; otra clave con el enlace usado se rechaza.
Es la interpretación acordada de CA-REC-04, no una excepción constitucional.
Registrar resultado no secreto en la misma transacción y consultar una coincidencia
de idempotencia antes de volver a consumir. Clave igual con otros datos: 409.
No aceptar solo una clave: debe coincidir el digest del token y HMAC de los datos
de la petición. El replay no emite sesiones ni vuelve a encolar el aviso.
**Alternativas**: rechazar también reenvío idéntico requeriría excepción constitucional.

## Coherencia y puertas resueltas

- Argon2id elige una opción existente; no modifica el stack ni requiere ADR nuevo.
- Estado de sesiones en PostgreSQL satisface a la vez cierre inmediato y prohibición
  de caché privada. La descripción antigua de invalidar renovación no prohíbe
  invalidar acceso; no es necesario reducir CA-SES-07.
- Modelo global es propuesto y no exhaustivo: las tablas de 001 lo detallan.
- Outbox mínimo de Notificaciones es soporte técnico, no entrega funcional de RF35.
- Ruta heredada `/recuperaciones/{token}` se conserva. Redactar el segmento en logs,
  sin APM, analítica o recursos de terceros en páginas de recuperación.
  Usar fragmento en enlace del navegador, Referrer-Policy no-referrer y URL base
  confiable; el cliente envía el POST contractual sin consumir mediante GET.
- Ninguna duda que bloquee el diseño queda pendiente tras la respuesta de idempotencia.
  Credenciales, dominios, bucket y snapshots son entradas de despliegue, no reglas
  de negocio sin resolver. No se crean servicios de aplicación en esta fase.
