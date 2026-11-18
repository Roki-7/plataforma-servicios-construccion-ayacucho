import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { platform } from 'node:os';
import { connect } from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { cargarLocal, local, tecnologia } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';
import type { Configuracion } from '../src/composicion/configuracion.js';
import { crearAplicacion } from '../src/composicion/app.module.js';
import { persistenciaFundacional } from '../src/composicion/persistencia.js';
import { PRIVACIDAD_VERSION } from '../src/modulos/usuarios-acceso/dominio/cuenta.js';

const usuario = 'ayacucho_validacion';
const base = 'ayacucho_001_validacion';
const bucket = 'usuarios-validacion';
const marca = randomUUID();
const prefijo = `ayacucho-001-t117-${marca}`;
const contenedores: string[] = [];
const archivos: string[] = [];
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function invocarDocker(args: string[], input?: Buffer) {
  return spawnSync('docker', args, { input, timeout: 45000, maxBuffer: 32 * 1024 * 1024 });
}

function docker(args: string[], input?: Buffer): Buffer {
  const r = invocarDocker(args, input);
  assert.equal(r.status, 0, `Docker ${args[0]} ${args[0] === 'exec' ? args[2] : ''}`);
  return r.stdout;
}

async function archivoTemporal(ruta: string, contenido: string | Buffer): Promise<void> {
  archivos.push(ruta);
  await writeFile(ruta, contenido, { flag: 'wx', mode: 0o600 });
}

function puertoLocal(nombre: string, puerto: number): string {
  const publicado = docker(['port', nombre, `${puerto}/tcp`]).toString().trim();
  const local = /^127\.0\.0\.1:(\d+)$/.exec(publicado)?.[1];
  assert.ok(local, 'El puerto del ensayo debe estar limitado a loopback');
  return local;
}

async function esperarServicios(postgres: string, garage: string): Promise<void> {
  for (let i = 0; i < 45; i++) {
    if (invocarDocker(['exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', usuario, '-d', base]).status === 0 &&
        invocarDocker(['exec', garage, '/garage', 'status']).status === 0) return;
    await esperar(1000);
  }
  throw new Error('Servicios del ensayo fuera de disponibilidad');
}

function aceptaConexion(puerto: string): Promise<boolean> {
  return new Promise(resolver => {
    const socket = connect({ host: '127.0.0.1', port: Number(puerto) });
    const terminar = (listo: boolean) => { socket.destroy(); resolver(listo); };
    socket.once('connect', () => terminar(true));
    socket.once('error', () => terminar(false));
    socket.setTimeout(1000, () => terminar(false));
  });
}

async function puertosPublicados(postgres: string, garage: string) {
  await esperarServicios(postgres, garage);
  const puertos = { postgres: puertoLocal(postgres, 5432), garage: puertoLocal(garage, 3900) };
  for (let i = 0; i < 30; i++) {
    if ((await Promise.all(Object.values(puertos).map(aceptaConexion))).every(Boolean)) return puertos;
    await esperar(1000);
  }
  throw new Error('Los puertos aislados todavía no aceptan conexiones del host');
}

