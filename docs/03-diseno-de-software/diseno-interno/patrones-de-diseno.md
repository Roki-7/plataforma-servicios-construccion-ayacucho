# Patrones de diseño

## Objetivo

Documentar los patrones previstos en el backend, indicando dónde se utilizan, qué problema resuelven y con qué piezas del diseño se relacionan. Las descripciones corresponden al diseño propuesto y se comprobarán durante la implementación.

## Contexto

- **Estilo:** monolito modular organizado en capas.
- **Enfoque interno:** Clean Architecture.
- **Módulo de referencia:** Contrataciones y acuerdos.
- **Base:** diagramas de componentes, paquetes, clases y secuencia ya elaborados.
- **Tecnología:** NestJS, PostgreSQL y Redis (ADR-013); proveedores externos por seleccionar.

## Patrones aplicados

| Patrón | Dónde se usa | Problema que resuelve | Se implementa con | Piezas de referencia |
|---|---|---|---|---|
| Adapter | Contrataciones → Cotizaciones, Solicitudes y Notificaciones. | Colaborar sin conocer detalles privados de los otros módulos. | Contratos internos y llamadas a sus APIs públicas. | GestionPropuestasAdapter, GestionSolicitudesAdapter, RegistroAvisosAdapter. |
| Adapter | IA, archivos, mapas y envío de avisos. | Traducir formatos y errores de proveedores distintos. | Clientes técnicos dentro de infraestructura. | Adaptadores de servicios externos y archivos del diseño arquitectónico. |
| Repository | Contrataciones → base de datos. | Mantener los casos de uso independientes de SQL y del motor. | Implementación del puerto de persistencia. | RepositorioContrataciones, RepositorioContratacionesBD. |
| Unit of Work | Guardado coordinado de la aceptación. | Evitar que queden cambios parciales en la contratación, la solicitud, las propuestas y el aviso. | Un contexto transaccional compartido por operación. | UnidadDeTrabajo, UnidadDeTrabajoBD. |
| Transactional Outbox | Contratación → avisos pendientes. | Conservar la intención de envío aunque falle el proveedor después de guardar el acuerdo. | Aviso almacenado con la operación y envío posterior al commit. | AvisosPendientes, RegistroAvisosAdapter y proceso de avisos pendientes del módulo Notificaciones. |
| Clave de idempotencia (Idempotency Key) | Peticiones de aceptación y confirmación. | Evitar que un doble clic o un reintento tras una desconexión cree una segunda contratación. | Clave enviada por la aplicación web, reservada y guardada con el resultado dentro de la transacción. | AceptarPropuestaCommand, UnidadDeTrabajo, UnidadDeTrabajoBD. |

Transactional Outbox es un patrón de integración y consistencia; no pertenece al catálogo clásico GoF. Se incluye porque forma parte del flujo documentado. Los puertos del backend se ubican en Aplicación y sus implementaciones en Infraestructura.

## Cómo funciona cada patrón

| Patrón | En pocas palabras |
|---|---|
| Adapter | El caso de uso pide una propuesta vigente; el adaptador utiliza la API pública de Cotizaciones. |
| Repository | El negocio pide guardar la contratación; el repositorio resuelve la persistencia y sus conflictos conocidos. |
| Unit of Work | Los cambios relacionados se confirman juntos o se revierten antes de confirmar. |
| Transactional Outbox | Se guarda el aviso con el acuerdo y se envía después; no se mantiene la transacción abierta esperando al proveedor. |

La consulta previa no reemplaza los controles de unicidad y versión en persistencia. Los reintentos de aceptación utilizan idempotencia. Los avisos también necesitan identificar y controlar entregas repetidas: Outbox por sí solo no garantiza una entrega exactamente una vez.

## Beneficio

- Los casos de uso y las reglas quedan separados de herramientas y proveedores.
- Otra implementación compatible se conecta desde la composición sin reescribir el caso de uso.
- Los dobles controlados facilitan las pruebas; la persistencia y las transacciones requieren pruebas de integración.
- La contratación se conserva aunque un proveedor de notificaciones no esté disponible después del commit.

## Patrones de resiliencia para servicios externos

Los adaptadores de IA, mapas y notificaciones combinan cuatro patrones para que una falla del proveedor no detenga la plataforma. Corresponden a ADR-007 y al escenario EQ-08.

| Patrón | Dónde se usa | Comportamiento |
|---|---|---|
| Timeout (tiempo límite) | Adaptadores de IA y mapas. | Cada llamada espera un tiempo máximo. Si no hay respuesta, se corta y se usa la alternativa. |
| Fallback (alternativa de respaldo) | Búsqueda asistida y ubicación. | Sin IA se muestran los filtros por categoría y zona; sin mapas, la selección manual de zona. Es una degradación elegante: se pierde una ayuda, no la función. |
| Circuit Breaker (cortacircuitos) | Adaptadores de IA y mapas. | Tras varias fallas seguidas se dejan de llamar durante un tiempo y se pasa directo a la alternativa. Luego se prueba una llamada; si funciona, se vuelve a usar el proveedor. |
| Reintento con espera creciente | Proceso de avisos pendientes. | Un aviso fallido se reintenta cada vez con más espera y, tras un número máximo de intentos, queda marcado como fallido para su revisión. |

La búsqueda asistida no se reintenta en el momento, porque haría esperar más al cliente. Los reintentos se reservan para los avisos, que pueden enviarse después sin bloquear a nadie.

## Patrones previstos para siguientes iteraciones

| Patrón | Dónde se aplicaría | Cuándo |
|---|---|---|
| Adapter para pagos | Cobro de planes o servicios de la plataforma. | Al implementar ese servicio y seleccionar el proveedor; no cobra el trabajo al prestador en el alcance actual. |
| Decorator | Consultas frecuentes de catálogo o perfiles. | Para envolver los repositorios de catálogo con la caché Redis sin cambiar los casos de uso. Se activa cuando las mediciones de EQ-01 lo justifiquen. |
| Factory | Construcción de variantes de acuerdos. | Si la complejidad justifica una fábrica específica. Los métodos estáticos actuales no demuestran que ya exista Factory Method de GoF. |
| Facade | Operaciones públicas de módulos que crezcan. | Si se necesita simplificar varias colaboraciones detrás de una interfaz. Una API pública no implica por sí sola el patrón. |
