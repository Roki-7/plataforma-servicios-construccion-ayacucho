import { createServer as tcpServer, connect as tcpConnect } from 'node:net';
import { createServer as httpsServer } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { strict as assert } from 'node:assert';

assert.equal(process.platform, 'linux');
assert.notEqual(process.getuid(), 0);
assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0');
assert.equal(process.env.E2E_TLS_NEGATIVAS, 'true');
const ca = await readFile('/validacion/ca.crt');
const autoridad = new X509Certificate(ca);
assert.equal(autoridad.ca, true);
const conexiones = new Set();
// Reenvío TCP: conserva íntegro el handshake TLS, SNI y origen localhost.
const tunel = tcpServer((entrada) => {
  const salida = tcpConnect({ host: 'proxy', port: 8443 });
  for (const socket of [entrada, salida]) { conexiones.add(socket); socket.on('close', () => conexiones.delete(socket)); }
  entrada.on('error', () => salida.destroy()); salida.on('error', () => entrada.destroy());
  entrada.pipe(salida).pipe(entrada);
});
await new Promise((ok, no) => { tunel.once('error', no); tunel.listen(8443, '127.0.0.1', ok); });
// localhost puede resolver primero a ::1. El túnel solo existe en este contenedor.
const tunelV6 = tcpServer((entrada) => {
  const salida = tcpConnect({ host: '127.0.0.1', port: 8443 });
  for (const socket of [entrada, salida]) { conexiones.add(socket); socket.on('close', () => conexiones.delete(socket)); }
  entrada.on('error', () => salida.destroy()); salida.on('error', () => entrada.destroy());
  entrada.pipe(salida).pipe(entrada);
});
await new Promise((ok, no) => { tunelV6.once('error', no); tunelV6.listen({ port: 8443, host: '::1', ipv6Only: true }, ok); });
const evidencia = process.env.E2E_EVIDENCIA;
assert.ok(evidencia);
const carpetaControl = await mkdtemp(join(tmpdir(), 'ayacucho-tls-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(carpetaControl, 'control.key'), '-out', join(carpetaControl, 'control.crt'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
const noConfiable = httpsServer({ key: await readFile(join(carpetaControl, 'control.key')), cert: await readFile(join(carpetaControl, 'control.crt')) }, (_req, res) => res.end('Control técnico sin datos.'));
await new Promise((ok, no) => { noConfiable.once('error', no); noConfiable.listen(9443, '::', ok); });
try {
  const certificado = await new Promise((ok, no) => {
    const socket = tlsConnect({ host: 'localhost', port: 8443, servername: 'localhost', ca, rejectUnauthorized: true }, () => {
      const certificado = new X509Certificate(socket.getPeerCertificate().raw); socket.end(); ok(certificado);
    });
    socket.setTimeout(15000, () => socket.destroy(new Error('TLS_TIEMPO_AGOTADO'))); socket.once('error', no);
  });
  assert.equal(certificado.checkIssued(autoridad), true);
  assert.equal(certificado.checkHost('localhost'), 'localhost');
  assert.equal(certificado.checkIP('127.0.0.1'), '127.0.0.1');
  assert.equal(certificado.checkHost('ajeno.example.invalid'), undefined);
  await mkdir(evidencia, { recursive: true });
  await writeFile(join(evidencia, 'tls.json'), JSON.stringify({ fecha: new Date().toISOString(), plataforma: process.platform, arquitectura: process.arch, node: process.version, uid: process.getuid(), origen: 'https://localhost:8443', caSha256: autoridad.fingerprint256, servidorSha256: certificado.fingerprint256, validoDesde: certificado.validFrom, validoHasta: certificado.validTo, san: certificado.subjectAltName, rechazaHostnameAjeno: true, confianza: { chromium: 'NSS usuario M146+', firefox: 'Certificates.Install en perfiles efímeros', webkit: 'CA del sistema del contenedor', node: 'CA explícita' }, montaje: 'Solo ca.crt pública; ninguna clave privada del host' }, null, 2));
  const codigo = await new Promise((ok, no) => {
    const proceso = spawn('npm', ['run', 'test:e2e', '--', '--workers=1', ...process.argv.slice(2)], { stdio: 'inherit' });
    proceso.once('error', no); proceso.once('exit', (codigo) => ok(codigo ?? 1));
  });
  process.exitCode = codigo;
} finally {
  for (const socket of conexiones) socket.destroy();
  tunel.close(); tunelV6.close(); noConfiable.close();
}
