# Estado de implementación — 003 Solicitudes y cotizaciones

Documento vivo de la funcionalidad 003. Se actualiza con cada fase. Datos ficticios; no contiene secretos.

## 1. Línea base

| Elemento | Valor |
|---|---|
| Rama | `003-solicitudes-y-cotizaciones` |
| Commit documental base de la implementación | `d078263` (docs(003): especificacion plan y tareas) |
| Línea base de 001 y 002 en `main` | `c32f2c8` |
| Runtime | Node.js 24.15.0 (toolchain local del proyecto) |
| Alcance autorizado hasta ahora | Fase 1, T001 a T008 |

## 2. Contratos fuente e inventario de operaciones

| Funcionalidad | Contrato fuente | Operaciones |
|---|---|---|
| 001 Usuarios y acceso | `specs/001-*/contracts/` | 17 |
| 002 Prestadores y catálogo | `specs/002-prestadores-y-catalogo/contracts/` | 23 |
| 003 Solicitudes y cotizaciones | `specs/003-solicitudes-y-cotizaciones/contracts/` | 18 |
| **Total compuesto** | | **58** |

Distinción de verificación:

- **Verificado con el ensamblador de documentos** (`componerOpenApi`, solo lectura, 2026-11-26): 17 + 23 + 18 = 58 operaciones. Esto prueba la composición de documentos, no el comportamiento de la API.
- **Solo se verificará con el arranque real**: que la aplicación arranque con las 58 operaciones, el espejo ejecutable del contrato de la 003 (aún no existe; se crea en T010) y la validación definitiva de la composición (T088).

## 3. Verificaciones de aceptación

Todas en estado **PENDIENTE** salvo lo indicado en la sección 4 (infraestructura de la Fase 1). Ninguna historia de usuario, criterio de aceptación (CA), caso de prueba (CP-301..310) ni objetivo de operación (OP-301..307) se ha implementado ni verificado.

| Bloque | Estado |
|---|---|
| Historias de usuario y requisitos FR-3xx | PENDIENTE |
| Criterios de éxito SC-3xx | PENDIENTE |
| Contratos y pruebas de contrato | PENDIENTE |
| Integración con PostgreSQL y almacenamiento | PENDIENTE |
| Pruebas de extremo a extremo (matriz 3 navegadores × 3 anchos) | PENDIENTE |
| Rendimiento (k6) | PENDIENTE |
| Seguridad y privacidad | PENDIENTE |
| Respaldo y restauración | PENDIENTE |
| Arranque real con 58 operaciones (T088) | PENDIENTE |
| CI en GitHub Actions | PENDIENTE (flujo creado, no ejecutado) |

## 4. Resultados de la Fase 1 (T001–T008)

Evidencia local (ignorada por Git): `tecnologia/.local/evidencia/003/fase1/` (`verificaciones-fase1.txt` y los JUnit de las suites).

| Tarea | Resultado | Evidencia |
|---|---|---|
| T001 | Este documento. | — |
| T002 | `tecnologia/compose.003.yaml`: proyecto `ayacucho-003-validacion`; PostgreSQL 54331, Redis 63801, correo 1027/8027, Garage 3911, proxy 8447. Sin bucket ni clave predeterminados. | `docker compose config`; `up -d --wait` con los cuatro servicios Healthy; `down -v` sin residuos. |
| T003 | `tecnologia/backend/scripts/entorno-003.ts`: identidad, puertos, rutas y base `ayacucho_003_validacion`; ningún valor coincide con 001 ni 002. El bucket `plataforma-003-validacion` es el equivalente en validación del bucket único con prefijos lógicos. | Pruebas unitarias del entorno. |
| T004 | `tecnologia/backend/scripts/preparar-validacion-003.ts`: genera solo configuración, TLS y catálogo ficticio de la 003 bajo `.local/003/`; exige `--validation`; idempotente. | Ejecuciones reales, guardas y pruebas unitarias. |
| T005 | Soporte de pruebas en `tecnologia/backend/test/soporte/solicitudes-cotizaciones/` (`postgres.ts`, `contador-sentencias.ts`, `almacenamiento.ts`). | Verificado contra PostgreSQL y Garage reales (base temporal creada y retirada, conteo de sentencias, retiro acotado por prefijo) y 18 pruebas unitarias. |
| T006 | `tecnologia/frontend/playwright.003.config.ts` y `scripts/independencia-003.mjs`: 3 navegadores × 3 anchos (9 proyectos), evidencia confinada a `.local/evidencia/003/`. | 7 pruebas unitarias. No se ejecutó ninguna prueba de navegador. |
| T007 | `.github/workflows/solicitudes-cotizaciones.yml`: tres trabajos (calidad, validación 003, regresión 001 y 002). | Solo verificación estructural (YAML). **No se ha ejecutado en GitHub Actions.** |
| T008 | Seis comandos en `tecnologia/backend/package.json` y `scripts/iniciar-validacion-003.ts`; los comandos de 001 y 002 no cambian. | `--verificar-config` real; no regresión de comandos de 002. |

Calidad: lint, typecheck y build de backend y frontend en verde. Unitarias completas: backend 26 suites / 378 pruebas; frontend 19 archivos / 180 pruebas.

## 5. Incidencias, desviaciones y pendientes

1. **T007 sin ejecución en GitHub.** El flujo ejecuta hoy solo lo que existe; los pasos que dependen de tareas posteriores se añaden con ellas. La regresión de 002 con la composición de la 003 se añade en T024 y T089; hoy la regresión ejecuta solo 001.
2. **Acciones delegadas.** `migrar`, `storage`, `seed` e `iniciar` informan "pendiente de T012/T029, T041, T042 y T013" y fallan sin tocar infraestructura. T041 menciona implementar `storage:init:003` en `iniciar-validacion-003.ts`, mientras que T008 delega en `scripts/inicializar-storage-003.ts` (como hace 002). Desviación menor; se decide al llegar a T041.
3. **Efecto colateral local.** Durante una ejecución de Vitest se sobrescribió `tecnologia/.local/evidencia/001/frontend-junit.xml` (archivo local, ignorado por Git). Después se evitó con `--outputFile.junit`.
4. **Node en PATH.** En Git Bash el `node` del PATH es v22; las verificaciones se ejecutaron con el toolchain 24.15.0.
5. **Deuda del saneador:** no aplica todavía.
6. **Fuera de alcance:** no se ha iniciado T009 ni ninguna fase posterior.
