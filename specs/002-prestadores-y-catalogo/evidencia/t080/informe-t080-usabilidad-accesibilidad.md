# T080 · Informe de pruebas de usabilidad y accesibilidad (EQ-07 / PR07)

**Funcionalidad:** 002 · Prestadores y catálogo — WasiMaki (Plataforma de Servicios de Construcción de Ayacucho)
**Fecha del informe:** 2026-11-25 · **Rama:** `002-prestadores-y-catalogo`
**Estado de T080:** **CERRADA ADMINISTRATIVAMENTE POR EXCEPCIÓN** (2026-11-25); **no** es una aprobación técnica completa. **Estado de PR07:** **parcialmente cumplido** (componente automatizado aprobado; componente manual incompleto), registrado con el mismo criterio. Ver las secciones 9 y 10.

> Este informe consolida lo comprobado, separa lo observado de lo demostrado y registra las excepciones. No convierte observaciones parciales en aprobaciones formales ni atribuye resultados nuevos a las evidencias automatizadas.

## 1. Objetivo y alcance

Verificar accesibilidad, adaptabilidad y usabilidad de las vistas de visitante y de titular de la 002 (criterios de `tasks.md`, T080; escenario EQ-07 y prueba PR07 de `plan.md` y `quickstart.md`): navegación por teclado, foco visible y ordenado, controles con nombre, lectura de errores y avisos, contraste y uso sin desbordamiento en celular, tableta y computadora, más recorridos manuales en celular y computadora reales con versión, ancho y plataforma registrados.

Quedan fuera de T080 los flujos de la 001 (registro, acceso, recuperación y cambio de contraseña, perfiles y cierre de sesión), que cuentan con su propia evidencia, y el trabajo del catálogo de construcción.

## 2. Entorno de pruebas

| Elemento | Valor |
|---|---|
| Plataforma | Validación local de la 002 en `https://localhost:8444` (API 3002, interfaz 5175, PostgreSQL, Redis, almacenamiento de objetos y correo de pruebas) |
| Datos | Ficticios (`@example.invalid`); 4 categorías públicas, 4 servicios y 6 prestadores visibles al inicio |
| Pruebas automatizadas | Node 24.15, Playwright con Chromium, Firefox y WebKit a 360, 768 y 1366 px; base, bucket y Redis descartables |
| Pruebas manuales — computadora | Laptop física, Windows 11, **Opera GX 140.0.6074.48** (informado por la persona responsable). **Modelo de la laptop y `innerWidth` real: no registrados** |
| Pruebas manuales — celular | **Samsung Galaxy A32 (físico): NO ejecutadas** |

## 3. Metodología

1. **Automatizada:** `accesibilidad-responsive.spec.ts` (6 pruebas por proyecto) y las series E2E de las vistas de la 002, con mediciones sobre el DOM y los estilos calculados de cada navegador.
2. **Manual en laptop:** recorridos R1 a R9 del procedimiento `procedimiento-t080.md`, realizados por la persona responsable y registrados por ella; el registro formal está en `registro-manual-t080.md`.
3. **Corroboración:** consultas de solo lectura a la base de validación para contrastar los datos de R5 y R6.
4. **Regla de evidencia:** una observación manual sin captura verificable en el repositorio no se registra como PASÓ.

## 4. Matriz R1–R9

Leyenda: **OBSERVADO** = informado por la persona responsable, sin captura en el repositorio; **PARCIAL** = hay criterios sin comprobación documentada; **NO EJECUTADO** = no realizado.

| Id | Recorrido | Computadora (Opera GX) | Celular (Galaxy A32) | Cobertura automatizada previa |
|---|---|---|---|---|
| R1 | Página principal | OBSERVADO: carga correcta, componentes y legibilidad sin cortes ni superposiciones | NO EJECUTADO | Vistas de búsqueda en 9 proyectos |
| R2 | Búsqueda y filtros | OBSERVADO: categorías y subcategorías, actualización de resultados, «sin coincidencias», «Quitar filtros», teclado con foco visible | NO EJECUTADO | Búsqueda con y sin resultados, selectores y filtros |
| R3 | Detalle y perfil público | OBSERVADO: consulta de servicios, perfil del prestador, información pública y retorno a resultados | NO EJECUTADO | Detalle, servicio no disponible y perfil público |
| R4 | Formularios | OBSERVADO: etiquetas, obligatorios y mensajes de validación del registro; perfil profesional guardado | NO EJECUTADO | Errores de campo con atributos ARIA |
| R5 | Perfil profesional y portafolio | OBSERVADO: perfil guardado, trabajos anteriores creados, fotografías cargadas y eliminadas. Corroborado en la base: 1 perfil, 3 trabajos y 3 fotografías registrados el mismo día | NO EJECUTADO | Perfil y portafolio (7/7 por proyecto probado) |
| R6 | Gestión de servicios | OBSERVADO: publicar, editar, pausar, reactivar y retirar, con efecto en la búsqueda pública. Corroborado en la base: «Pintura de interiores - Prueba T080 editado», **RETIRADO, versión 5**; la API pública devuelve solo los 4 servicios publicados | NO EJECUTADO | «Mis servicios» y retiro con confirmación |
| R7 | Validaciones | PARCIAL: mensajes de campos obligatorios del servicio y del registro. **Sin comprobación documentada:** perfil profesional y foco al primer error | NO EJECUTADO | Errores y foco en formularios corregidos |
| R8 | Teclado | PARCIAL: la persona confirma que opera con Tab y Enter; en R2 el foco era visible. **Sin comprobación documentada:** ciclo R6 completo con teclado, orden lógico del foco y ausencia de atrapamiento | NO APLICA | Orden de tabulación, foco y trampas en los 9 proyectos |
| R9 | Lectura y adaptación | PARCIAL: revisión visual con zoom del 150 %, 200 % y 300 % sin superposiciones visibles en las capturas, y observación con tamaños de pantalla simulados. **Sin comprobación documentada:** ausencia de desplazamiento horizontal en toda la página | NO EJECUTADO | Desbordamiento a 360, 768 y 1366 px |

