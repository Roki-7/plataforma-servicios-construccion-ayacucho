# Guía de validación — 002 Prestadores y catálogo

Esta guía define la validación posterior a la implementación. Los recorridos de la 002, sus pruebas de carga y los estados de aprobación están pendientes. Los comandos propuestos se identifican como tales. [Plan](plan.md) · [Modelo de datos](data-model.md) · [Especificación](spec.md) · [Contrato OpenAPI](contracts/openapi.json).

## Prerrequisitos y comprobaciones disponibles

Usar Node.js 24 LTS (desde 24.15), npm con los lockfiles del repositorio, Docker con Compose, k6 2.0 y navegadores de Playwright. La base de validación, Redis, el bucket y los datos deben pertenecer a un entorno de prueba. Usar cuentas ficticias y Mailpit. La aplicación web y la API conservan el mismo origen HTTPS y la verificación de certificados.

Desde la raíz se pueden comprobar los manifiestos y servicios existentes sin iniciar contenedores.

```powershell
node --version
npm.cmd --version
docker compose version
k6 version
docker compose -f tecnologia/compose.yaml config --no-interpolate --services
npm.cmd --prefix tecnologia/backend run
npm.cmd --prefix tecnologia/frontend run
```

El Compose actual declara PostgreSQL 18, Redis 8, Mailpit, Garage y el proxy Caddy bajo el perfil `web`. Si Node global no alcanza la versión requerida, usar el wrapper local con Node 24. En Linux, usar `npm` en los ejemplos de PowerShell. Los scripts `dev:prepare`, `test:seed` y `test:performance` existentes preparan o prueban la 001. La cuenta ficticia administrativa de referencia de ese seed carece de un permiso concedido. [Wrapper local](../../tecnologia/scripts/npm-local.ps1) · [Guía de validación 001](../001-usuarios-y-acceso/quickstart.md).

## Preparación y arranque para la 002

`dev:prepare:002` genera configuración, TLS y un catálogo ficticio en `tecnologia/.local/002/` antes de iniciar Compose. Compose inicia PostgreSQL, Redis, correo y objetos. El iniciador verifica la configuración dedicada de la 002. La fase de preparación permite llegar hasta el arranque de estos servicios y comprobar la configuración con `start:validation:002 -- --verificar-config`.

Los puntos de entrada `db:migrate:002`, `storage:init:002`, `test:seed:002` y `start:validation:002` validan el entorno. La migración, la creación del bucket privado, la carga de datos y la aplicación compuesta se habilitarán en T008, T029 y T066–T067. La concesión al operador de prueba usará el procedimiento operativo de RF39. En Windows, si Node global no cumple la versión, sustituir `npm.cmd` por `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1`.

```powershell
npm.cmd --prefix tecnologia/backend ci
npm.cmd --prefix tecnologia/frontend ci
npm.cmd --prefix tecnologia/backend run dev:prepare:002 -- --validation
docker compose -p ayacucho-002-validacion --env-file tecnologia/.local/002/compose.env -f tecnologia/compose.yaml -f tecnologia/compose.002.yaml up -d --wait postgres redis correo objetos
npm.cmd --prefix tecnologia/backend run start:validation:002 -- --verificar-config
```

Ejecutar estos tres pasos por separado cuando estén implementados.

```powershell
npm.cmd --prefix tecnologia/backend run db:migrate:002
npm.cmd --prefix tecnologia/backend run storage:init:002
npm.cmd --prefix tecnologia/backend run test:seed:002
```

Los puertos locales de la 002 son PostgreSQL `54330`, Redis `63800`, SMTP `1026`, Mailpit web `8026`, Garage `3910`, backend `3002`, Vite `5175` y HTTPS `8444`. Compose aísla la red y los volúmenes por nombre de proyecto. Para las regresiones usar el ejecutor, los puertos y la CA de la 001.

Antes del cierre por historia, el arnés de prueba instalará sus controladores reales con la validación HTTP compartida, un subconjunto explícito de las rutas del contrato y las migraciones y datos ya disponibles. Comprobar primero que responde la ruta esperada con su guard y que la semilla existe. Ejecutar entonces la suite HTTP o de integración. Los ensayos de la unión de 40 rutas esperan el arranque completo y su carga de datos.

