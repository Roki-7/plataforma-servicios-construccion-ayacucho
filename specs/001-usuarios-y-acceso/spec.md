# Feature Specification: 001 — Usuarios y acceso

**Feature Branch**: No asignada; identificación de la funcionalidad: `001-usuarios-y-acceso`.

**Created**: 2026-11-16

**Status**: Draft — aclaraciones Q1–Q4 resueltas; lista para revisión y planificación.

**Input**: User description: "Especificar la funcionalidad 001: Usuarios y acceso.
Limitar el alcance a RF01–RF05 y sus historias relacionadas; incluir escenarios,
criterios verificables, permisos, excepciones y trazabilidad. Señalar dudas y
supuestos sin inventar decisiones de negocio. Generar únicamente la especificación."

Esta funcionalidad permite crear una cuenta, acceder a ella, recuperar su acceso
y mantener los datos autorizados del perfil. Desarrolla exclusivamente **HU01
(RF01–RF04)** y **HU02 (RF05)**. Se rige por la constitución **1.0.1**, ratificada
el **2026-11-16**. Los escenarios y criterios son compromisos por verificar,
no resultados de pruebas ejecutadas.

## User Scenarios & Testing *(mandatory)*

Las siete historias siguientes desglosan HU01 y HU02 sin crear nuevas HU del
catálogo. Todas conservan prioridad **Debe (MVP)**. Los datos, políticas y recorridos
se concretan con las respuestas Q1–Q4 del usuario, confirmadas el 2026-11-16.
Cada criterio describe un resultado por comprobar, sin afirmar que ya fue ejecutado.

### User Story 1 - Crear una cuenta y habilitar sus perfiles (Priority: P1)

Como cliente o prestador, quiero registrarme y habilitar los perfiles que necesito
para utilizar sus funciones con una sola cuenta. **Origen: HU01, RF01.**

**Why this priority**: La cuenta identifica al titular y sus perfiles sin duplicar
credenciales ni atribuirle permisos administrativos.

**Independent Test**: Registrar cuentas de prueba como cliente, prestador y ambos;
añadir después el perfil faltante y comprobar identidad, credenciales y datos,
sin publicaciones, solicitudes ni contrataciones.

**Acceptance Scenarios**:

1. **CA-REG-01 — Given** una persona o empresa sin cuenta, **When** proporciona
   nombre para mostrar, correo válido y único, contraseña válida con confirmación
   coincidente, elige cliente, prestador o ambos y acepta la política de privacidad,
   **Then** se crea una cuenta con esa selección y se confirma el registro.
2. **CA-REG-02 — Given** un registro sin un campo obligatorio, con correo inválido,
   sin selección de perfil o con confirmación de contraseña diferente,
   **When** se envía, **Then** no se crea la cuenta y se indican las correcciones
   sin mostrar contraseñas ni datos privados de otra cuenta.
3. **CA-REG-03 — Given** un correo ya registrado, **When** se reutiliza con cualquier
   combinación de mayúsculas y minúsculas, incluso en registros simultáneos,
   **Then** no se crea una segunda cuenta con ese correo.
4. **CA-REG-04 — Given** una persona que necesita ambos perfiles, **When** elige
   cliente y prestador al registrarse, **Then** obtiene ambos en la misma cuenta,
   con el mismo identificador interno, correo y credenciales.
5. **CA-REG-05 — Given** un registro sin aceptación de la política de privacidad,
   **When** se intenta completar, **Then** no se completa y se informa la aceptación
   pendiente.
6. **CA-REG-06 — Given** una cuenta autenticada con un solo perfil, **When** confirma
   explícitamente que desea añadir el perfil faltante desde su cuenta,
   **Then** se habilita sin crear otra cuenta ni cambiar credenciales o eliminar
   información. Sin esa confirmación no se añade el perfil.
7. **CA-REG-07 — Given** que una cuenta ya tiene ambos perfiles, **When** se intenta
   habilitar otra vez uno de ellos, **Then** no se duplica la cuenta ni el perfil
   ni se pierde información. Habilitar prestador no lo convierte en verificado
   ni concede administración.
8. **CA-REG-08 — Given** un registro válido sin teléfono, distrito ni fotografía,
   **When** se completa, **Then** se acepta sin exigir esos datos opcionales ni
   la información profesional de RF06.
9. **CA-REG-09 — Given** contraseñas no comunes ni comprometidas de 14, 15, 128 y
   129 caracteres, **When** se evalúan, **Then** las de 15 y 128 se admiten por
   longitud y las de 14 y 129 se rechazan, sin truncarlas para aceptarlas.
10. **CA-REG-10 — Given** una contraseña dentro del rango permitido que no sea común
    ni comprometida, **When** contiene espacios, se pega desde un gestor o no reúne
    mayúsculas, números y símbolos a la vez, **Then** esas condiciones por sí solas
    no la invalidan; la confirmación debe coincidir con el valor introducido.
11. **CA-REG-11 — Given** una contraseña común o conocida como comprometida,
    **When** se intenta establecer aunque cumpla la longitud,
    **Then** se rechaza y se solicita otra.

### User Story 2 - Iniciar, mantener y cerrar la sesión (Priority: P1)

Como cliente o prestador, quiero iniciar y cerrar sesión para acceder a mi cuenta
y terminar su uso de forma segura. **Origen: HU01, RF02.**

**Why this priority**: El acceso legítimo y la protección frente a intentos repetidos
son necesarios para utilizar cualquier función privada.

**Independent Test**: Usar cuentas de prueba existentes, variar las credenciales
y el tiempo, y comprobar el acceso a los datos propios antes y después del cierre.

**Acceptance Scenarios**:

1. **CA-SES-01 — Given** una cuenta con correo y contraseña válidos y sin bloqueo,
   **When** inicia sesión con esas credenciales, **Then** consulta sus datos y dispone
   únicamente de los permisos correspondientes a sus perfiles.
2. **CA-SES-02 — Given** credenciales incorrectas, **When** se intenta iniciar sesión,
   **Then** no se concede acceso ni se muestran datos privados. Un intento rechazado
   no inicia una sesión.
3. **CA-SES-03 — Given** cuatro intentos fallidos consecutivos de una cuenta,
   **When** falla el quinto, **Then** se aplica una espera de 15 minutos.
   Durante esa espera tampoco se permite entrar con credenciales correctas.
