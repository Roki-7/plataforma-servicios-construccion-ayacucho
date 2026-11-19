# Feature Specification: 002 — Prestadores y catálogo

**Feature Branch**: `002-prestadores-y-catalogo`  
**Created**: 2026-11-18  
**Status**: Aclarada, pendiente de aprobación para planificación  
**Input**: HU03, HU04, HU05 y HU25 del backlog. Alcance: RF06, RF08, RF09, RF10 y RF39.

## Clarifications

### Session 2026-11-18

- Q: ¿Cómo debe concederse, verificarse y revocarse el permiso para gestionar categorías en la 002? → A: Administración e incidencias mantiene un permiso persistente de RF39 por identificador de cuenta. La 001 autentica la sesión y Administración comprueba el permiso vigente en cada operación. Las concesiones y revocaciones se tramitan por un procedimiento interno auditable. Para el alta inicial, el Product Owner designa una cuenta existente y una persona con acceso operativo autorizado registra la concesión.
- Q: ¿Qué transiciones y visibilidad pública deben tener los servicios cuando su titular los pausa o los retira? → A: Un servicio PUBLICADO puede pausarse o retirarse. Un servicio PAUSADO puede volver a PUBLICADO tras validar el perfil habilitado, las categorías activas y las condiciones vigentes, o pasar a RETIRADO. RETIRADO es definitivo y de solo lectura para el titular y los procesos autorizados. Solo la oferta PUBLICADA que cumple las demás condiciones es pública. La pausa y el retiro impiden nuevas solicitudes y conservan las referencias de solicitudes, cotizaciones y contrataciones anteriores.
- Q: ¿Qué efecto debe tener desactivar una categoría o subcategoría sobre los servicios que ya están publicados? → A: La desactivación confirmada oculta los servicios afectados de la oferta pública y bloquea nuevas solicitudes, sin cambiar sus estados ni sus referencias históricas. Una categoría padre inactiva hace inelegibles sus subcategorías aunque estén activas por sí mismas. La reactivación recupera la visibilidad de los servicios PUBLICADOS que cumplen los requisitos vigentes. La operación exige informar el recuento de servicios afectados, confirmar, autorizar, auditar y actualizar la proyección de búsqueda y la caché.
- Q: ¿Cuántos trabajos anteriores y cuántas fotografías por trabajo puede publicar cada prestador en su portafolio? → A: Se permiten 10 trabajos por perfil, 4 fotos por trabajo y 40 por prestador. Se admiten JPG, PNG y WEBP de hasta 10 MB y 4096 píxeles por lado, con validación de formato real, tamaño y dimensiones. El titular puede agregar, reemplazar y eliminar fotos dentro de los límites. Antes de publicarlas se completan las validaciones y se eliminan los metadatos sensibles, incluidas las coordenadas de geolocalización.
- Q: ¿Qué debe mostrar el perfil público mientras las fuentes de calificaciones de la 011 y de verificaciones de la 012 aún no están disponibles? → A: Se muestran avisos independientes, «Calificaciones aún no disponibles» y «Verificaciones aún no disponibles». Cada aviso se retira al disponer de su fuente. «Sin valoraciones» requiere la fuente de la 011 operativa y un prestador sin valoraciones. Un estado de verificación requiere información real publicable de la 012. Los datos declarados permanecen identificados como tales. El filtro por calificación depende de la 011. La 002 determina la elegibilidad de los servicios y la 003 la vuelve a comprobar al crear nuevas solicitudes.

## User Scenarios & Testing *(mandatory)*

Las cuatro historias pertenecen al MVP y conservan prioridad P1. Cada historia se puede verificar con los perfiles, servicios y categorías de prueba que necesite.

### User Story 1 - Presentar el perfil profesional (HU03, Priority: P1)

Como prestador, quiero registrar mi tipo, especialidades, experiencia, zonas de atención, disponibilidad y trabajos anteriores para que los clientes conozcan los servicios que puedo realizar.

