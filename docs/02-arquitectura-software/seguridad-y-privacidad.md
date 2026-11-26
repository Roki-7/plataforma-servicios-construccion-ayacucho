# Seguridad y privacidad

Atiende AC04 (seguridad), DA03, DA11, RC09, RC14 y las decisiones ADR-006 y ADR-011.

## 1. Principios

1. **El servidor decide.** La interfaz puede ocultar botones, pero la API comprueba identidad, permiso y participación en cada operación.
2. **Mínimo privilegio.** Cada rol accede solo a lo que necesita.
3. **Participación.** Además del rol, se comprueba que el usuario sea parte de la solicitud o contratación que intenta ver o modificar.
4. **Datos mínimos.** Solo se pide y se envía a terceros la información necesaria.
5. **Secretos fuera del código.** Las credenciales viven en variables de entorno del servidor.

## 2. Matriz rol × operación

| Operación | Visitante | Cliente | Prestador | Administrador |
|---|---|---|---|---|
| Buscar servicios y ver perfiles públicos | ✓ | ✓ | ✓ | ✓ |
| Crear y editar una solicitud | — | ✓ propia | — | — |
| Ver solicitudes publicadas compatibles | — | — | ✓ | — |
| Ver una solicitud dirigida | — | ✓ propia | ✓ si va dirigida a él | — |
| Enviar o retirar una cotización | — | — | ✓ propia | — |
| Aceptar una cotización | — | ✓ de su solicitud | — | — |
| Confirmar o rechazar una selección | — | — | ✓ de su cotización | — |
| Registrar avances y finalización | — | — | ✓ participante | — |
| Dar conformidad y calificar | — | ✓ participante | — | — |
| Registrar un pago directo | — | ✓ participante | ✓ confirma | — |
| Gestionar categorías y subcategorías (RF39, 002) | — | — | — | ✓ solo con el permiso persistente vigente |
| Gestionar verificaciones (RF07 y RF41, 012) | — | — | — | ✓ (pendiente de la 012) |
| Publicar y editar servicios y portafolio propios (002) | — | — | ✓ titular con perfil habilitado | — |
| Restringir cuentas y atender incidencias | — | — | — | ✓ con registro de auditoría |

Una misma cuenta puede tener los perfiles de cliente y de prestador; los permisos se evalúan según el papel que cumple en cada operación. En la 002 no existe un rol «administrador» en la 001: la gestión de categorías la autoriza un **permiso específico y persistente de RF39** por identificador de cuenta, que Administración e incidencias verifica en cada operación.

## 3. Amenazas, controles y verificación

| Amenaza | Control | Verificación |
|---|---|---|
| Adivinar contraseñas | Bloqueo de 15 min tras 5 intentos fallidos; hash de contraseñas | Prueba de bloqueo (EQ-04) |
| Robo de sesión | Sesión de 15 min, renovación con cookie `httpOnly` y `Secure`, cierre de sesión que invalida la renovación | Prueba de sesión vencida |
| Acceder a datos de otro usuario | Permiso por participación en cada caso de uso | Matriz de accesos no autorizados (EQ-04) |
| Modificar una contratación ajena | Validación del actor y de su papel en la contratación | Pruebas de permisos por escenario |
| Repetir una petición para duplicar registros | Clave de idempotencia | Prueba de reintento (EQ-09) |
| Inyección de SQL o de datos | Validación de entrada y consultas parametrizadas | Pruebas de validación |
| Archivos maliciosos | Solo JPG, PNG, WEBP o PDF; máximo 10 MB; acceso solo mediante la API. En la 002: formato real comprobado, máximo 10 000 000 bytes y 4 096 px por lado, recodificación a WebP saneado sin metadatos y bucket privado | Pruebas de carga de archivos y matriz de seguridad de 002 (T079) |
| Operar categorías sin permiso, con permiso revocado o con una sesión ya abierta tras la revocación | Permiso persistente comprobado en la base en cada operación y bloqueado en cada mutación; concesión y revocación solo por un procedimiento interno; auditoría atómica con la mutación | Matriz PR04 de 002 (T079) y pruebas de RF39 |
| Fijar el nombre de una clasificación duplicado o confuso | Unicidad entre hermanas en PostgreSQL y en la aplicación (409) | Pruebas de INC-002-01 |
| Filtración de secretos | `.env` ignorado por Git y `.env.example` sin valores reales | Revisión del repositorio |
| Instrucciones maliciosas a la IA | La IA solo sugiere filtros; el servidor los valida antes de consultar | Pruebas del contrato de IA (EQ-05) |

## 4. Autenticación y sesiones

| Elemento | Decisión |
|---|---|
| Contraseña | Hash con un algoritmo de derivación lento (bcrypt o Argon2). Nunca se guarda ni se registra en texto plano. |
| Sesión | Token de acceso de 15 minutos; renovación hasta 7 días mediante una cookie `httpOnly`. |
| Recuperación | Enlace de un solo uso que vence en 30 minutos. |
| Cierre de sesión | Invalida la renovación en el servidor. |
| Acciones administrativas | Se registran con responsable, fecha, acción y motivo (RF45). |

