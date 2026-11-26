# Investigación — 003 Solicitudes y cotizaciones

**Fecha** 2026-11-26 · **Entrada** [spec.md](spec.md) · **Plan** [plan.md](plan.md)

Cada decisión indica su origen, la evidencia del repositorio que la sustenta y las alternativas descartadas. «Verificado» significa que se leyó el código o el contrato vigente en `main` (`c32f2c8`). Ninguna decisión modifica D1 a D10, P1, P2, E1 ni E2.

## Parte A · Hallazgos de integración con 001 y 002

| ID | Hallazgo (verificado) | Efecto en la 003 | Tratamiento |
|---|---|---|---|
| H-01 | `crearAplicacion` (`composicion/app.module.ts`) admite **una sola** extensión (`oferta002`). `contratoDeOferta` lee un contrato fijo y exige exactamente 17 y 23 operaciones. | La 003 no puede registrarse sin tocar la composición. | R-01 |
| H-02 | `configurarApi` solo valida parámetros de consulta, `HEAD`, barra final y detalles de esquema para las operaciones del conjunto `operaciones002`. `GuardIdentidad002` depende de la marca `ruta002`, que sale de ese mismo conjunto. | Las 18 operaciones nuevas deben entrar en ese conjunto. No hace falta cambiar `configurar-api.ts`. | R-01 |
| H-03 | La validación de consultas rechaza parámetros duplicados y solo conoce `integer`, `boolean` y cadenas. No admite arreglos. | La comparación no puede usar `?id=…&id=…`. | R-14 (`ids` separado por comas) |
| H-04 | La validación del límite de imagen de `configurar-api.ts` se activa cuando `x-limite-cuerpo-bytes` es exactamente `14000000` y el cuerpo trae `contenidoBase64`. | La carga de archivos de la 003 reutiliza esa protección sin cambios. | R-09 |
| H-05 | `dependency-cruiser.cjs` nombra los módulos de la 002 en sus reglas (`prestadores`, `catalogo`, `administracion`). Un módulo nuevo queda **sin reglas**. | Hay que añadir reglas equivalentes para `solicitudes` y `cotizaciones`. | R-02 |
| H-06 | `tecnologia/scripts/validar-001-ci.sh` aísla la 002 con `--testPathIgnorePatterns prestadores-catalogo` y `--exclude "test/unit/prestadores-catalogo/**"`. Las pruebas de la 003 **no** quedarían excluidas y se ejecutarían en la CI de 001 sin su infraestructura. | Hay que ampliar los filtros de 001. Es la misma lección de los PR #3 y #4. | R-16 |
| H-07 | La limpieza física de `LimpiezaPortafolio` (002) **no está conectada** a ningún proceso ni comando: solo la instancian las pruebas. El único proceso periódico del monolito es la limpieza de temporales de la 001 (`setInterval`, 60 s). | La 003 no puede apoyarse en una operación «ya existente». Debe cablear la suya. **Es además un riesgo de la 002 que conviene registrar.** | R-10 |
| H-08 | `avisos_pendientes` tiene `tipo` restringido a tres correos de seguridad, destinatario `text` (correo) y el `worker-correo` envía **cualquier** fila con carga. | Una tabla nueva y separada. No se toca el worker. | R-05 |
| H-09 | `cargarConfiguracion002` solo admite bases `ayacucho_002_(validacion|test_*|restauracion_*)` en modo validación. | La 003 necesita su propia regla de nombres de base. | R-15 |
| H-10 | `PrestadoresApi` expone solo `perfilDeCuenta`. `ElegibilidadServicio` expone `evaluar` y `registro`. No hay API para cobertura, categorías cubiertas ni nombre público por identificador. | Lecturas nuevas, aditivas y de solo lectura. | R-04 |
| H-11 | `SaneadorSharp`, `PortafolioS3` y la limpieza viven dentro de `modulos/prestadores` con prefijo y expresiones propias. | No se pueden reutilizar sin importar internos de otro módulo. | R-09 |
| H-12 | `Idempotencia002` e `IdempotenciaPostgres` viven en `compartido/`. Su ámbito se llama `oferta002:<actor>` y la clave de operación incluye método y ruta. | Reutilizables sin cambios. Sin riesgo de colisión por la ruta. | R-08 |
| H-13 | El código de la 001 solo define `HabilitarPerfil` y no existe operación para deshabilitar un perfil. Un perfil profesional de la 002 exige el perfil prestador habilitado al crearse. | La existencia del perfil profesional equivale a «perfil habilitado» para validar un prestador destinatario. | R-04 |
| H-14 | `componerOpenApi` exige que los componentes con el mismo nombre sean **idénticos** y que los demás no colisionen. La 002 usa el prefijo `C002` salvo `IdempotencyKey`, `Origin` y `bearerAuth`, que copia sin cambios. | El contrato de la 003 usa el prefijo `C003` y copia esos tres componentes literalmente. | R-12 |
| H-15 | El código compartido ya define `DATOS_INVALIDOS` como **400** y 503 `DEPENDENCIA_NO_DISPONIBLE`, 404 `RECURSO_NO_DISPONIBLE` y 409 `VERSION_DESACTUALIZADA`. | Se reutilizan. La spec ya refleja `DATOS_INVALIDOS` 400. | R-13 |
| H-16 | HU08 habla de «especialidades y zonas» y RF14 de «servicios». | Resuelto por el Product Owner: prevalece RF14. | D1 |
| H-17 | **El runtime compuesto ya usa un solo bucket con prefijos lógicos.** `app.module.ts` crea las fotos de cuenta con `config.s3.bucket` (prefijo `usuarios/`) y `main.ts` crea el portafolio de la 002 con el mismo `config.s3.bucket` (prefijo `portafolio/`). Una versión anterior de este plan afirmaba que la 002 tenía un bucket propio separado de la 001. Era inexacto. | La 003 puede seguir la práctica vigente con el prefijo `solicitudes/`. | R-09 |
| H-18 | El permiso de almacenamiento se concede por identidad y bucket (`garage bucket allow --read --write --key … <bucket>` en `inicializar-storage-002.ts`). Garage v2.5.0, la versión fijada, no ofrece en este repositorio políticas por prefijo. | El aislamiento entre prefijos es de aplicación, igual que hoy entre `usuarios/` y `portafolio/`. | R-09 |
| H-19 | Los adaptadores existentes acotan sus claves: `PortafolioS3` valida el prefijo con una expresión y lista con `Prefix`. `FotografiasS3` usa `usuarios/`. | Los adaptadores de 001 y 002 no alcanzan objetos `solicitudes/`. Se comprobará con pruebas negativas. | R-09 |
| H-20 | Las operaciones de 002 para respaldo y restauración (`respaldo-002.ts`, `respaldar-portafolio-002.ts`) trabajan sobre el prefijo y las tablas del portafolio. | La 003 necesita su propio procedimiento coherente, sin modificar 002. | R-22 |

