param([switch]$ExigirConfianzaWindows, [string]$Evidencia)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTls = Join-Path $taskRoot '.local/tls'
$taskCaPath = Join-Path $taskTls 'ca.crt'
$taskLeafPath = Join-Path $taskTls 'localhost.crt'
$taskCa = New-Object Security.Cryptography.X509Certificates.X509Certificate2($taskCaPath)
$taskLeaf = New-Object Security.Cryptography.X509Certificates.X509Certificate2($taskLeafPath)
$taskNow = [DateTime]::UtcNow
foreach ($taskCert in @($taskCa, $taskLeaf)) {
  if ($taskNow -lt $taskCert.NotBefore.ToUniversalTime() -or $taskNow -ge $taskCert.NotAfter.ToUniversalTime()) { throw 'CERTIFICADO_FUERA_DE_VIGENCIA: renueve los certificados locales antes de continuar.' }
}
$taskOpenSslCommand = Get-Command openssl -ErrorAction SilentlyContinue
$taskOpenSsl = if ($taskOpenSslCommand) { $taskOpenSslCommand.Source } else { 'C:/Program Files/Git/usr/bin/openssl.exe' }
foreach ($taskHostArgs in @(@('-verify_hostname', 'localhost'), @('-verify_ip', '127.0.0.1'))) {
  & $taskOpenSsl verify -purpose sslserver @taskHostArgs -CAfile $taskCaPath $taskLeafPath
  if ($LASTEXITCODE -ne 0) { throw 'CADENA_O_HOSTNAME_NO_VALIDO' }
}
$taskUserTrusted = Test-Path ('Cert:/CurrentUser/Root/' + $taskCa.Thumbprint)
$taskMachineTrusted = Test-Path ('Cert:/LocalMachine/Root/' + $taskCa.Thumbprint)
$taskResult = [ordered]@{
  fechaUtc = $taskNow.ToString('o'); plataforma = 'Windows'; origen = 'https://localhost:8443'
  cadenaOpenSsl = 'valida'; hostnameLocalhost = 'valido'; ip127001 = 'valida'
  ca = @{ sujeto=$taskCa.Subject; huellaSha1=$taskCa.Thumbprint; desdeUtc=$taskCa.NotBefore.ToUniversalTime().ToString('o'); hastaUtc=$taskCa.NotAfter.ToUniversalTime().ToString('o') }
  servidor = @{ emisor=$taskLeaf.Issuer; huellaSha1=$taskLeaf.Thumbprint; desdeUtc=$taskLeaf.NotBefore.ToUniversalTime().ToString('o'); hastaUtc=$taskLeaf.NotAfter.ToUniversalTime().ToString('o') }
  confianzaWindows = @{ CurrentUserRoot=$taskUserTrusted; LocalMachineRoot=$taskMachineTrusted }
  alcance = 'Solo lectura de certificados publicos y confianza; no modifica almacenes'
}
$taskOutput = if ($Evidencia) { $Evidencia } else { Join-Path $taskRoot '.local/evidencia/001' }
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskJson = $taskResult | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $taskOutput 'diagnostico-tls-windows.json'), $taskJson, (New-Object Text.UTF8Encoding($false)))
$taskJson
if ($ExigirConfianzaWindows -and -not ($taskUserTrusted -or $taskMachineTrusted)) { throw 'CA_WINDOWS_NO_CONFIABLE: Windows debe aceptar la CA publica local para ejecutar navegadores nativos.' }