Asignar un proyecto de Compose, base, instancia Redis, bucket, puertos HTTPS y destino de evidencias independientes cuando se ejecuten ensayos concurrentes. Si se comparte infraestructura, ejecutar en serie las suites que escriben categorías, servicios o fotos y las que detienen Redis o restauran PostgreSQL. Entre corridas, restablecer servicios y espacio Redis, reaplicar la semilla en recursos descartables y comprobar estado y recuentos esperados. El ensayo de rendimiento usa un entorno dedicado sin otras corridas que puedan variar carga o datos.

Una vez implementada la aplicación compuesta y cargados los datos, arrancar la API y la web en terminales independientes y levantar el proxy. El origen de referencia y las comprobaciones funcionales conservan TLS activo.

```powershell
npm.cmd --prefix tecnologia/backend run start:validation:002
npm.cmd --prefix tecnologia/frontend run dev:validation:002
docker compose -p ayacucho-002-validacion --env-file tecnologia/.local/002/compose.env -f tecnologia/compose.yaml -f tecnologia/compose.002.yaml --profile web up -d proxy
curl.exe --cacert tecnologia/.local/002/tls/ca.crt https://localhost:8444/api/v1/salud
curl.exe --cacert tecnologia/.local/002/tls/ca.crt "https://localhost:8444/api/v1/categorias"
curl.exe --cacert tecnologia/.local/002/tls/ca.crt "https://localhost:8444/api/v1/servicios?pagina=1&tamano=20"
```

Se espera HTTP 200, categorías vigentes y una página conforme al contrato. Validar la CA con el navegador de prueba y conservar los controles negativos de confianza. Las pruebas con sesión obtienen el token mediante el inicio de sesión real de la 001.

`dev:validation:002` fija Vite en `127.0.0.1:5175` con `--strictPort` y `--mode validation`. Es el puerto al que apunta el proxy `8444` generado por `dev:prepare:002`. El `dev` genérico escucha en `5173` y el proxy no lo alcanzaría.

### Activar la composición completa en el contenedor del backend

La imagen del backend (`tecnologia/backend/Dockerfile`) arranca por omisión la **composición base de la 001 (17 operaciones)**: su `CMD` es `node dist/src/composicion/main.js` y no se modifica. La composición completa de la 002 (40 operaciones: las 17 de la 001 y las 23 de Prestadores y Catálogo) se activa **solo de forma explícita** con la variable de entorno `COMPOSICION=oferta-002`, sobre la misma imagen y el mismo `CMD`.

| `COMPOSICION` | Resultado |
|---|---|
| Sin definir, vacía o `base` | Composición base, 17 operaciones (comportamiento de la 001). |
| `oferta-002` | Composición completa, 40 operaciones. |
| Cualquier otro valor (`completa`, `OFERTA-002`, ` base`, `true`…) | El arranque falla con «COMPOSICION no es válida». No hay composición implícita. |

```powershell
docker run --rm -e COMPOSICION=oferta-002 --env-file <archivo-de-entorno-de-produccion> -p 127.0.0.1:3000:3000 <imagen-del-backend>
```

Con `oferta-002` la composición completa exige, además de las variables que ya exige la base (`PUBLIC_ORIGIN`, `PUBLIC_URL`, `DATABASE_URL`, claves `HMAC_*` y `AEAD_*`, `SMTP_*`, `S3_*` y `CATALOGO_MANIFIESTO`), las de Redis (`REDIS_URL`, `REDIS_NAMESPACE` y, opcionalmente, `REDIS_TIMEOUT_MS`). Las migraciones de la 002 deben aplicarse antes con `db:migrate:002` (el arranque no migra). Las bases restauradas solo arrancan si su puerta de restauración está abierta. La imagen incluye los dos contratos en `contracts/`.

Esa configuración no está en `compose.yaml` ni en `compose.002.yaml`, que no definen un servicio de backend: el backend corre en el anfitrión durante la validación. Sin `COMPOSICION=oferta-002`, la interfaz web de la 002 contra un backend en contenedor hablaría con las 17 operaciones de la base, de modo que las rutas de Prestadores y Catálogo responderían 404. No usar recursos de producción para ensayar: la validación local sigue usando `start:validation:002` con la base `ayacucho_002_validacion`.

## Recorridos de aceptación

