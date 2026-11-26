# Modelo de datos — 003 Solicitudes y cotizaciones

**Fecha** 2026-11-26 · **Entrada** [spec.md](spec.md), [research.md](research.md) · **Contrato** [contracts/openapi.json](contracts/openapi.json)

Describe tablas, restricciones e invariantes. No contiene migraciones ejecutables: esas se escriben en la implementación, con sufijos de orden posteriores a `1795000000009`.

## 1. Propiedad de los datos

| Módulo | Tablas propias | Otras tablas que lee | Cómo las lee |
|---|---|---|---|
| Solicitudes | `solicitudes`, `solicitudes_versiones`, `solicitudes_bitacora`, `solicitudes_archivos`, `solicitudes_objetos_pendientes` | Ninguna | Puertos y APIs públicas de otros módulos |
| Cotizaciones | `cotizaciones`, `cotizaciones_versiones`, `cotizaciones_aclaraciones` | Ninguna | `solicitudes/api-publica` |
| Notificaciones | `avisos_negocio` (nueva) y las existentes | — | — |

No hay claves foráneas entre tablas de módulos distintos. Los identificadores externos (`categoria_id`, `servicio_id`, `prestador_id`, cuentas, `solicitud_id` en cotizaciones) se validan al escribir mediante las APIs internas y quedan como identificadores sin restricción referencial. Ninguna fila de solicitudes ni de cotizaciones se elimina: un disparador impide el `DELETE`.

## 2. Solicitudes

### 2.1 `solicitudes`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK. UUID público. |
| `cliente_cuenta_id` | uuid | NOT NULL. Dueño. Nunca se expone. |
| `tipo` | texto | `DIRIGIDA` o `PUBLICADA`. |
| `estado` | texto | `BORRADOR`, `ABIERTA` o `CERRADA`. |
| `prestador_id` | uuid | Nulo en `PUBLICADA`. En `DIRIGIDA` puede faltar solo en `BORRADOR`. |
| `prestador_cuenta_id` | uuid | Copia de la cuenta del prestador al fijarlo. Inmutable. Para avisos y títulos. |
| `servicio_id` | uuid | Opcional, solo con `DIRIGIDA`. |
| `servicio_titulo`, `servicio_categoria_id` | texto, uuid | Copia del servicio al guardarlo. Se conserva si el servicio se retira. |
| `descripcion` | varchar(2000) | Nulo solo en `BORRADOR`. |
| `medidas` | varchar(500) | Opcional. |
| `categoria_id` | uuid | Nulo solo en `BORRADOR`. Con servicio, igual a `servicio_categoria_id`. |
| `distrito_codigo` | texto | Uno de los cinco códigos canónicos. Nulo solo en `BORRADOR`. |
| `fecha_desde`, `fecha_hasta` | date | `fecha_hasta >= fecha_desde`. Fechas de calendario en America/Lima. |
| `compartir_fotografias` | boolean | Por defecto `false`. Solo relevante en `PUBLICADA`. |
| `version` | integer | Versión de control. Empieza en 1. Sube con **cualquier** cambio. |
| `version_trabajo` | integer | 0 mientras no se publique. 1 desde la primera publicación. Solo sube con cambios relevantes. |
| `archivos_cantidad`, `archivos_bytes` | smallint, bigint | Contadores mantenidos **solo por el disparador** de `solicitudes_archivos`. |
| `creada_en`, `actualizada_en`, `publicada_en`, `cerrada_en` | timestamptz | UTC. |

**Restricciones (segunda barrera, además de la aplicación):**
- Los dominios cerrados de `tipo`, `estado` y `distrito_codigo`.
- `PUBLICADA` implica `prestador_id` y `servicio_id` nulos. `DIRIGIDA` no `BORRADOR` implica `prestador_id` y `prestador_cuenta_id` no nulos.
- Si `estado` no es `BORRADOR` y `publicada_en` no es nulo, entonces `descripcion`, `categoria_id`, `distrito_codigo` y `fecha_desde` son no nulos.
- `(publicada_en IS NOT NULL) = (version_trabajo >= 1)`.
- `archivos_cantidad` entre 0 y 5. `archivos_bytes` entre 0 y 30 000 000.
- `servicio_id` no nulo implica copia de servicio completa y `categoria_id = servicio_categoria_id`.