**Prueba independiente.** Con una cuenta habilitada como prestador, registrar un perfil profesional y completar el portafolio hasta sus límites. Probar archivos inválidos, publicación sin metadatos sensibles, reemplazo y eliminación. Intentar modificar el portafolio desde otra cuenta.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| CA-PRE-01 | Un prestador autenticado y datos válidos. | Guarda o actualiza su perfil profesional. | Al volver a consultarlo se muestran el tipo, las especialidades, la experiencia, las zonas de atención, la disponibilidad declarada y los trabajos anteriores guardados. |
| CA-PRE-02 | Un prestador con un perfil ya guardado. | Intenta guardar una zona fuera de los cinco distritos admitidos. | Se informa qué zona es inválida y los datos guardados se conservan. |
| CA-PRE-03 | Un visitante, una cuenta solo cliente o un prestador ajeno. | Intenta registrar o modificar un perfil profesional sin autorización, o agregar, reemplazar o eliminar una foto de un portafolio ajeno. | El sistema rechaza cada acción y conserva los datos y las imágenes protegidas. |
| CA-PRE-04 | Un titular con un trabajo que admite más imágenes. | En casos separados, adjunta archivos JPG, PNG y WEBP válidos, incluidos archivos de 10 MB o de 4096 píxeles por lado. También intenta adjuntar un formato real no permitido con extensión de imagen, un archivo de más de 10 MB o una imagen que supera 4096 píxeles en ancho o alto. | Se aceptan los archivos válidos dentro de ambos límites. Cada archivo inválido se rechaza con un mensaje que indica la causa y conserva las imágenes ya vinculadas. |
| CA-PRE-05 | Un portafolio propio con nueve trabajos de cuatro fotos cada uno. | El titular registra un décimo trabajo, agrega cuatro fotos e intenta registrar un undécimo trabajo o agregar una quinta foto. | Se guardan hasta diez trabajos y cuarenta fotos. Se rechaza cada intento de superar un límite, se informa cuál y se conservan los datos guardados. |
| CA-PRE-06 | Un trabajo publicable y una fotografía válida con coordenadas GPS u otros metadatos sensibles de prueba. | El titular agrega la foto y un visitante intenta consultarla antes y después de terminar las validaciones y retirar los metadatos sensibles. | Antes de completar las verificaciones la imagen no es pública. Después, se muestra solo la versión que superó los controles y cuyo archivo público carece de los metadatos sensibles de prueba, incluidas las coordenadas. |
| CA-PRE-07 | Un trabajo propio con cuatro fotos. | El titular reemplaza una foto, primero con un archivo inválido y luego con uno válido. | El rechazo conserva la imagen anterior. El reemplazo válido conserva el recuento en cuatro y la nueva imagen queda disponible para publicación solo después de las validaciones y de eliminar sus metadatos sensibles. |
| CA-PRE-08 | Un trabajo propio con una foto publicada. | El titular elimina la foto y un visitante vuelve a consultar el perfil y accede por el enlace público anterior de la foto. | La foto desaparece del portafolio y ya no se entrega por el acceso público de la plataforma. El trabajo y las demás fotos se conservan y se libera un cupo. |

### User Story 2 - Administrar las publicaciones propias (HU04, Priority: P1)

Como prestador, quiero publicar, editar, pausar y retirar mis servicios para mantener vigente mi oferta de trabajo.

**Prueba independiente.** Con un perfil de prestador y una clasificación activa de prueba, publicar un servicio, pausarlo, reactivarlo y retirarlo. Comprobar la visibilidad, la conservación de referencias y el rechazo de transiciones inválidas o solicitadas por otra cuenta.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| CA-SER-01 | Un prestador autenticado y una clasificación habilitada para nuevas publicaciones. | Publica un servicio válido y después modifica sus datos. | El servicio queda en estado PUBLICADO, asociado al titular, y la consulta muestra los datos guardados. |
| CA-SER-02 | Un servicio propio PUBLICADO o PAUSADO con referencias previas de solicitudes, cotizaciones y contrataciones en datos de prueba. | El titular pausa un servicio PUBLICADO o retira un servicio PUBLICADO o PAUSADO. | Se guarda el estado PAUSADO o RETIRADO según la acción. El servicio queda inelegible para nuevas solicitudes y conserva las referencias previas de los tres tipos. |
| CA-SER-03 | Un servicio y, en casos separados, un visitante, una cuenta autenticada sin titularidad o el titular sin perfil de prestador habilitado. | Intenta editar el servicio o ejecutar cualquiera de las transiciones de estado. | El sistema rechaza cada acción y conserva el estado y los datos del servicio. |
| CA-SER-04 | Una categoría o subcategoría desactivada. | El prestador intenta publicar un servicio nuevo en ella. | El sistema informa que la clasificación no admite nuevas publicaciones y no crea el servicio. |
| CA-SER-05 | Un servicio PAUSADO, una sesión válida del titular con perfil de prestador habilitado, categorías activas y datos conformes a las condiciones vigentes. | El titular edita el servicio pausado y después solicita reactivarlo. | La edición se guarda mientras sigue PAUSADO. La reactivación lo pasa a PUBLICADO tras comprobar las condiciones vigentes. El servicio vuelve a la oferta pública si cumple las demás condiciones de visibilidad. |
| CA-SER-06 | Un servicio PAUSADO con una categoría desactivada o con datos que incumplen una condición vigente de publicación. | El titular solicita reactivarlo. | Se rechaza la reactivación y el servicio sigue PAUSADO. El rechazo por falta de perfil habilitado se prueba en CA-SER-03. |
| CA-SER-07 | Un servicio RETIRADO. | Su titular u otro actor intenta editarlo o cambiar su estado. | El sistema rechaza cada intento. El titular y los procesos autorizados pueden consultarlo como registro histórico de solo lectura. |
| CA-SER-08 | Un servicio previamente visible que pasa a PAUSADO o RETIRADO, con una búsqueda previa ya consultada. | Un visitante repite la búsqueda, consulta el perfil público del prestador o abre un enlace directo al servicio. | El servicio se omite de los resultados y del perfil público. El enlace directo informa que el servicio no está disponible sin exponer el registro privado. |
| CA-SER-09 | Datos de prueba con un servicio PUBLICADO que cumple las condiciones vigentes y, por separado, servicios PAUSADOS, RETIRADOS o PUBLICADOS con una clasificación inactiva por estado propio o por el de su categoría padre. | Se comprueba en la 002 la elegibilidad de cada servicio para recibir nuevas solicitudes. | Solo el servicio PUBLICADO con clasificación efectivamente activa y que cumple las demás condiciones resulta elegible. La comprobación de la 002 no crea una solicitud. |

