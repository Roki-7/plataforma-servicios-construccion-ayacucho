# TLS de desarrollo y pruebas de T007

El origen aprobado es `https://localhost:8443`. La aplicación real y el backend
corren en Windows en 5173/3000; Caddy termina TLS en un contenedor Linux de Compose.
Los navegadores pueden ejecutarse en Windows o en el ejecutor Linux de pruebas.
Cada entorno necesita confianza en la CA, además de una cadena, fechas y SAN válidos.

## Diagnóstico y resolución del entorno Windows

Playwright 1.65.1 estaba lanzando ejecutables `.exe` de Chromium, Firefox y WebKit
desde `tecnologia/.local/ms-playwright/`, con perfiles/contextos efímeros. No eran
navegadores dentro de los contenedores de Compose.

| Motor nativo | Error antes de la corrección del entorno |
|---|---|
| Chromium | `net::ERR_CERT_AUTHORITY_INVALID` |
| Firefox | `SEC_ERROR_UNKNOWN_ISSUER` |
| WebKit | `SSL peer certificate or SSH remote key was not OK` |

Inicialmente la CA no estaba en `Cert:\CurrentUser\Root` ni en `Cert:\LocalMachine\Root`.
Las primeras importaciones al almacén del usuario terminaron con
`0x800704C7`: «El usuario ha cancelado la operación». No se alteraron registros
ni políticas de Windows para eludir esa respuesta. `NODE_EXTRA_CA_CERTS` configura
clientes Node; por sí sola no instala confianza en los navegadores.

Diagnóstico reproducible, sin modificar los almacenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/diagnosticar-tls.ps1
```

Con `-ExigirConfianzaWindows` termina con `CA_WINDOWS_NO_CONFIABLE` si la CA falta
en ambos almacenes. Conserva el diagnóstico público en la carpeta ignorada de
evidencia. El runner Linux compara además las huellas del certificado servido y
de la CA con los archivos públicos actuales del host.

La CA local es autofirmada, `CA:TRUE`, válida del 16 de noviembre de 2026 a las
19:52:19 UTC al 16 de diciembre a la misma hora. El certificado del servidor es
válido del 16 de noviembre de 2026 a las 19:53:57 UTC al 30 de noviembre a la
misma hora; contiene `DNS:localhost` e `IP:127.0.0.1`. OpenSSL verificó ambas
identidades, la cadena y el propósito de servidor. Estos datos describen los
certificados de esta ejecución; al renovarlos hay que repetir la comprobación.

La CA vigente procede del generador local `tecnologia/scripts/preparar-tls.ps1`
(OpenSSL), sujeto/emisor `CN=Ayacucho Validacion Local CA`, serie
`4AA2B9A7D7C5C7CF7260413E6B63C4DE3C640259`. Se mostraron estos datos antes de
solicitar la instalación, junto con las huellas y la correspondencia TLS:

- CA SHA-256: `2D:CB:8F:BD:C6:1C:14:66:03:FC:0E:5C:47:F7:D9:C4:4F:92:29:6C:32:71:7D:B7:45:C2:AE:F1:42:1F:2A:85`.
- CA SHA-1, identificador del almacén/aviso Windows: `29926A9715BC060FC6CB57903262F6BEA6853DE2`.
- Certificado servido SHA-256: `E6:7D:F6:33:1B:AF:55:62:40:18:FB:B7:0D:DB:BA:48:33:44:FA:17:AE:3E:EE:95:CD:34:0D:3F:11:81:80:91`.

Se comprobó la firma autofirmada de la raíz, la firma del certificado de servidor
con esa CA y la coincidencia exacta entre el certificado servido y `localhost.crt`.
La raíz y el certificado de servidor no se regeneraron para esta corrección.

### Instalar con confirmación visible

Ejecutar desde la raíz del repositorio en la sesión Windows del usuario que vaya
a lanzar las pruebas. Comprobar primero la CA vigente con el diagnóstico y
comparar su huella con la verificada; el ejemplo corresponde a esta CA concreta:

```powershell
$taskImportScript = Join-Path (Get-Location) 'tecnologia/scripts/confiar-ca-windows-visible.ps1'
$taskImportArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $taskImportScript + '"'), '-HuellaSha256Esperada', '2DCB8FBDC61C146603FC0E5C47F7D9C44F92296C32717DB745C2AEF1421F2A85')
Start-Process -FilePath powershell.exe -ArgumentList $taskImportArgs -WorkingDirectory (Get-Location).Path -WindowStyle Normal
```

La ventana muestra el certificado público y el destino `CurrentUser\Root`.
Aceptar el aviso de Windows después de comparar la identidad y la huella. El
script impide importar otra CA si cambia la huella esperada y registra el resultado
en `.local/evidencia/001/importacion-ca-windows.json`. Si ya está instalada con los
mismos bytes, solo verifica la entrada existente. No usa instalación silenciosa,
`-Verb RunAs`, el almacén del equipo ni claves privadas.

La operación visible de esta ejecución se abrió en la sesión interactiva 1 de
`anderson` y fue aceptada. La verificación posterior en Windows nativo encontró
una única entrada en `CurrentUser\Root`, idéntica byte por byte a `ca.crt`, sin
clave privada asociada. `LocalMachine\Root` permaneció sin esa CA. Para consultar
la confianza se utilizó la misma identidad nativa que ejecuta los navegadores,
fuera de las restricciones del agente; una consulta restringida había mostrado
`false` y no se usó como verificación definitiva.

### Ejecutar Windows nativo con controles TLS negativos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/diagnosticar-tls.ps1 -ExigirConfianzaWindows
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/frontend run test:e2e:windows
```

