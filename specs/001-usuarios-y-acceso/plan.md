# Implementation Plan: 001 — Usuarios y acceso

**Branch**: `main` (rama Git actual; no se crea otra) | **Date**: 2026-11-16 |
**Spec**: [spec.md](spec.md)

**Input**: `specs/001-usuarios-y-acceso/spec.md`, RF01–RF05 y HU01–HU02.
El identificador de contexto devuelto por setup es `001-usuarios-y-acceso`;
no equivale a una rama creada. `.specify/feature.json` fija esta funcionalidad.

## Summary

Diseñar registro, correo+contraseña, sesión, recuperación, edición de perfil,
cambio de correo/contraseña y habilitación de cliente/prestador en una misma cuenta.
Se conservan los 53 escenarios y las respuestas Q1–Q4; no se implementa código,
no se genera tasks.md y no se modifican las fuentes de arquitectura ni la spec.

Backend NestJS/TypeScript y web React+Vite/TypeScript dentro de `tecnologia/`.
Monolito modular con Dominio y Aplicación independientes de frameworks, PostgreSQL
como autoridad, TypeORM con migraciones y transacciones, y Redis reservado a caché
de lectura pública futura. Argon2id procesa la contraseña completa de 15–128 puntos
de código; no usar bcrypt directo ni truncar a 72 bytes.

