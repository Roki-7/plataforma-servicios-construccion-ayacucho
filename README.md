<div align="center">

# 🏗️ Plataforma web para la búsqueda y contratación de servicios de construcción civil en Ayacucho

**Documentación de arquitectura de software · Proyecto final del curso de Arquitectura de Software**

![Curso](https://img.shields.io/badge/curso-Arquitectura%20de%20Software-1f6feb)
![Semestre](https://img.shields.io/badge/semestre-2026--II-8957e5)
![Estilo](https://img.shields.io/badge/estilo-monolito%20modular-2da44e)
![Enfoque](https://img.shields.io/badge/enfoque-Clean%20Architecture-d29922)
![Modelo](<https://img.shields.io/badge/modelo-C4%20(4%20niveles)-0969da>)
![SDD](https://img.shields.io/badge/SDD-Spec%20Kit-6e7781)

_Una plataforma web donde los clientes encuentran, comparan y contratan servicios de construcción civil, y los prestadores de Ayacucho ofrecen su trabajo con acuerdos claros y seguimiento._

</div>

---

## 📌 Datos del proyecto

| Campo | Valor |
|---|---|
| **Autor** | Anderson Ochoa |
| **Curso** | Arquitectura de Software |
| **Universidad** | Universidad Nacional de San Cristóbal de Huamanga (UNSCH) |
| **Semestre** | 2026-II |
| **Entregable** | Documentación de arquitectura y aplicación construida por funcionalidades (SDD con Spec Kit) |

## 🎯 1. Descripción del caso de estudio

En Ayacucho, quien necesita una reparación o una obra suele buscar al maestro por recomendaciones, sin poder comparar precios ni dejar por escrito lo acordado. La plataforma conecta a **clientes** con **prestadores de servicios** —trabajadores de oficio, técnicos, profesionales y empresas— para **buscar, solicitar, cotizar, contratar, dar seguimiento y cerrar** un trabajo.

### Decisiones de alcance cerradas

| Decisión | Detalle |
|---|---|
| Plataforma | **Solo web** con diseño responsive (celular, tableta y computadora). |
| Pagos | El cliente **paga directamente al prestador**; la plataforma solo registra los pagos declarados y confirmados. |
| Estilo | **Monolito modular** de 10 módulos de negocio. |
| Enfoque | **Clean Architecture** dentro de cada módulo. |
| Integridad | **Una sola contratación activa por solicitud**, protegida en la base de datos. |
| Cobertura inicial | Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray. |
| Futuro | Pasarela de pagos para cobrar planes de la plataforma y ampliación a otras zonas. |

## 🗺️ 2. Mapa de lectura

El orden sigue el proceso del curso: _primero se analizan las necesidades, luego se toman las decisiones de arquitectura_.

### Análisis

| Paso | Documento |
|---|---|
| 0. Contexto y problemática | [00-contexto-y-problematica.md](docs/01-analisis-de-sistema/00-contexto-y-problematica.md) |
| 1. Actores | [01-actores.md](docs/01-analisis-de-sistema/01-actores.md) |
| 2. Historias de usuario | [02-historias-de-usuario.md](docs/01-analisis-de-sistema/02-historias-de-usuario.md) |
| 3. Requisitos funcionales y estados | [03-requisitos-funcionales.md](docs/01-analisis-de-sistema/03-requisitos-funcionales.md) |
| 4. Atributos de calidad | [04-atributos-de-calidad.md](docs/01-analisis-de-sistema/04-atributos-de-calidad.md) |
| 5. Restricciones | [05-restricciones.md](docs/01-analisis-de-sistema/05-restricciones.md) |
| 6. Drivers arquitectónicos | [06-drivers-arquitectonicos.md](docs/01-analisis-de-sistema/06-drivers-arquitectonicos.md) |
| 7. Decisiones arquitectónicas (ADR) | [07-decisiones-arquitectonicas.md](docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md) |
| 8. Escenarios de calidad | [08-escenarios-atributos-calidad.md](docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md) |
| 9. Glosario | [09-glosario.md](docs/01-analisis-de-sistema/09-glosario.md) |

### Arquitectura y diseño

| Tema | Documento |
|---|---|
| Arquitectura inicial | [arquitectura-inicial.md](docs/02-arquitectura-software/arquitectura-inicial.md) |
| Estilo: monolito modular | [estilo-arquitectonico.md](docs/02-arquitectura-software/estilo-arquitectonico.md) |
| Enfoque: Clean Architecture | [enfoque-arquitectonico.md](docs/02-arquitectura-software/enfoque-arquitectonico.md) |
| Componentes | [componentes-arquitectonicos.md](docs/02-arquitectura-software/componentes-arquitectonicos.md) |
| Tácticas | [tacticas-arquitectonicas.md](docs/02-arquitectura-software/tacticas-arquitectonicas.md) |
| API REST | [api-rest.md](docs/02-arquitectura-software/api-rest.md) |
| Caché con Redis | [estrategia-de-cache.md](docs/02-arquitectura-software/estrategia-de-cache.md) |
| Seguridad y privacidad | [seguridad-y-privacidad.md](docs/02-arquitectura-software/seguridad-y-privacidad.md) |
| Tecnologías | [tecnologias.md](docs/02-arquitectura-software/tecnologias.md) |
| Modelo de datos | [modelo-de-datos.md](docs/03-diseno-de-software/modelo-de-datos.md) |
| Diseño interno | [diseno-interno-de-modulos.md](docs/03-diseno-de-software/diseno-interno/diseno-interno-de-modulos.md) |
| Patrones de diseño | [patrones-de-diseno.md](docs/03-diseno-de-software/diseno-interno/patrones-de-diseno.md) |
| Principios SOLID | [principios-de-diseno.md](docs/03-diseno-de-software/diseno-interno/principios-de-diseno.md) |

### Modelo C4

| Nivel | Documento |
|---|---|
| 1. Contexto del sistema | [01-nivel1-contexto.md](docs/04-modelo-c4/01-nivel1-contexto.md) |
| 2. Contenedores | [02-nivel2-contenedores.md](docs/04-modelo-c4/02-nivel2-contenedores.md) |
| 3. Componentes | [03-nivel3-componentes.md](docs/04-modelo-c4/03-nivel3-componentes.md) |
| 4. Código y secuencia | [04-nivel4-codigo.md](docs/04-modelo-c4/04-nivel4-codigo.md) |
| Despliegue | [05-despliegue.md](docs/04-modelo-c4/05-despliegue.md) |

### Gestión y trazabilidad

| Tema | Documento |
|---|---|
| Scrum | [01-scrum.md](docs/05-gestion/01-scrum.md) |
| Backlog y sprints | [02-backlog-y-sprints.md](docs/05-gestion/02-backlog-y-sprints.md) |
| Desarrollo guiado por especificaciones (SDD) | [03-sdd-spec-kit.md](docs/05-gestion/03-sdd-spec-kit.md) |
| Pruebas | [04-pruebas.md](docs/05-gestion/04-pruebas.md) |
| Riesgos | [05-riesgos.md](docs/05-gestion/05-riesgos.md) |
| MVP y evolución | [06-mvp-y-evolucion.md](docs/05-gestion/06-mvp-y-evolucion.md) |
| Guion de exposición y defensa | [07-guion-exposicion-y-defensa.md](docs/05-gestion/07-guion-exposicion-y-defensa.md) |
| Adopción y capacitación | [08-adopcion-y-capacitacion.md](docs/05-gestion/08-adopcion-y-capacitacion.md) |
| **Trazabilidad** HU → RF → AC/EQ → DA → ADR → módulo → prueba | [trazabilidad.md](docs/trazabilidad.md) |

## 🧱 3. Estructura del proyecto

```text
plataforma-construccion-ayacucho/
│
├── README.md                                   ← este archivo
│
├── docs/                                       ← toda la documentación
│   ├── 01-analisis-de-sistema/                 qué necesita el sistema
│   │   ├── 00-contexto-y-problematica.md
│   │   ├── 01-actores.md
│   │   ├── 02-historias-de-usuario.md          HU01–HU28
│   │   ├── 03-requisitos-funcionales.md        RF01–RF45 y diagramas de estados
│   │   ├── 04-atributos-de-calidad.md          AC01–AC09
│   │   ├── 05-restricciones.md                 RC01–RC15
│   │   ├── 06-drivers-arquitectonicos.md       DA01–DA11
│   │   ├── 07-decisiones-arquitectonicas.md    ADR-001–ADR-013
│   │   ├── 08-escenarios-atributos-calidad.md  EQ-01–EQ-09
│   │   └── 09-glosario.md
│   │
│   ├── 02-arquitectura-software/               cómo se organiza el sistema
│   │   ├── arquitectura-inicial.md
│   │   ├── estilo-arquitectonico.md
│   │   ├── enfoque-arquitectonico.md
│   │   ├── componentes-arquitectonicos.md
│   │   ├── tacticas-arquitectonicas.md
│   │   ├── api-rest.md
│   │   ├── estrategia-de-cache.md
│   │   ├── seguridad-y-privacidad.md
│   │   └── tecnologias.md
│   │
│   ├── 03-diseno-de-software/
│   │   ├── modelo-de-datos.md
│   │   └── diseno-interno/
│   │       ├── diseno-interno-de-modulos.md
│   │       ├── patrones-de-diseno.md
│   │       └── principios-de-diseno.md
│   │
│   ├── 04-modelo-c4/                           los cuatro niveles y el despliegue
│   │   ├── 01-nivel1-contexto.md
│   │   ├── 02-nivel2-contenedores.md
│   │   ├── 03-nivel3-componentes.md
│   │   ├── 04-nivel4-codigo.md
│   │   └── 05-despliegue.md
│   │
│   ├── 05-gestion/                             cómo se organiza el trabajo
│   │   ├── 01-scrum.md
│   │   ├── 02-backlog-y-sprints.md
│   │   ├── 03-sdd-spec-kit.md
│   │   ├── 04-pruebas.md
│   │   ├── 05-riesgos.md
│   │   ├── 06-mvp-y-evolucion.md
│   │   ├── 07-guion-exposicion-y-defensa.md
│   │   └── 08-adopcion-y-capacitacion.md
│   │
│   └── trazabilidad.md                         matriz que une todo lo anterior
│
├── img/                                        15 diagramas en PNG
│   └── fuentes-svg/                            sus fuentes editables (.drawio) y versiones SVG
│
├── .specify/memory/constitution.md             constitución del proyecto (Spec Kit)
│
├── specs/                                      una carpeta por funcionalidad (Spec Kit)
│   ├── 001-usuarios-y-acceso/                  spec, plan, data-model, contracts, tasks
│   └── …
│
└── tecnologia/                                 ← la aplicación (se construye con SDD)
    ├── backend/                                NestJS: monolito modular con 10 módulos
    └── frontend/                               React + Vite
```

## 🧩 4. Módulos del sistema

| Área | Módulos |
|---|---|
| **Oferta** | Usuarios y acceso · Prestadores · Catálogo y búsqueda |
| **Contratación** | Solicitudes y visitas · Cotizaciones · Contrataciones y acuerdos · Seguimiento y pagos registrados · Calificaciones |
| **Soporte** | Notificaciones · Administración e incidencias |

## 🛠️ 5. Stack tecnológico

| Parte | Tecnología |
|---|---|
| Frontend | React + Vite con TypeScript |
| Backend | NestJS con TypeScript |
| Base de datos | PostgreSQL |
| Caché | Redis |
| Pruebas | Jest, Vitest, Playwright y k6 |
| Contenedores e integración continua | Docker Compose y GitHub Actions |
| Desarrollo guiado por especificaciones | Spec Kit |

La comparación de alternativas está en [tecnologias.md](docs/02-arquitectura-software/tecnologias.md) y la decisión en ADR-013.

## 📋 6. Desarrollo guiado por especificaciones (SDD)

Primero se escribe la especificación y después el código. Cada funcionalidad recorre: **constitución → especificación → aclaraciones → plan → tareas → análisis → implementación**. El detalle está en [03-sdd-spec-kit.md](docs/05-gestion/03-sdd-spec-kit.md).

| N.º | Funcionalidad | Requisitos | Prioridad | Estado |
|---|---|---|---|---|
| 001 | Usuarios y acceso | RF01–RF05 | MVP | Siete historias implementadas, cierre en verificación |
| 002 | Prestadores y catálogo | RF06, RF08–RF10, RF39 | MVP | Planificada |
| 003 | Solicitudes y cotizaciones | RF12–RF14, RF17–RF19 | MVP | Planificada |
| 004 | Contratación | RF20–RF22, RF26 | MVP | Planificada |
| 005 | Seguimiento y cierre | RF30–RF32 | MVP | Planificada |
| 006 | Notificaciones | RF35 | MVP | Planificada |

## ▶️ 7. Cómo ejecutar

La aplicación de validación de 001 incluye registro, sesiones, recuperación, permisos y privacidad, edición de perfil y cambios controlados de correo y contraseña. El arranque local y la evidencia del cierre se describen en [tecnologia/README.md](tecnologia/README.md) y [estado de implementación](specs/001-usuarios-y-acceso/implementation-status.md).

## 📎 8. Alcance de esta entrega

- **Completo:** análisis, arquitectura, diseño, modelo C4, gestión y trazabilidad.
- **En curso:** especificaciones con Spec Kit y su implementación, funcionalidad por funcionalidad.
- Las metas de calidad (EQ) son **propuestas** hasta que se midan en un despliegue real.
- Los trabajos de construcción se pagan directamente al prestador; la plataforma no procesa ni verifica transferencias.
