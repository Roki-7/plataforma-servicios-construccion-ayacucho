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
| Gestionar categorías y verificaciones | — | — | — | ✓ |
| Restringir cuentas y atender incidencias | — | — | — | ✓ con registro de auditoría |

Una misma cuenta puede tener los perfiles de cliente y de prestador; los permisos se evalúan según el papel que cumple en cada operación.

## 3. Amenazas, controles y verificación

| Amenaza | Control | Verificación |
|---|---|---|
| Adivinar contraseñas | Bloqueo de 15 min tras 5 intentos fallidos; hash de contraseñas | Prueba de bloqueo (EQ-04) |
| Robo de sesión | Sesión de 15 min, renovación con cookie `httpOnly` y `Secure`, cierre de sesión que invalida la renovación | Prueba de sesión vencida |
| Acceder a datos de otro usuario | Permiso por participación en cada caso de uso | Matriz de accesos no autorizados (EQ-04) |
| Modificar una contratación ajena | Validación del actor y de su papel en la contratación | Pruebas de permisos por escenario |
| Repetir una petición para duplicar registros | Clave de idempotencia | Prueba de reintento (EQ-09) |
| Inyección de SQL o de datos | Validación de entrada y consultas parametrizadas | Pruebas de validación |
| Archivos maliciosos | Solo JPG, PNG, WEBP o PDF; máximo 10 MB; acceso solo mediante la API | Pruebas de carga de archivos |
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

---

[Índice del proyecto](../../README.md)