## 5. Resultados y evidencias

### 5.1 Evidencia automatizada aprobada (reutilizada; sin resultados nuevos)

| Evidencia | Resultado | Referencia |
|---|---|---|
| `accesibilidad-responsive.spec.ts` | **54 de 54** en 9 proyectos (Chromium, Firefox y WebKit × 360, 768 y 1366 px); EQ-07 y PR07 automatizados aprobados en 9 de 9; base de validación sin cambios | `implementation-status.md`, secciones «T080 · Ronda de verificaciones E2E tras el rediseño» y «T080 · Accesibilidad, adaptabilidad y usabilidad» |
| Series E2E de las vistas de la 002 tras el rediseño | `perfil-y-portafolio` 7/7, `servicios` 4/4, `busqueda` 4/4 y `entorno` 4/4 en los proyectos indicados | mismas secciones |
| Pruebas E2E de T075 a T079 | Aprobadas (261 pruebas, contando las de T080) | `tasks.md` y `implementation-status.md` |
| Regresión de 001 tras el menú y tras la enmienda de validaciones | Seis suites en Chromium 360 y 1366: 8/8 en cada ancho; 16/16 tras la enmienda | `implementation-status.md` |
| Regresión de 002 y calidad | Unitarias, contrato, integración, infraestructura y arquitectura aprobadas tras la enmienda INC-002-01 | commit `7c501f2` y `implementation-status.md` |
| Corroboración de R5 y R6 | Consultas de solo lectura a la base de validación (sin modificaciones) | sección 4 de este informe |

Los informes y capturas automatizadas están en `tecnologia/.local/evidencia/002/` (local, no versionado).

### 5.2 Evidencia manual

La evidencia manual consta como **observaciones informadas**. Las capturas se compartieron en otra conversación y **no se encuentran en el directorio local de evidencias** (`manual-t080/computadora/capturas/` y `manual-t080/celular/capturas/`, 0 archivos al redactar este informe). No se afirma su existencia.

## 6. Observaciones y mejoras futuras (no bloquean T080)

- **Nombre para mostrar `1234`:** cumple la regla vigente de la 001 (FR-033: obligatorio, hasta 200 caracteres, sin caracteres de control). Se propone exigir al menos una letra Unicode, admitiendo dígitos y signos en nombres comerciales y personales, incluidos tildes, ñ y apóstrofos del español y del quechua. Requiere una enmienda controlada de la 001; **no se modificó ninguna regla**.
- **Hallazgos de la 001 ya documentados y no corregidos:** el botón «mostrar contraseña» se superpone al campo y el enlace «Olvidé mi contraseña» mide menos de 24 px de alto.
- **Búsqueda por texto libre:** pendiente de especificar en otra funcionalidad.
- **Lector de pantalla real (NVDA, TalkBack):** pasada opcional, no realizada.
- **Certificado de `localhost`:** vence el 2026-11-30; conviene renovarlo.

## 7. Limitaciones

1. Las pruebas manuales se realizaron en una sola laptop con Windows 11 y Opera GX 140.0.6074.48; no se probaron otros navegadores reales.
2. Las capturas compartidas en ChatGPT todavía no están en el directorio local de evidencias.
3. No se registró el modelo de la laptop ni su ancho real (`innerWidth`).
4. **Las pruebas en un Samsung Galaxy A32 físico no fueron ejecutadas.** El acceso por red local desde el teléfono no se preparó ni se modificó ninguna configuración de red, firewall o certificados.
5. No cuentan con comprobación completa: el foco al primer error en el perfil profesional, el orden de foco y la ausencia de atrapamiento en el ciclo R6 con teclado, la visualización pública de fotografías (R5) y la ausencia de desplazamiento horizontal en toda la página con zoom alto.
6. La emulación de tamaños de pantalla (automatizada o del navegador) no sustituye un dispositivo físico.
7. No se ejecutó la matriz completa de 001 (Firefox, WebKit y 768 px).

## 8. Conformidad del usuario y decisión

La persona responsable del producto expresa su **conformidad con el funcionamiento observado de la plataforma** en las funciones probadas y **decide no realizar más pruebas manuales por ahora**. Esta conformidad se registra como aceptación funcional informada; **no equivale a la evidencia exigida por el criterio de cierre de T080** y no modifica el estado de las verificaciones; sí fundamenta la excepción de la sección 10.

