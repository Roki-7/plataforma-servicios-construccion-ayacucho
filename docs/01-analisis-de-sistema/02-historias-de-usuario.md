# Historias de usuario

Las historias de usuario describen lo que necesitan realizar las personas que utilizarán la plataforma y el beneficio que esperan obtener.

Se utiliza la estructura:

**Como [actor], quiero [acción], para [beneficio].**

## 1. Registro y perfiles

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU01 | Como cliente o prestador de servicios, quiero registrarme, iniciar sesión y recuperar el acceso a mi cuenta, para utilizar las funciones que me corresponden. | Debe (MVP) |
| HU02 | Como cliente o prestador de servicios, quiero consultar y actualizar mi perfil, para mantener mis datos y medios de contacto al día. | Debe (MVP) |
| HU03 | Como prestador de servicios, quiero presentar mis especialidades, experiencia, zonas de atención, disponibilidad y trabajos anteriores, para que los clientes conozcan los servicios que puedo realizar. | Debe (MVP) |

## 2. Publicación y búsqueda de servicios

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU04 | Como prestador de servicios, quiero publicar, actualizar y pausar los servicios que ofrezco, para mantener vigente mi oferta de trabajo. | Debe (MVP) |
| HU05 | Como cliente, quiero buscar servicios y consultar prestadores por especialidad, zona, disponibilidad y calificaciones, para encontrar opciones que se ajusten a mi necesidad. | Debe (MVP) |
| HU06 | Como cliente, quiero describir lo que necesito con mis propias palabras y recibir ayuda para orientar la búsqueda, para encontrar el servicio adecuado aunque no conozca su nombre técnico. | Debería |

## 3. Solicitudes y cotizaciones

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU07 | Como cliente, quiero registrar una solicitud con la información del trabajo y enviarla a un prestador o publicarla para recibir propuestas, para encontrar a alguien que pueda atenderla. | Debe (MVP) |
| HU08 | Como prestador de servicios, quiero consultar solicitudes relacionadas con mis especialidades y zonas de atención, para identificar trabajos a los que puedo presentar una propuesta. | Debe (MVP) |
| HU09 | Como cliente o prestador de servicios, quiero comunicarme y coordinar una visita cuando sea necesaria, conociendo previamente si tiene costo, para aclarar las condiciones del trabajo. | Debería |
| HU10 | Como prestador de servicios, quiero preparar una cotización con el alcance, materiales, precio, plazo y condiciones de pago, para presentar una propuesta clara al cliente. | Debe (MVP) |
| HU11 | Como cliente, quiero revisar las cotizaciones recibidas, comparar sus condiciones y solicitar aclaraciones, para elegir una propuesta con información suficiente. | Debe (MVP) |

## 4. Contratación y acuerdos

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU12 | Como cliente, quiero aceptar una propuesta con las condiciones y disponibilidad confirmadas por el prestador, para dejar registrada la contratación. | Debe (MVP) |
| HU13 | Como prestador de servicios, quiero conocer el resultado de mis propuestas, para organizar mi disponibilidad y atender otras oportunidades de trabajo. | Debe (MVP) |
| HU14 | Como cliente o prestador de servicios, quiero revisar, aceptar y descargar las condiciones acordadas, con un documento más detallado cuando el trabajo lo requiera, para conservar una referencia común de la contratación. | Debería |
| HU15 | Como cliente o prestador de servicios, quiero proponer y responder cambios de alcance, precio o plazo, conservando los acuerdos anteriores, para mantener actualizadas las condiciones aceptadas. | Podría |

