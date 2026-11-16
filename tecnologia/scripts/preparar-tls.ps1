param([switch]$Confiar)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTls = Join-Path $taskRoot '.local/tls'
New-Item -ItemType Directory -Force -Path $taskTls | Out-Null
$taskOpenSsl = Get-Command openssl -ErrorAction SilentlyContinue
$taskOpenSslPath = if ($taskOpenSsl) { $taskOpenSsl.Source } else { 'C:/Program Files/Git/usr/bin/openssl.exe' }
if (-not (Test-Path -LiteralPath $taskOpenSslPath)) { throw 'Se requiere OpenSSL (también se admite el incluido en Git para Windows).' }
function Invoke-OpenSsl {
  param([string[]]$Arguments)
  # OpenSSL informa progreso por stderr; PowerShell 5 no debe interpretarlo como fallo.
  $ErrorActionPreference = 'Continue'
  & $taskOpenSslPath @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'OpenSSL no pudo completar la operación TLS local.' }
}
$taskCa = Join-Path $taskTls 'ca.crt'
$taskCaKey = Join-Path $taskTls 'ca.key'
$taskLeaf = Join-Path $taskTls 'localhost.crt'
$taskLeafKey = Join-Path $taskTls 'localhost.key'
if (-not (Test-Path -LiteralPath $taskCa)) {
  Invoke-OpenSsl @('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', $taskCaKey, '-out', $taskCa, '-days', '30', '-subj', '/CN=Ayacucho Validacion Local CA')
}
if (-not (Test-Path -LiteralPath $taskLeaf)) {
  $taskCsr = Join-Path $taskTls 'localhost.csr'
  $taskExtensions = Join-Path $taskTls 'localhost.ext'
  'subjectAltName=DNS:localhost,IP:127.0.0.1' | Set-Content -LiteralPath $taskExtensions -Encoding ASCII
  Invoke-OpenSsl @('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', $taskLeafKey, '-out', $taskCsr, '-subj', '/CN=localhost')
  Invoke-OpenSsl @('x509', '-req', '-in', $taskCsr, '-CA', $taskCa, '-CAkey', $taskCaKey, '-CAcreateserial', '-out', $taskLeaf, '-days', '14', '-extfile', $taskExtensions)
}
Invoke-OpenSsl @('verify', '-CAfile', $taskCa, $taskLeaf)
if ($Confiar) { Import-Certificate -FilePath $taskCa -CertStoreLocation Cert:\CurrentUser\Root | Select-Object Thumbprint,Subject }
Write-Output 'TLS local preparado. La confianza del usuario solo se instala con -Confiar.'