4. **CA-SES-04 — Given** una cuenta bloqueada y el instante del quinto fallo,
   **When** han transcurrido menos de 15 minutos, **Then** se mantiene la espera;
   al cumplirse los 15 minutos puede intentarse de nuevo y las credenciales válidas
   permiten acceder si no existe otra restricción aplicable.
5. **CA-SES-05 — Given** un acceso emitido para una sesión, **When** cumple
   15 minutos sin haberse renovado válidamente, **Then** deja de autorizar
   operaciones privadas.
6. **CA-SES-06 — Given** una sesión con renovación válida y no cerrada,
   **When** se renueva dentro del plazo máximo de 7 días, **Then** puede continuarse
   el acceso; al agotarse ese plazo se exige una nueva autenticación.
   La renovación no permite exceder el máximo documentado.
7. **CA-SES-07 — Given** una sesión abierta, **When** el usuario la cierra,
   **Then** no puede volver a usar esa sesión ni su renovación para operar en
   privado; la siguiente operación privada exige autenticarse nuevamente.
   La comprobación incluye intentar reutilizar el acceso anterior al cierre.
8. **CA-SES-08 — Given** una cuenta con ambos perfiles, **When** inicia sesión,
   **Then** conserva una sola identidad y cada operación evalúa el papel que
   cumple en ella; disponer de ambos perfiles no concede administración.
9. **CA-SES-09 — Given** un correo registrado, **When** se inicia sesión con la misma
   dirección variando sus mayúsculas y minúsculas y la contraseña correcta,
   **Then** se accede a la misma cuenta, sujeto al bloqueo y vigencia aplicables.

### User Story 3 - Recuperar el acceso a la cuenta (Priority: P1)

Como cliente o prestador, quiero demostrar acceso al correo registrado y recuperar
mi cuenta si olvido la contraseña. **Origen: HU01, RF03.**

**Why this priority**: Recupera el acceso sin conceder control a quien solo conoce
el correo y permite invalidar accesos anteriores tras completar la recuperación.

**Independent Test**: Solicitar recuperaciones de cuentas ficticias, comprobar el
mensaje y el enlace recibido en su correo y probar cambio, vencimiento, reutilización,
sesiones previas y aviso del cambio. No requiere avisos de contratación.

**Acceptance Scenarios**:

1. **CA-REC-01 — Given** un correo existente o inexistente, **When** se solicita
   recuperar el acceso, **Then** se muestra en ambos casos exactamente:
   “Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar
   el acceso”. Para una cuenta existente se envía el enlace a su correo registrado.
   La solicitud por sí sola no cambia la contraseña ni concede acceso.
2. **CA-REC-02 — Given** un enlace no utilizado con menos de 30 minutos de antigüedad,
   **When** se presenta su token válido y se establece y confirma una contraseña
   que cumple la política, **Then** se guarda el cambio y el enlace queda consumido.
   La nueva contraseña permite iniciar sesión y la anterior deja de permitirlo.
3. **CA-REC-03 — Given** un enlace que cumple o supera 30 minutos desde su emisión,
   **When** se intenta utilizar, **Then** no permite cambiar la contraseña y se
   indica que debe solicitarse uno nuevo.
4. **CA-REC-04 — Given** un enlace utilizado, inválido o sin token válido,
   **When** se intenta cambiar la contraseña, **Then** se rechaza sin cambiarla
   y se exige solicitar un enlace nuevo. Conocer solo el correo no verifica al titular.
5. **CA-REC-05 — Given** un enlace válido, **When** dos intentos procuran consumirlo
   simultáneamente, **Then** como máximo uno completa el cambio y los posteriores
   no pueden reutilizarlo.
6. **CA-REC-06 — Given** que no puede entregarse el enlace o completarse la
   verificación, **When** ocurre la falla, **Then** no se cambia la contraseña
   ni se concede acceso ni se informa un cambio exitoso. El mensaje público
   de solicitud conserva el texto genérico y no revela la existencia de la cuenta.
7. **CA-REC-07 — Given** un enlace emitido para una cuenta y para recuperación,
   **When** se pretende usar para otra cuenta u otro propósito, **Then** se rechaza.
   Los enlaces emplean tokens impredecibles y de uso exclusivo para recuperación.
8. **CA-REC-08 — Given** varias sesiones abiertas y enlaces de recuperación
   pendientes de una cuenta, **When** se completa un cambio mediante recuperación,
   **Then** se invalidan todas esas sesiones, sus renovaciones y los enlaces
   pendientes. Se exige iniciar sesión nuevamente; ninguno permite conservar
   o recuperar acceso por sí mismo.
9. **CA-REC-09 — Given** una recuperación completada, **When** se confirma el cambio,
   **Then** se envía un aviso al correo registrado y no se inicia sesión automáticamente.
   El aviso no incluye contraseñas y no permite recuperar sesiones invalidadas.
10. **CA-REC-10 — Given** un token vigente y no usado, **When** se introduce una
    contraseña fuera de la política o una confirmación distinta,
    **Then** no se cambia la contraseña ni se informa recuperación completada.

### User Story 4 - Acceder únicamente a lo autorizado (Priority: P1)

Como cliente o prestador, quiero que se comprueben mis permisos y mi relación con
la información para que mi cuenta y mis datos no sean accesibles por terceros.
**Origen: HU01, RF04.**

**Why this priority**: Protege las cuentas y constituye una condición obligatoria
para todos los recorridos privados.

**Independent Test**: Usar dos titulares distintos, cuentas con uno y ambos perfiles,
una identidad administrativa de referencia y solicitudes sin sesión. La prueba
solo ejercita controles de acceso y datos de 001; no construye otros módulos.

**Acceptance Scenarios**:

1. **CA-AUT-01 — Given** una persona sin sesión válida, **When** solicita consultar
   o cambiar datos privados de un perfil, **Then** se rechaza el acceso sin
   devolverlos ni modificarlos.
2. **CA-AUT-02 — Given** un cliente o prestador autenticado, **When** consulta o
   modifica los datos autorizados de su propia cuenta, **Then** la operación
   está permitida dentro de RF05.
3. **CA-AUT-03 — Given** una cuenta autenticada, **When** intenta consultar datos
   privados o modificar el perfil de otra cuenta, incluso indicando directamente
   su identidad, **Then** se rechaza el acceso sin exposición ni cambios.
