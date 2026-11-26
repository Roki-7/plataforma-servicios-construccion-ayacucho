# Guía de validación — 003 Solicitudes y cotizaciones

**Fecha** 2026-11-26 · Enlaces: [spec.md](spec.md) · [plan.md](plan.md) · [data-model.md](data-model.md) · [contratos](contracts/README.md)

Esta guía describe cómo comprobar de extremo a extremo que la funcionalidad cumple su especificación. **Los comandos marcados como «previsto» todavía no existen**: los crearán las tareas de implementación. No hay evidencia de ejecución en esta etapa.

## 1. Requisitos previos

- Node.js `>=24.15.0 <25`, Docker y Docker Compose, y los lockfiles del backend y el frontend instalados.
- Datos ficticios únicamente. Ninguna prueba usa datos personales reales.
- Variables nuevas: solo `SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS` (inicial 300) y `SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS` (inicial 900). **No hay bucket, identidad ni credenciales nuevas:** se usa el bucket privado existente con el prefijo `solicitudes/`.

## 2. Preparar el entorno aislado (previsto)

| Paso | Comando previsto | Resultado esperado |
|---|---|---|
| Infraestructura propia | `docker compose -f tecnologia/compose.003.yaml up -d` | PostgreSQL, almacenamiento de objetos y correo local en un proyecto propio y puertos propios. |
| Migraciones | `npm --prefix tecnologia/backend run db:migrate:003` | Se aplican las migraciones de 001, 002 y 003 en una base `ayacucho_003_*`. |
| Almacenamiento | `npm --prefix tecnologia/backend run storage:init:003` | Comprueba el acceso al bucket privado existente con el prefijo `solicitudes/` y que no hay acceso anónimo. No crea bucket ni identidad. |
| Semilla ficticia | `npm --prefix tecnologia/backend run test:seed:003` | Clientes, prestadores con servicios en varias categorías y distritos, y una cuenta con ambos perfiles. |
| Arranque | `npm --prefix tecnologia/backend run start:validation:003` | La aplicación expone 58 operaciones (17 + 23 + 18). |

## 3. Recorridos que prueban la especificación

Todas las mutaciones llevan `Origin`, `Idempotency-Key` (16 a 128 caracteres) y el token Bearer de la 001. `$T_CLIENTE`, `$T_PRESTADOR` y `$T_AJENO` son tokens de cuentas de prueba.

