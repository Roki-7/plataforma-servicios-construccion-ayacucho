# Specification Quality Checklist: 003 — Solicitudes y cotizaciones

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-26
**Updated**: 2026-11-26 (tras la revisión de calidad)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — **con salvedad**, ver Notas
- [x] Focused on user value and business needs
- [ ] Written for non-technical stakeholders — **parcial; no se declara cumplido**, ver Notas
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — **con la misma salvedad**, ver Notas

## Notes

**Reevaluación honesta (2026-11-26).** Es una autoevaluación del asistente y no sustituye la revisión del Product Owner.

- **Detalles de implementación.** Se retiraron los mecanismos técnicos (transacciones, bloqueos, interbloqueos, disparadores, reloj de la base de datos, nombres de tecnologías). Se verificó con una búsqueda y no aparecen. **Salvedad:** se mantienen los códigos de error estables y los estados HTTP de la sección «Respuestas de error observables» y de los escenarios. Son contrato observable que exige la constitución VII y tiene precedente en la 002, pero técnicamente son «APIs». Si el Product Owner prefiere una especificación sin ellos, deben moverse al plan.
- **Valor para el negocio.** Se añadió un «Resumen funcional (lenguaje llano)» al inicio de la especificación (para qué sirve, qué hace cada persona, qué protege y qué no hace todavía) y las cuatro historias de usuario describen el valor. Con eso se marca cumplido.
- **No técnicos.** El resumen en lenguaje llano y las historias de usuario son legibles sin contexto técnico. El resto de la especificación es denso (identificadores, versiones de control y de trabajo, títulos de acceso, códigos de error) y está pensado para el Product Owner y el equipo. Por eso la casilla **no se marca**: sería afirmar algo que no es cierto para todo el documento.
- **«Feature meets measurable outcomes».** Significa que SC-301 a SC-306 están definidos y son verificables. **No acredita su cumplimiento: no hay mediciones ni evidencia de ejecución.**
- **Cobertura verificada al actualizar.** 48 requisitos `FR-301` a `FR-348`, 6 criterios `SC-301` a `SC-306` y 109 escenarios `CA-…` únicos, sin colisión con la 001 ni la 002 en `specs/`, `docs/`, README ni `tecnologia/`. Cada requisito tiene al menos un escenario según el mapa de verificación. `CA-VER-07` (editar un borrador no crea versiones) se apoya en FR-307 y FR-308. SC-302, SC-303, SC-304 y SC-306 son evidencias de calidad (PR06, PR01, PR07, PR12) y no necesitan escenario `CA`.
- **Numeración.** `FR-347` y `FR-348` se añadieron después de `FR-346` y están ubicados en su sección temática. No se renumeró para conservar las referencias aprobadas (FR-307, FR-309 y otras).
- **Alineación con códigos existentes.** `DATOS_INVALIDOS` (400), `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `RECURSO_NO_DISPONIBLE`, `DEPENDENCIA_NO_DISPONIBLE`, `IMAGEN_FORMATO_NO_ADMITIDO` y `ARCHIVO_DEMASIADO_GRANDE` ya existen en el código de la 001 o la 002 y se reutilizan. Los demás códigos de la tabla son nuevos.
- **Parámetros de diseño** (2 000 y 500 caracteres, 1 000 por mensaje, 20 mensajes, 10 cotizaciones, «9 o más dígitos» para teléfonos) están documentados como tales y podrán ajustarse con la carga y las pruebas reales.
- **Pendientes que corresponden al plan, no a la especificación:** el diseño técnico, el procedimiento y la frecuencia de limpieza física, el control de objetos pendientes, las operaciones del contrato y los criterios de carga. FR-322 solo se verifica cuando el plan los fije.
- Los diferimientos E1 (ampliado) y E2 y sus riesgos están en la sección *Diferimientos aprobados* de la especificación. Las notificaciones no se declaran completas.
