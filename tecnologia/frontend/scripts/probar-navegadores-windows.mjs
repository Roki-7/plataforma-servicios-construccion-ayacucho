import { strict as assert } from 'node:assert';
import { X509Certificate } from 'node:crypto';
import { createServer } from 'node:https';
import { connect } from 'node:tls';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, mkdir, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'win32', 'Este ejecutor requiere Windows nativo.');
assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0');
assert.ok(process.env.npm_execpath, 'Ejecute mediante npm run test:e2e:windows.');
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(frontend, '../.local');
const evidencia = resolve(process.env.E2E_EVIDENCIA ?? resolve(local, 'evidencia/001/e2e-windows-native'));
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(frontend, '../scripts/diagnosticar-tls.ps1'), '-ExigirConfianzaWindows'], { stdio: 'inherit' });
const caPath = resolve(local, 'tls/ca.crt');
const ca = new X509Certificate(await readFile(caPath));
const esperado = new X509Certificate(await readFile(resolve(local, 'tls/localhost.crt')));
const servido = await new Promise((ok, no) => {
  const socket = connect({ host: 'localhost', port: 8443, servername: 'localhost', ca: ca.toString(), rejectUnauthorized: true }, () => {
    const certificado = new X509Certificate(socket.getPeerCertificate().raw); socket.end(); ok(certificado);
  });
  socket.setTimeout(15000, () => socket.destroy(new Error('TLS_TIEMPO_AGOTADO'))); socket.once('error', no);
});
assert.equal(servido.fingerprint256, esperado.fingerprint256);
assert.equal(servido.checkIssued(ca), true); assert.equal(servido.verify(ca.publicKey), true);
assert.equal(servido.checkHost('localhost'), 'localhost'); assert.equal(servido.checkIP('127.0.0.1'), '127.0.0.1');
assert.equal(servido.checkHost('ajeno.example.invalid'), undefined);

const baseControl = resolve(local, 'tls-controles'); await mkdir(baseControl, { recursive: true });
const carpetaControl = await mkdtemp(join(baseControl, 'windows-'));
assert.ok(carpetaControl.startsWith(baseControl + sep));
const claveControl = join(carpetaControl, 'control.key'); const certControl = join(carpetaControl, 'control.crt');
const servidores = []; const sockets = new Set(); let codigo = 1;
const fecha = new Date().toISOString();
try {
  const openssl = existsSync('C:/Program Files/Git/usr/bin/openssl.exe') ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', claveControl, '-out', certControl, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  const clave = await readFile(claveControl); const certificadoControl = await readFile(certControl);
  assert.notEqual(new X509Certificate(certificadoControl).fingerprint256, ca.fingerprint256);
  for (const direccion of ['127.0.0.1', '::1']) {
    const servidor = createServer({ key: clave, cert: certificadoControl }, (_req, res) => res.end('Control tecnico sin datos.'));
    servidores.push(servidor);
    servidor.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise((ok, no) => { servidor.once('error', no); servidor.listen({ port: 9443, host: direccion, ipv6Only: direccion === '::1' }, ok); });
  }
  await mkdir(evidencia, { recursive: true });
  const env = { ...process.env, E2E_EVIDENCIA: evidencia, E2E_TLS_NEGATIVAS: 'true', NODE_EXTRA_CA_CERTS: caPath };
  codigo = await new Promise((ok, no) => {
    const proceso = spawn(process.execPath, [process.env.npm_execpath, 'run', 'test:e2e', '--', '--workers=1', ...process.argv.slice(2)], { cwd: frontend, env, stdio: 'inherit' });
    proceso.once('error', no); proceso.once('exit', (estado) => ok(estado ?? 1));
  });
  await writeFile(join(evidencia, 'ejecucion.json'), JSON.stringify({ fecha, plataforma: process.platform, arquitectura: process.arch, node: process.version, resultado: codigo, origen: 'https://localhost:8443', caSha256: ca.fingerprint256, servidorSha256: servido.fingerprint256, san: servido.subjectAltName, controlesTLSNegativos: true, servidorControl: 'Solo loopback IPv4/IPv6:9443; CA de control no instalada', claves: 'Control efimero en .local, eliminado al terminar; no se usan claves privadas del proyecto' }, null, 2));
} finally {
  for (const socket of sockets) socket.destroy();
  await Promise.all(servidores.map((servidor) => new Promise((ok) => servidor.close(ok))));
  if (carpetaControl.startsWith(baseControl + sep)) {
    for (const archivo of [claveControl, certControl]) await unlink(archivo).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(carpetaControl);
  }
}
process.exitCode = codigo;