## Parte B · Decisiones técnicas

### R-01 · Composición con una segunda extensión

- **Decisión.** Generalizar de forma mínima la composición actual:
  - `crearAplicacion` acepta `oferta003` junto a `oferta002`. Un registro `oferta003` aporta controladores, proveedores, migraciones y la lista de `operationId`.
  - `contratoDeOferta` compone tres documentos (001, 002 y 003) y verifica los inventarios de **17, 23 y 18** operaciones. El total efectivo es **58**.
  - El conjunto `operaciones002` que recibe `configurarApi` pasa a ser la unión de las 41 operaciones de ambas extensiones. El nombre queda como está para no tocar el adaptador compartido.
  - `crearAplicacionCompleta003` equivale a `crearAplicacionCompleta002` y registra ambas extensiones.
- **Verificado.** Con un script de solo lectura se compusieron los tres documentos con `componerOpenApi` real: 17 + 23 + 18 = 58 operaciones, sin colisiones de ruta ni de `operationId`, con referencias resueltas.
- **Alternativas.** (a) Anidar la 003 dentro del registro de la 002: acopla ciclos de entrega y rompe el aislamiento de CI. (b) Rediseñar la composición como lista genérica de extensiones: más limpio, pero mayor riesgo sobre 001 y 002 sin necesidad actual. Se registra como mejora futura.
- **Riesgo.** Se modifican `app.module.ts` y `persistencia.ts`, que usan 001 y 002. Mitigación: la composición base y la de 002 conservan su comportamiento por defecto y se añaden pruebas de regresión (R-16).

### R-02 · Módulos, capas y reglas de arquitectura

- **Decisión.** Dos módulos nuevos en `tecnologia/backend/src/modulos/`:
  - `solicitudes` (Solicitudes y visitas): solicitudes, versiones, bitácora, archivos.
  - `cotizaciones` (Cotizaciones): cotizaciones, versiones, aclaraciones.

  Cada uno con `dominio/`, `aplicacion/` (con `puertos/`), `infraestructura/`, `presentacion/` y `api-publica.ts`.
- **Dependencias permitidas.**
  - `cotizaciones` → `solicitudes/api-publica` (lectura de estado y versión de trabajo, y validación de títulos de acceso).
  - `solicitudes` → **ningún** otro módulo. Obtiene lo que necesita de otros módulos mediante **puertos** en su capa de aplicación, que implementan adaptadores en `composicion/`. Así no existe ciclo.
  - Ambos → `usuarios-acceso/api-publica`, `catalogo/api-publica`, `prestadores/api-publica`, `notificaciones/api-publica`.
- **Reglas nuevas** en `dependency-cruiser.cjs` análogas a las de la 002: dominio sin otros módulos ni infraestructura, aplicación sin implementaciones, consumo solo mediante `api-publica`, `solicitudes` sin importar `cotizaciones`, y sin ciclos. Se añaden a `test/architecture/solicitudes-cotizaciones.spec.ts` (PR12).
- **Alternativa descartada.** Un único módulo: contradice la constitución I (Cotizaciones es módulo propio).

### R-03 · Coordinación entre módulos: interesados, avisos y títulos

- **Decisión.** La edición y el cierre de una solicitud necesitan conocer a los prestadores interesados, que dependen de las cotizaciones.
  - **Puerto de salida en `solicitudes`:** `PrestadoresInteresados.de(solicitudId, tx)` devuelve las cuentas de los autores de cotizaciones no retiradas.
  - **Adaptador en `composicion/`** que llama a `cotizaciones/api-publica` con el mismo contexto transaccional. `solicitudes` no consulta tablas de `cotizaciones`.
  - Los destinatarios se unen con la cuenta del destinatario de una dirigida, que `solicitudes` guarda al publicar.
  - **Puerto `AutoriaDeCotizacion.tieneNoRetirada(solicitudId, cuentaId, tx)`** resuelve el título (c) en las lecturas de solicitudes.
- **Cuentas desnormalizadas.** `cotizaciones.prestador_cuenta_id` y `solicitudes.prestador_cuenta_id` se copian al crear el registro. La relación cuenta–perfil es inmutable (cuenta única por perfil, sin operación de cambio). Así se evita un cruce con Prestadores en cada aviso.
- **Atomicidad.** El adaptador y `Notificaciones.registrar…` reciben el `ContextoTransaccion` de la operación. Un fallo revierte versión, bitácora y avisos.

### R-04 · Lecturas nuevas en 001, 002 y notificaciones (aditivas)

