#!/usr/bin/env bash
set -euo pipefail
umask 077

destino=$(cd "$(dirname "$0")/.." && pwd)/.local/tls
mkdir -p "$destino"
if [[ -s "$destino/ca.crt" && -s "$destino/localhost.crt" && -s "$destino/localhost.key" ]]; then
  exit 0
fi
if [[ -e "$destino/ca.crt" || -e "$destino/localhost.crt" || -e "$destino/localhost.key" ]]; then
  echo 'La configuración TLS existente está incompleta.' >&2
  exit 1
fi

temporal=$(mktemp -d "$destino/.provision-XXXXXX")
trap 'rm -f -- "$temporal/ca-key.pem" "$temporal/ca.pem" "$temporal/ca.srl" "$temporal/localhost-key.pem" "$temporal/localhost.csr" "$temporal/localhost.pem" "$temporal/localhost.ext"; rmdir -- "$temporal"' EXIT
openssl req -x509 -newkey rsa:3072 -noenc -sha256 -days 30 \
  -subj '/CN=Ayacucho CA de validacion' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -keyout "$temporal/ca-key.pem" -out "$temporal/ca.pem"
openssl req -new -newkey rsa:2048 -noenc -subj '/CN=localhost' \
  -keyout "$temporal/localhost-key.pem" -out "$temporal/localhost.csr"
cat > "$temporal/localhost.ext" <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1
EOF
openssl x509 -req -sha256 -days 15 -CA "$temporal/ca.pem" -CAkey "$temporal/ca-key.pem" \
  -CAcreateserial -extfile "$temporal/localhost.ext" -in "$temporal/localhost.csr" -out "$temporal/localhost.pem"
install -m 644 "$temporal/ca.pem" "$destino/ca.crt"
install -m 644 "$temporal/localhost.pem" "$destino/localhost.crt"
install -m 600 "$temporal/localhost-key.pem" "$destino/localhost.key"
