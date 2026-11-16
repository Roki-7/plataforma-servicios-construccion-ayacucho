param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[A-Fa-f0-9]{64}$')]
  [string]$HuellaSha256Esperada
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskCaPath = Join-Path $taskRoot '.local/tls/ca.crt'
$taskOutput = Join-Path $taskRoot '.local/evidencia/001/importacion-ca-windows.json'
$taskResult = [ordered]@{ fechaUtc=[DateTime]::UtcNow.ToString('o'); usuario=$env:USERNAME; almacen='CurrentUser\Root'; resultado='pendiente'; huellaSha256Esperada=$HuellaSha256Esperada.ToUpperInvariant() }
$taskExitCode = 1
try {
  $host.UI.RawUI.WindowTitle = 'Ayacucho: confirmar CA local de desarrollo'
  $taskCa = New-Object Security.Cryptography.X509Certificates.X509Certificate2($taskCaPath)
  $taskHash = [Security.Cryptography.SHA256]::Create()
  try { $taskSha256 = [BitConverter]::ToString($taskHash.ComputeHash($taskCa.RawData)).Replace('-','') }
  finally { $taskHash.Dispose() }
  if ($taskSha256 -ne $HuellaSha256Esperada.ToUpperInvariant()) { throw 'HUELLA_CA_DISTINTA: no se importa un certificado diferente del mostrado.' }
  $taskBasic = $taskCa.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' }
  if (-not $taskBasic -or -not $taskBasic.CertificateAuthority -or $taskCa.Subject -ne $taskCa.Issuer) { throw 'Se requiere la CA raiz local autofirmada.' }
  if ([DateTime]::Now -lt $taskCa.NotBefore -or [DateTime]::Now -ge $taskCa.NotAfter) { throw 'CA_FUERA_DE_VIGENCIA' }
  Write-Host ('CA: ' + $taskCa.Subject)
  Write-Host ('Archivo publico: ' + $taskCaPath)
  Write-Host ('SHA-256: ' + $taskSha256)
  Write-Host ('Huella Windows SHA-1: ' + $taskCa.Thumbprint)
  Write-Host 'Destino: Cert:\CurrentUser\Root. Compare la huella en el aviso de Windows.'
  $taskStorePath = 'Cert:\CurrentUser\Root\' + $taskCa.Thumbprint
  if (-not (Test-Path -LiteralPath $taskStorePath)) {
    Import-Certificate -FilePath $taskCaPath -CertStoreLocation Cert:\CurrentUser\Root -ErrorAction Stop | Out-Null
  }
  $taskInstalled = Get-Item -LiteralPath $taskStorePath -ErrorAction Stop
  if ([Convert]::ToBase64String($taskInstalled.RawData) -ne [Convert]::ToBase64String($taskCa.RawData)) { throw 'El certificado instalado no coincide.' }
  $taskResult.resultado = 'instalada'
  $taskResult.huellaSha1 = $taskCa.Thumbprint
  $taskExitCode = 0
  Write-Host 'CA instalada y verificada. La validacion TLS permanece activa.'
} catch {
  $taskResult.resultado = 'fallida'
  $taskResult.error = $_.Exception.Message
  $taskResult.hresult = ('0x{0:X8}' -f $_.Exception.HResult)
  Write-Host ('No se acredita la instalacion: ' + $_.Exception.Message)
} finally {
  New-Item -ItemType Directory -Force -Path (Split-Path $taskOutput -Parent) | Out-Null
  [IO.File]::WriteAllText($taskOutput, ($taskResult | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
}
exit $taskExitCode
