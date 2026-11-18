> **Actualización de aceptación (2026-11-17):** T099 fue aceptada por sus criterios
> originales; véase [aceptacion-t099.md](aceptacion-t099.md). El incidente HTTP503
> sigue abierto, con causa indeterminada y seguimiento pendiente. Las menciones
> siguientes de T099 sin marcar registran la decisión histórica previa; no son
> una condición vigente de aceptación. Se conserva íntegro el diagnóstico anterior.

# Diagnóstico acotado de T099 y del 503 histórico

Fecha: 2026-11-17. **T099 pendiente; US7 no iniciada.** Esta revisión mejora el
diagnóstico futuro; no demuestra la causa del incidente original ni lo declara reparado.

## Criterio exacto de T099

El texto de la tarea se conserva literalmente:

> Conectar rutas de cambio/confirmación en `tecnologia/frontend/src/composicion/App.tsx`
> y `tecnologia/frontend/src/composicion/usuarios-acceso.ts`; ejecutar T086–T090,
> permisos ampliados y regresiones de acceso/recuperación, guardar resultados reales
> en `tecnologia/.local/evidencia/001/us6/` y comprobar destino anterior/nuevo sin
> revocación global inferida.

La conexión y esas verificaciones están acreditadas por F3 en el informe anterior.
El texto no exige determinar retrospectivamente la causa de un incidente.
La petición posterior añadió ese diagnóstico y ordena mantener T099 pendiente
si la causa no puede determinarse por pérdida de información. **Se mantiene sin marcar**
por esa instrucción expresa, sin alterar su descripción ni convertir el requisito
adicional en un cambio de la especificación. No se añaden escenarios CA ni tareas.

## Evidencia original y límite de la investigación

En `us6/post-correccion/backend-integration-junit.xml`, el caso
`CA-REC-08 carrera reset/login: credencial verificada antes del reset no acredita después`
duró **23.977 s** y recibió HTTP 503 cuando esperaba 200. La suite tiene timestamp
`2026-11-17T18:03:16`. El XML conserva la aserción y su stack de prueba, no la
excepción interna ni un código de driver. Su duración no identifica una causa.

El inventario anterior `us6/diagnostico-postgres.json` contiene 20 eventos clasificados
como `otro` o `fallo_inyectado`, con huellas del texto examinado. No identifica
timeout/deadlock que explique ese caso; tampoco permite descartar fallos de cliente,
conexión, catálogo, criptografía o recursos que no quedaron registrados.
Las ejecuciones posteriores aprobadas tampoco recuperan la excepción perdida.

La revisión del código confirma dos pérdidas: la unidad de trabajo traducía las
excepciones ajenas a `ErrorAplicacion` sin registrarlas, y el filtro HTTP hacía lo
mismo fuera de transacciones. La API se creaba con `logger:false`; el registrador
de peticiones era opcional y no se conectaba en composición. El observador anterior
solo existía en herramientas locales ignoradas. **Esto demuestra una carencia de
diagnóstico, no qué excepción produjo aquel 503.** `examen-historico.json` conserva
el examen nuevo sin reescribir el XML ni los otros reportes históricos.

## Rutas de fallo revisadas

