<!--
Sync Impact Report — material temporal de revisión; retirar antes del commit.
Cambio de versión: 1.0.0 → 1.0.1.
Motivo: corrección documental y de metadatos sin cambios normativos.
Principios modificados: ninguno; se conservan los doce principios I–XII.
Secciones añadidas: ninguna.
Secciones eliminadas: ninguna.
Sección actualizada: Governance y metadatos de ratificación.
Documento sincronizado: docs/01-analisis-de-sistema/05-restricciones.md ahora
reconoce PostgreSQL como base de datos seleccionada según README y ADR-013.
Pendientes resueltos:
- Fecha de ratificación: 2026-11-16, confirmada por el usuario.
- Discrepancia sobre la base de datos: corregida en restricciones; se conserva
  PostgreSQL y la selección futura de proveedores de IA, notificaciones y mapas.
Pendientes restantes: ninguno.
No se modifican plantillas, comandos ni código de la aplicación.
-->

# Plataforma de servicios de construcción civil en Ayacucho Constitution

## Core Principles

DEBE, DEBEN y NO DEBE expresan obligaciones verificables. Estos principios
formalizan decisiones documentadas; no acreditan implementación ni pruebas ejecutadas.

### I. Monolito modular con diez módulos

El backend DEBE ser una aplicación de servidor con despliegue conjunto y diez
módulos: Usuarios y acceso; Prestadores; Catálogo y búsqueda; Solicitudes y visitas;
Cotizaciones; Contrataciones y acuerdos; Seguimiento y pagos registrados;
Calificaciones; Notificaciones; Administración e incidencias.

Cada módulo DEBE conservar la propiedad de sus datos y comunicarse con los demás
mediante su API pública interna. Compartir PostgreSQL o herramientas de acceso
NO DEBE permitir acceder a detalles internos ni modificar tablas ajenas por fuera
de esas operaciones. Las operaciones entre módulos que requieran atomicidad DEBEN
coordinarse mediante transacciones locales. El estado de la contratación pertenece
a Contrataciones y acuerdos; los demás módulos solicitan sus transiciones mediante
operaciones públicas.

Esto conserva límites de responsabilidad sin coordinación distribuida.
Origen: ADR-001, DA04, DA08 y estilo arquitectónico.

### II. Clean Architecture y dependencias hacia el negocio

Los módulos de negocio DEBEN separar Dominio, Aplicación, Infraestructura y
Presentación, con dependencias hacia el negocio. Dominio NO DEBE importar
frameworks, ORM, clientes HTTP, proveedores externos ni otros módulos. Aplicación
DEBE coordinar casos de uso y depender de contratos internos, sin depender de
implementaciones concretas de persistencia o integración.

Los puertos de salida del backend DEBEN definirse en Aplicación y sus adaptadores
en Infraestructura. Presentación DEBE traducir peticiones y resultados, sin alojar
reglas de contratación. La raíz de composición conecta las implementaciones.
El frontend DEBE separar pantallas, casos de uso, modelos y adaptadores HTTP;
su dominio tampoco debe depender de React ni de proveedores. NO DEBEN crearse
capas o interfaces sin una responsabilidad concreta.

La independencia permite probar reglas y sustituir detalles técnicos.
Origen: ADR-002 y enfoque arquitectónico.

### III. Integridad de contrataciones (no negociable)

Una solicitud DEBE tener como máximo una contratación activa, incluidos los estados
`EN_CONFIRMACION`, `CONFIRMADA`, `EN_EJECUCION` y `CIERRE_SOLICITADO`.
La regla DEBE protegerse con un índice único parcial en PostgreSQL y validarse en
los casos de uso; una comprobación previa en memoria no basta.

Aceptar una cotización DEBE guardar atómicamente los cambios relacionados y sus
avisos pendientes. Las operaciones críticas DEBEN controlar concurrencia, versiones
e idempotencia: repetir una petición con la misma clave DEBE devolver el resultado
previo sin duplicar registros. Los conflictos DEBEN expresarse según el contrato
REST, incluido 409 `CONTRATACION_ACTIVA_EXISTENTE`. Solo se DEBEN aceptar
cotizaciones definitivas y vigentes, validando actor, disponibilidad y transiciones.

Los acuerdos DEBEN conservar versiones y aceptaciones. Los cambios de condiciones
requieren aceptación de ambas partes. El historial del trabajo y la auditoría
administrativa DEBEN mantenerse separados, sin sobrescrituras silenciosas.
La auditoría DEBE identificar responsable, fecha, acción y motivo.

Origen: DA04, DA11, ADR-005, ADR-012, RF20–RF25 y EQ-09.

### IV. Seguridad por identidad, rol y participación

