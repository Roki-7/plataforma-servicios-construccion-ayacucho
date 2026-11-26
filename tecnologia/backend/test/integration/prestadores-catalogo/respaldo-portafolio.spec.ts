import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';
import sharp from 'sharp';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { entornoTrasRestauracion, leerPuerta } from '../../../src/composicion/puerta-restauracion-002.js';
import { DestinoPostgresDocker, migracionesEsperadas002, OrigenPostgresDocker } from '../../../src/composicion/respaldo-002.js';
import { PortafolioS3 } from '../../../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { clavesDeRespaldo, type EtapaRestauracion, descifrar, ErrorRespaldo, respaldarPortafolio, restaurarPortafolio, sha256, validarDestino, type Manifiesto } from '../../../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { almacenDePrueba002 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';

/**
 * Respaldo y restauración coordinados con PostgreSQL real (pg_dump con instantánea exportada) y Garage real, solo sobre bases descartables
 * (ayacucho_002_test_*) y prefijos nuevos pruebas/<uuid>/portafolio/. No usa ayacucho_002_validacion como datos, ni 001, ni sobrescribe nada.
 */
const contenedor = 'ayacucho-002-validacion-postgres-1';
const uuid = () => randomUUID();
const claves = clavesDeRespaldo(randomBytes(32).toString('base64'));

let almacenOrigen: Awaited<ReturnType<typeof almacenDePrueba002>>; let origen: Awaited<ReturnType<typeof baseAislada002>>; let directorio: string;
let migraciones: readonly string[]; let mayor: number;
const creadas: string[] = []; const prefijosDestino: string[] = [];
const fotos: { clave: string; bytes: Uint8Array }[] = []; let objetoHuerfano = ''; let claveRetirada = '';

const consulta = async <T>(url: string, sql: string, p: unknown[] = []): Promise<T[]> => { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return (await c.query(sql, p)).rows as T[]; } finally { await c.end(); } };
const conUrl = (base: string) => { const u = new URL(origen.url); u.pathname = `/${base}`; return u.href; };
const prefijoNuevo = () => { const p = `pruebas/${uuid()}/portafolio/`; prefijosDestino.push(p); return p; };
const nombreNuevo = () => `ayacucho_002_test_${uuid().replaceAll('-', '')}`;
const origenPg = () => new OrigenPostgresDocker(origen.url, contenedor, 3000);
const respaldar = (extra: object = {}) => respaldarPortafolio({ origen: origenPg(), almacen: almacenOrigen.almacen, claves, directorio, aplicacion: 'prueba',
  origenLogico: { baseLogica: new URL(origen.url).pathname.slice(1), bucket: almacenOrigen.bucket, prefijo: almacenOrigen.prefijo, espacioRedis: 'ayacucho:002:origen-prueba' }, ...extra });
const restaurar = async (m: Manifiesto, opciones: { base?: string; prefijo?: string; almacen?: PortafolioS3; intervencion?: (e: EtapaRestauracion, n: number) => Promise<void> } = {}) => {
  const base = opciones.base ?? nombreNuevo(); const prefijo = opciones.prefijo ?? prefijoNuevo(); const url = conUrl(base);
  validarDestino({ urlBase: url, urlOrigen: origen.url, bucket: almacenOrigen.bucket, prefijo, bucketOrigen: almacenOrigen.bucket, prefijoOrigen: 'portafolio/', confirmo: base, permitirBasesDePrueba: true });
  if (!creadas.includes(base)) creadas.push(base);
  const almacenDestino = opciones.almacen ?? new PortafolioS3(almacenOrigen.cliente, almacenOrigen.bucket, prefijo);
  const resultado = await restaurarPortafolio({ directorio, backupId: m.backupId, claves, destinoPostgres: new DestinoPostgresDocker(url, contenedor, mayor), almacenDestino, prefijoDestino: prefijo,
    postgresMayorOrigen: mayor, migracionesEsperadas: migraciones, ...(opciones.intervencion ? { intervencion: opciones.intervencion } : {}) });
  return { resultado, base, url, prefijo, almacenDestino };
};
const claveObjeto = (prestador: string, prefijo = almacenOrigen.prefijo) => `${prefijo}${prestador}/${uuid()}`;

