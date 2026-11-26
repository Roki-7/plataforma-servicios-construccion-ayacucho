# Feature Specification: 003 — Solicitudes y cotizaciones

**Feature Branch**: `003-solicitudes-y-cotizaciones`
**Created**: 2026-11-26
**Status**: Draft — alcance aprobado por el Product Owner el 2026-11-26 (D1–D10, P1, P2, E1 ampliado y E2) y revisión de calidad incorporada; pendiente de revisión final antes de planificar.
**Input**: HU07, HU08, HU10 y HU11 del backlog. Alcance: RF12, RF13, RF14, RF17, RF18 y RF19. RF15 y RF16 pertenecen a la 008 y quedan fuera. La preparación del registro de un aviso (FR-344) toca HU22 y RF35 sin completarlos.

Los identificadores `FR-3xx`, `SC-3xx` y `CA-…` de esta especificación son exclusivos de la 003. No reutilizan los de la 001 (`FR-001…`, `SC-001…`) ni los de la 002 (`SC-01…`, `CA-CAT-…`, `CA-SER-…`, `CA-BUS-…`, `CA-PRE-…`). `FR-347` y `FR-348` se añadieron después de `FR-346` y se ubican en su sección temática.

Esta especificación describe comportamiento observable. El diseño técnico (almacenamiento, orden de bloqueos, mecanismos de atomicidad, operaciones del contrato, procedimiento de limpieza) corresponde a la planificación.

## Resumen funcional (lenguaje llano)

**Para qué sirve.** Hoy un cliente puede encontrar prestadores, pero no puede pedirles un trabajo ni recibir ofertas comparables. Esta funcionalidad cubre ese paso: el cliente describe lo que necesita y recibe cotizaciones claras, de las que luego podrá elegir una (la elección es de la funcionalidad 004).

**Qué hace cada persona.**
- **El cliente** escribe su necesidad (qué, dónde y para cuándo), puede adjuntar hasta 5 fotos y la guarda como borrador o la publica. La puede dirigir a un prestador concreto o abrirla a prestadores compatibles. Mientras esté abierta puede corregirla, y al terminar la cierra. Después revisa las cotizaciones, pregunta lo que no entienda y compara hasta 10 lado a lado.
- **El prestador** ve las solicitudes que le corresponden (las dirigidas a él y las publicadas que encajan con sus servicios y su zona). Envía una cotización estimada o definitiva, la actualiza si la solicitud cambia o vence, y la retira si ya no le interesa.

**Qué protege.** Nadie ve teléfonos ni correos de la otra parte. Las fotos de una solicitud publicada solo las ven los prestadores si el cliente decide compartirlas, y puede dejar de compartirlas en cualquier momento. Un cambio en una solicitud nunca se pierde: queda un historial, y las cotizaciones afectadas se marcan «pendientes de revisión» en lugar de perderse en silencio.

**Qué no hace todavía.** No permite elegir ni contratar una cotización (funcionalidad 004) ni enviar notificaciones a los prestadores (funcionalidad 006). Solo deja registrado qué avisos corresponden.

## Clarifications

### Session 2026-11-26

Decisiones aprobadas expresamente por el Product Owner.

