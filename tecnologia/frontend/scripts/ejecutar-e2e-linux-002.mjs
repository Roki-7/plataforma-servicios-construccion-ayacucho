// T075 · Lado del contenedor del ejecutor 002: túnel TCP localhost:8444 -> proxy:8444 (conserva íntegro el handshake TLS y el SNI),
// control de certificado no confiable en 9443 y ejecución de Playwright con la configuración 002.
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
const evidencia = process.env.E2E_EVIDENCIA; assert.ok(evidencia);
const ca = await readFile('/validacion/ca.crt');
const autoridad = new X509Certificate(ca);
assert.equal(autoridad.ca, true);
const conexiones = new Set();
const reenviar = (destino) => (entrada) => {
  const salida = tcpConnect(destino);
  for (const socket of [entrada, salida]) { conexiones.add(socket); socket.on('close', () => conexiones.delete(socket)); }
  entrada.on('error', () => salida.destroy()); salida.on('error', () => entrada.destroy());
  entrada.pipe(salida).pipe(entrada);
};
const tunel = tcpServer(reenviar({ host: 'proxy', port: 8444 }));
await new Promise((ok, no) => { tunel.once('error', no); tunel.listen(8444, '127.0.0.1', ok); });
// localhost puede resolver primero a ::1. El túnel solo existe en este contenedor.
const tunelV6 = tcpServer(reenviar({ host: '127.0.0.1', port: 8444 }));
await new Promise((ok, no) => { tunelV6.once('error', no); tunelV6.listen({ port: 8444, host: '::1', ipv6Only: true }, ok); });
const carpetaControl = await mkdtemp(join(tmpdir(), 'ayacucho-tls-002-'));
const certControl = join(carpetaControl, 'control.crt');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(carpetaControl, 'control.key'), '-out', certControl, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'pipe' });
const noConfiable = httpsServer({ key: await readFile(join(carpetaControl, 'control.key')), cert: await readFile(certControl) }, (_req, res) => res.end('Control técnico sin datos.'));
await new Promise((ok, no) => { noConfiable.once('error', no); noConfiable.listen(9443, '::', ok); });
try {
  const certificado = await new Promise((ok, no) => {
    const socket = tlsConnect({ host: 'localhost', port: 8444, servername: 'localhost', ca, rejectUnauthorized: true }, () => { const c = new X509Certificate(socket.getPeerCertificate().raw); socket.end(); ok(c); });
    socket.setTimeout(15000, () => socket.destroy(new Error('TLS_TIEMPO_AGOTADO'))); socket.once('error', no);
  });
  assert.equal(certificado.checkIssued(autoridad), true);
  assert.equal(certificado.checkHost('localhost'), 'localhost');
  assert.equal(certificado.checkIP('127.0.0.1'), '127.0.0.1');
  assert.equal(certificado.checkHost('ajeno.example.invalid'), undefined);
  await mkdir(evidencia, { recursive: true });
  await writeFile(join(evidencia, 'tls-002.json'), JSON.stringify({ fecha: new Date().toISOString(), plataforma: process.platform, arquitectura: process.arch, node: process.version, uid: process.getuid(), origen: 'https://localhost:8444', caSha256: autoridad.fingerprint256, servidorSha256: certificado.fingerprint256, controlNoConfiableSha256: new X509Certificate(await readFile(certControl)).fingerprint256 }, null, 2));
  const codigo = await new Promise((ok, no) => {
    const proceso = spawn('npx', ['playwright', 'test', '-c', 'playwright.002.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
    proceso.once('error', no); proceso.once('exit', (c) => ok(c ?? 1));
  });
  process.exitCode = codigo;
} finally {
  for (const socket of conexiones) socket.destroy();
  tunel.close(); tunelV6.close(); noConfiable.close();
}