async function iniciar(nombre: 'origen' | 'destino', temporal: string, config: Configuracion, imagenes: { postgres: string; garage: string }) {
  const postgres = `${prefijo}-${nombre}-postgres`;
  const garage = `${prefijo}-${nombre}-garage`;
  const contrasena = randomBytes(24).toString('hex');
  const accessKeyId = 'GK' + randomBytes(16).toString('hex');
  const secretAccessKey = randomBytes(32).toString('hex');
  const envPg = resolve(temporal, `${nombre}-postgres.env`);
  const envS3 = resolve(temporal, `${nombre}-garage.env`);
  await archivoTemporal(envPg, `POSTGRES_USER=${usuario}\nPOSTGRES_DB=${base}\nPOSTGRES_PASSWORD=${contrasena}\n`);
  await archivoTemporal(envS3, `GARAGE_RPC_SECRET=${randomBytes(32).toString('hex')}\nGARAGE_DEFAULT_ACCESS_KEY=${accessKeyId}\nGARAGE_DEFAULT_SECRET_KEY=${secretAccessKey}\nGARAGE_DEFAULT_BUCKET=${bucket}\n`);
  contenedores.push(postgres, garage);
  const etiqueta = ['--label', `ayacucho.t117=${marca}`];
  docker(['run', '-d', '--name', postgres, ...etiqueta, '--publish', '127.0.0.1::5432', '--env-file', envPg, imagenes.postgres]);
  docker(['run', '-d', '--name', garage, ...etiqueta, '--publish', '127.0.0.1::3900', '--env-file', envS3,
    '--mount', `type=bind,source=${resolve(tecnologia, 'infra/garage.toml')},target=/etc/garage.toml,readonly`, imagenes.garage,
    '/garage', 'server', '--single-node', '--default-bucket']);
  const puertos = await puertosPublicados(postgres, garage);
  const configuracion: Configuracion = {
    ...config,
    databaseUrl: `postgresql://${usuario}:${contrasena}@127.0.0.1:${puertos.postgres}/${base}`,
    s3: { endpoint: `http://127.0.0.1:${puertos.garage}`, region: 'garage', bucket, accessKeyId, secretAccessKey },
  };
  return { postgres, garage, configuracion, puertos };
}

async function migrar(databaseUrl: string): Promise<number> {
  const db = persistenciaFundacional(databaseUrl);
  await db.initialize();
  try {
    const aplicadas = await db.runMigrations({ transaction: 'each' });
    assert.equal(await db.showMigrations(), false, 'Migraciones pendientes');
    return aplicadas.length;
  } finally { await db.destroy(); }
}

async function conAplicacion<T>(config: Configuracion, operar: (app: Awaited<ReturnType<typeof crearAplicacion>>, url: string) => Promise<T>): Promise<T> {
  const app = await crearAplicacion(config, { worker: false });
  try {
    await app.app.listen(0, '127.0.0.1');
    return await operar(app, await app.app.getUrl());
  } finally { await app.app.close(); }
}