La autenticación DEBE centralizarse. Cada operación protegida DEBE comprobar en el
servidor identidad, permiso y participación sobre el recurso, aplicando mínimo
privilegio. Ocultar botones no sustituye estos controles. Una cuenta con perfiles
de cliente y prestador DEBE evaluarse según su papel en cada operación.

Las contraseñas DEBEN almacenarse como hash con bcrypt o Argon2, nunca en texto
plano ni en registros. DEBEN aplicarse los controles documentados: bloqueo de
15 minutos tras 5 intentos fallidos; acceso de 15 minutos; renovación hasta 7 días
con cookie `httpOnly` y `Secure`; invalidación de renovación al cerrar sesión;
recuperación de un solo uso que vence en 30 minutos. Las entradas DEBEN validarse
y las consultas SQL DEBEN parametrizarse.

Las credenciales externas DEBEN permanecer en variables de entorno del servidor,
fuera del navegador y del repositorio. Los archivos privados y direcciones exactas
DEBEN limitarse a usuarios autorizados. El perfil público NO DEBE exponer correo,
documento ni dirección exacta. DEBEN usarse HTTPS y copias de seguridad.

El tratamiento de datos DEBE ajustarse a RC14 y al marco identificado por el
proyecto: Ley N.º 29733 del Perú y su reglamento. DEBEN respetarse consentimiento,
finalidad, minimización y derechos del titular según la documentación de seguridad.
A la IA solo DEBE enviarse la descripción necesaria sin datos personales.
Los datos de contacto DEBEN usarse conforme a la autorización del usuario.

Origen: DA03, ADR-006, RC09, RC13, RC14 y seguridad y privacidad.

### V. Avisos sin bloqueo mediante Outbox

Los avisos pendientes DEBEN persistirse en la misma transacción de la operación
principal y enviarse después del commit. El proceso de envío DEBE registrar
intentos y resultados y aplicar reintentos controlados. Una falla del proveedor
NO DEBE deshacer una contratación confirmada ni presentarla como fallida.

Inicialmente, los pendientes DEBEN gestionarse con la base de datos compartida,
sin un servicio de colas independiente. Esto conserva avisos sin acoplar la
contratación a la disponibilidad externa. Origen: ADR-009, DA05 y DA11.

### VI. Servicios externos reemplazables y con alternativas

IA, notificaciones y mapas DEBEN integrarse mediante contratos y adaptadores, con
traducción de datos, pruebas, tiempo límite y alternativa de respaldo por integración.
Las fallas repetidas DEBEN suspender temporalmente las llamadas al proveedor.
Los reintentos DEBEN limitarse a operaciones repetibles de forma segura y respetar
las condiciones y límites de uso del proveedor.

La IA DEBE limitarse a interpretar necesidades y sugerir filtros corregibles por
el cliente. El servidor DEBE validarlos y consultar prestadores registrados; la IA
no sustituye esa consulta ni decide contrataciones. Si falla, la búsqueda por filtros
DEBE seguir disponible. Las funciones independientes DEBEN continuar ante fallas
externas. Los proveedores concretos DEBEN elegirse al implementar cada integración
y poder sustituirse sin modificar casos de uso.

Origen: ADR-007, ADR-008 y RC08.

### VII. API REST con contratos y errores uniformes

La aplicación web y el backend DEBEN comunicarse mediante API REST con rutas bajo
`/api/v1`. Los contratos DEBEN documentarse en OpenAPI dentro de
`specs/<funcionalidad>/contracts/` y verificarse automáticamente.

La API DEBE respetar las convenciones documentadas: JSON con nombres en español
y `camelCase`; errores con `codigo`, `mensaje` y `detalles` y códigos estables;
fechas ISO 8601 en UTC; importes en céntimos y moneda `PEN`. Las operaciones críticas
DEBEN exigir `Idempotency-Key`; las modificaciones DEBEN comprobar la versión
consultada y responder 409 ante conflictos. Las búsquedas DEBEN usar índices,
filtros y paginación.

La API DEBE validar datos y permisos aunque la interfaz ya lo haya hecho, y
distinguir 401, 403 y 404 según el contrato sin revelar recursos privados.
Los cambios incompatibles DEBEN introducir una nueva versión de ruta.

Origen: ADR-003, ADR-010, RC06 y diseño de la API REST.

### VIII. Pagos directos al prestador

El cliente DEBE pagar directamente al prestador. La plataforma solo DEBE registrar
el pago declarado y la respuesta del receptor; NO DEBE procesar, retener, distribuir
dinero ni verificar transferencias. Una confirmación de pago NO DEBE presentarse
como verificación bancaria.

La pasarela para cobrar servicios o planes de la plataforma queda fuera de esta
versión. La ejecución del trabajo y su evaluación técnica corresponden al prestador
contratado. Origen: RC10, RC11 y RC12.

