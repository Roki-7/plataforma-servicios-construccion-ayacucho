# Contratos — Usuarios y acceso

**Contrato normativo de diseño**: [openapi.json](openapi.json), OpenAPI 3.1.
**Trazabilidad**: [spec](../spec.md), [modelo](../data-model.md),
[pruebas](../test-matrix.md). No hay servidor ni cliente implementados.
Los endpoints amplían el inventario de Usuarios de la API global; no sustituyen
las rutas existentes ni añaden RF fuera de RF01–RF05.

## Convenciones y alcance

Base `/api/v1`, mismo origen HTTPS de la web; JSON en entradas y salidas, nombres
en español/camelCase y UTC ISO8601. Fechas de seguridad calculadas por servidor.
Errores: `codigo`, `mensaje`, `detalles`, sin stack, SQL, secretos o datos ajenos.
Todas las respuestas privadas, de credenciales y desafíos usan Cache-Control no-store.

Las fotos opcionales viajan como JSON con MIME y base64; así se conserva la regla
JSON, incluido el registro con foto. Máximo decodificado de 10000000 bytes,
cuerpo de transporte acotado a 14 MB y validación del contenido. Nunca guardar
base64/binario en las tablas. Solo JPG/PNG/WEBP para fotos, no PDF ni URL arbitraria.
GET de imagen propia devuelve JSON/base64 después de autorización; el frontend
crea una representación local. RF10 y la exposición pública quedan fuera.

Límites de texto de transporte están en el esquema; no hay requisitos de nombre
y apellido separados ni número de documento. Nombre admite persona o empresa.
Contraseña usa puntos de código Unicode: 15–128, confirmación exacta, sin trim,
normalización, corte, mezcla obligatoria ni prohibición de espacios o pegado.
Las contraseñas actuales de login y reautenticación también se limitan a 128 puntos
de código antes de Argon2; un exceso se rechaza, nunca se recorta. Los endpoints
sin foto tienen un límite de cuerpo de 64 KiB; los 14 MB de transporte solo se
permiten en registro con fotografía y carga de foto. Rechazar Unicode inválido
antes de convertirlo a UTF-8, sin reemplazos que hagan equivalentes dos entradas.
Los límites JSON Schema de caracteres y los validadores deben probarse con Unicode
suplementario; no imponer un límite UTF-16 distinto en el navegador.

## Inventario

| Método y ruta | Uso | RF |
|---|---|---|
| POST /cuentas | Registro con cliente, prestador o ambos, datos opcionales y privacidad | RF01 |
| POST /sesiones | Correo+contraseña; acceso opaco y cookie de renovación | RF02 |
| DELETE /sesiones/actual | Revocación inmediata de sesión actual y cookie | RF02 |
| POST /sesiones/renovacion | Rotación, sin reiniciar recencia ni límite absoluto | RF02 |
| GET /sesiones/csrf | Bootstrap de CSRF de renovación válida, sin mutación | RF02 |
| POST /sesiones/reautenticacion | Comprobar contraseña actual en misma sesión | RF02, RF04 |
| POST /recuperaciones | Respuesta genérica y correo si la cuenta existe | RF03 |
| POST /recuperaciones/{token} | Cambio por enlace de un uso y 30 minutos | RF03 |
| GET /perfil | Datos privados propios y versión | RF05 |
| PATCH /perfil | Nombre, teléfono, distrito, foto y autorización del teléfono | RF05 |
| POST /perfil/perfiles | Añadir perfil faltante con confirmación explícita | RF01, RF05 |
| POST /perfil/cambios-correo | Autorizar solicitud con recencia de hasta 300 segundos | RF05 |
| POST /perfil/cambios-correo/{token}/confirmacion | Verificar nuevo correo y efectuar cambio | RF05 |
| POST /perfil/cambios-contrasena | Contraseña actual y nueva confirmada | RF05 |
| POST /perfil/fotografias | Crear referencia propia de imagen para edición posterior | RF05 |
| GET /perfil/fotografias/{fotografiaId} | Recuperar solo imagen propia por API | RF05 |
| GET /salud | Preparación técnica PR02, sin datos privados | Soporte de 001 |