| Módulo | Operación nueva | Para qué | Notas |
|---|---|---|---|
| `prestadores/api-publica` | `perfilPorId(prestadorId, tx?)` → `{prestadorId, cuentaId, publicable}` | Validar y resolver un prestador destinatario | Solo lectura. Un perfil existente implica perfil habilitado (H-13). |
| `prestadores/api-publica` | `distritosDe(prestadorId, tx?)` | Compatibilidad (FR-333) y advertencia de cobertura (FR-305) | Lee `prestadores_zonas` desde su propio módulo. |
| `prestadores/api-publica` | `especialidadesDe(prestadorId, tx?)` | Advertencia de categoría fuera de especialidades (FR-305) | Solo advertencia. No concede acceso (FR-334). |
| `prestadores/api-publica` | `nombresPublicos(prestadorIds[])` | Mostrar el prestador en cotizaciones | Consulta masiva acotada a una página (50). |
| `catalogo/api-publica` | `categoriasDeOferta(prestadorId, tx?)` | Compatibilidad | Ver R-06. |
| `notificaciones/api-publica` | `AvisosNegocioApi.registrar(avisos[], tx)` | Registro atómico de avisos | Ver R-05. |

`ElegibilidadServicio.evaluar` y `registro`, y `ClasificacionesEfectivas.efectivamenteActivas`, ya existen y se usan sin cambios. Ninguna operación nueva escribe en tablas de otro módulo.

### R-05 · Registro de avisos (Outbox de negocio)

- **Decisión.** Tabla nueva `avisos_negocio` propiedad de **Notificaciones**, creada por una migración propia de ese módulo, sin tocar `avisos_pendientes` ni su worker.
  - Columnas: `id`, `cuenta_destinatario_id`, `tipo`, `solicitud_id`, `version_trabajo`, `clave_logica` (única), `estado` (solo `REGISTRADO`), `creado_en`. Solo identificadores. Sin texto libre ni datos personales, así que no requiere cifrado.
  - Idempotencia por `clave_logica = tipo:solicitudId:versión:cuentaId`, con `ON CONFLICT DO NOTHING`.
- **Tipos.** `SOLICITUD_DIRIGIDA_PUBLICADA`, `SOLICITUD_CAMBIADA`, `SOLICITUD_CERRADA` (FR-344).
- **Entrega.** Fuera de la 003. La 006 añadirá el proceso de envío, los canales y la visualización. Una columna de entrega no se crea ahora: la 006 la añade con su propia migración.
- **Alternativas descartadas.** (a) Ampliar `avisos_pendientes`: obliga a cambiar su `CHECK` y a filtrar su worker, con riesgo de enviar por correo avisos de negocio. (b) Un aviso por correo: contradice E1 y la constitución V (el envío sigue a la confirmación).
- **Volumen.** Una edición con N interesados inserta N filas en una sola sentencia.

### R-06 · Compatibilidad para oportunidades (FR-333)

- **Decisión.** Solicitudes **no hace una consulta cruzada** con tablas de Catálogo ni de Prestadores. Calcula la compatibilidad en dos pasos:
  1. Catálogo devuelve el **conjunto de categorías cubiertas** del prestador: por cada servicio PUBLICADO y elegible (clasificación propia y del padre activas), su categoría y, si es subcategoría, su categoría padre.
  2. Prestadores devuelve sus distritos.
  3. Solicitudes filtra su propia tabla con `categoria_id = ANY(conjunto) AND distrito_codigo = ANY(distritos)`.
- **Corrección de la dirección.** El conjunto reproduce la regla de la búsqueda pública de la 002 (`s.categoria_id = X OR c.categoria_padre_id = X`):
  - Solicitud de categoría A: coincide con un servicio en A o en A1, porque el conjunto contiene A.
  - Solicitud de subcategoría A1: coincide solo con un servicio en A1. Un servicio en A (padre) no aporta A1.
  - Subcategoría hermana A2 no coincide.
- **Rendimiento.** Índice parcial sobre solicitudes publicadas ABIERTAS por (`categoria_id`, `distrito_codigo`). El conjunto de un prestador es pequeño. PR01 lo mide.
- **Coherencia.** Dos lecturas en READ COMMITTED pueden diferir milisegundos de una desactivación concurrente. No hay bloqueo de la revisión de oferta en lecturas, a diferencia de las escrituras (R-07).
- **Alternativa descartada.** Un `JOIN` entre `solicitudes`, `catalogo_servicios` y `prestadores_zonas`: viola la titularidad de datos (constitución I).

### R-07 · Elegibilidad del servicio y orden de bloqueos

- **Decisión.** Reutilizar `ElegibilidadServicio.evaluar(servicioId, tx)`, que toma el bloqueo **compartido** de la revisión de Catálogo hasta el final de la transacción. Esto serializa la escritura con una desactivación de categoría o un retiro de servicio, que toman el bloqueo exclusivo.
- **Orden global** (extiende `ordenBloqueosOferta`, que termina en `'trabajo'`): idempotencia → `revision-oferta` (compartido) → `solicitud` → `cotizacion` → filas hijas (`versiones`, `archivos`, `aclaraciones`, `bitacora`) → `aviso-negocio`.
- **Cuándo se evalúa:** al guardar un borrador con servicio, al cambiar el servicio de un borrador y al publicar. No al editar una ABIERTA (FR-313).
- **Publicar.** Se lee `servicio_id` sin bloqueo, se toma la revisión y se evalúa, y después se bloquea la solicitud `FOR UPDATE` y se comprueba que el servicio no cambió. Si cambió, se reintenta una vez (R-11).
- **Lectura de cotizaciones.** Los casos que parten de una cotización (actualizar, retirar, aclarar) leen su `solicitud_id` (inmutable) sin bloqueo, bloquean la solicitud `FOR SHARE`, luego la cotización `FOR UPDATE` y revalidan.

### R-08 · Idempotencia