| # | Recorrido | Pasos | Resultado esperado | Escenarios |
|---|---|---|---|---|
| R1 | Borrador incompleto y publicación | `POST /solicitudes` con solo `tipo`. `POST /solicitudes/{id}/publicacion`. | 201 como `BORRADOR`. La publicación incompleta devuelve 422 `SOLICITUD_INCOMPLETA` con los campos que faltan. | CA-BOR-01, CA-BOR-02 |
| R2 | Dirigida con y sin servicio | Publicar una dirigida con un servicio elegible, y otra sin servicio a un prestador que no cubre el distrito. | Ambas quedan `ABIERTA`. La segunda trae advertencias no bloqueantes. Cada una registra un aviso para su destinatario. | CA-BOR-08, CA-BOR-09, CA-AVI-02 |
| R3 | Publicada y oportunidades | Publicar una publicada. Consultar `GET /solicitudes/oportunidades` con un prestador compatible y con uno que no lo es. | Solo el compatible la ve. No se registra ningún aviso. | CA-OPO-01, CA-CMP-01 a 07, CA-AVI-03 |
| R4 | Cotizar y duplicar | Enviar una cotización estimada con solo forma de cálculo. Enviar otra del mismo prestador. | 201 y luego 409 `COTIZACION_EXISTENTE`. | CA-RF17-01, CA-COT-01 |
| R5 | Cambio relevante | Editar la descripción de la solicitud con `PATCH`. Consultar la cotización. | Versión de trabajo 2, la cotización queda `PENDIENTE_REVISION`, un aviso REGISTRADO para su autor. | CA-SOL-05, CA-COT-04, CA-AVI-04 |
| R6 | Revisión y vencimiento | Actualizar la cotización con la versión de trabajo vigente. Repetir con una vigencia pasada. | La primera se resuelve. La segunda se rechaza. | CA-COT-05, CA-COT-03 |
| R7 | Retiro y reenvío | Retirar y volver a enviar. | Otra identidad con hilo vacío. La anterior conserva historial y aclaraciones. | CA-COT-06, CA-PRI-08 |
| R8 | Aclaraciones y comparación | Cliente y prestador intercambian mensajes. `GET /solicitudes/{id}/cotizaciones?ids=…` con 10 y con 11 identificadores. | 20 mensajes como máximo. 10 se comparan, 11 devuelve 422 `LIMITE_COMPARACION`. | CA-ACL-01 a 04, CA-COT-12 |
| R9 | Archivos | Cargar una imagen. Confirmarla con `archivosIds`. Quitarla. Pedir la imagen con otra cuenta. | PREPARADO, CONFIRMADO, inaccesible al instante y 404 para la cuenta ajena. | CA-ARC-03, CA-ARC-04, CA-ARC-12 |
| R10 | Privacidad de fotografías | En una publicada con fotos compartidas, el cliente cambia `compartirFotografias` a `false`. | Todos los prestadores, también quien ya cotizó, pierden las imágenes. No hay versión de trabajo ni avisos. | CA-PRI-02, CA-PRI-03, CA-VER-01 |
| R11 | Datos personales | Publicar con `981 234 567` en la descripción. Repetir con «Pared de 2.50 x 3.00 m, S/ 1 500 000». | La primera devuelve 422 `DATOS_PERSONALES_EN_TEXTO`. La segunda se acepta. | CA-DAT-01, CA-DAT-04, CA-DAT-08 |
| R12 | Historial | `GET /solicitudes/{id}/historial?tipo=versiones` con dueño, autor y prestador compatible. Repetir con `tipo=bitacora`. | Las versiones según el rol. La bitácora solo para el dueño, y 404 para los demás. | CA-HIS-01 a 03 |
| R13 | Cierre | Cerrar con cotizaciones existentes. Intentar editar, cotizar y retirar. | Todo devuelve 409 `SOLICITUD_NO_ABIERTA`. Todo se lee con normalidad. | CA-CIE-01 a 04 |
| R14 | Selección inexistente | Revisar el contrato y los datos. | No hay operación ni estado de selección o contratación. | CA-FRO-01 |
| R15 | Dirigida cerrada sin cotización | El destinatario de una dirigida que el cliente cerró, sin haber cotizado, consulta `GET /solicitudes?rol=prestador` y abre el detalle. Una cuenta sin perfil prestador usa `rol=prestador`. | La encuentra con `titulos: [DESTINATARIO]`, la lee y no obtiene datos del cliente. La cuenta sin perfil recibe 403. Una cuenta ajena recibe 404 al pedir el detalle. | CP-301, CP-302 |
| R16 | Aislamiento del almacenamiento | Pedir un objeto de `solicitudes/` sin sesión, con una cuenta ajena y con los adaptadores de 001 y 002. | Sin sesión no hay acceso, la cuenta ajena recibe 404 y los adaptadores de 001 y 002 no leen, listan ni borran esos objetos. | CP-307 |

## 4. Pruebas automáticas (previstas)

