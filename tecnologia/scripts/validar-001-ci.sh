#!/usr/bin/env bash
set -euo pipefail

raiz=$(cd "$(dirname "$0")/../.." && pwd)
cd "$raiz"
: "${EVIDENCIA_001:?Especifique una carpeta de evidencia por ejecución}"
: "${GITHUB_SHA:?Se requiere el commit que se está verificando}"
mkdir -p "$EVIDENCIA_001"
backend() { npm --prefix tecnologia/backend run "$@"; }
frontend() { npm --prefix tecnologia/frontend run "$@"; }
compose() { docker compose -f tecnologia/compose.yaml "$@"; }
pids=()
limpiar() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  compose --profile web down >/dev/null 2>&1 || true
}
trap limpiar EXIT

backend dev:prepare -- --validation
compose up -d --wait postgres redis correo objetos
backend db:migrate
backend storage:init
backend security:catalog:prepare -- --fixture
backend test:seed

export JEST_JUNIT_OUTPUT_DIR="$EVIDENCIA_001"
JEST_JUNIT_OUTPUT_NAME=u.xml backend test:unit -- --testPathIgnorePatterns prestadores-catalogo
JEST_JUNIT_OUTPUT_NAME=i.xml backend test:integration -- --runInBand --testPathIgnorePatterns prestadores-catalogo
JEST_JUNIT_OUTPUT_NAME=c.xml backend test:contract -- --testPathIgnorePatterns prestadores-catalogo
JEST_JUNIT_OUTPUT_NAME=arquitectura.xml backend test:architecture
frontend test:unit -- --exclude "test/unit/prestadores-catalogo/**" --outputFile.junit="$EVIDENCIA_001/v.xml"
backend test:container

# En Linux el proxy de Compose entra por la interfaz del puente Docker.
gateway=$(docker network inspect bridge --format '{{ (index .IPAM.Config 0).Gateway }}')
command -v socat >/dev/null
for puerto in 3000 5173; do
  socat "TCP-LISTEN:$puerto,bind=$gateway,reuseaddr,fork" "TCP:127.0.0.1:$puerto" &
  pids+=("$!")
done
backend start:validation > "$raiz/tecnologia/.local/api-ci.log" 2>&1 & pids+=("$!")
frontend dev -- --host 127.0.0.1 --mode validation > "$raiz/tecnologia/.local/web-ci.log" 2>&1 & pids+=("$!")
compose --profile web up -d proxy
for intento in {1..30}; do
  if curl --fail --silent --cacert "$NODE_EXTRA_CA_CERTS" https://localhost:8443/api/v1/salud >/dev/null &&
     curl --fail --silent --cacert "$NODE_EXTRA_CA_CERTS" https://localhost:8443/acceso >/dev/null; then break; fi
  sleep 1
done
backend test:proxy
E2E_EVIDENCIA="$EVIDENCIA_001" frontend test:e2e:container -- fundacion usuarios-acceso
VALIDATION_MODE=true SSL_CERT_FILE="$NODE_EXTRA_CA_CERTS" backend test:performance -- --summary-export "$EVIDENCIA_001/k6.json"
npm --silent --prefix tecnologia/backend run test:argon2:coste > "$EVIDENCIA_001/argon2.json"
VALIDATION_MODE=true npm --silent --prefix tecnologia/backend run test:salud -- 2 "$EVIDENCIA_001/salud.jsonl" "$GITHUB_SHA" > "$EVIDENCIA_001/salud-resumen.json"

node --input-type=module <<'EOF'
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const destino = process.env.EVIDENCIA_001;
const r = archivo => resolve(destino, archivo);
writeFileSync(r('manifest.json'), JSON.stringify({
  commit: process.env.GITHUB_SHA, version: process.env.GITHUB_SHA,
  exigirMatrizE: true,
  entorno: 'GitHub Actions ubuntu-24.04, PostgreSQL/Redis/Mailpit/Garage, Playwright Linux con TLS',
  corpus: 'fixture determinista de validación 001',
  reportes: { U: [r('u.xml')], I: [r('i.xml')], C: [r('c.xml')], V: [r('v.xml')], E: [r('e2e-linux/playwright.json')] },
}, null, 2), { flag: 'wx' });
EOF
backend test:coverage:001 -- "$EVIDENCIA_001/manifest.json" "$EVIDENCIA_001/cobertura.json"