**Disparadores:**
1. **Inmutabilidad tras publicar.** Si `publicada_en` no es nulo, rechaza el cambio de `tipo`, `prestador_id`, `prestador_cuenta_id`, `servicio_id` y de las copias del servicio. La aplicación responde `CAMPO_NO_MODIFICABLE`. El disparador es la última defensa.
2. **Terminalidad.** Una solicitud `CERRADA` rechaza cualquier actualización, salvo los contadores de archivos que mantiene el disparador de `solicitudes_archivos` (por ejemplo, al purgar un archivo caducado). Al cerrar, la misma transacción descarta los archivos `PREPARANDO` y `PREPARADO` no confirmados y registra su purga. Los `CONFIRMADO` se conservan para el historial y la lectura autorizada.
3. **Sin borrado.** Rechaza el `DELETE`.

**Índices:**
- `(cliente_cuenta_id, estado, actualizada_en DESC, id)` para «mis solicitudes».
- Parcial `(categoria_id, distrito_codigo, publicada_en DESC, id) WHERE tipo = 'PUBLICADA' AND estado = 'ABIERTA'` para oportunidades.
- Parcial `(prestador_id, publicada_en DESC, id) WHERE tipo = 'DIRIGIDA' AND estado = 'ABIERTA'` para las dirigidas de las oportunidades.
- Parcial `(prestador_cuenta_id, actualizada_en DESC, id) WHERE tipo = 'DIRIGIDA' AND estado <> 'BORRADOR'` para localizar las dirigidas del prestador en cualquier estado (`GET /solicitudes?rol=prestador`, research R-25).

### 2.2 `solicitudes_versiones` (versiones de trabajo)

| Columna | Tipo | Reglas |
|---|---|---|
| `solicitud_id`, `numero` | uuid, integer | PK compuesta. `numero` desde 1, consecutivo. |
| `descripcion`, `medidas`, `categoria_id`, `distrito_codigo`, `fecha_desde`, `fecha_hasta` | | Copia del contenido relevante. |
| `archivos` | jsonb | Lista de `{archivoId, tipoMime, bytes, ancho, alto, sha256}`. Solo metadatos. |
| `creada_en`, `creada_por_cuenta_id` | | |

Inmutable: un disparador rechaza `UPDATE` y `DELETE`. El texto anterior se conserva aunque se haya corregido (riesgo residual declarado en la spec). «Archivo retirado» se calcula al leer, cruzando `archivos` con el estado actual de `solicitudes_archivos`.

### 2.3 `solicitudes_bitacora`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK. |
| `solicitud_id` | uuid | |
| `ocurrida_en` | timestamptz | UTC. |
| `actor_cuenta_id` | uuid | |
| `tipo` | texto | `CREADA`, `BORRADOR_EDITADO`, `PUBLICADA`, `EDITADA`, `PRIVACIDAD_CAMBIADA`, `CERRADA`. |
| `version`, `version_trabajo` | integer | Valores tras el cambio. |
| `campos_cambiados` | texto[] | Nombres de campo, sin valores. |

Inmutable. Solo el cliente dueño la consulta. Índice `(solicitud_id, ocurrida_en, id)`.

### 2.4 `solicitudes_archivos`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK. |
| `solicitud_id` | uuid | |
| `estado` | texto | `PREPARANDO`, `PREPARADO`, `CONFIRMADO`, `DESCARTADO`, `ELIMINADO`. |
| `objeto_clave` | texto | Única. Forma `solicitudes/<solicitudId>/<archivoId>` en el bucket privado existente, con la variante `pruebas/<uuid>/solicitudes/…` para pruebas. Un `CHECK` impone la forma. Sin bucket ni identidad nuevos (research R-09). |
| `mime`, `bytes`, `ancho`, `alto`, `checksum` | | WebP saneado, bytes > 0, lado ≤ 1 600, SHA-256 de 32 bytes. |
| `creado_en`, `caduca_en`, `confirmado_en`, `retirado_en` | timestamptz | `caduca_en = creado_en + 24 h` para los no confirmados. |

**Cuentan para el cupo:** `PREPARANDO`, `PREPARADO` y `CONFIRMADO`. `DESCARTADO` y `ELIMINADO` no cuentan.

