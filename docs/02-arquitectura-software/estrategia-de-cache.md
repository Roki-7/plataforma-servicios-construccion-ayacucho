# Estrategia de caché con Redis

## 1. Principio

Redis es **solo una caché de lectura**, y desde la funcionalidad 002 está **activo desde la entrega**. PostgreSQL es siempre la fuente de verdad: si Redis falla, se vacía o devuelve datos inválidos, la plataforma sigue funcionando y consulta la base de datos (ADR-010, ADR-013).

La frescura no depende de borrar claves ni del tiempo de vida (TTL), sino de una **revisión durable** de la oferta guardada en PostgreSQL. La revisión manda sobre el TTL. Las mediciones de EQ-01 (T082) calibraron el TTL de 60 segundos y orientan los ajustes de capacidad; no deciden si la caché existe.

## 2. Qué se guarda en caché y qué no

| Dato | ¿Caché? | Duración | Motivo |
|---|---|---|---|
| Categorías efectivamente activas | Sí | TTL calibrado de 60 segundos por defecto (configurable de 1 a 3 600 s) | Cambian poco y se consultan en cada búsqueda. |
| Resultados de búsqueda de servicios y de prestadores por filtros y página | Sí | TTL calibrado de 60 segundos por defecto (configurable de 1 a 3 600 s) | Son la consulta más frecuente (EQ-01). |
| Detalle de un servicio y servicios publicados de un prestador | **No** | — | Se leen siempre de PostgreSQL para respetar de inmediato las revocaciones de visibilidad (clasificación desactivada, pausa o retiro). |
| Fotografías y datos del portafolio | **No** | — | Se sirven con las políticas de acceso vigentes y la propiedad del módulo Prestadores. |
| Solicitudes, cotizaciones y contrataciones | **No** | — | Deben estar siempre al día; un dato viejo podría permitir aceptar una cotización vencida. |
| Permisos y sesiones, incluido el permiso de gestión de categorías | **No** | — | Un permiso retirado debe aplicarse de inmediato. |
| Datos privados (correo, teléfono, documentos) | **No** | — | Protección de datos personales (RC14). Solo se guardan datos públicos. |

**Decisión aprobada (INC-002-02, 2026-11-25).** El plan se enmendó para reflejar lo implementado y medido. (1) **TTL calibrado:** 60 segundos por defecto para categorías y búsquedas, configurable de 1 a 3 600 segundos; EQ-01 y EQ-03 se cumplieron con ese valor. (2) **Variación del TTL diferida:** no se implementa ahora; se incorporará si una medición de EQ-01 muestra expiraciones simultáneas que degraden el p95. (3) **Métricas de caché diferidas** a una funcionalidad posterior de observabilidad (sección 6). La corrección de la frescura no depende de estas decisiones: la revisión durable manda sobre el TTL y los mecanismos de protección de Redis (respaldo en PostgreSQL, cortacircuitos, nuevo espacio de claves tras restaurar) se conservan sin cambios. Justificación y trazabilidad en la incidencia INC-002-02 de `specs/002-prestadores-y-catalogo/implementation-status.md`.

## 3. Patrón de lectura

Se usa lectura con caché mediante el patrón **Decorator** sobre las consultas del catálogo, con revisión durable en lugar de borrado de claves:

1. Se consulta la **revisión vigente** en el primario de PostgreSQL. Si no puede comprobarse, la consulta falla de forma controlada (503) y no se sirve nada de Redis.
2. Se busca en Redis la clave de esa revisión, con un tiempo de espera acotado.
3. Un acierto solo se acepta si su carga es válida y la revisión **sigue siendo la misma** al volver a consultarla.
4. Un fallo, una carga inválida, Redis caído o una revisión distinta se resuelven en PostgreSQL con una lectura coherente del resultado y su total.
5. El resultado se guarda en Redis con su TTL solo si la revisión no cambió durante la carga. Si cambió, la clave anterior queda aislada y la respuesta sale de una lectura vigente.

### Claves

La clave incluye entorno, espacio de claves del despliegue, versión de representación, revisión, tipo de consulta y filtros y página normalizados. Ejemplos de forma:

| Clave (forma) | Contenido |
|---|---|
| `<entorno>:<versión>:r<revisión>:categorias:activas` | Lista de categorías efectivamente activas |
| `<entorno>:<versión>:r<revisión>:servicios:<huella de filtros y página>` | Página de servicios |
| `<entorno>:<versión>:r<revisión>:prestadores:<huella de filtros y página>` | Página de prestadores |