- **Decisión.** Reutilizar `Idempotencia002.ejecutar002` sin cambios (H-12). Cada mutación pasa `actor` (cuenta), `metodo`, `rutaLogica` con `{marcadores}`, `ids`, `version` esperada, `cuerpo` y, para la carga de archivos, el hash de la imagen en `fotografia`.
- **Verificado.** El código graba el resultado en la misma transacción del trabajo y, ante una repetición, devuelve el guardado sin ejecutar el trabajo. Una clave con otro contenido responde 409 `CLAVE_IDEMPOTENCIA_REUTILIZADA`. Un candado consultivo serializa peticiones concurrentes con la misma clave.
- **Efectos de la 003.** Una repetición no crea versión, bitácora, aviso, archivo ni cotización. Una edición idéntica con clave nueva se detecta en el dominio (comparación del estado canónico) y devuelve 200 sin efectos (FR-310).
- **Deuda menor.** El prefijo `oferta002` del ámbito es solo un rótulo. No se cambia.

### R-09 · Archivos y almacenamiento

- **Decisión (aprobada por el Product Owner el 2026-11-26).** Reutilizar el bucket privado existente (`config.s3.bucket`) con el prefijo independiente `solicitudes/`, **la misma identidad de acceso de la aplicación y ninguna variable, bucket ni principal nuevos**. Es la práctica vigente: ese bucket ya aloja `usuarios/` (001) y `portafolio/` (002).
- **Verificación del aislamiento (resultado en el repositorio).**
  1. Garage concede permisos por identidad y bucket (H-18). No existe una política por prefijo. **El aislamiento entre prefijos es, por tanto, de aplicación.** No es más débil que el actual entre `usuarios/` y `portafolio/`.
  2. Controles que lo sostienen: bucket sin acceso anónimo; un adaptador `SolicitudesS3` con una expresión de clave estricta (`solicitudes/<uuid>/<uuid>` o `pruebas/<uuid>/solicitudes/<uuid>/<uuid>`) que rechaza cualquier otra clave; listados y borrados acotados al prefijo; ningún enlace público ni firmado; **autorización por solicitud y por archivo en cada lectura**, con una política única (R-03); y los adaptadores de 001 y 002 que ya rechazan claves ajenas a su prefijo (H-19).
  3. Lo que no cubre: una identidad de aplicación comprometida accede a todos los prefijos. Hoy ocurre igual con `usuarios/` y `portafolio/`.
- **Identidad independiente: no se justifica.** Con Garage, una segunda identidad exigiría un bucket nuevo, y la separación no reduciría el riesgo del único principal de la aplicación. **Si alguna de las comprobaciones de ejecución falla, se reabre esta decisión y se justifica entonces un bucket propio.**
- **Comprobaciones de ejecución (tareas, aún pendientes).** El acceso anónimo al bucket falla. El adaptador de solicitudes rechaza claves fuera de su prefijo. Los adaptadores de 001 y 002 no leen, listan ni borran objetos `solicitudes/` (pruebas negativas). Los procedimientos de 002 siguen funcionando con objetos `solicitudes/` presentes (regresión, sin modificar 002). **La verificación sobre Garage real no está hecha.**
- **Saneador.** Un adaptador propio dentro de `solicitudes/infraestructura/archivos/`, con Sharp y los mismos límites que la 002: formato real JPG, PNG o WEBP, 10 000 000 bytes, 4 096 px por lado, recodificación a WebP sin metadatos y lado mayor de hasta 1 600 px. Se duplica en lugar de extraerlo a `compartido` para no modificar 002. Es deuda técnica registrada.
- **Flujo de carga** (compensación entre PostgreSQL y S3), en tres tiempos:
  1. **Preparación.** Se sanea fuera de la transacción. Una transacción bloquea la solicitud, descarta los archivos caducados, comprueba el cupo, inserta el archivo `PREPARANDO` y su entrada de limpieza `PREPARACION`.
  2. **Almacenamiento.** Se guarda el objeto en S3. Si falla, otra transacción marca la fila `DESCARTADO` y registra su purga, y se responde 503 sin cupo consumido.
  3. **Publicación idempotente.** `ejecutar002` bloquea la solicitud en modo compartido, pasa el archivo a `PREPARADO`, retira la entrada `PREPARACION` y graba el resultado. Si la petición era una repetición, el resultado guardado trae otro `archivoId`: se descarta el intento y se programa su purga.
- **Contadores.** Un **disparador** es el único mecanismo que mantiene `archivos_cantidad` y `archivos_bytes`. La aplicación bloquea antes la solicitud con `FOR UPDATE`. Los `CHECK` (≤ 5 y ≤ 30 000 000) rechazan el exceso y se traducen a `LIMITE_ARCHIVOS`.
- **Confirmación (FR-347).** Todo o nada dentro de la edición, la publicación o el guardado del borrador. Los PREPARADOS no incluidos siguen pendientes hasta caducar.
- **Descargas.** Siempre por la API, con `Cache-Control: no-store` y sin URL firmada.
- **Alternativas descartadas.** (a) Bucket propio con principal propio: sin ganancia real con Garage (arriba). (b) Un `CHECK` que sume filas: PostgreSQL no lo permite entre filas. (c) Mantener los contadores desde la aplicación: dos escritores del mismo invariante.

### R-10 · Limpieza física verificable (P2)

- **Hecho.** La 002 no cablea su limpieza (H-07). Se registra como **problema operativo independiente** (R-28) y no se corrige en la 003.
- **Decisión (aprobada el 2026-11-26).** Un proceso periódico dentro del monolito y dos comandos operativos, todos sobre tablas de la 003.
- **Tres tiempos distintos que no deben confundirse:**

| Plazo | Qué es | Valor inicial | Efecto |
|---|---|---|---|
| **Caducidad lógica** | Vigencia máxima de un archivo cargado y no confirmado, medida desde su carga. | 24 horas (aprobado, FR-320) | Pasada, el archivo es inaccesible, no cuenta para el cupo y no puede confirmarse. Es inmediata y no depende de ningún proceso. |
| **Intervalo del proceso** | Cada cuánto el monolito reclama y procesa entradas de limpieza vencidas. | 300 segundos, configurable con `SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS` (mínimo 60) | Determina cuándo desaparece físicamente un objeto ya inaccesible. |
| **Umbral del control** | Retraso máximo tolerado entre la hora de vencimiento de una entrada de limpieza y su procesamiento. **No es un plazo de retención ni de caducidad.** | 900 segundos (15 minutos), configurable con `SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS` | Una entrada con `proxima_ejecucion` anterior a «ahora menos el umbral» y sin procesar se informa como pendiente vencida y el control falla. |

  El umbral inicial equivale a tres intervalos del proceso: tolera dos ciclos fallidos antes de alertar. El control exige que el umbral sea al menos tres veces el intervalo configurado.