| Ruta o etapa | Cómo puede terminar en 503 | Diagnóstico aplicado en esta revisión |
|---|---|---|
| POST `/recuperaciones/{token}`: consulta/replay idempotente | DB, conexión o clave HMAC no disponible | Etapas de transacción y condición fija de clave, sin registrar la clave ni su identificador. |
| Consulta inicial del desafío | `buscarPorDigest` traducía el error del driver | Registro antes de traducir, clase/código técnico permitido. |
| Preparación de contraseña | Catálogo ausente/modificado, lectura o rechazo interno de Argon2 | Catálogo registra disponibilidad/inicialización/integridad; hash registra la excepción antes de propagarla. Los errores que se propagan conservan además el diagnóstico HTTP. |
| Commit de recuperación | Lock de cuenta/desafío, escritura de credencial, revocación, Outbox, resultado idempotente o commit | Etapas conexión/inicio/configuración/trabajo/commit; SQLSTATE permitido y puntos de código propios cuando están disponibles. `db.trabajo` significa callback transaccional, no prueba que todo error de esa etapa sea SQL. |
| Rollback/liberación | Puede coexistir un error de limpieza con el fallo primario | Eventos separados conservan ambos; se mantiene la propagación previa. |
| POST `/sesiones` concurrente | Lectura/Argon2/bloqueo/creación de sesión | Excepción propagada al filtro, transacción instrumentada y ruta contractual sin datos de cuenta. |
| GET `/salud` y otras operaciones | DB/corpus requeridos; idempotencia, lector de sesión o almacenamiento según operación | El filtro registra el503 con su contexto. La conservación de causas en adaptadores que ya las descartaron fuera de la cadena examinada requiere ampliación específica; no se acredita observabilidad integral de S3/SMTP/lectores con este diagnóstico. |

POST `/recuperaciones` conserva el 202 genérico incluso si falla la programación;
la unidad de trabajo ahora registra ese fallo internamente sin revelar existencia
de cuenta. SMTP se ejecuta después del commit: su fallo no convierte un reset
confirmado en 503. Los rechazos 401/409/422 de credenciales, versiones o desafío
mantienen su significado y no se reclasifican como fallos internos.

## Registros seguros comprobados

`compartido/infraestructura/diagnostico-fallos.ts` escribe JSON a stderr por defecto,
con un colector sustituible en composición. `AsyncLocalStorage` mantiene la
correlación de cada petición concurrente. Se genera un UUID en el servidor;
no se acepta el identificador de una cabecera del cliente. El contexto contiene
solo método permitido, patrón del contrato redactado y colector, nunca objetos HTTP.

Los eventos incluyen fecha UTC, identificador, etapa/condición fijas y resumen por
allowlist de clase y código. Los puntos de código se limitan a nombres estáticos
de archivos propios y números de línea/columna, sin rutas absolutas ni funciones
libres. No se serializan `Error`, `message`, stack completo, SQL, parámetros,
body, cabeceras, cookies, contraseñas, tokens, enlaces, UUID de cuenta o correo.
Los nombres/códigos desconocidos se reducen a valores fijos. El fallo síncrono
del colector utiliza el mismo evento seguro en stderr y no cambia la respuesta.
Si también falla stderr no existe garantía de entrega: su captura/retención es
una responsabilidad operativa pendiente, no una propiedad acreditada por estas pruebas.

La respuesta pública sigue siendo el error contractual genérico, sin nuevos
campos, cabeceras de correlación, cookies ni causa interna.

## Pruebas y versiones

**Versión final:** `D099-e333f5a7f71d150f`, base Git
`7d3f71bb2d5ceaae2928e2534d5234425cbd67fc` más los cambios locales.
`final-2/version.json` conserva 188 huellas; la fuente se comprueba antes/después.
Entorno: Windows, Node 24.15.0 y PostgreSQL 18 real para integración.

| Archivo completo seleccionado por nivel | U | I | C |
|---|---:|---:|---:|
| fundacion | 10 | 6 | 5 |
| diagnostico / usuarios-acceso/diagnostico-recuperacion | 10 | 2 | — |
| usuarios-acceso/recuperacion | 11 | 14 | 9 |
| usuarios-acceso/sesiones | 15 | 19 | 13 |
| usuarios-acceso/correo | 8 | 16 | 8 |
| **Total seleccionado** | **54** | **57** | **35** |

Los diez U nuevos comprueban redacción, metadatos hostiles, aislamiento concurrente,
respaldo del colector, conservación de errores de limpieza/commit, catálogo ENOENT,
claves ausentes, consulta del desafío y error ENOMEM simulado de hash. Esa simulación
no explica ni reproduce el aborto nativo Windows.