Cada clave lleva además el prefijo del espacio de claves del despliegue que añade el cliente de Redis. Una clave de una revisión anterior no vuelve a leerse después de confirmada una escritura, aunque una réplica la repueble tarde o Redis regrese tras una interrupción.

## 4. Escritura e invalidación

1. Una transacción de PostgreSQL actualiza las fuentes, la proyección pública aplicable y la revisión global monotónica propiedad de Catálogo. El orden de bloqueos es: permiso del operador, clave de idempotencia, revisión de Catálogo y filas de negocio en orden estable.
2. La visibilidad se calcula con la jerarquía vigente: la actividad efectiva de una subcategoría depende de su propio estado y del de su categoría padre.
3. Redis queda **fuera del commit**: su disponibilidad no condiciona confirmar una mutación. No se borran claves; incrementar la revisión basta para que ninguna lectura posterior use la caché anterior.

## 5. Respaldo y recuperación

| Situación | Comportamiento |
|---|---|
| Redis no responde, está vacío o devuelve una carga inválida | Se consulta PostgreSQL con una lectura coherente. Al recuperarse Redis se usan solo claves de la revisión vigente. |
| Redis se reinicia vacío | Las primeras consultas van a la base y vuelven a llenar la caché. |
| Se desactiva una clasificación mientras Redis está caído | La revisión nueva aísla las claves anteriores; al volver Redis no reaparecen resultados desactualizados (T069). |
| PostgreSQL no puede comprobar la revisión | Las consultas dependientes responden 503; no se usa Redis como sustituto. |
| Se restaura PostgreSQL desde un respaldo | Antes de reabrir el tráfico se asigna a **todas las réplicas un espacio de claves nuevo**, porque la restauración puede reutilizar revisiones anteriores cuyas claves viejas seguirían en Redis. La restauración coordinada del portafolio mantiene la puerta cerrada hasta hacerlo. |
| Falla la escritura en Redis tras una mutación | No afecta la corrección: la revisión nueva ya impide usar claves anteriores. |

## 6. TTL, ocupación y observabilidad

- **TTL y ocupación.** El TTL acota la memoria ocupada porque toda clave expira; con la revisión en la clave, las de revisiones anteriores no se vuelven a leer y solo ocupan espacio hasta que vencen. Por eso el TTL es corto (60 segundos por defecto) y el tamaño del espacio se acota por cardinalidad de filtros y páginas.
- **Observabilidad (métricas diferidas).** Se registran solo operación y resultado agregado, sin filtros personales, cuerpos ni identificadores protegidos. Las métricas de caché previstas (aciertos, fallos, uso del respaldo en PostgreSQL, tiempo de Redis, lectura y espera de la revisión, tiempos SQL, conexiones y evicciones) **quedan diferidas a una funcionalidad posterior de observabilidad**. Hoy el comportamiento se verifica con las pruebas de integración (T064, T069) y con las mediciones externas de latencia y fallos de EQ-01/EQ-03 (T082, T083).
- **Mediciones.** EQ-01/PR01 se midió con y sin Redis (T082); EQ-03/PR03, con una y dos réplicas (T083). Sus resultados están en `specs/002-prestadores-y-catalogo/implementation-status.md`.
- **Seguimiento futuro.** (a) Variación del TTL: se activa si una medición de EQ-01 muestra expiraciones simultáneas que degraden el p95. (b) Métricas de caché: se incorporan con la funcionalidad de observabilidad. (c) Si se quisiera un TTL mayor para categorías, basta configurarlo (hasta 3 600 s) y volver a medir EQ-01.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Mostrar un perfil o servicio desactualizado | Revisión durable en la clave y en cada acierto; detalle sin caché. |
| Reutilizar claves viejas tras restaurar PostgreSQL | Nuevo espacio de claves en todas las réplicas antes de reabrir el tráfico. |
| Muchas consultas a la vez cuando expiran varias claves | TTL corto con respaldo en PostgreSQL; la variación del TTL queda diferida con un disparador medible en EQ-01. |
| Redis lento o lleno | Tiempo de espera acotado, cardinalidad limitada y medición de evicciones. |
| Exponer datos privados | Solo se guardan datos públicos. |

## 8. Por qué la caché no participa en la contratación

La regla de una contratación activa por solicitud (DA04) se protege en PostgreSQL con una transacción, un índice único parcial y la versión esperada. Nunca se decide con datos de Redis, porque podrían estar desactualizados.

---

[Índice del proyecto](../../README.md)
