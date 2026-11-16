# Ejemplo Clean Architecture · pendiente de implementación

La carpeta contiene archivos reservados sin código. No es una aplicación ejecutable.

El caso de uso de referencia será AceptarPropuesta, siguiendo el [diseño interno](../../docs/03-diseno-de-software/diseno-interno/diseno-interno-de-modulos.md). Se implementará con NestJS y TypeScript (ADR-013).

| Carpeta | Contenido previsto |
|---|---|
| `dominio/` | Contratacion, CondicionesAcordadas, VersionDeAcuerdo y EstadoContratacion con sus reglas. |
| `aplicacion/` | Casos de uso AceptarPropuesta, ConfirmarContratacion y RechazarSeleccion. |
| `aplicacion/puertos/` | RepositorioContrataciones, UnidadDeTrabajo, AvisosPendientes, GestionPropuestas y GestionSolicitudes. |
| `infraestructura/` | Repositorio y unidad de trabajo en memoria para la demostración, y adaptadores hacia Cotizaciones, Solicitudes y Notificaciones. |
| `presentacion/` | ContratacionController. |
| `configuracion/` | Raíz de composición que conecta cada puerto con su implementación. |
| `pruebas/` | Reglas de la entidad y del caso de uso, incluida la regla de una sola contratación activa por solicitud. |

La demostración deberá respetar las reglas del agregado y distinguir un repositorio de prueba en memoria de una persistencia con garantías de transacción y concurrencia. Las validaciones y las instrucciones para ejecutarla se incorporarán cuando exista la implementación.