La matriz agrupa los **35 escenarios** de [spec.md](spec.md). Cada ID deberá aparecer asociado a al menos una prueba ejecutada con evidencia. El recorrido manual complementa las suites automatizadas. Las operaciones HTTP usan el prefijo `/api/v1`.

| Escenarios | Recorrido y resultado esperado |
|---|---|
| CA-PRE-01 a 03 | El titular registra y actualiza el perfil mediante `PUT /prestadores/perfil`, comprueba lo guardado con `GET` y prueba un distrito inválido. Visitante, cliente y prestador ajeno reciben el rechazo aplicable sin alterar el perfil. |
| CA-PRE-04 a 08 | Se registran trabajos con `POST /prestadores/perfil/trabajos`, se agregan imágenes con `POST` y se reemplazan o eliminan con `PUT` y `DELETE` en los subrecursos `fotografias`. Probar tipos reales JPG/PNG/WEBP, 10 MB, 4096 px por lado, diez trabajos, cuatro imágenes por trabajo y cuarenta por cuenta, tanto en el límite como al excederlo. Para CA-PRE-06, pausar un alta de prueba antes de confirmar su referencia y consultar el ID pendiente por GET público. Comprobar 404 `RECURSO_NO_DISPONIBLE`, sin bytes de imagen. Tras confirmar, comprobar 200 con WebP sin coordenadas ni otros metadatos sensibles. Un reemplazo fallido conserva la foto anterior y uno válido conserva el cupo. Eliminar invalida la lectura por el enlace anterior. |
| CA-SER-01 a 04 | Titular publica y edita un servicio, pausa o retira mediante `POST /servicios/{servicioId}/transiciones` y verifica su versión y estado en `GET /servicios/mios`. Los intentos ajenos se rechazan. Las referencias históricas siguen intactas y una categoría inactiva impide una nueva publicación. |
| CA-SER-05 a 09 | Reactivar un pausado válido, rechazar la reactivación con impedimentos vigentes y comprobar que un retirado es de solo lectura para actores autorizados. Buscar el servicio y abrir su URL directa tras la transición. Verificar la matriz de elegibilidad actual de la 002 mediante la API interna del catálogo, con datos ficticios y sin crear solicitudes. La prueba de creación y revalidación corresponde a la 003. |
| CA-BUS-01 a 08 | Consultar `GET /servicios`, `GET /prestadores`, `GET /servicios/{servicioId}` y `GET /prestadores/{prestadorId}`. Cubrir cada filtro, combinaciones, paginación estable, búsqueda vacía, proyección de campos públicos y respaldo en PostgreSQL. Comprobar los dos avisos independientes con entradas de prueba del presentador, incluidos los casos en que solo una fuente está disponible. En la aplicación 002 aparecen los dos avisos y queda ausente el filtro por calificación. Abrir un enlace conocido de contenido privado desde una sesión ajena y comprobar rechazo sin exposición de datos. |
| CA-CAT-01 a 06 | Con un permiso concedido por el procedimiento interno, crear y modificar categorías y subcategorías. Conservar la sesión activa al revocar el permiso y comprobar que la siguiente operación se rechaza. Probar alta inicial controlada, categoría inactiva, referencias históricas y auditoría con responsable, fecha, acción, recurso y motivo. |
| CA-CAT-07 a 10 | Consultar `POST /admin/categorias/{categoriaId}/previsualizaciones-desactivacion`, verificar el recuento y cancelar o intentar confirmar con información obsoleta. Confirmar con `POST /admin/categorias/{categoriaId}/desactivaciones` y reactivar con `POST /admin/categorias/{categoriaId}/activaciones`. Probar subcategorías con estado propio activo e inactivo, estados de sus servicios y la respuesta de búsquedas, perfiles y detalles con entradas previamente leídas de Redis. |

## Comprobaciones de integración y regresión

