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
| PR01 | El 95 % de las búsquedas responde en 2 s o menos con menos del 1 % de errores | EQ-01 | 002 | Planificada |
| PR02 | Comprobación de salud cada minuto durante el periodo de servicio | EQ-02 | 001 | Planificada |
| PR03 | Con dos réplicas de la API, la carga aumenta sin cambiar las reglas del negocio | EQ-03 | 002 | Planificada |
| PR04 | Matriz de accesos no autorizados: 100 % rechazados sin exponer ni modificar datos | EQ-04 | 001–006 | Planificada |
| PR05 | Sustituir el adaptador de IA sin modificar los casos de uso | EQ-05 | 007 | Planificada |
| PR06 | Cuatro de cinco participantes completan una solicitud en 5 minutos o menos | EQ-06 | 003 | Planificada |
| PR07 | Recorridos principales en celular, tableta y computadora sin errores visuales | EQ-07 | 001–006 | Planificada |
| PR08 | Si la IA o los mapas no responden, se ofrece la alternativa en 8 s o menos | EQ-08 | 007 | Planificada |
| PR09 | 100 repeticiones con 10 aceptaciones simultáneas: exactamente una contratación activa | EQ-09 | 004 | Planificada |
| PR10 | Repetir una aceptación con la misma clave no crea otra contratación | EQ-09 | 004 | Planificada |
| PR11 | Transiciones de estado válidas e inválidas de la contratación | EQ-09 | 004, 005 | Planificada |
| PR12 | Regla de dependencia: el dominio no importa frameworks ni otros módulos | EQ-05 | 001 | Planificada |
| PR13 | Bloqueo de 15 minutos tras 5 intentos fallidos | EQ-04 | 001 | Planificada |
| PR14 | Enlace de recuperación de un solo uso que vence en 30 minutos | EQ-04 | 001 | Planificada |
| PR15 | Una falla del proveedor de avisos no deshace la operación y se reintenta | EQ-08 | 004, 006 | Planificada |
| PR16 | Un cambio de condiciones solo se incorpora con la aceptación de ambas partes | EQ-09 | 009 | Planificada |

El estado cambia a **Ejecutada** cuando la prueba está automatizada y pasa en la integración continua.

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