El helper `scripts/probar-navegadores-windows.mjs` exige Windows nativo y confianza
instalada, comprueba el certificado servido y crea un control TLS no confiable
únicamente en loopback IPv4/IPv6:9443. Su clave temporal queda en `.local`, se
elimina al cerrar el control y nunca se instala como CA. Activa explícitamente
`E2E_TLS_NEGATIVAS=true` y lanza los nueve proyectos con procesos nuevos.
La configuración conserva `ignoreHTTPSErrors:false`, sin flags que ignoren
certificados ni cambios de TLS. Firefox utiliza la confianza de Windows con
`security.enterprise_roots.enabled=true`.

Resultado del 2026-11-16, inicio 22:53:42 UTC: **9/9 aprobados en 46,6 segundos**,
Chromium 159.0.8154.6, Firefox 159.0 y WebKit 27.2 en 360/768/1366 px. Cada proyecto
aprobó UI, salud, Mailpit y rechazo del certificado de control. El JSON del reporte
confirma `win32`, Node 24.15 y nueve anotaciones de rechazo TLS. Evidencia en
`tecnologia/.local/evidencia/001/e2e-windows-native/`; los nueve fallos anteriores
se conservan por separado en `e2e-windows/`. No quedan claves del control temporal.

### Retirar únicamente esta CA de Windows

Estos comandos son instrucciones de retirada; **no se ejecutaron** durante la
validación. Usar una sesión nativa del mismo usuario. Se selecciona por huella
exacta y se comprueba SHA-256 antes de pedir confirmación para eliminar confianza:

```powershell
$taskThumbprint = '29926A9715BC060FC6CB57903262F6BEA6853DE2'
$taskCertificatePath = 'Cert:\CurrentUser\Root\' + $taskThumbprint
$taskCertificate = Get-Item -LiteralPath $taskCertificatePath -ErrorAction Stop
$taskHasher = [Security.Cryptography.SHA256]::Create()
try { $taskCertificateSha256 = [BitConverter]::ToString($taskHasher.ComputeHash($taskCertificate.RawData)).Replace('-', '') }
finally { $taskHasher.Dispose() }
if ($taskCertificateSha256 -ne '2DCB8FBDC61C146603FC0E5C47F7D9C44F92296C32717DB745C2AEF1421F2A85') { throw 'La CA no coincide; revisar antes de retirar.' }
Remove-Item -LiteralPath $taskCertificatePath -Confirm
Test-Path -LiteralPath $taskCertificatePath # Debe devolver False tras aceptar.
```