Diseño detallado en [research](research.md), [modelo](data-model.md),
[contratos](contracts/README.md), [OpenAPI](contracts/openapi.json),
[matriz de 53 escenarios](test-matrix.md) y [guía](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 6 estricto; Node.js 24 LTS >=24.15. NestJS 12 ESM,
backend NodeNext y frontend Bundler. Fijar parches/lockfiles reproducibles al
implementar y comprobar matriz de dependencias antes de construir funcionalidades.

**Primary Dependencies**: NestJS12, React 19, Vite 8, TypeORM 0.3 estable y driver pg;
node-argon2, crypto de Node, Nodemailer SMTP y SDK S3 compatible; Jest 30 con SWC,
Vitest, Supertest, Playwright, dependency-cruiser, ESLint. Las versiones exactas
de paquetes auxiliares deben ser compatibles con estas líneas, sin usar betas
para resolver conflictos. No instalar dependencias en esta fase.

**Storage**: PostgreSQL 18 para cuentas, perfiles habilitados, sesiones, fallos,
desafíos, consentimiento, metadatos de fotos y resultados idempotentes. Argon2id PHC
en text. Imágenes en objetos compatibles S3; Garage local y S3 de producción
configurable. Redis no guarda sesiones, permisos, tokens, bloqueos ni datos privados.

**Testing**: Matriz explícita53/53; Jest unitario y PostgreSQL real para integración;
OpenAPI/Supertest para contrato; Vitest para interfaz; Playwright a 360/768/1366 px
en Chromium/Firefox/WebKit; dependency-cruiser para límites. PR04, PR07, PR12, PR13,
PR14 y soporte PR02. k6 caracteriza costos; no se inventa un SLA para registro.

**Target Platform**: Web responsive, mismo origen HTTPS en despliegue; backend
Node en contenedor Linux. Desarrollo Windows compatible mediante Docker Compose.
Datos de validación ficticios y correo capturado por Mailpit.

**Project Type**: Aplicación web con API REST y backend monolítico modular;
se generan solo artefactos de diseño.

**Performance Goals**: Corrección100% en el conjunto de aceptación, revocación
sin ventana residual, tiempos de seguridad de 300/900/1800 segundos y 7 d según spec.
Medir costo de Argon2id y memoria en entorno documentado antes de fijar capacidad.
No trasladar2 s de búsquedas ni5 min de solicitud a 001, ni inventar usuarios concurrentes.

**Constraints**: RF01–RF05/HU01–HU02; no RF06/RF07/RF10/RF35 funcionales ni
administración pública. Solo se añade soporte mínimo de correo dentro del mismo
monolito. Cuenta y datos autoritativos sin caché privada. Secretos fuera de código.
Foto opcional máxima10MB; JSON/base64 temporal, nunca binario en tablas.

**Scale/Scope**: Siete recorridos,53 CA,32 FR locales y 17 operaciones de contrato
(incluidos bootstrap y salud técnicos). Solo Usuarios y acceso y capacidad técnica
mínima de Notificaciones; los otros límites de los diez módulos se conservan para
fases posteriores, sin crear nueve esqueletos ni iniciar Contrataciones.

## Constitution Check

Evaluación de diseño antes de investigación y tras completar contratos/modelo,
contra constitución 1.0.1. «Conforme» acredita consistencia documental, no software probado.

| Principio | Puerta inicial | Comprobación posterior al diseño |
|---|---|---|
| I. Monolito modular | Conforme | Un backend; Usuarios y API pública mínima de Notificaciones; propiedad separada y mismo commit. |
| II. Clean Architecture | Conforme | Dominio puro; puertos de Aplicación; adaptadores TypeORM/SMTP/S3 y composición externa; PR12 planificada. |
| III. Integridad | Conforme | Índices únicos, versiones, locks y resultados idempotentes; regla de contratación preservada fuera de alcance. |
| IV. Seguridad | Conforme | Identidad+perfiles+titularidad; Argon2id completo; servidor decide300 s; sesiones y revocación DB; privacidad/consentimiento. |
| V. Outbox | Conforme | Aviso persistido con operación, entrega posterior; tabla de Notificaciones vía API; payload sensible cifrado. |
| VI. Adaptadores externos | Conforme | SMTP/S3 reemplazables con timeout, reintentos seguros y degradación; sin cola nueva. |
| VII. REST | Conforme | /api/v1, JSON español/camelCase, OpenAPI, errores, versiones e Idempotency-Key en mutaciones críticas. |
| VIII. Pago directo | No afectado | Sin cobros, pasarela ni registro de pagos en 001. |
| IX. Pruebas | Conforme |53 filas explícitas y pruebas de permisos, plazos, consumo concurrente y revocación; no pruebas ejecutadas. |
| X. Stack | Conforme | Nest/React/Vite/TS, PostgreSQL/TypeORM, Redis solo caché futura, Docker/Actions previstos. |
| XI. Trazabilidad | Conforme | CA→FR→RF/HU→AC/EQ→DA→ADR→módulo→nivel/prueba; fuentes sin renumerar. |
| XII. Simplicidad | Conforme | Sin microservicios, broker, sagas o capas vacías; worker dentro del mismo despliegue. |

**Puerta resuelta con el usuario**: la constitución pide replay de resultado y
CA-REC-04 rechaza enlace usado. El2026-11-16 se confirmó: misma clave+mismos datos
devuelve resultado anterior; otra clave con el enlace consumido se rechaza.
Se registra en research R12, contrato y matriz; no se introduce excepción ni
se cambia silenciosamente la spec. No quedan contradicciones que bloqueen el plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-usuarios-y-acceso/
├── spec.md                  # existente, se conserva
├── plan.md                  # este plan
├── research.md              # decisiones y alternativas resueltas
├── data-model.md            # entidades, estados, constraints y transacciones
├── test-matrix.md           #53 CA y controles transversales
├── quickstart.md            # validación futura; distingue estado actual
└── contracts/
    ├── openapi.json         # OpenAPI3.1,17 operaciones
    └── README.md            # flujos, seguridad, idempotencia y errores
```

`tasks.md` corresponde a `$speckit-tasks` y no se crea aquí. El único metadato
de flujo adicional es `.specify/feature.json`, fijado por setup-plan.

### Source Code (repository root)

**Estado observado**: solo README y ejemplo-clean-architecture; los 21 .ts del
ejemplo están vacíos, sin scripts/dependencias ejecutables. Conservarlo para004.
No existen backend/frontend. La estructura siguiente es una propuesta, no carpetas
creadas por este comando:

```text
tecnologia/
├── backend/
│   ├── src/
│   │   ├── modulos/
│   │   │   ├── usuarios-acceso/
│   │   │   │   ├── dominio/
│   │   │   │   ├── aplicacion/puertos/
│   │   │   │   ├── infraestructura/
│   │   │   │   ├── presentacion/
│   │   │   │   └── api-publica.ts
│   │   │   └── notificaciones/
│   │   │       ├── aplicacion/puertos/
│   │   │       ├── infraestructura/
│   │   │       └── api-publica.ts
│   │   ├── compartido/infraestructura/
│   │   └── composicion/
│   └── test/{unit,integration,contract,architecture}/
├── frontend/
│   ├── src/features/usuarios-acceso/
│   │   ├── modelos/
│   │   ├── aplicacion/
│   │   ├── infraestructura/
│   │   └── presentacion/
│   └── test/{unit,e2e}/
├── compose.yaml             # futuro entorno local, no generado aquí
└── ejemplo-clean-architecture/ # existente, fuera de implementación001
```

**Structure Decision**: módulos de negocio dentro de un único Nest; no convertir
las capas en servicios desplegables. Modelos puros de interfaz y contratos junto
a ellos; React solo en Presentación y HTTP solo en adaptadores. Las pruebas usan
las rutas previstas de test-matrix. Manifiestos/lockfiles separados de cada app.

## Phase 0 — Research

Investigación completada en [research.md](research.md): inventario, versiones,
Argon2id/Unicode, corpus de contraseñas, sesiones/CSRF, desafíos, concurrencia,
recencia, correo canónico, frontera Outbox, fotos e idempotencia.
Fuentes primarias y alternativas registradas. No hay NEEDS CLARIFICATION pendientes.

Decisiones que concretan opciones existentes: Argon2id frente a bcrypt directo;
Bearer opaco frente a JWT autónomo; PostgreSQL frente a sesiones en Redis;
Nodemailer+Mailpit y SES configurable; S3 compatible y Garage local.
No cambian decisiones de negocio ni las condiciones aprobadas de recuperación.

## Phase 1 — Design and Contracts

### Dominio, casos de uso y puertos

Dominio: Cuenta, PerfilesHabilitados, Sesión, Recuperación, CambioCorreo y políticas
de contraseña/recencia/titularidad. Sin decoradores Nest o TypeORM.
Aplicación coordina registro, login, cierre, renovación, reautenticación, solicitud
y consumo de recuperación, lectura/edición de perfil, habilitación, solicitud y
confirmación de correo, contraseña y fotografía.

Puertos de Aplicación: repositorios propios; UnidadDeTrabajo; HashContrasena;
CatalogoContrasenasRechazadas; Reloj; GeneradorSecretos; AlmacenamientoFotografias;
ProgramarCorreoSeguridad. Adaptadores y composición conectan TypeORM, crypto,
Argon2id, SMTP y objetos sin filtrar tipos del framework al núcleo.

API pública de Usuarios ofrece identidad/sesión y evaluación de perfiles/titularidad
para módulos futuros, sin exponer repositorios. La API mínima de Notificaciones
encola correos de seguridad en la misma transacción mediante infraestructura
vinculada a QueryRunner. Usuarios no accede directamente a avisos_pendientes.
No desarrollar UI, catálogo ni casos generales de RF35.

### Persistencia y atomicidad

[Modelo](data-model.md) define cuenta, perfiles, sesión, recuperaciones,
cambios de correo, fotos, consentimiento, outbox e idempotencia. Unicidad de correo
normalizado en DB; versión esperada en mutaciones; PK de perfil por cuenta.
Solo referencias de objetos, no bytes en tablas.

Orden de locks cuenta→sesión/desafío. Login y reautenticación calculan hash fuera
de locks y revalidan version_credencial antes de crear/acreditar sesión.
Reset confirma hash+invalidación de enlaces+revocación global+aviso+resultado en
un commit. Ningún JWT autónomo ni dato Redis puede conceder acceso después.
Consumir mismo enlace simultáneamente o frente a login/refresh se prueba con DB real.

### Autenticación, recuperación y correo

Acceso opaco900 s y renovación rotada de 7 d absolutos; acceso solo en memoria web,
cookie Secure/HttpOnly y CSRF/origen exacto para renovación. Comprobar sesión y
perfiles en DB en cada operación. Un DB error no habilita fallback permisivo.

Recuperación por correo registrado con texto genérico exacto; token impredecible
de un uso y 1800 s. No autoautenticar; invalidar todas las sesiones y renovaciones
y enlaces pendientes y avisar tras commit. Tokens de enlace en digest, payload
de entrega cifrado, logs redactados y ningún GET consume.

Correo nuevo: autenticar con contraseña hace <=300 s al solicitar, tomando la
marca de esa misma sesión; actividad/renovación no cuentan. Reautenticación
actualiza únicamente esa sesión. Verificar nuevo destino antes de cambiar,
sin repetir la condición de 300 s en confirmación; comprobar unicidad de nuevo.
No extender revocación global a cambio ordinario de correo/contraseña por inferencia.

### Frontend y permisos

Pantallas de registro, acceso, recuperación/establecimiento, cuenta y confirmación
de correo; formularios de contraseña y reautenticación y confirmación de perfil
faltante. Una cuenta puede mostrar ambos roles sin duplicar identidad.
No vistas administrativas ni perfil profesional. No confiar en ocultar controles:
casos de uso del servidor validan titularidad, perfiles y campos permitidos.

Correo/documentos/dirección privados; teléfono no compartible sin decisión
explícita asociada al valor autorizado. No localStorage con credenciales.
Fotografía opcional por JSON/base64 validado; carga y lectura controladas por API.

### Validación y entrega futura

La [matriz](test-matrix.md) contiene53 filas: REG11, SES9, REC10, AUT7, PER6,
COR6 y CLA4. Incluye300 s,1800 s,900 s,7 d,Unicode>72 bytes, one-use, replays,
sesiones previas y carreras. Unitarias no usan DB; integración usa PostgreSQL real;
contrato valida OpenAPI, permisos, secretos y errores; E2E completa recorridos
en tamaños/navegadores; arquitectura comprueba dependencias. CI futuro:
lint+typecheck+build+unit/integration/contract/architecture; E2E conserva evidencia.

La [guía](quickstart.md) define los scripts futuros y resultados esperados.
No existen hoy ni se ejecutan aquí comandos de aplicación. Primero tareas
ordenadas por historia; implementación posterior; luego pruebas y actualización
de README/API/trazabilidad global con evidencia real conforme a DoD.

## Complexity Tracking

Sin violaciones constitucionales ni excepciones solicitadas. El soporte de correo,
fotos, sesiones y pruebas responde a los CA de 001; no se añaden broker ni
infraestructura para funcionalidades ajenas. Si una futura implementación cambia
estas decisiones o amplía reglas de negocio, debe volver a especificación/ADR
y a la revisión constitucional antes de aplicarlo.
