$NpmArgs = $args
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskNode = Join-Path $taskRoot '.local/toolchain/node_modules/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) { $taskNode = (Get-Command node -ErrorAction Stop).Source }
$taskNpmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$taskNpmCli = Join-Path (Split-Path $taskNpmCommand -Parent) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $taskNpmCli)) { throw 'No se encontró npm-cli.js.' }
$env:Path = (Split-Path $taskNode -Parent) + ';' + $env:Path
$taskCa = Join-Path $taskRoot '.local/tls/ca.crt'
if (Test-Path -LiteralPath $taskCa) { $env:NODE_EXTRA_CA_CERTS = $taskCa }
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $taskRoot '.local/ms-playwright'
& $taskNode $taskNpmCli @NpmArgs
exit $LASTEXITCODE
