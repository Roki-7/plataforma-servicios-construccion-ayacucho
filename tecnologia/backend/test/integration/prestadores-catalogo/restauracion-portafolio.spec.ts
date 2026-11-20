import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import request from 'supertest';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import type { Configuracion } from '../../../src/composicion/configuracion.js';
import { iniciarValidacion002 } from '../../../src/composicion/main.js';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { persistencia002 } from '../../../src/composicion/persistencia.js';
import { esBaseDeRestauracion, leerPuerta } from '../../../src/composicion/puerta-restauracion-002.js';
import { DestinoPostgresDocker, lanzador, migracionesEsperadas002, OrigenPostgresDocker } from '../../../src/composicion/respaldo-002.js';
import { LimpiezaPortafolio } from '../../../src/modulos/prestadores/infraestructura/archivos/limpieza-portafolio.js';
import { PortafolioS3 } from '../../../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { clavesDeRespaldo, type EtapaRestauracion, respaldarPortafolio, restaurarPortafolio, sha256, validarDestino, verificarConjunto, type DestinoPostgres, type Manifiesto } from '../../../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { base64, crearImagen } from '../../soporte/prestadores-catalogo/imagenes.js';
import { origenWeb002, perfilValido, registrarCuenta, type AplicacionBase } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/**
 * T071 · Ensayo de restauración coordinada en un proyecto Docker DESCARTABLE (ayacucho-ensayo-restauracion): PostgreSQL, Garage y Redis propios, con bucket de origen,
 * bucket de destino y base de destino exclusivos. Es opt-in: requiere ENSAYO_RESTAURACION_ENV (ruta absoluta de .local/ensayo-restauracion/ensayo.env, generado por
 * preparar-ensayo-restauracion-002) y los contenedores iniciados. Nunca usa ayacucho_002_validacion, bases de 001 ni el bucket de portafolio actual.
 */
const archivoEnv = process.env['ENSAYO_RESTAURACION_ENV'];
const suite = archivoEnv ? describe : describe.skip;
const proyecto = 'ayacucho-ensayo-restauracion';
const pgContenedor = `${proyecto}-postgres-1`; const redisContenedor = `${proyecto}-redis-1`; const garageContenedor = `${proyecto}-objetos-1`;
const puertos = { pg: 54341, redis: 63851, s3: 3930 };
const bucketOrigen = 'ensayo-origen'; const bucketDestino = 'ensayo-destino';
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
const redisCli = (...args: string[]) => docker('exec', redisContenedor, 'redis-cli', ...args);
const uuid = () => randomUUID();