async function peticion<T>(url: string, ruta: string, estado: number, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${url}/api/v1${ruta}`, { ...opciones, signal: AbortSignal.timeout(10000) });
  assert.equal(respuesta.status, estado, `HTTP esperado en ${ruta}`);
  return await respuesta.json() as T;
}

async function principal(): Promise<void> {
  cargarLocal();
  const config = cargarConfiguracion();
  assert.equal(config.validacion, true, 'Solo demostración aislada');
  assert.ok(process.argv[2], 'Indique una ruta nueva para el resultado JSON');
  assert.equal(docker(['info', '--format', '{{.OSType}}']).toString().trim(), 'linux');
  const imagenesCompose = docker(['compose', '-f', resolve(tecnologia, 'compose.yaml'), 'config', '--images']).toString().trim().split(/\s+/);
  const postgres = imagenesCompose.find(i => /^postgres:18@sha256:[a-f0-9]{64}$/.test(i));
  const garage = imagenesCompose.find(i => /^dxflrs\/garage:[^@]+@sha256:[a-f0-9]{64}$/.test(i));
  assert.ok(postgres && garage, 'Use las imágenes fijadas de la demostración');
  const imagenes = { postgres, garage };
  const temporal = await mkdtemp(resolve(local, 't117-'));
  const salida = resolve(process.argv[2]);
  const correo = `${marca}@example.invalid`;
  const contrasena = ' frase ficticia respaldo t117 ';
  const post = (datos: object) => ({ method: 'POST', headers: { Origin: config.origen, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(datos) });
  const sesion = async (url: string) => {
    const login = await peticion<{ tokenAcceso: string }>(url, '/sesiones', 200, post({ correo, contrasena }));
    assert.ok(login.tokenAcceso, 'El titular debe poder iniciar sesión');
    return { headers: { Authorization: `Bearer ${login.tokenAcceso}` } };
  };
  const pasos: string[] = [];
  let resultado: Record<string, unknown>;
  try {
    const origen = await iniciar('origen', temporal, config, imagenes);
    process.stdout.write('Origen aislado listo. Aplicando migraciones.\n');
    const aplicadas = await migrar(origen.configuracion.databaseUrl);
    assert.ok(aplicadas > 0, 'Se deben aplicar migraciones en la base nueva');
    pasos.push('Migrar PostgreSQL de origen con el DataSource de 001');
    const original = await conAplicacion(origen.configuracion, async (a, url) => {
      const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
      await peticion(url, '/salud', 200);
      await peticion(url, '/cuentas', 201, post({ correo, contrasena, confirmacionContrasena: contrasena, nombreMostrar: 'Cuenta ficticia T117',
        perfiles: ['cliente', 'prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION,
        fotografia: { tipoContenido: 'image/png', contenidoBase64: bytes.toString('base64') } }));
      const acceso = await sesion(url);
      const perfil = await peticion<{ fotografiaId: string; nombreMostrar: string }>(url, '/perfil', 200, acceso);
      assert.equal(perfil.nombreMostrar, 'Cuenta ficticia T117');
      assert.ok(perfil.fotografiaId, 'El perfil debe referenciar una foto');
      const [referencia] = await a.db.query('SELECT objeto_clave, mime, checksum FROM fotografias_perfil WHERE id=$1 AND estado=$2', [perfil.fotografiaId, 'activa']) as { objeto_clave: string; mime: string; checksum: Buffer }[];
      assert.ok(referencia, 'Referencia activa de foto');
      const objeto = await a.fotos.cliente.send(new GetObjectCommand({ Bucket: bucket, Key: referencia.objeto_clave }));
      assert.ok(objeto.Body, 'Objeto de respaldo disponible');
      const respaldo = Buffer.from(await objeto.Body.transformToByteArray());
      assert.equal(sha256(respaldo), referencia.checksum.toString('hex'));
      return { perfil, referencia, respaldo };
    });
    const binario = docker(['exec', origen.postgres, 'pg_dump', '-U', usuario, '-d', base, '--format=custom', '--no-owner', '--no-acl']);
    assert.equal(binario.subarray(0, 5).toString(), 'PGDMP');
    const dump = resolve(temporal, 'postgres.dump');
    const foto = resolve(temporal, 'fotografia.bin');
    await archivoTemporal(dump, binario);
    await archivoTemporal(foto, original.respaldo);
    pasos.push('pg_dump --format=custom --no-owner --no-acl y GET autenticado del objeto de Garage');
    process.stdout.write('Respaldos creados. Reiniciando PostgreSQL y Garage del origen.\n');

    const rutaFoto = `/perfil/fotografias/${original.perfil.fotografiaId}`;
    const verificarFoto = async (url: string, acceso: RequestInit) => {
      const r = await peticion<{ contenidoBase64: string; tipoContenido: string }>(url, rutaFoto, 200, acceso);
      assert.equal(sha256(Buffer.from(r.contenidoBase64, 'base64')), sha256(original.respaldo));
      assert.equal(r.tipoContenido, original.referencia.mime);
    };
    docker(['stop', origen.postgres, origen.garage]);
    for (const nombre of [origen.postgres, origen.garage]) {
      assert.equal(docker(['inspect', '--format', '{{.State.Running}}', nombre]).toString().trim(), 'false');
    }
    docker(['start', origen.postgres, origen.garage]);
    const trasReinicio = await puertosPublicados(origen.postgres, origen.garage);
    const urlPg = new URL(origen.configuracion.databaseUrl);
    urlPg.port = trasReinicio.postgres;
    origen.configuracion.databaseUrl = urlPg.href;
    origen.configuracion.s3.endpoint = `http://127.0.0.1:${trasReinicio.garage}`;
    const migracionesReinicio = await migrar(origen.configuracion.databaseUrl);
    assert.equal(migracionesReinicio, 0);
    await conAplicacion(origen.configuracion, async (_a, url) => {
      await peticion(url, '/salud', 200);
      const acceso = await sesion(url);
      assert.deepEqual(await peticion(url, '/perfil', 200, acceso), original.perfil);
      await verificarFoto(url, acceso);
    });
    pasos.push('docker stop y docker start de ambos servicios de origen, migración idempotente y lectura del perfil y la foto');
    // El origen permanece detenido durante la restauración para comprobar independencia.
    docker(['stop', origen.postgres, origen.garage]);
    process.stdout.write('Reinicio verificado. Restaurando en PostgreSQL y Garage vacíos.\n');
    const destino = await iniciar('destino', temporal, config, imagenes);
    const vacio = docker(['exec', destino.postgres, 'psql', '-U', usuario, '-d', base, '-Atc', "SELECT to_regclass('usuarios') IS NULL"]).toString().trim();
    assert.equal(vacio, 't', 'La base de destino debe estar vacía');
    docker(['exec', '-i', destino.postgres, 'pg_restore', '-U', usuario, '-d', base, '--exit-on-error', '--no-owner', '--no-acl'], await readFile(dump));
    const migracionesRestauracion = await migrar(destino.configuracion.databaseUrl);
    assert.equal(migracionesRestauracion, 0);
    await conAplicacion(destino.configuracion, async (a, url) => {
      await peticion(url, '/salud', 200);
      const acceso = await sesion(url);
      assert.deepEqual(await peticion(url, '/perfil', 200, acceso), original.perfil);
      const listado = await a.fotos.cliente.send(new ListObjectsV2Command({ Bucket: bucket }));
      assert.equal(listado.KeyCount, 0, 'El bucket de destino debe estar vacío');
      await peticion(url, rutaFoto, 503, acceso);
      const clave = original.referencia.objeto_clave;
      await a.fotos.cliente.send(new PutObjectCommand({ Bucket: bucket, Key: clave, Body: await readFile(foto), ContentType: original.referencia.mime }));
      await verificarFoto(url, acceso);
      await peticion(url, rutaFoto, 401);
      const sinCredenciales = await fetch(`${destino.configuracion.s3.endpoint}/${bucket}/${clave}`, { signal: AbortSignal.timeout(10000) });
      assert.equal(sinCredenciales.status, 403, 'El objeto restaurado debe seguir privado');
      await sinCredenciales.arrayBuffer();
    });
    pasos.push('pg_restore --exit-on-error en PostgreSQL vacío y restauración del objeto privado en Garage vacío con el origen detenido');

    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: tecnologia, encoding: 'utf8' });
    assert.equal(commit.status, 0, 'Identificación de la revisión local');
    resultado = { fecha: new Date().toISOString(), commit: commit.stdout.trim(), ejecutorSha256: sha256(await readFile(new URL(import.meta.url))), plataforma: platform(), node: process.version, imagenes,
      corpus: 'fixture de validación 001', pasos, migraciones: { aplicadas, trasReinicio: migracionesReinicio, trasRestauracion: migracionesRestauracion },
      puertosOrigen: { arranque: origen.puertos, trasReinicio },
      respaldo: { postgresSha256: sha256(binario), postgresBytes: binario.length, fotoSha256: sha256(original.respaldo), fotoBytes: original.respaldo.length },
      http: { salud: [200, 200, 200], fotoSinObjeto: 503, fotoRestauradaTitular: 200, fotoSinSesion: 401, objetoAnonimo: 403 } };
  } finally {
    for (const nombre of contenedores) {
      const propiedad = invocarDocker(['inspect', '--format', '{{json .Config.Labels}}', nombre]);
      if (propiedad.status === 0 && (JSON.parse(propiedad.stdout.toString()) as Record<string, string>)['ayacucho.t117'] === marca) {
        docker(['rm', '-fv', nombre]);
      }
    }
    for (const archivo of archivos) await unlink(archivo).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; });
    await rmdir(temporal);
  }
  await mkdir(dirname(salida), { recursive: true });
  await writeFile(salida, JSON.stringify(resultado, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write('Reinicio, migraciones y restauración aislada de PostgreSQL y Garage verificados.\n');
}

await principal();
