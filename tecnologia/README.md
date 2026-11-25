# Tecnología e implementación

La plataforma se construye con **desarrollo guiado por especificaciones** usando Spec Kit. La funcionalidad 001 tiene siete historias implementadas y un cierre transversal documentado por tarea. La funcionalidad 002 (prestadores y catálogo) está implementada y verificada en la rama `002-prestadores-y-catalogo`, pendiente de integración continua y de la revisión del pull request; no está fusionada en `main`.

| Carpeta | Contenido | Estado |
|---|---|---|
| `backend/` | NestJS/TypeScript, PostgreSQL, Redis, seguridad, Outbox, fotos privadas e imagen Linux. | 17 operaciones de 001 y, con la composición completa de 002, 40 en total (17 + 23). |
| `frontend/` | React + Vite, contratos y adaptador HTTP. | Recorridos de 001 con Playwright y Mailpit; recorridos y accesibilidad de 002 en 9 proyectos de navegador. |
| `ejemplo-clean-architecture/` | Esqueleto vacío del módulo Contrataciones según el diseño interno. | Se reemplaza por el módulo real en la funcionalidad 004. |

El stack está definido en ADR-013 y los principios que debe cumplir el código están en la constitución (`.specify/memory/constitution.md`).

La [guía de validación de 002](../specs/002-prestadores-y-catalogo/quickstart.md) distingue `dev:prepare:002`, Compose, migración, inicialización y siembra, la confianza TLS, el respaldo y la restauración coordinados y las suites E2E y de carga, y su [estado](../specs/002-prestadores-y-catalogo/implementation-status.md) registra la evidencia. La [guía de validación de 001](../specs/001-usuarios-y-acceso/quickstart.md) describe
preparación, arranque y verificaciones. El [estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
registra tareas, evidencia y bloqueos. Compose publica dependencias solo en
loopback; Redis no conserva sesiones ni datos privados de 001. Los secretos,
certificados, corpus y reportes locales están excluidos de Git y de la imagen.

CI instala desde lockfiles y usa un certificado local de validación, PostgreSQL,
Garage, Mailpit y el fixture del catálogo. El despliegue requiere el corpus
productivo aprobado. [Flujo de validación](../.github/workflows/usuarios-acceso.yml)