### User Story 3 - Buscar y consultar la oferta (HU05, Priority: P1)

Como cliente, quiero buscar servicios y prestadores por los criterios disponibles y consultar sus perfiles públicos para encontrar opciones que se ajusten a mi necesidad.

**Prueba independiente.** Con una oferta de prueba que incluya coincidencias y datos privados, buscar sin iniciar sesión, navegar entre páginas y abrir el detalle de un servicio y el perfil público de su prestador.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| CA-BUS-01 | Servicios y prestadores con distintas categorías, especialidades, zonas y disponibilidades declaradas. | Un visitante o una cuenta aplica uno o varios filtros respaldados por datos. | Cada resultado satisface todos los filtros aplicados. Al recorrer las páginas con el mismo conjunto de datos se mantienen esos filtros y se pueden consultar todas las coincidencias. |
| CA-BUS-02 | Una combinación válida de filtros sin coincidencias. | Se ejecuta la búsqueda. | Se informa que no hay coincidencias y se pueden ajustar los criterios. |
| CA-BUS-03 | Un servicio visible y un prestador con perfil profesional y datos privados de cuenta. | Se consulta el detalle del servicio y el perfil público. | Se muestran el servicio, la experiencia, los trabajos anteriores publicables y la disponibilidad identificada como declarada, sin prometer una reserva. La vista pública omite correo, documento, dirección exacta, credenciales y archivos privados. |
| CA-BUS-04 | La fuente de calificaciones de la 011 aún no está disponible. | Un visitante realiza una búsqueda o consulta el perfil público. | La búsqueda base sigue disponible y la 002 omite el filtro por calificación. El perfil muestra «Calificaciones aún no disponibles» y omite el mensaje «Sin valoraciones», las puntuaciones y las estrellas sin respaldo. |
| CA-BUS-05 | La fuente de verificaciones de la 012 aún no está disponible. | Un visitante consulta el perfil público. | El perfil muestra «Verificaciones aún no disponibles». Los datos aportados por el prestador siguen identificados como declarados y no aparecen estados ni insignias de verificación sin respaldo. |
| CA-BUS-06 | La fuente de datos del catálogo está disponible y su caché de lectura está vacía o falla. | Se consultan categorías activas o se repite una búsqueda válida. | Se obtienen los resultados de la fuente de verdad y se mantienen los filtros y la paginación. |
| CA-BUS-07 | Datos de prueba simulan los cuatro casos de disponibilidad independiente de las dos fuentes. La fuente de calificaciones disponible indica que aún no hay valoraciones. La de verificaciones disponible aporta un estado de evaluación autorizado para publicación en el caso de prueba. | Un visitante consulta el perfil público en cada caso. | Con ambas fuentes ausentes aparecen los dos avisos. Si se habilita solo una, se retira únicamente su aviso. Si se habilitan ambas, desaparecen los dos. «Sin valoraciones» aparece únicamente cuando la fuente de calificaciones está disponible y el prestador aún no tiene valoraciones. El estado de verificación se muestra solo cuando lo respalda la fuente disponible. Los datos declarados conservan su distinción. |
| CA-BUS-08 | Un prestador tiene datos públicos declarados, correo, documento, dirección exacta, teléfono sin autorización de publicación y documentos privados. En datos de prueba cambian las condiciones de disponibilidad de 011 y 012. | Un visitante busca al prestador, consulta su perfil o el detalle del servicio e intenta acceder a un documento privado. | Las consultas públicas muestran los datos de oferta autorizados y los avisos o estados aplicables. Omiten los datos personales privados y sus referencias. El documento privado no se entrega al visitante. |

### User Story 4 - Gestionar categorías y subcategorías (HU25, Priority: P1)

Como administrador, quiero crear, actualizar, activar y desactivar categorías y subcategorías para mantener organizada la oferta de construcción civil.

