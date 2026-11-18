# Matriz de trazabilidad

Permite responder dos preguntas: **¿de qué requisito sale este componente?** y **¿cómo se comprueba?** La cadena es **HU → RF → AC/EQ → DA → ADR → módulo → prueba → funcionalidad**.

Documentos de origen: [HU](01-analisis-de-sistema/02-historias-de-usuario.md) · [RF](01-analisis-de-sistema/03-requisitos-funcionales.md) · [AC](01-analisis-de-sistema/04-atributos-de-calidad.md) · [EQ](01-analisis-de-sistema/08-escenarios-atributos-calidad.md) · [DA](01-analisis-de-sistema/06-drivers-arquitectonicos.md) · [ADR](01-analisis-de-sistema/07-decisiones-arquitectonicas.md) · [Pruebas](05-gestion/04-pruebas.md) · [Backlog](05-gestion/02-backlog-y-sprints.md)

## 1. Matriz principal (de la necesidad a la prueba)

| HU | RF | AC / EQ | DA | ADR | Módulo | Prueba | Func. |
|---|---|---|---|---|---|---|---|
| HU01 | RF01–RF04 | AC04 / EQ-04 | DA03 | ADR-006 | Usuarios y acceso | PR04, PR13, PR14 | 001 |
| HU02 | RF05 | AC04 / EQ-04 | DA03 | ADR-006 | Usuarios y acceso | PR04 | 001 |
| HU03 | RF06, RF07 | AC04 / EQ-04 | DA03, DA11 | ADR-011 | Prestadores | PR04 | 002, 012 |
| HU04 | RF08 | AC05 / EQ-05 | DA08 | ADR-002 | Catálogo y búsqueda | PR04, PR12 | 002 |
| HU05 | RF09, RF10 | AC01, AC03 / EQ-01, EQ-03 | DA01, DA02 | ADR-010 | Catálogo y búsqueda | PR01, PR03 | 002 |
| HU06 | RF11 | AC05, AC08 / EQ-05, EQ-08 | DA05, DA06 | ADR-007, ADR-008 | Catálogo y búsqueda + adaptador de IA | PR05, PR08 | 007 |
| HU07 | RF12, RF13 | AC06 / EQ-06 | DA09 | ADR-004, ADR-011 | Solicitudes y visitas | PR06 | 003 |
| HU08 | RF14 | AC04 / EQ-04 | DA03 | ADR-006 | Solicitudes y visitas | PR04 | 003 |
| HU09 | RF15, RF16 | AC06 / EQ-06 | DA09 | ADR-004 | Solicitudes y visitas | PR06 | 008 |
| HU10 | RF17, RF18 | AC09 / EQ-09 | DA04 | ADR-005, ADR-012 | Cotizaciones | PR11 | 003 |
| HU11 | RF18, RF19 | AC01 / EQ-01 | DA02 | ADR-010 | Cotizaciones | PR01 | 003 |
| HU12 | RF20, RF21 | AC09 / EQ-09 | DA04 | ADR-001, ADR-005 | Contrataciones y acuerdos | PR09, PR10, PR11 | 004 |
| HU13 | RF22 | AC08 / EQ-08 | DA05 | ADR-009 | Contrataciones y acuerdos, Notificaciones | PR15 | 004 |
| HU14 | RF23, RF24 | AC04, AC09 / EQ-04, EQ-09 | DA11 | ADR-011, ADR-012 | Contrataciones y acuerdos | PR04, PR16 | 009 |
| HU15 | RF25 | AC09 / EQ-09 | DA04 | ADR-012 | Contrataciones y acuerdos | PR16 | 009 |
| HU16 | RF26, RF27 | AC09 / EQ-09 | DA09, DA11 | ADR-004, ADR-012 | Contrataciones; Seguimiento y pagos | PR11 | 004, 010 |
| HU17 | RF28, RF29 | AC09 / EQ-09 | DA11 | ADR-012 | Seguimiento y pagos registrados | PR04 | 010 |
| HU18 | RF30, RF31 | AC06 / EQ-06 | DA09 | ADR-004 | Seguimiento y pagos registrados | PR11 | 005 |
| HU19 | RF31, RF32 | AC09 / EQ-09 | DA04 | ADR-005 | Seguimiento; Contrataciones | PR11 | 005 |
| HU20 | RF33 | AC09 / EQ-09 | DA04 | ADR-012 | Contrataciones y acuerdos | PR11 | 011 |
| HU21 | RF34 | AC04 / EQ-04 | DA03 | ADR-006 | Calificaciones | PR04 | 011 |
| HU22 | RF35 | AC08 / EQ-08 | DA05 | ADR-009 | Notificaciones | PR15 | 006 |
| HU23 | RF36 | AC01, AC04 / EQ-01, EQ-04 | DA02, DA11 | ADR-010 | Varios módulos (consulta) | PR01, PR04 | 011 |
| HU24 | RF37, RF38 | AC04 / EQ-04 | DA11 | ADR-012 | Administración e incidencias | PR04 | 012 |
| HU25 | RF39 | AC05 / EQ-05 | DA08 | ADR-002 | Catálogo; Administración | PR12 | 002 |
| HU26 | RF40–RF42, RF45 | AC04 / EQ-04 | DA03, DA11 | ADR-006, ADR-012 | Administración e incidencias | PR04 | 012 |
| HU27 | RF43, RF45 | AC04 / EQ-04 | DA11 | ADR-012 | Administración e incidencias | PR04 | 012 |
| HU28 | RF44 | AC01 / EQ-01 | DA02 | ADR-010 | Administración e incidencias | PR01 | 012 |