Los dos I nuevos prueban un error fuera de transacción y una carrera reset/login
con un bloqueo PostgreSQL mantenido de forma controlada. Este segundo escenario
produce SQLSTATE **55P03** y 503, conserva credencial/desafío/sesiones/resultado
anteriores, permite login al no haberse confirmado el reset, y después permite
reintentar con la misma clave y revocar aquellas sesiones al confirmar el cambio.
El registro conserva la causa técnica y la misma correlación hasta el filtro.
**El bloqueo es causa del fallo inducido, no causa demostrada del 503 histórico.**

Comando: `node tecnologia/.local/pruebas/regresion-t099.mjs final-2`.
Ejecuta 14 procesos secuenciales Jest con `--selectProjects <nivel> --runInBand
--no-cache --runTestsByPath <archivo>`; los cinco U, cinco I y cuatro C de la tabla,
sin filtros por nombre. `final-2/ejecuciones.json` conserva cada comando, archivo,
código de salida y JUnit. Las otras suites del backend y los navegadores no se
presentan como reejecutados. Las matrices Linux/Windows 90/90 anteriores corresponden
a **F3-a6f68f56d2e7d9bb** y permanecen históricas: no hay cambios de frontend,
TLS, contrato, cookies ni reglas de negocio que justifiquen repetirlas para este
cambio de diagnóstico del servidor.

## Intentos conservados e incidente nativo separado

| Intento | Versión / resultado |
|---|---|
| Comprobación inicial | Un I falla porque el503 no produce ningún evento; el segundo caso no fue seleccionado. Es evidencia de la carencia, no otra reproducción del incidente histórico. |
| Primeras pruebas nuevas | 8 U y2 I aprobadas antes de completar los dos U adicionales; no sustituyen la selección final. |
| `final-1/` | `D099-97776f4adf1055d9`:54 U/35 C; I tiene 24 casos acreditados y dos procesos abortados con 3221226505 (`0xC0000409`), sin JUnit final. |
| `repeticion-1/` | Misma versión anterior: REC 14/14 y SES 19/19 con observador de inicio/fin de nombres de caso. Se conserva la unión57 I y los abortos, sin declarar una pasada única ni una reparación nativa. |
| `estaticos.json` inicial | Tipos/build/arquitectura pasan; lint rechaza un `throw` explícito en `finally`. Se corrige moviendo la liberación a un auxiliar, conservando la propagación y el diagnóstico. |
| `final-2/` | Versión final después de esa corrección; selección 54 U/57 I/35 C aprobada por archivos completos. Tipos/lint/build/arquitectura registrados aparte para esta misma versión. |

Un HTTP 503 es una respuesta de aplicación. `0xC0000409` es un aborto del proceso
de pruebas: no aporta la excepción del HTTP original y sigue como incidente
independiente sin causa demostrada. El registrador de excepciones JavaScript
no captura por sí solo una terminación nativa del proceso.

## Pendientes y medidas propuestas

La causa original sigue indeterminada por pérdida de información y falta de una
reproducción no inducida con diagnóstico. **T099 sigue pendiente por instrucción
expresa.** No se modifica su checkbox ni el de T110. US7 no se inicia.

Para una próxima ocurrencia, conservar evento/correlación, etapa, clase/código,
versión desplegada y reportes de prueba antes de limpiar el entorno; comparar
el intervalo con los eventos de PostgreSQL, sin volcar SQL ni parámetros. Preparar
en despliegue captura de stderr, acceso restringido, retención y detección de
pérdida del colector. Ampliar las listas de códigos y los adaptadores pendientes
mediante revisiones y pruebas de minimización, evitando mensajes libres.
Mantener la investigación del aborto nativo en un registro independiente.

Evidencia nueva: `tecnologia/.local/evidencia/001/us6/diagnostico-t099-20261117/`.
`antes.json` inventaría 417 archivos anteriores; la verificación de integridad
comprueba que ninguno se reescribió. Permanecen el corpus productivo pendiente,
los incidentes históricos, T110 y los restantes requisitos de despliegue/DoD.