### IX. Pruebas obligatorias por escenario

Cada escenario de aceptación de `spec.md` DEBE tener al menos una prueba y todas
las pruebas aplicables DEBEN pasar para cerrar la funcionalidad. La verificación
DEBE vincularse al catálogo PRnn y a los EQ correspondientes.

DEBEN incluirse permisos PR04 y, cuando aplique contratación, concurrencia PR09,
idempotencia PR10 y transiciones PR11. PR09 DEBE comprobar 100 repeticiones de
10 aceptaciones simultáneas con exactamente una contratación activa.
Repositorios, transacciones y restricciones DEBEN probarse con PostgreSQL real.
Las pruebas unitarias de dominio y casos de uso no usan base de datos.
Las pruebas de arquitectura DEBEN verificar la regla de dependencia.

La estrategia DEBE cubrir pruebas unitarias, integración, contrato, arquitectura,
extremo a extremo, rendimiento y usabilidad según el alcance de la funcionalidad.
Los datos de prueba DEBEN ser ficticios e identificarse como tales; NO DEBEN usarse
datos personales reales. Una prueba planificada no acredita cumplimiento:
DEBE conservarse evidencia de ejecución conforme a la estrategia de pruebas.

Origen: AC09, EQ-04, EQ-09, estrategia de pruebas y Definition of Done.

### X. Stack tecnológico definido

El stack DEBE conservar ADR-013 y sus ampliaciones documentadas:

| Componente | Tecnología y regla |
|---|---|
| Frontend | React + Vite con TypeScript. |
| Backend | NestJS con TypeScript, manteniendo independiente el dominio. |
| Persistencia | PostgreSQL; TypeORM con migraciones y unidad de trabajo. |
| Caché | Redis solo como caché; PostgreSQL es la fuente de verdad. |
| Pruebas | Jest para backend, Vitest para frontend, Playwright y k6. |
| Contrato y arquitectura | Jest + Supertest y dependency-cruiser. |
| Calidad y entrega | ESLint, Docker, Docker Compose y GitHub Actions. |
| Especificaciones | Spec Kit y artefactos Markdown bajo `specs/`. |

Redis DEBE almacenar categorías y búsquedas frecuentes; si no está disponible,
el sistema DEBE consultar PostgreSQL. Cambiar tecnologías elegidas requiere
justificación arquitectónica y revisión de la constitución, sin sustituciones
silenciosas. Origen: ADR-010, ADR-013 y tecnologías.

### XI. Trazabilidad desde la necesidad hasta la prueba

Cada especificación DEBE citar sus HU, RF, EQ y ADR aplicables. Plan, tareas y
verificación DEBEN conservar la cadena completa del repositorio:
**HU → RF → AC/EQ → DA → ADR → módulo → prueba → funcionalidad**.

Los identificadores DEBEN remitir a documentos existentes sin renumeraciones
silenciosas. Al implementar una funcionalidad, `docs/trazabilidad.md` DEBE incorporar
los componentes construidos y archivos de prueba que los verifican. Los cambios
de contratos o comportamiento DEBEN reflejarse en la documentación afectada.

Las metas EQ DEBEN distinguirse de resultados medidos: sin evidencia siguen siendo
propuestas y no acreditan cumplimiento. Origen: RC05, README, SDD y trazabilidad.

### XII. Simplicidad y evolución justificada

NO DEBEN introducirse microservicios, transacciones distribuidas, sagas ni un servicio
de colas independiente sin un nuevo ADR que justifique la necesidad, evalúe
alternativas y describa el impacto en integridad, pruebas y operación.
NO DEBEN añadirse abstracciones o infraestructura sin necesidad documentada.

La evolución DEBE preservar límites públicos e integridad. Las mejoras de capacidad
DEBEN justificarse con el alcance y mediciones disponibles.
Origen: ADR-001, ADR-002 y ADR-009.

## Alcance y restricciones transversales

- La solución DEBE ser solo web responsive para celular, tableta y computadora.
  Las aplicaciones nativas quedan fuera de esta versión. Los pasos DEBEN adaptarse
  al tamaño del trabajo sin crear sistemas separados (RC01, ADR-004).
- El alcance DEBE limitarse a construcción civil y a la cobertura inicial de Ayacucho,
  Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray.
  La ampliación de sectores o zonas es posterior (RC02, RC03).
- Las consultas y actualizaciones compartidas requieren internet. Esta versión
  NO DEBE permitir completar contrataciones sin conexión (RC07).
- Los archivos DEBEN guardarse fuera de las tablas; PostgreSQL conserva referencias.
  Su acceso DEBE controlarse desde el backend, validando tipo, tamaño y autorización:
  JPG, PNG, WEBP o PDF, con máximo de 10 MB. ADR-011 admite almacenamiento local
  controlado o externo; tecnologías concreta almacenamiento de objetos compatible
  con S3, sin fijar proveedor. DEBEN coordinarse respaldos y eliminación de archivos
  sin uso.
