import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, access, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID, X509Certificate } from 'node:crypto';
import { strict as assert } from 'node:assert';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(frontend, '../.local');
const ca = resolve(local, 'tls/ca.crt');
const evidencia = resolve(process.env.E2E_EVIDENCIA ?? resolve(local, 'evidencia/001'));
const imagen = 'ayacucho-001-e2e:fundacion';
const marca = randomUUID(); const nombre = `ayacucho-001-e2e-${marca}`;
await access(ca); await mkdir(resolve(evidencia, 'e2e-linux'), { recursive: true });
function docker(args, opciones = {}) {
  const resultado = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, ...opciones });
  if (resultado.error) throw resultado.error;
  return resultado;
}
const sinConstruir = process.argv.includes('--sin-construir');
if (!sinConstruir) {
  const log = openSync(resolve(local, 'e2e-build.log'), 'w', 0o600);
  try {
    const construccion = docker(['build', '--progress=plain', '-f', resolve(frontend, 'Dockerfile.e2e'), '-t', imagen, frontend], { stdio: ['ignore', log, log] });
    assert.equal(construccion.status, 0, 'Falló la construcción; consulte .local/e2e-build.log.');
  } finally { closeSync(log); }
}
const inspeccion = docker(['image', 'inspect', imagen, '--format', '{{.Id}}']);
assert.equal(inspeccion.status, 0, 'No existe la imagen de navegadores.');
const fecha = new Date().toISOString(); let codigo = 1;
try {
  const resultado = docker(['run', '--init', '--name', nombre, '--label', `ayacucho.e2e=${marca}`, '--network', 'ayacucho-001-validacion_default', '--shm-size=1g',
    '--mount', `type=bind,source=${ca},target=/validacion/ca.crt,readonly`,
    '--mount', `type=bind,source=${evidencia},target=/app/.local/evidencia/001`,
    imagen, ...process.argv.slice(2).filter((arg) => arg !== '--sin-construir')], { stdio: 'inherit' });
  codigo = resultado.status ?? 1;
  if (codigo === 0) {
    const tls = JSON.parse(await readFile(resolve(evidencia, 'e2e-linux/tls.json'), 'utf8'));
    assert.ok(tls.fecha >= fecha, 'La evidencia TLS debe pertenecer a esta ejecución.');
    assert.equal(tls.caSha256, new X509Certificate(await readFile(ca)).fingerprint256);
    assert.equal(tls.servidorSha256, new X509Certificate(await readFile(resolve(local, 'tls/localhost.crt'))).fingerprint256);
  }
  await writeFile(resolve(evidencia, 'e2e-linux/ejecucion.json'), JSON.stringify({ fecha, imagen, digest: inspeccion.stdout.trim(), plataformaNavegadores: 'linux', origen: 'https://localhost:8443', resultado: codigo, ca: 'Certificado público readonly; sin claves TLS ni env del host', autenticacion: 'Registro y login reales con datos ficticios; sin montar credenciales', puertosPublicados: false }, null, 2));
} finally {
  const etiqueta = docker(['inspect', '--format', '{{index .Config.Labels "ayacucho.e2e"}}', nombre]);
  if (etiqueta.status === 0 && etiqueta.stdout.trim() === marca && nombre === `ayacucho-001-e2e-${marca}`) {
    assert.equal(docker(['rm', '-f', nombre]).status, 0, 'No se pudo retirar el contenedor efímero.');
  }
}
process.exitCode = codigo;