- **Permisos y auditoría (EQ-04/PR04).** Cruzar visitante, cliente, prestador titular y ajeno, operador autorizado, cuenta revocada y responsable operativo. Probar concesión con la constancia vinculada a `cuentaId`, la firma del Product Owner y un ejecutor diferente autenticado por el host. Rechazar firma inválida, aprobación vencida, usada o de otro entorno, sustitución de cuenta, autoconcesión y ejecutor ajeno a la autorización operativa. Las operaciones rechazadas tienen cero divulgaciones y mutaciones. Forzar fallo de auditoría y verificar que reviertan permiso, consumo de aprobación y auditoría. Si se revoca el permiso entre previsualizar y confirmar, la confirmación se rechaza con la misma sesión.
- **Concurrencia y recuperación.** Con transacciones y dos conexiones reales, probar dos publicaciones contra el cambio de estado de la categoría, dos confirmaciones simultáneas, dos ediciones con la misma versión y dos altas de fotos al alcanzar un límite. Repetir una mutación crítica con la misma clave de idempotencia y con contenido diferente. Comprobar resultado único y conflicto conforme al contrato. Simular una caída de Garage al reemplazar o borrar una foto. El reemplazo fallido conserva la foto anterior. La retirada lógica impide nuevas lecturas aunque la eliminación del objeto se reintente después. Verificar que los recursos de la 001 permanecen accesibles por sus rutas originales.
- **Caché.** Ejecutar una vez el respaldo básico CA-BUS-06 en HU05 con Redis vacío o caído. En HU25, precalentar consultas y verificar la invalidación tras desactivar y reactivar con Redis disponible. En el ensayo de coherencia de dos réplicas, demorar una lectura de la revisión anterior, confirmar una desactivación con Redis detenido y recuperar Redis con una entrada previa. Las lecturas posteriores al commit usan la revisión nueva. Restaurar PostgreSQL en un destino descartable y verificar el espacio de claves nuevo. Esta prueba examina coherencia y recuperación. La comparación de CPU y memoria de EQ-03 se ejecuta aparte.
- **Contrato y arquitectura.** Ejecutar la suite original de la 001 con su composición y contrato existentes. Ejecutar las pruebas propias de la 002 y las de composición conjunta que comparan el inventario efectivo con la unión de contratos y verifican las operaciones de 001 individualmente. Revisar colisiones, esquemas de errores, validación de consulta y cuerpos, autorizaciones y cabeceras. Las reglas de dependencia verifican capas, entradas públicas y ausencia de acceso directo a tablas ajenas. Se conserva PR12 como antecedente del control de arquitectura.
- **Navegador (EQ-07/PR07).** Ejecutar las pruebas de búsqueda y de gestión del titular a 360, 768 y 1366 px en Chromium, Firefox y WebKit. Repetir los recorridos principales en un celular y una computadora reales. Registrar versión, ancho y plataforma. El flujo completo de crear y seguir una solicitud pertenece a la 003 y posteriores.

Los comandos de la siguiente selección se ejecutarán cuando existan las suites propias en el entorno 002. El filtro de Jest identifica los archivos nuevos por ruta. Playwright usa configuración y evidencia propias para mantener los informes de la 001 separados.

```powershell
$evidencia002 = "tecnologia/.local/evidencia/002/" + (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $evidencia002
$env:JEST_JUNIT_OUTPUT_DIR = (Resolve-Path $evidencia002).Path
$env:E2E_EVIDENCIA = $env:JEST_JUNIT_OUTPUT_DIR
npm.cmd --prefix tecnologia/backend run lint
npm.cmd --prefix tecnologia/backend run typecheck
npm.cmd --prefix tecnologia/backend run build
npm.cmd --prefix tecnologia/frontend run lint
npm.cmd --prefix tecnologia/frontend run typecheck
npm.cmd --prefix tecnologia/frontend run build
npm.cmd --prefix tecnologia/backend run test:unit -- --testPathPatterns=prestadores-catalogo
npm.cmd --prefix tecnologia/backend run test:integration -- --runInBand --testPathPatterns=prestadores-catalogo
npm.cmd --prefix tecnologia/backend run test:contract -- --testPathPatterns=prestadores-catalogo
npm.cmd --prefix tecnologia/backend run test:architecture
npm.cmd --prefix tecnologia/frontend run test:unit -- prestadores-catalogo "--outputFile.junit=$env:JEST_JUNIT_OUTPUT_DIR/v.xml"
npm.cmd --prefix tecnologia/frontend run test:e2e -- --config=playwright.002.config.ts
```

## Rendimiento y escalabilidad