Las decisiones transversales se aplican a todas las filas: ADR-003 (API REST) y ADR-013 (stack).

La funcionalidad 001 dispone de fundación y US1–US7 verificadas en `tecnologia/backend`
y `tecnologia/frontend`. El [estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
vincula T001–T109 verificadas con archivos y resultados por versión: 11 CA-REG, nueve CA-SES, diez CA-REC,
seis CA-PER, siete CA-AUT, seis CA-COR y cuatro CA-CLA comprobados (53/53).
El incidente 503 histórico conserva seguimiento independiente.
La regresión conjunta recuperación/perfil queda en T110. Los nueve proyectos de Linux y Windows
conservan TLS activo y rechazo de certificados no confiables. No acredita la
entrega completa de 001 ni todos los 32 requisitos locales.

| Cadena de US1 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF01 → FR-001–003/021–022 → AC09/EQ-04 → DA03/DA07 → ADR-002/003/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/cuenta.ts`, `politica-contrasena.ts`, `aplicacion/registrar-cuenta.ts`, repositorio y controlador de registro | `tecnologia/backend/test/unit/usuarios-acceso/registro.spec.ts`, `test/integration/usuarios-acceso/registro.spec.ts`, `test/contract/usuarios-acceso/registro.spec.ts`: CA-REG-01–05, 08–11 según niveles de la matriz. |
| HU01 → RF01 (apoyo HU02/RF05) → FR-028–029 → EQ-04 → DA03 → ADR-002/005/006 → Usuarios y acceso | `dominio/perfiles-habilitados.ts`, `aplicacion/habilitar-perfil.ts`, `presentacion/registro.controller.ts`, composición backend | Las mismas suites backend: CA-REG-06/07; confirmación, titularidad, versión, replay, concurrencia y ausencia de administración. |
| HU01 → RF01 → FR-019/021 → EQ-07 → DA10 → ADR-004/011 → web y fotografías propias | `tecnologia/frontend/src/features/usuarios-acceso/presentacion/Registro.tsx`, `HabilitarPerfil.tsx`, `aplicacion/registro.ts`, composición y adaptador HTTP; foto por adaptador S3 fundacional | `tecnologia/frontend/test/unit/usuarios-acceso/registro.test.tsx` y `test/e2e/usuarios-acceso/registro.spec.ts`: 7 V y 18 E por entorno; 360/768/1366 × Chromium/Firefox/WebKit, backend real. |

Las rutas abreviadas de componentes y pruebas son relativas a las mismas raíces
backend/frontend de cada fila. La [matriz normativa](../specs/001-usuarios-y-acceso/test-matrix.md)
conserva la relación exacta de cada CA con sus niveles. La adición de US1 usa ahora
registro y login reales. US5 resuelve la consulta general de cuenta tras recargar,
con versión y consentimiento efectivos del servidor; sustituye la proyección
provisional en memoria de la entrega anterior. El fixture anterior no se importa en la web.

| Cadena de US2 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF02 → FR-004–007 → AC04/EQ-04 → DA03 → ADR-002/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/sesion.ts`, `control-intentos.ts`, `aplicacion/iniciar-sesion.ts`, `renovar-sesion.ts`, `obtener-csrf.ts`, `cerrar-sesion.ts`, repositorio de sesiones y controlador | `tecnologia/backend/test/unit/usuarios-acceso/sesiones.spec.ts` (15 U), `test/integration/usuarios-acceso/sesiones.spec.ts` (19 I) y `test/contract/usuarios-acceso/sesiones.spec.ts` (13 C), según niveles CA-SES-01–09; PR04/PR13. |
| HU01 → RF02 y apoyo RF01 → FR-006–007/012/014 → EQ-04/EQ-07 → DA03/DA10 → ADR-004/006 → web | `tecnologia/frontend/src/features/usuarios-acceso/aplicacion/sesion.ts`, `infraestructura/coordinador-renovacion.ts`, `presentacion/Acceso.tsx`, `EstadoSesion.tsx`, composición y HTTP | `tecnologia/frontend/test/unit/usuarios-acceso/sesiones.test.tsx` (9 V), `test/e2e/usuarios-acceso/sesiones.spec.ts` (9 E por entorno), regresión `registro.spec.ts` con login real; Chromium/Firefox/WebKit × 360/768/1366. |

Cookie Secure/HttpOnly/SameSite=Lax/Path y siete días absolutos; rotación y cierre
comprobados en PostgreSQL real, sin caché de permisos. En el cierre anterior de US3,
las matrices pasaron 45/45 en Linux y Windows, incluida recuperación. El inspector SameSite de WebKit Windows tiene
una limitación documentada; la cabecera Lax se exige en todos los motores y su
alcance se detalla en el estado de implementación.

| Cadena de US3 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF03 → FR-008–011/022/026–027/030 → AC04/EQ-04 → DA03/DA07 → ADR-002/003/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/recuperacion.ts`, migración/entidad y repositorio de recuperación, `aplicacion/solicitar-recuperacion.ts`, `consumir-recuperacion.ts`, controlador y composición; consulta anticipada de replay en idempotencia compartida | `tecnologia/backend/test/unit/usuarios-acceso/recuperacion.spec.ts` (11 U), `test/integration/usuarios-acceso/recuperacion.spec.ts` (14 I), `test/contract/usuarios-acceso/recuperacion.spec.ts` (9 C): CA-REC-01–10 según niveles; PostgreSQL real, vencimiento, carreras y rollback; PR04/PR13. |
| HU01 → RF03 → FR-008/020/026–027 → EQ-04 → DA03/DA05 → ADR-005/006/009 → API de Notificaciones | `tecnologia/backend/src/modulos/notificaciones/infraestructura/plantillas-seguridad.ts`, puerto de Usuarios conectado por composición y Outbox/worker existentes | I/C anteriores y Mailpit E: destinatario registrado, enlace cifrado con 30 min, aviso sin contraseña, fallo/reintento sin revertir reset y un efecto lógico por operación. No implementa el catálogo funcional RF35. |
| HU01 → RF03 → FR-009–011/019/022 → EQ-04/EQ-07 → DA03/DA10 → ADR-003/004/006 → web | `tecnologia/frontend/src/features/usuarios-acceso/aplicacion/recuperacion.ts`, `presentacion/RecuperarAcceso.tsx`, `EstablecerContrasena.tsx`, composición y captura previa del fragmento en `index.html`; reporter de redacción en soporte de pruebas | `tecnologia/frontend/test/unit/usuarios-acceso/recuperacion.test.tsx` (6 V), `test/e2e/usuarios-acceso/recuperacion.spec.ts` (9 E por entorno): URL limpia, memoria, política/confirmación, claves de retry, dos sesiones/refresh revocados, aviso y login habitual. Chromium/Firefox/WebKit × 360/768/1366, TLS estricto. |

La entrega anterior de US3 verificó T049–T062. Respuesta genérica, un uso/1800 s,
hash y revocaciones atómicas, replay exacto conforme a R12 y retorno al login;
sin sesión automática ni permisos administrativos. Regresiones de esa entrega:
68 U, 49 I, 53 C, 29 V y 45 E por entorno. La evidencia ignorada de
`tecnologia/.local/evidencia/001/us3/` vincula diez CA-REC con informes aprobados.
Su evidencia se conserva; la regresión conjunta con perfil se ejecutará en T110.

| Cadena de US5 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU02 → RF05 → FR-015–018/021/031 → AC04/EQ-04 → DA03 → ADR-002/003/005/006 → Usuarios y acceso | `tecnologia/backend/src/modulos/usuarios-acceso/dominio/consentimiento-telefono.ts`, migración/entidad 007, repositorios de perfil/consentimiento, `aplicacion/consultar-perfil.ts`, `perfil-resultado.ts`, `actualizar-perfil.ts`, `proyectar-perfil-compartible.ts` y controlador | `tecnologia/backend/test/unit/usuarios-acceso/perfil.spec.ts` (14 U), `test/integration/usuarios-acceso/perfil.spec.ts` (9 I), `test/contract/usuarios-acceso/perfil.spec.ts` (8 C): seis CA-PER según niveles, PostgreSQL real, versión, replay y rollback; PR04. Proyección interna entregada en T069, reutilización transversal pendiente en T082. |
| HU02 → RF05 → FR-015–016/018/021 → EQ-04/EQ-07 → DA03/DA10 → ADR-004/006/011 → fotografía propia | `aplicacion/fotografias.ts`, `presentacion/fotografias.controller.ts`, puertos de perfil y almacenamiento/limpieza S3 existentes; formato base64 canónico acotado en HTTP | I/C anteriores: imagen propia temporal y posterior vinculación, 404 ajena, firma/MIME, 10000000 bytes aceptados y 10000001 rechazados, objeto ausente y compensación/cleanup sin perder foto vigente. |
| HU02 → RF05 → FR-015–016/019/031 → EQ-07 → DA10 → ADR-003/004/006/011 → web | `tecnologia/frontend/src/features/usuarios-acceso/aplicacion/perfil.ts`, `presentacion/Perfil.tsx`, `EditarPerfil.tsx`, composición y rutas `/cuenta` y `/habilitar-perfil` | `tecnologia/frontend/test/unit/usuarios-acceso/perfil.test.tsx` (8 V), `test/e2e/usuarios-acceso/perfil.spec.ts` (nueve proyectos por entorno): persistencia/recarga, dos editores, 409 sin sobrescritura, consentimiento del mismo valor y object URL revocada; PR07/PR12. |

**Registro histórico del cierre US5:** US5 completa T063–T076. Regresión pertinente recuperada: 71 U, 44 I, 52 C, 31 V y
45 E por entorno, con fundación/US1/US2. La reanudación corrige la sincronización
de la prueba con el GET real de perfil y verifica otros 9/9 proyectos US5 en Linux
y Windows; conserva el intento Linux 7/9 y el historial. Sin cambios de TLS ni
credenciales, administración o endpoint público RF10. Evidencia ignorada en
`tecnologia/.local/evidencia/001/us5/`, con seis CA-PER acreditados por nivel.
El corpus completo aprobado de producción continúa pendiente del despliegue;
el fixture no lo sustituye. T077/US4 y siguientes, T110 conjunto recuperación/perfil,
las limitaciones históricas y la DoD global siguen pendientes. No se acredita 001 completa.

## Registro histórico del cierre US4: permisos, titularidad y privacidad

| Cadena de US4 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU01 → RF04 → FR-012–014/029 → AC04/EQ-04 → DA03 → ADR-002/003/005/006 → Usuarios y acceso | `aplicacion/evaluar-acceso.ts`, `api-publica.ts`, guard y validación HTTP; perfiles actuales y revalidación dentro de transacción en cuentas/sesiones | `tecnologia/backend/test/unit/usuarios-acceso/permisos.spec.ts` (7 U), `test/integration/usuarios-acceso/permisos.spec.ts` (10 I) y `test/contract/usuarios-acceso/permisos.spec.ts` (16 C), CA-AUT-01–07 según matriz; PR04. |
| HU01/HU02 → RF04/RF05 → FR-017/031 → AC04/EQ-04 → DA03 → ADR-006 → proyección interna | API pública interna reutiliza `aplicacion/proyectar-perfil-compartible.ts` de T069, sin duplicación ni endpoint RF10 | U/C permisos: CA-AUT-06, serialización sin correo/documentos/dirección/credenciales; teléfono solo con consentimiento efectivo del mismo valor. |
| HU01 → RF04 → FR-012/019 → AC04/EQ-04, AC07/EQ-07 → DA03/DA10 → ADR-004/006 → web | `tecnologia/frontend/src/features/usuarios-acceso/presentacion/EstadoAcceso.tsx`, `Perfil.tsx` y `composicion/App.tsx` | `tecnologia/frontend/test/e2e/usuarios-acceso/permisos.spec.ts`: 27 E por entorno, CA-AUT-02 cliente/prestador/ambos × nueve proyectos; servidor rechaza cuerpo manipulado y mantiene datos. |

US4 cierra T077–T085. Regresión completa sin filtros de historias: **89 U, 68 I,
77 C y 37 V**; E cubre **81 casos distintos por entorno** por unión de matrices
80/81 y repeticiones manuales secuenciales de SES Linux 9/9 y REG Windows 18/18.
Los dos fallos iniciales se conservan; no son matrices monolíticas 81/81.
Incluye fundación/registro/sesiones/recuperación/
perfil/permisos (V conserva sus cinco suites existentes). La comparación por caso y
multiplicidad conserva la unión US5 + auditoría REC: 82/58/61/37/54 por entorno,
añadiendo únicamente 7 U/10 I/16 C/27 E de US4. Los históricos no se reescriben.
Comandos, inventario de archivos/rutas, siete CA-AUT, reportes y limitaciones en el
[estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
y `tecnologia/.local/evidencia/001/us4/`. No cambia TLS, administración ni contratos.
T086/US6 y US7 no iniciadas. T110 conserva nuevas variantes y recuperación/perfil
conjuntas; corpus productivo aprobado pendiente antes del despliegue. La limitación
histórica del inspector SameSite WebKit Windows sigue documentada; cabecera Lax
exigida. Sin bloqueo actual de US4; 001 y la DoD global aún no están completas.

## Registro histórico de US6 y su aceptación pendiente anterior

| Cadena de US6 | Componentes construidos | Prueba ejecutada |
|---|---|---|
| HU02/RF05; apoyo HU01/RF02/RF04 → FR-023/032 → AC04/EQ-04 → DA03 → ADR-002/003/005/006 → Usuarios y acceso | Dominio cambio-correo; reautenticar-sesion; solicitud/confirmación; migración008 y repositorio propios; controladores/composición | tecnologia/backend/test/unit/usuarios-acceso/correo.spec.ts (8 U), test/integration/usuarios-acceso/correo.spec.ts (16 I), test/contract/usuarios-acceso/correo.spec.ts (8 C); seis CA-COR según matriz, PR04/PR13. Ventana 0–300 s inclusiva sin tolerancias. |
| HU02/RF05 → FR-001/023/024 → EQ-04 → DA03/DA04 → ADR-005/006 → unicidad/confirmación | Índice único existente, locks y versiones; consumo/resultado atómicos; Outbox cifrado/Notificaciones/ADR-009; iniciar-sesion reconsulta correo bajo lock | I/C: dos confirmaciones/un destino, rollback, no reservar correo, uso/expiración/propósito/idempotencia; barrera login con correo anterior despuéscommit da401sinSetCookie/sin otra sesión. No hay revocación global inferida. |
| HU02/RF05 → FR-019/023/024/032 → EQ-04/EQ-07 → DA03/DA10 → ADR-004/006 → web | CorreoWeb, CambiarCorreo, Reautenticar, ConfirmarCorreo; fragmento en memoria/historial limpio | tecnologia/frontend/test/unit/usuarios-acceso/correo.test.tsx (9 V) y test/e2e/usuarios-acceso/correo.spec.ts (9 E por entorno); confirmación tras 301 s reales en chromium-360 de Linux y Windows. |

Versión final **F3-a6f68f56d2e7d9bb**, baseGit013f02040fb99dd645da15724351f32324cacb08
más cambios locales:185 huellas, comprobadas antes/después de matrices. **97 U/84 I/
88 C/46 V/90 E Linux/90 E Windows**, sin omisiones de casos anteriores. Backend incluye
todos los siete archivos por nivel, en procesos secuenciales por archivo. C conserva
el aborto nativo de registro y su repetición26/26 con observador, unido a62 casos
de los otros seis archivos; no se anuncia como una pasada monolítica sin repeticiones.
V conserva seis archivos, E siete/nueveproyectos,90/90 sin reintentos automáticos.
Las233 huellas de reportes históricos siguen iguales. Intentos V0/V1/V2 reconstruidos
lógicamente, no con huella contemporánea; no se atribuyen a F3 los E anteriores.

Los fixtures nuevos toman la marca del mismo reloj Node que la decisión productiva;
300000 ms aceptados,300001 ms/ausente/futura rechazados. No se amplía la política.
Recuperación permanece incluida:14 I/9 C y 9 E por entorno. El503 histórico de CA-REC-08
no conservó su excepción interna; PostgreSQL no muestra timeout/deadlock en aquel
intervalo. REC14/14,COR16/16 y completaI84/84bajo observador pasaron sin reproducirlo.
**Causa histórica no determinada: T099 pendiente, US6 no cerrada**, sin fallo
funcional actual demostrado. Inestabilidad nativa Windows 0xC0000409también pendiente
de explicación; todos los intentos se conservan. No se interpreta repetir como reparar.

Comandos exactos, archivos, resultados y fuentes en el
[estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md)
y tecnologia/.local/evidencia/001/us6/{verificacion-f3.json,comandos-y-suites-f3.json,final-f3/}.
TLS y contratos intactos. **US7 no iniciada**. T110, corpus productivo completo
aprobado y DoD global siguen pendientes. Los siguientes párrafos históricos no
sustituyen este estado vigente.

## Registro histórico del diagnóstico acotado de T099 (posterior a F3)

RF03/FR-008–011/030 → AC04/EQ-04 → DA03 → ADR-003/005/006 → Usuarios y acceso
y transacciones compartidas → PR04/PR13. Se añaden diagnóstico seguro en infraestructura
y 10 U/2 I dirigidas, sin nuevos CA ni flujos de US7. Archivos nuevos:
tecnologia/backend/src/compartido/infraestructura/diagnostico-fallos.ts,
test/unit/diagnostico.spec.ts y test/integration/usuarios-acceso/diagnostico-recuperacion.spec.ts.
La composición activa registros seguros en stderr; conserva patrón redactado,
correlación de servidor y clase/código técnico antes de traducir a503.

D099-e333f5a7f71d150f: selección 54 U/57 I/35 C y estáticos aprobados; no es toda la regresión
backend ni una nueva matriz E. Los90/90 E Linux/Windows anteriores siguen asociados
a F3. El lock inducido 55P03 demuestra diagnóstico/rollback/retry, sin atribuir ese
origen al 503 histórico. Los abortos nativos Windows y sus repeticiones permanecen
separados. 417 evidencias previas intactas. Criterio exacto, rutas, intentos y medidas
en [diagnostico-t099.md](../specs/001-usuarios-y-acceso/diagnostico-t099.md).
**T099 pendiente por instrucción expresa; US7 no iniciada; T110/corpus pendientes.**

## Aceptación de T099 por su texto original

T099 aceptada: rutas conectadas, T086–T090, permisos ampliados y regresiones
de acceso/recuperación acreditados con evidencia F3/D099. Fuente actual
D099-e333f5a7f71d150f sin cambios de código; nuevos 10 I/19 C de permisos y 1 E
correo Linux/chromium-768, más selección previa D099. Unión 54 U/67 I/54 C,
sin presentarla como regresión completa. V y matrices completas anteriores son F3.
Tabla y comandos en [aceptacion-t099.md](../specs/001-usuarios-y-acceso/aceptacion-t099.md).
Incidente HTTP 503 abierto, causa indeterminada y medidas de seguimiento conservadas;
abortos nativos Windows separados. T110/corpus pendientes, US7 no iniciada.

## US7 — Cambio controlado de contraseña

| Cadena | Componentes | Evidencia |
|---|---|---|
| HU02/RF05, apoyo HU01/RF02–RF04 → FR-022/025 → AC04/EQ-04 → DA03 → ADR-003/005/006 → Usuarios y acceso | CambiarContrasena, ContrasenaController, política compartida, repositorio de cuentas e idempotencia | CA-CLA-01–04 en U/I/C. Argon2id íntegro, confirmación, versión, replay, carreras y rollback. PR04/PR13. |
| HU02/RF05 → FR-019/022/025 → AC07/EQ-07 → DA10 → ADR-004/006 → web | ContrasenaWeb, CambiarContrasena.tsx y composición | V/E de contraseña. Flujo específico, recuperación, limpieza de campos y login nuevo/anterior. PR07. |
| HU01/RF02–RF04 → FR-004–014/026 → AC04/EQ-04 → DA03 → ADR-005/006 → acceso y recuperación | Reutilización de sesión vigente y bloqueo de cuenta | I cambios de contraseña, recuperación, correo y sesiones. Se comprueban los efectos diferenciados de US7 y recuperación. |

US7-407db07e4ac3dbb3: 114 U, 93 I, 93 C y 53 V. US7 9 E por entorno y selección
de regresión adicional de 10 E por entorno. Comandos, intentos y versiones en el
[estado de implementación](../specs/001-usuarios-y-acceso/implementation-status.md).
T110–T119, incidente 503, abortos nativos y corpus productivo siguen pendientes.

## 2. Trazabilidad inversa: de cada elemento de los diagramas C4 a su requisito

| Elemento C4 | Nivel | Requisitos y drivers que lo justifican |
|---|---|---|
| Aplicación web (React + Vite) | 2 | RC01, AC07, DA10, ADR-004 |
| API de la plataforma (NestJS) | 2 | RC06, DA07, ADR-001, ADR-003 |
| Base de datos (PostgreSQL) | 2 | AC09, DA04, ADR-005 |
| Caché (Redis) | 2 | AC01, DA02, ADR-010 |
| Almacenamiento de archivos | 2 | RF07, RF24, RF27, DA11, ADR-011 |
| Servicio de IA | 1, 2 | RF11, DA06, ADR-007, ADR-008 |
| Servicio de notificaciones | 1, 2 | RF35, DA05, ADR-009 |
| Mapas | 1, 2 | RF09, RC08, ADR-007 |
| Pasarela de pagos (futura) | 1, 2 | RC11, DA08 |
| Entrada API REST | 3 | RF04, DA03, ADR-006 |
| Módulo Contrataciones y acuerdos | 3 | RF20–RF26, RF33, DA04 |
| Repositorios y unidad de trabajo | 3, 4 | AC09, DA04, ADR-005 |
| Proceso de avisos (Outbox) | 3, despliegue | RF35, AC08, ADR-009 |
| AceptarPropuesta y sus puertos | 4 | RF20, RF21, RF22, ADR-002 |

## 3. Cobertura y verificaciones de coherencia

| Comprobación | Resultado |
|---|---|
| Cada historia de usuario tiene al menos un requisito funcional | 28 de 28 |
| Cada requisito funcional pertenece a una historia | 45 de 45 |
| Cada requisito del MVP está en una funcionalidad del 001 al 006 | 24 de 24 |
| Cada driver tiene al menos una decisión arquitectónica | 11 de 11 |
| Cada escenario de calidad tiene al menos una prueba | 9 de 9 |

## 4. Funcionalidades (SDD con Spec Kit)

| Func. | Nombre | Historias | Estado | Evidencia |
|---|---|---|---|---|
| 001 | Usuarios y acceso | HU01, HU02 | US1–US7 verificadas. Cierre transversal pendiente | [Estado y pruebas](../specs/001-usuarios-y-acceso/implementation-status.md) |
| 002 | Prestadores y catálogo | HU03–HU05, HU25 | Planificada | `specs/002-…` |
| 003 | Solicitudes y cotizaciones | HU07, HU08, HU10, HU11 | Planificada | `specs/003-…` |
| 004 | Contratación | HU12, HU13, HU16 | Planificada | `specs/004-…` |
| 005 | Seguimiento y cierre | HU18, HU19 | Planificada | `specs/005-…` |
| 006 | Notificaciones | HU22 | Planificada | `specs/006-…` |

Al implementar cada funcionalidad se agrega aquí la lista de componentes construidos y los archivos de prueba que la verifican.

## 5. Diagramas y su evidencia

| Diagrama | Documento | Evidencia que aporta |
|---|---|---|
| Contexto (C4-1) | [Nivel 1](04-modelo-c4/01-nivel1-contexto.md) | Actores y sistemas externos |
| Contenedores (C4-2) | [Nivel 2](04-modelo-c4/02-nivel2-contenedores.md) | Tecnologías y comunicación |
| Componentes (C4-3) | [Nivel 3](04-modelo-c4/03-nivel3-componentes.md) | Módulos y relaciones numeradas |
| Clases y secuencia (C4-4) | [Nivel 4](04-modelo-c4/04-nivel4-codigo.md) | Diseño de AceptarPropuesta |
| Despliegue | [Despliegue](04-modelo-c4/05-despliegue.md) | Nodos y entrega continua |
| Estados | [Requisitos funcionales](01-analisis-de-sistema/03-requisitos-funcionales.md) | Ciclo de vida de solicitud, cotización y contratación |
| Modelo de datos | [Modelo de datos](03-diseno-de-software/modelo-de-datos.md) | Tablas e índice único parcial |

---

[Índice del proyecto](../README.md)