4. **CA-AUT-04 — Given** un cliente, prestador o titular de ambos perfiles sin
   autorización administrativa, **When** intenta actuar como administrador o
   atribuirse ese permiso mediante un cambio de perfil, **Then** no obtiene
   la autorización ni altera permisos.
5. **CA-AUT-05 — Given** una comprobación de permisos sobre una operación protegida,
   **When** la identidad cumple el rol pero no la participación exigida,
   **Then** el rol por sí solo no permite realizarla. En 001 se verifica mediante
   la titularidad del perfil; los casos de otros módulos se completarán allí.
6. **CA-AUT-06 — Given** datos destinados a una presentación pública del perfil,
   **When** se obtiene esa información, **Then** no contiene correo, documento,
   dirección exacta ni credenciales; el teléfono solo se comparte con autorización
   explícita del titular. Se verifica la separación de datos sin incorporar RF10.
7. **CA-AUT-07 — Given** una cuenta autenticada, **When** intenta modificar su
   identificador interno o concederse administración mediante registro o edición,
   **Then** la operación no lo permite; el registro público nunca crea administradores.

### User Story 5 - Consultar y actualizar el perfil propio (Priority: P1)

Como cliente o prestador, quiero consultar y actualizar mi perfil para mantener
mis datos y medios de contacto al día. **Origen: HU02, RF05.**

**Why this priority**: Permite mantener datos propios sin exponer los privados
ni incorporar todavía el perfil profesional de RF06.

**Independent Test**: Consultar y modificar nombre para mostrar, teléfono, distrito
y fotografía en una cuenta de prueba, comprobando titularidad y persistencia.

**Acceptance Scenarios**:

1. **CA-PER-01 — Given** una cuenta autenticada, **When** consulta su perfil propio,
   **Then** obtiene su nombre para mostrar, correo, datos opcionales registrados
   y perfiles habilitados, sin contraseñas ni datos privados de otra cuenta.
2. **CA-PER-02 — Given** cambios válidos del nombre para mostrar, teléfono, distrito
   o fotografía, **When** su titular guarda y consulta de nuevo,
   **Then** obtiene los valores actualizados y los demás datos mantienen su valor.
   El nombre para mostrar admite tanto personas como empresas.
3. **CA-PER-03 — Given** cambios inválidos o en campos no autorizados,
   **When** se intenta guardar, **Then** se rechaza el cambio, se explican las
   correcciones y se conserva el perfil anterior.
4. **CA-PER-04 — Given** un cambio de datos privados autorizado,
   **When** se guarda, **Then** no se convierte el correo, los documentos o la
   dirección exacta en información pública.
5. **CA-PER-05 — Given** que el perfil cambió después de consultarse,
   **When** se intenta guardar una modificación basada en la versión anterior,
   **Then** se informa el conflicto sin sobrescribir el cambio ya guardado.
6. **CA-PER-06 — Given** un teléfono registrado, **When** no existe autorización
   explícita del titular para compartirlo, **Then** no se comparte. Registrar
   el teléfono no equivale a autorizar su divulgación.
7. **CA-PER-07 — Given** una edición del perfil con un teléfono que contiene letras
   o símbolos distintos de dígitos, espacios, `+`, `-`, `.` y paréntesis, o con menos
   de 6 o más de 15 dígitos, o con más de 32 caracteres, **When** se intenta guardar,
   **Then** se rechaza con un mensaje junto al campo que indica la regla, no se guarda
   nada y se conserva el perfil anterior. Un teléfono válido no depende de un formato
   nacional (admite, por ejemplo, `+51 984 123 456` y `(01) 234-5678`).
8. **CA-PER-08 — Given** un teléfono o un distrito vacío o con solo espacios,
   **When** se guarda el perfil o se registra la cuenta, **Then** el valor se
   normaliza a null en PostgreSQL y los dos campos siguen siendo opcionales.
9. **CA-PER-09 — Given** un nombre para mostrar, un teléfono o un distrito con
   caracteres de control (NUL, saltos de línea, tabuladores u otros de la categoría
   Unicode Cc), **When** se intenta guardar o registrar, **Then** se rechaza con
   400 `DATOS_INVALIDOS` y el motivo del campo, sin guardar nada. Los nombres de
   personas y empresas con tildes, ñ y signos habituales (`.`, `,`, `&`, `-`, `'`)
   se siguen admitiendo.
10. **CA-PER-10 — Given** un distrito de cuenta, **When** se guarda, **Then** es
    texto libre de hasta 100 caracteres sin caracteres de control; no se compara con
    una lista cerrada de distritos.

### User Story 6 - Cambiar el correo de acceso (Priority: P1)

Como titular, quiero cambiar mi correo tras autenticarme recientemente y verificar
el nuevo para mantener el control de mi identidad de acceso.
**Origen: HU02, RF05; controles de HU01, RF02 y RF04.**

**Why this priority**: El correo es a la vez identificador de acceso y canal de
recuperación; cambiarlo exige comprobar titularidad y acceso al nuevo destino.

**Independent Test**: Con una cuenta ficticia, controlar el tiempo desde la última
autenticación con contraseña, solicitar un cambio y verificar o no el nuevo correo.
No necesita escoger el proveedor de correo.

**Acceptance Scenarios**:

1. **CA-COR-01 — Given** una cuenta autenticada cuyo último inicio o reautenticación
   con contraseña ocurrió hace como máximo 300 segundos en la misma sesión,
   **When** solicita cambiar a un correo válido y único,
   **Then** se autoriza la solicitud, pero el correo anterior sigue vigente hasta
   que se verifique el nuevo; solo después se efectúa el cambio.
2. **CA-COR-02 — Given** autenticaciones de exactamente 300 segundos, de más de
   300 segundos y una sesión sin registro de autenticación con contraseña,
   **When** se solicita cambiar el correo, **Then** la primera satisface la
   condición temporal; las otras dos requieren introducir la contraseña actual
   antes de autorizar la solicitud.
3. **CA-COR-03 — Given** una sesión que supera 300 segundos desde su última
   autenticación con contraseña, **When** hay actividad o renovación automática
   del acceso, **Then** esos eventos no reinician el plazo. La condición se
   comprueba en el servidor, aunque la pantalla afirme que la sesión es reciente.
