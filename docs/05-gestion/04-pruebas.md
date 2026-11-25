# Estrategia de pruebas

## 1. Niveles de prueba

| Nivel | Qué comprueba | Herramienta |
|---|---|---|
| Unitarias | Reglas del dominio y casos de uso, sin base de datos | Jest |
| Integración | Repositorios, transacciones e índices con PostgreSQL real | Jest con PostgreSQL en Docker |
| Contrato | Que la API responde como indica su OpenAPI | Jest + Supertest |
| Arquitectura | Que se respeta la regla de dependencia entre capas y módulos | dependency-cruiser |
| Extremo a extremo | Recorridos completos en el navegador y en varios tamaños de pantalla | Playwright |
| Rendimiento | Tiempos de respuesta y carga | k6 |
| Usabilidad | Que un cliente complete una solicitud sin ayuda | Prueba con 5 participantes |

## 2. Catálogo de pruebas (PRnn ↔ EQ-nn)

| Prueba | Descripción | Escenario | Funcionalidad | Estado |
|---|---|---|---|---|
| PR01 | El 95 % de las búsquedas responde en 2 s o menos con menos del 1 % de errores | EQ-01 | 002 | Medida en validación local (T082); pendiente de CI |
| PR02 | Comprobación de salud cada minuto durante el periodo de servicio | EQ-02 | 001 | Planificada |
| PR03 | Con dos réplicas de la API, la carga aumenta sin cambiar las reglas del negocio | EQ-03 | 002 | Medida en validación local (T083); pendiente de CI |
| PR04 | Matriz de accesos no autorizados: 100 % rechazados sin exponer ni modificar datos | EQ-04 | 001–006 | 002: matriz ejecutada en validación local (T079); pendiente de CI. El estado de 001 consta en su evidencia |
| PR05 | Sustituir el adaptador de IA sin modificar los casos de uso | EQ-05 | 007 | Planificada |
| PR06 | Cuatro de cinco participantes completan una solicitud en 5 minutos o menos | EQ-06 | 003 | Planificada |
| PR07 | Recorridos principales en celular, tableta y computadora sin errores visuales | EQ-07 | 001–006 | 002: parcial (automatizada aprobada; manual en celular sin ejecutar; T080 cerrada por excepción) |
| PR08 | Si la IA o los mapas no responden, se ofrece la alternativa en 8 s o menos | EQ-08 | 007 | Planificada |
| PR09 | 100 repeticiones con 10 aceptaciones simultáneas: exactamente una contratación activa | EQ-09 | 004 | Planificada |
| PR10 | Repetir una aceptación con la misma clave no crea otra contratación | EQ-09 | 004 | Planificada |
| PR11 | Transiciones de estado válidas e inválidas de la contratación | EQ-09 | 004, 005 | Planificada |
| PR12 | Regla de dependencia: el dominio no importa frameworks ni otros módulos | EQ-05 | 001 | Precedente de arquitectura aplicado también en 002 (ver nota) |
| PR13 | Bloqueo de 15 minutos tras 5 intentos fallidos | EQ-04 | 001 | Planificada |
| PR14 | Enlace de recuperación de un solo uso que vence en 30 minutos | EQ-04 | 001 | Planificada |
| PR15 | Una falla del proveedor de avisos no deshace la operación y se reintenta | EQ-08 | 004, 006 | Planificada |
| PR16 | Un cambio de condiciones solo se incorpora con la aceptación de ambas partes | EQ-09 | 009 | Planificada |

El estado cambia a **Ejecutada** cuando la prueba está automatizada y pasa en la integración continua.

### Notas de la 002 (ensayos reales)