## 9. Conclusión, recomendaciones y estado de cumplimiento

**Conclusión.** Los recorridos de la 002 se observaron correctos en la laptop y la evidencia automatizada de accesibilidad y diseño adaptable es completa y aprobada. Persisten tres brechas frente al criterio de cierre: (a) los recorridos manuales no tienen aún capturas ni datos técnicos completos, (b) no hay ejecución en un celular real y (c) PR07 no puede documentarse como cumplido sin (a) y (b).

| Criterio de T080 | Estado |
|---|---|
| Navegación por teclado, foco visible y ordenado, controles con nombre, lectura de errores y avisos, contraste y ausencia de desbordamiento (celular, tableta y computadora) | **Cumplido por evidencia automatizada** (emulación); manual parcial |
| Recorrido manual en computadora real, con versión, ancho y plataforma | **Parcial:** versión y plataforma registradas; ancho, modelo y capturas pendientes |
| Recorrido manual en celular real | **No ejecutado** |
| Documentación de PR07 | **Parcial:** componente automatizado aprobado; componente manual incompleto |
| **T080** | **CERRADA ADMINISTRATIVAMENTE POR EXCEPCIÓN (`[x]`)**, no aprobación técnica completa |

**Excepciones documentadas.** (1) Celular físico no ejecutado. (2) Capturas pendientes de incorporación. (3) Modelo y ancho de la laptop sin registrar. Ninguna se considera cumplida ni ejecutada; se cubren con la excepción de la sección 10.

**Recomendaciones.**
1. Copiar las capturas a `tecnologia/.local/evidencia/002/manual-t080/computadora/capturas/` con el formato `R<n>-<ancho>px-<paso>.png`, medir `innerWidth` y registrar el modelo.
2. Ejecutar R1, R2, R3, R5, R6, R7 y R9 en el Galaxy A32 cuando se disponga de tiempo, con el acceso por red local autorizado aparte; o formalizar la excepción.
3. Tratar la mejora del nombre y los hallazgos de la 001 como enmiendas independientes.

## 10. Excepción de cierre administrativo (2026-11-25)

**Decisión.** El responsable del producto, tras revisar los resultados funcionales y visuales de R1 a R9 en laptop y la evidencia automatizada aprobada, da su conformidad y autoriza expresamente cerrar T080 mediante una excepción documentada para las evidencias no completadas, en particular las pruebas en Android físico y las capturas no incorporadas.

**Base normativa.** La constitución (sección de gobierno) establece que las excepciones deben documentarse y aprobarse antes de aplicarse, y que las enmiendas cuentan con la aprobación explícita del responsable. Esta excepción se documenta aquí y se aplica después de la autorización expresa del responsable en la sesión de trabajo. No se identificó otra aprobación requerida por la constitución o por la especificación para una excepción de verificación; **el cierre de la funcionalidad sigue sujeto a T093, T094 y a la revisión independiente y manual del Product Owner conforme a la Definition of Done**, donde esta excepción deberá revisarse de nuevo.

**Alcance y naturaleza.** Cierre **administrativo**, diferenciado de una aprobación técnica completa. No declara ejecutada ninguna prueba que no se haya hecho. PR07 se registra con el mismo criterio: componente automatizado aprobado, componente manual parcial.

**Evidencias no completadas (permanecen pendientes):**
1. Recorridos R1 a R9 en celular físico (Samsung Galaxy A32): no ejecutados.
2. Capturas de la laptop: compartidas fuera del repositorio, no incorporadas.
3. Modelo de la laptop y `innerWidth` reales: no registrados.
4. Comprobaciones específicas sin documentar: foco al primer error en el perfil profesional, orden de foco y ausencia de atrapamiento en el ciclo R6 con teclado, visualización pública de fotografías, ausencia de desplazamiento horizontal con zoom alto.
5. Pasada opcional con lector de pantalla real.

**Riesgos aceptados por el responsable:**
- Defectos propios de un dispositivo táctil físico (tamaño de los objetivos, selectores y menú lateral táctiles, foto desde galería o cámara, orientación horizontal y texto grande del sistema) podrían pasar inadvertidos hasta una prueba real.
- Faltan capturas verificables de la revisión manual, por lo que esa parte descansa en el testimonio del responsable y en la corroboración de solo lectura de R5 y R6.
- Los criterios de foco y de desplazamiento horizontal listados arriba solo cuentan con la cobertura automatizada de emulación.
- La emulación de tamaños de pantalla no sustituye un dispositivo físico.

**Condiciones y seguimiento.** Los pendientes siguen abiertos como deuda de verificación: cuando se disponga del teléfono se ejecutan R1, R2, R3, R5, R6, R7 y R9 y se completan los datos de la laptop; la revisión de cierre de T094 debe confirmar o reabrir esta excepción.

## 11. Anexos

- `registro-manual-t080.md`: registro de recorridos y sesión informada.
- `matriz-pendientes-minimos-t080.md`: pendientes mínimos para el cierre.
