# Glosario

Este glosario define los términos que tienen un significado preciso dentro de la plataforma. Se utilizan con el mismo sentido en el análisis, la arquitectura, el diseño y el modelo C4.

## 1. Participantes

| Término | Significado |
|---|---|
| Cliente | Persona que busca un servicio, registra solicitudes, compara cotizaciones y contrata. |
| Prestador | Trabajador de oficio, técnico, profesional o empresa de construcción civil que ofrece servicios. Una misma cuenta puede tener el perfil de cliente y el de prestador. |
| Administrador | Persona autorizada para gestionar categorías, cuentas, verificaciones, publicaciones e incidencias. |
| Participante | Cliente o prestador vinculado a una solicitud o contratación. Los permisos de una operación dependen de esta participación. |

## 2. Solicitudes y cotizaciones

| Término | Significado |
|---|---|
| Solicitud dirigida | Solicitud que el cliente envía a un prestador elegido. |
| Solicitud publicada | Solicitud abierta para recibir cotizaciones de varios prestadores compatibles. |
| Visita técnica | Visita acordada para evaluar el trabajo antes de cotizar. Registra fecha, horario y costo, incluido cero. |
| Cotización | Oferta que el prestador elabora para una solicitud, con alcance, exclusiones, materiales, precio, plazo, vigencia y condiciones de pago. |
| Propuesta | Término equivalente a cotización. El diseño lo utiliza en nombres como `AceptarPropuesta` o `GestionPropuestas`, mientras los requisitos y el módulo usan “cotización”. Ambos se refieren al mismo registro. |
| Cotización estimada | Cotización que orienta al cliente, pero que debe convertirse en definitiva antes de contratar. |
| Cotización definitiva | Cotización con condiciones firmes que puede seleccionarse o aceptarse mientras esté vigente. |
| Cotización pendiente de revisión | Cotización que no puede aceptarse porque la solicitud cambió después de enviarla. |
| Cotización no seleccionada | Cotización que deja de estar disponible porque se confirmó otra contratación para la misma solicitud. No afecta la calificación del prestador. |

## 3. Contratación

| Término | Significado |
|---|---|
| Selección pendiente | El cliente eligió una cotización que requiere la confirmación del prestador. Corresponde al estado `EN_CONFIRMACION`. |
| Fecha límite de confirmación | Momento hasta el que el prestador puede confirmar o rechazar una selección pendiente. Nunca supera la vigencia de la cotización. |
| Aceptación directa | Aceptación de una cotización definitiva, vigente y con disponibilidad ya confirmada. Crea la contratación en estado `CONFIRMADA` sin esperar al prestador. |
| Contratación activa | Contratación en estado `EN_CONFIRMACION`, `CONFIRMADA`, `EN_EJECUCION` o `CIERRE_SOLICITADO`. Una solicitud solo puede tener una. |
| Acuerdo | Conjunto de condiciones aceptadas por ambas partes. Cada cambio aceptado genera una nueva versión sin borrar las anteriores. |
| Propuesta de cambio | Cambio de alcance, precio o plazo que solo se incorpora al acuerdo cuando ambas partes lo aceptan. |
| Pago registrado | Pago directo que el cliente declara y el prestador confirma. La plataforma no procesa ni verifica el dinero. |
| Conformidad | Confirmación del cliente de que el trabajo terminó correctamente. Finaliza la contratación. |
| Observación | Aspecto del trabajo que el cliente pide corregir antes de dar su conformidad. |

## 4. Términos técnicos

| Término | Significado |
|---|---|
| Módulo | Parte del backend con una responsabilidad de negocio, sus propios datos y operaciones públicas. Los diez módulos se ejecutan en la misma aplicación. |
| Operación pública | Función que un módulo ofrece a los demás. Es la única forma de consultar o modificar sus datos desde otro módulo. |
| Puerto | Interfaz que declara la capa de aplicación para pedir algo sin conocer cómo se implementa. |
| Adaptador | Implementación de un puerto que conecta con la base de datos, otro módulo o un proveedor externo. |
| Transacción | Conjunto de cambios que se confirman juntos o se revierten juntos. |
| Clave de idempotencia | Identificador que envía la aplicación web para que repetir la misma petición no cree un segundo registro. |
| Aviso pendiente | Aviso guardado junto con la operación principal y enviado después por el proceso de avisos (patrón Outbox transaccional). |
| Driver arquitectónico | Requisito, atributo de calidad o restricción que influye de manera importante en la organización del sistema. |
| ADR | Registro de decisión arquitectónica: documenta qué se decidió, por qué y con qué consecuencias. |

---

[Índice del proyecto](../../README.md)