4. **CA-COR-04 — Given** un nuevo correo inválido o ya utilizado por otra cuenta,
   incluso cambiando mayúsculas y minúsculas, **When** se solicita o intenta
   completar el cambio, **Then** se rechaza y el correo actual permanece.
5. **CA-COR-05 — Given** una solicitud autorizada, **When** no se completa la
   verificación del nuevo correo o esta falla, **Then** no se cambia el correo
   de acceso ni el destino registrado para recuperar la cuenta.
6. **CA-COR-06 — Given** una solicitud autorizada y el nuevo correo verificado,
   **When** se efectúa el cambio, **Then** se mantiene el identificador interno,
   perfiles y demás información; el nuevo correo permite iniciar sesión con la
   contraseña vigente y el correo anterior ya no identifica esa cuenta.

### User Story 7 - Cambiar la contraseña desde la cuenta (Priority: P1)

Como titular autenticado, quiero cambiar mi contraseña mediante una comprobación
de la actual para proteger mi acceso. Si no la recuerdo, utilizo recuperación.
**Origen: HU02, RF05; controles de HU01, RF02–RF04.**

**Why this priority**: Evita que una edición ordinaria del perfil cambie credenciales
sin verificar el conocimiento de la contraseña actual.

**Independent Test**: Con una cuenta ficticia, utilizar el flujo específico con
contraseña actual correcta e incorrecta y comprobar qué credencial inicia sesión.

**Acceptance Scenarios**:

1. **CA-CLA-01 — Given** una cuenta autenticada, **When** el titular acredita su
   contraseña actual en el flujo específico y establece una nueva válida con
   confirmación coincidente, **Then** el cambio se guarda; la nueva permite
   iniciar sesión y la anterior deja de permitirlo.
2. **CA-CLA-02 — Given** una contraseña actual incorrecta, **When** se intenta
   cambiarla, **Then** se rechaza el cambio sin modificar las credenciales.
3. **CA-CLA-03 — Given** la contraseña actual correcta, **When** la nueva no cumple
   la política o su confirmación difiere, **Then** se rechaza y sigue vigente
   la contraseña anterior.
4. **CA-CLA-04 — Given** una edición ordinaria del perfil, **When** se intenta
   cambiar directamente la contraseña, **Then** se exige el flujo específico con
   comprobación de la actual o el recorrido de recuperación de RF03.

### Edge Cases

| Caso | Resultado exigido |
|---|---|
| Correo duplicado con distinto uso de mayúsculas o registro simultáneo | No duplicar la cuenta; CA-REG-03. La misma equivalencia se aplica al acceso y al cambio de correo. |
| Falta de consentimiento, perfil o confirmación de contraseña | No completar el registro; CA-REG-02 y CA-REG-05. |
| Teléfono, distrito o fotografía ausentes | No impedir el registro; CA-REG-08. |
| Teléfono con letras o símbolos, con menos de 6 o más de 15 dígitos o de más de 32 caracteres | Rechazarlo con el motivo del campo; CA-PER-07. |
| Teléfono o distrito vacío o con solo espacios | Normalizar a null; CA-PER-08. |
| Nombre, teléfono o distrito con NUL, saltos de línea, tabuladores u otros caracteres de control | Rechazarlos con 400 y el motivo del campo; CA-PER-09. |
| Contraseñas de 14, 15, 128 y 129 caracteres | Aplicar los límites inclusivos de 15 a 128; CA-REG-09. |
| Espacios, pegado y ausencia de combinaciones de tipos de caracteres | No rechazarlos por esos motivos; CA-REG-10. |
| Contraseña común o comprometida | Rechazarla aunque cumpla la longitud; CA-REG-11. |
| Adición de perfil sin confirmar o perfil ya habilitado | No añadir sin confirmar ni duplicar identidades, perfiles o datos; CA-REG-06–07. |
| Quinto fallo y límite de la espera | Bloquear 15 minutos desde el quinto fallo; CA-SES-03–04. |
| Sesión vencida, cerrada o invalidada tras recuperación | No autorizar su reutilización o renovación; CA-SES-05–07 y CA-REC-08. |
| Correo inexistente al pedir recuperación | Mismo mensaje genérico que para uno existente; no crear cuenta ni cambiar credenciales; CA-REC-01. |
| Enlace que cumple 30 minutos, utilizado o inválido | Rechazar y solicitar uno nuevo; CA-REC-03–04. |
| Consumo simultáneo del mismo enlace | Como máximo un cambio completado; CA-REC-05. |
| Varios enlaces o sesiones al completar recuperación | Invalidarlos todos y exigir nuevo inicio; CA-REC-08. No se añade una regla de invalidación anticipada por la mera solicitud de otro enlace. |
| Contraseña de recuperación inválida o confirmación distinta | No completar el cambio; CA-REC-10. |
| Autenticación para cambio de correo de 300 segundos, mayor o sin registro | Aceptar el límite exacto; en los otros casos volver a pedir la contraseña; CA-COR-02. |
| Actividad o renovación automática tras la autenticación | No reiniciar el plazo de autenticación reciente; CA-COR-03. |
| Nuevo correo sin verificar o ya utilizado | Mantener el correo vigente; CA-COR-04–05. |
| Intento de elevar privilegios o cambiar el identificador interno | Rechazar sin alterar identidad ni autorización; CA-AUT-04 y CA-AUT-07. |
| Teléfono registrado sin autorización para compartirlo | No compartirlo; CA-PER-06. |
| Cambio de contraseña por edición ordinaria o sin acreditar la actual | Exigir el flujo específico o recuperación; CA-CLA-02 y CA-CLA-04. |
| Guardado rechazado o desactualizado | Mantener los datos previos o informar conflicto, sin atribuir éxito; CA-PER-03 y CA-PER-05. |
| Falla de entrega de correos de seguridad | No conceder acceso ni afirmar un cambio no completado. Un fallo del aviso posterior no restaura credenciales, enlaces o sesiones ya invalidados; el tratamiento técnico del envío respeta la constitución. |

## Requirements *(mandatory)*

### Functional Requirements

Los identificadores **FR-001–FR-032** son locales y desglosan **RF01–RF05**;
no amplían ni renumeran el catálogo del proyecto. Los datos y reglas de Q1–Q4
son decisiones confirmadas del usuario, no supuestos.

- **FR-001 (RF01)**: El sistema DEBE crear cuentas con datos obligatorios válidos
  y correo único, sin distinguir mayúsculas y minúsculas, incluso ante registros
  simultáneos.