No exponer rutas de administración ni CRUD de usuarios por id ajeno. El usuario
objetivo procede siempre de la sesión. Campos extra como cuentaId, administrador,
correo en PATCH o identificador interno modificable se rechazan con 400.
Fotos ajenas reciben 404; el rol por sí solo no permite leerlas.

## Sesiones, cookies y CSRF

Bearer opaco de 256 bits en Authorization; digest y estado en PostgreSQL.
Expira a 900 segundos; solo memoria del frontend. No localStorage ni sessionStorage.
Cookie `__Secure-renovacion`: HttpOnly, Secure, SameSite=Lax,
Path=/api/v1/sesiones y sin Domain. Caduca a siete días absolutos desde login.

Login entrega acceso+marca con contraseña+CSRF; renovación entrega nuevos acceso,
cookie y CSRF sin cambiar esa marca. Una recarga obtiene CSRF por GET de bootstrap
con cookie válida y luego renueva. No usar un cookie Path limitado con prefijo
__Host-. Cliente coordina renovaciones en vuelo, incluidas pestañas; una renovación
consumida no admite reintentos ciegos que creen otra sesión.

Renovación exige cookie+X-CSRF-Token derivado por HMAC y origen exacto.
Logout identifica sesión por Bearer y origen; revoca en DB antes de responder.
Bootstrap exige contexto de mismo origen validado y no modifica vigencia.
Todas las mutaciones de navegador validan Origin; JSON no admite formularios simples.
Sin CORS comodín con credenciales. El refresh no es un nuevo inicio de sesión.

Estado y permisos se consultan en DB por operación. Si DB no está disponible,
no se autoriza mediante caché. Caída de Redis no afecta a estos controles.

## Concurrencia e idempotencia

Versión del agregado en PATCH, habilitación, cambio ordinario de contraseña y
solicitud/confirmación de correo. Un desafío de recuperación tiene su propia
versión (inicial 1, incluida en el enlace). Confirmación de correo incluye versión
actual del perfil y versión del desafío. Rotación/cierre/reautenticación usan
la credencial y versión interna de sesión como control del protocolo, sin editar
un perfil desde una versión obsoleta.

Idempotency-Key obligatorio en las mutaciones indicadas en OpenAPI:
registro, perfil, habilitación, cambios de credenciales, consumo de recuperación
y almacenamiento de foto. Login/renovación no guardan respuestas con tokens en
la tabla genérica: su protocolo de sesión no debe reintentarse ciegamente.

Ámbitos: cuenta autenticada; correo canónico para registro; digest de desafío
para recuperación. Claves aleatorias del cliente con al menos 128 bits. En 001
no caduca automáticamente un resultado confirmado: no se limita la garantía de
replay acordada. Comparar HMAC de método, ruta lógica y cuerpo canónico
completo, sin persistir contraseñas ni tokens en claro. Perfil protegido exige
sesión válida antes del replay; nunca usar idempotencia para saltar permisos.

**Decisión confirmada del usuario, 2026-11-16**:

| Petición | Resultado |
|---|---|
| Misma clave y mismos datos del mismo ámbito | Resultado HTTP anterior sin volver a ejecutar, crear sesión ni enviar otro aviso. |
| Misma clave con otros datos | 409 CLAVE_IDEMPOTENCIA_REUTILIZADA. |
| Clave distinta con enlace de recuperación usado | 422 RECUPERACION_NO_VALIDA. |
| Claves diferentes concurrentes para el mismo enlace | Como máximo una recuperación completada. |

El replay de recuperación consulta primero una coincidencia exacta ya confirmada,
incluido token y HMAC del cuerpo, antes de comprobar consumo, vencimiento o volver
a calcular Argon2/aplicar catálogo. No basta con conocer una clave. Aunque el
enlace ya venciera, un replay exacto devuelve el resultado anterior sin mutaciones;
con una clave diferente, el enlace consumido o vencido sigue rechazándose.
Esta regla interpreta CA-REC-04 conforme a constitución III sin excepción.
Resultado idempotente se confirma con las mismas escrituras de negocio.

## Recuperación y entrega de correos