**Prueba independiente.** Con cuentas y clasificaciones de prueba, verificar el permiso de gestión y su revocación con la sesión abierta. Con servicios en los tres estados y búsquedas consultadas previamente, comprobar el recuento, confirmar la desactivación y verificar las consecuencias al desactivar y reactivar una clasificación.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| CA-CAT-01 | Un operador con permiso administrativo. | Crea y actualiza una categoría y una subcategoría, y activa una clasificación inactiva. | Los cambios quedan guardados sin modificar código y las clasificaciones activas aparecen en la consulta pública de categorías. |
| CA-CAT-02 | Una categoría o subcategoría activa con un servicio PUBLICADO y referencias previas de solicitudes, cotizaciones y contrataciones. | Un operador autorizado ve el recuento y confirma la desactivación. | La clasificación y el servicio se excluyen de las opciones y resultados públicos respectivos. El servicio queda fuera de los listados del perfil y del detalle público y es inelegible para nuevas solicitudes. Conserva su estado PUBLICADO, su registro y las referencias de solicitudes, cotizaciones, contrataciones y demás relaciones previas. |
| CA-CAT-03 | Un visitante, una cuenta con sesión vigente sin el permiso específico o una cuenta cuya revocación se registró después de consultar el recuento y cuya sesión sigue abierta. | Intenta crear, actualizar o activar una clasificación, o consultar el recuento o confirmar una desactivación. | El sistema rechaza cada operación, conserva el catálogo y no entrega el recuento en una nueva consulta sin permiso. |
| CA-CAT-04 | Una categoría activa visible en una consulta anterior. | Se desactiva y un prestador intenta publicar un servicio o reactivar uno PAUSADO usando esa información anterior. | Se comprueba el estado vigente de la clasificación y se rechazan ambas acciones. |
| CA-CAT-05 | Una instalación sin permisos administrativos concedidos, una cuenta existente designada por el Product Owner y otra cuenta autenticada. | Una persona con acceso operativo autorizado tramita el alta inicial. La otra cuenta intenta concederse el permiso o utilizar el canal de categorías. | Solo la cuenta designada recibe el permiso. La otra cuenta conserva sus permisos previos y su intento queda rechazado. |
| CA-CAT-06 | Una persona autorizada para tramitar permisos y un operador de categorías habilitado. | La primera concede o revoca el permiso, o el segundo crea, actualiza, activa o desactiva una clasificación. | Cada acción realizada deja un registro de auditoría con responsable, fecha, acción, recurso afectado y motivo. |
| CA-CAT-07 | Una categoría activa con un servicio PUBLICADO visible directamente asociado, otro visible asociado a una subcategoría activa y un tercer servicio PAUSADO. | El operador inicia la desactivación y luego la cancela o intenta aplicarla sin confirmarla. | Antes del cambio se muestra un recuento de dos servicios que perderían visibilidad o elegibilidad. La clasificación, los servicios y sus referencias se conservan mientras falte una confirmación explícita del operador. |
| CA-CAT-08 | Una categoría padre activa con subcategorías de estado propio activo e inactivo, y servicios asociados en datos de prueba. | El operador confirma la desactivación del padre. | Ninguna subcategoría queda disponible para nuevas publicaciones ni reactivaciones. Los servicios asociados quedan fuera de la oferta pública y de nuevas solicitudes. Se conservan los estados propios de las subcategorías y los servicios. |
| CA-CAT-09 | Una categoría padre inactiva con una subcategoría de estado propio activo y otra inactiva, con servicios PUBLICADOS, PAUSADOS y RETIRADOS y una búsqueda ya guardada en caché. | Un operador autorizado reactiva la categoría padre y se repiten las consultas públicas. | Recuperan visibilidad y elegibilidad únicamente los servicios PUBLICADOS cuya clasificación efectiva esté activa y que cumplan las demás condiciones vigentes. La subcategoría con estado propio inactivo sigue indisponible. Los servicios PAUSADOS y RETIRADOS conservan sus estados y su exclusión. |
| CA-CAT-10 | Una búsqueda frecuente y la lista de categorías ya guardadas en Redis, con servicios de la clasificación en la proyección de búsqueda. | Se confirma la desactivación y se repiten la búsqueda y las consultas de catálogo y detalle. Se repite el ensayo con Redis caído al desactivar y recuperado después. | Desde la confirmación exitosa, ninguna consulta publica la clasificación como activa ni devuelve los servicios afectados. La proyección y la caché reflejan el cambio. Durante la caída se obtienen resultados correctos desde PostgreSQL y la recuperación no vuelve a exponer resultados anteriores. |

### Edge Cases

- Una cuenta con perfiles de cliente y prestador puede buscar como cualquiera de los dos y gestionar únicamente la oferta de la que es titular.
- Un distrito fuera de la cobertura se rechaza como valor inválido. Una combinación válida sin coincidencias produce un resultado vacío.
- Una subcategoría de estado propio activo bajo un padre inactivo es inelegible. Su estado propio se conserva y vuelve a contar cuando el padre se reactiva.
- El rechazo de una fotografía, incluida una carga de reemplazo, conserva el trabajo anterior y sus imágenes existentes.
- Una sesión ausente, vencida o sin el permiso requerido no da acceso a operaciones de escritura.

## Requirements *(mandatory)*

### Functional Requirements