- **FR-002 (RF01)**: El registro DEBE permitir elegir cliente, prestador o ambos;
  los perfiles DEBEN pertenecer a una misma cuenta con las mismas credenciales.
- **FR-003 (RF01)**: El registro DEBE exigir nombre para mostrar válido para persona
  o empresa, correo, contraseña, confirmación coincidente, selección de perfil
  y aceptación de la política de privacidad.
- **FR-004 (RF02)**: El acceso DEBE usar correo y contraseña; el correo NO DEBE
  distinguir mayúsculas y minúsculas. Credenciales válidas sin bloqueo permiten
  entrar y credenciales inválidas NO DEBEN conceder acceso.
- **FR-005 (RF02)**: El quinto intento fallido consecutivo DEBE activar un bloqueo
  de 15 minutos; antes de su vencimiento NO DEBE concederse un nuevo acceso.
- **FR-006 (RF02)**: El acceso DEBE vencer a los 15 minutos y la renovación NO DEBE
  extenderse más allá del máximo de 7 días documentado.
- **FR-007 (RF02)**: Cerrar sesión DEBE impedir reutilizar esa sesión y su renovación;
  las operaciones privadas posteriores requieren nueva autenticación.
- **FR-008 (RF03)**: El usuario DEBE solicitar recuperación indicando su correo.
  El enlace DEBE entregarse al correo registrado de la cuenta existente. Presentar
  su token válido demuestra acceso al correo; conocer solo la dirección no basta.
- **FR-009 (RF03)**: El enlace DEBE contener un token impredecible, vinculado a la
  cuenta y exclusivo para recuperación de contraseña, de un uso y con vencimiento
  a los 30 minutos.
- **FR-010 (RF03)**: El enlace válido DEBE permitir establecer y confirmar una nueva
  contraseña conforme a la política. Tras el éxito, la anterior deja de permitir
  iniciar sesión y el enlace no puede reutilizarse.
- **FR-011 (RF03)**: Los enlaces vencidos, usados o inválidos DEBEN rechazarse
  sin cambiar credenciales; el usuario DEBE solicitar uno nuevo.
- **FR-012 (RF04)**: Cada operación privada DEBE verificar identidad, permiso
  y participación o titularidad, aunque se acceda fuera del recorrido visual.
- **FR-013 (RF04)**: El usuario NO DEBE consultar datos privados ni modificar
  perfiles ajenos ni obtener administración mediante registro o edición.
- **FR-014 (RF04)**: Tener ambos perfiles NO DEBE omitir comprobaciones de
  participación ni conceder administración.
- **FR-015 (RF05)**: El titular DEBE poder consultar su perfil y editar su nombre
  para mostrar, teléfono, distrito y fotografía. El identificador interno NO DEBE
  ser editable.
- **FR-016 (RF05)**: Los cambios inválidos o no autorizados DEBEN rechazarse
  conservando la información previa; un conflicto de versión NO DEBE sobrescribir
  silenciosamente un cambio guardado.
- **FR-017 (RF04, RF05)**: La presentación pública NO DEBE incluir correo,
  documentos, dirección exacta ni credenciales. El teléfono solo DEBE compartirse
  con autorización explícita del titular.
- **FR-018 (RF01–RF05)**: Ningún resultado DEBE divulgar contraseñas ni datos
  privados ajenos. Los enlaces de recuperación solo DEBEN entregarse al correo
  registrado de la cuenta correspondiente.
- **FR-019 (RF01–RF05)**: Los recorridos DEBEN completarse desde celular, tableta
  y computadora, con campos, mensajes y controles utilizables según EQ-07.
- **FR-020 (RF01–RF05)**: Los rechazos por validación o autorización NO DEBEN alterar
  la cuenta protegida; las fallas NO DEBEN comunicarse como operaciones exitosas.
- **FR-021 (RF01, RF05)**: Teléfono, distrito y fotografía DEBEN ser opcionales
  al registrarse. La información profesional se completa en RF06, no en 001.
- **FR-033 (RF01, RF05)** *(enmienda controlada 2026-11-25)*: El servidor DEBE validar
  por sí mismo, en el registro y en la edición del perfil: (a) nombre para mostrar
  obligatorio, de hasta 200 caracteres y sin caracteres de control; (b) teléfono
  opcional con solo dígitos, espacios y `+ - . ( )`, entre 6 y 15 dígitos y hasta 32
  caracteres en total, sin imponer un formato nacional; (c) distrito opcional de
  texto libre de hasta 100 caracteres y sin caracteres de control. Teléfono y distrito
  vacíos o con solo espacios DEBEN almacenarse como null. Los datos inválidos NO DEBEN
  guardarse y la respuesta DEBE indicar el motivo por campo. La validación del
  navegador es solo una ayuda y usa los mismos mensajes. Los valores ya almacenados
  antes de la enmienda no se migran y solo se revalidan si el titular los cambia.
- **FR-022 (RF01, RF03, RF05)**: Las contraseñas nuevas DEBEN tener entre 15 y
  128 caracteres inclusive y confirmación coincidente. Se DEBEN admitir espacios
  y pegado desde gestores, sin combinaciones obligatorias de mayúsculas, números
  o símbolos. Se DEBEN rechazar las comunes o conocidas como comprometidas.
- **FR-023 (RF05)**: Cambiar el correo DEBE requerir autenticación reciente
  conforme a FR-032 y verificación del nuevo correo antes de efectuar el cambio.
  El nuevo correo DEBE ser válido y único sin distinguir mayúsculas y minúsculas;
  hasta completar el cambio DEBE conservarse el anterior.
- **FR-024 (RF05)**: Cambiar correo NO DEBE cambiar el identificador interno,
  perfiles ni información existente. Después del cambio, el nuevo correo
  identifica la cuenta para acceso y recuperación, y el anterior deja de hacerlo.
- **FR-025 (RF05)**: Cambiar la contraseña DEBE usar un flujo específico con
  comprobación de la actual, o recuperación de RF03. NO DEBE permitirse mediante
  una edición ordinaria sin esa comprobación.
- **FR-026 (RF03)**: Después de completar una recuperación DEBEN invalidarse todos
  los enlaces de recuperación pendientes y todas las sesiones existentes de esa
  cuenta, incluidas sus renovaciones. DEBE exigirse iniciar sesión nuevamente.