beforeAll(async () => {
  almacenOrigen = await almacenDePrueba002(); origen = await baseAislada002(); directorio = await mkdtemp(join(tmpdir(), 'respaldo-int-'));
  await aplicarMigraciones002(origen.url); migraciones = await migracionesEsperadas002(); mayor = await DestinoPostgresDocker.mayorDe(origen.url);
  const prestador = uuid(); const trabajo = uuid();
  await consulta(origen.url, "INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES($1,$2,'Prestador de respaldo','TECNICO','Experiencia ficticia',true)", [prestador, uuid()]);
  await consulta(origen.url, "INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion) VALUES($1,$2,'Trabajo de respaldo','Descripción')", [trabajo, prestador]);
  for (const color of ['#aa3322', '#2233aa']) {
    const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: color } }).webp().toBuffer(); const clave = claveObjeto(prestador);
    await almacenOrigen.almacen.guardar(clave, bytes); fotos.push({ clave, bytes });
    await consulta(origen.url, "INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES($1,$2,$3,'image/webp',$4,64,48,decode($5,'hex'))", [uuid(), trabajo, clave, bytes.length, sha256(bytes)]);
  }
  // Una foto ya retirada (su objeto espera purga), una preparación inconclusa y un objeto huérfano sin referencia.
  claveRetirada = claveObjeto(prestador); objetoHuerfano = claveObjeto(prestador); await almacenOrigen.almacen.guardar(objetoHuerfano, Buffer.from('huérfano'));
  await consulta(origen.url, "INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PURGA',$2,now() + interval '1 hour'),($3,'PREPARACION',$2,now() + interval '1 hour')", [claveRetirada, prestador, objetoHuerfano]);
}, 240000);
afterAll(async () => {
  try {
    const u = new URL(origen.url); u.pathname = '/postgres'; const admin = new pg.Client({ connectionString: u.href }); await admin.connect();
    try { for (const base of creadas) await admin.query(`DROP DATABASE IF EXISTS "${base}" WITH (FORCE)`); } finally { await admin.end(); }
    for (const p of prefijosDestino) { const a = new PortafolioS3(almacenOrigen.cliente, almacenOrigen.bucket, p); for await (const o of a.listar()) await almacenOrigen.cliente.send(new DeleteObjectCommand({ Bucket: almacenOrigen.bucket, Key: o.clave })); }
    await rm(directorio, { recursive: true, force: true });
  } finally { await almacenOrigen?.limpiar(); await origen?.cerrar(); }
}, 120000);

