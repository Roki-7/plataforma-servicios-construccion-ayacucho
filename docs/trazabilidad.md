# Matriz de trazabilidad

Permite responder dos preguntas: **¿de qué requisito sale este componente?** y **¿cómo se comprueba?** La cadena es **HU → RF → AC/EQ → DA → ADR → módulo → prueba → funcionalidad**.

Documentos de origen: [HU](01-analisis-de-sistema/02-historias-de-usuario.md) · [RF](01-analisis-de-sistema/03-requisitos-funcionales.md) · [AC](01-analisis-de-sistema/04-atributos-de-calidad.md) · [EQ](01-analisis-de-sistema/08-escenarios-atributos-calidad.md) · [DA](01-analisis-de-sistema/06-drivers-arquitectonicos.md) · [ADR](01-analisis-de-sistema/07-decisiones-arquitectonicas.md) · [Pruebas](05-gestion/04-pruebas.md) · [Backlog](05-gestion/02-backlog-y-sprints.md)

## 1. Matriz principal (de la necesidad a la prueba)

| HU | RF | AC / EQ | DA | ADR | Módulo | Prueba | Func. |
|---|---|---|---|---|---|---|---|
| HU01 | RF01–RF04 | AC04 / EQ-04 | DA03 | ADR-006 | Usuarios y acceso | PR04, PR13, PR14 | 001 |
| HU02 | RF05 | AC04 / EQ-04 | DA03 | ADR-006 | Usuarios y acceso | PR04 | 001 |
| HU03 | RF06, RF07 | AC04 / EQ-04 | DA03, DA11 | ADR-011 | Prestadores | PR04 | 002, 012 |
| HU04 | RF08 | AC05 / EQ-05 | DA08 | ADR-002 | Catálogo y búsqueda | PR04, PR12 | 002 |
| HU05 | RF09, RF10 | AC01, AC03 / EQ-01, EQ-03 | DA01, DA02 | ADR-010 | Catálogo y búsqueda | PR01, PR03 | 002 |
| HU06 | RF11 | AC05, AC08 / EQ-05, EQ-08 | DA05, DA06 | ADR-007, ADR-008 | Catálogo y búsqueda + adaptador de IA | PR05, PR08 | 007 |
| HU07 | RF12, RF13 | AC06 / EQ-06 | DA09 | ADR-004, ADR-011 | Solicitudes y visitas | PR06 | 003 |
| HU08 | RF14 | AC04 / EQ-04 | DA03 | ADR-006 | Solicitudes y visitas | PR04 | 003 |
| HU09 | RF15, RF16 | AC06 / EQ-06 | DA09 | ADR-004 | Solicitudes y visitas | PR06 | 008 |
| HU10 | RF17, RF18 | AC09 / EQ-09 | DA04 | ADR-005, ADR-012 | Cotizaciones | PR11 | 003 |
| HU11 | RF18, RF19 | AC01 / EQ-01 | DA02 | ADR-010 | Cotizaciones | PR01 | 003 |
| HU12 | RF20, RF21 | AC09 / EQ-09 | DA04 | ADR-001, ADR-005 | Contrataciones y acuerdos | PR09, PR10, PR11 | 004 |
| HU13 | RF22 | AC08 / EQ-08 | DA05 | ADR-009 | Contrataciones y acuerdos, Notificaciones | PR15 | 004 |
| HU14 | RF23, RF24 | AC04, AC09 / EQ-04, EQ-09 | DA11 | ADR-011, ADR-012 | Contrataciones y acuerdos | PR04, PR16 | 009 |
| HU15 | RF25 | AC09 / EQ-09 | DA04 | ADR-012 | Contrataciones y acuerdos | PR16 | 009 |
| HU16 | RF26, RF27 | AC09 / EQ-09 | DA09, DA11 | ADR-004, ADR-012 | Contrataciones; Seguimiento y pagos | PR11 | 004, 010 |
| HU17 | RF28, RF29 | AC09 / EQ-09 | DA11 | ADR-012 | Seguimiento y pagos registrados | PR04 | 010 |
| HU18 | RF30, RF31 | AC06 / EQ-06 | DA09 | ADR-004 | Seguimiento y pagos registrados | PR11 | 005 |
| HU19 | RF31, RF32 | AC09 / EQ-09 | DA04 | ADR-005 | Seguimiento; Contrataciones | PR11 | 005 |
| HU20 | RF33 | AC09 / EQ-09 | DA04 | ADR-012 | Contrataciones y acuerdos | PR11 | 011 |
| HU21 | RF34 | AC04 / EQ-04 | DA03 | ADR-006 | Calificaciones | PR04 | 011 |
| HU22 | RF35 | AC08 / EQ-08 | DA05 | ADR-009 | Notificaciones | PR15 | 006 |
| HU23 | RF36 | AC01, AC04 / EQ-01, EQ-04 | DA02, DA11 | ADR-010 | Varios módulos (consulta) | PR01, PR04 | 011 |
| HU24 | RF37, RF38 | AC04 / EQ-04 | DA11 | ADR-012 | Administración e incidencias | PR04 | 012 |
| HU25 | RF39 | AC05 / EQ-05 | DA08 | ADR-002 | Catálogo; Administración | PR12 | 002 |
| HU26 | RF40–RF42, RF45 | AC04 / EQ-04 | DA03, DA11 | ADR-006, ADR-012 | Administración e incidencias | PR04 | 012 |
| HU27 | RF43, RF45 | AC04 / EQ-04 | DA11 | ADR-012 | Administración e incidencias | PR04 | 012 |
| HU28 | RF44 | AC01 / EQ-01 | DA02 | ADR-010 | Administración e incidencias | PR01 | 012 |