- **PR01 / EQ-01.** Con 50 usuarios virtuales durante 15 minutos y pausas de 3 a 8 s, sobre 1 000 prestadores y 5 000 servicios: p95 de 63 ms con Redis disponible y de 57 a 83 ms con Redis detenido durante toda la carga (dos corridas válidas), con 0 % de errores técnicos. Las corridas inválidas, sus causas y el riesgo residual constan en `specs/002-prestadores-y-catalogo/implementation-status.md`.
- **PR03 / EQ-03.** Se compara **una réplica** a 25 y 50 usuarios con **dos réplicas a 50 usuarios con el doble de CPU y memoria totales** (1 CPU y 512 MB por réplica; PostgreSQL y demás recursos fijos iguales). Ambas configuraciones cumplen p95 ≤ 2 s y errores < 1 % durante 15 minutos; el tráfico se repartió 50/50. **Alcance medido:** reparto y estabilidad dentro de esos umbrales; **no** demuestra escalabilidad bajo saturación.
- **PR12 y el escenario EQ-05.** PR12 conserva su identificador y es una **prueba de arquitectura** (dependency-cruiser) que sirve de precedente para comprobar dependencias entre capas y módulos; la 002 la aplica a sus módulos. Se distingue del **ensayo de sustitución del adaptador de IA (PR05)**, que pertenece a la funcionalidad 007 y no se ha ejecutado. Comparten el escenario EQ-05, no la prueba.
- **PR07.** El componente automatizado (54 de 54 en Chromium, Firefox y WebKit a 360, 768 y 1366 px) está aprobado; el componente manual en celular real no se ejecutó y T080 se cerró administrativamente por excepción.
- **Pendientes, separados de lo ejecutado.** Integración continua de las pruebas de 002; PR07 en celular físico; PR09 a PR11 y PR15 (004 a 006); PR05 y PR08 (007); PR06 (003).

## 3. Datos y entornos

| Entorno | Uso |
|---|---|
| Local con Docker Compose | Desarrollo y pruebas de integración con PostgreSQL y Redis. |
| Integración continua (GitHub Actions) | Lint, pruebas unitarias, de integración, de contrato y de arquitectura en cada pull request. |
| Entorno de demostración | Pruebas de rendimiento, extremo a extremo y de usabilidad. |

Los datos de prueba son ficticios y se identifican como tales. Nunca se usan datos personales reales.

## 4. Criterio de cierre

Una funcionalidad se cierra cuando todas sus pruebas pasan, cada escenario de su `spec.md` tiene al menos una prueba y las pruebas PR04 (permisos) y, si corresponde, PR09 (concurrencia) están incluidas.

### Evidencia de Usuarios y acceso

La matriz de 001 asigna requisitos por nivel U/I/C/V/E para cada uno de sus 53
escenarios. T110–T114 agregan permisos, bloqueo, recuperación, fallos de
dependencias, seguridad de navegador, fotografías, contrato, arquitectura y una
medición de salud y carga local. T115 cruza los resultados ejecutados con cada
asociación de la matriz. El informe distingue versiones, matrices completas,
selecciones, repeticiones y pendientes de aceptación. Tras T116 y T117, la CI alojada terminó en verde en #5 (`d330a06`), #6 (`e312f2f`), #7 (`a13d0ce`), #8 (`47c888e`) y #9 (`d534a60`, último commit publicado); el recuento exacto del artefacto no pudo leerse (registros y artefacto exigen autenticación). Se ejecutaron además, en local, los permisos de contrato (21) e integración (10), peticiones manipuladas contra el entorno de validación y 36 recorridos de Chromium a 360, 768 y 1366 px. La revisión humana de usabilidad fue parcial y su alcance exacto está en `tecnologia/.local/evidencia/001/validacion.md`, archivo local no versionado. Quedan documentados tres fallos intermitentes sin causa confirmada y que Firefox y WebKit constan solo por la CI. [Matriz de 001](../../specs/001-usuarios-y-acceso/test-matrix.md) · [Resultados](../../specs/001-usuarios-y-acceso/implementation-status.md)

---

[Índice del proyecto](../../README.md)