describe('respaldo con PostgreSQL y Garage reales', () => {
  let manifiesto: Manifiesto;
  test('el respaldo es COMPLETO: la instantánea exportada fija inventario y volcado, los huérfanos no se copian y todo va cifrado', async () => {
    manifiesto = await respaldar();
    expect(manifiesto).toMatchObject({ estado: 'COMPLETO', versiones: { postgresMayor: mayor }, conteos: { fotografiasVigentes: 2, objetosCopiados: 2, preparacionesInconclusas: 1, purgasPendientes: 1 } });
    expect(manifiesto.versiones.migraciones).toEqual(migraciones);
    expect(manifiesto.objetos.map(o => o.clave).sort()).toEqual(fotos.map(f => f.clave).sort());
    expect(manifiesto.objetos.map(o => o.clave)).not.toContain(objetoHuerfano);
    const cifrado = await readFile(join(directorio, manifiesto.backupId, 'volcado.sql.enc'));
    expect(cifrado.toString('latin1')).not.toContain('prestadores_fotografias');
    const claro = descifrar(claves, manifiesto.backupId, 'volcado.sql.enc', cifrado).toString('utf8');
    expect(claro).toContain('CREATE TABLE public.prestadores_fotografias'); expect(sha256(Buffer.from(claro))).toBe(manifiesto.volcado.sha256);
    for (const f of fotos) expect(claro).toContain(f.clave);
  }, 120000);

  test('mientras la instantánea está abierta se pausan las escrituras de portafolio y la limpieza, y luego se reanudan', async () => {
    const intentos: string[] = [];
    const m = await respaldar({ intervencion: async (etapa: string) => {
      if (etapa !== 'tras-instantanea') return;
      const c = new pg.Client({ connectionString: origen.url }); await c.connect();
      try {
        await c.query("SET lock_timeout = '800ms'");
        const trabajo = (await c.query('SELECT id FROM prestadores_trabajos LIMIT 1')).rows[0].id as string;
        const escribir = (sql: string, p: unknown[] = []) => c.query(sql, p).then(() => 'permitido', (e: Error) => /lock timeout/i.test(e.message) ? 'pausado' : `error: ${e.message}`);
        intentos.push(await escribir("INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES($1,$2,$3,'image/webp',3,1,1,decode($4,'hex'))", [uuid(), trabajo, claveObjeto(uuid()), sha256(Buffer.from('x'))]));
        intentos.push(await escribir("UPDATE prestadores_objetos_pendientes SET intentos = intentos + 1"));
        intentos.push(await escribir("DELETE FROM prestadores_objetos_pendientes WHERE tipo = 'PURGA'"));
        intentos.push(await c.query('SELECT count(*) FROM prestadores_fotografias').then(() => 'lectura permitida', () => 'lectura bloqueada'));
      } finally { await c.end(); }
    } });
    expect(intentos).toEqual(['pausado', 'pausado', 'pausado', 'lectura permitida']);
    expect(m.estado).toBe('COMPLETO'); expect(m.conteos.fotografiasVigentes).toBe(2);
    // Tras el corte las escrituras se reanudan y el volcado no incluye nada posterior.
    const c = new pg.Client({ connectionString: origen.url }); await c.connect();
    try { await c.query("UPDATE prestadores_objetos_pendientes SET intentos = intentos + 1 WHERE tipo = 'PURGA'"); } finally { await c.end(); }
  }, 120000);

  test('si el drenaje no se confirma (escritor con la transacción abierta) el respaldo se aborta INCOMPLETO y reanuda', async () => {
    const escritor = new pg.Client({ connectionString: origen.url }); await escritor.connect();
    try {
      await escritor.query('BEGIN');
      await escritor.query("UPDATE prestadores_objetos_pendientes SET intentos = intentos + 0 WHERE tipo = 'PURGA'");
      const e = await respaldar().then(() => undefined, (x: ErrorRespaldo & { manifiesto: Manifiesto }) => x);
      expect(e?.codigo).toBe('DRENAJE_NO_CONFIRMADO');
      expect(e?.manifiesto).toMatchObject({ estado: 'INCOMPLETO', causa: 'DRENAJE_NO_CONFIRMADO' });
      await expect(restaurar(e!.manifiesto)).rejects.toMatchObject({ codigo: 'RESPALDO_INCOMPLETO' });
    } finally { await escritor.query('ROLLBACK'); await escritor.end(); }
    expect((await respaldar()).estado).toBe('COMPLETO');
  }, 120000);

  test('un objeto alterado o ausente en Garage deja el respaldo INCOMPLETO', async () => {
    const original = fotos[0]!;
    await almacenOrigen.almacen.guardar(original.clave, Buffer.from('alterado en el almacén'));
    try {
      const e = await respaldar().then(() => undefined, (x: ErrorRespaldo & { manifiesto: Manifiesto }) => x);
      expect(e?.codigo).toBe('OBJETO_ALTERADO'); expect(e?.manifiesto.estado).toBe('INCOMPLETO');
      await almacenOrigen.almacen.eliminar(original.clave);
      const f = await respaldar().then(() => undefined, (x: ErrorRespaldo & { manifiesto: Manifiesto }) => x);
      expect(f?.codigo).toBe('OBJETO_AUSENTE');
    } finally { await almacenOrigen.almacen.guardar(original.clave, original.bytes); }
  }, 120000);

  describe('restauración en destinos nuevos', () => {
    test('restaura la pareja validada: base y prefijo nuevos, claves remapeadas, reconciliación y puerta abierta con un espacio Redis nuevo', async () => {
      const antes = await consulta<{ n: number }>(origen.url, 'SELECT count(*)::int AS n FROM prestadores_fotografias');
      const { resultado, url, prefijo, almacenDestino } = await restaurar(manifiesto);
      expect(resultado).toMatchObject({ objetosRestaurados: 2, preparacionesDescartadas: 1, purgasConservadas: 1 });
      const refs = await consulta<{ objeto_clave: string; sha: string }>(url, "SELECT objeto_clave, encode(checksum,'hex') AS sha FROM prestadores_fotografias ORDER BY objeto_clave");
      expect(refs).toHaveLength(2);
      for (const r of refs) { expect(r.objeto_clave.startsWith(prefijo)).toBe(true); expect(sha256(await almacenDestino.leer(r.objeto_clave))).toBe(r.sha); }
      const pendientes = await consulta<{ tipo: string; clave: string }>(url, 'SELECT tipo, clave FROM prestadores_objetos_pendientes');
      expect(pendientes.map(p => p.tipo)).toEqual(['PURGA']); expect(pendientes[0]!.clave.startsWith(prefijo)).toBe(true);
      const huerfanos: string[] = []; for await (const o of almacenDestino.listar()) if (!refs.some(r => r.objeto_clave === o.clave)) huerfanos.push(o.clave);
      expect(huerfanos).toEqual([]);
      // Puerta abierta con espacio nuevo; la revisión restaurada coincide con la del origen, por eso el espacio Redis debe cambiar.
      expect(await leerPuerta(url)).toEqual({ estado: 'ABIERTO', espacioRedis: resultado.espacioRedis });
      expect(resultado.espacioRedis).not.toBe('ayacucho:002:origen-prueba');
      const rev = (u: string) => consulta<{ r: string }>(u, 'SELECT revision::text AS r FROM catalogo_revision_oferta');
      expect((await rev(url))[0]!.r).toBe((await rev(origen.url))[0]!.r);
      const entorno = await entornoTrasRestauracion(url, { REDIS_NAMESPACE: 'ayacucho:002:origen-prueba' });
      expect(entorno['REDIS_NAMESPACE']).toBe(resultado.espacioRedis);
      // El origen y su bucket no cambian.
      expect((await consulta<{ n: number }>(origen.url, 'SELECT count(*)::int AS n FROM prestadores_fotografias'))[0]!.n).toBe(antes[0]!.n);
      for (const f of fotos) expect(sha256(await almacenOrigen.almacen.leer(f.clave))).toBe(sha256(f.bytes));
      expect(await almacenOrigen.almacen.leer(objetoHuerfano)).toBeDefined();
    }, 180000);

    test('una base sin puerta (no restaurada) conserva su entorno', async () => {
      expect(await leerPuerta(origen.url)).toBeNull();
      const env = { REDIS_NAMESPACE: 'ayacucho:002:validacion' };
      expect(await entornoTrasRestauracion(origen.url, env)).toBe(env);
    });

    test('una restauración interrumpida deja la puerta CERRADA y el arranque se rechaza; el destino ocupado no se reutiliza y un destino limpio recupera el conjunto', async () => {
      const base = nombreNuevo(); const prefijo = prefijoNuevo();
      await expect(restaurar(manifiesto, { base, prefijo, intervencion: async (e, n) => { if (e === 'tras-objetos' && n === 1) throw new Error('interrupción simulada'); } })).rejects.toThrow('interrupción simulada');
      const url = conUrl(base);
      expect(await leerPuerta(url)).toEqual({ estado: 'CERRADO', espacioRedis: null });
      await expect(entornoTrasRestauracion(url, {})).rejects.toThrow('tráfico permanece cerrado');
      // Reintentar sobre el mismo destino no es posible: ni la base ni el prefijo se reutilizan ni se sobrescriben.
      await expect(restaurar(manifiesto, { base, prefijo })).rejects.toMatchObject({ codigo: 'DESTINO_NO_VACIO' });
      const prefijoOtro = prefijoNuevo();
      await expect(restaurar(manifiesto, { base, prefijo: prefijoOtro })).rejects.toMatchObject({ codigo: 'DESTINO_EXISTENTE' });
      expect(await leerPuerta(url)).toEqual({ estado: 'CERRADO', espacioRedis: null });
      const limpio = await restaurar(manifiesto);
      expect(await leerPuerta(limpio.url)).toMatchObject({ estado: 'ABIERTO' });
      expect(limpio.resultado.espacioRedis).toMatch(/^ayacucho:002:restaurada-/);
    }, 240000);

    test('un objeto alterado o ausente en el conjunto impide restaurar sin crear ninguna base', async () => {
      const m = await respaldar(); const dir = join(directorio, m.backupId, 'objetos');
      const { readdir, writeFile, rm: borrar } = await import('node:fs/promises');
      const archivo = (await readdir(dir))[0]!; const bytes = await readFile(join(dir, archivo));
      const base = nombreNuevo(); const existentes = async () => (await consulta<{ n: number }>(conUrl('postgres'), 'SELECT count(*)::int AS n FROM pg_database WHERE datname = $1', [base]))[0]!.n;
      bytes[bytes.length - 20] = bytes[bytes.length - 20]! ^ 1; await writeFile(join(dir, archivo), bytes);
      await expect(restaurar(m, { base })).rejects.toMatchObject({ codigo: 'ARTEFACTO_ALTERADO' });
      await borrar(join(dir, archivo));
      await expect(restaurar(m, { base })).rejects.toMatchObject({ codigo: 'OBJETO_AUSENTE' });
      expect(await existentes()).toBe(0);
    }, 180000);

    test('un respaldo cuyo manifiesto no coincide con las migraciones de la aplicación no se restaura', async () => {
      const base = nombreNuevo(); const url = conUrl(base); const prefijo = prefijoNuevo();
      validarDestino({ urlBase: url, urlOrigen: origen.url, bucket: almacenOrigen.bucket, prefijo, bucketOrigen: almacenOrigen.bucket, prefijoOrigen: 'portafolio/', confirmo: base, permitirBasesDePrueba: true });
      await expect(restaurarPortafolio({ directorio, backupId: manifiesto.backupId, claves, destinoPostgres: new DestinoPostgresDocker(url, contenedor, mayor), almacenDestino: new PortafolioS3(almacenOrigen.cliente, almacenOrigen.bucket, prefijo),
        prefijoDestino: prefijo, postgresMayorOrigen: mayor, migracionesEsperadas: [...migraciones, 'Futura1799999999999'] })).rejects.toMatchObject({ codigo: 'VERSION_INCOMPATIBLE' });
    });

    test('el destino rechaza la base de validación 002, una base de 001 y el prefijo de origen aunque se confirme su nombre', () => {
      const comun = { urlOrigen: origen.url, bucket: almacenOrigen.bucket, bucketOrigen: almacenOrigen.bucket, prefijoOrigen: 'portafolio/' };
      for (const base of ['ayacucho_002_validacion', 'ayacucho_001_validacion']) {
        expect(() => validarDestino({ ...comun, urlBase: conUrl(base), prefijo: prefijoNuevo(), confirmo: base })).toThrow(expect.objectContaining({ codigo: 'DESTINO_NO_PERMITIDO' }));
      }
      expect(() => validarDestino({ ...comun, urlBase: conUrl(nombreNuevo()), prefijo: 'portafolio/', confirmo: 'x' })).toThrow(ErrorRespaldo);
    });
  });
});
