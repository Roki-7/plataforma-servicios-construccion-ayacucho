# Tecnologías

Este documento amplía ADR-013: compara alternativas por componente y justifica la elección.

## 1. Criterios de evaluación

| Criterio | Pregunta |
|---|---|
| Ajuste a la arquitectura | ¿Facilita el monolito modular y Clean Architecture? |
| Integridad de datos | ¿Permite transacciones e índices únicos parciales (DA04)? |
| Curva de aprendizaje | ¿Puede dominarse en el tiempo del curso? |
| Comunidad y documentación | ¿Tiene soporte activo y ejemplos? |
| Costo | ¿Es de código abierto o tiene plan gratuito? |
| Pruebas | ¿Permite automatizar pruebas por escenario? |

## 2. Evaluación por componente

| Componente | Elegida | Alternativas evaluadas | Motivo de la elección |
|---|---|---|---|
| Backend | **NestJS + TypeScript** | Spring Boot (Java), Django (Python) | Módulos e inyección de dependencias nativos; mismo lenguaje que el frontend. Spring Boot exige otro lenguaje; Django acopla más las reglas al framework. |
| Frontend | **React + Vite** | Angular, Vue | Ecosistema amplio, componentes reutilizables y compilación rápida; Angular tiene mayor curva de aprendizaje. |
| Base de datos | **PostgreSQL** | MySQL, MongoDB | Transacciones e índices únicos parciales; MongoDB no se ajusta a datos con relaciones fuertes (ADR-005). |
| Acceso a datos | **TypeORM** con migraciones | Prisma | Transacciones con `QueryRunner`, que implementan la unidad de trabajo; índices parciales en migraciones. |
| Caché | **Redis** | Caché en memoria del proceso | Compartida entre réplicas; la caché en memoria se pierde y no se comparte. |
| Archivos | **Almacenamiento de objetos** compatible con S3 | Disco del servidor | No depende de una réplica concreta; el proveedor se elige al desplegar. |
| Pruebas | **Jest, Vitest, Playwright, k6** | Mocha, Cypress, JMeter | Jest es el estándar de NestJS; Vitest el de Vite; Playwright prueba varios navegadores y tamaños (EQ-07); k6 mide rendimiento (EQ-01, EQ-03). |
| Contenedores | **Docker y Docker Compose** | Instalación manual | El mismo entorno en cualquier computadora. |
| Integración continua | **GitHub Actions** | GitLab CI | El repositorio ya está en GitHub (RC04). |
| Desarrollo guiado por especificaciones | **Spec Kit** | OpenSpec | Constitución, plan, contratos y tareas por funcionalidad; deja evidencia completa del proceso. |

## 3. Resumen

| Capa | Tecnología |
|---|---|
| Presentación (web) | React + Vite + TypeScript |
| API | NestJS + TypeScript |
| Datos | PostgreSQL + TypeORM |
| Caché | Redis |
| Archivos | Almacenamiento de objetos |
| Calidad | Jest, Vitest, Playwright, k6, ESLint |
| Entrega | Docker, GitHub Actions |

## 4. Integraciones externas

Los proveedores de IA, notificaciones y mapas se eligen al implementar cada integración. Gracias a los puertos y adaptadores (ADR-007), cambiar de proveedor no modifica los casos de uso. La pasarela de pagos queda para una etapa futura (RC11).

---

[Índice del proyecto](../../README.md)