- **FR-027 (RF03)**: Después de completar la recuperación DEBE enviarse un aviso
  del cambio al correo registrado, sin contraseñas. La elección del proveedor
  corresponde al plan técnico.
- **FR-028 (RF01, RF04, RF05)**: Un titular autenticado DEBE poder añadir desde
  su cuenta el perfil faltante con confirmación explícita, sin otra cuenta,
  credenciales nuevas ni pérdida de información. Añadir prestador habilita
  completar RF06, pero NO DEBE atribuirle verificación ni administración.
- **FR-029 (RF01, RF04)**: El registro público NO DEBE crear administradores
  y los titulares NO DEBEN poder modificar su identificador interno ni concederse
  permisos administrativos.
- **FR-030 (RF03)**: La solicitud DEBE mostrar para correos existentes e inexistentes
  el mismo texto: “Si el correo corresponde a una cuenta, recibirás instrucciones
  para recuperar el acceso”, sin revelar si la cuenta existe.
- **FR-031 (RF04, RF05)**: Registrar o modificar un teléfono NO DEBE equivaler
  a autorizar compartirlo. Su divulgación requiere autorización explícita del titular.
- **FR-032 (RF02, RF04, RF05)**: Al solicitar el cambio de correo, la autenticación
  DEBE haberse realizado hace como máximo 300 segundos, contados desde el último
  inicio de sesión con contraseña o reautenticación con la contraseña actual
  dentro de esa misma sesión. Si se supera el plazo o no hay registro, DEBE
  solicitarse nuevamente la contraseña antes de autorizar. La actividad y la
  renovación automática NO DEBEN reiniciar el plazo. La comprobación DEBE
  realizarse en el servidor; verificar el nuevo correo sigue siendo obligatorio.

### Key Entities *(include if feature involves data)*

- **Cuenta**: Identificador interno inmutable, correo válido y único sin distinguir
  mayúsculas y minúsculas, credenciales y aceptación de privacidad; reúne uno
  o ambos perfiles sin duplicar identidad.
- **Perfil de cuenta**: Nombre para mostrar de persona o empresa, teléfono,
  distrito y fotografía opcionales y perfiles habilitados. No contiene el perfil
  profesional ni la verificación de RF06–RF07.
- **Autorización para compartir teléfono**: Decisión explícita del titular,
  independiente de haber registrado el dato.
- **Sesión**: Cuenta autenticada, vigencia de acceso y renovación, estado de cierre
  o invalidación y momento de su último inicio o reautenticación con contraseña.
  La actividad y la renovación no sustituyen ese último momento.
- **Recuperación de acceso**: Cuenta destinataria, enlace con token exclusivo,
  vencimiento y uso. Su finalización invalida las sesiones y recuperaciones pendientes.
- **Cambio de correo**: Cuenta, nuevo correo propuesto, autorización basada en
  autenticación reciente y verificación del destino antes de cambiarlo.
- **Control de intentos**: Fallos consecutivos y comienzo y fin de la espera;
  no equivale a un bloqueo administrativo permanente.

### Scope and Boundaries

**Incluido**: RF01–RF05, HU01 y HU02, sus límites de acceso, privacidad y pruebas
de aceptación. El administrador es una referencia para comprobar separación de
permisos; 001 no incluye su alta, provisión de credenciales ni consola.

**Fuera de alcance**: perfil profesional, especialidades, zonas, disponibilidad,
trabajos, documentos de verificación, catálogo, búsqueda, solicitudes, cotizaciones,
contratación, pagos, calificaciones y gestión administrativa. RF04 se especifica
como regla transversal; sus pruebas sobre recursos de otros módulos se completan
al especificar cada funcionalidad, sin construir esos recursos en 001.

Se incluyen los correos de recuperación, verificación del nuevo correo y aviso
posterior a la recuperación como parte de los cambios de credenciales; no se incluye
el catálogo de avisos de negocio RF35. El proveedor de correo se elegirá en el plan.
No se añaden acceso social, segundo factor, aplicaciones nativas, eliminación de
cuenta ni funciones ajenas a RF01–RF05. Separar datos públicos no incorpora RF10.
Habilitar prestador permite continuar posteriormente en RF06, sin implementarlo
ni afirmar que el prestador ya esté verificado.

Las decisiones arquitectónicas de la constitución siguen vigentes como restricciones
heredadas. Esta especificación no redefine tecnologías, contratos de comunicación,
almacenamiento ni estructura de código; su diseño corresponde a la planificación.

### Permissions

| Operación de 001 | Persona sin sesión | Titular cliente o prestador | Cuenta con ambos perfiles | Otra cuenta o rol administrativo |
|---|---|---|---|---|
| Crear cuenta | Con datos válidos, consentimiento y cliente, prestador o ambos | No duplicar correo | Una sola identidad | El registro público no crea administradores |
| Iniciar sesión | Correo y contraseña válidos, sin bloqueo | Cuenta propia | Mismas credenciales | No apropiarse de otra identidad |
| Solicitar recuperación | Respuesta genérica; envío al correo registrado si existe | Mismo recorrido | Misma cuenta | No prueba titularidad por conocer el correo |
| Completar recuperación | Token válido de esa cuenta y nueva contraseña confirmada | Mismas condiciones | Invalida sesiones de la misma cuenta | El rol no sustituye la verificación |
| Consultar o editar perfil | Denegado | Datos propios autorizados | Mismos datos de cuenta | Sin acceso implícito a perfiles ajenos |
| Añadir perfil faltante | Denegado | Autenticado y con confirmación explícita | No duplicar perfiles existentes | No añadir administración ni verificación |
| Cambiar correo | Denegado | Autenticación con contraseña de hasta 300 segundos y nuevo correo verificado | Misma regla y cuenta | Sin cambios de identidad ajena |
| Cambiar contraseña desde cuenta | Usar recuperación, no edición privada | Comprobar contraseña actual en flujo específico | Misma contraseña para ambos perfiles | Sin edición de credenciales ajenas |
| Compartir teléfono | No se concede por conocerlo | Solo con autorización explícita del titular | Misma autorización | Registrar el dato no autoriza divulgarlo |
| Cerrar o renovar sesión | No obtiene acceso sin sesión válida | Sesión propia dentro de sus límites | Mismas condiciones | Sin gestión de sesiones ajenas en 001 |
| Cambiar identificador interno o atribuir administración | Denegado | Denegado | Denegado | Gestión administrativa fuera de 001 |

