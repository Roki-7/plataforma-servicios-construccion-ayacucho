# Modelo de datos

> **Proyecto:** Plataforma web para la búsqueda y contratación de servicios de construcción civil en Ayacucho.  
> **Motor:** PostgreSQL (ADR-005 y ADR-013).  
> **Estado:** diseño propuesto para los módulos pendientes; las estructuras de Usuarios y acceso (001) y de Prestadores, Catálogo y Administración (002) están materializadas en PostgreSQL y se describen con sus nombres reales.

## 1. Objetivo

Mostrar las tablas principales, sus relaciones y las restricciones que protegen las reglas críticas del negocio, en especial la regla de **una sola contratación activa por solicitud** (DA04).

## 2. Diagrama

![Modelo de datos de la plataforma](../../img/modelo-datos.png)

[Archivo editable en Draw.io](../../img/fuentes-svg/modelo-datos.drawio) · [Versión SVG](../../img/fuentes-svg/modelo-datos.svg)

El diagrama usa la notación pata de gallo: una línea doble indica «uno», el tridente indica «muchos» y el círculo indica que la relación es opcional.

## 3. Tablas y módulo propietario

| Tabla | Módulo propietario | Contenido |
|---|---|---|
| usuarios | Usuarios y acceso | Cuenta, contraseña cifrada con hash e intentos fallidos de acceso (AC04). |
| prestadores_perfiles, prestadores_especialidades, prestadores_zonas, prestadores_trabajos, prestadores_fotografias, prestadores_objetos_pendientes | Prestadores | Perfil profesional, especialidades y zonas declaradas, trabajos anteriores y sus fotografías, y tareas técnicas de preparación y purga de objetos (002). La verificación pertenece a la 012. |
| catalogo_clasificaciones, catalogo_servicios, catalogo_distritos, catalogo_proyeccion_prestadores, catalogo_revision_oferta, catalogo_confirmaciones_desactivacion | Catálogo y búsqueda | Categorías y subcategorías, servicios, distritos de cobertura, proyección de búsqueda, revisión durable de la oferta y confirmaciones temporales de desactivación (002). |
| administracion_permisos, administracion_constancias, administracion_aprobaciones, administracion_auditoria | Administración e incidencias | Permiso persistente de gestión de categorías, constancias y aprobaciones del alta inicial y auditoría inmutable de RF39 (002). |
| solicitudes | Solicitudes y visitas | Necesidad del cliente, tipo (dirigida o publicada), estado y versión. |
| cotizaciones | Cotizaciones | Oferta del prestador para una versión de la solicitud, con importe y vigencia. |
| contrataciones | Contrataciones y acuerdos | Estado de la contratación, versión y fecha límite de confirmación. |
| versiones_acuerdo | Contrataciones y acuerdos | Condiciones aceptadas por ambas partes; nunca se sobrescriben. |
| avances y pagos_registrados | Seguimiento y pagos registrados | Avances del trabajo y pagos directos declarados y confirmados. |
| calificaciones | Calificaciones | Una calificación por contratación finalizada. |
| avisos_pendientes | Notificaciones | Avisos guardados en la misma transacción y enviados después (Outbox). |
| claves_idempotencia | Infraestructura compartida | Resultado de cada petición crítica para responder igual a un reintento. |

Cada módulo modifica solo sus tablas. Cuando necesita datos de otro módulo, usa su operación pública. En el diseño general las claves foráneas entre módulos aseguran la integridad sin autorizar escrituras cruzadas; **en la 002 materializada las referencias entre módulos no usan claves foráneas** (`cuenta_id`, `prestador_id` de la proyección y de los servicios, `categoria_id` de las especialidades) sino la validación por las APIs públicas dentro de la misma transacción. Las claves foráneas existen solo dentro de cada módulo.

## 4. Restricciones que protegen el negocio

| Regla | Restricción en la base de datos |
|---|---|
| Una sola contratación activa por solicitud (RF21) | Índice único parcial sobre `contrataciones (solicitud_id)` limitado a los estados EN_CONFIRMACION, CONFIRMADA, EN_EJECUCION y CIERRE_SOLICITADO. |
| Evitar sobrescrituras concurrentes | Columna `version`: guardar exige la versión esperada (bloqueo optimista). |
| Evitar duplicados al reintentar | Clave primaria en `claves_idempotencia`. |
| Una calificación por trabajo (RF34) | Restricción única sobre `calificaciones (contratacion_id)`. |
| Importes exactos | Importes en céntimos (`importe_menor`, entero) y moneda PEN. |

```sql
CREATE UNIQUE INDEX ux_contratacion_activa
  ON contrataciones (solicitud_id)
  WHERE estado IN ('EN_CONFIRMACION', 'CONFIRMADA', 'EN_EJECUCION', 'CIERRE_SOLICITADO');
```

Si dos clientes o dos pestañas intentan aceptar a la vez, la base de datos rechaza la segunda inserción aunque ambas hayan pasado la validación previa. El caso de uso traduce ese rechazo a una respuesta 409.

Las fotos y los documentos no se guardan en las tablas: el almacenamiento de objetos conserva el archivo y la base de datos solo su referencia y permisos (ADR-011).

### Persistencia de Usuarios y acceso

