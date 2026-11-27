import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { AlmacenArchivosSolicitud } from '../../../src/modulos/solicitudes/aplicacion/puertos/archivos.js';
import { LimpiezaSolicitudes, leerConfiguracionDeLimpieza, limpiezaPorOmision, type OpcionesDeLimpieza } from '../../../src/modulos/solicitudes/infraestructura/archivos/limpieza-solicitudes.js';
import { dependenciaNoDisponible } from '../../../src/modulos/solicitudes/dominio/errores.js';
import { limitesDeArchivos } from '../../../src/modulos/solicitudes/dominio/tipos.js';
import { almacenamientoAislado003 } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { crearYPublicar, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T048 · limpieza física y control: CA-ARC-08 a 11, OP-305 y OP-306. Garage y PostgreSQL reales; el reloj de la limpieza es inyectable.
const control = { fallarEliminar: false };
let e: EntornoUs1; let t1: string;
const n = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const existe = async (clave: string) => { const g = await almacenamientoAislado003(); try { return ((await g.cliente.send(new ListObjectsV2Command({ Bucket: g.bucket, Prefix: clave }))).Contents ?? []).some(o => o.Key === clave); } finally { g.cliente.destroy(); } };
const entrada = async (clave: string) => ((await e.db.query('SELECT tipo, intentos, ultimo_error, ultimo_intento_en, proxima_ejecucion, arrendado_hasta FROM solicitudes_objetos_pendientes WHERE clave=$1', [clave])) as
  { tipo: string; intentos: number; ultimo_error: string | null; ultimo_intento_en: Date | null; proxima_ejecucion: Date; arrendado_hasta: Date | null }[])[0];
const limpieza = (almacen: AlmacenArchivosSolicitud = e.almacen, opciones: Partial<OpcionesDeLimpieza> = {}, ahora?: () => Date) => new LimpiezaSolicitudes(e.db, almacen, { ...limpiezaPorOmision, ...opciones }, ahora);
const cuando = (segundos: number) => () => new Date(Date.now() + segundos * 1000);
/** Un objeto real con su entrada PURGA ya vencida. */
async function objetoConPurga(extra: { solicitudId?: string; vencida?: boolean } = {}) {
  const solicitudId = extra.solicitudId ?? randomUUID(); const clave = e.real.claveNueva(solicitudId, randomUUID());
  await e.real.guardar(clave, new Uint8Array(Buffer.from(randomUUID())));
  await e.db.query(`INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) VALUES ($1,'PURGA',$2, now() - interval '${extra.vencida === false ? '-1 hour' : '1 minute'}')`, [clave, solicitudId]);
  return clave;
}

beforeAll(async () => {
  e = await montarUs1({ almacen: real => new Proxy(real, { get(objetivo, propiedad) {
    if (propiedad === 'eliminar' && control.fallarEliminar) return async () => { throw dependenciaNoDisponible(); };
    const valor = Reflect.get(objetivo, propiedad, objetivo) as unknown; return typeof valor === 'function' ? (valor as (...a: unknown[]) => unknown).bind(objetivo) : valor;
  } }) });
  t1 = await e.token(e.datos.clientes.clienteUno);
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('borrado físico inmediato y respaldo durable (CA-ARC-08)', () => {
  test('si el borrado físico inmediato falla, la entrada de purga permanece y la limpieza lo completa', async () => {
    const p = await crearYPublicar(e, t1);
    const a = (await e.cargar(t1, p.solicitudId, await imagen(60, 40)).expect(201)).body.archivoId as string;
    const v2 = (await e.editar(t1, p.solicitudId, { version: p.version, archivosIds: [a] }).expect(200)).body;
    const clave = e.real.claveNueva(p.solicitudId, a);
    control.fallarEliminar = true;
    try { await e.editar(t1, p.solicitudId, { version: v2.version, archivosIds: [] }).expect(200); } finally { control.fallarEliminar = false; }
    expect((await e.archivo(t1, p.solicitudId, a)).status).toBe(404);
    expect(await existe(clave)).toBe(true);
    expect(await entrada(clave)).toMatchObject({ tipo: 'PURGA' });
    const r = await limpieza().ejecutar();
    expect(r.objetosEliminados).toBeGreaterThanOrEqual(1);
    expect(await existe(clave)).toBe(false);
    expect(await entrada(clave)).toBeUndefined();
  }, 120000);
  test('descartar un borrador que tiene archivos pendientes registra su purga en la misma transacción', async () => {
    const c = (await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201)).body;
    const a = (await e.cargar(t1, c.solicitudId, await imagen(30, 30)).expect(201)).body.archivoId as string; const clave = e.real.claveNueva(c.solicitudId, a);
    control.fallarEliminar = true;
    try { await e.cerrarSolicitud(t1, c.solicitudId, { version: c.version }).expect(200); } finally { control.fallarEliminar = false; }
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_archivos WHERE id=$1', [a])).toBe(1);
    expect(((await e.db.query('SELECT estado FROM solicitudes_archivos WHERE id=$1', [a])) as { estado: string }[])[0]!.estado).toBe('DESCARTADO');
    expect(await entrada(clave)).toMatchObject({ tipo: 'PURGA' });
    await limpieza().ejecutar();
    expect(await existe(clave)).toBe(false);
  });
});

describe('idempotencia y concurrencia (CA-ARC-09 y OP-305)', () => {
  test('ejecutar la limpieza dos veces es idempotente: la segunda pasada no encuentra nada y el borrado repetido no falla', async () => {
    const clave = await objetoConPurga();
    const primera = await limpieza().ejecutar(); const segunda = await limpieza().ejecutar();
    expect(primera.objetosEliminados).toBeGreaterThanOrEqual(1);
    expect(segunda).toMatchObject({ reclamadas: 0, objetosEliminados: 0, reintentos: 0 });
    expect(await existe(clave)).toBe(false);
    await e.real.eliminar(clave);
  });
  test('dos instancias simultáneas no procesan nunca la misma clave: cada objeto se elimina exactamente una vez', async () => {
    const claves: string[] = []; for (let i = 0; i < 14; i += 1) claves.push(await objetoConPurga());
    const borrados = new Map<string, number>();
    const contador: AlmacenArchivosSolicitud = new Proxy(e.real, { get(objetivo, propiedad) {
      if (propiedad === 'eliminar') return async (clave: string) => { borrados.set(clave, (borrados.get(clave) ?? 0) + 1); await new Promise(r => setTimeout(r, 30)); await objetivo.eliminar(clave); };
      const valor = Reflect.get(objetivo, propiedad, objetivo) as unknown; return typeof valor === 'function' ? (valor as (...a: unknown[]) => unknown).bind(objetivo) : valor;
    } });
    const a = limpieza(contador, { lote: 4 }); const b = limpieza(contador, { lote: 4 });
    for (let ronda = 0; ronda < 6; ronda += 1) await Promise.all([a.ejecutar(), b.ejecutar()]);
    for (const clave of claves) expect([clave, borrados.get(clave)]).toEqual([clave, 1]);
    expect(await n("SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE clave = ANY($1)", [claves])).toBe(0);
  }, 120000);
  test('un arrendamiento vigente protege la entrada y uno vencido la libera (120 s)', async () => {
    const clave = await objetoConPurga();
    expect((await limpieza(e.almacen, {}, () => new Date()).ejecutar()).objetosEliminados).toBeGreaterThanOrEqual(1);
    const otra = await objetoConPurga();
    await e.db.query("UPDATE solicitudes_objetos_pendientes SET arrendado_hasta = now() + interval '100 seconds' WHERE clave=$1", [otra]);
    expect((await limpieza().ejecutar()).objetosEliminados).toBe(0);
    expect(await existe(otra)).toBe(true);
    expect((await limpieza(e.almacen, {}, cuando(130)).ejecutar()).objetosEliminados).toBe(1);
    expect(await existe(otra)).toBe(false); void clave;
  });
});

describe('reintentos con espera creciente y trazabilidad por entrada (OP-305)', () => {
  test('cada fallo reprograma la entrada con una espera que se duplica, deja el intento y un código sanitizado, y nunca la pierde', async () => {
    const clave = await objetoConPurga(); const esperas: number[] = []; let reloj = Date.now();
    control.fallarEliminar = true;
    try {
      for (let i = 0; i < 4; i += 1) {
        const r = await limpieza(e.almacen, {}, () => new Date(reloj)).ejecutar();
        expect(r).toMatchObject({ reclamadas: 1, reintentos: 1, objetosEliminados: 0 });
        const f = (await entrada(clave))!;
        esperas.push(Math.round((f.proxima_ejecucion.getTime() - reloj) / 1000));
        expect(f).toMatchObject({ intentos: i + 1, ultimo_error: 'ALMACENAMIENTO_NO_DISPONIBLE', arrendado_hasta: null });
        expect(f.ultimo_error).toMatch(/^[A-Z_]+$/);
        // Mientras no llegue la hora, la entrada no se vuelve a reclamar.
        expect((await limpieza(e.almacen, {}, () => new Date(reloj)).ejecutar()).reclamadas).toBe(0);
        reloj = f.proxima_ejecucion.getTime() + 1000;
      }
    } finally { control.fallarEliminar = false; }
    expect(esperas).toEqual([60, 120, 240, 480]);
    const fin = await limpieza(e.almacen, {}, () => new Date(reloj)).ejecutar();
    expect(fin.objetosEliminados).toBe(1);
    expect(await existe(clave)).toBe(false);
  }, 120000);
  test('la espera tiene un máximo y el código de error no contiene la clave ni texto del servidor', async () => {
    const clave = await objetoConPurga(); control.fallarEliminar = true;
    try {
      await e.db.query('UPDATE solicitudes_objetos_pendientes SET intentos = 30 WHERE clave=$1', [clave]);
      const r0 = Date.now(); await limpieza(e.almacen, {}, () => new Date(r0)).ejecutar();
      const f = (await entrada(clave))!;
      expect((f.proxima_ejecucion.getTime() - r0) / 1000).toBeLessThanOrEqual(3601);
      expect(JSON.stringify(f)).not.toContain(clave);
    } finally { control.fallarEliminar = false; await limpieza().ejecutar().catch(() => undefined); await limpieza(e.almacen, {}, cuando(4000)).ejecutar(); }
  });
});

describe('protección de los archivos en carga (OP-306)', () => {
  const preparacion = async (estado: 'PREPARANDO' | 'PREPARADO' | 'CONFIRMADO', caducaEn: string | null, vencida = true) => {
    const c = (await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201)).body; const id = randomUUID(); const clave = e.real.claveNueva(c.solicitudId, id);
    await e.real.guardar(clave, new Uint8Array(Buffer.from('contenido')));
    await e.db.query(`INSERT INTO solicitudes_archivos (id, solicitud_id, estado, objeto_clave, mime, bytes, ancho, alto, checksum, caduca_en, confirmado_en) VALUES ($1,$2,$3,$4,'image/webp',9,5,5,$5,${caducaEn ?? 'NULL'},${estado === 'CONFIRMADO' ? 'now()' : 'NULL'})`,
      [id, c.solicitudId, estado, clave, Buffer.alloc(32, 5)]);
    await e.db.query(`INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) VALUES ($1,'PREPARACION',$2, ${vencida ? "now() - interval '1 minute'" : "now() + interval '1 hour'"})`, [clave, c.solicitudId]);
    return { id, clave, solicitudId: c.solicitudId as string };
  };
  test('una entrada de preparación no se procesa antes de su vencimiento', async () => {
    const f = await preparacion('PREPARANDO', "now() + interval '1 hour'", false);
    expect((await limpieza().ejecutar()).reclamadas).toBe(0);
    expect(await existe(f.clave)).toBe(true);
  });
  test('si la fila sigue PREPARADA y su caducidad lógica no venció, no se borra el objeto: la entrada se reprograma a su vencimiento', async () => {
    const f = await preparacion('PREPARADO', "now() + interval '2 hours'");
    const r = await limpieza().ejecutar();
    expect(r.aplazadas).toBeGreaterThanOrEqual(1);
    expect(await existe(f.clave)).toBe(true);
    expect(((await e.db.query('SELECT estado FROM solicitudes_archivos WHERE id=$1', [f.id])) as { estado: string }[])[0]!.estado).toBe('PREPARADO');
    expect((await entrada(f.clave))!.proxima_ejecucion.getTime()).toBeGreaterThan(Date.now() + 3600_000);
  });
  test('si la fila está CONFIRMADA, la entrada obsoleta se retira sin tocar el objeto', async () => {
    const f = await preparacion('CONFIRMADO', null);
    const r = await limpieza().ejecutar();
    expect(r.retiradasSinBorrar).toBeGreaterThanOrEqual(1);
    expect(await existe(f.clave)).toBe(true);
    expect(await entrada(f.clave)).toBeUndefined();
  });
  test('una PURGA nunca borra el objeto de un archivo CONFIRMADO', async () => {
    const f = await preparacion('CONFIRMADO', null);
    await e.db.query("UPDATE solicitudes_objetos_pendientes SET tipo='PURGA' WHERE clave=$1", [f.clave]);
    await limpieza().ejecutar();
    expect(await existe(f.clave)).toBe(true);
  });
  test('vencida la caducidad lógica, el archivo PREPARADO pasa a DESCARTADO y se elimina su objeto', async () => {
    const f = await preparacion('PREPARADO', "now() - interval '1 second'");
    const r = await limpieza().ejecutar();
    expect(r.archivosCaducados).toBeGreaterThanOrEqual(1);
    expect(((await e.db.query('SELECT estado FROM solicitudes_archivos WHERE id=$1', [f.id])) as { estado: string }[])[0]!.estado).toBe('DESCARTADO');
    expect(await existe(f.clave)).toBe(false);
    expect(await entrada(f.clave)).toBeUndefined();
  });
  test('una clave ajena al almacén de solicitudes nunca se borra: se retira la entrada y se deja el objeto', async () => {
    const ajena = `portafolio/${randomUUID()}/${randomUUID()}`;
    const g = await almacenamientoAislado003();
    try {
      await e.db.query("ALTER TABLE solicitudes_objetos_pendientes DROP CONSTRAINT solicitudes_objetos_pendientes_clave");
      await e.db.query("INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) VALUES ($1,'PURGA',$2, now() - interval '1 minute')", [ajena, randomUUID()]);
      const r = await limpieza().ejecutar();
      expect(r.retiradasSinBorrar).toBeGreaterThanOrEqual(1);
      expect(await entrada(ajena)).toBeUndefined();
    } finally {
      await e.db.query("ALTER TABLE solicitudes_objetos_pendientes ADD CONSTRAINT solicitudes_objetos_pendientes_clave CHECK (clave ~ '^(?:pruebas/[0-9a-f-]{36}/)?solicitudes/[0-9a-f-]{36}/[0-9a-f-]{36}$')");
      g.cliente.destroy();
    }
  });
});

describe('control de detección y plazos distintos (CA-ARC-10 y CA-ARC-11)', () => {
  test('el umbral de 900 s, el intervalo de 300 s y la caducidad de 24 horas son tres plazos distintos', () => {
    expect(limpiezaPorOmision.umbralSegundos).toBe(900);
    expect(leerConfiguracionDeLimpieza({})).toEqual({ intervaloSegundos: 300, umbralSegundos: 900 });
    expect(limitesDeArchivos.caducidadHoras * 3600).toBe(86_400);
    expect(new Set([300, 900, 86_400]).size).toBe(3);
  });
  test('el intervalo es configurable con mínimo 60 s y el umbral exige al menos tres intervalos', () => {
    expect(leerConfiguracionDeLimpieza({ SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS: '60', SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS: '180' })).toEqual({ intervaloSegundos: 60, umbralSegundos: 180 });
    expect(() => leerConfiguracionDeLimpieza({ SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS: '59' })).toThrow('no puede ser menor que 60');
    expect(() => leerConfiguracionDeLimpieza({ SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS: '300', SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS: '899' })).toThrow('al menos tres veces');
    expect(() => leerConfiguracionDeLimpieza({ SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS: 'abc' })).toThrow('entero');
    expect(() => leerConfiguracionDeLimpieza({ SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS: '-5' })).toThrow('entero');
  });
  test('verificar informa las entradas vencidas más allá del umbral, las que tienen errores y los objetos sin fila, sin corregir nada', async () => {
    const limpia = limpieza();
    const base = await limpia.verificar();
    const vencida = await objetoConPurga();
    await e.db.query("UPDATE solicitudes_objetos_pendientes SET proxima_ejecucion = now() - interval '2 hours' WHERE clave=$1", [vencida]);
    const huerfano = e.real.claveNueva(randomUUID(), randomUUID()); await e.real.guardar(huerfano, new Uint8Array([1, 2, 3]));
    const informe = await limpieza(e.almacen, {}, cuando(3600)).verificar();
    expect(informe.entradasVencidasSobreElUmbral).toBeGreaterThanOrEqual(base.entradasVencidasSobreElUmbral + 1);
    expect(informe.objetosSinFila).toBeGreaterThanOrEqual(1);
    expect(informe.hallazgos).toBe(informe.entradasVencidasSobreElUmbral + informe.entradasConError + informe.objetosSinFila + informe.archivosSinObjeto + informe.solicitudesConContadoresDistintos);
    // Solo informa: nada se borra ni se corrige.
    expect(await existe(huerfano)).toBe(true); expect(await existe(vencida)).toBe(true); expect(await entrada(vencida)).toBeDefined();
    // Los objetos sin fila no los toca la limpieza: solo se informan.
    await limpieza(e.almacen, {}, cuando(3600)).ejecutar();
    expect(await existe(huerfano)).toBe(true);
    await e.real.eliminar(huerfano);
  });
  test('una entrada vencida hace menos del umbral no es un hallazgo; pasado el umbral, sí', async () => {
    const clave = await objetoConPurga();
    await e.db.query("UPDATE solicitudes_objetos_pendientes SET proxima_ejecucion = now() - interval '10 minutes' WHERE clave=$1", [clave]);
    const reciente = (await limpieza().verificar()).entradasVencidasSobreElUmbral;
    await e.db.query("UPDATE solicitudes_objetos_pendientes SET proxima_ejecucion = now() - interval '16 minutes' WHERE clave=$1", [clave]);
    expect((await limpieza().verificar()).entradasVencidasSobreElUmbral).toBe(reciente + 1);
    await limpieza().ejecutar();
  });
  test('OP-306 detecta archivos sin objeto y contadores incorrectos, sin modificar el registro', async () => {
    const base = await limpieza().verificar();
    const s = await crearYPublicar(e, t1);
    const archivo = (await e.cargar(t1, s.solicitudId, await imagen()).expect(201)).body.archivoId as string;
    const clave = e.real.claveNueva(s.solicitudId, archivo);
    await e.real.eliminar(clave);
    await e.db.query('UPDATE solicitudes SET archivos_cantidad = 0 WHERE id=$1', [s.solicitudId]);
    try {
      expect(await limpieza().verificar()).toMatchObject({
        archivosSinObjeto: base.archivosSinObjeto + 1,
        solicitudesConContadoresDistintos: base.solicitudesConContadoresDistintos + 1,
      });
      expect(await n('SELECT archivos_cantidad AS n FROM solicitudes WHERE id=$1', [s.solicitudId])).toBe(0);
      expect(await existe(clave)).toBe(false);
    } finally { await e.db.query('UPDATE solicitudes SET archivos_cantidad=1 WHERE id=$1', [s.solicitudId]); }
  });
  test('el informe y la salida solo contienen conteos agregados: ni claves ni identificadores ni datos personales', async () => {
    const informe = await limpieza().verificar(); const resultado = await limpieza().ejecutar();
    for (const o of [informe, resultado]) { expect(Object.values(o).every(v => typeof v === 'number')).toBe(true); expect(JSON.stringify(o)).not.toMatch(/solicitudes\/|pruebas\//); }
  });
});

describe('comandos solicitudes:limpiar:003 y solicitudes:verificar:003 (código de salida)', () => {
  const ejecutar = (guion: string) => spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts', guion)], { cwd: resolve('.'), encoding: 'utf8', timeout: 120_000 });
  test('verificar termina con 0 sin hallazgos y con un código distinto de cero ante una entrada vencida, y no imprime claves', async () => {
    // Opera sobre la base de validación 003 (la dedicada de esta funcionalidad), con una entrada propia que retira al terminar.
    const { crearDataSource } = await import('../../../src/compartido/infraestructura/postgres/data-source.js');
    const { leerConfiguracion003 } = await import('../../../scripts/entorno-003.js');
    const db = crearDataSource((await leerConfiguracion003())['DATABASE_URL']!); await db.initialize();
    const clave = `solicitudes/${randomUUID()}/${randomUUID()}`;
    try {
      const limpio = ejecutar('solicitudes-verificar-003.ts');
      expect([limpio.status, limpio.stdout]).toEqual([0, expect.stringContaining('Verificación 003')]);
      // La API de validación puede estar funcionando durante esta suite. El arrendamiento preserva el caso de prueba para el control sin permitir que el proceso periódico lo reclame.
      await db.query(`INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion, arrendado_hasta)
        VALUES ($1,'PURGA',$2, now() - interval '3 hours', now() + interval '15 minutes')`, [clave, randomUUID()]);
      const con = ejecutar('solicitudes-verificar-003.ts');
      expect(con.status).toBe(2);
      expect(con.stdout).toMatch(/"entradasVencidasSobreElUmbral":[1-9]/);
      expect(`${con.stdout}${con.stderr}`).not.toContain(clave);
    } finally { await db.query('DELETE FROM solicitudes_objetos_pendientes WHERE clave=$1', [clave]); await db.destroy(); }
    const luego = ejecutar('solicitudes-verificar-003.ts');
    expect(luego.status).toBe(0);
  }, 240000);
  test('limpiar imprime solo conteos y termina con 0', () => {
    const r = ejecutar('solicitudes-limpiar-003.ts');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Limpieza 003: \{.*\}\r?\n$/);
    expect(r.stdout).not.toMatch(/solicitudes\//);
  }, 120000);
});