| RF | Requisito de la 002 | Criterios verificables |
|---|---|---|
| RF06 | El prestador debe poder registrar y actualizar su perfil profesional propio, con tipo, especialidades, experiencia, zonas de atención, disponibilidad declarada y hasta diez trabajos anteriores. El titular puede agregar, reemplazar y eliminar fotos, con hasta cuatro por trabajo y cuarenta por prestador. El sistema debe validar formato real, tamaño y dimensiones, informar los rechazos y eliminar los metadatos sensibles antes de publicar una fotografía. | CA-PRE-01 a CA-PRE-08 |
| RF08 | Solo el titular con perfil de prestador habilitado debe poder publicar y editar su servicio en los estados permitidos y ejecutar las transiciones del ciclo de publicación. La publicación inicial y la reactivación requieren una clasificación activa y el cumplimiento de las condiciones vigentes. La 002 debe comprobar la elegibilidad vigente para nuevas solicitudes. PAUSADO, RETIRADO y los servicios con una clasificación efectivamente inactiva quedan fuera de la oferta pública y son inelegibles. RETIRADO es definitivo y de solo lectura para el titular y los procesos autorizados. Se conservan las referencias de solicitudes, cotizaciones y contrataciones previas. | CA-SER-01 a CA-SER-09, CA-CAT-02, CA-CAT-04, CA-CAT-08, CA-CAT-09 |
| RF09 | Cualquier persona debe poder buscar servicios y prestadores por especialidad, zona y disponibilidad declarada, con filtro por categoría, resultados paginados y estado sin coincidencias. La 002 ofrece la búsqueda base. El filtro por calificación y la identificación de prestadores sin valoraciones reales dependen de RF34 en la 011. | CA-BUS-01, CA-BUS-02, CA-BUS-04, CA-BUS-06 a CA-BUS-08, CA-CAT-02, CA-CAT-09, CA-CAT-10 |
| RF10 | Cualquier persona debe poder consultar el detalle del servicio visible y el perfil público del prestador. El perfil debe distinguir los datos declarados de los revisados, omitir los datos privados y mostrar un aviso independiente para cada fuente de calificaciones o verificaciones pendiente. Las valoraciones y estados de verificación requieren información real autorizada para publicación. | CA-BUS-03 a CA-BUS-05, CA-BUS-07, CA-BUS-08, CA-PRE-06, CA-PRE-08, CA-SER-08, CA-CAT-02, CA-CAT-09, CA-CAT-10 |
| RF39 | Un operador con permiso vigente debe poder crear, actualizar, activar y desactivar categorías y subcategorías por un canal interno autenticado, sin modificar el código. Administración e incidencias debe comprobar el permiso en cada operación y auditar sus concesiones, revocaciones y las modificaciones de clasificaciones. Antes de desactivar, se debe informar el recuento de servicios afectados y obtener confirmación. Una clasificación inactiva se excluye de la oferta del catálogo e impide nuevas publicaciones, reactivaciones y solicitudes de los servicios afectados. Esos servicios se ocultan de la oferta pública y se conservan sus estados, registros y referencias históricas. La actividad efectiva de una subcategoría depende de su propia actividad y la de su categoría padre. Las consultas y la caché deben reflejar los cambios. | CA-CAT-01 a CA-CAT-10, CA-SER-04, CA-SER-06 |

### Key Entities *(include if feature involves data)*

- **Perfil profesional.** Presentación de una cuenta habilitada como prestador. Incluye tipo de prestador, especialidades, experiencia, zonas y disponibilidad declarada.
- **Trabajo anterior.** Registro de un trabajo previo en el portafolio del prestador, con hasta cuatro fotografías asociadas.
- **Fotografía del portafolio.** Imagen de un trabajo anterior que el titular puede agregar, reemplazar o eliminar. Su acceso público requiere superar las validaciones y retirar sus metadatos sensibles.
- **Servicio.** Publicación perteneciente a un prestador y vinculada a una clasificación del catálogo. Su estado es PUBLICADO, PAUSADO o RETIRADO y controla la visibilidad pública y la elegibilidad para nuevas solicitudes.
- **Categoría y subcategoría.** Clasificaciones que conservan su estado propio y sus referencias históricas. Una subcategoría es efectivamente activa cuando están activas tanto ella como su categoría padre.
- **Distrito de atención.** Zona admitida para el perfil profesional y para filtrar la oferta.

### Business Rules

