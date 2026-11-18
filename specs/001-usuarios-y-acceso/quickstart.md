# Guía de validación — 001 Usuarios y acceso

Las siete historias están disponibles en `tecnologia/backend` y `tecnologia/frontend`.
Los recorridos de las secciones 4 en adelante se pueden ejecutar en la demostración
local con datos ficticios. Los resultados y el estado de aceptación por tarea se
registran en [implementation-status.md](implementation-status.md).

## Referencias y prerrequisitos

- [Plan](plan.md), [modelo](data-model.md), [contrato](contracts/openapi.json),
  [flujos de API](contracts/README.md) y [matriz de 53 escenarios](test-matrix.md).
- Node.js 24 LTS >=24.15, Docker con Compose y npm compatible.
- Los manifiestos y lockfiles son independientes en `tecnologia/backend` y
  `tecnologia/frontend`; ambos paquetes son privados y requieren Node 24.
- El backend debe entregar `tecnologia/backend/Dockerfile` y `.dockerignore`
  (T001); construcción/arranque inicial en T023 después de existir T022 y repetición
  de la imagen final de las siete historias en T116. La receta fundacional existe.
- Entorno de validación aislado, con cuentas y correos ficticios; SMTP se captura
  en Mailpit, no se envía a personas. No usar credenciales de producción.
- Origen común HTTPS local `https://localhost:8443`, certificado local confiable
  y proxy a frontend/API. No desactivar Secure para hacer funcionar los tests.
- Catálogo de contraseñas de prueba determinista solo en modo de validación;
  producción debe usar el snapshot completo aprobado y no puede iniciar en modo fixture.

## 1. Preparación de la fundación

Desde la raíz, con Node 24.15 o superior dentro de la línea 24 y Docker Linux activo:

```powershell
npm --prefix tecnologia/backend ci
npm --prefix tecnologia/frontend ci
npm --prefix tecnologia/backend run dev:prepare -- --validation
docker compose -f tecnologia/compose.yaml up -d --wait postgres redis correo objetos
npm --prefix tecnologia/backend run db:migrate
npm --prefix tecnologia/backend run storage:init
npm --prefix tecnologia/backend run security:catalog:prepare -- --fixture
npm --prefix tecnologia/backend run test:seed
```

`dev:prepare --validation` debe generar configuración local y claves efímeras
ignoradas por Git, preparar TLS local y comprobar dependencias sin tocar un entorno
productivo. Los seeds solo aceptan una DB de validación identificada; no borran
ni reinicializan datos reales. Ejecutar `dev:prepare` antes de Compose: genera
las variables requeridas en `tecnologia/.env` y `tecnologia/.local/backend.env`.
Mantener esos archivos en el entorno local. La preparación TLS utiliza OpenSSL
en Linux o PowerShell con OpenSSL en Windows. El ejecutor de CI conecta el proxy
a la interfaz del puente de Docker para alcanzar el backend y Vite que escuchan
en loopback. [Configuración de ejecución en CI](../../tecnologia/scripts/validar-001-ci.sh)

Si el Node global es anterior, se puede usar la herramienta local ignorada:

```powershell
npm.cmd install --prefix tecnologia/.local/toolchain --no-save --package-lock=false node@24.15.0
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/backend run typecheck
```

El wrapper admite los mismos argumentos de npm, usa el Node local si existe y
configura la CA explícita para clientes Node y la carpeta local de navegadores.
No instala confianza en Windows ni desactiva la validación TLS. La instalación
de navegadores se hace desde `tecnologia/frontend` con `npx playwright install
chromium firefox webkit`, usando el mismo Node 24.

| Dependencia | Comprobación esperada |
|---|---|
| PostgreSQL 18 | Migraciones aplicadas, índice de correo único y tablas/constraints del modelo. |
| Redis | Disponible para la arquitectura; sin sesiones, permisos ni datos privados de 001. |
| Mailpit | SMTP local y bandeja/API de correos capturados para recuperar/verificar/avisar. |
| Garage/S3 compatible | Bucket privado de prueba preparado, sin exposición pública; solo referencias en DB. |
| Catálogo fixture | Manifiesto y checksum conocidos; caso común/comprometido y control permitido reproducibles. |
| TLS/proxy | Mismo origen HTTPS; certificado confiable; cookies conservan Secure y Path. |