## 5. Seguimiento y cierre del trabajo

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU16 | Como cliente o prestador de servicios, quiero registrar o consultar el estado, los avances y las entregas del trabajo según mi participación, para conocer lo realizado y lo pendiente. | Debería |
| HU17 | Como cliente o prestador de servicios, quiero registrar los pagos directos y confirmar su recepción según mi participación, para mantener un control de los importes entregados y recibidos. | Debería |
| HU18 | Como prestador de servicios, quiero comunicar la finalización y atender las observaciones del cliente, para completar la entrega del trabajo. | Debe (MVP) |
| HU19 | Como cliente, quiero revisar el trabajo y confirmar mi conformidad o registrar observaciones, para dejar claro si puede darse por finalizado. | Debe (MVP) |
| HU20 | Como cliente o prestador de servicios, quiero solicitar y consultar una cancelación con su motivo y condiciones, para dejar registrado qué ocurre cuando el trabajo no puede continuar. | Debería |
| HU21 | Como cliente, quiero calificar y comentar una contratación finalizada y confirmada, para compartir mi experiencia y ayudar a otros clientes a elegir. | Debería |

## 6. Avisos, historial e incidencias

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU22 | Como cliente o prestador de servicios, quiero recibir avisos sobre mis solicitudes, propuestas y contrataciones, para responder a los cambios que requieren mi atención. | Debe (MVP) |
| HU23 | Como cliente o prestador de servicios, quiero consultar mi historial de solicitudes, cotizaciones, acuerdos y trabajos, para revisar mis operaciones anteriores. | Debería |
| HU24 | Como cliente o prestador de servicios, quiero reportar problemas y consultar su estado de atención, para dar seguimiento a una situación que necesita revisión. | Podría |

## 7. Administración

| ID | Historia de usuario | Prioridad |
|---|---|---|
| HU25 | Como administrador, quiero gestionar categorías y subcategorías, para mantener organizados los servicios de construcción civil. | Debe (MVP) |
| HU26 | Como administrador, quiero revisar cuentas, información de prestadores y publicaciones, para aplicar las reglas de acceso, verificación y contenido de la plataforma. | Podría |
| HU27 | Como administrador, quiero revisar incidencias y registrar las acciones realizadas, para dar seguimiento a los problemas comunicados por los usuarios. | Podría |
| HU28 | Como administrador, quiero consultar reportes de usuarios, servicios, solicitudes y contrataciones, para conocer la actividad de la plataforma. | Podría |

## 8. Consideraciones del alcance

- El prestador puede ser un trabajador de oficio, técnico, profesional o empresa de construcción civil.
- Los servicios rápidos tendrán un proceso breve. Los trabajos grandes podrán incluir visitas, documentos y seguimiento por etapas.
- El cliente y el prestador podrán coordinar por teléfono o WhatsApp. Las condiciones aceptadas deberán registrarse dentro de la plataforma para formar parte del acuerdo.
- Registrar un pago directo no significa que la plataforma haya procesado o verificado automáticamente el dinero.
- Los servicios externos de IA, notificaciones y mapas apoyan las necesidades descritas; no sustituyen las decisiones del cliente ni la evaluación técnica del prestador.
- El cobro por los servicios de la plataforma y la integración de pagos se consideran ampliaciones futuras.
- Estas historias representan el alcance previsto del proyecto. Su implementación se organizará en entregas según la prioridad indicada en cada tabla.
## 9. Priorización

Las historias se priorizan con el método MoSCoW. La primera entrega (MVP) debe permitir completar de principio a fin un servicio rápido: buscar, solicitar, cotizar, contratar y cerrar el trabajo.

| Prioridad | Criterio | Historias |
|---|---|---|
| Debe (MVP) | Sin ellas no se completa el recorrido principal ni se protege la contratación. | HU01, HU02, HU03, HU04, HU05, HU07, HU08, HU10, HU11, HU12, HU13, HU18, HU19, HU22, HU25 |
| Debería | Mejoran la experiencia o atienden trabajos de mayor tamaño; se incorporan en la segunda entrega. | HU06, HU09, HU14, HU16, HU17, HU20, HU21, HU23 |
| Podría | Agregan control o gestión adicional cuando el uso de la plataforma lo justifique. | HU15, HU24, HU26, HU27, HU28 |

La búsqueda asistida por IA (HU06) queda fuera del MVP porque depende de un proveedor externo; mientras tanto, la búsqueda por categorías y filtros (HU05) cubre la necesidad. La prioridad no reduce el alcance documentado: solo ordena las entregas.