Las migraciones de 001 crean cuentas, perfiles habilitados, sesiones, desafíos
de recuperación y cambio de correo, referencias de fotografías, consentimientos,
claves idempotentes y avisos pendientes. El índice de correo vigente impone
unicidad y las versiones distinguen conflictos de perfil y credenciales.
Una foto conserva su titular y la referencia al objeto privado. Una restauración
de la base debe comprobar la correspondencia entre referencias y objetos.
El Outbox persiste el aviso en la transacción que lo origina y un worker del
backend lo entrega después. [Modelo y reglas de 001](../../specs/001-usuarios-y-acceso/data-model.md)

### Persistencia de Prestadores, Catálogo y Administración (002)

Las migraciones aditivas de la 002 (1795000000001 a 1795000000009, junto a las ocho de la 001) crean 16 tablas propias (más la puerta de restauración que se crea solo en una base restaurada). [Modelo y reglas de 002](../../specs/002-prestadores-y-catalogo/data-model.md)

| Tabla | Propiedad y contenido | Restricciones y límites |
|---|---|---|
| prestadores_perfiles | Un perfil por cuenta: nombre público, tipo, experiencia, disponibilidad declarada, `publicable`, `version`. | `cuenta_id` único; tipo en `TRABAJADOR_DE_OFICIO`, `TECNICO`, `PROFESIONAL`, `EMPRESA`; textos no vacíos; `version > 0`. |
| prestadores_especialidades, prestadores_zonas | Clave compuesta (prestador, categoría) y (prestador, distrito). | Dependen del perfil por clave foránea; distritos limitados a los cinco admitidos. |
| prestadores_trabajos | Trabajos anteriores con versión propia. | Hasta 10 por perfil, aplicado en la transacción; título y descripción no vacíos. |
| prestadores_fotografias | Referencia a un objeto del bucket privado: clave opaca, tipo, bytes, ancho, alto y checksum. | Clave única con formato `portafolio/<uuid>/<uuid>`; tipo `image/webp`; lado de hasta 1 600 px; checksum de 32 bytes; 4 por trabajo y 40 por perfil, aplicado en la transacción. |
| prestadores_objetos_pendientes | Preparaciones y purgas de objetos con reserva temporal e intentos. | Tipo `PREPARACION` o `PURGA`; sobrevive a reinicios. |
| catalogo_clasificaciones | Categorías (nivel 1) y subcategorías (nivel 2): `nombre`, `nombre_clave`, `nombre_normalizado`, estado propio y versión. | Nace inactiva; `UNIQUE (id, nivel)`; clave foránea a la raíz con `nivel_padre = 1`; padre inmutable (disparador); **unicidad de nombre entre hermanas, incluidas inactivas** (`nombre_clave` generada por `catalogo_clave_nombre` e índice único con `NULLS NOT DISTINCT`, INC-002-01); `nombre_normalizado` es un dato heredado sin garantía. |
| catalogo_servicios | Servicio con su clasificación y su titular (`prestador_id`): título, descripción, estado y versión. | Estados `PUBLICADO`, `PAUSADO`, `RETIRADO`; clave foránea a la clasificación; el retiro conserva el registro (disparadores `catalogo_servicio_retirado` y `catalogo_servicio_conservado`); índices parciales de servicios publicados por categoría y por prestador. |
| catalogo_distritos | Cinco distritos de cobertura con etiqueta y orden. | Código restringido a los cinco canónicos. |
| catalogo_proyeccion_prestadores | Datos mínimos de búsqueda: nombre público, tipo, disponibilidad, especialidades y distritos (arreglos) y `publicable`. | 1 a 5 distritos; al menos una especialidad; índices GIN y parciales solo de los publicables. |
| catalogo_revision_oferta | Fila única con la revisión durable, monotónica y positiva. | Se incrementa en la transacción que cambia la oferta; delimita las lecturas y las claves de Redis. |
| catalogo_confirmaciones_desactivacion | Evidencia temporal con actor, clasificación, versión, revisión y recuento. | Vigencia de cinco minutos; consumo y desactivación en una sola transacción. |
| administracion_permisos | Permiso `RF39_CATEGORIAS` por cuenta: `VIGENTE` o `REVOCADO`, con versión. | La marca de revocación coincide con el estado. |
| administracion_constancias, administracion_aprobaciones | Constancia previa del alta inicial y aprobación firmada que la consume. | Quien firma y quien ejecuta son distintos; motivo obligatorio; una aprobación por constancia. |
| administracion_auditoria | Responsable, aprobación, fecha UTC, acción, recurso y motivo. | Inmutable (sin `UPDATE`, `DELETE` ni `TRUNCATE`); índice por recurso y fecha. |
| restauracion_002 | Puerta de restauración con estado y espacio de Redis; **se crea solo en la base restaurada**, no en la de origen. | Impide arrancar réplicas sobre una base restaurada hasta validar todo. |

**Inventario de referencias y respaldo coordinado.** El inventario canónico de objetos es `prestadores_fotografias` (referencias vigentes) más `prestadores_objetos_pendientes` (preparaciones y purgas). El manifiesto privado del respaldo enlaza ese inventario con el volcado PostgreSQL del mismo corte, junto con las claves y sumas de verificación de los objetos saneados. Al restaurar, se reconcilian referencias, preparaciones y purgas contra los objetos antes de reactivar el limpiador y el acceso público, y se asigna un espacio de claves de Redis nuevo. Un respaldo solo es compatible con la lista exacta de migraciones del código que lo restaura.

**Datos que no se guardan en tablas.** Las fotografías viven en el bucket privado del almacenamiento de objetos; Redis solo contiene copias de lectura de datos públicos y no es fuente de verdad.

---

[Índice del proyecto](../../README.md)
