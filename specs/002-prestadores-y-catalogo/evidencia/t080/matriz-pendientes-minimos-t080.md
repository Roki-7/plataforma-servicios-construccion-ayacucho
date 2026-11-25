# T080 · Matriz de pendientes mínimos (2026-11-25)

Criterio de cierre (tasks.md T080, quickstart EQ-07/PR07): comprobaciones automatizadas **y** recorridos principales **de la 002** en un celular y una computadora reales, con versión, ancho y plataforma registrados. Los flujos de la 001 (registro, acceso, recuperación, cambio de contraseña, perfiles, cierre de sesión) NO son recorridos de la 002 y tienen su propia evidencia: no se repiten.

## 1. Ya verificado, con evidencia reutilizable
| Qué | Evidencia |
|---|---|
| Accesibilidad, teclado, foco, nombres accesibles, errores, contraste y desbordamiento de las 8 vistas de la 002 | Matriz `accesibilidad-responsive.spec.ts`: 54/54 en Chromium, Firefox y WebKit a 360/768/1366 px (repetida tras el rediseño); EQ-07 y PR07 aprobados en 9/9 proyectos |
| Recorridos funcionales de la 002 (búsqueda, detalle, perfil, titular, categorías) | T075–T079 aprobadas (261 pruebas E2E con las de T080) |
| 001: registro, acceso, recuperación, cambio de contraseña, perfiles, cierre de sesión | Evidencia de 001 (US1–US7, T099) y regresión 001 tras el cambio de menú y tras la enmienda de validaciones (16/16 E2E) |
| Tamaños de pantalla de las pantallas de 001 | Pruebas de 001 y revisión visual del responsable (sin registro propio de T080; no se exige) |

## 2. Observado manualmente en Opera (laptop), sin evidencia aún
R1 carga limpia · R2 filtros (sin coincidencias, quitar filtros, Construcción › Albañilería = 4), teclado y foco · R3 detalle, perfil, avisos, Alt+←, Tab/Enter · R4 errores del registro. **Valen como observación; no son evidencia hasta tener capturas y datos del equipo.**

## 3. Evidencia específica de T080 que falta (mínimo)
**Computadora (Opera):**
1. Datos del equipo: versión de Opera, `innerWidth`, modelo (1 min).
2. Capturas de lo ya observado: R1 (1), R2 (filtros y sin coincidencias; paginación = NO APLICA si con 4 servicios no hay segunda página), R3 (servicio, perfil, avisos). Solo pasar los archivos; **no repetir** las pruebas.
3. **R5** trabajo anterior con foto (no probado).
4. **R6** ciclo del servicio: publicar, editar, pausar, reactivar, retirar, comprobando en otra ventana sin sesión que pausado/retirado deja de verse (no probado). **Hacerlo sin ratón = R8** (un solo recorrido cubre ambos).
5. **R7** (parte 002): campos vacíos en el perfil profesional y en el servicio; mensaje junto al campo y foco al primer error.
6. **Perfil profesional** guardado con mensaje de confirmación (parte 002 de R4). Usar la cuenta que ya tenga; no repetir registro ni acceso.
7. **R9**: zoom 150–200 % sin cortes ni desplazamiento horizontal (1 captura).

**Celular Android (físico):** R1, R2 (selectores táctiles), R3, R5 (foto desde galería), R6, R7 (un error de servicio) y R9 (horizontal y texto grande). Sin repetir registro, recuperación ni cambio de contraseña (001). Capturas con el nombre `R<n>-<ancho>px-<paso>.png` y datos del dispositivo.

## 4. Solo se puede comprobar en un dispositivo físico
Tacto (objetivos pulsables con el dedo), selectores y menú lateral en pantalla táctil, foto desde la galería/cámara, orientación horizontal, tamaño de texto del sistema, ancho CSS real y certificado sin avisos en el teléfono (requiere el acceso de red local propuesto y autorizado aparte).

## 5. Mejoras futuras que NO bloquean T080
- «Nombre para mostrar» acepta `1234`: conforme a la regla vigente de 001; mejora propuesta (exigir al menos una letra), enmienda de 001 aparte.
- Hallazgos de 001 ya documentados y no corregidos: botón «mostrar contraseña» superpuesto al campo y enlace «Olvidé mi contraseña» con menos de 24 px de alto.
- Búsqueda por texto libre (otra especificación).
- Lector de pantalla real (NVDA / TalkBack): opcional y recomendable.
- Emulación móvil de Opera: no cuenta para T080.
- Renovar el certificado de `localhost` (vence 2026-11-30) y la limpieza de restos de la restauración de portafolio.
- Catálogo de construcción: trabajo separado y pendiente.

## 6. Cierre
Con 3 y 4 registrados y verificadas las capturas, se documenta PR07 en `implementation-status.md` y recién entonces se marca T080. No se marca antes.