- **Cobertura.** Los distritos admitidos son Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray (RC02, RC03 y constitución).
- **Disponibilidad.** La disponibilidad es una declaración del prestador. La consulta de la oferta no reserva horarios.
- **Acceso.** Las escrituras requieren identidad y permiso vigentes. La gestión del perfil profesional y de los servicios requiere titularidad. La gestión de categorías requiere autorización administrativa expresa.
- **Permiso de categorías.** Administración e incidencias es propietario del permiso persistente y lo verifica por identificador de cuenta en cada operación de RF39. Los perfiles cliente y prestador carecen por sí mismos de este permiso. Si la sesión o el permiso vigente no pueden comprobarse, se rechaza la operación. Tras surtir efecto la revocación, se bloquea toda operación nueva aunque la sesión siga abierta.
- **Alta inicial y gestión de permisos.** El Product Owner designa expresamente la cuenta existente que recibirá el primer permiso. Una persona con acceso operativo autorizado verifica la designación y registra la concesión para el identificador de cuenta validado por la 001. Hasta entonces se rechazan las operaciones administrativas de categorías. Las altas posteriores y las revocaciones usan el mismo procedimiento interno seguro. La autorización operativa es independiente del permiso de gestión de categorías y queda fuera del registro público y del autoservicio.
- **Auditoría.** Cada concesión, revocación y modificación de categorías o subcategorías registra responsable, fecha, acción, recurso afectado y motivo conforme a la constitución. El panel administrativo completo y el resto del alcance de RF45 corresponden a la 012.
- **Ciclo del servicio.** La publicación inicial crea el servicio en PUBLICADO. El titular con perfil de prestador habilitado puede editarlo en PUBLICADO o PAUSADO. Las transiciones permitidas son PUBLICADO → PAUSADO, PUBLICADO → RETIRADO, PAUSADO → PUBLICADO y PAUSADO → RETIRADO. Para PAUSADO → PUBLICADO se comprueban nuevamente el perfil de prestador habilitado, el estado activo de las categorías aplicables y las condiciones de publicación vigentes. RETIRADO es terminal y queda en solo lectura para su titular y los procesos autorizados.
- **Visibilidad y solicitudes.** Solo un servicio PUBLICADO con clasificación efectivamente activa y que cumpla las demás condiciones vigentes puede aparecer en búsquedas, listados del perfil y detalles públicos. PAUSADO, RETIRADO y cualquier servicio con clasificación efectivamente inactiva son inelegibles para nuevas solicitudes. La 002 conserva las referencias de solicitudes, cotizaciones y contrataciones previas y las demás relaciones existentes para los procesos autorizados.
- **Desactivación de clasificaciones.** Antes de cambiar el estado, el operador autorizado recibe el recuento de servicios que perderían visibilidad o elegibilidad, incluidos los afectados a través de las subcategorías, y debe confirmar la operación. La desactivación impide nuevas publicaciones y reactivaciones bajo la clasificación afectada. Mantiene los registros, sus referencias históricas y el estado propio de cada subcategoría y servicio.
- **Reactivación de clasificaciones.** Una subcategoría solo está disponible si su estado propio y el de su categoría padre son activos. Al reactivar la clasificación, recuperan visibilidad y elegibilidad los servicios PUBLICADOS que vuelvan a cumplir todas las condiciones vigentes. Los servicios PAUSADOS y RETIRADOS conservan sus estados. Desde que se confirma con éxito una desactivación, la proyección de búsqueda y la caché deben reflejar el cambio en las consultas públicas.
- **Límites del portafolio.** Hasta diez trabajos por prestador, cuatro fotos por trabajo y cuarenta fotos por prestador. El reemplazo conserva el número de fotos si se completa. Eliminar una foto libera un cupo.
- **Validación de imágenes.** El formato real debe ser JPG, PNG o WEBP. El tamaño máximo es 10 MB por archivo y el ancho y el alto no pueden superar 4096 píxeles cada uno. Un rechazo identifica el motivo y conserva la imagen existente cuando se trataba de un reemplazo.
- **Publicación y privacidad de imágenes.** Solo se muestran fotos asociadas a trabajos publicables que hayan superado las validaciones de seguridad. Antes de la publicación se eliminan sus metadatos sensibles, incluidas las coordenadas de geolocalización. Al eliminar una foto, el perfil público y su enlace anterior en la plataforma dejan de entregarla.
- **Avisos del perfil público.** Se muestra «Calificaciones aún no disponibles» mientras falte la fuente de la 011 y «Verificaciones aún no disponibles» mientras falte la fuente de la 012. Cada aviso se retira de forma independiente al habilitar su fuente. «Sin valoraciones» se reserva para un prestador sin valoraciones cuando la 011 está operativa. Un estado o distintivo de verificación requiere una evaluación de la 012 con resultado autorizado para publicación. Toda calificación, estrella o insignia de verificación mostrada requiere respaldo real. La información declarada se identifica como tal.
- **Privacidad.** Las consultas públicas conservan la separación entre datos de oferta, datos de cuenta y documentos privados. El acceso público no expone el correo, el documento de identidad, la dirección exacta, un teléfono sin autorización de publicación, las credenciales ni los documentos privados. El contacto requiere autorización del titular y su flujo corresponde a la funcionalidad 008.

### Permissions