Las autorizaciones administrativas de otras funciones conservan su validez allí;
esta matriz no crea ni elimina esos permisos. Cada operación aplica identidad,
perfiles habilitados y participación. Los intentos de acceso ajeno no revelan
información privada ni eluden los controles.

### Traceability

Módulo responsable: **Usuarios y acceso**. Funcionalidad: **001**.
Las referencias PRnn son del catálogo existente; los CA-* son criterios de esta
especificación, no pruebas implementadas. Q1–Q4 identifican decisiones confirmadas.

| HU | RF | FR locales principales | Criterios de aceptación | AC / EQ | DA | ADR | Verificación |
|---|---|---|---|---|---|---|---|
| HU01 | RF01 | FR-001–003, FR-021–022, FR-028–029 | CA-REG-01–11 | AC04 / EQ-04 | DA03 | ADR-006 | PR04; registro, contraseñas y habilitación de perfiles; Q1, Q3 |
| HU01 | RF02 | FR-004–007 | CA-SES-01–09 | AC04 / EQ-04 | DA03 | ADR-006 | PR04, PR13; sesiones y acceso por correo; Q1 |
| HU01 | RF03 | FR-008–011, FR-022, FR-026–027, FR-030 | CA-REC-01–10 | AC04 / EQ-04 | DA03 | ADR-006 | PR04, PR14; mensaje genérico y revocación tras recuperación; Q1, Q2 |
| HU01 | RF04 | FR-012–014, FR-017–018, FR-029, FR-031–032 | CA-AUT-01–07, CA-PER-06, CA-COR-02–03 | AC04 / EQ-04 | DA03 | ADR-006 | PR04 y matriz de permisos; Q1, Q4 |
| HU02 | RF05 | FR-015–017, FR-021–025, FR-028, FR-031–032 | CA-PER-01–06, CA-COR-01–06, CA-CLA-01–04, CA-REG-06–07 | AC04 / EQ-04 | DA03 | ADR-006 | PR04; perfil y cambios de credenciales; Q1, Q3, Q4 |
| HU01, HU02 | RF01–RF05 | FR-018–020 | Todos los recorridos, sus rechazos y separación de datos | AC04 / EQ-04 | DA03 | ADR-006 | PR04 y criterios de cada recorrido |
| HU01, HU02 | RF01–RF05 | FR-019 | Recorridos en 360, 768 y 1366 píxeles | AC07 / EQ-07 | DA10 | ADR-004 | PR07 |

ADR-001, ADR-002, ADR-003 y ADR-013 son restricciones transversales heredadas,
sin ampliar el alcance funcional. PR12 verifica la independencia arquitectónica
y corresponde al plan, no a un nuevo recorrido. PR02 es una comprobación operativa
prevista para 001; no demuestra por sí sola EQ-02 sobre funciones de otras entregas.
PR09–PR11 de contratación no aplican a estos recorridos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Son criterios por verificar con cuentas ficticias, no mediciones obtenidas.
No se atribuyen a registro los tiempos de búsqueda EQ-01 ni de solicitud EQ-06.

- **SC-001**: El 100 % de los registros válidos evaluados crea exactamente una
  cuenta por correo sin distinguir mayúsculas; ningún registro inválido o duplicado
  crea otra cuenta. La elección de ambos perfiles o adición del faltante conserva
  identidad y datos; CA-REG-01–08.
- **SC-002**: El 100 % de los intentos no autorizados de la matriz se rechaza sin
  exponer ni modificar datos privados y todos los controles de acceso legítimo
  permiten su operación; CA-AUT-01–07, PR04, EQ-04.
- **SC-003**: Todos los casos temporales aplican bloqueo de 15 minutos tras el
  quinto fallo, acceso de 15 minutos y renovación máxima de 7 días;
  CA-SES-03–06, PR13. Las variantes de mayúsculas del correo identifican la misma
  cuenta en todos los casos de acceso válidos; CA-SES-09.
- **SC-004**: Tras cada cierre de sesión evaluado, ningún intento de reutilizarla
  o renovarla permite operar en privado sin nueva autenticación; CA-SES-07.
- **SC-005**: El 100 % de las solicitudes de recuperación, existentes o no,
  muestra el mensaje genérico exacto. Solo enlaces válidos y no usados antes de
  30 minutos permiten cambiar la contraseña; al completarlo, ningún enlace
  pendiente ni sesión anterior de la cuenta conserva acceso, se envía el aviso
  y se exige nuevo inicio; CA-REC-01–10, PR14.
- **SC-006**: Todas las actualizaciones válidas conservan sus valores al consultar
  de nuevo; ninguna presentación pública evaluada muestra correo, documentos,
  dirección exacta o credenciales y ningún teléfono se comparte sin autorización
  explícita; CA-PER-01–06 y CA-AUT-06.
- **SC-007**: Todos los recorridos se completan en anchos de 360, 768 y 1366 píxeles
  y navegadores registrados, sin perder campos, acciones o mensajes necesarios;
  FR-019, PR07, EQ-07.
- **SC-008**: Todos los cambios de correo evaluados requieren autenticación con
  contraseña de hasta 300 segundos al solicitarse y verificación del nuevo correo.
  A los 300 segundos se satisface el límite; pasado ese tiempo o sin registro se
  vuelve a pedir la contraseña. Ninguna actividad ni renovación reinicia el plazo;
  CA-COR-01–06.
- **SC-009**: Todos los cambios de contraseña por registro, recuperación o flujo
  específico cumplen el rango inclusivo de 15–128, confirmación coincidente y
  rechazo de contraseñas comunes o comprometidas. Los casos de espacios, pegado
  y ausencia de mezclas obligatorias no se rechazan por esos motivos;
  CA-REG-09–11, CA-REC-02, CA-REC-10 y CA-CLA-01–04.

## Assumptions

### Documented Decisions and Working Assumptions

- **A-001 — Hecho documentado**: Cliente y prestador son los actores incluidos.
  El administrador solo sirve de referencia de autorización; el registro público
  no crea administradores.
- **A-002 — Hecho documentado**: Los plazos de bloqueo, sesión, renovación
  y recuperación proceden de la constitución y seguridad, sin modificarlos.
