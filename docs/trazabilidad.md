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
| 001 | Usuarios y acceso | HU01, HU02 | Planificada | `specs/001-…` |
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