## 5. Privacidad y protección de datos personales (Ley N.º 29733)

| Principio de la ley | Aplicación en la plataforma |
|---|---|
| Consentimiento | El usuario acepta la política de privacidad al registrarse; el contacto por WhatsApp o llamada usa solo datos que autorizó (RC13). |
| Finalidad | Los datos se usan solo para buscar, contratar y dar seguimiento a servicios. |
| Proporcionalidad | El perfil público no muestra correo, documento ni dirección exacta. |
| Seguridad | Permisos por participación, cifrado en tránsito (HTTPS) y copias de seguridad. |
| Derechos del titular | El usuario puede consultar y actualizar sus datos (RF05) y solicitar su eliminación, conservando lo que la ley exige guardar. |
| Terceros | Al proveedor de IA solo se envía la descripción de la necesidad, sin datos personales (ADR-008). |

## 6. Autorización y auditoría de RF39 (002)

| Aspecto | Decisión |
|---|---|
| Quién puede operar | Una cuenta con sesión de la 001 y el permiso `RF39_CATEGORIAS` en estado `VIGENTE`. Los perfiles de cliente y de prestador no lo traen por sí mismos. Si la sesión o el permiso no pueden comprobarse, la operación se rechaza. |
| Comprobación | En cada operación, contra PostgreSQL. Las mutaciones bloquean la fila del permiso y la revisan de nuevo antes de cualquier resultado idempotente o acción de negocio. Después de confirmada una revocación se rechaza toda operación nueva, aunque la sesión siga abierta. |
| Alta inicial | La designa el Product Owner sobre una cuenta existente. La persona designada acredita su identidad con su propia sesión y obtiene una **constancia** de vida corta; el Product Owner emite una **aprobación firmada** (Ed25519) que incluye acción, cuenta, motivo, entorno, vigencia y la constancia; un comando interno, ejecutado por una persona operativa distinta de quien firma, verifica la firma con una clave pública configurada fuera del repositorio y confirma permiso y auditoría en una sola transacción. No existe ruta HTTP para conceder o revocar. |
| Revocación | Por el mismo procedimiento y con aprobación firmada. |
| Auditoría | Cada concesión, revocación y modificación de una clasificación (alta, edición, activación y desactivación) registra **responsable, fecha UTC, acción, recurso afectado y motivo**, además del identificador de aprobación cuando corresponde. La tabla es inmutable (sin modificaciones, borrados ni truncado) y la auditoría se confirma en la misma transacción que el cambio: si falla, tampoco se confirma el cambio. |
| Desactivación | Antes de aplicarla se informa el recuento de servicios afectados y se exige una confirmación temporal vinculada al operador, la clasificación, su versión y la revisión de la oferta; vence a los cinco minutos y se consume en la misma transacción. |
| Escrituras de 002 | Exigen `Origin` con el origen HTTPS configurado e `Idempotency-Key`, y rechazan propiedades de identidad (`cuentaId`, `rol`, `activa`). Las respuestas llevan `Cache-Control: no-store`. |

## 7. Portafolio, imágenes y protección de datos (002)

- **Datos públicos por lista explícita.** Las consultas públicas proyectan solo campos permitidos: no exponen correo, documento, teléfono, dirección exacta ni datos privados de la cuenta. Un recurso ajeno o no visible responde 404, no 403.
- **Imágenes.** Se valida el formato real (JPG, PNG o WEBP), el tamaño y las dimensiones, se aplica la orientación, se recodifica a WebP y se omiten EXIF, GPS, XMP e IPTC. El bucket es privado, con credenciales y espacio lógico exclusivos de la 002; el enlace público pasa por el servidor, que comprueba en PostgreSQL que la foto siga asociada a un trabajo publicable. Una foto eliminada deja de servirse de inmediato y su objeto se purga después de forma idempotente.
- **Sanitización de textos.** Los textos se validan como texto plano, sin caracteres de control ni marcado ejecutable.
- **Registros.** Los logs guardan operación y resultado agregado; no incluyen filtros personales, cuerpos ni identificadores protegidos.
- **Privacidad del respaldo de la 002.** El manifiesto privado enlaza el volcado de PostgreSQL con el inventario de objetos del mismo corte; los artefactos del respaldo se cifran con una clave que vive fuera del repositorio y el directorio del respaldo debe estar fuera de él. Ninguna credencial aparece en procesos, argumentos, registros ni artefactos. La restauración se hace solo en destinos nuevos y mantiene cerrada la puerta de arranque hasta validar todo; después se asigna un espacio de claves de Redis nuevo. Los respaldos y sus claves contienen datos de la plataforma y se custodian como tales.
- **Redis.** Solo contiene datos públicos de lectura; permisos, sesiones y datos privados nunca se guardan en caché.

### Frontera con la funcionalidad 012

La 002 solo cubre RF39 y la auditoría de sus operaciones. Quedan para la 012: el flujo de verificación de prestadores (RF07 y RF41), el panel y los reportes administrativos, las restricciones de cuentas y el alcance completo de RF45. Mientras la fuente de verificaciones no exista, el perfil público muestra el aviso «Verificaciones aún no disponibles».

---

[Índice del proyecto](../../README.md)