- **A-003 — Interpretación explícita de RF02**: Cerrar sesión exige autenticarse
  para la siguiente operación privada, sin ventana residual hasta su vencimiento.
- **A-004 — Delimitación confirmada**: RF05 contiene datos de cuenta y cambios
  controlados de credenciales; RF06 contiene el perfil profesional. Habilitar
  prestador no supone completar RF06 ni estar verificado.
- **A-005 — Dependencia documentada**: Se requiere internet y se usan datos de
  prueba ficticios. Las metas EQ no acreditan resultados hasta medirse.
- **A-006 — Dependencia del plan**: El proveedor de correo, el método técnico de
  verificación del nuevo correo, la generación y comprobación de tokens y la
  comprobación de contraseñas comunes o comprometidas se concretan en el plan,
  respetando los comportamientos aquí definidos y la constitución.
- **A-007 — Sin decisión añadida**: No se exige documento de identidad ni se
  presupone verificación del correo antes del primer acceso. No se introduce
  una política adicional de invalidación de enlaces por solicitar otro;
  sí se invalidan todos al completar la recuperación. La revocación global
  confirmada para recuperación no se extiende implícitamente a otros cambios.
- **A-008 — Límite de evidencia**: Solo se actualiza esta especificación; no se
  crean pruebas, planes, contratos, tareas, ramas ni implementación.

### Confirmed Clarifications — 2026-11-16

Las respuestas del usuario resuelven Q1–Q4 y forman parte de los requisitos y
criterios anteriores; no son propuestas pendientes.

- **Q1 — Datos, identidad, contraseña y edición**: Correo obligatorio, válido,
  único y sin distinción de mayúsculas como identificador; acceso por correo y
  contraseña. Registro con nombre para mostrar de persona o empresa, correo,
  contraseña y confirmación, selección de cliente/prestador/ambos y aceptación
  de privacidad. Teléfono, distrito y foto opcionales. Contraseñas de 15–128,
  con espacios y pegado permitidos, sin mezclas obligatorias y con rechazo de
  comunes o comprometidas. Se editan nombre, teléfono, distrito y fotografía.
  Correo y contraseña tienen sus controles específicos; identificador interno
  y administración no son autoeditables. No se publican correo, documentos
  ni dirección exacta; compartir teléfono requiere autorización explícita.
- **Q2 — Recuperación por correo**: Envío al correo registrado y respuesta genérica
  idéntica exista o no la cuenta. El token impredecible, exclusivo y vinculado
  a la cuenta verifica acceso al correo; es de un uso y vence a los 30 minutos.
  Completar el cambio con contraseña confirmada invalida enlaces pendientes
  y sesiones existentes, envía aviso y exige iniciar sesión. Un enlace inválido,
  usado o vencido requiere solicitar otro. El proveedor se elige en el plan.
- **Q3 — Habilitación de perfiles**: Se admite elegir ambos al registrarse y añadir
  el faltante después mediante autenticación y confirmación explícita desde
  la cuenta, manteniendo identidad, credenciales e información. Se evalúan perfiles
  y participación; no se atribuye verificación de prestador ni administración.
- **Q4 — Autenticación reciente para solicitar cambio de correo**: Máximo
  5 minutos (300 segundos inclusive) desde el último inicio con contraseña
  o reautenticación con la contraseña actual dentro de la misma sesión.
  Si pasó más tiempo o no hay registro, se pide nuevamente la contraseña.
  Actividad y renovación automática no reinician el plazo; el servidor comprueba
  la condición. La verificación del nuevo correo sigue siendo obligatoria.

### Enmienda controlada — 2026-11-25 (revisión manual de T080)

La revisión manual de T080 (002) mostró que «Editar mi perfil» aceptó un teléfono con
letras. La especificación no fijaba qué caracteres admite un teléfono (solo prohibía
imponer formatos nacionales). El responsable del producto aprobó expresamente estas
cuatro decisiones como enmienda controlada de 001; no cambian la autenticación, los
permisos ni la privacidad:

- **D1 — Teléfono**: opcional; solo dígitos, espacios, `+`, `-`, `.` y paréntesis;
  de 6 a 15 dígitos cuando se proporciona; máximo 32 caracteres en total; sin formato
  exclusivamente peruano. (CA-PER-07, FR-033.)
- **D2 — Vacíos**: teléfono o distrito vacíos o con solo espacios se normalizan a null
  y siguen siendo opcionales; PostgreSQL almacena null. (CA-PER-08.)
- **D3 — Caracteres de control**: se rechazan NUL, saltos de línea, tabuladores y los
  demás caracteres de control en nombre, teléfono y distrito; se mantienen las reglas
  de nombres de personas y empresas con tildes y signos habituales. (CA-PER-09.)
- **D4 — Distrito**: texto libre de cuenta, sin lista cerrada, máximo 100 caracteres y
  sin caracteres de control. (CA-PER-10.)

También se corrige el carácter NUL (U+0000), que superaba la validación y provocaba una
falla de la base de datos (503 en lugar de 400).

No quedan aclaraciones de negocio abiertas entre las preguntas planteadas.
La especificación está lista para revisión y planificación; las dependencias
técnicas de A-006 se resolverán allí sin reinterpretar las decisiones confirmadas.

### Source References

- [Constitución 1.0.1](../../.specify/memory/constitution.md).
- [README: funcionalidad 001 y alcance del proyecto](../../README.md).
- [Actores](../../docs/01-analisis-de-sistema/01-actores.md).
- [Historias: HU01 y HU02](../../docs/01-analisis-de-sistema/02-historias-de-usuario.md).
- [Requisitos: RF01–RF05](../../docs/01-analisis-de-sistema/03-requisitos-funcionales.md).
- [Atributos de calidad](../../docs/01-analisis-de-sistema/04-atributos-de-calidad.md).
- [Restricciones](../../docs/01-analisis-de-sistema/05-restricciones.md).
- [Drivers](../../docs/01-analisis-de-sistema/06-drivers-arquitectonicos.md).
- [ADR existentes](../../docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md).
- [EQ-04 y EQ-07](../../docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md).
- [Seguridad y privacidad](../../docs/02-arquitectura-software/seguridad-y-privacidad.md).
- [Pruebas PRnn](../../docs/05-gestion/04-pruebas.md).
- [Matriz de trazabilidad](../../docs/trazabilidad.md).