**Disparador de contadores.** Tras `INSERT`, tras un `UPDATE` que cambie `estado` o `bytes`, y tras `DELETE`, recalcula **incrementalmente** `archivos_cantidad` y `archivos_bytes` de la solicitud: suma al entrar en un estado que cuenta y resta al salir. Es el **único** escritor de esos contadores. Los `CHECK` de la solicitud rechazan el exceso (23514).

**Índices:** `(solicitud_id, estado, id)`, y parcial `(caduca_en) WHERE estado IN ('PREPARANDO','PREPARADO')` para el barrido de caducidad.

**Transiciones:**

```text
PREPARANDO ──(objeto guardado, transacción idempotente)──▶ PREPARADO ──(confirmar con archivosIds)──▶ CONFIRMADO
PREPARANDO / PREPARADO ──(fallo del guardado, o caducidad de 24 h, o intento duplicado)──▶ DESCARTADO
CONFIRMADO ──(ausente de la lista final)──▶ ELIMINADO
```

Un archivo `DESCARTADO` o `ELIMINADO` es inaccesible y tiene su purga registrada.

### 2.5 `solicitudes_objetos_pendientes`

| Columna | Reglas |
|---|---|
| `clave` | PK (la clave del objeto). |
| `tipo` | `PREPARACION` o `PURGA`. |
| `solicitud_id` | uuid. |
| `proxima_ejecucion` | timestamptz. Hora de vencimiento de la entrada. `PURGA`: el momento del descarte o la eliminación (respaldo del borrado inmediato). `PREPARACION`: `caduca_en` del archivo, 24 horas tras la carga. |
| `arrendado_hasta` | timestamptz. Arrendamiento de 120 s con `FOR UPDATE SKIP LOCKED`. Un arrendamiento vencido libera la entrada. |
| `intentos`, `ultimo_intento_en` | contador y fecha del último intento. |
| `ultimo_error` | Código sanitizado (sin clave ni texto). |
| `creado_en` | timestamptz. |

Se inserta **en la misma transacción** que crea la fila `PREPARANDO` (`PREPARACION`) o que marca `ELIMINADO` o `DESCARTADO` (`PURGA`). Índice por `proxima_ejecucion`.

**Semántica de los plazos.** La **caducidad lógica** (24 h) pertenece al archivo y es inmediata. La entrada de limpieza solo gobierna el borrado **físico**. El **umbral de control** (900 s, configurable) es el retraso máximo tolerado entre `proxima_ejecucion` y su procesamiento. No es un plazo de retención. Una entrada `PREPARACION` no se procesa antes de su vencimiento ni se borra el objeto si su fila está `PREPARADO` o `CONFIRMADO`.

## 3. Cotizaciones

### 3.1 `cotizaciones` (identidad)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK. |
| `solicitud_id` | uuid | Inmutable. Sin FK. |
| `prestador_id` | uuid | Inmutable. |
| `prestador_cuenta_id` | uuid | Copia. Inmutable. |
| `estado` | texto | `ACTIVA` o `RETIRADA`. La 004 ampliará el dominio con los estados de selección. |
| `version` | integer | Control de la identidad. Sube con cada actualización o retiro. |
| `version_actual` | integer | Número de la versión vigente en `cotizaciones_versiones`. |
| `creada_en`, `retirada_en` | timestamptz | `(estado = 'RETIRADA') = (retirada_en IS NOT NULL)`. |

**Unicidad:** índice único parcial `(solicitud_id, prestador_id) WHERE estado <> 'RETIRADA'`. Una `ACTIVA` (incluso vencida o pendiente de revisión) ocupa la posición. Al ampliar el dominio, cualquier estado distinto de `RETIRADA` también la ocupa. Un nuevo envío tras un retiro es otra fila con otro `id`.

**Disparadores:** `RETIRADA` es terminal (rechaza cualquier cambio posterior) y no se permite `DELETE`.

**Índices:** `(prestador_id, creada_en DESC, id)` para «mis cotizaciones», `(solicitud_id, estado, creada_en, id)` para el listado del cliente y el parcial `(prestador_cuenta_id, solicitud_id) WHERE estado <> 'RETIRADA'` para obtener los identificadores de autoría (`rol=prestador`, título (c)).

