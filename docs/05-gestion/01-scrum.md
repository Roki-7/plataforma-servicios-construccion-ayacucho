# Scrum adaptado al contexto universitario

El proyecto se organiza con Scrum, adaptado a un equipo de una persona y al calendario del curso.

## 1. Roles

| Rol | Responsable | Responsabilidad |
|---|---|---|
| Product Owner | Anderson Ochoa | Prioriza el backlog con MoSCoW y aprueba cada especificación. |
| Scrum Master | Anderson Ochoa | Organiza los sprints y elimina bloqueos. |
| Equipo de desarrollo | Anderson Ochoa, con un asistente de IA | Especifica, implementa y prueba cada funcionalidad. |
| Interesados | Docente del curso, clientes y prestadores de Ayacucho | Revisan los entregables y validan el alcance. |

## 2. Artefactos

| Artefacto | Dónde está |
|---|---|
| Product Backlog | Historias de usuario HU01–HU28 y su priorización, en [02-backlog-y-sprints.md](02-backlog-y-sprints.md). |
| Sprint Backlog | El archivo `tasks.md` de la funcionalidad en curso dentro de `specs/`. |
| Incremento | El código y la documentación fusionados en la rama `main`. |

## 3. Eventos

| Evento | Cuándo | Resultado |
|---|---|---|
| Planificación del sprint | Al inicio de cada sprint | Funcionalidades elegidas y su especificación con `$speckit-specify`. |
| Revisión diaria | Al empezar cada sesión de trabajo | Avance de `tasks.md` y bloqueos. |
| Revisión del sprint | Al cierre | Demostración al docente o a usuarios de prueba. |
| Retrospectiva | Al cierre | Qué mejorar en el siguiente sprint, registrado en el pull request. |

## 4. Definition of Done (DoD)

Una funcionalidad está terminada cuando:

- [ ] Tiene `spec.md`, `plan.md` y `tasks.md` en `specs/` y respeta la constitución.
- [ ] Todas las tareas están marcadas.
- [ ] Cada escenario de aceptación tiene su prueba y todas pasan.
- [ ] Lint, pruebas y build pasan en la integración continua.
- [ ] Las pruebas de permisos y, si aplica, de concurrencia están incluidas.
- [ ] La documentación afectada (API, trazabilidad, README) está actualizada.
- [ ] El pull request fue revisado y fusionado en `main`.

## 5. Flujo de ramas y revisión

| Paso | Acción |
|---|---|
| 1 | `$speckit-specify` crea la rama de la funcionalidad, por ejemplo `001-usuarios-y-acceso`. |
| 2 | Cada paso de Spec Kit (especificación, plan, tareas, implementación) se guarda con su propio commit. |
| 3 | Se abre un pull request hacia `main`. |
| 4 | Se revisa en una sesión nueva del asistente y de forma manual contra `spec.md` y la constitución. |
| 5 | Se fusiona cuando la integración continua está en verde. |

Convención de commits: `tipo(alcance): descripción`, por ejemplo `feat(contrataciones): aceptar cotización definitiva`.

---

[Índice del proyecto](../../README.md)