Cerrar los procesos de navegador después de la retirada. El diagnóstico con
`-ExigirConfianzaWindows` debe volver a indicar `CA_WINDOWS_NO_CONFIABLE`. La
retirada elimina la confianza del usuario; los archivos locales permanecen
ignorados por Git. El ejecutor Linux instala confianza en cada contenedor
independientemente del almacén Windows, y su retirada automática destruye esos
almacenes efímeros. No se instaló esta CA en `LocalMachine\Root`.

## Ejecutor Linux aislado

`Dockerfile.e2e` fija por digest la imagen oficial de Playwright 1.65.1 y Node
24.15.0. Instala las dependencias npm del lockfile. No es la imagen de despliegue
de la aplicación ni modifica el almacén de certificados del host.

En cada contenedor efímero se monta **solo** `tecnologia/.local/tls/ca.crt` en modo
lectura. No se montan claves de CA/servidor, `.env` ni credenciales del backend.
El arranque instala ese certificado público en:

- Chromium M146+: NSS del usuario de pruebas en
  `/home/pwuser/.local/share/pki/nssdb`, con confianza para emitir certificados TLS.
- Firefox: política `Certificates.Install`, importada en sus perfiles efímeros.
  La distribución de Playwright utiliza `browser.policies.alternatePath` y exige
  indicar el JSON con `PLAYWRIGHT_FIREFOX_POLICIES_JSON`; colocarlo solo en
  `distribution/policies.json` no activó la política en la primera comprobación.
- WebKit: almacén CA de Ubuntu, actualizado con `update-ca-certificates`.
- Cliente HTTP de Playwright/Node: `NODE_EXTRA_CA_CERTS` con la CA pública.

La preparación del almacén se realiza como root dentro del contenedor; el proceso
de pruebas y los navegadores se ejecutan como `pwuser` (UID 1001 en la imagen
verificada; el runner exige UID distinto de cero y registra el valor real).

```text
navegador Linux -> https://localhost:8443 -> reenvío TCP local -> proxy:8443 (Caddy)
                                                            -> app/API Windows
```

El reenvío TCP conserva los bytes TLS y SNI: los navegadores siguen comprobando
el certificado para `localhost`. `proxy` es el destino de transporte en la red
de Compose; no es el nombre HTTPS. Esto conserva el SAN, el origen y las reglas
de Origin de la aplicación. No se publican puertos del ejecutor. Caddy sirve la
web/API reales; no se sustituyen por respuestas simuladas.

Desde la raíz, con los servicios de validación preparados y la web/API arrancadas
según quickstart:

```powershell
docker compose -f tecnologia/compose.yaml up -d --wait postgres redis correo objetos
docker compose -f tecnologia/compose.yaml --profile web up -d proxy
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/backend run test:proxy
powershell -NoProfile -ExecutionPolicy Bypass -File tecnologia/scripts/npm-local.ps1 --prefix tecnologia/frontend run test:e2e:container
```

El último comando construye y ejecuta los nueve proyectos de forma secuencial,
monta solo la CA pública y la carpeta de evidencia, y retira solo el
contenedor identificado por su nombre/etiqueta únicos. `-- --sin-construir` permite
reutilizar la imagen local para diagnosticar; reconstruir después de cambiar
código, configuración o lockfile. El primer uso descarga la imagen y necesita red.

Cada proyecto comprueba UI base, salud del backend real y Mailpit. También debe
rechazar un certificado autofirmado de control en `https://localhost:9443`.
La clave de ese control se genera dentro de `/tmp` del contenedor y se elimina
con este. El control no introduce un endpoint de negocio ni un escenario CA.

### Recorridos US1 y US2

Cada proyecto añade registro como cliente, prestador y ambos (con/sin opcionales
y foto), y habilitación con login real. US2 sustituye la sesión fixture de US1:
se registra una cuenta ficticia, se inicia sesión en la misma pantalla y se añade
el perfil faltante conservando su identidad. No se interceptan respuestas API ni
se inyectan tokens. La consulta general de perfil pertenece a US5 y sigue pendiente.

