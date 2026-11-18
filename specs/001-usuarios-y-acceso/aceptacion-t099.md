# Aceptación de T099 por su criterio original

Fecha local: 2026-11-17. Fuente actual: **D099-e333f5a7f71d150f**, 188 huellas;
base Git `7d3f71bb2d5ceaae2928e2534d5234425cbd67fc` más cambios locales de D099.
Esta reevaluación conserva el código, pruebas, contratos, frontend y TLS.

**Decisión: T099 terminada y verificada. US6 aceptada; US7 no iniciada.**
El incidente HTTP 503 histórico sigue abierto y no condiciona esta aceptación.

## Texto y alcance de aceptación

T099 requiere conectar las rutas de cambio/confirmación en App.tsx y la composición
web; ejecutar T086–T090, permisos ampliados y regresiones de acceso/recuperación;
guardar resultados reales y comprobar destino anterior/nuevo sin revocación global
inferida. Su descripción no exige identificar la causa de un incidente histórico
ni ejecutar el cierre transversal T110. Se conserva el texto literal en tasks.md.

La instrucción de esta reevaluación separa expresamente esos criterios del incidente.
La aceptación se basa en evidencia vigente y en verificaciones actualizadas por el
impacto de D099, sin añadir condiciones retrospectivas.

## Evidencia por criterio

| Criterio original | Evidencia y versión | Evaluación |
|---|---|---|
| Rutas y composición web | App.tsx y usuarios-acceso.ts conservan sus huellas de F3; recorrido real actual de correo Linux/chromium-768 1/1 contra API D099 reiniciada | Conectadas y verificadas. |
| T086: U de correo | D099 `final-2/unit-5-junit.xml`, 8/8 | Vigente; sin cambios posteriores de fuente. |
| T087: I de correo | D099 `final-2/integration-5-junit.xml`, 16/16 | Vigente; todos los seis CA-COR, concurrencia, versiones y recencia. |
| T088: C de correo | D099 `final-2/contract-4-junit.xml`, 8/8 | Vigente; autenticación/origen/idempotencia, errores y ausencia de Set-Cookie. |
| T089: V de correo | F3 `frontend-junit.xml`,9 casos COR dentro de 46 | Se conserva por identidad de frontend, pruebas y lockfiles; no se reejecutó V. |
| T090: E de correo | F3 Linux/Windows 9 casos COR por entorno, incluida espera 301 s en chromium-360; nuevo E D099 Linux/chromium-768 1/1 | Las matrices siguen asociadas a F3. El recorrido actual verifica el enlace entre web y API D099; no es una nueva matriz. |
| Permisos ampliados | **Actualizados:** I permisos 10/10 y C permisos 19/19 en D099 | Cubre las nueve rutas Bearer, incluidas reautenticación y solicitud/confirmación de correo, con controles positivos/negativos. |
| Regresiones de acceso/recuperación | D099: I sesiones 19/19 y recuperación 14/14; C sesiones 13/13 y recuperación 9/9; U y fundación de la selección anterior | Vigentes y suficientes para este criterio; no se exige una regresión completa ajena al texto. |
| Destino anterior/nuevo y sesiones | I correo 16 prueba credencial anterior, UUID/datos/sesiones/renovación; E actual comprueba login anterior 401, nuevo 200 y recuperación al nuevo destinatario | Verificado; no se añadió revocación global por cambio de correo. |
| Evidencia real guardada | F3, diagnóstico D099 y aceptación actual, en `tecnologia/.local/evidencia/001/us6/` | Informes separados por ejecución y versión. |

Se compararon 51 fuentes de frontend/configuración/lockfiles/contrato con F3, todas
idénticas, y se comprobó la huella completa D099 antes/después de las verificaciones.
Las reglas de negocio y la API pública permanecen iguales. D099 añadió diagnóstico
en infraestructura compartida; por ello se actualizaron permisos y el recorrido
integrado actual, conservando las verificaciones vigentes de correo/acceso/recuperación.

## Selección acotada frente a regresión completa

| Ejecución | U | I | C | Navegador |
|---|---:|---:|---:|---|
| Selección anterior D099, `diagnostico-t099-20261117/final-2/` | 54 | 57 | 35 | No ejecutado en aquel diagnóstico. |
| Esta reevaluación, misma fuente D099 | — | 10 | 19 | **1/1**, Linux/chromium-768, solo correo. |
| Unión de la selección D099, sin duplicar casos | **54** | **67** | **54** | Un caso actual; las matrices F3 se contabilizan aparte. |

**Esta unión no es una regresión completa de backend.** Incluye cinco archivos U,
seis I y cinco C; no se reejecutaron las suites de registro/perfil. Los resultados
anteriores completos de F3 (97 U/84 I/88 C, 46 V, 90 E por entorno) siguen vinculados a esa
versión; C de F3 conserva su repetición de registro y su consolidación explícita.
**No se ejecutaron matrices completas de navegador sobre D099.** Las nueve
combinaciones por entorno, incluida la espera física301s, siguen documentadas en F3.
No se repitieron reglas o pruebas sin impacto nuevo que lo justificase.

Los comandos nuevos seleccionan **archivos completos**, sin filtros por caso:

- Jest integración: `--selectProjects integration --runInBand --no-cache --runTestsByPath test/integration/usuarios-acceso/permisos.spec.ts`.
- Jest contrato: `--selectProjects contract --runInBand --no-cache --runTestsByPath test/contract/usuarios-acceso/permisos.spec.ts`.
- Navegador: `npm run test:e2e:container -- --sin-construir test/e2e/usuarios-acceso/correo.spec.ts --project=chromium-768`.

El navegador reutilizó la imagen F3 de digest idéntico, con sus fuentes sin cambios;
la web se sirvió desde Vite y la API D099 se inició de nuevo para esta comprobación.
TLS conservó CA, certificado, SAN y rechazo de nombre ajeno. La ejecución actual
tuvo cero fallos, omitidos, reintentos automáticos o abortos nativos.
Tipos/lint/build/arquitectura ya pasan en la misma fuente D099 y no se repitieron.

## Pendientes independientes

**Incidente HTTP 503 histórico: abierto.** La causa continúa indeterminada por
pérdida de la excepción interna original y falta de reproducción no inducida con
diagnóstico. Se conservan sus evidencias y el [informe de diagnóstico](diagnostico-t099.md),
sus límites, los registros seguros añadidos y las medidas propuestas: captura y
retención de stderr, correlación/versión de despliegue y comparación segura con
eventos de PostgreSQL. La prueba inducida 55P03 no identifica su causa histórica.

**Abortos nativos Windows 0xC0000409:** incidente separado, causa no demostrada.
Los intentos y repeticiones anteriores no se reescriben. No ocurrieron en esta
reevaluación; ello no los declara reparados.

**T110 y corpus productivo:** siguen pendientes como controles transversales y
preparación de despliegue. No son condiciones añadidas a T099. US7 y sus tareas
T100–T109 no se iniciaron. Tampoco se declara terminada la funcionalidad 001 ni su DoD.

Evidencia nueva en `tecnologia/.local/evidencia/001/us6/aceptacion-t099-20261117/`:
`version.json`, `antes.json`, `permisos-ejecuciones.json`, JUnit, `e2e-linux/`,
`navegador-resultado.json`, escaneo de secretos y `verificacion.json`.
**467 archivos de evidencia anteriores conservan sus huellas.** Los documentos
anteriores se guardaron por separado para conservar también la decisión previa.
