# Tácticas arquitectónicas

Una táctica es una decisión de diseño concreta que mejora un atributo de calidad. Este documento reúne las tácticas que aplica la plataforma, indica qué escenario de calidad atienden y dónde se ven en la arquitectura.

## 1. Catálogo

### 1.1 Tácticas por atributo

| Atributo | Táctica | Cómo se aplica | Escenario | Decisión |
|---|---|---|---|---|
| Rendimiento (AC01) | Reducir la información procesada | Filtros, paginación de 20 resultados e índices en las columnas de búsqueda. | EQ-01 | ADR-010 |
| Rendimiento (AC01) | Mantener copias de datos | Caché de categorías y búsquedas frecuentes en Redis. | EQ-01 | ADR-010, ADR-013 |
| Disponibilidad (AC02) | Monitorear | Endpoint `GET /api/v1/salud` consultado cada minuto. | EQ-02 | ADR-013 |
| Disponibilidad (AC02) | Redundancia activa | Dos o más réplicas de la API detrás de un proxy HTTPS. | EQ-02, EQ-03 | ADR-001 |
| Escalabilidad (AC03) | API sin estado | La sesión viaja en el token; cualquier réplica atiende cualquier petición. | EQ-03 | ADR-006 |
| Seguridad (AC04) | Autenticar actores | Contraseña con hash y sesión de 15 minutos renovable hasta 7 días. | EQ-04 | ADR-006 |
| Seguridad (AC04) | Autorizar actores | Permiso por rol y por participación en cada operación protegida. | EQ-04 | ADR-006 |
| Seguridad (AC04) | Limitar el acceso | Bloqueo de 15 minutos tras 5 intentos fallidos. | EQ-04 | ADR-006 |
| Seguridad (AC04) | Proteger secretos | Credenciales en variables de entorno del servidor. | EQ-04 | ADR-006 |
| Mantenibilidad (AC05) | Encapsular | Cada módulo expone solo su API pública. | EQ-05 | ADR-001 |
| Mantenibilidad (AC05) | Usar un intermediario | Puertos y adaptadores para IA, notificaciones, mapas y archivos. | EQ-05 | ADR-002, ADR-007 |
| Mantenibilidad (AC05) | Restringir dependencias | La regla de dependencia de Clean Architecture se comprueba con pruebas de arquitectura. | EQ-05 | ADR-002 |
| Usabilidad (AC06) | Adaptar el proceso | Pocos pasos para servicios rápidos y etapas para obras grandes. | EQ-06 | ADR-004 |
| Adaptabilidad (AC07) | Diseño responsive | Una sola aplicación web para celular, tableta y computadora. | EQ-07 | ADR-004 |
| Resiliencia (AC08) | Tiempo límite | 8 segundos para la IA y los mapas. | EQ-08 | ADR-007 |
| Resiliencia (AC08) | Degradación controlada | Búsqueda por filtros y zona manual si falla un proveedor. | EQ-08 | ADR-008 |
| Resiliencia (AC08) | Cortocircuito | Tras fallas repetidas se suspenden temporalmente las llamadas al proveedor. | EQ-08 | ADR-007 |
| Resiliencia (AC08) | Reintentar | Avisos pendientes reenviados a 1, 5, 15, 60 y 240 minutos. | EQ-08 | ADR-009 |
| Integridad (AC09) | Transacción | La contratación, el resultado de las cotizaciones y el aviso se guardan juntos. | EQ-09 | ADR-005 |
| Integridad (AC09) | Restricción de unicidad | Índice único parcial: una contratación activa por solicitud. | EQ-09 | ADR-005 |
| Integridad (AC09) | Idempotencia | Clave `Idempotency-Key` en las operaciones críticas. | EQ-09 | ADR-005 |
| Integridad (AC09) | Bloqueo optimista | Columna `version` y versión esperada al guardar. | EQ-09 | ADR-005 |
| Integridad (AC09) | Conservar versiones | Los acuerdos aceptados nunca se sobrescriben. | EQ-09 | ADR-012 |

## 2. Cómo se articulan en los flujos críticos

| Flujo | Tácticas que intervienen |
|---|---|
| Buscar prestadores | Filtros y paginación → caché de búsquedas → si la IA no responde en 8 s, búsqueda por filtros. |
| Aceptar una cotización | Autenticar → autorizar por participación → idempotencia → transacción con bloqueo optimista e índice único → aviso pendiente. |
| Enviar un aviso | Se guarda en la transacción → el proceso de avisos lo envía después → reintentos → la falla no deshace la operación. |
| Iniciar sesión | Limitar intentos → hash de contraseña → sesión corta renovable. |

## 3. Parámetros

| Parámetro | Valor | Dónde se usa |
|---|---|---|
| Resultados por página | 20 | Búsquedas y listados |
| Tiempo límite de IA y mapas | 8 s | Adaptadores externos |
| Reintentos de avisos | 1, 5, 15, 60 y 240 min | Proceso de avisos |
| Intentos fallidos antes del bloqueo | 5 | Inicio de sesión |
| Duración del bloqueo | 15 min | Inicio de sesión |
| Sesión | 15 min, renovable hasta 7 días | Autenticación |
| Plazo de confirmación del prestador | 24 h, sin superar la vigencia | Contrataciones |

---

[Índice del proyecto](../../README.md)