### 3.2 `cotizaciones_versiones`

| Columna | Tipo | Reglas |
|---|---|---|
| `cotizacion_id`, `numero` | uuid, integer | PK compuesta. |
| `version_trabajo_solicitud` | integer | Versión de trabajo revisada. ≥ 1. |
| `tipo` | texto | `ESTIMADA` o `DEFINITIVA`. |
| `alcance` | varchar(2000) | NOT NULL. |
| `exclusiones`, `materiales`, `mano_de_obra` | varchar(2000) | Opcionales. |
| `precio_centimos` | bigint | Opcional. Mayor que 0. **Sin máximo de negocio**: el contrato impone solo 2^53 − 1 (9 007 199 254 740 991), el mayor entero exacto de JSON (research R-24). |
| `forma_calculo` | varchar(1000) | Opcional. |
| `plazo_dias` | integer | Opcional. Mayor que 0. Sin máximo de negocio (límite técnico de 32 bits). |
| `vigente_hasta` | timestamptz | NOT NULL, UTC. |
| `condiciones_pago` | varchar(1000) | Opcional. |
| `creada_en` | timestamptz | |

**Restricciones por tipo:**
- `ESTIMADA`: `precio_centimos` o `forma_calculo` no nulo.
- `DEFINITIVA`: `precio_centimos`, `plazo_dias` y `condiciones_pago` no nulos.

Inmutable. Una versión es «reemplazada» cuando existe otra con `numero` mayor. Un campo nulo se muestra como «No indicado».

### 3.3 `cotizaciones_aclaraciones`

| Columna | Reglas |
|---|---|
| `id` | uuid, PK. |
| `cotizacion_id` | uuid. |
| `numero` | smallint. `CHECK numero BETWEEN 1 AND 20` y `UNIQUE (cotizacion_id, numero)`. Se asigna bajo el bloqueo de la cotización como el siguiente número. |
| `autor_cuenta_id`, `autor_rol` | `CLIENTE` o `PRESTADOR`. |
| `texto` | varchar(1000), no vacío. |
| `version_cotizacion` | integer. Versión vigente al escribir. |
| `creada_en` | timestamptz. |

Inmutable. El hilo pertenece a la **identidad** de la cotización, no a una versión. Un nuevo envío tras un retiro crea otra identidad con hilo vacío. El límite de 20 queda garantizado por el `CHECK` y la unicidad aun si la aplicación fallara.

## 4. Notificaciones

### 4.1 `avisos_negocio`

| Columna | Reglas |
|---|---|
| `id` | uuid, PK. |
| `cuenta_destinatario_id` | uuid. |
| `tipo` | `SOLICITUD_DIRIGIDA_PUBLICADA`, `SOLICITUD_CAMBIADA` o `SOLICITUD_CERRADA`. |
| `solicitud_id` | uuid. |
| `version_trabajo` | integer. Nulo para el cierre. |
| `clave_logica` | texto único: `tipo:solicitudId:versión:cuentaId`. |
| `estado` | texto, solo `REGISTRADO`. |
| `creado_en` | timestamptz. |

Solo identificadores. Sin texto libre, correo ni datos personales. Inserción con `ON CONFLICT (clave_logica) DO NOTHING`. Índices `(cuenta_destinatario_id, creado_en, id)` y `(estado, creado_en)` para la 006. **La entrega, visualización y lectura son de la 006.**

## 5. Reglas derivadas (no se persisten)

| Regla | Cálculo |
|---|---|
| `vencida` | `vigente_hasta` de la versión actual `<= now()`. |
| `requiereRevision` | `version_trabajo_solicitud` de la versión actual `< solicitudes.version_trabajo`. Se obtiene por lectura masiva de `solicitudes/api-publica` para la página. |
| `solicitudCerrada` | `solicitudes.estado = 'CERRADA'`, de la misma lectura. |
| Estado efectivo | Prioridad `RETIRADA`, `VENCIDA`, `PENDIENTE_REVISION`, `VIGENTE`. |
| `motivosNoAceptable` | Subconjunto de `RETIRADA`, `VENCIDA`, `PENDIENTE_REVISION`, `SOLICITUD_CERRADA`. Vacío no significa «aceptable»: la aceptación es de la 004. |
| Títulos de acceso | (a) destinatario de una dirigida, (b) compatibilidad con una publicada ABIERTA, (c) autor de una cotización no retirada. |
| Compatibilidad | `categoria_id` de la solicitud pertenece al conjunto de categorías cubiertas del prestador y su distrito está en sus zonas. Ver research R-06. |