- **Entradas de limpieza.** `PURGA` vence en el momento del descarte o la eliminación (es el respaldo del borrado inmediato). `PREPARACION` vence a las 24 horas de la carga (`caduca_en`).
- **Protección de los archivos en carga.** Una entrada `PREPARACION` no se procesa antes de su vencimiento. Aun vencida, no se borra el objeto si su fila está `PREPARADO` o `CONFIRMADO`. El proceso no borra objetos sin fila: solo los informa. Purgarlos exige una orden explícita (`--confirmo-purgar-huerfanos`) y una antigüedad mayor que 24 horas más el umbral.
- **Idempotencia.** Borrar una clave ausente es éxito. La entrada se elimina solo tras el éxito del borrado. Repetir un ciclo no cambia el resultado.
- **Coordinación entre instancias.** Reclamo con `FOR UPDATE SKIP LOCKED` y arrendamiento de 120 segundos. Dos réplicas nunca toman la misma clave. Un arrendamiento vencido libera la entrada.
- **Reintentos.** Espera creciente con tope de una hora, contando `intentos`. Una falla del almacenamiento no pierde la entrada.
- **Trazabilidad.** La entrada guarda `intentos`, `ultimo_intento_en` y `ultimo_error` (código sanitizado, sin clave ni texto). Cada ciclo registra conteos agregados (purgados, reintentos, vencidos, huérfanos) sin datos personales. El comando de control los consolida.
- **Comandos.** `solicitudes:limpiar:003` ejecuta un ciclo bajo demanda. `solicitudes:verificar:003` informa entradas vencidas por encima del umbral, filas `PREPARADO` o `CONFIRMADO` sin objeto, objetos sin fila ni entrada, y contadores distintos de los recalculados. Cualquier hallazgo por encima de su umbral devuelve un código de salida distinto de cero.
- **Frecuencia operativa y responsable.** El proceso periódico es la primera línea. El responsable operativo que designe el Product Owner ejecuta `verificar` cada día laborable, antes de cada respaldo y antes de cada despliegue.
- **No se promete un borrado físico a las 24 horas.** La caducidad garantiza inaccesibilidad. El borrado físico ocurre cuando el proceso se ejecuta.
- **Riesgo residual (P2).** Retención física temporal de objetos eliminados o caducados si el monolito está detenido o el almacenamiento no responde. Son inaccesibles desde la API.

### R-11 · Concurrencia y errores controlados

- **Decisión.** Aplicar el orden global de R-07 en todos los casos de uso. Las comprobaciones de estado (`ABIERTA`) y de versión se hacen con la fila ya bloqueada. Un envío de cotización toma la solicitud `FOR SHARE`. Una edición, un cierre, una publicación y una carga de archivo, `FOR UPDATE`.
- **Unicidad de cotización.** Índice único parcial (solicitud, prestador) con `estado <> 'RETIRADA'`. Si dos envíos coinciden, el segundo recibe la violación 23505, que se traduce a `COTIZACION_EXISTENTE`.
- **Retiro y reenvío simultáneos.** El reenvío espera a que la transacción del retiro termine, porque la fila vieja se está modificando. Si el retiro se confirma, el reenvío procede. Si se revierte, el reenvío recibe `COTIZACION_EXISTENTE`.
- **Reintentos.** Interbloqueo (40P01) y fallo de serialización (40001) se reintentan de forma acotada (hasta 2 veces con espera corta y aleatoria) y, si persisten, responden 409 `CONFLICTO_CONCURRENTE`. Un ayudante `compartido/aplicacion/reintento-concurrencia.ts` lo implementa (aditivo).
- **Traducciones.** 23505 → `COTIZACION_EXISTENTE`. 23514 sobre contadores → `LIMITE_ARCHIVOS`. Tiempo de espera de bloqueo → `CONFLICTO_CONCURRENTE`.
- **Errores inesperados.** No se ocultan. El filtro global registra con un identificador de correlación y responde 503 `DEPENDENCIA_NO_DISPONIBLE` sin detalles internos (comportamiento actual verificado).

### R-12 · Contrato OpenAPI y reutilización de componentes

- **Decisión.** `specs/003-solicitudes-y-cotizaciones/contracts/openapi.json` (OpenAPI 3.1, 18 operaciones) y un espejo ejecutable `tecnologia/backend/contracts/solicitudes-cotizaciones.openapi.json` idéntico. Componentes con prefijo `C003`. `IdempotencyKey`, `Origin` y `bearerAuth` se copian literalmente.
- **Verificado.** Los nueve esquemas de entrada compilan con Ajv 2020 y los ejemplos válidos e inválidos se comportan como se esperaba.
- **Operaciones.** Las ocho que preveía `api-rest.md` más diez necesarias para los recorridos de la spec: lista y detalle de solicitudes, publicación, historial, carga y lectura de archivos, lista y detalle de cotizaciones y aclaraciones (lectura y envío). El `historial` es una sola operación con el parámetro `tipo` porque el detalle debe seguir acotado.
- **Comparación sin ruta nueva.** `GET /solicitudes/{id}/cotizaciones` admite `ids` (hasta 10, separados por coma). Con `ids` devuelve la vista de comparación, y sin `ids`, la lista paginada.
- **Localización de una dirigida cerrada sin ruta nueva.** `GET /solicitudes` admite `rol=prestador` (R-25).
- **Actualización de `api-rest.md`.** Pendiente para la implementación (lista en el plan).

### R-13 · Errores y códigos

