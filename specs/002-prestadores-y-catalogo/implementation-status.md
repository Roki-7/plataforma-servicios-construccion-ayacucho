# Estado de implementación — 002 Prestadores y catálogo

## Línea base

- Rama `002-prestadores-y-catalogo`. Plan respaldado en `b3897b0148cc21bf099f140f85765b6a2ab3c3d6`. La implementación comenzó desde `5a0393f`, con el árbol limpio y la misma revisión en la referencia remota local.
- La [copia de la especificación 001](../001-usuarios-y-acceso/contracts/openapi.json) y el [contrato activo del backend](../../tecnologia/backend/contracts/openapi.json) son idénticos byte por byte. Ambos tienen el objeto Git `c393b33b2e6a296bfcba4f36edcb8b88a00ec1b6` y 17 operaciones.
- El [contrato 002](contracts/openapi.json) tiene el objeto Git `5d791e9db2ccc1c95e365845a17ddea00040f6bb` y 23 operaciones. La comparación estática encontró 40 combinaciones únicas de método y ruta y 40 `operationId` únicos. La composición base de 001 queda protegida. El ensamblado y su regresión conjunta corresponden a T007, T011, T066 y T068.

| Inventario | Rutas relativas al prefijo `/api/v1` |
|---|---|
| 001 · Cuenta y sesión (8) | `POST /cuentas`, `POST /sesiones`, `DELETE /sesiones/actual`, `POST /sesiones/renovacion`, `GET /sesiones/csrf`, `POST /sesiones/reautenticacion`, `POST /recuperaciones`, `POST /recuperaciones/{token}` |
| 001 · Perfil y salud (9) | `GET` y `PATCH /perfil`, `POST /perfil/perfiles`, `POST /perfil/cambios-correo`, `POST /perfil/cambios-correo/{token}/confirmacion`, `POST /perfil/cambios-contrasena`, `POST /perfil/fotografias`, `GET /perfil/fotografias/{fotografiaId}`, `GET /salud` |
| 002 · Prestadores (10) | `GET` y `PUT /prestadores/perfil`, `POST /prestadores/perfil/trabajos`, `PATCH /prestadores/perfil/trabajos/{trabajoId}`, `POST /prestadores/perfil/trabajos/{trabajoId}/fotografias`, `PUT` y `DELETE /prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId}`, `GET /prestadores/{prestadorId}/trabajos/{trabajoId}/fotografias/{fotografiaId}`, `GET /prestadores/{prestadorId}`, `GET /prestadores` |
| 002 · Servicios (6) | `GET` y `POST /servicios`, `GET /servicios/mios`, `GET` y `PATCH /servicios/{servicioId}`, `POST /servicios/{servicioId}/transiciones` |
| 002 · Categorías (7) | `GET /categorias`, `GET` y `POST /admin/categorias`, `PATCH /admin/categorias/{categoriaId}`, `POST /admin/categorias/{categoriaId}/previsualizaciones-desactivacion`, `POST /admin/categorias/{categoriaId}/desactivaciones`, `POST /admin/categorias/{categoriaId}/activaciones` |

## Estado inicial de las verificaciones

| Grupo | Estado inicial | Alcance y evidencia esperada |
|---|---|---|
| T001–T006 | PENDIENTE | Inventario estático, preparación local, Compose, controles del iniciador, PostgreSQL real y selectores e informes de prueba. |
| HU03 / RF06 | PENDIENTE | CA-PRE-01 a 08. |
| HU04 / RF08 | PENDIENTE | CA-SER-01 a 09. |
| HU05 / RF09, RF10 | PENDIENTE | CA-BUS-01 a 08. |
| HU25 / RF39 | PENDIENTE | CA-CAT-01 a 10. |
| Integración y calidad | PENDIENTE | Unión de contratos y regresión de 001, Redis, seguridad, arquitectura, restauración, CI, accesibilidad, responsive, EQ-01 y EQ-03 según [tareas](tasks.md) y [guía de validación](quickstart.md). |
| Integraciones futuras | PENDIENTE | Solicitudes en 003, referencias posteriores, calificaciones en 011 y verificaciones en 012. |

Las verificaciones se registran como `PENDIENTE` cuando falta la ejecución aplicable, `EJECUTADA` cuando hay una ejecución por evaluar, `APROBADA` cuando la evidencia cumple el criterio o `FALLIDA` cuando una ejecución válida incumple el criterio. Los resultados de preparación se registran por separado de los escenarios de aceptación.

## Resultados de la fase 1

| Tarea | Estado | Verificación ejecutada |
|---|---|---|
| T001 | APROBADA | Se compararon los contratos con la línea base, se comprobó la igualdad de las dos copias 001 y se contaron 17 y 23 operaciones sin colisiones de rutas por método ni de `operationId`. |
| T002 | APROBADA | `dev:prepare:002 -- --validation` se ejecutó antes de Compose. Al repetir mantuvo los mismos archivos y los cinco archivos locales cotejados de 001. Coincidieron las dos sumas del catálogo y la CA de 002 es independiente. Sin el indicador de validación y en modo producción la preparación se rechazó. |
| T003 | APROBADA | Compose resolvió y arrancó los cinco servicios de `ayacucho-002-validacion`, con seis puertos publicados, tres volúmenes y una red propios. Caddy aceptó la CA 002, rechazó la CA 001 y devolvió 413 con `CUERPO_DEMASIADO_GRANDE` al superar 14 000 000 bytes. Garage arrancó sin un bucket inicial. |
| T004 | APROBADA | Los cuatro puntos de entrada validaron su entorno y señalaron las tareas futuras al intentar ejecutarlos. El iniciador rechazó 12 configuraciones ajenas o inconsistentes. La guía registra `--verificar-config` y los puertos dedicados. |
| T005 | APROBADA | Jest ejecutó 2 pruebas sobre PostgreSQL 18. Se rechazaron destinos 001 y externos, se repitió la carga y la limpieza y se preservó una base de otra suite. La instancia de 002 terminó con cero bases descartables y cero bases de 001. |
| T006 | APROBADA | Playwright seleccionó y ejecutó 1 prueba temporal del ejecutor 002. Se verificaron JUnit de Jest y Playwright en `tecnologia/.local/evidencia/002/fase-1/` y el rechazo de desvíos al directorio 001. La ejecución de la matriz completa de navegadores corresponde a T075. |

`lint`, `typecheck` y `build` finalizaron correctamente en backend y frontend con Node 24.15.0. Los informes generados `backend-integration-junit.xml` y `playwright-junit.xml` se conservan localmente en el directorio ignorado de evidencias de la 002. Los 35 escenarios funcionales, la regresión conjunta, el ensayo de restauración y las mediciones EQ-01 y EQ-03 siguen `PENDIENTES`.