**EQ-01 / PR01.** Usar k6 con 50 usuarios virtuales constantes durante 15 minutos y pausas de 3 a 8 s entre operaciones. Preparar 1 000 prestadores y 5 000 servicios ficticios, distribuidos entre los cinco distritos, estados de servicio y clasificaciones activas e inactivas. Usar una mezcla fija, repetible y registrada de búsquedas de servicios y prestadores, detalles de servicio y perfiles. Las consultas de categorías sirven para comprobar el catálogo y su caché. Registrar por separado operaciones de calentamiento y de medición. Las 10 000 solicitudes y la comparación de cotizaciones son parte del escenario integral cuando la 003 esté disponible. Si el esquema aún no existe, la ejecución de la 002 declara expresamente esa parte pendiente. [Escenarios de calidad](../../docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md#eq-01-rendimiento-en-búsquedas-y-consultas).

Se espera **p95 ≤ 2 s** y **menos del 1 % de errores técnicos**. Registrar tiempos, errores, RPS y comprobaciones de resultados por operación y agregados. Distinguir una página vacía correcta, un 404 deliberado de una prueba negativa y un fallo técnico. Ejecutar pruebas negativas y mediciones de degradación en corridas separadas del escenario nominal. Etiquetar las operaciones en k6 con nombres estables que no incluyan identificadores ni datos personales. [Métricas HTTP de k6](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) · [Umbrales de k6](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

**EQ-03 / PR03.** Medir 15 minutos por configuración y carga con los mismos datos, binario, plan de operaciones y condiciones de calentamiento. A usa una réplica de API con R de CPU y memoria. B usa dos réplicas con R cada una, detrás del mismo punto de entrada, con una capacidad total 2R. Mantener fijos los recursos de PostgreSQL y Redis, el almacenamiento, la configuración de red, el equipo y el periodo de medición. Registrar límites globales de conexiones PostgreSQL y mantener su presupuesto comparable entre A y B. Verificar que la carga de B alcanza ambas réplicas. A 25 VU y B a 50 VU deben cumplir p95 ≤ 2 s y errores técnicos < 1 %. La corrida A a 50 VU sirve para comparar a igual carga. Si la infraestructura no permite controlar y medir los recursos, EQ-03 queda `PENDIENTE`. [Escenario de escalabilidad](../../docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md#eq-03-escalabilidad-ante-el-aumento-de-usuarios).

| Configuración | VU | Resultado que se compara |
|---|---:|---|
| A, una réplica con R | 25 | Cumplimiento de los umbrales de referencia para la carga inicial |
| A, una réplica con R | 50 | Línea de base a 50 VU para comparar con B |
| B, dos réplicas con R cada una | 50 | Cumplimiento de los umbrales con 2R y comparación con A a igual carga |

La ejecución prevista utiliza un script 002 independiente de `test:performance` de la 001. Para cada corrida, conservar el CA de validación, identificar configuración y carga en una carpeta de evidencia nueva y verificar que el destino sea el entorno autorizado de pruebas.

```powershell
$env:VALIDATION_MODE = 'true'
$env:ORIGEN_VALIDACION = 'https://localhost:8444'
$env:SSL_CERT_FILE = (Resolve-Path 'tecnologia/.local/002/tls/ca.crt').Path
k6 run --vus 50 --duration 15m --summary-export "$evidencia002/eq01-50.json" tecnologia/backend/test/performance/prestadores-catalogo.k6.js
```

En EQ-03, repetir el comando con 25/50 VU y archivo de resumen distinto tras desplegar la configuración correspondiente. El script previsto usa usuarios virtuales constantes. Registrar p95, RPS, errores técnicos, consumo de CPU y memoria por réplica, recursos y conexiones PostgreSQL y estado de Redis. Separar caché fría, caché caliente y fallo de Redis. En Windows, verificar la confianza de la CA local que utiliza k6. La ejecución conserva la validación TLS. [Usuarios virtuales constantes de k6](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/).

## Respaldo y restauración del portafolio

El siguiente ensayo se realizará en un proyecto de Compose descartable, con datos ficticios, base y bucket privados de destino y credenciales exclusivas de prueba. Los comandos propios de 002 corresponden a la implementación futura. El plan contiene el [protocolo operativo](plan.md#respaldo-coordinado-y-recuperación-del-portafolio).

1. Preparar una foto vigente saneada, una foto ya retirada y una preparación inconclusa, con evidencia de sus estados. Pausar escritores y limpiador de portafolio en todas las réplicas de prueba y verificar que finalizaron las operaciones en curso.
2. Abrir una instantánea PostgreSQL de solo lectura con aislamiento repetible y usar su identificador para el inventario y el volcado `pg_dump --snapshot`. Copiar solo los objetos saneados referenciados y verificar tamaño y SHA-256. Generar el manifiesto privado con `backupId`, versiones y corte. Marcar `COMPLETO` tras validar las dos partes. Un fallo parcial deja el manifiesto `INCOMPLETO`, con un registro de causa, y se reanudan de forma controlada los escritores y el limpiador del entorno de origen.
3. Restaurar la pareja validada en destinos nuevos con el API público y el limpiador detenidos. Aplicar `pg_restore` y reconstruir el bucket privado con los objetos verificados de ese mismo manifiesto. Cotejar claves, tamaños, MIME y hashes de todas las referencias vigentes. Reconciliar bajas aplicables y preparaciones inconclusas y dejar huérfanos fuera de la entrega. Asignar un espacio Redis nuevo.
4. Arrancar la API solo en la red del ensayo, con el tráfico público cerrado. Verificar que la foto vigente responde 200 por su API y coincide por hash, y que la foto retirada y la preparación inconclusa devuelven 404. Confirmar rechazo de acceso anónimo directo al bucket y que el limpiador puede reintentar purgas sin tocar referencias vigentes. Conservar el manifiesto privado y resultados sin credenciales ni URLs privadas en la evidencia 002.
5. Probar por separado manifiesto y volcado de conjuntos distintos, objeto ausente o alterado y restauración interrumpida. Cada fallo mantiene cerrado el tráfico público. Repetir en otro destino limpio con el conjunto válido y comprobar que se recupera de nuevo. Mantener el origen de prueba y sus datos independientes de los destinos.
6. **Operación sobre réplicas existentes.** La puerta de restauración protege el arranque de las instancias nuevas sobre la base restaurada. **No detiene automáticamente una API que ya esté en funcionamiento.** Antes de dirigir el tráfico a la base restaurada, detener o aislar todas las réplicas antiguas (las que usan la base y el espacio Redis anteriores), restaurar hasta que la puerta quede ABIERTA y arrancar solo entonces las réplicas nuevas, que adoptan el espacio Redis fijado por la restauración. Si la restauración falla, la puerta sigue CERRADA y las instancias nuevas no arrancan: el reintento se hace en un destino limpio. Una base `ayacucho_002_restauracion_*` nunca arranca sin su puerta ABIERTA: la ausencia de la puerta, un error al consultarla o una restauración parcial rechazan el arranque.

## Evidencia y estados

Guardar identificador de commit, fecha, herramientas, navegador, semilla y volumen de datos, perfil de infraestructura, configuración de caché, archivos JUnit, reportes Playwright y resúmenes k6 bajo `tecnologia/.local/evidencia/002/` o como artefactos de una CI 002 separada. Los reportes deben excluir credenciales, tokens, enlaces de acceso a objetos privados y metadatos sensibles. Relacionar cada evidencia con CA, RF, EQ y PR aplicables. Dejar marcados como pendientes los ensayos, las mediciones o los escenarios cuya infraestructura o funcionalidad aún falte. Los resultados de la 001 se conservan en su propia evidencia.

| Estado | Regla |
|---|---|
| `PENDIENTE` | Falta una ejecución válida, su configuración o su evidencia. |
| `EJECUTADA` | Existe evidencia de la corrida y está por evaluarse. |
| `APROBADA` | La evidencia demuestra el resultado esperado y todos los umbrales aplicables. |
| `FALLIDA` | La evaluación muestra que una prueba o un umbral aplicable no se cumple. |

La aceptación requiere evidencia aprobada de las verificaciones aplicables, incluidos los 35 escenarios, permisos, arquitectura, contratos, regresión, recuperación de portafolio y mediciones de la 002. Una ejecución pendiente, fallida o sin evaluar no acredita éxito. EQ-01 y EQ-03 se reportan con su alcance y sus límites. Comparar cotizaciones, enviar solicitudes y comprobar calificaciones o verificaciones reales requieren sus entregas correspondientes.