suite('ensayo de restauración coordinada en infraestructura descartable', () => {
  let cfg: Record<string, string>; let cliente: S3Client; let claves: ReturnType<typeof clavesDeRespaldo>; let directorio: string;
  let urlAdmin: string; let urlOrigen: string; let nombreOrigen: string; let almacenOrigen: PortafolioS3; let manifiesto: Manifiesto; let migraciones: readonly string[];
  const basesCreadas: string[] = []; const prefijos: { bucket: string; prefijo: string }[] = [];
  const datos = { prestadorId: '', trabajoId: '', fotoVigente: '', fotoRetirada: '', fotoPendiente: '', claveVigente: '', claveRetirada: '', clavePendiente: '', bytesVigente: '' };
  const hmac = randomBytes(32).toString('base64'); const aead = randomBytes(32).toString('base64');
  const urlDe = (base: string) => { const u = new URL(urlAdmin); u.pathname = `/${base}`; return u.href; };
  const sql = async <T>(url: string, texto: string, p: unknown[] = []): Promise<T[]> => { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return (await c.query(texto, p)).rows as T[]; } finally { await c.end(); } };
  const baseNueva = () => `ayacucho_002_restauracion_${uuid().replaceAll('-', '')}`;
  const garage = (...args: string[]) => docker('exec', garageContenedor, '/garage', ...args);
  const configuracion = (url: string, bucket: string): Configuracion => ({ validacion: true, puerto: 3002, origen: origenWeb002, urlPublica: origenWeb002, databaseUrl: url, catalogo: resolve('../.local/002/catalogo/manifest.json'),
    contrato: resolve('contracts/openapi.json'), hmacId: 'ensayo', hmac: new Map([['ensayo', Buffer.from(hmac, 'base64')]]), aeadId: 'ensayo', aead: new Map([['ensayo', Buffer.from(aead, 'base64')]]),
    smtp: { host: '127.0.0.1', port: 9, secure: false, from: 'ensayo@example.invalid', validacion: true },
    s3: { endpoint: `http://127.0.0.1:${puertos.s3}`, region: 'garage', bucket, accessKeyId: cfg['ENSAYO_S3_ACCESS_KEY_ID']!, secretAccessKey: cfg['ENSAYO_S3_SECRET_ACCESS_KEY']! } });
  const entornoServicio = (url: string, puerto: number, bucket: string): NodeJS.ProcessEnv => ({ NODE_ENV: 'test', VALIDATION_MODE: 'true', PORT: String(puerto), PUBLIC_ORIGIN: origenWeb002, PUBLIC_URL: origenWeb002, DATABASE_URL: url,
    HMAC_KEY_ID: 'ensayo', HMAC_KEYS_JSON: JSON.stringify({ ensayo: hmac }), AEAD_KEY_ID: 'ensayo', AEAD_KEYS_JSON: JSON.stringify({ ensayo: aead }), S3_ENDPOINT: `http://127.0.0.1:${puertos.s3}`, S3_REGION: 'garage', S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: cfg['ENSAYO_S3_ACCESS_KEY_ID']!, S3_SECRET_ACCESS_KEY: cfg['ENSAYO_S3_SECRET_ACCESS_KEY']!, SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', SMTP_FROM: 'ensayo@example.invalid', CATALOGO_MANIFIESTO: resolve('../.local/002/catalogo/manifest.json'),
    REDIS_URL: `redis://127.0.0.1:${puertos.redis}`, REDIS_NAMESPACE: 'ayacucho:002:ensayo-origen', REDIS_TIMEOUT_MS: '300' });
  const respaldar = (intervencion?: () => Promise<void>) => respaldarPortafolio({ origen: new OrigenPostgresDocker(urlOrigen, pgContenedor, 4000), almacen: almacenOrigen, claves, directorio, aplicacion: 'ensayo',
    origenLogico: { baseLogica: nombreOrigen, bucket: bucketOrigen, prefijo: 'portafolio/', espacioRedis: 'ayacucho:002:ensayo-origen' }, ...(intervencion ? { intervencion } : {}) });
  const restaurar = async (m: Manifiesto, o: { prefijo?: string; intervencion?: (e: EtapaRestauracion, n: number) => Promise<void>; claves?: typeof claves; mayor?: number; migraciones?: readonly string[]; base?: string; destino?: (url: string, mayor: number) => DestinoPostgres } = {}) => {
    const base = o.base ?? baseNueva(); const url = urlDe(base); const prefijo = o.prefijo ?? 'portafolio/';
    validarDestino({ urlBase: url, urlOrigen, bucket: bucketDestino, prefijo, bucketOrigen, prefijoOrigen: 'portafolio/', confirmo: base });
    basesCreadas.push(base); prefijos.push({ bucket: bucketDestino, prefijo });
    const mayor = o.mayor ?? await DestinoPostgresDocker.mayorDe(urlOrigen);
    const resultado = await restaurarPortafolio({ directorio, backupId: m.backupId, claves: o.claves ?? claves, destinoPostgres: o.destino ? o.destino(url, mayor) : new DestinoPostgresDocker(url, pgContenedor, mayor), almacenDestino: new PortafolioS3(cliente, bucketDestino, prefijo),
      prefijoDestino: prefijo, postgresMayorOrigen: o.mayor ?? mayor, migracionesEsperadas: o.migraciones ?? migraciones, ...(o.intervencion ? { intervencion: o.intervencion } : {}) });
    return { resultado, base, url, prefijo };
  };
  const existeBase = async (base: string) => Number((await sql<{ n: number }>(urlDe('postgres'), 'SELECT count(*)::int AS n FROM pg_database WHERE datname = $1', [base]))[0]!.n) === 1;
  const prefijoExclusivo = (bucket: string, prefijo: string) => {
    const permitido = prefijo === 'portafolio/' || /^pruebas\/[0-9a-f-]{36}\/portafolio\/$/.test(prefijo);
    if (![bucketOrigen, bucketDestino].includes(bucket) || !permitido) throw new Error('Limpieza cancelada: solo se admiten los buckets y prefijos exclusivos del ensayo.');
  };
  const listarClaves = async (bucket: string, prefijo: string): Promise<string[]> => {
    const claves: string[] = []; let token: string | undefined;
    do {
      const pagina = await cliente.send(new ListObjectsV2Command({ Bucket: bucket, ...(prefijo ? { Prefix: prefijo } : {}), ...(token ? { ContinuationToken: token } : {}) }));
      for (const o of pagina.Contents ?? []) if (o.Key) claves.push(o.Key);
      token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
    } while (token);
    return claves;
  };
  const contarObjetos = async (bucket: string, prefijo = '') => (await listarClaves(bucket, prefijo)).length;
  /** Elimina solo objetos bajo un prefijo exclusivo del ensayo (nunca el bucket ni prefijos ajenos), recorriendo todas las páginas. */
  const vaciarPrefijo = async (bucket: string, prefijo: string) => {
    prefijoExclusivo(bucket, prefijo);
    for (const clave of await listarClaves(bucket, prefijo)) await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
  };

  beforeAll(async () => {
    cfg = Object.fromEntries((await readFile(archivoEnv!, 'utf8')).split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^'|'$/g, '')]; }));
    if (!resolve(archivoEnv!).replaceAll('\\', '/').endsWith('/.local/ensayo-restauracion/ensayo.env')) throw new Error('Configuración del ensayo no permitida.');
    urlAdmin = `postgresql://ensayo_restauracion:${cfg['ENSAYO_PG_PASSWORD']}@127.0.0.1:${puertos.pg}/postgres`;
    expect(docker('inspect', '-f', '{{index .Config.Labels "com.docker.compose.project"}}', pgContenedor)).toBe(proyecto);
    expect(docker('inspect', '-f', '{{index .Config.Labels "com.docker.compose.project"}}', garageContenedor)).toBe(proyecto);
    expect(redisCli('ping')).toBe('PONG');
    claves = clavesDeRespaldo(cfg['ENSAYO_RESPALDO_CLAVE']); directorio = await mkdtemp(join(tmpdir(), 'ensayo-restauracion-'));
    cliente = new S3Client({ endpoint: `http://127.0.0.1:${puertos.s3}`, region: 'garage', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: cfg['ENSAYO_S3_ACCESS_KEY_ID']!, secretAccessKey: cfg['ENSAYO_S3_SECRET_ACCESS_KEY']! } });
    // Identidad y buckets propios del ensayo en el Garage descartable (idempotente).
    try { garage('key', 'info', cfg['ENSAYO_S3_ACCESS_KEY_ID']!); } catch { garage('key', 'import', '--yes', '-n', 'ensayo', cfg['ENSAYO_S3_ACCESS_KEY_ID']!, cfg['ENSAYO_S3_SECRET_ACCESS_KEY']!); }
    for (const b of [bucketOrigen, bucketDestino]) { try { garage('bucket', 'info', b); } catch { garage('bucket', 'create', b); } garage('bucket', 'allow', '--read', '--write', '--key', cfg['ENSAYO_S3_ACCESS_KEY_ID']!, b); }
    // Estado inicial determinista: se vacían los prefijos exclusivos del ensayo (residuos de ejecuciones previas o interrumpidas).
    for (const b of [bucketOrigen, bucketDestino]) {
      await vaciarPrefijo(b, 'portafolio/');
      // Residuos de ensayos previos bajo pruebas/<uuid>/portafolio/: solo claves con esa forma exacta.
      const prefijosResiduales = new Set((await listarClaves(b, 'pruebas/')).map(k => /^(pruebas\/[0-9a-f-]{36}\/portafolio\/)/.exec(k)?.[1]).filter((x): x is string => !!x));
      for (const prefijo of prefijosResiduales) await vaciarPrefijo(b, prefijo);
    }
    nombreOrigen = `ayacucho_002_ensayo_origen_${uuid().replaceAll('-', '')}`; urlOrigen = urlDe(nombreOrigen); basesCreadas.push(nombreOrigen);
    await sql(urlDe('postgres'), `CREATE DATABASE "${nombreOrigen}"`);
    await aplicarMigraciones002(urlOrigen); migraciones = await migracionesEsperadas002();
    almacenOrigen = new PortafolioS3(cliente, bucketOrigen, 'portafolio/');
    // Datos del origen por el API real: una foto vigente, una retirada (con purga pendiente) y una preparación inconclusa.
    const app = await crearAplicacionCompleta002(configuracion(urlOrigen, bucketOrigen), { prestadores: { almacen: almacenOrigen }, worker: false });
    try {
      const http = request(app.app.getHttpServer()); const ids = { raiz: uuid(), hija: uuid() };
      await app.db.query("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,activa) VALUES($1,'Construcción','construccion',1,true)", [ids.raiz]);
      await app.db.query("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,'Albañilería','albanileria',2,$2,true)", [ids.hija, ids.raiz]);
      const cuenta = await registrarCuenta(app as unknown as AplicacionBase, http, 'prestador');
      const escribir = (t: ReturnType<typeof http.post>) => t.set('Authorization', `Bearer ${cuenta.token}`).set('Origin', origenWeb002).set('Idempotency-Key', uuid());
      const perfil = (await escribir(http.put('/api/v1/prestadores/perfil')).send(perfilValido({ hija: ids.hija } as never)).expect(201)).body;
      const trabajo = (await escribir(http.post('/api/v1/prestadores/perfil/trabajos')).send({ versionPerfil: perfil.version, titulo: 'Fachada de ensayo', descripcion: 'Trabajo ficticio del ensayo' }).expect(201)).body;
      const foto = async (version: number, color: string) => (await escribir(http.post(`/api/v1/prestadores/perfil/trabajos/${trabajo.trabajo.trabajoId}/fotografias`))
        .send({ versionTrabajo: version, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color })) }).expect(201)).body;
      const a = await foto(trabajo.trabajo.version, '#aa3322'); const b = await foto(a.versionTrabajo, '#2233aa');
      await escribir(http.delete(`/api/v1/prestadores/perfil/trabajos/${trabajo.trabajo.trabajoId}/fotografias/${b.fotografia.fotografiaId}?version=${b.versionTrabajo}`) as never).expect(200);
      Object.assign(datos, { prestadorId: perfil.prestadorId, trabajoId: trabajo.trabajo.trabajoId, fotoVigente: a.fotografia.fotografiaId, fotoRetirada: b.fotografia.fotografiaId });
      const fila = async (id: string) => (await app.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE id=$1', [id]) as { objeto_clave: string }[])[0]?.objeto_clave;
      datos.claveVigente = (await fila(datos.fotoVigente))!;
      datos.claveRetirada = ((await app.db.query("SELECT clave FROM prestadores_objetos_pendientes WHERE tipo='PURGA'")) as { clave: string }[])[0]!.clave;
      datos.clavePendiente = `portafolio/${datos.prestadorId}/${uuid()}`; datos.fotoPendiente = datos.clavePendiente.split('/')[2]!;
      await almacenOrigen.guardar(datos.clavePendiente, Buffer.from('subida sin confirmar'));
      await app.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PREPARACION',$2,now() + interval '1 hour')", [datos.clavePendiente, datos.prestadorId]);
      datos.bytesVigente = sha256(await almacenOrigen.leer(datos.claveVigente));
    } finally { await app.app.close(); }
  }, 300000);

  afterAll(async () => {
    try {
      for (const base of basesCreadas) await sql(urlDe('postgres'), `DROP DATABASE IF EXISTS "${base}" WITH (FORCE)`).catch(() => undefined);
      const objetivos = new Map<string, { bucket: string; prefijo: string }>();
      for (const t of [{ bucket: bucketOrigen, prefijo: 'portafolio/' }, { bucket: bucketDestino, prefijo: 'portafolio/' }, ...prefijos]) objetivos.set(`${t.bucket}|${t.prefijo}`, t);
      for (const { bucket, prefijo } of objetivos.values()) await vaciarPrefijo(bucket, prefijo);
      await rm(directorio, { recursive: true, force: true });
    } finally { cliente?.destroy(); }
  }, 120000);

  describe('respaldo y restauración completos', () => {
    let restaurada: Awaited<ReturnType<typeof restaurar>>;
    test('el respaldo del origen es COMPLETO: una foto vigente, la retirada y la pendiente no se copian', async () => {
      manifiesto = await respaldar();
      expect(manifiesto).toMatchObject({ estado: 'COMPLETO', conteos: { fotografiasVigentes: 1, objetosCopiados: 1, preparacionesInconclusas: 1, purgasPendientes: 1 } });
      expect(manifiesto.objetos.map(o => o.clave)).toEqual([datos.claveVigente]);
      expect(await contarObjetos(bucketOrigen, 'portafolio/')).toBeGreaterThanOrEqual(2);
    }, 180000);

    test('restaura PostgreSQL y Garage en una base y un bucket nuevos: puerta abierta, espacio Redis nuevo y estado coherente', async () => {
      restaurada = await restaurar(manifiesto);
      expect(restaurada.resultado).toMatchObject({ objetosRestaurados: 1, preparacionesDescartadas: 1, purgasConservadas: 1 });
      expect(await leerPuerta(restaurada.url)).toEqual({ estado: 'ABIERTO', espacioRedis: restaurada.resultado.espacioRedis });
      expect(restaurada.resultado.espacioRedis).toMatch(/^ayacucho:002:restaurada-/);
      // PostgreSQL restaurado
      const refs = await sql<{ objeto_clave: string; sha: string }>(restaurada.url, "SELECT objeto_clave, encode(checksum,'hex') AS sha FROM prestadores_fotografias");
      expect(refs).toEqual([{ objeto_clave: datos.claveVigente, sha: datos.bytesVigente }]);
      expect((await sql<{ tipo: string }>(restaurada.url, 'SELECT tipo FROM prestadores_objetos_pendientes')).map(p => p.tipo)).toEqual(['PURGA']);
      expect(Number((await sql<{ n: number }>(restaurada.url, 'SELECT count(*)::int AS n FROM migrations'))[0]!.n)).toBe(migraciones.length);
      // Garage de destino: solo la foto vigente, con el mismo contenido. El origen no cambia.
      expect(await contarObjetos(bucketDestino, 'portafolio/')).toBe(1);
      expect(sha256(await new PortafolioS3(cliente, bucketDestino, 'portafolio/').leer(datos.claveVigente))).toBe(datos.bytesVigente);
      expect(sha256(await almacenOrigen.leer(datos.claveVigente))).toBe(datos.bytesVigente);
      expect(Number((await sql<{ n: number }>(urlOrigen, 'SELECT count(*)::int AS n FROM prestadores_fotografias'))[0]!.n)).toBe(1);
      expect(await leerPuerta(urlOrigen)).toBeNull();
    }, 240000);

    describe('aplicación integrada sobre la base restaurada (dos réplicas)', () => {
      const servicios: { cerrar: () => Promise<void> }[] = []; const puertosApp = [3941, 3942]; let anonimo: string;
      const get = (puerto: number, ruta: string) => fetch(`http://127.0.0.1:${puerto}/api/v1${ruta}`);
      beforeAll(async () => {
        redisCli('flushall');
        for (const p of puertosApp) servicios.push(await iniciarValidacion002(entornoServicio(restaurada.url, p, bucketDestino)));
        anonimo = `http://127.0.0.1:${puertos.s3}/${bucketDestino}/${datos.claveVigente}`;
      }, 180000);
      afterAll(async () => { for (const s of servicios) await s.cerrar(); });

      test('ambas réplicas atienden y usan el espacio Redis nuevo, nunca el configurado ni el del origen', async () => {
        for (const p of puertosApp) { expect((await get(p, '/salud')).status).toBe(200); expect((await get(p, '/categorias')).status).toBe(200); expect((await get(p, '/servicios')).status).toBe(200); expect((await get(p, '/prestadores')).status).toBe(200); }
        const claves = redisCli('--scan', '--pattern', '*').split('\n').filter(Boolean);
        expect(claves.length).toBeGreaterThanOrEqual(3);
        for (const k of claves) expect(k.startsWith(`${restaurada.resultado.espacioRedis}:`)).toBe(true);
        expect(claves.some(k => k.startsWith('ayacucho:002:ensayo-origen'))).toBe(false);
      });

      test('fotografía vigente: 200 con el mismo contenido; retirada y pendiente: 404', async () => {
        for (const p of puertosApp) {
          const vigente = await get(p, `/prestadores/${datos.prestadorId}/trabajos/${datos.trabajoId}/fotografias/${datos.fotoVigente}`);
          expect(vigente.status).toBe(200);
          const cuerpo = await vigente.json() as { contenidoBase64: string };
          expect(sha256(Buffer.from(cuerpo.contenidoBase64, 'base64'))).toBe(datos.bytesVigente);
          for (const id of [datos.fotoRetirada, datos.fotoPendiente, uuid()]) {
            const r = await get(p, `/prestadores/${datos.prestadorId}/trabajos/${datos.trabajoId}/fotografias/${id}`);
            expect(r.status).toBe(404);
            expect(await r.text()).not.toContain('contenidoBase64');
          }
        }
      });

      test('el acceso anónimo directo al bucket se rechaza (objeto y listado, destino y origen)', async () => {
        for (const url of [anonimo, `http://127.0.0.1:${puertos.s3}/${bucketDestino}?list-type=2`, `http://127.0.0.1:${puertos.s3}/${bucketOrigen}/${datos.claveVigente}`, `http://127.0.0.1:${puertos.s3}/${bucketOrigen}?list-type=2`]) {
          const r = await fetch(url); expect([r.status, (await r.text()).includes(sha256(Buffer.from('x')))]).toEqual([403, false]);
        }
        const conClaveFalsa = await fetch(anonimo, { headers: { authorization: 'AWS4-HMAC-SHA256 Credential=GKfalsa/20260101/garage/s3/aws4_request, SignedHeaders=host, Signature=00' } });
        expect(conClaveFalsa.status).toBeGreaterThanOrEqual(400);
      });

      test('la limpieza reanuda sobre la base restaurada sin tocar la fotografía vigente', async () => {
        const ds = persistencia002(restaurada.url, persistenciaOferta002); await ds.initialize();
        try {
          const almacen = new PortafolioS3(cliente, bucketDestino, 'portafolio/');
          const limpieza = new LimpiezaPortafolio(ds, almacen, { arrendamientoSegundos: 60, lote: 50, reintentoSegundos: 1, gracia: 0 }, () => new Date(Date.now() + 2 * 3600_000));
          const r = await limpieza.ejecutar(); const huerfanos = await limpieza.reconciliarHuerfanos();
          expect(r.reintentos).toBe(0); expect(huerfanos).toBe(0);
          expect(sha256(await almacen.leer(datos.claveVigente))).toBe(datos.bytesVigente);
          expect(Number((await ds.query('SELECT count(*)::int AS n FROM prestadores_objetos_pendientes') as { n: number }[])[0]!.n)).toBe(0);
        } finally { await ds.destroy(); }
        expect((await get(puertosApp[0]!, `/prestadores/${datos.prestadorId}/trabajos/${datos.trabajoId}/fotografias/${datos.fotoVigente}`)).status).toBe(200);
      });
    });
  });

  describe('tráfico cerrado ante una restauración incompleta', () => {
    test('una restauración interrumpida deja la puerta CERRADA y el servicio no se inicia ni escucha', async () => {
      const prefijo = `pruebas/${uuid()}/portafolio/`; const base = baseNueva(); const puerto = 3951;
      await expect(restaurar(manifiesto, { base, prefijo, intervencion: async e => { if (e === 'tras-objetos') throw new Error('interrupción simulada'); } })).rejects.toThrow('interrupción simulada');
      expect(await leerPuerta(urlDe(base))).toEqual({ estado: 'CERRADO', espacioRedis: null });
      await expect(iniciarValidacion002(entornoServicio(urlDe(base), puerto, bucketDestino))).rejects.toThrow('tráfico permanece cerrado');
      await expect(fetch(`http://127.0.0.1:${puerto}/api/v1/salud`)).rejects.toThrow();
      // El destino ocupado no se reutiliza y el reintento en un destino limpio recupera el conjunto y sí arranca.
      await expect(restaurar(manifiesto, { base, prefijo })).rejects.toBeDefined();
      expect(await leerPuerta(urlDe(base))).toEqual({ estado: 'CERRADO', espacioRedis: null });
      const limpio = await restaurar(manifiesto, { prefijo: `pruebas/${uuid()}/portafolio/` });
      const servicio = await iniciarValidacion002(entornoServicio(limpio.url, puerto, bucketDestino));
      try { expect((await fetch(`http://127.0.0.1:${puerto}/api/v1/salud`)).status).toBe(200); } finally { await servicio.cerrar(); }
    }, 300000);
  });

  describe('puerta de restauración y arranque con PostgreSQL real', () => {
    const rechazaArranque = async (url: string, puerto: number) => {
      const resultado = await iniciarValidacion002(entornoServicio(url, puerto, bucketDestino)).then(servicio => servicio, (error: unknown) => error);
      if (!(resultado instanceof Error)) { await (resultado as { cerrar: () => Promise<void> }).cerrar(); throw new Error('El servicio arrancó sobre una base que debía permanecer cerrada.'); }
      expect(resultado.message).toContain('tráfico permanece cerrado');
      await expect(fetch(`http://127.0.0.1:${puerto}/api/v1/salud`)).rejects.toThrow();
    };
    const tablas = async (url: string) => Number((await sql<{ n: number }>(url, "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'restauracion_002'"))[0]!.n);
    const prefijoPrueba = () => `pruebas/${uuid()}/portafolio/`;

    test('interrupción inmediatamente después de crear la base: sin puerta ni datos, el arranque se rechaza', async () => {
      const base = baseNueva();
      await expect(restaurar(manifiesto, { base, prefijo: prefijoPrueba(), intervencion: async e => { if (e === 'tras-crear') throw new Error('interrupción tras crear'); } })).rejects.toThrow('interrupción tras crear');
      const url = urlDe(base);
      expect(await existeBase(base)).toBe(true);
      expect(await leerPuerta(url)).toBeNull();
      expect(await tablas(url)).toBe(0);
      expect(esBaseDeRestauracion(url)).toBe(true);
      await rechazaArranque(url, 3971);
    }, 180000);

    test('puerta CERRADA sin datos (interrupción tras cerrarla y antes del volcado): el arranque se rechaza', async () => {
      const base = baseNueva();
      await expect(restaurar(manifiesto, { base, prefijo: prefijoPrueba(), intervencion: async e => { if (e === 'tras-puerta') throw new Error('interrupción tras la puerta'); } })).rejects.toThrow('interrupción tras la puerta');
      const url = urlDe(base);
      expect(await leerPuerta(url)).toEqual({ estado: 'CERRADO', espacioRedis: null });
      expect(await tablas(url)).toBe(0);
      await rechazaArranque(url, 3972);
    }, 180000);

    test('fallo de psql tras restaurar parcialmente los datos: la puerta sigue CERRADA y el arranque se rechaza', async () => {
      class DestinoConFalloParcial extends DestinoPostgresDocker {
        override async restaurar(volcado: Uint8Array): Promise<void> {
          const texto = Buffer.from(volcado).toString('utf8'); const corte = texto.indexOf('\n', Math.floor(texto.length * 0.6));
          // La primera parte del volcado se aplica de verdad. Después, una sentencia que falla hace que psql termine con error (ON_ERROR_STOP).
          await super.restaurar(Buffer.from(`${texto.slice(0, corte)}\nSELECT 1/0;\n`));
        }
      }
      const base = baseNueva();
      await expect(restaurar(manifiesto, { base, prefijo: prefijoPrueba(), destino: (url, mayor) => new DestinoConFalloParcial(url, pgContenedor, mayor) })).rejects.toMatchObject({ codigo: 'PROCESO_EXTERNO_FALLIDO' });
      const url = urlDe(base);
      expect(await tablas(url)).toBeGreaterThan(0);
      expect(await leerPuerta(url)).toEqual({ estado: 'CERRADO', espacioRedis: null });
      await rechazaArranque(url, 3973);
    }, 180000);

    test('ausencia de la puerta en una base de restauración sana y migrada nunca autoriza el arranque', async () => {
      const base = baseNueva(); const url = urlDe(base); basesCreadas.push(base);
      await sql(urlDe('postgres'), `CREATE DATABASE "${base}"`);
      await aplicarMigraciones002(url);
      expect(await leerPuerta(url)).toBeNull();
      await rechazaArranque(url, 3974);
    }, 180000);

    test('una puerta que no se puede consultar rechaza el arranque', async () => {
      const base = baseNueva(); const url = urlDe(base); basesCreadas.push(base);
      await sql(urlDe('postgres'), `CREATE DATABASE "${base}"`);
      await sql(url, 'CREATE TABLE restauracion_002 (unica boolean PRIMARY KEY DEFAULT true)');
      await sql(url, 'INSERT INTO restauracion_002 DEFAULT VALUES');
      await expect(leerPuerta(url)).rejects.toBeDefined();
      await rechazaArranque(url, 3975);
    }, 120000);

    test('con la base inexistente o inaccesible, un destino de restauración tampoco arranca', async () => {
      await rechazaArranque(urlDe(baseNueva()), 3976);
    }, 60000);

    test('el volcado de una base ya restaurada no incluye ni sobrescribe la puerta: la nueva restauración tiene la suya', async () => {
      const primera = await restaurar(manifiesto, { prefijo: prefijoPrueba() });
      const puertaPrimera = await sql<{ backup_id: string; estado: string }>(primera.url, 'SELECT backup_id, estado FROM restauracion_002');
      expect(puertaPrimera).toEqual([{ backup_id: manifiesto.backupId, estado: 'ABIERTO' }]);
      // Respaldo de la base restaurada: su volcado excluye la tabla de la puerta.
      const prefijoR = primera.prefijo; const almacenR = new PortafolioS3(cliente, bucketDestino, prefijoR);
      const segundo = await respaldarPortafolio({ origen: new OrigenPostgresDocker(primera.url, pgContenedor, 4000), almacen: almacenR, claves, directorio, aplicacion: 'ensayo',
        origenLogico: { baseLogica: primera.base, bucket: bucketDestino, prefijo: prefijoR, espacioRedis: primera.resultado.espacioRedis } });
      expect(segundo.estado).toBe('COMPLETO');
      const { volcado } = await verificarConjunto({ directorio, backupId: segundo.backupId, claves, postgresMayorOrigen: segundo.versiones.postgresMayor, migracionesEsperadas: migraciones });
      expect(volcado.toString('utf8').includes('restauracion_002')).toBe(false);
      // Segunda restauración desde ese respaldo, a un destino nuevo.
      const base2 = baseNueva(); const url2 = urlDe(base2); const prefijo2 = prefijoPrueba(); basesCreadas.push(base2); prefijos.push({ bucket: bucketOrigen, prefijo: prefijo2 });
      validarDestino({ urlBase: url2, urlOrigen: primera.url, bucket: bucketOrigen, prefijo: prefijo2, bucketOrigen: bucketDestino, prefijoOrigen: prefijoR, confirmo: base2 });
      const mayor = await DestinoPostgresDocker.mayorDe(urlOrigen);
      const segunda = await restaurarPortafolio({ directorio, backupId: segundo.backupId, claves, destinoPostgres: new DestinoPostgresDocker(url2, pgContenedor, mayor), almacenDestino: new PortafolioS3(cliente, bucketOrigen, prefijo2),
        prefijoDestino: prefijo2, postgresMayorOrigen: mayor, migracionesEsperadas: migraciones });
      expect(await sql(url2, 'SELECT backup_id, estado FROM restauracion_002')).toEqual([{ backup_id: segundo.backupId, estado: 'ABIERTO' }]);
      expect(segunda.espacioRedis).not.toBe(primera.resultado.espacioRedis);
      // La puerta de la primera restauración no cambió.
      expect(await sql(primera.url, 'SELECT backup_id, estado FROM restauracion_002')).toEqual(puertaPrimera);
    }, 300000);

    test('restauración completa y verificada: solo entonces arranca, con el espacio Redis nuevo', async () => {
      const r = await restaurar(manifiesto, { prefijo: prefijoPrueba() });
      expect(await leerPuerta(r.url)).toEqual({ estado: 'ABIERTO', espacioRedis: r.resultado.espacioRedis });
      redisCli('flushall');
      const servicio = await iniciarValidacion002(entornoServicio(r.url, 3977, bucketDestino));
      try {
        expect((await fetch('http://127.0.0.1:3977/api/v1/salud')).status).toBe(200);
        expect((await fetch('http://127.0.0.1:3977/api/v1/categorias')).status).toBe(200);
        const claves2 = redisCli('--scan', '--pattern', '*').split('\n').filter(Boolean);
        expect(claves2.length).toBeGreaterThan(0);
        for (const k of claves2) expect(k.startsWith(`${r.resultado.espacioRedis}:`)).toBe(true);
      } finally { await servicio.cerrar(); }
    }, 180000);

    test('las bases que no son destinos de restauración conservan su comportamiento: sin puerta arrancan con su espacio Redis', async () => {
      const base = `ayacucho_002_test_${uuid().replaceAll('-', '')}`; const url = urlDe(base); basesCreadas.push(base);
      await sql(urlDe('postgres'), `CREATE DATABASE "${base}"`);
      await aplicarMigraciones002(url);
      expect(esBaseDeRestauracion(url)).toBe(false); expect(await leerPuerta(url)).toBeNull();
      redisCli('flushall');
      const servicio = await iniciarValidacion002(entornoServicio(url, 3978, bucketDestino));
      try {
        expect((await fetch('http://127.0.0.1:3978/api/v1/salud')).status).toBe(200);
        expect((await fetch('http://127.0.0.1:3978/api/v1/categorias')).status).toBe(200);
        const claves2 = redisCli('--scan', '--pattern', '*').split('\n').filter(Boolean);
        expect(claves2.length).toBeGreaterThan(0);
        for (const k of claves2) expect(k.startsWith('ayacucho:002:ensayo-origen:')).toBe(true);
      } finally { await servicio.cerrar(); }
      // Una puerta CERRADA en una base que no es de restauración también la rechaza.
      await sql(url, "CREATE TABLE restauracion_002 (unica boolean PRIMARY KEY DEFAULT true CHECK (unica), estado text NOT NULL, backup_id uuid NOT NULL, espacio_redis text, actualizado_en timestamptz NOT NULL DEFAULT now())");
      await sql(url, "INSERT INTO restauracion_002(estado, backup_id) VALUES('CERRADO', $1)", [uuid()]);
      await rechazaArranque(url, 3979);
    }, 240000);
  });

  describe('rechazo de conjuntos incompatibles o alterados (sin crear destinos)', () => {
    const sinCambios = async (accion: () => Promise<unknown>, codigo: string) => {
      const antes = Number((await sql<{ n: number }>(urlDe('postgres'), "SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'ayacucho_002_restauracion_%'"))[0]!.n);
      const base = baseNueva();
      await expect(accion.call({ base })).rejects.toMatchObject({ codigo });
      expect(await existeBase(base)).toBe(false);
      expect(Number((await sql<{ n: number }>(urlDe('postgres'), "SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'ayacucho_002_restauracion_%'"))[0]!.n)).toBe(antes);
    };
    test('versión de PostgreSQL o migraciones incompatibles, clave distinta y manifiesto de otro respaldo', async () => {
      await sinCambios(() => restaurar(manifiesto, { mayor: 17 }), 'VERSION_INCOMPATIBLE');
      await sinCambios(() => restaurar(manifiesto, { migraciones: [...migraciones, 'Futura1799999999999'] }), 'VERSION_INCOMPATIBLE');
      await sinCambios(() => restaurar(manifiesto, { claves: clavesDeRespaldo(randomBytes(32).toString('base64')) }), 'MANIFIESTO_ALTERADO');
      const otro = await respaldar();
      const ruta = (m: Manifiesto) => join(directorio, m.backupId, 'manifiesto.json');
      const propio = await readFile(ruta(manifiesto), 'utf8');
      await writeFile(ruta(manifiesto), await readFile(ruta(otro), 'utf8'));
      try { await sinCambios(() => restaurar(manifiesto), 'PAREJA_INCOMPATIBLE'); } finally { await writeFile(ruta(manifiesto), propio); }
    }, 240000);

    test('manifiesto, volcado, objeto o hash alterados o ausentes', async () => {
      const m = await respaldar(); const dir = join(directorio, m.backupId); const ruta = join(dir, 'manifiesto.json'); const original = await readFile(ruta, 'utf8');
      await writeFile(ruta, original.replace('"COMPLETO"', '"INCOMPLETO"')); await sinCambios(() => restaurar(m), 'MANIFIESTO_ALTERADO');
      await writeFile(ruta, original.replace(m.volcado.sha256, sha256(Buffer.from('otro')))); await sinCambios(() => restaurar(m), 'MANIFIESTO_ALTERADO');
      await writeFile(ruta, original.replace(m.objetos[0]!.sha256, sha256(Buffer.from('otro')))); await sinCambios(() => restaurar(m), 'MANIFIESTO_ALTERADO');
      await writeFile(ruta, original);
      const volcado = await readFile(join(dir, 'volcado.sql.enc')); const alterado = Buffer.from(volcado); alterado[alterado.length - 20] = alterado[alterado.length - 20]! ^ 1;
      await writeFile(join(dir, 'volcado.sql.enc'), alterado); await sinCambios(() => restaurar(m), 'ARTEFACTO_ALTERADO'); await writeFile(join(dir, 'volcado.sql.enc'), volcado);
      const objetos = join(dir, 'objetos'); const archivo = (await readdir(objetos))[0]!; const objeto = await readFile(join(objetos, archivo)); const malo = Buffer.from(objeto); malo[malo.length - 20] = malo[malo.length - 20]! ^ 1;
      await writeFile(join(objetos, archivo), malo); await sinCambios(() => restaurar(m), 'ARTEFACTO_ALTERADO');
      await rm(join(objetos, archivo)); await sinCambios(() => restaurar(m), 'OBJETO_AUSENTE');
      await writeFile(join(objetos, archivo), objeto);
      await rm(join(dir, 'volcado.sql.enc')); await sinCambios(() => restaurar(m), 'ARTEFACTO_AUSENTE');
      await writeFile(join(dir, 'volcado.sql.enc'), volcado);
      const ok = await restaurar(m, { prefijo: `pruebas/${uuid()}/portafolio/` });
      expect(await leerPuerta(ok.url)).toMatchObject({ estado: 'ABIERTO' });
    }, 300000);

    test('un respaldo INCOMPLETO (objeto alterado en el origen) no se puede restaurar y reanuda el origen', async () => {
      const original = await almacenOrigen.leer(datos.claveVigente);
      await almacenOrigen.guardar(datos.claveVigente, Buffer.from('alterado'));
      let incompleto: Manifiesto | undefined;
      try { await respaldar(); } catch (e) { incompleto = (e as { manifiesto: Manifiesto }).manifiesto; } finally { await almacenOrigen.guardar(datos.claveVigente, original); }
      expect(incompleto).toMatchObject({ estado: 'INCOMPLETO', causa: 'OBJETO_ALTERADO' });
      await sinCambios(() => restaurar(incompleto!), 'RESPALDO_INCOMPLETO');
      const c = new pg.Client({ connectionString: urlOrigen }); await c.connect();
      try { await c.query("UPDATE prestadores_objetos_pendientes SET intentos = intentos WHERE tipo = 'PURGA'"); } finally { await c.end(); }
    }, 240000);
  });

  describe('protección de claves de firma y cifrado', () => {
    test('las claves no aparecen en argumentos de procesos, manifiestos, artefactos ni archivos del repositorio', async () => {
      const secretos = [cfg['ENSAYO_RESPALDO_CLAVE']!, cfg['ENSAYO_PG_PASSWORD']!, cfg['ENSAYO_S3_SECRET_ACCESS_KEY']!, cfg['ENSAYO_GARAGE_RPC_SECRET']!];
      // Se observan, sin sondeo, los argumentos y el entorno de CADA proceso externo que lanzan el respaldo y la restauración.
      const lanzados: { args: string[]; entorno: string[]; claveEnEntorno: boolean }[] = []; const original = lanzador.execFile;
      lanzador.execFile = ((programa: string, args: string[], opciones: { env?: NodeJS.ProcessEnv }) => {
        lanzados.push({ args: [programa, ...args], entorno: Object.keys(opciones.env ?? {}), claveEnEntorno: opciones.env?.['PGPASSWORD'] === cfg['ENSAYO_PG_PASSWORD'] });
        return (original as (...a: unknown[]) => unknown)(programa, args, opciones);
      }) as unknown as typeof lanzador.execFile;
      // Registros: salida estándar y de error del proceso durante el respaldo, la restauración, el arranque del servicio y varios fallos.
      const registros: string[] = []; const escribirOut = process.stdout.write.bind(process.stdout); const escribirErr = process.stderr.write.bind(process.stderr);
      const captura = (original2: typeof process.stdout.write) => ((trozo: string | Uint8Array, ...resto: unknown[]) => { registros.push(String(trozo)); return (original2 as (...x: unknown[]) => boolean)(trozo, ...resto); }) as typeof process.stdout.write;
      process.stdout.write = captura(escribirOut); process.stderr.write = captura(escribirErr);
      const mensajes: string[] = [];
      let m: Manifiesto; let r: Awaited<ReturnType<typeof restaurar>>;
      try {
        m = await respaldar(); r = await restaurar(m, { prefijo: `pruebas/${uuid()}/portafolio/` });
        const servicio = await iniciarValidacion002(entornoServicio(r.url, 3961, bucketDestino)); await servicio.cerrar();
        for (const intento of [() => restaurar(m, { mayor: 17 }), () => restaurar(m, { claves: clavesDeRespaldo(randomBytes(32).toString('base64')) }), () => restaurar(m, { prefijo: r.prefijo, base: r.base }),
          () => iniciarValidacion002(entornoServicio(urlDe(baseNueva()), 3962, bucketDestino))]) { try { await intento(); } catch (e) { mensajes.push(String((e as Error).message), String((e as Error).stack)); } }
      } finally { lanzador.execFile = original; process.stdout.write = escribirOut; process.stderr.write = escribirErr; }
      for (const x of secretos) { expect(registros.join('').includes(x)).toBe(false); expect(mensajes.join(' | ').includes(x)).toBe(false); }
      expect(lanzados.map(l => l.args.find(x => ['pg_dump', 'psql'].includes(x)))).toEqual(expect.arrayContaining(['pg_dump', 'psql']));
      for (const l of lanzados) {
        const linea = l.args.join(' ');
        for (const x of secretos) expect(linea.includes(x)).toBe(false);
        expect(l.args).toContain('PGPASSWORD'); expect(l.claveEnEntorno).toBe(true); expect(l.entorno).toContain('PGPASSWORD');
        expect(l.args.some(x => x.startsWith('PGPASSWORD='))).toBe(false);
      }
      const dir = join(directorio, m.backupId); const textos = [await readFile(join(dir, 'manifiesto.json'), 'utf8'), (await readFile(join(dir, 'volcado.sql.enc'))).toString('latin1'), JSON.stringify(r.resultado)];
      for (const archivo of await readdir(join(dir, 'objetos'))) textos.push((await readFile(join(dir, 'objetos', archivo))).toString('latin1'));
      textos.forEach((t, i) => secretos.forEach((x, j) => expect([i, j, t.includes(x)]).toEqual([i, j, false])));
      // Ningún archivo versionado ni sin versionar y no ignorado contiene las credenciales del ensayo.
      for (const s of secretos) {
        let salida = ''; try { salida = execFileSync('git', ['grep', '--untracked', '-l', '-F', '-e', s], { cwd: resolve('../..'), encoding: 'utf8' }); } catch { salida = ''; }
        expect(salida).toBe('');
      }
    }, 300000);
  });
});