- Las llamadas y WhatsApp son canales de contacto. La plataforma NO DEBE acceder
  a conversaciones ni registrar automáticamente acuerdos externos (RC13).
- Antes de usar documentos de contratación con clientes reales, DEBEN definirse
  y revisarse las plantillas y el mecanismo de aceptación o firma (RC15).

## Flujo de desarrollo y verificación

Cada funcionalidad DEBE seguir: constitución → especificación → aclaraciones →
plan → tareas → análisis de consistencia → implementación → verificación.
El Product Owner, Anderson Ochoa, aprueba cada especificación. Las dudas que afecten
requisitos o decisiones DEBEN resolverse antes de ejecutar trabajo dependiente;
los ajustes DEBEN regresar a la especificación.

Las funcionalidades DEBEN residir en `specs/00X-.../`, con `spec.md`, `plan.md`,
`tasks.md` y los artefactos de planificación aplicables: `research.md`,
`data-model.md`, `contracts/` y `quickstart.md`. Código y pruebas de la aplicación
DEBEN residir en `tecnologia/`; análisis, diseño, C4 y gestión permanecen en `docs/`.
Git y GitHub DEBEN conservar el historial (RC04, RC05).

Cada pull request DEBE verificar esta constitución y `spec.md`. GitHub Actions
DEBE ejecutar lint, build y pruebas unitarias, de integración, contrato y arquitectura
aplicables. Las pruebas de extremo a extremo, rendimiento y usabilidad DEBEN
verificarse en el entorno de demostración según la estrategia documentada,
conservando evidencia.

Una funcionalidad solo DEBE declararse terminada al cumplir la Definition of Done:
artefactos completos, tareas marcadas, escenarios probados, controles de permisos
y concurrencia aplicables, CI en verde, documentación actualizada y pull request
revisado y fusionado en `main`. La revisión DEBE incluir una sesión nueva del
asistente y una revisión manual contra la especificación y esta constitución.

## Governance

Esta constitución rige especificaciones, planes, tareas, revisiones e implementación.
Formaliza decisiones existentes; NO DEBE usarse para reescribirlas sin enmienda.
Las fuentes de consulta son:

- [README](../../README.md).
- [ADR-001–ADR-013](../../docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md).
- [SDD y Spec Kit](../../docs/05-gestion/03-sdd-spec-kit.md).
- [Tecnologías](../../docs/02-arquitectura-software/tecnologias.md),
  [estilo](../../docs/02-arquitectura-software/estilo-arquitectonico.md),
  [Clean Architecture](../../docs/02-arquitectura-software/enfoque-arquitectonico.md)
  y [API REST](../../docs/02-arquitectura-software/api-rest.md).
- [Seguridad](../../docs/02-arquitectura-software/seguridad-y-privacidad.md),
  [restricciones](../../docs/01-analisis-de-sistema/05-restricciones.md),
  [pruebas](../../docs/05-gestion/04-pruebas.md),
  [Scrum y DoD](../../docs/05-gestion/01-scrum.md) y
  [trazabilidad](../../docs/trazabilidad.md).

Toda enmienda DEBE documentar motivo, reglas afectadas, alternativas e impacto en
especificaciones, contratos, datos, pruebas y documentación. DEBE contar con
aprobación explícita del responsable, Anderson Ochoa, mediante revisión del cambio.
Una modificación arquitectónica DEBE registrar el nuevo ADR o la sustitución
explícita del anterior y, cuando corresponda, un plan de migración.
Las excepciones DEBEN documentarse y aprobarse antes de aplicarse.

El versionado DEBE seguir SemVer: MAJOR para eliminaciones o redefiniciones
incompatibles; MINOR para principios o secciones nuevas o ampliaciones materiales;
PATCH para aclaraciones sin cambio normativo. Cada enmienda DEBE actualizar versión
y fecha de última modificación, conservando la fecha original de ratificación.
La versión 1.0.0 es la primera formalización de la plantilla, sin versión normativa
previa.

Cada revisión de plan y pull request DEBE comprobar las reglas aplicables e
identificar desviaciones, justificación y aprobación. Si las fuentes se contradicen,
el asistente DEBE señalar la contradicción y consultar antes de resolverla;
NO DEBE decidir su precedencia silenciosamente.

La constitución fue ratificada el 2026-11-16. La selección de PostgreSQL está
documentada en README, ADR-013 y `05-restricciones.md`; la discrepancia documental
anterior quedó corregida el 2026-11-16.

**Version**: 1.0.1 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16
