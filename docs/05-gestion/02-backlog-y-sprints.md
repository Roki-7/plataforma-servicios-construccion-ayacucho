# Product Backlog y plan de entrega

## 1. Product Backlog

El backlog se ordena por prioridad MoSCoW y por dependencias entre módulos. Cada grupo de historias se convierte en una funcionalidad de Spec Kit.

| Funcionalidad | Historias | Requisitos | Prioridad | Módulos |
|---|---|---|---|---|
| 001 Usuarios y acceso | HU01, HU02 | RF01–RF05 | Debe (MVP) | Usuarios y acceso |
| 002 Prestadores y catálogo | HU03, HU04, HU05, HU25 | RF06, RF08–RF10, RF39 | Debe (MVP) | Prestadores, Catálogo y búsqueda |
| 003 Solicitudes y cotizaciones | HU07, HU08, HU10, HU11 | RF12–RF14, RF17–RF19 | Debe (MVP) | Solicitudes y visitas, Cotizaciones |
| 004 Contratación | HU12, HU13, HU16 (estado) | RF20–RF22, RF26 | Debe (MVP) | Contrataciones y acuerdos |
| 005 Seguimiento y cierre | HU18, HU19 | RF30–RF32 | Debe (MVP) | Seguimiento y pagos registrados |
| 006 Notificaciones | HU22 | RF35 | Debe (MVP) | Notificaciones |
| 007 Asistente de IA | HU06 | RF11 | Debería | Catálogo y búsqueda |
| 008 Contacto y visitas | HU09 | RF15, RF16 | Debería | Solicitudes y visitas |
| 009 Acuerdos y documentos | HU14, HU15 | RF23–RF25 | Debería / Podría | Contrataciones y acuerdos |
| 010 Avances y pagos registrados | HU16, HU17 | RF27–RF29 | Debería | Seguimiento y pagos registrados |
| 011 Cancelación, calificación e historial | HU20, HU21, HU23 | RF33, RF34, RF36 | Debería | Contrataciones, Calificaciones |
| 012 Verificación y administración | HU24, HU26, HU27, HU28 | RF07, RF37, RF38, RF40–RF45 | Debería / Podría | Prestadores, Administración e incidencias |

Las funcionalidades 001 a 006 cubren los **24 requisitos del MVP**.

**Dependencias que afectan a la 002.** El filtro de búsqueda por calificación (RF09) y la identificación de prestadores sin valoraciones reales dependen de **011** (RF34); la verificación de prestadores (RF07) y el alcance completo de RF45 dependen de **012**. La 002 los difiere con avisos explícitos y no los promete. La 002 depende de 001 (identidad); 003 consumirá la elegibilidad de servicios que expone la API interna de Catálogo.

**Estado de la 002 (en validación, rama `002-prestadores-y-catalogo`; no fusionada en `main`).** Completadas HU03, HU04, HU05 y HU25 en validación local, con EQ-01 y EQ-03 medidas y PR07 parcial (T080 cerrada por excepción). Siguen pendientes el cierre documental (T093 y T094), la integración continua y la revisión del pull request. Solo se considera «implementado» lo fusionado en `main`.

## 2. Plan de sprints

| Sprint | Objetivo | Entregable | Estado |
|---|---|---|---|
| 1 | Análisis del sistema | Contexto, actores, HU, RF, atributos, restricciones, drivers, ADR y escenarios | Terminado |
| 2 | Diseño arquitectónico | Estilo, enfoque, componentes, diseño interno, modelo C4 y diagramas | Terminado |
| 3 | Base de SDD y acceso | Constitución y funcionalidad 001 | Planificado |
| 4 | Oferta y demanda | Funcionalidades 002 y 003 | Planificado |
| 5 | Contratación | Funcionalidades 004 y 006 (integridad y avisos) | Planificado |
| 6 | Cierre del MVP | Funcionalidad 005, pruebas de calidad (EQ-01, EQ-04, EQ-09) y exposición | Planificado |

Las fechas de cada sprint se ajustan al calendario del curso.

## 3. Líneas de corte

Si el tiempo no alcanza, se recorta en este orden, sin afectar el núcleo del sistema:

1. Se mantienen siempre 001, 003 y 004: sin ellas no hay contratación.
2. Si falta tiempo, 002 se reduce a categorías y búsqueda por filtros.
3. 005 y 006 pueden entregarse con avisos visibles solo dentro de la plataforma.
4. Las funcionalidades 007 a 012 pasan a la evolución futura.

## 4. Qué se informa y qué no

- Se informa como **implementado** solo lo que tiene código, pruebas en verde y está fusionado en `main`.
- Las metas de calidad (EQ) se presentan como **propuestas** hasta que se midan.

---

[Índice del proyecto](../../README.md)