- **D1 · Compatibilidad en publicadas.** Un prestador ve y cotiza una publicada solo si tiene un servicio publicado y elegible cuya categoría coincide con la de la solicitud, y su perfil cubre el distrito. La especialidad declarada, por sí sola, no da acceso. RF14 prevalece sobre la redacción de HU08.
- **D2 · Dirigidas.** Prestador obligatorio y servicio opcional. Con servicio, la categoría se toma del servicio. Sin servicio se permite con perfil habilitado. En toda dirigida, la falta de cobertura del distrito solo genera una advertencia no bloqueante.
- **D3 · Versionado.** Una versión de control protege la concurrencia. Una versión de trabajo solo cambia con modificaciones relevantes del trabajo. La primera publicación crea la versión de trabajo 1.
- **D4 · Cotizaciones.** Una sola posición no retirada por solicitud y prestador. El retiro es terminal y un nuevo envío es otra cotización.
- **D5 · Contenido de la cotización.** Todos los elementos de RF17 existen siempre. Cambian los obligatorios según sea estimada o definitiva.
- **D6 · Fotografías.** Hasta 5 imágenes, 10 MB por archivo y 30 MB almacenados por solicitud. Las fotografías de una publicada solo se comparten con prestadores si el cliente lo decide.
- **D7 · Avisos.** Se registran de forma durable y atómica. Su entrega es de la 006.
- **D8 · Límites.** Aclaraciones de hasta 1 000 caracteres, 20 mensajes por hilo y comparación de hasta 10 cotizaciones.
- **D9 · Evidencias de cierre.** PR04, PR06, PR07, PR01 y PR12, sin heredar excepciones de la 002.
- **D10 · Contenido mínimo.** Descripción, categoría, distrito y fecha o periodo; medidas opcionales; sin título ni dirección exacta; borradores incompletos permitidos.
- **P1 · Privacidad de fotografías.** Revocar el permiso de compartir quita las imágenes a **todos** los prestadores, incluidos quienes ya cotizaron. Ellos conservan sus permisos sobre su cotización y el historial autorizado. La revocación no invalida cotizaciones.
- **P2 · Eliminación física.** Borrado lógico inmediato, intento de eliminación física y registro durable para limpieza posterior, con procedimiento verificable, frecuencia operativa y control de detección que fijará el plan. No se afirma borrado físico automático a las 24 horas.
- **E1 (ampliado) y E2.** Diferimientos formales de RF13 y RF18 descritos en [Diferimientos aprobados](#diferimientos-aprobados-e1-y-e2).

### Revisión de calidad (2026-11-26)

- **Cobertura del distrito.** La advertencia no bloqueante de cobertura se muestra en **toda** solicitud dirigida, con o sin servicio. No impide publicarla, sin perjuicio de la elegibilidad del servicio.
- **Historial autorizado.** Solo el cliente dueño consulta la bitácora completa. Los prestadores autorizados consultan las versiones de trabajo que les corresponden y no la bitácora. Las consultas no autorizadas responden como recurso inexistente.
- **Aviso en la primera publicación de una dirigida.** Se registra un aviso de negocio para el prestador destinatario, de forma atómica e idempotente. No se registran avisos masivos al publicar una solicitud pública, ni al guardar un borrador. El registro no implica entrega, visualización ni lectura, que siguen reservadas a la 006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar, publicar y gestionar una solicitud (HU07, Priority: P1)

Un cliente describe un trabajo de construcción. Puede guardarlo incompleto como borrador, dirigirlo a un prestador concreto o publicarlo para recibir cotizaciones, adjuntar imágenes, corregirlo mientras está abierto y cerrarlo.

**Why this priority**: Sin solicitudes no hay oferta de trabajo para los prestadores ni cotizaciones que comparar. Es el origen del recorrido de contratación.

**Independent Test**: Con una cuenta de cliente de prueba y datos ficticios, crear un borrador incompleto, completarlo, publicarlo, editarlo y cerrarlo, comprobando versiones, archivos y rechazos.

**Acceptance Scenarios**:

1. **Given** un cliente autenticado, **When** guarda un borrador sin descripción ni distrito, **Then** el borrador se guarda y solo él puede verlo.
2. **Given** un borrador incompleto, **When** intenta publicarlo, **Then** recibe un rechazo que indica los datos que faltan y el borrador se conserva.
3. **Given** un borrador completo con un servicio elegible, **When** lo publica, **Then** la solicitud queda ABIERTA y se crea su versión de trabajo 1. Si es dirigida, se registra un aviso para el destinatario.
4. **Given** una solicitud ABIERTA, **When** el cliente cambia un dato relevante del trabajo, **Then** se crea una versión de trabajo nueva y las cotizaciones existentes quedan pendientes de revisión.
5. **Given** una solicitud ABIERTA, **When** el cliente la cierra, **Then** queda CERRADA, ya no admite operaciones y su historial se conserva.

### User Story 2 - Consultar oportunidades y recibir solicitudes dirigidas (HU08, Priority: P1)

Un prestador consulta las solicitudes publicadas compatibles con sus servicios publicados y su cobertura, y las solicitudes dirigidas a su perfil.

**Why this priority**: Permite que la demanda llegue a prestadores con capacidad real de atenderla.

**Independent Test**: Con prestadores de prueba que tengan servicios en distintas categorías y distritos, comprobar quién ve qué solicitudes.

**Acceptance Scenarios**:

1. **Given** una publicada de una categoría y un distrito, **When** un prestador con servicio publicado y elegible compatible y cobertura del distrito consulta oportunidades, **Then** la ve.
2. **Given** la misma solicitud, **When** consulta un prestador sin servicio elegible compatible o sin cobertura, **Then** no la ve.
3. **Given** una solicitud dirigida a un prestador, **When** otro prestador consulta, **Then** no la ve y recibe una respuesta de recurso inexistente si pide su detalle.

### User Story 3 - Enviar y mantener una cotización (HU10, Priority: P1)

Un prestador compatible, o el destinatario de una dirigida, elabora una cotización estimada o definitiva sobre la versión vigente de la solicitud, la actualiza, la revisa cuando la solicitud cambia o la retira.

**Why this priority**: Es la respuesta de la oferta a la demanda y condición previa de cualquier contratación.

**Independent Test**: Con una solicitud ABIERTA y un prestador de prueba, enviar, actualizar, dejar vencer, retirar y reenviar una cotización.

**Acceptance Scenarios**:

1. **Given** una solicitud ABIERTA, **When** un prestador compatible envía una cotización válida, **Then** queda registrada contra la versión de trabajo vigente.
2. **Given** una cotización existente, **When** el mismo prestador intenta enviar otra sin haber retirado la primera, **Then** se rechaza por duplicada.
3. **Given** una solicitud que cambió, **When** el prestador consulta su cotización, **Then** aparece como pendiente de revisión y la actualiza para resolverlo.
4. **Given** una cotización activa, **When** el prestador la retira, **Then** queda retirada de forma terminal y puede enviar otra distinta.

### User Story 4 - Aclarar y comparar cotizaciones (HU11, Priority: P2)

El cliente revisa las cotizaciones recibidas, pide aclaraciones y compara hasta 10 de ellas, distinguiendo las estimadas, las incompletas y las que no son aceptables.

**Why this priority**: Permite elegir con información suficiente. La elección misma pertenece a la 004.

**Independent Test**: Con una solicitud con varias cotizaciones de prueba, listar, preguntar, responder y comparar.

**Acceptance Scenarios**:

1. **Given** varias cotizaciones, **When** el cliente las lista, **Then** las ve paginadas y sin una clasificación de «mejor».
2. **Given** una cotización, **When** el cliente pregunta y el prestador responde, **Then** ambos mensajes quedan asociados a esa cotización y sobreviven a sus actualizaciones.
3. **Given** una estimada incompleta, **When** el cliente la compara, **Then** los datos faltantes se muestran como «No indicado» y el importe estimado no se presenta como definitivo.

### Edge Cases

- Un servicio que se pausa o se retira después de publicar la solicitud no cierra la solicitud ni impide cotizar.
- Una solicitud dirigida, con o sin servicio, se permite aunque el prestador no cubra el distrito. Una dirigida sin servicio se permite aunque el prestador no declare la categoría. Solo se muestran advertencias.
- Un prestador que intenta cotizar su propia solicitud es rechazado.
- Una solicitud que cambia mientras se envía una cotización: la cotización sobre una versión desactualizada se rechaza, o queda pendiente de revisión si entró antes.
- Una cotización vencida conserva su posición y se resuelve actualizándola.
- Una solicitud cerrada con cotizaciones existentes las deja inutilizables para operaciones posteriores y conserva todo en lectura.
- Una cotización reemplazada conserva sus aclaraciones. Un nuevo envío tras un retiro empieza con un hilo vacío.
- Una publicada con muchos prestadores interesados no impone un máximo de cotizaciones y todo listado se pagina.
- Una petición repetida con la misma clave no duplica versiones, avisos ni archivos. Una edición idéntica al estado vigente no tiene efectos.
- Un archivo cargado que no se confirma en 24 horas deja de contar para el cupo y de ser accesible.
- Un monto o una medida legítimos escritos en el texto libre no deben tomarse por un teléfono.

## Requirements *(mandatory)*

### Functional Requirements

**Solicitudes (HU07, RF12 y RF13)**

- **FR-301**: El sistema MUST permitir a un cliente guardar un borrador incompleto, validando solo el formato y la existencia de los datos presentes. Solo su dueño lo ve.
- **FR-302**: El sistema MUST exigir al publicar: tipo; si es dirigida, un prestador con perfil habilitado y distinto del cliente; descripción de hasta 2 000 caracteres; una categoría activa; un distrito admitido y una fecha o periodo deseado no anterior a hoy. Si falta algo, MUST rechazar con `SOLICITUD_INCOMPLETA` e indicar los campos faltantes. Los valores con formato o longitud inválidos se rechazan con `DATOS_INVALIDOS`.
- **FR-303**: El distrito MUST pertenecer al catálogo geográfico admitido (Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray). Las medidas son opcionales (hasta 500 caracteres). No se pide dirección exacta ni título.
- **FR-304**: Una solicitud dirigida MUST indicar un prestador y puede indicar un servicio. Con servicio, este debe pertenecer al prestador, ser elegible al guardarlo o cambiarlo en el borrador y al publicar, y la categoría se toma del servicio.
- **FR-305**: Una dirigida sin servicio MUST permitirse con perfil habilitado del prestador y una categoría activa. En **toda** dirigida, con o sin servicio, el sistema MUST mostrar una advertencia no bloqueante si el prestador no cubre el distrito. En una dirigida sin servicio, además, si la categoría no figura entre las especialidades del prestador. La falta de cobertura MUST NOT impedir publicarla, sin perjuicio de la elegibilidad del servicio.
- **FR-306**: Tras la publicación, el tipo, el prestador, el servicio y, si hay servicio, la categoría MUST ser inmutables. Los demás datos pueden editarse mientras la solicitud esté ABIERTA. Intentar cambiar un campo inmutable MUST rechazarse con el error `CAMPO_NO_MODIFICABLE` sin cambiar nada. Enviar el mismo valor que ya tiene no es una modificación.
- **FR-307**: La primera publicación MUST crear la **versión de trabajo 1** como instantánea inicial de la solicitud. Esa versión inicial no es un cambio posterior: no deja cotizaciones pendientes de revisión y no genera la revisión que producen las versiones siguientes.
- **FR-308**: Las versiones de trabajo **posteriores a la 1** MUST generarse únicamente por cambios relevantes del trabajo: descripción, medidas, conjunto de archivos confirmados, categoría, distrito y fecha o periodo. Cada una guarda una copia inmutable, deja las cotizaciones existentes pendientes de revisión y registra avisos (FR-344).
- **FR-309**: Después de la versión inicial 1, ni cambiar el permiso de compartir fotografías ni cerrar la solicitud MUST crear una versión de trabajo ni invalidar cotizaciones por revisión. Ambos cambios suben la versión de control y quedan en la bitácora. La publicación inicial también sube la versión de control y queda en la bitácora, además de crear la versión 1 conforme a FR-307.
- **FR-310**: Toda modificación MUST controlar la versión de control esperada y rechazar la desactualizada. Una edición idéntica al estado vigente MUST NOT crear versión, bitácora ni aviso. Una petición repetida con la misma clave MUST devolver el mismo resultado sin efectos nuevos.
- **FR-311**: Cerrar una solicitud MUST ser terminal y MUST NOT crear versión de trabajo. Debe registrar bitácora y, si hay prestadores interesados, avisos. Una solicitud CERRADA MUST rechazar edición, archivos, cotizaciones nuevas, actualizaciones, retiros y aclaraciones, y conservar el historial en lectura.
- **FR-312**: Un borrador MUST poder descartarse cerrándolo. Descartar un borrador no registra avisos.
- **FR-313**: Si el servicio de una dirigida deja de ser elegible después de publicar, la solicitud MUST seguir ABIERTA con la copia guardada del servicio y no revalidarse al editar otros datos.

**Datos personales en texto libre (RF12)**

- **FR-314**: El teléfono, el correo y los demás datos privados del perfil del cliente MUST NOT copiarse a la solicitud ni aparecer en ninguna respuesta. Es distinto de lo que el cliente escribe voluntariamente en la descripción o las medidas, cuyo contenido la plataforma no puede garantizar.
- **FR-315**: En solicitudes publicadas, el sistema MUST rechazar la descripción o las medidas que contengan correos, enlaces o referencias a mensajería y números de teléfono, según los [criterios verificables](#criterios-verificables-de-datos-personales). Posibles documentos y direcciones MUST generar solo advertencia.
- **FR-316**: En solicitudes dirigidas y borradores, las mismas detecciones MUST generar solo advertencia, sin bloquear. Ningún mensaje ni respuesta MUST afirmar que el texto libre está protegido o verificado.
- **FR-348**: Las detecciones MUST evitar falsos positivos sobre medidas, cantidades e importes legítimos. Los criterios de la sección [Criterios verificables de datos personales](#criterios-verificables-de-datos-personales) son obligatorios y verificables con los ejemplos que contienen.

**Archivos y fotografías (RF12)**

- **FR-317**: Una solicitud MUST admitir hasta 5 imágenes JPG, PNG o WEBP, verificadas por contenido, de hasta 10 MB cada una y 30 MB almacenados en total (10 000 000 y 30 000 000 bytes, como la medida de la 002). Las imágenes se recodifican sin metadatos. PDF queda fuera.
- **FR-318**: Los límites de cantidad y de tamaño MUST cumplirse aunque varias cargas lleguen a la vez.
- **FR-319**: Una carga MUST registrarse de forma consistente entre el almacenamiento de los archivos y los registros de la solicitud. Si el almacenamiento falla, no se consume cupo. Si el proceso se interrumpe, la carga caduca y el objeto queda para limpieza.
- **FR-320**: Un archivo cargado que no se confirma (FR-347) dentro de las 24 horas siguientes a su carga MUST dejar de contar para el cupo y de ser accesible, y MUST NOT poder confirmarse. Ninguna operación que evalúe el límite MUST ver un archivo caducado ocupando cupo.
- **FR-321**: Quitar un archivo confirmado MUST ser un borrado lógico inmediato que lo hace inaccesible de forma inmediata, MUST registrar de forma durable su purga y MUST intentar la eliminación física. Las versiones anteriores conservan solo metadatos y muestran «archivo retirado».
- **FR-322**: El plan técnico MUST fijar un procedimiento de limpieza física verificable, su frecuencia operativa, su responsable y un control que detecte objetos pendientes. La documentación MUST NOT afirmar un borrado físico automático a las 24 horas si no existe un proceso que lo garantice. El riesgo residual de retención física temporal MUST documentarse.
- **FR-323**: Todo acceso a archivos MUST hacerse con sesión autenticada, sin direcciones públicas ni firmadas.
- **FR-347**: **Confirmación de archivos.** Un archivo cargado queda PREPARADO cuando su carga terminó y fue verificado. Hasta entonces no puede confirmarse. Pasa a CONFIRMADO únicamente cuando el cliente dueño lo incluye en la lista final de archivos al guardar el borrador, al publicar o al editar una solicitud ABIERTA. La confirmación MUST validar, como una operación única de todo o nada: (a) que cada archivo pertenezca a esa solicitud y al cliente solicitante, de lo contrario se responde como recurso inexistente; (b) que esté PREPARADO, de lo contrario `ARCHIVO_NO_LISTO`; (c) que no haya caducado, de lo contrario `ARCHIVO_EXPIRADO`; y (d) que la lista final no supere 5 archivos ni 30 MB almacenados, de lo contrario `LIMITE_ARCHIVOS`. Si alguna validación falla, no se confirma ningún archivo y la solicitud no cambia. Los archivos confirmados que ya no figuran en la lista final se quitan conforme a FR-321. Los archivos PREPARADOS no incluidos siguen pendientes hasta caducar y solo los ve su dueño. En una ABIERTA, cambiar el conjunto de archivos confirmados es un cambio relevante (FR-308).

**Acceso y privacidad**

- **FR-324**: El acceso de un prestador a una solicitud MUST ser la unión de tres títulos independientes: (a) ser destinatario de una dirigida, (b) ser compatible con una publicada ABIERTA, o (c) ser autor de una cotización no retirada. El título (c) persiste aun con la solicitud CERRADA.
- **FR-325**: Retirar una cotización MUST eliminar solo el acceso derivado de esa cotización (c). El destinatario de una dirigida conserva su acceso, y un prestador compatible sigue consultando la publicada mientras cumpla las reglas. Sin ninguno de esos títulos, el prestador conserva solo la lectura de su propia cotización.
- **FR-326**: Perder la compatibilidad MUST impedir enviar cotizaciones nuevas, pero quien tiene una cotización no retirada conserva la lectura de la solicitud y puede actualizar o retirar.
- **FR-327**: Las fotografías de una dirigida las ven el cliente y el destinatario. Las de una publicada las ve el cliente y, solo si decidió compartirlas, los prestadores con acceso a la solicitud. Sin permiso, un prestador puede ver solo que existen fotografías no compartidas.
- **FR-328**: Revocar el permiso de compartir MUST surtir efecto en la siguiente petición para **todos** los prestadores, incluidos quienes ya cotizaron. Estos conservan sus permisos sobre su cotización y el **historial autorizado** (definido en FR-331). La revocación MUST NOT invalidar cotizaciones. Volver a compartir restablece el acceso.
- **FR-329**: Un recurso ajeno, o al que el solicitante no tiene título, MUST responder como recurso inexistente (404) sin revelar su existencia, y ninguna respuesta incluye datos de contacto de la otra parte.

**Historial (RF13)**

- **FR-330**: El contrato MUST ofrecer una forma **autorizada y paginada** de consultar las versiones de trabajo y la bitácora de una solicitud. Si una operación existente puede resolverlo adecuadamente, MUST NOT añadirse una ruta nueva. La decisión corresponde al plan.
- **FR-331**: El **historial autorizado** de una solicitud es el conjunto ordenado y paginado de sus versiones de trabajo (número, fecha y contenido relevante de cada una) que el solicitante puede ver según este requisito. **No incluye la bitácora** ni sus datos (actor, cambios de privacidad, transiciones). Pueden consultar las versiones de trabajo el cliente dueño, el destinatario de una dirigida y los autores de cotizaciones no retiradas. Los demás prestadores con acceso ven solo la versión vigente. **Solo el cliente dueño** puede consultar la bitácora completa. Una consulta de la bitácora por cualquier otro solicitante, incluido un prestador autorizado para las versiones, MUST responder como recurso inexistente.

**Oportunidades (HU08, RF14)**

- **FR-332**: Un prestador MUST ver las publicadas ABIERTAS compatibles y las dirigidas a él, paginadas, y no las propias ni las dirigidas a otros. Una dirigida no exige compatibilidad.
- **FR-333**: La compatibilidad con una publicada MUST exigir un servicio publicado y elegible con clasificación efectivamente activa (propia y de su categoría padre) cuya categoría coincida así. Una solicitud de categoría (nivel 1) coincide con servicios de esa categoría o de sus subcategorías. Una solicitud de subcategoría (nivel 2) coincide solo con servicios de esa misma subcategoría. Además el perfil MUST cubrir el distrito de la solicitud.
- **FR-334**: La especialidad declarada, por sí sola, MUST NOT conceder acceso a una publicada.

**Cotizaciones (HU10, RF17 y RF18)**

- **FR-335**: Un prestador compatible, o el destinatario de una dirigida, MUST poder cotizar una solicitud ABIERTA indicando la versión de trabajo que revisó. Si no es la vigente, MUST rechazarse. Nadie MUST cotizar su propia solicitud. Un prestador sin título sobre la solicitud no puede cotizarla y recibe la respuesta de recurso inexistente.
- **FR-336**: Cada prestador MUST tener a lo sumo una cotización no retirada por solicitud. VENCIDA y PENDIENTE_REVISION siguen ocupando esa posición y se resuelven actualizando. El retiro es terminal y libera la posición. Un nuevo envío crea otra cotización con otro identificador y un hilo vacío.
- **FR-337**: Toda cotización MUST contar con los campos: tipo, alcance, exclusiones, materiales, mano de obra, precio, forma de cálculo, plazo, vigencia y condiciones de pago. Una **estimada** exige alcance, vigencia y precio o forma de cálculo. Una **definitiva** exige además precio fijo, plazo y condiciones de pago. El precio se expresa en céntimos de PEN y debe ser mayor que cero cuando se informa. Un campo no informado se muestra como «No indicado».
- **FR-338**: Cada actualización MUST crear una versión de la cotización, conservar las anteriores como reemplazadas y exigir la versión esperada.
- **FR-339**: El estado efectivo de una cotización MUST seguir esta prioridad: RETIRADA, VENCIDA, PENDIENTE_REVISION, VIGENTE. VENCIDA se determina con la hora oficial del sistema. La respuesta MUST incluir también los indicadores `vencida`, `requiereRevision` y `solicitudCerrada`. Una cotización vencida, pendiente de revisión o de una solicitud cerrada MUST reportarse como no aceptable. La aceptación efectiva de una cotización no existe en la 003.
- **FR-340**: El prestador MUST poder consultar sus cotizaciones y sus versiones. El cliente dueño MUST poder consultar las cotizaciones de su solicitud.
- **FR-341**: Para la 004, la 003 MUST ofrecer solo lecturas reales de la cotización vigente, con los motivos de no aceptabilidad y la validación del cliente y la disponibilidad. La 003 MUST NOT incluir operaciones de selección, aceptación ni contratación, ni producir los estados SELECCIONADA, NO_SELECCIONADA, CONTRATADA o COMPLETADA, ni simularlos.

**Aclaraciones y comparación (HU11, RF18 y RF19)**

- **FR-342**: El cliente dueño y el prestador autor MUST poder intercambiar mensajes de texto plano (hasta 1 000 caracteres, máximo 20 por hilo, sin adjuntos, inmutables) asociados a su cotización. Sobreviven a las actualizaciones y quedan en lectura si la cotización se retira o la solicitud se cierra. Nadie más puede leer ni escribir el hilo.
- **FR-343**: El cliente MUST poder listar paginadamente las cotizaciones de su solicitud sin una clasificación de «mejor» y comparar hasta 10. La comparación MUST mostrar todos los campos de RF17, con «No indicado» donde falten, rotular las estimadas, no sumarlas ni presentarlas como definitivas, y señalar las vencidas, las pendientes de revisión y las de solicitud cerrada.

**Avisos (RF13 con diferimiento parcial, E1; preparación de HU22 y RF35)**

- **FR-344**: El sistema MUST registrar un aviso REGISTRADO, de forma atómica con el cambio que lo origina, en estos casos únicamente:
  1. **Primera publicación de una dirigida:** un aviso para el prestador destinatario.
  2. **Cada versión de trabajo posterior a la 1:** un aviso para cada prestador interesado.
  3. **Cierre de una solicitud ABIERTA:** un aviso para cada prestador interesado.

  Son interesados el destinatario de una dirigida y los autores de cotizaciones no retiradas, con un solo aviso por prestador y suceso. El registro es idempotente: repetir o reintentar la operación no lo duplica, y si el cambio no se confirma no queda aviso. Es independiente del correo de la 001 y contiene solo identificadores.
- **FR-345**: Ninguna pantalla ni respuesta MUST afirmar que un aviso fue enviado, entregado, visto o leído. **No se registran avisos** al publicar una solicitud publicada, al guardar o descartar un borrador, ni por cambios de privacidad. Quien no es interesado no recibe aviso.

**Concurrencia y errores**

- **FR-346**: Los conflictos concurrentes esperados MUST traducirse a las respuestas controladas de la sección [Respuestas de error observables](#respuestas-de-error-observables). Un conflicto de acceso simultáneo que persista tras los reintentos acotados responde `CONFLICTO_CONCURRENTE`. La falta de disponibilidad de una dependencia responde 503 `DEPENDENCIA_NO_DISPONIBLE`. Los errores inesperados de infraestructura no se ocultan: se registran con un identificador de correlación sin exponer detalles internos ni dejar cambios parciales.

### Key Entities *(include if feature involves data)*

- **Solicitud.** Necesidad del cliente. Tiene tipo (dirigida o publicada), estado (BORRADOR, ABIERTA o CERRADA), descripción, categoría, distrito, fecha o periodo deseado, medidas opcionales, una versión de control y una versión de trabajo.
- **Versión de trabajo.** Copia inmutable de los datos relevantes de la solicitud. La versión 1 se crea con la primera publicación.
- **Bitácora de la solicitud.** Registro de cada cambio, relevante o no, con actor, fecha y tipo. Solo la ve el cliente dueño.
- **Archivo de solicitud.** Imagen saneada asociada a una solicitud. Está PREPARADO (cargado y verificado) o CONFIRMADO (incluido en la solicitud). Puede caducar o quitarse.
- **Cotización.** Identidad de la oferta de un prestador para una solicitud. Tiene tipo estimada o definitiva y su estado persistente es activa o retirada.
- **Versión de cotización.** Contenido de la cotización en un momento dado, vinculado a una versión de trabajo de la solicitud.
- **Aclaración.** Mensaje de texto asociado a una cotización.
- **Aviso de negocio.** Registro de un suceso que interesa a un prestador. Su entrega es de la 006.

### Business Rules

- **Estados.** Solicitud: BORRADOR, ABIERTA y CERRADA. Cotización: activa o retirada como estado persistente. VENCIDA y PENDIENTE_REVISION se derivan. SELECCIONADA, NO_SELECCIONADA, CONTRATADA y COMPLETADA pertenecen a la 004 y a la 005 y la 003 nunca los produce.
- **Elegibilidad.** Se evalúa al guardar o cambiar el servicio de un borrador y al publicar. No se revalida al editar otros datos.
- **Fechas.** La fecha o el periodo deseado son fechas de calendario en America/Lima. Los instantes se expresan en UTC.
- **Dinero.** Importes en céntimos de PEN.
- **Compatibilidad.** Ver FR-333. La dirección de coincidencia entre categoría y subcategoría es la misma que usa la búsqueda pública de la 002. Solo rige para las publicadas.
- **Cobertura del distrito.** En una publicada determina la compatibilidad. En toda dirigida, que el prestador no cubra el distrito produce solo una advertencia.
- **Historial autorizado.** Definido en FR-331: versiones de trabajo, nunca la bitácora.
- **Avisos.** Los casos que los registran son exactamente los de FR-344. Registrar no es entregar.

### Criterios verificables de datos personales

Aplican a la descripción y las medidas (FR-315, FR-316 y FR-348). Los ejemplos son ficticios.

| Detección | Criterio | Efecto en publicada | Efecto en dirigida o borrador |
|---|---|---|---|
| Correo | Texto con forma `usuario@dominio` | Rechazo | Advertencia |
| Enlace o mensajería | `http://`, `https://`, `www.`, dominios con sufijo (`.com`, `.pe`, `.net`, `.org`), `wa.me`, `t.me` o las palabras «WhatsApp» y «Telegram» | Rechazo | Advertencia |
| Teléfono | Secuencia de **9 o más dígitos** una vez retirados los espacios, guiones, puntos y paréntesis internos, con o sin prefijo `+51` o `51` | Rechazo | Advertencia |
| Documento | «DNI», «documento» o «RUC» seguidos de 8 u 11 dígitos | Advertencia | Advertencia |
| Dirección | «Jr.», «Av.», «Calle», «Psje.», «Mz.» o «Lt.» seguidos de un nombre o número | Advertencia | Advertencia |

**Exentos de teléfono (no se rechazan ni se advierten):** cantidades y montos de menos de 9 dígitos; montos con indicador monetario (`S/`, `S/.`, `PEN`, `$`, `USD`) delante o con «soles» o «dólares» detrás, con o sin separadores de miles o decimales; medidas y dimensiones con unidad (`m`, `m²`, `m2`, `cm`, `mm`, `kg`, `L`, `und`); porcentajes; fechas en formato día/mes/año; numeraciones cortas (lote 12, manzana B, piso 3).

**Ejemplos que se aceptan sin advertencia:** «Pared de 2.50 x 3.00 m, presupuesto S/ 1 500 000»; «Necesito 120 m2 de piso en 3 pisos»; «Entrega el 26/11/2026».
**Ejemplos que se rechazan en una publicada:** «Llámame al 981 234 567»; «+51 981234567»; «escríbeme a juan@correo.com»; «wa.me/51981234567»; «www.ejemplo.pe/contacto»; «escríbeme por WhatsApp».
**Ejemplos que solo generan advertencia:** «mi DNI 12345678»; «Jr. Lima 123 cerca del mercado».

### Respuestas de error observables

Contrato de comportamiento visible para quien consume la API (constitución VII). Los códigos son estables.

| Situación | Respuesta |
|---|---|
| Valor con formato o longitud inválidos, con detalle por campo | 400 `DATOS_INVALIDOS` |
| Publicar una solicitud con campos obligatorios faltantes | 422 `SOLICITUD_INCOMPLETA` |
| Cotización sin los campos obligatorios de su tipo | 422 `COTIZACION_INCOMPLETA` |
| Cambiar un campo inmutable tras publicar | 422 `CAMPO_NO_MODIFICABLE` |
| Versión de control desactualizada | 409 `VERSION_DESACTUALIZADA` |
| Cotización sobre una versión de trabajo anterior | 409 `SOLICITUD_MODIFICADA` |
| Operación sobre una solicitud no abierta | 409 `SOLICITUD_NO_ABIERTA` |
| Segunda cotización no retirada del mismo prestador | 409 `COTIZACION_EXISTENTE` |
| Operación sobre una cotización retirada | 409 `COTIZACION_RETIRADA` |
| Misma clave con otros datos | 409 `CLAVE_IDEMPOTENCIA_REUTILIZADA` |
| Conflicto de acceso simultáneo persistente | 409 `CONFLICTO_CONCURRENTE` |
| Cotizar la propia solicitud | 422 `COTIZACION_PROPIA` |
| Superar el cupo de archivos | 422 `LIMITE_ARCHIVOS` |
| Confirmar un archivo cuya carga no terminó | 422 `ARCHIVO_NO_LISTO` |
| Confirmar un archivo caducado | 422 `ARCHIVO_EXPIRADO` |
| Datos personales evidentes en una publicada | 422 `DATOS_PERSONALES_EN_TEXTO` |
| Superar los 20 mensajes de un hilo | 422 `LIMITE_ACLARACIONES` |
| Comparar más de 10 cotizaciones | 422 `LIMITE_COMPARACION` |
| Imagen con formato no admitido | 422 `IMAGEN_FORMATO_NO_ADMITIDO` |
| Archivo de más de 10 MB | 413 `ARCHIVO_DEMASIADO_GRANDE` |
| Regla de negocio incumplida sin código propio en esta tabla | 422, con un código estable que fijará el plan |
| Recurso ajeno o sin título del solicitante | 404 `RECURSO_NO_DISPONIBLE`, sin revelar su existencia |
| Almacenamiento u otra dependencia no disponible | 503 `DEPENDENCIA_NO_DISPONIBLE` |

Los códigos `DATOS_INVALIDOS`, `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `RECURSO_NO_DISPONIBLE`, `DEPENDENCIA_NO_DISPONIBLE`, `IMAGEN_FORMATO_NO_ADMITIDO` y `ARCHIVO_DEMASIADO_GRANDE` ya existen en la 001 o la 002 y se reutilizan. El resto son nuevos de la 003.

### Permissions

El acceso efectivo de un prestador es la unión de sus títulos (FR-324). «Autor retirado» es quien retiró su cotización y no tiene ningún otro título.

| Operación | Visitante | Cliente dueño | Destinatario (a) | Compatible (b) | Autor no retirado (c) | Autor retirado | Otra cuenta |
|---|---|---|---|---|---|---|---|
| Crear, editar y cerrar solicitud propia | No | Sí | No | No | No | No | No |
| Ver un borrador | No | Sí | No | No | No | No | No |
| Ver dirigida ABIERTA | No | Sí | Sí | n/a | n/a | No | No |
| Ver dirigida CERRADA | No | Sí | Sí, lectura | n/a | n/a | No | No |
| Ver publicada ABIERTA | No | Sí | n/a | Sí | Sí | No | No |
| Ver publicada CERRADA | No | Sí | n/a | No | Sí, lectura | No | No |
| Fotografías de una dirigida (abierta o cerrada) | No | Sí | Sí | n/a | n/a | No | No |
| Fotografías de una publicada ABIERTA | No | Sí | n/a | Solo con permiso vigente | Solo con permiso vigente | No | No |
| Fotografías de una publicada CERRADA | No | Sí | n/a | No | Solo con permiso vigente | No | No |
| Versiones de trabajo (historial autorizado) | No | Sí | Sí | Solo la versión vigente, si está ABIERTA | Sí | No | No |
| Bitácora completa | No | Sí | No | No | No | No | No |
| Cotizar una solicitud ABIERTA | No | No | Sí | Sí | No (ya cotizó) | No | No |
| Actualizar o retirar su cotización (solicitud ABIERTA) | No | No | Su cotización | Su cotización | Su cotización | No | No |
| Leer su propia cotización y sus versiones | No | No | Sí | Sí | Sí | Sí, solo la suya | No |
| Preguntar y responder aclaraciones de una cotización | No | Sí, en las de su solicitud | Autor | Autor | Autor | Lectura de su hilo | No |
| Listar y comparar cotizaciones de una solicitud | No | Sí, de la suya | No | No | No | No | No |

«n/a» indica que el título no aplica a ese tipo de solicitud. Una cuenta con ambos perfiles se evalúa según su papel en cada operación. Los rechazos no deben modificar datos ni revelar recursos privados.

### Diferimientos aprobados (E1 y E2)

**E1 · RF13 parcialmente diferido, ampliado con la preparación de un aviso.**
- A la **006** (HU22, RF35): la entrega, visualización y lectura de avisos, y todo aviso no incluido en FR-344.
- A la **004** (RF20 a RF22): el retiro de una selección pendiente, porque en la 003 no puede existir ninguna.
- La 003 aporta el registro atómico del aviso, la versión de trabajo, el estado derivado «Requiere revisión» y las listas visibles.
- **Ampliación aprobada el 2026-11-26:** se registra además un aviso para el destinatario al publicar por primera vez una dirigida (FR-344, caso 1). Es una **preparación** de HU22 y RF35 y **no completa las notificaciones**: no hay entrega, visualización, lectura ni canales. RF13 se cierra en la 003 como parcial.

**E2 · RF18 parcialmente diferido.**
- A la **004**: que una cotización seleccionada no pueda retirarse y la aplicación efectiva de «una propuesta reemplazada o retirada no puede aceptarse».
- A la **004 o la 009**, según su especificación: la propuesta de cambio sobre una contratación confirmada.
- La 003 aporta actualizar, retirar, aclaraciones y la lectura real de la cotización vigente con sus motivos de no aceptabilidad.

**Riesgos aceptados.** Los prestadores no reciben aviso proactivo hasta la 006 y descubren los cambios al abrir la plataforma. Los avisos registrados se acumulan sin consumidor hasta la 006, que decidirá si los envía a sus destinatarios o los expira. Una cotización sin revisar permanece pendiente. Hasta la 004 nada puede seleccionarse. El riesgo de que la 004 no honre el contrato se mitiga con esta trazabilidad.

### Traceability

| HU → RF | AC / EQ | DA → ADR | Módulo responsable o participante | Pruebas previstas |
|---|---|---|---|---|
| HU07 → RF12 | AC04 / EQ-04, AC06 / EQ-06 | DA03, DA09 → ADR-005, ADR-006, ADR-011 | Solicitudes y visitas, con Usuarios y acceso y Catálogo y búsqueda | CA-SOL, CA-BOR, CA-ARC, CA-DAT, PR04, PR06 |
| HU07 → RF13 (parcial, E1) | AC04 / EQ-04 | DA11 → ADR-009, ADR-012 | Solicitudes y visitas y Notificaciones | CA-SOL-05 a 09, CA-VER, CA-CIE, CA-AVI |
| HU22 → RF35 (solo preparación del registro, no cumplimiento; E1) | AC08 / EQ-08 | DA05 → ADR-009 | Notificaciones (006), con la 003 como productora del registro | CA-AVI-02 a 04. PR15 permanece en 004 y 006. |
| HU08 → RF14 | AC04 / EQ-04, AC01 / EQ-01 | DA03, DA02 → ADR-006, ADR-010 | Solicitudes y visitas, con Catálogo y búsqueda y Prestadores | CA-OPO, CA-CMP, CA-PRI, PR04, PR01 |
| HU10 → RF17 | AC09 / EQ-09 | DA04 → ADR-005, ADR-012 | Cotizaciones | CA-COT, CA-RF17 |
| HU10 y HU11 → RF18 (parcial, E2) | AC09 / EQ-09 | DA04, DA11 → ADR-005, ADR-012 | Cotizaciones | CA-COT-05, 06, 10, CA-ACL, CA-FRO |
| HU11 → RF19 | AC01 / EQ-01 | DA02 → ADR-010 | Cotizaciones | CA-COT-08, 12, CA-RF17-04, PR01 |
| HU07, HU08, HU10, HU11 → RF12–RF14, RF17–RF19 | AC07 / EQ-07 | DA10 → ADR-004 | Recorridos web de Solicitudes y Cotizaciones | PR07 |

La regla de dependencia (PR12) y la matriz de permisos (PR04) se verifican también para los módulos nuevos.

### Escenarios de aceptación críticos

**Solicitudes**
- **CA-SOL-01.** Una dirigida a un servicio no elegible falla sin guardar, aunque antes lo fuera.
- **CA-SOL-02.** Con servicio, enviar otra categoría devuelve 422.
- **CA-SOL-03.** Una dirigida al propio cliente devuelve 422.
- **CA-SOL-04.** Publicar con un distrito fuera del catálogo admitido no publica y conserva el borrador.
- **CA-SOL-05.** Una edición de una solicitud ABIERTA con cambios relevantes del trabajo crea una versión de trabajo y registra los avisos de forma atómica. Si falla, no queda ninguna de las dos. Una edición que cambia solo la privacidad no la crea y se rige por CA-VER-01.
- **CA-SOL-06.** La misma petición con la misma clave devuelve el mismo resultado sin versión ni aviso nuevos. Con otro cuerpo, 409.
- **CA-SOL-07.** Una edición idéntica al estado vigente no genera efectos.
- **CA-SOL-08.** Un servicio retirado tras publicar deja la solicitud ABIERTA con la copia guardada, y se puede cotizar.
- **CA-SOL-09.** Intentar cambiar el tipo, el prestador, el servicio o, con servicio, la categoría de una solicitud publicada devuelve 422 `CAMPO_NO_MODIFICABLE` sin cambios. Enviar el mismo valor no se considera un cambio.
- **CA-SOL-10.** Una descripción de más de 2 000 caracteres o unas medidas de más de 500 devuelven 400 `DATOS_INVALIDOS`. No existe campo de título ni de dirección exacta.

**Borradores y dirigidas**
- **CA-BOR-01.** Se guarda un borrador sin descripción ni distrito.
- **CA-BOR-02.** Publicarlo con campos faltantes devuelve 422 `SOLICITUD_INCOMPLETA` con el detalle.
- **CA-BOR-03.** Guardar un borrador con un servicio no elegible falla sin guardar.
- **CA-BOR-04.** Un servicio elegible al guardar que se retira antes de publicar devuelve 422 al publicar.
- **CA-BOR-05.** Un servicio cuya categoría cambió impide publicar con 422.
- **CA-BOR-06.** Un borrador solo lo ve su dueño.
- **CA-BOR-07.** Un borrador se descarta cerrándolo y no registra avisos.
- **CA-BOR-08.** Una dirigida **sin servicio** se publica aunque el prestador no cubra el distrito o no declare la categoría, y la respuesta incluye ambas advertencias no bloqueantes.
- **CA-BOR-09.** Una dirigida **con servicio** elegible se publica aunque el prestador no cubra el distrito, y la respuesta incluye la advertencia de cobertura.
- **CA-BOR-10.** Una dirigida a un prestador sin perfil habilitado, o con un servicio que pertenece a otro prestador, devuelve 422.

**Versionado y cierre**
- **CA-VER-01.** Cambiar exclusivamente el permiso de compartir fotografías sube la versión de control, deja bitácora y no pone cotizaciones en PENDIENTE_REVISION, no crea versión de trabajo ni registra avisos.
- **CA-VER-02.** Cerrar no invalida cotizaciones por revisión.
- **CA-VER-03.** Cualquier cambio relevante posterior a la versión 1, incluido el conjunto de archivos, crea una versión de trabajo nueva.
- **CA-VER-04.** Cambiar el permiso con una versión de control desactualizada devuelve 409.
- **CA-VER-05.** Una edición que combina un cambio relevante y uno de privacidad crea una sola versión de trabajo y registra ambos en la bitácora.
- **CA-VER-06.** La primera publicación crea la versión de trabajo 1 y no deja cotizaciones pendientes de revisión. La versión 2 nace solo con el primer cambio relevante posterior.
- **CA-VER-07.** Editar un borrador no crea versiones de trabajo.
- **CA-CIE-01.** Una solicitud CERRADA rechaza edición, archivos, cotizaciones, actualizaciones, retiros y aclaraciones con 409, y se lee con normalidad.
- **CA-CIE-02.** Cerrar una ABIERTA no crea versión de trabajo, registra bitácora y avisos para los prestadores interesados, y la cotización vigente se reporta como no aceptable por solicitud cerrada.
- **CA-CIE-03.** En una solicitud CERRADA, el destinatario de una dirigida y el autor de una cotización no retirada leen la solicitud y sus versiones. Un prestador solo compatible recibe 404.
- **CA-CIE-04.** En una publicada CERRADA, el autor de una cotización no retirada ve las fotografías solo si el permiso sigue vigente. Un autor retirado sin otro título lee únicamente su cotización.

**Datos personales**
- **CA-DAT-01.** Publicar con un correo, un teléfono o un enlace de mensajería en la descripción devuelve 422 `DATOS_PERSONALES_EN_TEXTO`.
- **CA-DAT-02.** Un borrador con esos datos se guarda con advertencia y falla al publicar.
- **CA-DAT-03.** Un posible documento o dirección solo genera advertencia.
- **CA-DAT-04.** Los textos exentos de la sección de criterios (medidas, cantidades de menos de 9 dígitos, montos con indicador monetario, fechas) no se rechazan ni generan advertencia.
- **CA-DAT-05.** Editar una publicada con un teléfono devuelve 422.
- **CA-DAT-06.** Una dirigida con un teléfono en el texto se guarda y devuelve advertencias, sin bloquear y sin texto que prometa protección.
- **CA-DAT-07.** Ninguna solicitud ni respuesta contiene el teléfono ni el correo de la cuenta del cliente.
- **CA-DAT-08.** Los ejemplos de aceptación, rechazo y advertencia de la sección de criterios producen exactamente el resultado indicado.

**Archivos**
- **CA-ARC-01.** Cargas simultáneas que exceden 5 archivos o 30 MB admiten exactamente lo permitido.
- **CA-ARC-02.** Formato falso o PDF devuelven 422 `IMAGEN_FORMATO_NO_ADMITIDO`, y un archivo de más de 10 MB, 413 `ARCHIVO_DEMASIADO_GRANDE`. También se rechaza una bomba de píxeles. Ningún rechazo deja objetos. Uno válido de exactamente 10 000 000 bytes se acepta.
- **CA-ARC-03.** Quitar un archivo confirmado lo hace inaccesible de inmediato y la versión anterior muestra «archivo retirado».
- **CA-ARC-04.** Sin permiso de compartir, un prestador compatible ve que existen fotografías no compartidas y recibe 404 al pedirlas. Un prestador sin título sobre una dirigida recibe 404 al pedir sus fotografías.
- **CA-ARC-05.** Si falla el guardado del objeto, no queda cupo consumido y se devuelve 503.
- **CA-ARC-06.** Una interrupción tras guardar y antes de confirmar deja la carga caducable y el objeto queda para limpieza.
- **CA-ARC-07.** Al superar las 24 horas, el archivo no confirmado deja de ocupar cupo antes de que cualquier operación evalúe el límite, y no es accesible ni confirmable.
- **CA-ARC-08.** Si el borrado físico inmediato falla, el registro durable permanece y el procedimiento de limpieza lo completa.
- **CA-ARC-09.** El procedimiento de limpieza es idempotente.
- **CA-ARC-10.** El control de detección informa las entradas vencidas y los objetos sin fila.
- **CA-ARC-11.** Ningún documento ni mensaje afirma un borrado físico automático a las 24 horas.
- **CA-ARC-12.** Confirmar con un archivo ajeno o inexistente devuelve 404. Con un archivo cuya carga no terminó, 422 `ARCHIVO_NO_LISTO`. Con uno caducado, 422 `ARCHIVO_EXPIRADO`. Con una lista que supera los límites, 422 `LIMITE_ARCHIVOS`. En todos los casos no se confirma ningún archivo y la solicitud no cambia. Los PREPARADOS no incluidos en una confirmación válida siguen pendientes y solo los ve su dueño.
- **CA-ARC-13.** Ninguna respuesta contiene direcciones públicas o firmadas de archivos, y sin sesión no se obtiene ninguno.

**Privacidad e historial**
- **CA-PRI-01.** Ninguna respuesta incluye teléfono, correo ni datos de contacto de la otra parte, y los recursos ajenos devuelven 404.
- **CA-PRI-02.** Revocar el permiso quita de inmediato las fotografías a todos los prestadores, incluido quien ya cotizó.
- **CA-PRI-03.** Tras revocar, el autor conserva sus permisos sobre su cotización y las versiones de trabajo que le corresponden, y su cotización no queda invalidada.
- **CA-PRI-04.** Volver a compartir restablece el acceso y queda en la bitácora.
- **CA-PRI-05.** Un prestador que pierde compatibilidad no ve la solicitud como oportunidad, y con cotización no retirada puede leer, actualizar o retirar, pero no cotizar de nuevo.
- **CA-PRI-06.** Un prestador sin los títulos de destinatario ni de compatibilidad que retira su cotización pierde el acceso a la solicitud y conserva la lectura de la suya.
- **CA-PRI-07.** El destinatario de una dirigida que retira su cotización conserva el acceso a la solicitud y a sus fotografías.
- **CA-PRI-08.** Un prestador compatible que retira su cotización sigue viendo la publicada ABIERTA y puede enviar una cotización nueva con otra identidad.
- **CA-HIS-01.** Ven las versiones de trabajo el dueño, el destinatario y los autores de cotizaciones no retiradas. Los demás prestadores con acceso solo ven la versión vigente.
- **CA-HIS-02.** La consulta de versiones y de bitácora está paginada. Una cuenta ajena recibe 404.
- **CA-HIS-03.** Un prestador autorizado para las versiones que consulta la bitácora recibe 404. La respuesta de las versiones no contiene actor, cambios de privacidad ni transiciones. El dueño obtiene la bitácora completa.

**Oportunidades y compatibilidad de categorías**
- **CA-OPO-01.** Un prestador sin servicio elegible en la categoría, o sin cobertura del distrito, no ve la publicada.
- **CA-OPO-02.** Un prestador con especialidad pero sin servicio publicado no ve publicadas, pero sí las dirigidas a él.
- **CA-OPO-03.** No ve las propias ni las dirigidas a otros.
- **CA-CMP-01.** Solicitud de categoría A y servicio en la subcategoría A1: compatible.
- **CA-CMP-02.** Solicitud de subcategoría A1 y servicio en A1: compatible.
- **CA-CMP-03.** Solicitud de A1 y servicio solo en la categoría A (padre): no compatible.
- **CA-CMP-04.** Solicitud de A1 y servicio en la subcategoría hermana A2: no compatible.
- **CA-CMP-05.** Servicio de otra categoría B: no compatible.
- **CA-CMP-06.** Servicio pausado, retirado o con clasificación inactiva (propia o del padre): no compatible.
- **CA-CMP-07.** Distrito no cubierto: no compatible en una publicada.
- **CA-CMP-08.** Una dirigida no exige compatibilidad: el destinatario la ve y puede cotizar aunque no tenga servicio compatible ni cobertura.

**Cotizaciones y aclaraciones**
- **CA-COT-01.** Dos envíos simultáneos del mismo prestador: uno gana y el otro recibe 409.
- **CA-COT-02.** Cotizar la propia solicitud devuelve 422.
- **CA-COT-03.** Cotizar con una versión de trabajo anterior devuelve 409.
- **CA-COT-04.** Un cambio relevante tras el envío deja la cotización pendiente de revisión y no aceptable.
- **CA-COT-05.** Una cotización vencida sigue ocupando la posición y se actualiza en vez de reenviarla.
- **CA-COT-06.** Retirar y reenviar crea otra identidad con hilo vacío, y la anterior conserva su historial y aclaraciones.
- **CA-COT-07.** La prioridad de estados se respeta cuando coinciden varios.
- **CA-COT-08.** La comparación identifica estimadas e incompletas y no las suma.
- **CA-COT-09.** Un prestador no compatible que intenta cotizar una publicada, o uno que no es el destinatario que intenta cotizar una dirigida, recibe 404 y no se crea nada.
- **CA-COT-10.** Una actualización conserva las versiones anteriores como reemplazadas. Con una versión esperada desactualizada devuelve 409. El autor y el dueño ven las versiones.
- **CA-COT-11.** El prestador lista sus cotizaciones paginadas y sin ver las de otros. El dueño lista las de su solicitud paginadas y sin ranking de «mejor». Una cuenta ajena recibe 404.
- **CA-COT-12.** Comparar 10 cotizaciones se acepta y comparar 11 devuelve 422 `LIMITE_COMPARACION`.
- **CA-RF17-01.** Una estimada con alcance, vigencia y solo forma de cálculo se acepta, y la comparación muestra «No indicado» en plazo y condiciones.
- **CA-RF17-02.** Una definitiva sin plazo o sin condiciones de pago devuelve 422 `COTIZACION_INCOMPLETA`.
- **CA-RF17-03.** Una estimada sin precio ni forma de cálculo devuelve 422 `COTIZACION_INCOMPLETA`.
- **CA-RF17-04.** La comparación presenta siempre los campos de RF17.
- **CA-ACL-01.** Las aclaraciones sobreviven a una actualización de la cotización.
- **CA-ACL-02.** Un mensaje de más de 1 000 caracteres devuelve 400 `DATOS_INVALIDOS` y el mensaje 21 de un hilo devuelve 422 `LIMITE_ACLARACIONES`.
- **CA-ACL-03.** Tras retirar o cerrar, el hilo queda en lectura.
- **CA-ACL-04.** Una cuenta distinta del dueño de la solicitud y del autor no puede leer ni escribir el hilo y recibe 404.
- **CA-FRO-01.** La 003 no ofrece ninguna operación de selección, aceptación ni contratación y no produce los estados SELECCIONADA, NO_SELECCIONADA, CONTRATADA ni COMPLETADA. Las lecturas para la 004 existen y no modifican datos.

**Avisos y concurrencia**
- **CA-AVI-01.** Ninguna pantalla ni respuesta afirma que un aviso fue enviado, entregado, visto o leído.
- **CA-AVI-02.** Publicar por primera vez una dirigida registra exactamente un aviso REGISTRADO para el destinatario, de forma atómica con la publicación. Repetir la petición con la misma clave, o reintentarla, no lo duplica. Si la publicación falla, no queda aviso.
- **CA-AVI-03.** Publicar una solicitud publicada, guardar o descartar un borrador y cambiar la privacidad no registran avisos.
- **CA-AVI-04.** Un cambio relevante posterior a la versión 1 o el cierre de una ABIERTA registran un aviso por cada prestador interesado, sin duplicados. En una publicada sin cotizaciones no registran ninguno, y quien no cotizó no recibe aviso.
- **CA-CON-01.** Cierre y envío simultáneos se serializan, y si gana el cierre el envío recibe 409.
- **CA-CON-02.** Edición y envío simultáneos: un envío con versión vieja recibe 409, y si entró antes queda pendiente de revisión.
- **CA-CON-03.** Retiro y actualización simultáneos: el segundo recibe 409.
- **CA-CON-04.** Retiro y reenvío simultáneos nunca dejan dos posiciones no retiradas.
- **CA-CON-05.** Una petición idempotente repetida de forma concurrente ejecuta el trabajo una sola vez.
- **CA-CON-06.** Ninguna combinación de operaciones simultáneas entre solicitudes, cotizaciones y avisos queda bloqueada indefinidamente.
- **CA-ERR-01.** Cada conflicto esperado devuelve la respuesta controlada de la tabla de errores.
- **CA-ERR-02.** Un conflicto de acceso simultáneo que persiste tras los reintentos devuelve `CONFLICTO_CONCURRENTE`.
- **CA-ERR-03.** Un fallo inesperado de infraestructura no deja cambios parciales ni expone detalles internos.

**Permisos**
- **CA-SEG-01.** La matriz de PR04 con peticiones sin sesión, cuenta ajena o perfil incorrecto se rechaza al 100 % sin modificar datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301.** Pasan todos los escenarios de aceptación de esta especificación, con evidencia por cada uno. La matriz de PR04 rechaza el 100 % de los intentos no autorizados incluidos, sin divulgar ni modificar datos protegidos.
- **SC-302.** Al menos cuatro de cinco participantes nuevos completan una solicitud de un servicio rápido en 5 minutos o menos, sin ayuda, desde el inicio de la búsqueda hasta la confirmación del envío, excluyendo el registro de cuenta y la espera de respuesta (EQ-06 y PR06).
- **SC-303.** Al menos el 95 % de las consultas de oportunidades y de comparación evaluadas tarda 2 segundos o menos y los errores técnicos son inferiores al 1 %, con la carga documentada en el plan (EQ-01 y PR01).
- **SC-304.** Los recorridos principales de la 003 se completan en celular, tableta y computadora sin errores visuales (EQ-07 y PR07), incluida una verificación manual en un celular real.
- **SC-305.** En las pruebas de carga simultánea de archivos y de envío de cotizaciones, no se supera nunca el cupo ni se crea más de una cotización no retirada por prestador y solicitud.
- **SC-306.** La regla de dependencia entre módulos pasa para los módulos nuevos (PR12).

Estos son criterios de cierre propuestos. Esta especificación no aporta mediciones ni evidencia de ejecución. Lo que no se ejecute al cerrar queda PENDIENTE y no se hereda ninguna excepción de la 002.

## Assumptions

### Documented Decisions and Working Assumptions

- La 001 expone una identidad autenticada con `cuentaId` y perfiles habilitados de cliente o prestador. La 002 expone la elegibilidad de un servicio y la jerarquía de dos niveles de clasificaciones, y conserva las referencias históricas de servicios retirados.
- La compatibilidad usa la misma dirección de coincidencia entre categoría y subcategoría que la búsqueda pública de la 002.
- Las tres inferencias de la revisión de calidad quedaron resueltas por el Product Owner: advertencia de cobertura en toda dirigida (FR-305), bitácora solo para el dueño con historial autorizado definido (FR-331) y registro del aviso de la primera publicación de una dirigida (FR-344).
- Los topes de caracteres de la descripción (2 000) y de las medidas (500), la longitud máxima de un mensaje (1 000), el máximo de 20 mensajes por hilo y de 10 cotizaciones por comparación son parámetros de diseño y no requisitos de RF12 ni RF18. Se revisarán con la carga real.
- No hay un máximo de cotizaciones por solicitud. Los listados se paginan.
- El contrato de la 003 reutiliza las operaciones de `api-rest.md` y añade solo las estrictamente necesarias, que el plan identificará. Los recorridos que debe satisfacer son: consultar las solicitudes propias y su detalle, publicar un borrador, cargar, confirmar y ver archivos autorizados, consultar versiones y bitácora, consultar las cotizaciones propias y su detalle y sus versiones, y las aclaraciones.
- **Decisiones reservadas a la planificación:** el diseño técnico, el almacenamiento, el orden de bloqueos y los mecanismos de atomicidad, el registro de avisos, el procedimiento, la frecuencia y el control de la limpieza física de archivos, las operaciones del contrato y los criterios de carga.

### Dependencies

| Funcionalidad | Dependencia de la 003 |
|---|---|
| 001 · Usuarios y acceso | Identidad, sesión y perfiles habilitados. |
| 002 · Prestadores y catálogo | Elegibilidad de servicios con clasificación efectivamente activa, jerarquía de categorías, distritos admitidos y cobertura de los prestadores. La 002 solo probó la elegibilidad con un doble. La 003 aporta la prueba de integración con escritura real. |
| 004 · Contratación | Consume la lectura de la cotización vigente y la validación de cliente y disponibilidad. Aporta la selección, el retiro de una selección pendiente, la regla de que una seleccionada no se retira y los estados SELECCIONADA, NO_SELECCIONADA y CONTRATADA. |
| 006 · Notificaciones | Entrega, visualización y lectura de los avisos registrados (HU22 y RF35 completos). La 003 solo prepara el registro de los avisos de FR-344. |
| 008 · Contacto y visitas | Contacto y visitas (RF15 y RF16). Fuera de alcance. |
| 009 · Acuerdos y documentos | Posible destino de la propuesta de cambio (E2). |

### Pending Clarifications

No hay aclaraciones funcionales pendientes. La selección del diseño técnico y de las operaciones del contrato corresponde a la etapa de planificación.

### Source References

- [Constitución](../../.specify/memory/constitution.md), [backlog](../../docs/05-gestion/02-backlog-y-sprints.md) y [MVP y evolución](../../docs/05-gestion/06-mvp-y-evolucion.md).
- [Historias de usuario](../../docs/01-analisis-de-sistema/02-historias-de-usuario.md), [requisitos funcionales](../../docs/01-analisis-de-sistema/03-requisitos-funcionales.md) y [restricciones](../../docs/01-analisis-de-sistema/05-restricciones.md).
- [Decisiones arquitectónicas](../../docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md), [escenarios de calidad](../../docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md) y [trazabilidad](../../docs/trazabilidad.md).
- [API REST](../../docs/02-arquitectura-software/api-rest.md), [seguridad y privacidad](../../docs/02-arquitectura-software/seguridad-y-privacidad.md), [modelo de datos](../../docs/03-diseno-de-software/modelo-de-datos.md) y [diseño interno de módulos](../../docs/03-diseno-de-software/diseno-interno/diseno-interno-de-modulos.md).
- [Catálogo de pruebas](../../docs/05-gestion/04-pruebas.md), [especificación 001](../001-usuarios-y-acceso/spec.md) y [especificación 002](../002-prestadores-y-catalogo/spec.md).
- [Contrato interno de elegibilidad de servicios](../../tecnologia/backend/src/modulos/catalogo/api-publica.ts) y [contrato interno de Usuarios y acceso](../../tecnologia/backend/src/modulos/usuarios-acceso/api-publica.ts).