- **Decisión.** Reutilizar los códigos existentes (`DATOS_INVALIDOS` 400, `VERSION_DESACTUALIZADA`, `CLAVE_IDEMPOTENCIA_REUTILIZADA`, `RECURSO_NO_DISPONIBLE`, `DEPENDENCIA_NO_DISPONIBLE`, `IMAGEN_FORMATO_NO_ADMITIDO`, `ARCHIVO_DEMASIADO_GRANDE`, `CATEGORIA_NO_ACTIVA`) y fijar los nuevos que la spec dejó al plan: `SERVICIO_NO_ELEGIBLE`, `SERVICIO_NO_PERTENECE_AL_PRESTADOR`, `CATEGORIA_NO_COINCIDE_CON_SERVICIO`, `PRESTADOR_NO_DISPONIBLE`, `AUTODIRECCION_NO_PERMITIDA`, `FECHA_NO_VALIDA`, `IMAGEN_DIMENSIONES_NO_ADMITIDAS`.
- **Ocultación.** Cualquier recurso sin título del solicitante responde 404 `RECURSO_NO_DISPONIBLE`, también para un prestador con título solo en las versiones que pide la bitácora.

### R-14 · Consulta de comparación

- **Decisión.** `ids` es una cadena de UUID separados por coma, validada por patrón y longitud. El caso de uso cuenta los identificadores y devuelve `LIMITE_COMPARACION` si hay más de 10. Los que no pertenecen a la solicitud se ignoran como inexistentes (404 solo si la solicitud no es del cliente).
- **Motivo.** El validador de consultas no admite parámetros repetidos ni arreglos (H-03).

### R-15 · Configuración y entornos

- **Decisión.** `configuracion-003.ts` acepta bases `ayacucho_003_(validacion|test_[a-z0-9_]+)` y, para las pruebas de regresión, las de 002. Se añade un proyecto Compose `ayacucho-003-validacion` con puertos propios, igual que 002 respecto de 001. Los comandos nuevos van en `package.json` del backend: `db:migrate:003`, `storage:init:003` (prepara el prefijo y comprueba el acceso, sin crear bucket ni identidad), `test:seed:003`, `solicitudes:limpiar:003`, `solicitudes:verificar:003`, `solicitudes:respaldar:003` y `solicitudes:restaurar:003`. Variables nuevas: solo `SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS` y `SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS`.

### R-16 · Pruebas y aislamiento de CI

- **Decisión.**
  - Directorios `test/{unit,integration,contract,architecture}/solicitudes-cotizaciones` y `test/soporte/solicitudes-cotizaciones`.
  - Workflow propio `.github/workflows/solicitudes-cotizaciones.yml` con tres trabajos: calidad, validación 003 (PostgreSQL real, contratos, arquitectura, infraestructura) y regresión de 001 y 002 sobre sus propias infraestructuras efímeras.
  - Ampliar los filtros de 001 (`validar-001-ci.sh`, flujo de 001) para excluir `solicitudes-cotizaciones`, y revisar que los filtros de 002 no los capturen.
- **Motivo.** La 003 modifica composición, Notificaciones, Prestadores y Catálogo, que usan 001 y 002.

### R-17 · Detección de datos personales

- **Decisión.** Función pura en `solicitudes/dominio/` con las reglas de la sección «Criterios verificables de datos personales» de la spec. Las expresiones regulares y las exenciones se verifican con una tabla de casos (los ejemplos de la spec) y casos adicionales de falsos positivos. Devuelve rechazos y advertencias, y no registra el texto en los logs.

### R-18 · Versionado de solicitudes

- **Decisión.** Dos contadores en la solicitud: `version` (control) y `version_trabajo`. Una tabla `solicitudes_versiones` guarda la copia inmutable de cada versión de trabajo. Una bitácora registra cada cambio. El dominio compara el estado canónico antes y después para detectar cambios relevantes y la edición idéntica.
- **Relación con ADR-012.** ADR-012 trata de acuerdos. Se registra como **decisión de diseño** en este plan y no como ADR nuevo, porque RF17 ya exige cotizaciones vinculadas a la «versión vigente» de la solicitud.

### R-19 · Estados derivados

- **Decisión.** `VENCIDA` y `PENDIENTE_REVISION` no se guardan. La cotización persiste `ACTIVA` o `RETIRADA`.
  - `VENCIDA`: `vigente_hasta <= now()` de la versión actual.
  - `PENDIENTE_REVISION`: `versión_trabajo_solicitud < version_trabajo` de la solicitud, que se obtiene por una lectura masiva de `solicitudes/api-publica` por página.
  - `solicitudCerrada` se obtiene de la misma lectura.
- **Reloj.** `clock_timestamp()` en las mutaciones y `now()` en las lecturas.
- **Fechas de calendario.** La fecha deseada se valida con `(now() AT TIME ZONE 'America/Lima')::date`.

### R-20 · Frontera con 004 y 006

- **Decisión (004).** La 003 expone solo lecturas reales en `api-publica`: `obtenerVigente(cotizacionId, versionCotizacion, tx)` con `motivosNoAceptable` y `validarClienteYDisponibilidad(solicitudId, actorCuentaId, tx)`. No hay adaptadores simulados ni rutas de selección. Los estados SELECCIONADA, NO_SELECCIONADA, CONTRATADA y COMPLETADA y sus operaciones los añadirá la 004 con sus propias migraciones.
- **Decisión (006).** La 003 solo registra avisos (R-05).
- **Contratos futuros que se dejan escritos**, sin implementación: lo que la 004 debe añadir a `solicitudes/api-publica` (`registrarContratacion`, retiro de la selección pendiente al editar) y a `cotizaciones/api-publica` (`marcarSeleccionada`, `marcarNoSeleccionadas`, la guarda de retiro de una seleccionada). Están en el apartado «Contratos futuros» del plan.

### R-21 · Frontend