1. POST /recuperaciones devuelve 202 con el texto exacto aprobado para existentes
   e inexistentes, sin id ni destino ni estado de cuenta.
2. Para existente: generar secreto, guardar digest+vencimiento y encolar correo
   a través de API mínima de Notificaciones. No cambiar contraseña ni sesiones.
3. El enlace abre `/recuperar#token=...&version=1`, sin recursos de terceros.
   El frontend lee fragmento en memoria y limpia la URL; un GET no consume.
4. POST contractual comprueba propósito, no uso y `ahora < emitida+1800 s`.
   Hash nuevo, invalidación de desafíos pendientes, revocación de todas las
   sesiones/renovaciones, aviso y resultado idempotente se confirman juntos.
5. Responder sin tokens y exigir nuevo login; aviso no incluye contraseña.

La ruta heredada contiene el token: proxy, aplicación, APM y trazas deben redactar
el segmento antes de registrar. Nunca registrar URL completa, body, cookies ni
cabeceras de credenciales. Referrer-Policy no-referrer y URL base de configuración
confiable, sin derivar enlaces del Host recibido.

El payload del Outbox que contiene el enlace va cifrado y se elimina al entregar
o vencer. Correo por SMTP: Mailpit en validación y SES configurable en producción.
El proceso pertenece al mismo despliegue, sin cola separada ni implementación RF35.
Reintentos no crean desafío nuevo. Falla del aviso posterior no deshace un reset.
El 202 genérico no garantiza entrega ni revela diferencias por fallo específico.

## Cambio de correo y contraseña

Al solicitar cambio de correo, comprobar servidor:
`0 <= ahora - ultima_autenticacion_con_contrasena <= 300 segundos`.
La marca pertenece a esa sesión y solo cambia en login o reautenticación correcta.
A los 300 se admite; pasado ese instante o sin marca:403 REAUTENTICACION_REQUERIDA.
Actividad, renovación y fechas enviadas por cliente no sirven como prueba.

La solicitud conserva el correo anterior y envía verificación al nuevo destino.
Confirmación exige sesión válida del mismo titular, desafío válido de ese propósito,
versiones y unicidad actual; no exige otra vez recencia de 300 segundos.
El desafío técnico de correo vence a 30 minutos; no se confunde con recuperación.
No reservar correo al solicitar ni aceptar la consulta previa como garantía.
Después, el nuevo correo identifica la misma cuenta y el anterior deja de hacerlo.

Cambio ordinario de contraseña requiere comprobar la actual y la política completa;
no acepta cambio mediante PATCH. No inferir revocación global de sesiones para
este flujo ni para correo: la regla global aprobada corresponde a recuperación.

## Errores y verificaciones mínimas

| HTTP | Códigos principales |
|---|---|
| 400 | DATOS_INVALIDOS, CABECERA_REQUERIDA, PROPIEDAD_NO_ADMITIDA |
| 401 | NO_AUTENTICADO, SESION_NO_VALIDA, CREDENCIALES_INVALIDAS |
| 403 | SIN_PERMISO, ORIGEN_NO_ADMITIDO, CSRF_NO_VALIDO, REAUTENTICACION_REQUERIDA |
| 404 | RECURSO_NO_DISPONIBLE |
| 409 | CORREO_EN_USO, VERSION_DESACTUALIZADA, CLAVE_IDEMPOTENCIA_REUTILIZADA |
| 413 | ARCHIVO_DEMASIADO_GRANDE |
| 422 | CONTRASENA_NO_ADMITIDA, CONTRASENA_ACTUAL_INVALIDA, RECUPERACION_NO_VALIDA, VERIFICACION_CORREO_NO_VALIDA |
| 429 | CUENTA_TEMPORALMENTE_BLOQUEADA, DEMASIADOS_INTENTOS |
| 503 | DEPENDENCIA_NO_DISPONIBLE |

Validar contrato automático, propiedades adicionales, autorización por propietario,
límites Unicode, constantes de mensajes, cookies, ausencia de secretos y reglas
de replay. No devolver distinto resultado de recuperación por existencia de correo.
No afirmar rendimiento o disponibilidad de producción a partir de este contrato.