El recorrido de sesiones prueba correo con mayúsculas, cookie Secure/HttpOnly,
recarga/bootstrap y rotación, fechas absolutas y recencia intactas, cierre y rechazo
de credenciales previas. Cada test usa cuentas ficticias con correo UUID exclusivo
en la base local de validación y contextos de navegador aislados. Windows y Linux
ejecutan los mismos cuatro tests por proyecto: 36 en cada entorno. El runner Linux
ya no crea ni monta archivos con sesiones sintéticas; nunca monta `backend.env`,
`fixtures.json` ni claves TLS. Los Bearer permanecen en memoria y no se transmiten
por BroadcastChannel. Web Locks serializa la renovación entre pestañas, y cada
rotación obtiene el CSRF vigente dentro del bloqueo.
No ejecutar dos matrices contra la misma instancia web al medir sus tiempos.
Los tests disponen de 60 segundos, incluida preparación del navegador; no es
un SLA del producto. Se conservan cero reintentos automáticos.
Se desactiva el contexto automático de fallos de Playwright para impedir que
copie los valores de los campos privados; capturas, vídeos y trazas siguen apagados.

`E2E_EVIDENCIA` permite separar las ejecuciones sin cambiar TLS. Para US2 usar
`../.local/evidencia/001/us2/e2e-windows` con el runner Windows y
`../.local/evidencia/001/us2` con Linux (añade `e2e-linux/`). La evidencia de US1
se conserva en su carpeta anterior.

La configuración mantiene `ignoreHTTPSErrors:false`. No se admiten flags que
omitan errores de certificado ni `NODE_TLS_REJECT_UNAUTHORIZED=0`. El runner
comprueba la CA, el certificado servido y sus SAN y verifica que un hostname
ajeno no coincide. Una CA expirada o un certificado incorrecto debe fallar.

### Inspector SameSite de WebKit Windows

Playwright 1.65.1 documenta un fallo esperado al leer `SameSite=Lax` mediante
`context.cookies()` en WebKit nativo Windows: CO-007 espera ese fallo y CO-009
representa el resultado como `None`. Ver [pruebas oficiales de la versión
fijada](https://github.com/microsoft/playwright/blob/v1.65.1/tests/library/browsercontext-cookies.spec.ts#L121-L132).
En la primera matriz Windows de US2, 33/36 pasaron y las tres lecturas nativas
de WebKit detectaron exactamente esta diferencia.

El test exige `Set-Cookie: …; SameSite=Lax` y ausencia de Domain en todos los
proyectos, además de comprobar Secure/HttpOnly/Path y que JavaScript no pueda
leer la cookie. Solo el valor del inspector de WebKit Windows se contrasta con
el comportamiento documentado y se anota como limitación de plataforma. Linux,
Chromium y Firefox deben informar `Lax`. No se omite ningún recorrido, ni se
modifica la política de cookies o la confianza TLS para resolver esa diferencia.

La evidencia ignorada queda en `tecnologia/.local/evidencia/001/e2e-linux/`:
`ejecucion.json`, `tls.json`, `playwright.json`, JUnit y HTML. Registra plataforma,
UID, digest, origen, huellas públicas, vigencia, versiones de navegador y resultado
del control negativo en cada proyecto. Los resultados Linux no acreditan una
ejecución nativa Windows ni los 53 escenarios funcionales de las historias.

## Comprobaciones de claves y fuentes

No exportar ni copiar `ca.key`, `localhost.key`, `backend.env` o `fixtures.json`
a la imagen de pruebas. `.gitignore` excluye `.local/` y los `.env`; el contexto
Docker excluye claves, certificados y reportes. `.gitattributes` conserva LF en
el script shell para construir desde Windows.

Fuentes primarias de la configuración: [imagen oficial de Playwright](https://playwright.dev/docs/docker),
[NSS de Chromium en Linux](https://chromium.googlesource.com/chromium/src.git/+/dd6626cdd58e0ccd306599507de9a47e5a2573e9/docs/linux/cert_management.md),
[políticas de certificados de Firefox](https://firefox-admin-docs.mozilla.org/reference/policies/certificates/)
y [Import-Certificate de Windows](https://learn.microsoft.com/en-us/powershell/module/pki/import-certificate).
El mecanismo de selección de políticas está en las [preferencias de Firefox de Playwright](https://github.com/microsoft/playwright/blob/main/browser_patches/firefox/preferences/playwright.cfg).
