# Estrategia de caché con Redis

## 1. Principio

Redis es **solo una caché de lectura**. PostgreSQL es siempre la fuente de verdad. Si Redis falla o se vacía, la plataforma sigue funcionando y consulta la base de datos (ADR-010, ADR-013).

La caché se activa cuando las mediciones de EQ-01 muestran que hace falta; el diseño queda listo desde el inicio.

## 2. Qué se guarda en caché y qué no

| Dato | ¿Caché? | Duración | Motivo |
|---|---|---|---|
| Categorías activas | Sí | 1 hora | Cambian muy poco y se consultan en cada búsqueda. |
| Resultados de búsqueda por filtros | Sí | 60 segundos | Son la consulta más frecuente (EQ-01). |
| Perfil público de un prestador | Sí | 5 minutos | Se consulta mucho y cambia poco. |
| Solicitudes, cotizaciones y contrataciones | **No** | — | Deben estar siempre al día; un dato viejo podría permitir aceptar una cotización vencida. |
| Permisos y sesiones | **No** | — | Un permiso retirado debe aplicarse de inmediato. |
| Datos privados (correo, teléfono, documentos) | **No** | — | Protección de datos personales (RC14). |

## 3. Patrón de lectura y escritura

Se usa el patrón **cache-aside**:

1. El repositorio busca la clave en Redis.
2. Si existe, la devuelve.
3. Si no existe, consulta PostgreSQL, guarda el resultado con su duración y lo devuelve.
4. Al modificar un dato, se borra su clave para que la siguiente lectura lo traiga actualizado.

| Clave | Ejemplo |
|---|---|
| `categorias:activas` | Lista de categorías |
| `busqueda:<hash de filtros y página>` | Página de resultados |
| `prestador:<id>:publico` | Perfil público |

En el código, la caché envuelve al repositorio con el patrón Decorator, sin cambiar los casos de uso.

## 4. Comportamiento si Redis falla

| Situación | Comportamiento |
|---|---|
| Redis no responde | Se registra la falla y se consulta PostgreSQL directamente. |
| Redis se reinicia vacío | Las primeras consultas van a la base de datos y vuelven a llenar la caché. |
| Error al borrar una clave | La duración corta limita el tiempo en que se muestra un dato desactualizado. |

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Mostrar un perfil o servicio desactualizado | Borrado de la clave al modificar y duraciones cortas. |
| Muchas consultas a la vez cuando una clave vence | Duraciones con una pequeña variación aleatoria. |
| Exponer datos privados | Solo se guardan datos públicos. |

## 6. Por qué la caché no participa en la contratación

La regla de una contratación activa por solicitud (DA04) se protege en PostgreSQL con una transacción, un índice único parcial y la versión esperada. Nunca se decide con datos de Redis, porque podrían estar desactualizados.

---

[Índice del proyecto](../../README.md)