| Operación | Visitante | Cuenta solo cliente | Prestador titular | Prestador ajeno | Operador autorizado para categorías | Responsable operativo autorizado para permisos |
|---|---|---|---|---|---|---|
| Buscar oferta y consultar categorías, servicios y perfiles con datos autorizados para publicación | Sí | Sí | Sí | Sí | Sí | Sí |
| Registrar o modificar el perfil profesional y su portafolio, incluidas las altas, los reemplazos y las eliminaciones de fotos | No | No | Sí, propio | No | No por ese permiso | No por esa autorización |
| Publicar, editar o cambiar el estado de un servicio | No | No | Sí, propio y según su estado | No | No por ese permiso | No por esa autorización |
| Consultar un servicio PAUSADO o RETIRADO fuera de la oferta pública | No | No | Sí, propio | No | No por ese permiso | No por esa autorización |
| Crear, actualizar o activar categorías y subcategorías | No | No por su perfil | No por su perfil | No por su perfil | Sí, con permiso vigente | No por esa autorización |
| Consultar el recuento de servicios afectados y confirmar la desactivación de una clasificación | No | No por su perfil | No por su perfil | No por su perfil | Sí, con permiso vigente en ambas acciones | No por esa autorización |
| Conceder o revocar el permiso de categorías | No | No por su perfil | No por su perfil | No por su perfil | No por ese permiso | Sí, mediante el procedimiento interno |

La matriz evalúa cada permiso por separado. Una cuenta con ambos perfiles conserva las facultades del prestador sobre sus recursos propios. Los rechazos deben impedir cambios y evitar divulgar recursos privados. Los procesos autorizados pueden consultar un servicio retirado como registro histórico según su participación y los límites entre módulos.

### Traceability

| HU → RF | AC / EQ | DA → ADR | Módulo responsable o participante | Pruebas previstas |
|---|---|---|---|---|
| HU03 → RF06 | AC04 / EQ-04 | DA03, DA11 → ADR-006, ADR-011 | Prestadores, con identidad de Usuarios y acceso | CA-PRE-01 a CA-PRE-08, PR04 |
| HU04 → RF08 | AC05 / EQ-05, AC04 / EQ-04 | DA08, DA03 → ADR-002, ADR-006 | Catálogo y búsqueda, con identidad de Usuarios y acceso | CA-SER-01 a CA-SER-09, CA-CAT-02, CA-CAT-04, CA-CAT-08, CA-CAT-09, PR04, referencia de arquitectura PR12 |
| HU05 → RF09, RF10 | AC01 / EQ-01, AC03 / EQ-03, AC04 / EQ-04 | DA01, DA02, DA03 → ADR-010, ADR-006, ADR-011 | Catálogo y búsqueda y Prestadores. Calificaciones y Administración e incidencias son fuentes posteriores. | CA-BUS-01 a CA-BUS-08, CA-PRE-06, CA-PRE-08, CA-SER-08, CA-CAT-02, CA-CAT-09, CA-CAT-10, PR01, PR03 y PR04 |
| HU25 → RF39 | AC05 / EQ-05, AC04 / EQ-04, AC01 / EQ-01 | DA08, DA03, DA02 → ADR-001, ADR-002, ADR-006, ADR-010 | Administración e incidencias autoriza y audita. Catálogo y búsqueda gestiona sus clasificaciones y la visibilidad de la oferta. Usuarios y acceso autentica. | CA-CAT-01 a CA-CAT-10, PR04, referencia de arquitectura PR12 |
| HU03, HU04, HU05, HU25 → RF06, RF08–RF10, RF39 | AC07 / EQ-07 | DA10 → ADR-004 | Recorridos web de Prestadores y Catálogo y búsqueda, incluida la consulta pública de categorías | PR07 |

La tabla corresponde a la funcionalidad **002**. PR12 se conserva como referencia de arquitectura de HU04 y HU25 según la trazabilidad general. El catálogo de pruebas lo registra para la 001. La verificación de límites de módulos de la 002 sigue siendo obligatoria por la constitución. EQ-05 conserva su vínculo con mantenibilidad y su ensayo de sustitución de IA corresponde a la 007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-01.** Pasan todos los escenarios funcionales de la 002, con evidencia por cada criterio CA. La matriz de EQ-04/PR04 rechaza el 100 % de los intentos no autorizados incluidos, sin divulgar ni modificar datos protegidos.
- **SC-02.** En la prueba EQ-01/PR01, al menos el 95 % de las respuestas de búsqueda y consulta evaluadas tarda 2 segundos o menos y los errores técnicos son inferiores al 1 %. Se usa la carga documentada de 50 usuarios concurrentes durante 15 minutos y el conjunto de referencia de EQ-01. La 002 evalúa las operaciones de búsqueda y consulta disponibles en su alcance.
- **SC-03.** En EQ-03/PR03, la configuración inicial atiende a 25 usuarios concurrentes y la ampliada a 50 con los umbrales de SC-02. Se comparan también ambas configuraciones a 50 usuarios, durante 15 minutos por configuración y carga. La configuración ampliada duplica la CPU y la memoria del backend y mantiene recursos de datos equivalentes. El ensayo de dos réplicas de PR03 debe documentar cómo cumple esa comparación. Si el entorno no permite realizarla, se registra como pendiente.
- **SC-04.** Se completan los recorridos web principales en celular, tableta y computadora según EQ-07/PR07.

Estos son criterios de cierre propuestos para verificación. Este borrador no aporta mediciones de EQ-01 ni EQ-03 ni evidencia de ejecución de los escenarios.