- **Decisión.** `tecnologia/frontend/src/features/solicitudes-cotizaciones/{modelos,aplicacion,infraestructura,presentacion}`, con rutas `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/:id`, `/oportunidades`, `/cotizaciones` y `/cotizaciones/:id`, integradas por una composición análoga a `composicion/prestadores-catalogo.ts`. Lenguaje: nunca «notificado», «avisado» ni «enviado» sobre avisos. Los textos de advertencia no prometen protección.
- **Pruebas.** Unitarias con Vitest, E2E con Playwright en tres navegadores y tres anchos (PR07), y el protocolo de observación de PR06 con cinco participantes.

### R-22 · Respaldo y restauración coherentes de PostgreSQL y objetos

- **Hecho.** El procedimiento coordinado de la 002 opera sobre el prefijo y las tablas del portafolio (H-20). No cubre `solicitudes/`.
- **Decisión (aprobada el 2026-11-26).** Incluir en la 003 un procedimiento propio, con criterios verificables, que reutiliza el **diseño** de la 002 sin modificar su código. Archivos nuevos bajo el módulo y en `scripts/`.
- **Procedimiento.**
  1. **Corte.** Asignar un `backupId`, pausar las escrituras de archivos y la limpieza (bloqueo `SHARE` sobre `solicitudes_archivos` y `solicitudes_objetos_pendientes`, que detiene a todas las réplicas), esperar las operaciones en curso y exportar una instantánea coherente de la base. Si el drenaje no se confirma, abortar.
  2. **Conjunto compatible.** Manifiesto privado con `backupId`, corte UTC, versión mayor de PostgreSQL, migraciones aplicadas, SHA-256 del volcado y un inventario de cada clave, tamaño, MIME y SHA-256 de los objetos de los archivos `PREPARADO` y `CONFIRMADO`. Se declara `COMPLETO` solo tras cotejar ambos lados.
  3. **Protección.** Artefactos cifrados en tránsito y en reposo, permisos separados de lectura y restauración, sin tokens, credenciales ni claves de objetos en los registros.
  4. **Restauración.** Una base nueva y un prefijo nuevo (`pruebas/<uuid>/solicitudes/` o un bucket distinto), con tráfico y limpieza detenidos. Se reconcilian las referencias: una fila sin objeto no se publica, un objeto sin fila queda en cuarentena, y los `PREPARANDO` inconclusos se descartan. Se validan los accesos por la política de fotografías.
  5. **Ensayo.** Solo con infraestructura descartable y datos ficticios, con inyección de fallos: pareja incorrecta, objeto ausente o alterado, restauración interrumpida y destino no vacío.
- **Criterios verificables (OP).**

| ID | Criterio |
|---|---|
| OP-301 | El manifiesto solo se declara `COMPLETO` si cada archivo `PREPARADO` o `CONFIRMADO` tiene su objeto con el mismo tamaño y SHA-256. |
| OP-302 | La restauración en destino limpio recupera solicitudes, versiones, bitácora, cotizaciones, aclaraciones y avisos registrados, y los archivos confirmados accesibles según la política. |
| OP-303 | Una pareja inconsistente, un objeto ausente o alterado, un destino no vacío o una restauración interrumpida se rechazan sin abrir tráfico. |
| OP-304 | Durante el corte, las escrituras de archivos y la limpieza quedan pausadas y se reanudan después. |
| OP-305 | La limpieza es idempotente, segura con varias instancias, con reintentos, trazable y no toca archivos en carga (R-10). |
| OP-306 | `verificar` informa los cuatro hallazgos con sus umbrales y código de salida. |
| OP-307 | **Requisito previo al uso con datos reales:** OP-301 a OP-304 ejecutados y aprobados con evidencia. Hasta entonces su estado es PENDIENTE y no se declara probado. |

- **Estado.** Nada de esto se ha ejecutado. Las tareas lo implementan y lo ensayan. La 003 puede cerrarse con OP-307 en PENDIENTE solo si se declara que no se usa con datos reales.

### R-23 · Sin Redis

- **Decisión.** La 003 no usa Redis. Sus consultas son personalizadas por cuenta y cambian con cada escritura. La constitución X limita Redis a categorías y búsquedas frecuentes. PostgreSQL es la fuente de verdad. Se medirá con PR01 y se reconsiderará solo con evidencia.

### R-24 · Límites numéricos y su justificación

| Límite | Valor | Justificación |
|---|---|---|
| Descripción de la solicitud | 2 000 caracteres | Igual que la descripción de un servicio de la 002 (`varchar(2000)`). Aprobado en D10. |
| Medidas | 500 caracteres | Aprobado en D10. |
| Alcance, exclusiones, materiales y mano de obra | 2 000 caracteres | Misma longitud que una descripción de servicio. Parámetro de diseño ajustable. |
| Forma de cálculo y condiciones de pago | 1 000 caracteres | Textos breves, igual que un mensaje de aclaración. Parámetro de diseño ajustable. |
| Mensaje de aclaración | 1 000 caracteres y 20 por hilo | Aprobado en D8. |
| Comparación | 10 cotizaciones | Aprobado en D8. |
| Archivos | 5 imágenes, 10 000 000 bytes y 30 000 000 bytes | Aprobado en D6. Los 10 000 000 bytes son la medida de la 002. |
| Caducidad lógica | 24 horas | Aprobado en FR-320. |
| Tamaño de página | 50 como máximo | Igual que la 002 (`C002Tamano`). |
| **Precio** | **Sin máximo de negocio** | La columna es un entero de 64 bits en céntimos. El contrato solo impone 2^53 − 1 (9 007 199 254 740 991), el mayor entero que JSON representa sin pérdida, que es un límite técnico y no comercial. Debe ser mayor que cero cuando se informa. |
| **Plazo** | **Sin máximo de negocio** | Entero de 32 bits como límite técnico. Mayor que cero cuando se informa. |
| Versiones de una cotización | Sin máximo | La actividad de un prestador sobre una cotización es acotada por naturaleza. Se mide en PR01. |
| Parámetro `ids` | 4 096 caracteres | Límite técnico de la línea de petición. Más de 10 identificadores devuelve `LIMITE_COMPARACION`. |
| Proceso de limpieza | 300 s de intervalo, 120 s de arrendamiento, lote de 50, 900 s de umbral | Valores iniciales **configurables** (R-10). El umbral es al menos tres intervalos. |
| Objetivos de PR01 | p95 ≤ 2 s y menos del 1 % de errores técnicos | EQ-01, con el mismo perfil que la 002: 50 usuarios virtuales, 15 minutos y pausas de 3 a 8 s. El volumen de datos de carga es una propuesta documentada. |

