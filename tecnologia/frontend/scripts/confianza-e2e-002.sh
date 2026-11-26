#!/usr/bin/env bash
# T075 · Confianza TLS del ejecutor de navegadores de la 002 (dentro del contenedor efímero). Instala SOLO la CA 002.
set -euo pipefail
test -f /validacion/ca.crt
openssl x509 -in /validacion/ca.crt -checkend 0 -noout
openssl verify -CAfile /validacion/ca.crt /validacion/ca.crt
openssl x509 -in /validacion/ca.crt -noout -subject | grep -q 'Ayacucho Validacion Local 002 CA'
install -m 0644 /validacion/ca.crt /usr/local/share/ca-certificates/ayacucho-002.crt
update-ca-certificates

# Chromium usa esta NSS Shared DB; no se cambia el almacén del host.
install -d -o pwuser -g pwuser /home/pwuser/.local/share/pki/nssdb
runuser -u pwuser -- certutil -d sql:/home/pwuser/.local/share/pki/nssdb -N --empty-password
runuser -u pwuser -- certutil -d sql:/home/pwuser/.local/share/pki/nssdb -A -n ayacucho-002 -t 'C,,' -i /validacion/ca.crt
runuser -u pwuser -- certutil -d sql:/home/pwuser/.local/share/pki/nssdb -V -n ayacucho-002 -u L

# La distribución Firefox de Playwright lee la política desde esta variable; WebKit usa el almacén del sistema.
export PLAYWRIGHT_FIREFOX_POLICIES_JSON=/tmp/ayacucho-firefox-policies.json
node --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.PLAYWRIGHT_FIREFOX_POLICIES_JSON, JSON.stringify({ policies: { Certificates: { Install: ['/validacion/ca.crt'] } } }));
JS

exec runuser -u pwuser -- env HOME=/home/pwuser node scripts/ejecutar-e2e-linux-002.mjs "$@"
