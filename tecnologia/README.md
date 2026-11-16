# Tecnología e implementación

La plataforma se construye con **desarrollo guiado por especificaciones** usando Spec Kit. La funcionalidad 001 tiene implementadas sus bases técnicas; las historias de usuario aún están pendientes.

| Carpeta | Contenido | Estado |
|---|---|---|
| `backend/` | NestJS/TypeScript, PostgreSQL, seguridad, Outbox, fotos privadas e imagen Linux. | Fundación; solo endpoint de salud. |
| `frontend/` | React + Vite, contratos y adaptador HTTP. | Base técnica; sin pantallas de historias. |
| `ejemplo-clean-architecture/` | Esqueleto vacío del módulo Contrataciones según el diseño interno. | Se reemplaza por el módulo real en la funcionalidad 004. |

El stack está definido en ADR-013 y los principios que debe cumplir el código están en la constitución (`.specify/memory/constitution.md`).

La [guía de validación](../specs/001-usuarios-y-acceso/quickstart.md) describe
preparación, arranque y verificaciones. El [estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
registra tareas, evidencia y bloqueos. Compose publica dependencias solo en
loopback; Redis no conserva sesiones ni datos privados de 001. Los secretos,
certificados, corpus y reportes locales están excluidos de Git y de la imagen.