### R-25 · Localizar una dirigida cerrada sin haber cotizado

- **Necesidad (aprobada).** Las oportunidades listan solo solicitudes ABIERTAS. El destinatario de una dirigida CERRADA debe poder encontrarla y consultarla aunque no haya cotizado (FR-324 título a, FR-332, CA-PRI-07).
- **Decisión.** Reutilizar `GET /solicitudes`, que ya lista las solicitudes propias del cliente. Un parámetro opcional `rol` (`cliente`, por defecto, o `prestador`) cambia la perspectiva. Con `rol=prestador` devuelve, en cualquier estado salvo borrador, las solicitudes dirigidas al prestador y aquellas donde tiene una cotización no retirada, con el campo `titulos`. No añade ruta ni recurso.
- **Autorización.** `rol=prestador` exige un perfil prestador habilitado. En otro caso, 403 `SIN_PERMISO`. El resumen no incluye datos del cliente.
- **Diseño.** Una consulta sobre la tabla propia: `tipo = 'DIRIGIDA' AND prestador_cuenta_id = $cuenta AND estado <> 'BORRADOR'` o `id = ANY($ids)`, con `$ids` leído de `cotizaciones/api-publica` mediante un puerto. Se pagina con ventana de conteo. Índice parcial por `prestador_cuenta_id`.
- **Acotación.** El conjunto `$ids` está limitado por las cotizaciones no retiradas del prestador. Se mide en PR01 y, si crece, se sustituye por paginación por clave.
- **Relación con la spec.** Cumple FR-332 («las dirigidas a él») sin modificar el texto aprobado. Los criterios son `CP-301` y `CP-302` del plan.

### R-26 · Consultas repetitivas y rendimiento de oportunidades

- **Presupuesto de consultas por petición** (verificable con un contador de sentencias):
  - **Oportunidades:** la identidad, las categorías cubiertas del prestador (1), sus distritos (1) y una sola sentencia de página con total por ventana (1).
  - **Mis solicitudes con `rol=prestador`:** identificadores de autoría (1) y una página con total por ventana (1).
  - **Listados de cotizaciones:** la página (1), una lectura masiva del estado y la versión de trabajo de las solicitudes (1) y una lectura masiva de nombres públicos (1).
  - Ninguna consulta se repite por elemento de la página.
- **Pruebas.** El número de sentencias es constante e independiente del tamaño de página (`CP-306`). Permisos y paginación determinista con total coherente (`CP-303`, `CP-304`). `EXPLAIN` sobre el volumen de carga para confirmar el uso de los índices parciales (informativo).
- **Rendimiento.** PR01 con k6 sobre oportunidades, mis solicitudes, listado y comparación. La CI no ejecuta k6: la evidencia es local o del entorno de demostración y así se declara.

### R-27 · Validación de las 58 operaciones con el ensamblador definitivo

- **Verificado hasta ahora (no es la validación definitiva).** Con `componerOpenApi` del repositorio, ejecutado en un script de solo lectura, se compusieron los tres documentos: 17 + 23 + 18 = 58, sin colisiones y con referencias resueltas. Eso ejercita el ensamblador de documentos, pero **no** el arranque real.
- **Validación definitiva (tarea).** Arrancar `crearAplicacionCompleta003` y comprobar: el inventario de 17, 23 y 18 operaciones de `contratoDeOferta`; que `configurarApi` construye la tabla de rutas con las 58; que `verificarRouter` iguala el router de Nest con la unión de las 58 y no detecta una ruta parametrizada que oculte una literal; que no hay colisión de método y ruta ni de `operationId`; y la igualdad del espejo con la fuente. Además, que el arranque base (17) y el de la 002 (40) no cambian.

### R-28 · Problemas operativos independientes y documentación

- **Problema operativo independiente (002).** La limpieza física del portafolio no está conectada a ningún proceso ni comando. Se registrará como riesgo operativo en la matriz de riesgos del proyecto (`docs/05-gestion/05-riesgos.md`) para decisión del Product Owner. **No se corrige la limpieza de la 002** ni se modifica su comportamiento como parte de la 003, salvo dependencia indispensable y con autorización posterior. Los únicos cambios en sus módulos son las lecturas aditivas autorizadas (R-04).
- **Corrección documental acotada.** En `docs/trazabilidad.md`, la fila de HU10 cita PR11 (transiciones de la contratación, de la 004 y la 005). Se sustituye por las pruebas de la 003 que verifican la integridad de cotizaciones. No reabre la 002 ni toca código.

## Parte C · Alternativas generales descartadas

| Alternativa | Motivo |
|---|---|
| Persistir `VENCIDA` y `PENDIENTE_REVISION` con un proceso programado | Escrituras en cascada entre módulos y una pieza más que operar. Los derivados evitan ambas. |
| Estados de selección en el esquema de la 003 | Producirían estados inalcanzables y obligarían a simular operaciones. |
| Un servicio de colas para los avisos | Prohibido por la constitución XII sin ADR. |
| Reutilizar `avisos_pendientes` | H-08. |
| Extraer el saneador a `compartido` | Modificaría 002. Se difiere. |
| Rutas de comparación y de bitácora separadas | La comparación se resuelve con `ids` y la bitácora comparte la operación de historial. |