Las decisiones transversales se aplican a todas las filas: ADR-003 (API REST) y ADR-013 (stack).

La funcionalidad 001 dispone de fundación, US1, US2 y US3 verificadas en `tecnologia/backend`
y `tecnologia/frontend`. El [estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
vincula T001–T062 con archivos y resultados: 11 CA-REG, nueve CA-SES y diez CA-REC comprobados;
US4–US7 y los otros 23 CA permanecen pendientes. Los nueve proyectos de Linux y Windows
conservan TLS activo y rechazo de certificados no confiables. No acredita la
entrega completa de 001 ni todos los 32 requisitos locales.

| Cadena de US1 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF01 → FR-001–003/021–022 → AC09/EQ-04 → DA03/DA07 → ADR-002/003/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/cuenta.ts`, `politica-contrasena.ts`, `aplicacion/registrar-cuenta.ts`, repositorio y controlador de registro | `tecnologia/backend/test/unit/usuarios-acceso/registro.spec.ts`, `test/integration/usuarios-acceso/registro.spec.ts`, `test/contract/usuarios-acceso/registro.spec.ts`: CA-REG-01–05, 08–11 según niveles de la matriz. |
| HU01 → RF01 (apoyo HU02/RF05) → FR-028–029 → EQ-04 → DA03 → ADR-002/005/006 → Usuarios y acceso | `dominio/perfiles-habilitados.ts`, `aplicacion/habilitar-perfil.ts`, `presentacion/registro.controller.ts`, composición backend | Las mismas suites backend: CA-REG-06/07; confirmación, titularidad, versión, replay, concurrencia y ausencia de administración. |
| HU01 → RF01 → FR-019/021 → EQ-07 → DA10 → ADR-004/011 → web y fotografías propias | `tecnologia/frontend/src/features/usuarios-acceso/presentacion/Registro.tsx`, `HabilitarPerfil.tsx`, `aplicacion/registro.ts`, composición y adaptador HTTP; foto por adaptador S3 fundacional | `tecnologia/frontend/test/unit/usuarios-acceso/registro.test.tsx` y `test/e2e/usuarios-acceso/registro.spec.ts`: 7 V y 18 E por entorno; 360/768/1366 × Chromium/Firefox/WebKit, backend real. |

Las rutas abreviadas de componentes y pruebas son relativas a las mismas raíces
backend/frontend de cada fila. La [matriz normativa](../specs/001-usuarios-y-acceso/test-matrix.md)
conserva la relación exacta de cada CA con sus niveles. La adición de US1 usa ahora
registro y login reales en la misma navegación. La proyección inicial se conserva
en memoria; su consulta general sigue reservada a US5. El fixture anterior ya no
se importa en la web.

| Cadena de US2 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF02 → FR-004–007 → AC04/EQ-04 → DA03 → ADR-002/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/sesion.ts`, `control-intentos.ts`, `aplicacion/iniciar-sesion.ts`, `renovar-sesion.ts`, `obtener-csrf.ts`, `cerrar-sesion.ts`, repositorio de sesiones y controlador | `tecnologia/backend/test/unit/usuarios-acceso/sesiones.spec.ts` (15 U), `test/integration/usuarios-acceso/sesiones.spec.ts` (19 I) y `test/contract/usuarios-acceso/sesiones.spec.ts` (13 C), según niveles CA-SES-01–09; PR04/PR13. |
| HU01 → RF02 y apoyo RF01 → FR-006–007/012/014 → EQ-04/EQ-07 → DA03/DA10 → ADR-004/006 → web | `tecnologia/frontend/src/features/usuarios-acceso/aplicacion/sesion.ts`, `infraestructura/coordinador-renovacion.ts`, `presentacion/Acceso.tsx`, `EstadoSesion.tsx`, composición y HTTP | `tecnologia/frontend/test/unit/usuarios-acceso/sesiones.test.tsx` (9 V), `test/e2e/usuarios-acceso/sesiones.spec.ts` (9 E por entorno), regresión `registro.spec.ts` con login real; Chromium/Firefox/WebKit × 360/768/1366. |

Cookie Secure/HttpOnly/SameSite=Lax/Path y siete días absolutos; rotación y cierre
comprobados en PostgreSQL real, sin caché de permisos. Las matrices finales pasan
45/45 en Linux y 45/45 en Windows, incluida recuperación. El inspector SameSite de WebKit Windows tiene
una limitación documentada; la cabecera Lax se exige en todos los motores y su
alcance se detalla en el estado de implementación.

| Cadena de US3 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF03 → FR-008–011/022/026–027/030 → AC04/EQ-04 → DA03/DA07 → ADR-002/003/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/recuperacion.ts`, migración/entidad y repositorio de recuperación, `aplicacion/solicitar-recuperacion.ts`, `consumir-recuperacion.ts`, controlador y composición; consulta anticipada de replay en idempotencia compartida | `tecnologia/backend/test/unit/usuarios-acceso/recuperacion.spec.ts` (11 U), `test/integration/usuarios-acceso/recuperacion.spec.ts` (14 I), `test/contract/usuarios-acceso/recuperacion.spec.ts` (9 C): CA-REC-01–10 según niveles; PostgreSQL real, vencimiento, carreras y rollback; PR04/PR13. |
| HU01 → RF03 → FR-008/020/026–027 → EQ-04 → DA03/DA05 → ADR-005/006/009 → API de Notificaciones | `tecnologia/backend/src/modulos/notificaciones/infraestructura/plantillas-seguridad.ts`, puerto de Usuarios conectado por composición y Outbox/worker existentes | I/C anteriores y Mailpit E: destinatario registrado, enlace cifrado con 30 min, aviso sin contraseña, fallo/reintento sin revertir reset y un efecto lógico por operación. No implementa el catálogo funcional RF35. |
| HU01 → RF03 → FR-009–011/019/022 → EQ-04/EQ-07 → DA03/DA10 → ADR-003/004/006 → web | `tecnologia/frontend/src/features/usuarios-acceso/aplicacion/recuperacion.ts`, `presentacion/RecuperarAcceso.tsx`, `EstablecerContrasena.tsx`, composición y captura previa del fragmento en `index.html`; reporter de redacción en soporte de pruebas | `tecnologia/frontend/test/unit/usuarios-acceso/recuperacion.test.tsx` (6 V), `test/e2e/usuarios-acceso/recuperacion.spec.ts` (9 E por entorno): URL limpia, memoria, política/confirmación, claves de retry, dos sesiones/refresh revocados, aviso y login habitual. Chromium/Firefox/WebKit × 360/768/1366, TLS estricto. |

La continuación verifica solo T049–T062. Respuesta genérica, un uso/1800 s,
hash y revocaciones atómicas, replay exacto conforme a R12 y retorno al login;
sin sesión automática ni permisos administrativos. Regresiones completas:
68 U, 49 I, 53 C, 29 V y 45 E por entorno. La evidencia ignorada de
`tecnologia/.local/evidencia/001/us3/` vincula diez CA-REC con informes aprobados.
El corpus completo aprobado de producción continúa pendiente del despliegue;
el fixture no lo sustituye. T063/US5 y siguientes, las limitaciones anteriores
y la DoD global permanecen documentados; no se acredita la entrega completa de 001.

## 2. Trazabilidad inversa: de cada elemento de los diagramas C4 a su requisito

| Elemento C4 | Nivel | Requisitos y drivers que lo justifican |
|---|---|---|
| Aplicación web (React + Vite) | 2 | RC01, AC07, DA10, ADR-004 |
| API de la plataforma (NestJS) | 2 | RC06, DA07, ADR-001, ADR-003 |
| Base de datos (PostgreSQL) | 2 | AC09, DA04, ADR-005 |
| Caché (Redis) | 2 | AC01, DA02, ADR-010 |
| Almacenamiento de archivos | 2 | RF07, RF24, RF27, DA11, ADR-011 |
| Servicio de IA | 1, 2 | RF11, DA06, ADR-007, ADR-008 |
| Servicio de notificaciones | 1, 2 | RF35, DA05, ADR-009 |
| Mapas | 1, 2 | RF09, RC08, ADR-007 |
| Pasarela de pagos (futura) | 1, 2 | RC11, DA08 |
| Entrada API REST | 3 | RF04, DA03, ADR-006 |
| Módulo Contrataciones y acuerdos | 3 | RF20–RF26, RF33, DA04 |
| Repositorios y unidad de trabajo | 3, 4 | AC09, DA04, ADR-005 |
| Proceso de avisos (Outbox) | 3, despliegue | RF35, AC08, ADR-009 |
| AceptarPropuesta y sus puertos | 4 | RF20, RF21, RF22, ADR-002 |

## 3. Cobertura y verificaciones de coherencia

| Comprobación | Resultado |
|---|---|
| Cada historia de usuario tiene al menos un requisito funcional | 28 de 28 |
| Cada requisito funcional pertenece a una historia | 45 de 45 |
| Cada requisito del MVP está en una funcionalidad del 001 al 006 | 24 de 24 |
| Cada driver tiene al menos una decisión arquitectónica | 11 de 11 |
| Cada escenario de calidad tiene al menos una prueba | 9 de 9 |

## 4. Funcionalidades (SDD con Spec Kit)

| Func. | Nombre | Historias | Estado | Evidencia |
|---|---|---|---|---|
| 001 | Usuarios y acceso | HU01, HU02 | Parcial: fundación, US1, US2 y US3 verificadas | [Estado y pruebas](../specs/001-usuarios-y-acceso/implementation-status.md) |
| 002 | Prestadores y catálogo | HU03–HU05, HU25 | Planificada | `specs/002-…` |
| 003 | Solicitudes y cotizaciones | HU07, HU08, HU10, HU11 | Planificada | `specs/003-…` |
| 004 | Contratación | HU12, HU13, HU16 | Planificada | `specs/004-…` |
| 005 | Seguimiento y cierre | HU18, HU19 | Planificada | `specs/005-…` |
| 006 | Notificaciones | HU22 | Planificada | `specs/006-…` |

Al implementar cada funcionalidad se agrega aquí la lista de componentes construidos y los archivos de prueba que la verifican.

## 5. Diagramas y su evidencia

| Diagrama | Documento | Evidencia que aporta |
|---|---|---|
| Contexto (C4-1) | [Nivel 1](04-modelo-c4/01-nivel1-contexto.md) | Actores y sistemas externos |
| Contenedores (C4-2) | [Nivel 2](04-modelo-c4/02-nivel2-contenedores.md) | Tecnologías y comunicación |
| Componentes (C4-3) | [Nivel 3](04-modelo-c4/03-nivel3-componentes.md) | Módulos y relaciones numeradas |
| Clases y secuencia (C4-4) | [Nivel 4](04-modelo-c4/04-nivel4-codigo.md) | Diseño de AceptarPropuesta |
| Despliegue | [Despliegue](04-modelo-c4/05-despliegue.md) | Nodos y entrega continua |
| Estados | [Requisitos funcionales](01-analisis-de-sistema/03-requisitos-funcionales.md) | Ciclo de vida de solicitud, cotización y contratación |
| Modelo de datos | [Modelo de datos](03-diseno-de-software/modelo-de-datos.md) | Tablas e índice único parcial |

---

[Índice del proyecto](../README.md)