## 6. Transiciones de la solicitud

```text
BORRADOR ──publicar──▶ ABIERTA ──cerrar──▶ CERRADA
BORRADOR ──cerrar (descartar)──▶ CERRADA
```

| Transición | `version` | `version_trabajo` | Bitácora | Avisos |
|---|---|---|---|---|
| Guardar o editar un borrador | +1 al editar | 0 | `CREADA` o `BORRADOR_EDITADO` | No |
| Publicar por primera vez | +1 | 0 → 1 (crea la versión 1) | `PUBLICADA` | Solo una dirigida: uno al destinatario |
| Editar una ABIERTA con cambios relevantes | +1 | +1 (copia inmutable) | `EDITADA` | Uno por interesado |
| Cambiar solo `compartir_fotografias` | +1 | sin cambio | `PRIVACIDAD_CAMBIADA` | No |
| Edición idéntica al estado vigente | sin cambio | sin cambio | No | No |
| Cerrar una ABIERTA | +1 | sin cambio | `CERRADA` | Uno por interesado |
| Descartar un borrador | +1 | 0 | `CERRADA` | No |

## 7. Invariantes y su verificación

| Invariante | Mecanismo | Escenarios |
|---|---|---|
| A lo sumo una cotización no retirada por (solicitud, prestador) | Índice único parcial | CA-COT-01, CA-CON-04 |
| ≤ 5 archivos y ≤ 30 000 000 bytes por solicitud, aun con cargas simultáneas | `CHECK` de contadores mantenidos por un disparador, bajo `FOR UPDATE` de la solicitud | CA-ARC-01 |
| Campos inmutables tras publicar | Disparador y comprobación de aplicación | CA-SOL-09 |
| Versiones y bitácora inmutables | Disparadores | CA-HIS-01 a 03 |
| Máximo de 20 aclaraciones | `CHECK` y unicidad de `numero` | CA-ACL-02 |
| Aviso atómico e idempotente | Misma transacción y `clave_logica` única | CA-AVI-02, CA-AVI-04 |
| La 003 no produce estados de la 004 | Dominios cerrados de `estado` | CA-FRO-01 |
| Sin borrado de solicitudes ni cotizaciones | Disparadores | CA-CIE-01 |

## 8. Respaldo y restauración: qué se incluye

| Elemento | Tratamiento |
|---|---|
| Base de datos | El volcado de la base incluye todas las tablas. El corte pausa las escrituras de archivos y la limpieza con un bloqueo compartido de `solicitudes_archivos` y `solicitudes_objetos_pendientes`. |
| Objetos | Los de las filas `PREPARADO` y `CONFIRMADO` bajo el prefijo `solicitudes/`, con tamaño, MIME y SHA-256 en el manifiesto. Los `DESCARTADO` y `ELIMINADO` no se inventarían. |
| Restauración | Destino limpio (base nueva y prefijo nuevo). Una fila sin objeto no se publica, un objeto sin fila queda en cuarentena y los `PREPARANDO` inconclusos se descartan. |
| Criterios | OP-301 a OP-307 de research R-22. OP-307: requisito previo al uso con datos reales. |

## 9. Migraciones previstas (orden aditivo, sin ejecutarlas)

| Orden | Contenido | Módulo |
|---|---|---|
| `1796000000001` | `solicitudes`, `solicitudes_versiones`, `solicitudes_bitacora`, `solicitudes_archivos`, `solicitudes_objetos_pendientes`, disparadores e índices | Solicitudes |
| `1796000000002` | `cotizaciones`, `cotizaciones_versiones`, `cotizaciones_aclaraciones`, disparadores e índices | Cotizaciones |
| `1796000000003` | `avisos_negocio` e índices | Notificaciones |

Todas son reversibles. Ninguna toca tablas de 001 ni de 002. La composición de persistencia exige un sufijo único y posterior a `1795000000009`.