| Capa | Comando previsto | Cobertura |
|---|---|---|
| Unitarias | `npm --prefix tecnologia/backend run test:unit -- --testPathPatterns solicitudes-cotizaciones` | Dominio, políticas y validaciones. |
| Arquitectura | `npm --prefix tecnologia/backend run test:architecture` | PR12 con las reglas nuevas. |
| Contratos | `npm --prefix tecnologia/backend run test:contract -- --testPathPatterns solicitudes-cotizaciones` | Espejo idéntico, composición de 58 operaciones y esquemas. |
| Integración | `npm --prefix tecnologia/backend run test:integration:003` | PostgreSQL y almacenamiento reales, concurrencia, disparadores, limpieza y presupuesto de consultas. |
| Composición definitiva | Prueba de arranque completo en la integración | `crearAplicacionCompleta003` valida las 58 operaciones con el ensamblador y el verificador de rutas reales. |
| Respaldo y restauración | Ensayo aislado en la integración de infraestructura | OP-301 a OP-304 con inyección de fallos. Evidencia obligatoria antes de usar datos reales. |
| Seguridad | Dentro de la integración | Matriz PR04 y CA-SEG-01. |
| Regresión | CI de 001 y de 002 | Sin cambios de comportamiento. |
| Frontend | `npm --prefix tecnologia/frontend run test:unit` y `test:e2e:003` | Recorridos y PR07. |
| Rendimiento | `npm --prefix tecnologia/backend run test:performance:003` | PR01 sobre oportunidades y comparación. |

## 5. Operación, control, respaldo y restauración (previsto)

| Comando | Qué hace | Salida esperada |
|---|---|---|
| `npm --prefix tecnologia/backend run solicitudes:limpiar:003` | Ejecuta un ciclo de limpieza bajo demanda. Idempotente. | Cantidad de objetos purgados, reintentos y huérfanos. |
| `npm --prefix tecnologia/backend run solicitudes:verificar:003` | Informe de entradas vencidas (más del umbral de 900 s sobre su vencimiento), objetos sin fila, filas sin objeto y contadores. | Código de salida 0 si todo está bajo sus umbrales. Distinto de cero si no. |
| `npm --prefix tecnologia/backend run solicitudes:respaldar:003` | Corte coherente de PostgreSQL y de los objetos de `solicitudes/` con manifiesto. | Manifiesto `COMPLETO` solo si cada archivo `PREPARADO` o `CONFIRMADO` tiene su objeto con el mismo tamaño y SHA-256 (OP-301). |
| `npm --prefix tecnologia/backend run solicitudes:restaurar:003` | Restauración en una base y un prefijo nuevos, con conciliación. | Recupera los datos y los archivos accesibles según la política. Rechaza parejas inconsistentes, destinos no vacíos y restauraciones interrumpidas (OP-302 y OP-303). |

El responsable operativo ejecuta `verificar` cada día laborable, antes de cada respaldo y antes de cada despliegue, y conserva el informe. Si el proceso periódico del monolito estuvo detenido, los objetos eliminados o caducados pueden permanecer almacenados, inaccesibles desde la API, hasta el siguiente ciclo. Ese riesgo se declara y no se afirma ningún borrado automático a las 24 horas.

**Plazos que no deben confundirse.** La **caducidad lógica** de 24 horas vuelve inaccesible un archivo no confirmado de inmediato. El **intervalo** del proceso (300 s) decide cuándo se borra el objeto. El **umbral** de 15 minutos solo es el retraso máximo tolerado sobre el vencimiento de una entrada de limpieza antes de que el control falle. No es un plazo de retención.

**Requisito previo al uso con datos reales (OP-307).** Respaldo y restauración deben ejecutarse y aprobarse con evidencia (OP-301 a OP-304). **Hasta que se ejecuten, su estado es PENDIENTE y no se declaran probados.**

## 6. Evidencia que debe conservarse

- Informes JUnit de cada capa, el informe del control de limpieza y las capturas de los recorridos web.
- Para PR06, el protocolo, los tiempos y los resultados de los cinco participantes.
- Para PR07, las ejecuciones en tres navegadores y tres anchos y el registro manual en un celular real.
- Para PR01, la configuración, los datos de carga y las métricas por operación. La CI no ejecuta k6.
- Todo lo que no se ejecute se registra como PENDIENTE. No se hereda ninguna excepción de la 002.