## Assumptions

### Documented Decisions and Working Assumptions

- El contrato interno vigente de Usuarios y acceso expone `UsuariosAcceso.exigir(token)` para obtener una identidad autenticada con `cuentaId`, `sesionId` y perfiles habilitados de cliente o prestador. La operación comprueba que la sesión siga vigente (ADR-006). Administración e incidencias usa `cuentaId` para comprobar su permiso propio y solicita las modificaciones mediante la API interna de Catálogo y búsqueda, propietario de servicios y categorías. Prestadores conserva el perfil profesional. Esta integración preserva las tablas y los contratos de la 001 y se mantiene dentro de los diez módulos arquitectónicos existentes y de la entrega 002 de las doce funcionalidades Spec Kit (ADR-001 y ADR-002).
- Por el principio X, la 002 debe usar Redis como caché de categorías y búsquedas frecuentes. PostgreSQL es la fuente de verdad y el respaldo cuando Redis no responde. Los permisos y la elegibilidad para publicar, reactivar o recibir nuevas solicitudes se comprueban con el estado vigente. La medición de EQ-01 sirve para evaluar y ajustar la caché. La redacción general sobre activación condicionada a esa medición queda identificada para revisión documental posterior (ADR-010 y ADR-013).
- El contrato REST de la 002 se detallará en la fase correspondiente conforme a ADR-003 y al principio VII. Queda pendiente definir cómo incorporar las nuevas operaciones al contrato efectivo, conservando las garantías de la 001.

- El plan de la 002 definirá el almacenamiento, la optimización y la limpieza segura de las fotos eliminadas conforme a ADR-011. El diseño debe preservar el acceso y la integridad de los recursos privados de la 001.

### Dependencies

| Funcionalidad | Dependencia de la 002 |
|---|---|
| 001 · Usuarios y acceso | Proporciona identidad autenticada y perfiles habilitados con su contrato interno existente. Administración e incidencias conserva y verifica el permiso de RF39 en la 002. |
| 003 · Solicitudes y cotizaciones, y 004 · Contratación | La 002 verifica la elegibilidad del servicio en CA-SER-09 y conserva las referencias históricas. La 003 debe volver a comprobar la elegibilidad vigente al crear una solicitud, incluida la actividad efectiva de la clasificación. Su prueba de integración debe comprobar que se rechaza el alta sin guardar una solicitud para un servicio inelegible, aunque se hubiera consultado previamente como elegible. La 003 gestiona las solicitudes y cotizaciones y la 004, las contrataciones y sus referencias históricas. |
| 007 · Búsqueda asistida por IA y 008 · Contacto y visitas | La 002 entrega búsqueda por filtros y consulta de la oferta. La interpretación asistida, el contacto y las visitas siguen su alcance en el backlog. |
| 011 · Cancelación, calificación e historial | RF34 aporta la fuente real para las valoraciones y «Sin valoraciones» y es la dependencia del filtro por calificación. La 002 ofrece la búsqueda base y el aviso «Calificaciones aún no disponibles». |
| 012 · Verificación y administración | RF07 y RF41 aportan los estados de verificación para RF10. La 002 muestra «Verificaciones aún no disponibles» en ausencia de esa fuente. Las demás funciones administrativas, incluido el alcance completo de RF45, siguen el backlog de la 012. RF39 permanece en la 002. |

### Pending Clarifications

Las cinco preguntas y las decisiones aprobadas constan en [Clarifications](#clarifications). La selección del diseño técnico y la evidencia de ejecución corresponden a etapas posteriores.

### Source References

- [Constitución](../../.specify/memory/constitution.md), [backlog](../../docs/05-gestion/02-backlog-y-sprints.md) y [MVP y evolución](../../docs/05-gestion/06-mvp-y-evolucion.md).
- [Historias de usuario](../../docs/01-analisis-de-sistema/02-historias-de-usuario.md), [requisitos funcionales](../../docs/01-analisis-de-sistema/03-requisitos-funcionales.md) y [restricciones](../../docs/01-analisis-de-sistema/05-restricciones.md).
- [Decisiones arquitectónicas](../../docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md), [escenarios de calidad](../../docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md) y [trazabilidad](../../docs/trazabilidad.md).
- [Componentes C4](../../docs/04-modelo-c4/03-nivel3-componentes.md), [modelo de datos](../../docs/03-diseno-de-software/modelo-de-datos.md) y [API REST](../../docs/02-arquitectura-software/api-rest.md).
- [Contrato interno de Usuarios y acceso](../../tecnologia/backend/src/modulos/usuarios-acceso/api-publica.ts) y [OpenAPI de la 001](../001-usuarios-y-acceso/contracts/openapi.json).
- [Seguridad y privacidad](../../docs/02-arquitectura-software/seguridad-y-privacidad.md), [estrategia de caché](../../docs/02-arquitectura-software/estrategia-de-cache.md) y [catálogo de pruebas](../../docs/05-gestion/04-pruebas.md).