## 2. Arranque fundacional

En terminales independientes:

```powershell
npm --prefix tecnologia/backend run start:validation
npm --prefix tecnologia/frontend run dev -- --host 127.0.0.1 --mode validation
docker compose -f tecnologia/compose.yaml --profile web up -d proxy
```

El backend de validación escucha internamente en 3000 y Vite en 5173; el proxy
publica 8443 y enruta `/api/v1` al backend. Estos puertos son configuración local,
no una obligación del despliegue real. Worker de correo dentro del mismo backend,
no proceso/cola Redis independiente.

```powershell
curl.exe --cacert tecnologia/.local/tls/ca.crt https://localhost:8443/api/v1/salud
```

El resultado esperado es HTTP 200 y estado `disponible`. Para comprobar
también web, límites y cabeceras con CA explícita y validación TLS activa:

```powershell
npm --prefix tecnologia/backend run test:proxy
```

Este control no acredita confianza de los navegadores. El diagnóstico y la
configuración de confianza se describen en [TLS-PRUEBAS.md](../../tecnologia/frontend/TLS-PRUEBAS.md).
La importación visible de la CA en CurrentUser/Root ya fue aceptada y verificada;
Windows nativo pasó sus nueve proyectos con controles TLS negativos. En otro
entorno, seguir primero la identificación e importación visible de TLS-PRUEBAS.md.
Ejecutar la matriz nativa con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/frontend run test:e2e:windows
```

Existe además un ejecutor Linux efímero
que instala solo la CA pública en sus almacenes y conserva TLS y el origen
`https://localhost:8443`, sin cambiar la confianza de Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/diagnosticar-tls.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/frontend run test:e2e:container
```

Mantener la web y API anteriores arrancadas. El ejecutor se conecta al proxy de
Compose; los nueve proyectos comprueban la aplicación real y rechazan además un
certificado de control no confiable. Ver resultados por plataforma en el informe
de implementación. No usar `-k`, opciones que ignoren certificados ni desactivar TLS.

Preparación falla si PostgreSQL o el catálogo requerido no están listos; una caída
de Redis no hace fallar001. Un200 local no demuestra disponibilidad mensual EQ-02.

## 3. Controles automatizados

Cada ejecución local guarda sus resultados en una carpeta nueva. Si usas
Windows con Node 24 instalado en `.local/toolchain`, ejecuta los comandos npm
mediante `tecnologia/scripts/npm-local.ps1`, como en la sección 1.

```powershell
$evidencia = (New-Item -ItemType Directory ('tecnologia/.local/evidencia/001/guia-' + [Guid]::NewGuid().ToString('N'))).FullName
$env:EVIDENCIA_001 = $evidencia
$env:JEST_JUNIT_OUTPUT_DIR = $evidencia
$env:E2E_EVIDENCIA = $evidencia
npm --prefix tecnologia/backend run lint
npm --prefix tecnologia/frontend run lint
npm --prefix tecnologia/backend run typecheck
npm --prefix tecnologia/frontend run typecheck
npm --prefix tecnologia/backend run build
npm --prefix tecnologia/frontend run build
$env:JEST_JUNIT_OUTPUT_NAME = 'u.xml'
npm --prefix tecnologia/backend run test:unit
$env:JEST_JUNIT_OUTPUT_NAME = 'i.xml'
npm --prefix tecnologia/backend run test:integration -- --runInBand
$env:JEST_JUNIT_OUTPUT_NAME = 'c.xml'
npm --prefix tecnologia/backend run test:contract
$env:JEST_JUNIT_OUTPUT_NAME = 'arquitectura.xml'
npm --prefix tecnologia/backend run test:architecture
npm --prefix tecnologia/frontend run test:unit -- "--outputFile.junit=$(Join-Path $evidencia 'v.xml')"
npm --prefix tecnologia/frontend run test:e2e:container
```

Integración usa PostgreSQL real, no SQLite ni repositorios de memoria para
unicidad/locks/revocación. Contrato lee el OpenAPI versionado de esta funcionalidad.
Playwright usa backend real, Mailpit y datos aislados en 360/768/1366 px y
Chromium/Firefox/WebKit. Registrar nombres y versiones de navegadores.

`test:coverage:001` lee los 53 IDs de spec y matriz y cruza los nombres de las
pruebas aprobadas por nivel. El manifiesto JSON declara `commit`, `version`,
`entorno`, `corpus` y `reportes` con listas de rutas por nivel. U/I/C/V requieren
JUnit y E requiere JSON de Playwright con sus versiones de navegador. La
configuración de CI usa `exigirMatrizE: true` para exigir los nueve proyectos
de T007. El verificador falla si una asociación carece de evidencia o hay
casos omitidos, fallidos o reportes faltantes. El archivo de salida es nuevo.
`E2E_EVIDENCIA`, `JEST_JUNIT_OUTPUT_DIR` y `EVIDENCIA_001` permiten separar intentos
en `tecnologia/.local/evidencia/001/`. [Ejemplo de manifiesto](../../tecnologia/scripts/validar-001-ci.sh)

Para verificar los informes recién ejecutados en la carpeta local, genera un
manifiesto con sus rutas relativas. Si conservas artefactos de CI, guarda el
manifiesto original como evidencia y usa un archivo nuevo para rutas locales.

```powershell
$sha = git rev-parse HEAD
$manifest = Join-Path $evidencia 'manifest.json'
$datos = @{
  commit = $sha
  version = $sha
  entorno = 'Demostración local con PostgreSQL, Garage, Mailpit y Playwright Linux bajo HTTPS'
  corpus = 'Fixture determinista de 001'
  exigirMatrizE = $true
  reportes = @{ U = @('u.xml'); I = @('i.xml'); C = @('c.xml'); V = @('v.xml'); E = @('e2e-linux/playwright.json') }
}
[IO.File]::WriteAllText($manifest, ($datos | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
npm --prefix tecnologia/backend run test:coverage:001 -- $manifest (Join-Path $evidencia 'cobertura.json')
```

Después de preparar DB/corpus y de disponer del entrypoint compilado, T023 debe
entregar esta comprobación adicional, también repetida por CI en T116:

```powershell
npm --prefix tecnologia/backend run test:container
```

El script entregado construye la imagen Linux multietapa desde el Dockerfile de
T001 y la arranca con dependencias y configuración aisladas. Verifica usuario
sin privilegios, carga de Argon2 nativo, salud 200 con dependencias listas y
503 al configurar DB/corpus no disponibles en instancias separadas de prueba,
sin detener los servicios usados por otras suites. Configuración/corpus de
validación se montan fuera de las capas; producción rechaza fixture. No publicar
puertos ni usar credenciales reales; limpiar únicamente contenedores efímeros
creados por esta prueba y conservar digest de imagen/entorno/resultados sanitizados.
En T116 comprobar además el worker del mismo backend y un recorrido de correo
capturado en Mailpit con las historias integradas. La receta puede prepararse en
T001; no afirmar construcción/arranque funcionales antes de T022/T023.

Los cierres de US3 (T062) y US5 (T076) validan sus suites sin esperar entre sí.
US5 dispone de la proyección compartible de T069; US4 la integra y verifica
transversalmente en T082. En el cierre global T110 añade regresión conjunta de
recuperación/edición de perfil, con dependencias explícitas de T062 y T076,
conservando los 53 CA originales y la revocación de accesos tras reset.

## 4. Recorridos de validación de extremo a extremo

| Paso | Acción con datos ficticios | Resultado esperado |
|---|---|---|
| Registro | Cliente, prestador y ambos; con y sin opcionales, y foto válida opcional | Una cuenta por correo, perfiles elegidos, privacidad registrada, sin administrador. |
| Duplicado | Repetir correo cambiando mayúsculas y con concurrencia | No duplicación; conflicto controlado. |
| Acceso | Correo y contraseña íntegra; variantes de mayúsculas | Misma cuenta; acceso propio, cookie HttpOnly/Secure y Bearer solo en memoria. |
| Perfil | Editar nombre, teléfono, distrito/foto y actualizar con versión vieja | Valores válidos persistidos; obsoleto409; datos ajenos no visibles. |
| Perfil faltante | Confirmar adición desde cuenta con un solo perfil | Misma identidad/datos; sin verificación RF07 ni inserción de RF06. |
| Correo | Pedir cambio con recencia válida, abrir Mailpit y verificar destino | Anterior sigue hasta confirmar; luego mismo UUID y nuevo correo de acceso. |
| Contraseña | Flujo específico con actual correcta y nueva confirmada | Nueva autentica; anterior no; PATCH no permite cambio directo. |
| Recuperación | Solicitar con correo existente e inexistente | Exactamente el mensaje genérico aprobado; correo solo para el existente. |
| Reset | Presentar token válido con nueva confirmada, manteniendo varias sesiones abiertas | Un cambio, todas las sesiones/enlaces anteriores inválidos, aviso y nuevo login exigido. |
| Replay | Reenviar reset con misma clave/datos y luego con clave distinta | Primero resultado anterior sin efectos; después rechazo de enlace usado. |
| Cierre | Reutilizar Bearer y renovación después de cerrar | Ambos rechazados inmediatamente. |

Los enlaces se abren como pantalla sin mutación por GET; el cliente conserva el
token solo en memoria tras limpiar el fragmento. No usar herramientas de captura
que publiquen secretos. Registrar solo IDs de casos y resultados sanitizados.

## 5. Límites y fallas sin esperar minutos reales

Ejecutar tests con `Reloj` inyectado solo por composición de validación; no crear
endpoints productivos para mover el tiempo ni aceptar fechas de autenticación del cliente.

| Regla | Instantes/casos mínimos | Resultado |
|---|---|---|
| Autenticación reciente | 299.999,300,300.001 s y sin marca | Admitir, admitir, pedir contraseña, pedir contraseña. |
| Renovación/actividad | Solicitud posterior a 300 s pese a actividad y refresh | No reiniciar recencia; comprobar servidor. |
| Recuperación | 1799.999,1800,1800.001 s | Válido, vencido, vencido. |
| Acceso y bloqueo | 899.999,900,900.001 s | Expiración o fin de espera en el límite documentado. |
| Renovación absoluta | Instante anterior a 7 d y a 7 d | Renovar antes, rechazar al límite; no deslizarlo. |
| Contraseña | 14,15,128,129 puntos de código; espacios y Unicode multibyte | Aplicar15–128 completos sin corte ni requisitos de mezcla. |
| Sesiones/recovery races | Reset/reset, reset/login y reset/refresh con barreras | Ningún acceso con credencial anterior después del commit. |
| Correo en uso | Dos confirmaciones para el mismo destino | Solo una; otra409 y correo anterior intacto. |

Simular fallas SMTP, worker después de entregar, DB entre escrituras y Redis fuera
de servicio. Esperado: no efectos parciales ni bypass, aviso reintentable sin revertir
reset, ningún token en logs, ningún acceso dependiente de Redis.
Comprobar CSRF/origen, fotos ajenas, tamaño/contenido de imágenes y limpieza de objetos.

T113 debe comprobar también los rechazos de transporte de OpenAPI 1.0.1:

| Caso negativo aislado | Resultado previsto |
|---|---|
| Cuerpo >65536 bytes ordinarios, incluidos GET/cierre/refresh con cuerpo inesperado | 413 CUERPO_DEMASIADO_GRANDE |
| Registro con fotografía o carga >14000000 bytes de transporte | 413 CUERPO_DEMASIADO_GRANDE |
| Foto decodificada >10000000 bytes, dentro del transporte admitido | 413 ARCHIVO_DEMASIADO_GRANDE |
| Cuerpo no vacío en operación sin requestBody, dentro del límite | 400 DATOS_INVALIDOS |
| Origin ausente en cualquiera de las 13 mutaciones | 400 CABECERA_REQUERIDA |
| Origin malformado / origen válido ajeno | 400 DATOS_INVALIDOS / 403 ORIGEN_NO_ADMITIDO |
| UUID/token malformados, JSON o MIME/codificación no admitidos | 400 DATOS_INVALIDOS |
| Credencial ausente/inválida / CSRF ausente/incorrecto | 401 según credencial / 403 CSRF_NO_VALIDO |

Usar peticiones válidas de control, modificar una sola condición y comprobar el
límite exacto/exceso de un byte, estado protegido intacto y código permitido por
el HTTP. GET no exige Origin. Los demás 404/409/422/429/503 se rigen por la tabla
de rechazos de `contracts/README.md`; token de formato correcto pero vencido/usado
se rechaza semánticamente con 422, conservando la excepción de replay exacto acordada.

## 6. Criterio de aceptación y límites

Revisar 53/53 CA y controles X-01–X-08 de [matriz](test-matrix.md), además de PR04,
PR07, PR12, PR13, PR14 y salud PR02 aplicables. Ejecutar lint, types y build en CI.
Registrar las ejecuciones automatizadas, el ensayo operativo y la revisión
humana por separado en `tecnologia/.local/evidencia/001/validacion.md`. El
resultado indica commit, entorno, corpus, navegadores y alcance de cada ejecución.
La ejecución #5 de GitHub Actions es la referencia alojada de T116. [Ejecución #5](https://github.com/Roki-7/plataforma-servicios-construccion-ayacucho/actions/runs/44319286410) La #7 corresponde al commit `a13d0ce` de T117. [Ejecución #7](https://github.com/Roki-7/plataforma-servicios-construccion-ayacucho/actions/runs/44406102967)

No ejecutar aquí pruebas de contratación ni interpretar las metas EQ-01/EQ-06
como SLA de registro. k6 se usará para caracterizar hashing/sesiones sin prometer
capacidad no medida. Correo real por SES y objetos de producción requieren
configuración del despliegue; esta guía local no realiza esa configuración.

## 7. Ensayo aislado de recuperación de T117

Con la preparación de la sección 1 completada, ejecuta desde la raíz. El
script genera credenciales de prueba y crea sus propios PostgreSQL y Garage.
Los puertos se asignan en loopback. Cada ejecución escribe un informe nuevo.

```powershell
$ensayo = Join-Path (Resolve-Path tecnologia/.local).Path ('evidencia/001/cierre/t117-operativo-' + [Guid]::NewGuid().ToString('N'))
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/backend run test:respaldo -- (Join-Path $ensayo 'respaldo.json')
```

Con Node 24 en el `PATH`, el equivalente en PowerShell es
`npm --prefix tecnologia/backend run test:respaldo -- (Join-Path $ensayo 'respaldo.json')`.

1. Migra el PostgreSQL nuevo y registra por API una cuenta ficticia con foto.
2. Guarda un `pg_dump --format=custom` y los bytes del objeto privado. Compara la huella del objeto con la referencia de PostgreSQL.
3. Detén y arranca PostgreSQL y Garage del origen. Comprueba salud, cero migraciones pendientes, inicio de sesión y lectura del mismo perfil y la misma foto.
4. Mantén el origen detenido. Restaura con `pg_restore --exit-on-error` en una base vacía y confirma que el perfil recuperado referencia una foto ausente en el Garage vacío.
5. Copia el objeto respaldado al destino y verifica el mismo SHA-256 desde la API del titular. Comprueba HTTP 401 al pedir la foto sin sesión y HTTP 403 al consultar directamente el objeto como anónimo.

`respaldo.json` conserva las imágenes fijadas, el commit, la huella del ejecutor,
las migraciones, las huellas de los respaldos y los resultados HTTP. El script
limpia los contenedores que llevan su etiqueta y los archivos temporales.
Los datos son ficticios. El ensayo abarca un perfil y su objeto en una misma
versión de 001, con respaldos lógicos y destinos nuevos en el motor local.

## 8. Revisión humana de usabilidad y responsive de T117

1. Deja la demostración de la sección 2 en marcha y comprueba HTTP 200 en `https://localhost:8443/api/v1/salud` con la CA de validación. Abre `https://localhost:8443/registro` y Mailpit en `http://127.0.0.1:8025`.
2. Abre el modo adaptable del navegador. En Chromium o Edge puedes abrir DevTools y activar la barra de dispositivos con `Ctrl+Shift+M`. Repite el recorrido de la tabla a **360, 768 y 1366 px** de ancho. Usa una cuenta nueva de `example.invalid` y una frase de prueba distinta del fixture en cada ancho. Puedes empezar como cliente a 360 y 1366 px y como prestador a 768 px.
3. En cada pantalla comprueba etiquetas legibles, foco visible al usar Tab, mensajes junto a la acción y botones alcanzables. En los formularios de contraseña, escribe un valor de prueba y usa Tab, Enter y Espacio para mostrarlo y volver a ocultarlo sin modificarlo. Registra solapamientos, cortes de texto, desplazamiento horizontal o pasos en los que necesitaste ayuda.

| Recorrido | Qué hacer | Resultado esperado |
|---|---|---|
| Registro y acceso | En **Crear cuenta** completa los campos y prueba primero `cliente01` como correo. Corrígelo, elige un perfil y acepta la política. Pulsa **Iniciar sesión** en la confirmación e introduce tu contraseña. | El correo incompleto bloquea el registro y muestra el mensaje junto al campo. «Tu cuenta se creó correctamente» permite abrir el acceso con el correo precargado. Tras el inicio manual se abre **Mi cuenta**. |
| Perfil y permisos | En **Mi cuenta**, cambia el nombre de muestra, añade distrito y un teléfono ficticio, adjunta una imagen de prueba y pulsa **Guardar cambios**. Recarga y comprueba los valores y la foto. Abre **Mis perfiles**, confirma y pulsa **Añadir cliente** o **Añadir prestador**. | La misma cuenta conserva sus datos y muestra ambos perfiles. El teléfono aparece privado hasta autorizarlo expresamente. |
| Cambio de correo | En **Cambiar correo de acceso** solicita una dirección nueva de `example.invalid`. Si pide recencia, pulsa **Verificar mi identidad** y vuelve a solicitar. Abre en Mailpit el enlace dirigido al correo nuevo en el mismo perfil de navegador y pulsa **Confirmar nuevo correo**. | El correo anterior figura como vigente hasta confirmar. Al iniciar sesión después, el correo nuevo permite entrar. |
| Cambio de contraseña | En **Mi cuenta → Cambiar contraseña** establece otra frase de prueba y confirma. Cierra sesión y vuelve a entrar con la nueva. | El formulario da confirmación y la contraseña nueva funciona. |
| Recuperación y cierre | Desde **Acceder → Olvidé mi contraseña**, pide un enlace al correo vigente. Abre el mensaje en Mailpit, establece otra frase y entra con ella. Si quieres observar la revocación, mantén una segunda sesión en otro perfil de navegador antes del cambio y recarga allí **Mi cuenta** después. Pulsa **Cerrar sesión** y vuelve a **Mi cuenta**. | El mensaje de solicitud es genérico. Después del cambio se solicita acceso en las sesiones anteriores y después de cerrar sesión. |

Anota la fecha, el SHA de `git rev-parse HEAD`, el navegador y su versión. En
`tecnologia/.local/evidencia/001/validacion.md`, registra el resultado por ancho y
recorrido como `Aprobado`, `Falló` o `Pendiente`. Añade el paso y el mensaje visible
de cada incidencia. Usa capturas recortadas si aportan evidencia y excluye
contraseñas, códigos, enlaces de correo y correos privados. Esta revisión acredita
FR-019/PR07 junto con la matriz automatizada.
